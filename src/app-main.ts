import * as firebase from "firebase/app";  // HIDE
import firebaseui from 'firebaseui';  // HIDE
import "@material/mwc-fab/mwc-fab";
import "./band-schedule";
import "@material/mwc-icon-button/mwc-icon-button";
import "@material/mwc-top-app-bar-fixed/mwc-top-app-bar-fixed";
import "@material/mwc-drawer/mwc-drawer"; import { css, customElement, html, LitElement, property } from "lit-element";
import { BandSchedule } from "./band-schedule";
import { db, ensureUserExists, UserBand } from "./storage";
import { EventEditor } from "./event-editor";

interface BandMap {
  [key: string]: UserBand
}

interface HostMap {
  [key: string]: string | null
}

var hostmap = {} as HostMap
async function bandFromHostname(): Promise<string | null> {
  if (!(location.hostname in hostmap)) {
    const snapshot = await db.collection("hosts").doc(location.hostname).get();
    if (snapshot.exists) {
      hostmap[location.hostname] = snapshot.data()!.band;
    } else {
      hostmap[location.hostname] = null;
    }
  }
  return hostmap[location.hostname];
}

async function bandHint(): Promise<string> {
  const fromUrl = location.hash != "" ? location.hash.substr(1) : location.pathname.substr(1);
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
  firebaseUser = null as firebase.User | null;

  // @property({ type: String })
  // bandHint: String = "";

  @property({ type: String, reflect: true })
  view = "login" as "login" | "register" | "registered" | "schedule" | "settings";

  @property({ type: Object, attribute: false })
  bands = {} as BandMap;

  @property({ type: String })
  bandid = null as string | null;

  @property({ type: Boolean })
  openDrawer = false;

  @property({ type: Boolean })
  openAddDialog = false;

  @property({ type: Boolean })
  authStyleLoaded = true;

  auth = firebase.auth();
  userUnsubscribe: () => void = null;

  constructor() {
    super();
    this.auth.languageCode = 'sv';
    this.auth.onAuthStateChanged(async (authUser) => {
      console.log("Login state changed:", authUser);
      this.firebaseUser = authUser;
      if (authUser) {
        this.loggedIn();
      } else {
        this.bands = {};
        this.bandid = null;
        this.startLogin();
      }
    });
  }

  startLogin() {
    if (this.userUnsubscribe) {
      this.userUnsubscribe();
      this.userUnsubscribe = null;
    }
    this.view = "login";
    const elt: Element = this.shadowRoot.querySelector('#firebaseui-auth-container');
    console.log("Starting login", elt);
    const ui = new firebaseui.auth.AuthUI(this.auth);
    ui.start(elt, {
      signInOptions: [
        firebase.auth.EmailAuthProvider.PROVIDER_ID,
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
      ],
      // Other config options...
    });

  }

  async loggedIn() {
    const userRef = await ensureUserExists(this.firebaseUser);
    this.userUnsubscribe = userRef.onSnapshot(async snapshot => {
      const user = snapshot.data();
      console.log("New information for user:", user.display_name, snapshot.id)
      this.bands = {};
      for (const bandId in user.bands) {
        const band = user.bands[bandId];
        console.log('Found band', bandId, band)
        this.bands[bandId] = Object.assign({}, band);
      }
      console.log("Bands:", this.bands);

      if (!this.bandid) {
        this.bandid = await bandHint();
      }
      if (!(this.bandid in this.bands)) {
        this.view = "register";
        return;
      }

      this.view = "schedule";
    });
  }

  selectBand(bandId) {
    console.log("Selecting band", bandId);
    const schedule = document.getElementById("band")! as BandSchedule;
    schedule.bandid = bandId;
    // TODO: send event
    bandFromHostname().then(canon => {
      const urlPath = (canon == bandId) ? '/' : `/${bandId}`;
      if (location.pathname != urlPath) {
        history.replaceState({}, "", urlPath);
      }
    })
  }

  // TODO: Move to BandSchedule?
  addBandEvent() {
    console.log("Add a new band event!");
    this.openAddDialog = false;
  }

  saveNewEvent() {
    const editor = document.getElementById("add-dialog-editor")! as EventEditor;
    const schedule = document.getElementById("band")! as BandSchedule;
    if (editor.checkValidity()) {
      editor.save();
      const data = editor.data;
      console.log("New data:", data);
      db.collection('bands').doc(schedule.bandid).collection("events").add(data).then(
        () => {
          console.log("Add successful");
          this.openAddDialog = false;
        },
        reason => console.log("Update failed:", reason));

    }
  }

  async joinRequest() {
    const docPath = `bands/${this.bandid}/join_requests/${this.firebaseUser.uid}`;
    console.log("Making a join request to", docPath);
    await db.doc(docPath).set({ approved: false }, { merge: true });
    console.log("Done");
    this.view = "registered";
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
      display:flex;
      justify-content: center;
      align-content: center;
    }
  `;

  renderBandList() {
    const bands = Object.entries(this.bands);
    return html`
      <ul id="bandList">
        ${bands.map(([id, band]) => html`<li @click=${() => this.selectBand(id)}>${band.display_name}</li>`)}
      </ul>
    `;
  }

  renderSchedule() {
    return html`
  <div id = "schedule">
    <band-schedule id = "band" bandid = ${this.bandid} uid = ${this.firebaseUser.uid}> </band-schedule>
      </div>
      <mwc-fab id = "fab" icon = "add" @click=${() => { this.openAddDialog = true; }}> </mwc-fab>
        <mwc-dialog id = "add-dialog" ?open=${this.openAddDialog}>
          <event-editor id = "add-dialog-editor"></event-editor>
          <mwc-button slot = "primaryAction" id = "add-dialog-save"
              @click=${() => this.saveNewEvent()}> Spara </mwc-button>
          <mwc-button slot = "secondaryAction" dialogAction = "cancel">Avbryt</mwc-button>
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

  render() {
    return html`
      <mwc-drawer id = "mainMenuDrawer" type = "modal" ?open=${this.openDrawer}>
        <div>
          ${this.renderBandList()}
          <p>${this.firebaseUser ? this.firebaseUser.displayName : "Inte inloggad"} </p>
        </div>
        <div slot = "appContent">
          <mwc-top-app-bar-fixed>
          <mwc-icon-button id = "mainMenuButton" icon = "menu" slot = "navigationIcon"
              @click=${() => { this.openDrawer = !this.openDrawer }}></mwc-icon-button>
        <div slot = "title">Närvarokollen</div>
        <mwc-icon-button icon = "account_circle" slot = "actionItems"></mwc-icon-button>
        <div>
          <link rel="stylesheet" type = "text/css" href = "https://www.gstatic.com/firebasejs/ui/4.6.1/firebase-ui-auth.css" @load=${() => { this.authStyleLoaded = true }} />
          <div id = "firebaseui-auth-container" style = "display: ${this.view == "login" ? "block" : "none"};" @load=${this.startLogin}></div>
          ${this.view == "schedule" ? this.renderSchedule() : ''}
          ${this.view == "register" ? this.renderRegister() : ''}
          ${this.view == "registered" ? this.renderRegistered() : ''}
        </div>
        </mwc-top-app-bar-fixed>
        </div>
      </mwc-drawer>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'app-main': AppMain;
  }
}