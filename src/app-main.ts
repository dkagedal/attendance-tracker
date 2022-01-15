import "./profile-editor";
import { LitElement, html, css } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import "@material/mwc-button/mwc-button";
import "@material/mwc-drawer/mwc-drawer";
import "@material/mwc-fab/mwc-fab";
import "@material/mwc-icon-button/mwc-icon-button";
import "@material/mwc-top-app-bar-fixed/mwc-top-app-bar-fixed";
import { FirebaseApp } from "firebase/app";
import {
  addDoc,
  collection,
  deleteDoc,
  DocumentSnapshot,
  onSnapshot,
  QueryDocumentSnapshot,
  QuerySnapshot,
  setDoc
} from "firebase/firestore";
import {
  Auth,
  getAuth,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser
} from "firebase/auth";
import {
  CreateJoinRequest,
  db,
  getHostBand,
  JoinRequest,
  onJoinRequestSnapshot
} from "./storage";
import "./login-dialog";
import "./band-schedule";
import { EventEditor } from "./event-editor";
import { Menu } from "@material/mwc-menu";
import { IconButton } from "@material/mwc-icon-button/mwc-icon-button";
import { ActionDetail, List } from "@material/mwc-list";
import { repeat } from "lit/directives/repeat";
import { Member, User } from "./datamodel";
import { ProfileEditor } from "./profile-editor";
import { Dialog } from "@material/mwc-dialog";
import { Drawer } from "@material/mwc-drawer/mwc-drawer";
import { BandEvent } from "./model/bandevent";

interface BandMap {
  [key: string]: { display_name: string };
}

interface ErrorMessage {
  id: number;
  message: string;
  details: string;
}

var hostBand = undefined;
async function bandFromHostname(): Promise<string | null> {
  if (hostBand === undefined) {
    hostBand = await getHostBand(location.hostname);
  }
  return hostBand;
}

// Returns the URL path for accessing a given band.
async function bandUrlPath(bandId: string): Promise<string> {
  const isDefault = (await bandFromHostname()) == bandId;
  return isDefault ? "/" : `/${bandId}`;
}

// Figure out the current band id, based on URL and default host mappingin the database.
async function extractBandId(): Promise<string | null> {
  const s = location.pathname.split("/")[1];
  if (s.length > 0 && s != "_") {
    return s;
  }
  return await bandFromHostname();
}

@customElement("app-main")
export class AppMain extends LitElement {
  @property({ type: Object, attribute: false })
  app: FirebaseApp = null;

  // The things we're waiting for initial values for.
  @state()
  loading: Set<string> = new Set(["auth", "bandid"]);

  @state()
  loadingSchedule: boolean = false;

  @state()
  firebaseUser: FirebaseUser | null = null;

  // Has a join request been filed?
  @property({ type: Boolean })
  registered = false;

  @state()
  bandid: string = null;

  @property({ type: Object, attribute: false })
  bands: BandMap = {};

  @property({ attribute: false })
  errorMessages: Array<ErrorMessage> = [];

  @state()
  joinRequests: QueryDocumentSnapshot<JoinRequest>[] = [];

  @state()
  viewingJoinRequest: string = null;

  @state()
  membership: Member = null;

  @query("mwc-dialog#add-dialog")
  addDialog: Dialog;

  @query("#add-dialog-editor")
  addDialogEditor: EventEditor;

  @query("#profile")
  profileIcon: IconButton;

  @query("#profile-menu")
  profileMenu: Menu;

  @query("profile-editor")
  profileEditor: ProfileEditor;

  @query("mwc-dialog#settings")
  profileEditorDialog: Dialog;

  auth: Auth = null;
  subscriptions: Map<string, () => void> = new Map();

  subscribe(key: string, fn: () => void) {
    this.subscriptions[key] = fn;
  }

  unsubscribe(key: string) {
    if (this.subscriptions.has(key)) {
      this.subscriptions[key]();
      this.subscriptions.delete(key);
    }
  }

  constructor() {
    super();
    console.log("[app-main] Constructed");
  }

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has("app") && this.app) {
      console.log("[app-main] Connected to app", this.app);
      this.auth = getAuth(this.app);
      this.auth.useDeviceLanguage();
      onAuthStateChanged(this.auth, this.authStateChanged.bind(this));
      extractBandId().then(bandid => {
        console.log("[app-main] Band id:", bandid);
        this.bandid = bandid;
        this.loading.delete("bandid");
        if (!bandid) {
          return;
        }
      });
    }

    if (changedProperties.has("firebaseUser")) {
      this.unsubscribe("user");
      this.unsubscribe("member");
      this.unsubscribe("join-request");
      this.bands = {};

      if (this.firebaseUser) {
        // The user is logged in, let's find out what bands the're member of.
        this.loading.add("bands");
        this.subscribe(
          "user",
          onSnapshot(
            User.ref(db, this.firebaseUser.uid),
            snapshot =>
              this.currentUserDocChanged(this.firebaseUser.uid, snapshot),
            error => {
              if (error.code != "permission-denied") {
                this.addErrorMessage("Internt fel [user]", error);
              }
            }
          )
        );
      }
    }

    if (
      changedProperties.has("firebaseUser") ||
      changedProperties.has("bandid")
    ) {
      // When the user/band pair changes, we need to reevaluate the member status.
      this.unsubscribe("member");
      this.unsubscribe("join-request");
      this.joinRequests = [];
      this.registered = false;

      if (
        !this.loading.has("auth") &&
        !this.loading.has("bandid") &&
        this.firebaseUser &&
        this.bandid
      ) {
        this.subscribe(
          "member",
          onSnapshot(
            Member.ref(db, this.bandid, this.firebaseUser.uid),
            snapshot => {
              this.membership = snapshot.data();
            },
            error => {
              if (error.code != "permission-denied") {
                this.addErrorMessage("Internt fel [member]", error);
              }
            }
          )
        );
      }
    }

    if (changedProperties.has("membership")) {
      this.unsubscribe("join-request");

      if (this.membership?.admin) {
        this.subscribe(
          "join-request",
          onJoinRequestSnapshot(
            this.bandid,
            (snapshot: QuerySnapshot<JoinRequest>) => {
              this.joinRequests = snapshot.docs;
            },
            error => {
              if (error.code != "permission-denied") {
                this.addErrorMessage("Internt fel [join-request]", error);
              }
            }
          )
        );
      }
    }
  }

  // Callback when the Firebase login stat changed.
  async authStateChanged(authUser: FirebaseUser | null) {
    console.log("[app-main] Login state changed:", authUser);
    this.loading.delete("auth");
    this.firebaseUser = authUser;
    this.requestUpdate();
  }

  // Callback when the /users/* doc for the currently logged in user changes.
  // This can for example be if they are added to a new band, or on initial load.
  async currentUserDocChanged(uid: string, snapshot: DocumentSnapshot<User>) {
    if (!snapshot.exists()) {
      console.log(
        "[app-main] User",
        uid,
        "doesn't exist yet. Waiting for cloud function."
      );
      return;
    }
    console.log("[app-main]", snapshot.ref.path, "snapshot:", snapshot);
    const user = snapshot.data();
    console.log("[app-main] New information for user:", user);
    let bands = {};
    for (const bandId in user.bands) {
      const band = user.bands[bandId];
      console.log("Found band", bandId, band);
      bands[bandId] = Object.assign({}, band);
    }
    console.log("[app-main] Bands:", bands);
    this.loading.delete("bands");
    this.bands = bands;
  }

  addErrorMessage(message: string, details?: any) {
    console.log("Displaying error message:", message, details);
    const id =
      this.errorMessages.length == 0
        ? 1
        : this.errorMessages[this.errorMessages.length - 1].id;
    this.errorMessages.push({ id, message, details });
    this.requestUpdate();
  }

  async selectBand(bandId: string) {
    console.log("Selecting band", bandId);
    this.bandid = bandId;
    // TODO: send event
    const urlPath = await bandUrlPath(bandId);
    if (location.pathname != urlPath) {
      history.replaceState({}, "", urlPath);
    }
  }

  saveNewEvent(): void {
    const editor = this.addDialogEditor;
    console.log("[app-main] Editor:", editor);
    if (editor.checkValidity()) {
      editor.save();
      const event = editor.data;
      console.log("New data:", event);
      addDoc(
        collection(db, "bands", this.bandid, "events"),
        BandEvent.toFirestore(event)
      ).then(
        () => {
          console.log("Add successful");
          this.addDialog.close();
        },
        reason => {
          console.log("Add failed:", reason);
          this.addErrorMessage("Kunde inte lägga till händelse", reason);
          this.addDialog.close();
        }
      );
    }
  }

  joinRequest() {
    CreateJoinRequest(this.bandid, this.firebaseUser).then(
      () => {
        console.log("Finished registering");
        this.registered = true;
      },
      error => {
        console.info("Failed to create join request:", error);
        this.addErrorMessage("Kunde inte ansöka", error);
      }
    );
  }

  editProfile() {
    console.log("[app-main] Opening profile editor");
    this.profileEditor.show();
    this.profileEditorDialog.show();
  }

  static styles = css`
    mwc-fab {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
    }

    @media (max-width: 599px) {
      #body {
        margin: 0 16px;
      }
    }

    @media (min-width: 600px) and (max-width: 904px) {
      #body {
        margin: 0 32px;
      }
    }

    @media (min-width: 905px) and (max-width: 1239px) {
      #body {
        margin: 0 auto;
        width: 840px;
      }
    }

    @media (min-width: 1240px) and (max-width: 1493px) {
      #body {
        margin: 0 200px;
      }
    }

    @media (min-width: 1440px) {
      #body {
        margin: 0 auto;
        width: 1040px;
      }
    }

    #schedule {
      display: flex;
      justify-content: center;
    }

    band-schedule {
      flex: 1;
    }

    .toast {
      margin: 4px;
      padding: 6px;
      border: 1px solid rgba(0 0 0 / 20%);
      border-radius: 6px;
      text-align: center;
    }

    .joinreq {
      background: #ffdd88;
    }

    .error {
      background: #ff8888;
    }

    .errormsg {
      display: block;
      color: black;
      font-weight: 700;
    }

    .errordetail {
      color: #444;
      font-family: monospace;
    }
  `;

  renderDrawer() {
    const bands = Object.entries(this.bands);
    return html`
      <mwc-list @action=${(e: CustomEvent) => this.bandListAction(e)}>
        ${repeat(
          bands,
          ([bandid, band]) =>
            html`
              <mwc-list-item data-bandid=${bandid}
                ><span>${band.display_name}</span></mwc-list-item
              >
            `
        )}
      </mwc-list>
    `;
  }

  bandListAction(e: CustomEvent) {
    const list = e.target as List;
    const selectedItem = list.selected as HTMLElement;
    const bandid = selectedItem.dataset["bandid"];
    this.addDialog.close();
    this.selectBand(bandid);
  }

  renderProfileMenu() {
    // If there is no display name, use the email address only.
    const displayName = this.firebaseUser
      ? this.firebaseUser.displayName || this.firebaseUser.email
      : "Inte inloggad";
    const secondary = this.firebaseUser?.displayName
      ? this.firebaseUser.email
      : null;
    return html`
      <mwc-menu
        id="profile-menu"
        corner="TOP_END"
        menuCorner="END"
        .anchor=${this.profileIcon}
        @action=${e => {
          const detail = e.detail as ActionDetail;
          console.log("[profile-menu]", detail);
          switch (detail.index) {
            case 0:
              this.editProfile();
              break;
            case 1:
              signOut(this.auth);
              break;
          }
        }}
      >
        <mwc-list-item
          graphic="avatar"
          ?twoline=${secondary != null}
          noninteractive
        >
          <mwc-icon slot="graphic">account_circle</mwc-icon>
          <span>${displayName}</span>
          ${secondary != null
            ? html`
                <span slot="secondary">${secondary}</span>
              `
            : ""}
        </mwc-list-item>
        <li divider role="separator"></li>
        <mwc-list-item graphic="icon">
          <span>Redigera profil...</span>
        </mwc-list-item>
        <mwc-list-item graphic="icon">
          <mwc-icon slot="graphic">exit_to_app</mwc-icon>
          <span>Logga ut</span>
        </mwc-list-item>
      </mwc-menu>
    `;
  }

  renderSchedule() {
    return html`
      <div id="schedule">
        <band-schedule
          id="band"
          bandid=${this.bandid}
          uid=${this.firebaseUser.uid}
          @loaded=${() => {
            this.loadingSchedule = false;
          }}
        >
        </band-schedule>
      </div>
      <mwc-fab id="fab" icon="add" @click=${() => this.addDialog.show()}>
      </mwc-fab>
      <mwc-dialog id="add-dialog">
        <event-editor id="add-dialog-editor"></event-editor>
        <mwc-button
          slot="primaryAction"
          id="add-dialog-save"
          @click=${() => this.saveNewEvent()}
        >
          Spara
        </mwc-button>
        <mwc-button slot="secondaryAction" dialogAction="cancel"
          >Avbryt</mwc-button
        >
      </mwc-dialog>
    `;
  }

  renderRegister() {
    return html`
      <mwc-dialog open heading="Välkommen">
        <p>
          ${this.registered
            ? "Ansökan skickad"
            : "Du verkar inte vara medlem än."}
        </p>
        <mwc-button
          ?disabled=${this.registered}
          slot="primaryAction"
          @click=${this.joinRequest}
          >Ansök</mwc-button
        >
      </mwc-dialog>
    `;
  }

  isLoading() {
    return this.loading.size > 0;
  }

  renderProgress() {
    if (this.isLoading() || this.loadingSchedule) {
      console.log(
        `[app-main] Still waiting for [${Array.from(this.loading.keys())}]`,
        this.loadingSchedule
      );
      return html`
        <mwc-linear-progress indeterminate></mwc-linear-progress>
      `;
    }
    return "";
  }

  renderJoinRequest(snapshot: QueryDocumentSnapshot<JoinRequest>) {
    return html`
      <div class="joinreq toast">
        ${snapshot.data().display_name} har sökt medlemsskap
        <button
          @click=${() => {
            this.viewingJoinRequest = snapshot.id;
          }}
        >
          Visa
        </button>
      </div>
      <mwc-dialog
        heading="Begäran att gå med"
        ?open=${snapshot.id == this.viewingJoinRequest}
        @closed=${async e => {
          this.viewingJoinRequest = null;
          const action = e.detail.action;
          console.log("[join request] Action:", action);
          try {
            if (action == "accept") {
              await setDoc(snapshot.ref, { approved: true }, { merge: true });
            } else if (action == "reject") {
              await deleteDoc(snapshot.ref);
            }
          } catch (e) {
            console.log("Failed to", action, ":", e);
            this.addErrorMessage("Kunde inte svara på ansökan", e);
          }
        }}
      >
        <p><b>Namn:</b> ${snapshot.data().display_name}</p>
        <p>Vill du acceptera?</p>
        <mwc-button
          slot="primaryAction"
          dialogAction="accept"
          label="Ja"
        ></mwc-button>
        <mwc-button
          slot="secondaryAction"
          dialogAction="reject"
          label="Nej"
        ></mwc-button>
      </mwc-dialog>
    `;
  }

  renderMain() {
    if (this.isLoading()) {
      return "";
    }
    if (!this.bandid) {
      return html`
        <mwc-dialog open heading="Konfigurationsfel">
          <p>Okänd organisation.</p>
        </mwc-dialog>
      `;
    }
    if (this.firebaseUser == null) {
      return html`
        <mwc-dialog open heading="Välkommen">
          <login-dialog .app=${this.app}></login-dialog>
        </mwc-dialog>
      `;
    }
    if (!(this.bandid in this.bands)) {
      return this.renderRegister();
    }
    return html`
      ${this.renderSchedule()}
      <mwc-dialog id="settings" heading="Inställningar för ${this.bandid}">
        <profile-editor
          bandid=${this.bandid}
          uid=${this.firebaseUser.uid}
          .membership=${this.membership}
        ></profile-editor>
        <mwc-button
          slot="primaryAction"
          @click=${async () => {
            if (await this.profileEditor.save()) {
              this.profileEditorDialog.close();
            }
          }}
          >OK</mwc-button
        >
        <mwc-button slot="secondaryAction" dialogAction="cancel"
          >Avbryt</mwc-button
        >
      </mwc-dialog>
    `;
  }

  render() {
    return html`
      <mwc-drawer id="mainMenuDrawer" type="modal">
        <div>${this.renderDrawer()}</div>
        <div slot="appContent">
          <mwc-top-app-bar-fixed>
            <mwc-icon-button
              id="mainMenuButton"
              icon="menu"
              slot="navigationIcon"
              @click=${() => {
                const drawer = this.shadowRoot.getElementById(
                  "mainMenuDrawer"
                ) as Drawer;
                drawer.open = true;
              }}
            ></mwc-icon-button>
            <div slot="title">Närvarokollen</div>
            <mwc-icon-button
              id="profile"
              icon="account_circle"
              slot="actionItems"
              @click=${() => {
                this.profileMenu.open = !this.profileMenu.open;
              }}
            ></mwc-icon-button>
            ${this.renderProfileMenu()} ${this.renderProgress()}
            <div id="body">
              ${repeat(
                this.errorMessages,
                (em: ErrorMessage) => em.id,
                ({ id, message, details }: ErrorMessage) => html`
                  <div class="error toast" id="error-${id}">
                    <span class="errormsg">${message}</span>
                    <span class="errordetail">${details || ""}</span>
                  </div>
                `
              )}
              ${repeat(
                this.joinRequests,
                snapshot => snapshot.id,
                snapshot => this.renderJoinRequest(snapshot)
              )}
              ${this.renderMain()}
            </div>
          </mwc-top-app-bar-fixed>
        </div>
      </mwc-drawer>
    `;
  }
}
