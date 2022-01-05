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
  ensureUserExists,
  getHostBand,
  JoinRequest,
  onJoinRequestSnapshot,
  User,
  UserBand
} from "./storage";
import "./login-dialog";
import "./band-schedule";
import { EventEditor } from "./event-editor";
import { Menu } from "@material/mwc-menu";
import { IconButton } from "@material/mwc-icon-button/mwc-icon-button";
import { ActionDetail, List } from "@material/mwc-list";
import { repeat } from "lit/directives/repeat";

interface BandMap {
  [key: string]: UserBand;
}

interface HostMap {
  [key: string]: string | null;
}

interface ErrorMessage {
  id: number;
  message: string;
  details: string;
}

var hostmap = {} as HostMap;
async function bandFromHostname(): Promise<string | null> {
  if (!(location.hostname in hostmap)) {
    hostmap[location.hostname] = await getHostBand(location.hostname);
  }
  return hostmap[location.hostname];
}

async function bandHint(): Promise<string> {
  const fromUrl =
    location.hash != ""
      ? location.hash.substring(1)
      : location.pathname.substring(1);
  if (fromUrl.length > 0) {
    return fromUrl;
  } else {
    const fromHost = await bandFromHostname();
    return fromHost || "";
  }
}

@customElement("app-main")
export class AppMain extends LitElement {
  @property({ type: Object, attribute: false })
  app: FirebaseApp = null;

  // The things we're waiting for initial values for.
  @property({ attribute: false })
  loading: Set<string> = new Set(["auth", "bandid"]);

  @property({ type: Object, attribute: false })
  firebaseUser: FirebaseUser | null = null;

  // Has a join request been filed?
  @property({ type: Boolean })
  registered = false;

  @property({ type: String, reflect: true })
  bandid: string | null;

  @property({ type: Object, attribute: false })
  bands: BandMap | null = null;

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

  @query("#add-dialog-editor")
  addDialogEditor: EventEditor;

  @query("#profile")
  profileIcon: IconButton;

  @query("#profile-menu")
  profileMenu: Menu;

  auth: Auth = null;
  unsubscribeFuncs: Array<() => void> = [];

  constructor() {
    super();
    console.log("[app-main] Constructed");
  }

  updated(changedProperties: { [x: string]: any }) {
    if (changedProperties.has("app") && this.app) {
      console.log("[app-main] Connected to app", this.app);
      this.auth = getAuth(this.app);
      this.auth.useDeviceLanguage();
      onAuthStateChanged(this.auth, this.authStateChanged.bind(this));
      bandHint().then(bandid => {
        console.log("[app-main] Band hint:", bandid);
        if (!this.bandid) {
          this.bandid = bandid;
        }
        this.loading.delete("bandid");
        this.requestUpdate();
      });
    }
  }

  // Callback when the Firebase login stat changed.
  async authStateChanged(authUser: FirebaseUser | null) {
    console.log("[app-main] Login state changed:", authUser);
    // First, stop tracking any previously logged in user.
    for (const f of this.unsubscribeFuncs) {
      try {
        f();
      } catch (error) {
        console.log("Failed to unsubscribe:", error);
      }
      this.unsubscribeFuncs = [];
    }
    this.bands = null;
    this.registered = false;

    // Remember the new user.
    this.firebaseUser = authUser;
    this.loading.delete("auth");

    // If the user is logged in, make sure they exist in our user database.
    if (this.firebaseUser) {
      this.loading.add("bands");
      const userRef = await ensureUserExists(this.firebaseUser);
      this.unsubscribeFuncs.push(
        onSnapshot(userRef, this.currentUserDocChanged.bind(this)
        ));
      this.unsubscribeFuncs.push(
        onJoinRequestSnapshot(this.bandid, (snapshot: QuerySnapshot<JoinRequest>) => {
          this.joinRequests = snapshot.docs;
        }));
    }
    this.requestUpdate();
  }

  // Callback when the /users/* doc for the currently logged in user changes.
  // This can for example be if they are added to a new band.
  async currentUserDocChanged(snapshot: DocumentSnapshot<User>) {
    console.log("[app-main]", snapshot.ref.path, "snapshot:", snapshot);
    const user = snapshot.data();
    console.log("[app-main] New information for user:", user);
    this.bands = {};
    for (const bandId in user.bands) {
      const band = user.bands[bandId];
      console.log("Found band", bandId, band);
      this.bands[bandId] = Object.assign({}, band);
    }
    console.log("[app-main] Bands:", this.bands);
    this.loading.delete("bands");
    this.requestUpdate();
  }

  addErrorMessage(message: string, details?: string) {
    const id =
      this.errorMessages.length == 0
        ? 1
        : this.errorMessages[this.errorMessages.length - 1].id;
    this.errorMessages.push({ id, message, details });
    this.requestUpdate();
  }

  selectBand(bandId: string) {
    console.log("Selecting band", bandId);
    this.bandid = bandId;
    // TODO: send event
    bandFromHostname().then(canon => {
      const urlPath = canon == bandId ? "/" : `/${bandId}`;
      if (location.pathname != urlPath) {
        history.replaceState({}, "", urlPath);
      }
    });
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

    .application {
      width: 100%;
      height: 100%;
      background: white;
      display: flex;
      justify-content: center;
      align-content: center;
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
    const bands = this.bands != null ? Object.entries(this.bands) : [];
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
          if (detail.index == 0) {
            signOut(this.auth);
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
        <button @click=${() => { this.viewingJoinRequest = snapshot.id; }}>Visa</button>
      </div>
      <mwc-dialog heading="Begäran att gå med" ?open=${snapshot.id == this.viewingJoinRequest}
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
          console.log("Failed to", action,":", e);
          this.addErrorMessage("Kunde inte svara på ansökan", e);
        }
      }}>
        <p><b>Namn:</b> ${snapshot.data().display_name}</p>
        <p>Vill du acceptera?</p>
        <mwc-button slot="primaryAction" dialogAction="accept" label="Ja"></mwc-button>
        <mwc-button slot="secondaryAction" dialogAction="reject" label="Nej"></mwc-button>
      </mwc-dialog>`;
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
    return this.renderSchedule();
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
