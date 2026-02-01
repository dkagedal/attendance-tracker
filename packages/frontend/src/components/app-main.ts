import "./profile-editor";
import { LitElement, html, css } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import "./app-drawer";
import { AppDrawer } from "./app-drawer";
import "./app-dialog";
import { AppDialog } from "./app-dialog";
import { FirebaseApp } from "firebase/app";
import {
  deleteDoc,
  DocumentSnapshot,
  onSnapshot,
  QueryDocumentSnapshot,
  QuerySnapshot
} from "firebase/firestore";
import {
  Auth,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser
} from "firebase/auth";
import { CreateJoinRequest, db, getHostBand } from "../storage";
import "./login-dialog";
import "./band-schedule";
import "./event-editor";
import { EventEditor } from "./event-editor";
import { repeat } from "lit/directives/repeat";
import { User } from "../datamodel";
import { band } from "../model/band";
import { ProfileEditor } from "./profile-editor";
import { Member } from "../model/member";
import { JoinRequest, JoinRequestReference } from "../model/joinrequest";

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

  @query("app-dialog#add-dialog")
  addDialog: AppDialog;

  @query("#add-dialog-editor")
  addDialogEditor: EventEditor;

  @query("app-drawer")
  drawer: AppDrawer;

  @query("profile-editor")
  profileEditor: ProfileEditor;

  @query("app-dialog#settings")
  profileEditorDialog: AppDialog;

  @state()
  profileMenuOpen = false;

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
    // Force registration of side-effect components
    console.log("[app-main] Ensuring components:", AppDrawer, AppDialog);
    console.log("[app-main] Constructed");
  }

  async updated(changedProperties: Map<string, any>) {
    console.log("[app-main] Properties changed:", changedProperties);
    if (changedProperties.has("app") && this.app) {
      console.log("[app-main] Connected to app");
      this.auth = getAuth(this.app);
      this.auth.useDeviceLanguage();

      // Check if we're back after a redirect login.
      const loginResult = await getRedirectResult(this.auth);
      if (loginResult) {
        // We don't really need this result, since we'll also get it in the onAuthStateChanged callback.
        console.log("[app-main] User:", loginResult.user);
      }

      this.subscribe("auth", onAuthStateChanged(this.auth, this.authStateChanged.bind(this)));
      const bandid = await extractBandId();
      console.log("[app-main] Band id:", bandid);
      this.bandid = bandid;
      this.loading.delete("bandid");
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
            band(db, this.bandid).member(this.firebaseUser.uid).dbref,
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
          band(db, this.bandid)
            .join_requests()
            .query()
            .onSnapshot(
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
    if (!this.bandid && Object.keys(bands).length == 1) {
      this.selectBand(Object.keys(bands)[0]);
    }
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
      band(db, this.bandid)
        .events()
        .add(event)
        .then(
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
    :host {
      --header-height: 64px;
      display: block;
      box-sizing: border-box;
    }

    *, *:before, *:after {
      box-sizing: border-box;
    }

    .app-header {
      height: var(--header-height);
      background: var(--app-color-primary-gradient);
      color: white;
      display: flex;
      align-items: center;
      padding: 0 var(--app-spacing-md);
      box-shadow: var(--app-shadow-md);
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      z-index: 100;
    }

    .app-title {
      font-size: var(--app-font-size-xl);
      font-weight: var(--app-font-weight-bold);
      flex: 1;
      margin-left: var(--app-spacing-md);
    }

    .main-content {
      margin-top: var(--header-height);
      padding: var(--app-spacing-md);
      max-width: 800px;
      margin-left: auto;
      margin-right: auto;
    }

    .fab {
      position: fixed;
      bottom: var(--app-spacing-lg);
      right: var(--app-spacing-lg);
      z-index: 90;
    }

    /* Profile Menu */
    .profile-menu-container {
      position: relative;
    }

    .profile-menu {
      position: absolute;
      top: 100%;
      right: 0;
      background: var(--app-color-surface);
      border-radius: var(--app-radius-md);
      box-shadow: var(--app-shadow-lg);
      padding: var(--app-spacing-xs) 0;
      min-width: 200px;
      display: none;
      z-index: 1000;
      color: var(--app-color-text);
    }

    .profile-menu.open {
      display: block;
    }

    .menu-item {
      padding: var(--app-spacing-sm) var(--app-spacing-md);
      display: flex;
      align-items: center;
      gap: var(--app-spacing-sm);
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .menu-item:hover {
      background-color: var(--app-color-background);
    }

    .menu-divider {
      height: 1px;
      background-color: var(--app-color-border);
      margin: var(--app-spacing-xs) 0;
    }

    /* Drawer Items */
    .drawer-item {
      padding: var(--app-spacing-sm) var(--app-spacing-md);
      cursor: pointer;
      border-radius: var(--app-radius-sm);
      margin-bottom: var(--app-spacing-xs);
    }

    .drawer-item:hover {
      background-color: var(--app-color-background);
    }

    .drawer-item.selected {
      background-color: rgba(37, 99, 235, 0.1);
      color: var(--app-color-primary);
      font-weight: var(--app-font-weight-medium);
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
      <div class="drawer-list">
        ${repeat(
      bands,
      ([bandid, band]) =>
        html`
              <div
                class="drawer-item ${bandid === this.bandid ? "selected" : ""}"
                @click=${() => {
            this.selectBand(bandid);
            this.drawer.close();
          }}
              >
                ${band.display_name}
              </div>
            `
    )}
      </div>
    `;
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
      <div class="profile-menu-container">
        <app-button
          variant="icon"
          icon="account_circle"
          style="color: white;"
          @click=${(e: Event) => {
        e.stopPropagation();
        this.profileMenuOpen = !this.profileMenuOpen;
      }}
        ></app-button>
        <div class="profile-menu ${this.profileMenuOpen ? "open" : ""}" @click=${(e: Event) => e.stopPropagation()}>
          <div class="menu-item" style="cursor: default;">
            <div style="display: flex; flex-direction: column;">
              <span style="font-weight: bold;">${displayName}</span>
              ${secondary ? html`<span style="font-size: 0.8em; color: var(--app-color-text-secondary);">${secondary}</span>` : ""}
            </div>
          </div>
          <div class="menu-divider"></div>
          <div class="menu-item" @click=${() => { this.editProfile(); this.profileMenuOpen = false; }}>
            <app-icon icon="edit" style="font-size: 20px;"></app-icon>
            <span>Redigera profil...</span>
          </div>
          <div class="menu-item" @click=${() => { signOut(this.auth); this.profileMenuOpen = false; }}>
            <app-icon icon="exit_to_app" style="font-size: 20px;"></app-icon>
            <span>Logga ut</span>
          </div>
        </div>
      </div>
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
      <div class="fab">
        <app-button
          variant="primary"
          icon="add"
          style="border-radius: 9999px; padding: 16px; box-shadow: var(--app-shadow-lg);"
          @click=${() => this.addDialog.show()}
        ></app-button>
      </div>
      <app-dialog id="add-dialog" heading="Ny händelse" hideCloseButton>
        <event-editor id="add-dialog-editor"></event-editor>
        <app-button
          slot="primaryAction"
          variant="primary"
          @click=${() => this.saveNewEvent()}
        >
          Spara
        </app-button>
        <app-button slot="secondaryAction" variant="secondary" @click=${() => this.addDialog.close()}
          >Avbryt</app-button
        >
      </app-dialog>
    `;
  }

  renderRegister() {
    return html`
      <app-dialog open heading="Välkommen">
        <p>
          ${this.registered
        ? "Ansökan skickad"
        : "Du verkar inte vara medlem än."}
        </p>
        <app-button
          ?disabled=${this.registered}
          slot="primaryAction"
          variant="primary"
          @click=${this.joinRequest}
          >Ansök</app-button
        >
      </app-dialog>
    `;
  }

  isLoading() {
    return this.loading.size > 0;
  }

  renderProgress() {
    if (this.isLoading() || this.loadingSchedule) {
      return html`
        <div style="position: fixed; top: var(--header-height); left: 0; width: 100%; height: 4px; background: linear-gradient(90deg, var(--app-color-primary) 0%, var(--app-color-secondary) 100%); animation: loading 1s infinite;"></div>
        <style>
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        </style>
      `;
    }
    return "";
  }

  renderJoinRequest(snapshot: QueryDocumentSnapshot<JoinRequest>) {
    return html`
      <div class="joinreq toast">
        ${snapshot.data().display_name} har sökt medlemsskap
        <app-button
          variant="text"
          @click=${() => {
        this.viewingJoinRequest = snapshot.id;
      }}
        >
          Visa
        </app-button>
      </div>
      <app-dialog
        heading="Begäran att gå med"
        ?open=${snapshot.id == this.viewingJoinRequest}
        @closed=${async () => {
        this.viewingJoinRequest = null;
        // app-dialog doesn't use dialogAction like mwc-dialog, we need to handle it differently or assume close means cancel unless explicitly handled.
        // But wait, app-button click handler is where we should do the action.
      }}
      >
        <p><b>Namn:</b> ${snapshot.data().display_name}</p>
        <p>Vill du acceptera?</p>
        <app-button
          slot="primaryAction"
          variant="primary"
          @click=${async () => {
        await new JoinRequestReference(snapshot.ref).update(
          { approved: true },
          { merge: true }
        );
        this.viewingJoinRequest = null;
      }}
          label="Ja"
        >Ja</app-button>
        <app-button
          slot="secondaryAction"
          variant="secondary"
          @click=${async () => {
        await deleteDoc(snapshot.ref);
        this.viewingJoinRequest = null;
      }}
          label="Nej"
        >Nej</app-button>
      </app-dialog>
    `;
  }

  renderMain() {
    if (this.isLoading()) {
      return "";
    }
    if (this.firebaseUser == null) {
      return html`
        <app-dialog open heading="Välkommen">
          <login-dialog .app=${this.app}></login-dialog>
        </app-dialog>
      `;
    }
    if (!this.bandid) {
      console.log("No band selected");
      if (Object.keys(this.bands).length == 0) {
        console.log("No bands available for this user.");
        return html`
          <app-dialog open heading="Konfigurationsfel">
            <p>Du verkar inte vara medlem i något band än.</p>
          </app-dialog>
        `;
      } else {
        console.log("Showing band selector");
        return html`
          <app-dialog open hideCloseButton heading="Välj band">
            <div style="display: flex; flex-direction: column; gap: 8px; padding: 16px 0;">
              ${Object.keys(this.bands).map(
          (id) => html`
                  <app-button
                    variant="secondary"
                    style="width: 100%;"
                    @click=${() => this.selectBand(id)}
                  >
                    ${this.bands[id].display_name}
                  </app-button>
                `
        )}
            </div>
          </app-dialog>
        `;
      }
    }
    if (!(this.bandid in this.bands)) {
      return this.renderRegister();
    }
    return html`
      ${this.renderSchedule()}
      <app-dialog id="settings" heading="Inställningar för ${this.bandid}">
        <profile-editor
          bandid=${this.bandid}
          uid=${this.firebaseUser.uid}
          .membership=${this.membership}
        ></profile-editor>
        <app-button
          slot="primaryAction"
          variant="primary"
          @click=${async () => {
        if (await this.profileEditor.save()) {
          this.profileEditorDialog.close();
        }
      }}
          >OK</app-button
        >
        <app-button slot="secondaryAction" variant="secondary" @click=${() => this.profileEditorDialog.close()}
          >Avbryt</app-button
        >
      </app-dialog>
    `;
  }

  render() {
    return html`
      <app-drawer id="mainMenuDrawer" @close=${() => (this.drawer.open = false)}>
        <div slot="header">
          <span style="font-weight: bold; font-size: 1.2rem;">Organisationer</span>
        </div>
        ${this.renderDrawer()}
      </app-drawer>

      <div class="app-header" @click=${() => { if (this.profileMenuOpen) this.profileMenuOpen = false; }}>
        <app-button
          variant="icon"
          icon="menu"
          style="color: white;"
          @click=${() => {
        this.drawer.open = true;
      }}
        ></app-button>
        <div class="app-title">Närvarokollen</div>
        ${this.renderProfileMenu()}
      </div>
      ${this.renderProgress()}

      <div class="main-content" @click=${() => { if (this.profileMenuOpen) this.profileMenuOpen = false; }}>
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
      </div>
    `;
  }
}
