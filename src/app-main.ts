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
  @property({ attribute: false })
  loading: Set<string> = new Set(["auth", "bandid"]);

  @state()
  firebaseUser: FirebaseUser | null = null;

  // Has a join request been filed?
  @property({ type: Boolean })
  registered = false;

  @property({ type: String, reflect: true })
  bandid: string | null;

  @property({ type: Object, attribute: false })
  bands: BandMap = {};

  @property({ type: Boolean })
  openDrawer = false;

  @property({ type: Boolean })
  openAddDialog = false;

  @property({ attribute: false })
  errorMessages: Array<ErrorMessage> = [];

  @state()
  joinRequests: QueryDocumentSnapshot<JoinRequest>[] = [];

  @state()
  viewingJoinRequest: string = null;

  @state()
  membership: Member = null;

  @query("#add-dialog-editor")
  addDialogEditor: EventEditor;

  @query("#profile")
  profileIcon: IconButton;

  @query("#profile-menu")
  profileMenu: Menu;

  @query("#editprofile")
  profileEditor: ProfileEditor;

  auth: Auth = null;
  unsubscribeUserUpdates: () => void = null;
  unsubscribeMemberUpdates: () => void = null;
  unsubscribeJoinRequestUpdates: () => void = null;

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
        if (!bandid) {
          return;
        }
        if (!this.bandid) {
          this.bandid = bandid;
        }
        this.loading.delete("bandid");
        this.requestUpdate();
      });
    }

    if (changedProperties.has("firebaseUser")) {
      this.loading.delete("auth");
      if (this.unsubscribeUserUpdates) {
        this.unsubscribeUserUpdates();
        this.unsubscribeUserUpdates = null;
      }
      this.bands = {};

      if (this.firebaseUser) {
        // The user is logged in, let's find out what bands the're member of.
        this.loading.add("bands");
        this.unsubscribeUserUpdates =
          onSnapshot(
            User.ref(db, this.firebaseUser.uid),
            snapshot => this.currentUserDocChanged(this.firebaseUser.uid, snapshot),
            error => this.addErrorMessage("Internt fel", error)
          );
      }
    }

    if (changedProperties.has("firebaseUser") || changedProperties.has("bandid")) {
      // When the user/band pair changes, we need to reevaluate the member status.
      if (this.unsubscribeMemberUpdates) {
        this.unsubscribeMemberUpdates();
        this.unsubscribeMemberUpdates = null;
      }
      this.joinRequests = [];
      this.registered = false;

      if (this.firebaseUser && this.bandid) {
        this.unsubscribeMemberUpdates =
          onSnapshot(
            Member.ref(db, this.bandid, this.firebaseUser.uid),
            snapshot => { this.membership = snapshot.data(); },
            error => this.addErrorMessage("Internt fel", error)
          );
      }
    }

    if (changedProperties.has("membership")) {
      if (this.unsubscribeJoinRequestUpdates) {
        this.unsubscribeJoinRequestUpdates();
        this.unsubscribeJoinRequestUpdates = null;
      }

      if (this.membership?.admin) {
        this.unsubscribeJoinRequestUpdates =
          onJoinRequestSnapshot(
            this.bandid,
            (snapshot: QuerySnapshot<JoinRequest>) => {
              this.joinRequests = snapshot.docs;
            },
            error => this.addErrorMessage("Internt fel [join-request]", error)
          );
      }
    }
  }

  // Callback when the Firebase login stat changed.
  async authStateChanged(authUser: FirebaseUser | null) {
    console.log("[app-main] Login state changed:", authUser);
    this.firebaseUser = authUser;
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
      const data = editor.data;
      console.log("New data:", data);
      addDoc(collection(db, "bands", this.bandid, "events"), data).then(
        () => {
          console.log("Add successful");
          this.openAddDialog = false;
        },
        reason => {
          console.log("Add failed:", reason);
          this.addErrorMessage("Kunde inte lägga till händelse", reason);
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
  }

  static styles = css`
    mwc-fab {
      position: fixed;
      bottom: 1rem;
      right: 1rem;
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
    this.openDrawer = false;
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
        >
        </band-schedule>
      </div>
      <mwc-fab
        id="fab"
        icon="add"
        @click=${() => {
          this.openAddDialog = true;
        }}
      >
      </mwc-fab>
      <mwc-dialog id="add-dialog" ?open=${this.openAddDialog}>
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
    if (this.isLoading()) {
      console.log("[app-main] Still waiting for", this.loading);
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
      <profile-editor
        id="editprofile"
        bandid=${this.bandid}
        uid=${this.firebaseUser.uid}
        ?admin=${this.membership?.admin}
      ></profile-editor>
    `;
  }

  render() {
    return html`
      <mwc-drawer id="mainMenuDrawer" type="modal" ?open=${this.openDrawer}>
        <div>${this.renderDrawer()}</div>
        <div slot="appContent">
          <mwc-top-app-bar-fixed>
            <mwc-icon-button
              id="mainMenuButton"
              icon="menu"
              slot="navigationIcon"
              @click=${() => {
                this.openDrawer = !this.openDrawer;
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
            ${this.renderProfileMenu()}
            <div>
              ${this.renderProgress()}
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
