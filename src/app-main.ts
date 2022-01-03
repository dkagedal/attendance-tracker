
import { LitElement, html, css } from "lit";
import { customElement, property, query } from 'lit/decorators.js';
import "@material/mwc-button/mwc-button";
import "@material/mwc-drawer/mwc-drawer";
import "@material/mwc-fab/mwc-fab";
import "@material/mwc-icon-button/mwc-icon-button";
import "@material/mwc-top-app-bar-fixed/mwc-top-app-bar-fixed";
import { FirebaseApp } from "firebase/app";
import { addDoc, collection, DocumentSnapshot, onSnapshot } from "firebase/firestore";
import { Auth, getAuth, onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { CreateJoinRequest, db, ensureUserExists, getHostBand, User, UserBand } from "./storage";
import "./login-dialog";
import "./band-schedule";
import { BandSchedule } from "./band-schedule";
import { EventEditor } from "./event-editor";
import { Menu } from "@material/mwc-menu";
import { IconButton } from "@material/mwc-icon-button/mwc-icon-button";
import { ActionDetail } from "@material/mwc-list";

interface BandMap {
  [key: string]: UserBand;
}

interface HostMap {
  [key: string]: string | null;
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
    location.hash != "" ? location.hash.substring(1) : location.pathname.substring(1);
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

  @query("#add-dialog-editor")
  addDialogEditor: EventEditor;

  @query("#profile")
  profileIcon: IconButton;

  @query("#profile-menu")
  profileMenu: Menu;

  auth: Auth = null;
  userUnsubscribe: () => void = null;

  constructor() {
    super();
    console.log("[app-main] Constructed");
  }

  updated(changedProperties: { [x: string]: any; }) {
    if (changedProperties.has("app") && this.app) {
      console.log("[app-main] Connected to app", this.app);
      this.auth = getAuth(this.app);
      this.auth.useDeviceLanguage()
      onAuthStateChanged(this.auth, this.authStateChanged.bind(this));
      bandHint().then((bandid) => {
        console.log("[app-main] Band hint:", bandid)
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
    if (this.userUnsubscribe) {
      try {
        this.userUnsubscribe();
      } catch (error) {
        console.log("Failed to unsubscribe from user updates:", error)
      }
      this.userUnsubscribe = null;
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
      this.userUnsubscribe = onSnapshot(userRef, this.currentUserDocChanged.bind(this));
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

  selectBand(bandId: string) {
    console.log("Selecting band", bandId);
    const schedule = document.getElementById("band")! as BandSchedule;
    schedule.bandid = bandId;
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
        reason => console.log("Add failed:", reason)
      );
    }
  }

  async joinRequest() {
    await CreateJoinRequest(this.bandid, this.firebaseUser);
    console.log("Finished registering");
    this.registered = true;
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
      max-width: 600px;
    }

    .application {
      width: 100%;
      height: 100%;
      background: white;
      display: flex;
      justify-content: center;
      align-content: center;
    }
  `;

  renderDrawer() {
    let bandlist = html``;
    if (this.bands != null) {
      const bands = Object.entries(this.bands);
      bandlist = html`
      <ul id="bandList">
        ${bands.map(([id, band]) =>
        html`<li @click=${() => this.selectBand(id)}>${band.display_name}</li>`
      )}
      </ul>`;
    }
    return html`
      ${bandlist}`;
  }

  renderProfileMenu() {
    // If there is no display name, use the email address only.
    const displayName = this.firebaseUser
      ? (this.firebaseUser.displayName || this.firebaseUser.email)
      : "Inte inloggad";
    const secondary = this.firebaseUser?.displayName ? this.firebaseUser.email : null;
    return html`
      <mwc-menu id="profile-menu"
        corner="TOP_END"
        menuCorner="END"
        .anchor=${this.profileIcon}
        @action=${(e) => {
        const detail = e.detail as ActionDetail;
        console.log("[profile-menu]", detail);
        if (detail.index == 0) {
          signOut(this.auth);
        }
      }}
      >
        <mwc-list-item graphic="avatar" ?twoline=${secondary != null} noninteractive>
          <mwc-icon slot="graphic">account_circle</mwc-icon>
          <span>${displayName}</span>
          ${secondary != null ? html`<span slot="secondary">${secondary}</span>`: ""}
        </mwc-list-item>
        <li divider role="separator"></li>
        <mwc-list-item graphic="icon">
          <mwc-icon slot="graphic">exit_to_app</mwc-icon>
          <span>Logga ut</span>
        </mwc-list-item>
      </mwc-menu>`;
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
      <div class="application">
        <div>
          <p>Du verkar inte vara registrerad.</p>
          <mwc-button raised @click=${this.joinRequest}>Ansök</mwc-button>
        </div>
      </div>
    `;
  }

  renderRegistered() {
    return html`
      <div class="application">
        <p>Registrering inskickad.</p>
      </div>
    `;
  }

  renderMain() {
    if (this.loading.size > 0) {
      console.log("[app-main] Still waiting for", this.loading);
      return html`<mwc-linear-progress indeterminate></mwc-linear-progress>`;
    }
    if (this.firebaseUser == null) {
      return html`
        <div class="application">
          <login-dialog .app=${this.app}></login-dialog>
        </div>`;
    }
    if (!(this.bandid in this.bands)) {
      if (this.registered) {
        return this.renderRegistered();
      } else {
        return this.renderRegister();
      }
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
              @click=${() => { this.openDrawer = !this.openDrawer; }}
            ></mwc-icon-button>
            <div slot="title">Närvarokollen</div>
            <mwc-icon-button
              id="profile"
              icon="account_circle"
              slot="actionItems"
              @click=${() => { this.profileMenu.open = !this.profileMenu.open; }}
            ></mwc-icon-button>
            ${this.renderProfileMenu()}
            <div>${this.renderMain()}</div>
          </mwc-top-app-bar-fixed>
        </div>
      </mwc-drawer>
    `;
  }
}
