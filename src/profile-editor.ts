import "@material/mwc-formfield/mwc-formfield";
import "@material/mwc-button/mwc-button";
import "@material/mwc-textfield/mwc-textfield";
import "@material/mwc-dialog/mwc-dialog";
import "@material/mwc-switch/mwc-switch";
import { LitElement, html, css } from "lit";
import { customElement, property, query, state } from "lit/decorators";
import { TextField } from "@material/mwc-textfield/mwc-textfield";
import { MemberSettings } from "./datamodel";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./storage";
import { Switch } from "@material/mwc-switch/mwc-switch";
import { classMap } from "lit/directives/class-map";
import { Dialog } from "@material/mwc-dialog/mwc-dialog";
import { Member } from "./model/member";

@customElement("profile-editor")
export class ProfileEditor extends LitElement {
  @property()
  bandid: string = null;

  @property()
  uid: string = null;

  @state()
  settings: MemberSettings = MemberSettings.DEFAULT;

  @property({ type: Object, attribute: false })
  membership: Member = null;

  @query("mwc-dialog")
  dialog: Dialog;

  show() {
    getDoc(MemberSettings.ref(db, this.bandid, this.uid)).then(
      snapshot => {
        if (snapshot.exists()) {
          this.settings = snapshot.data();
        } else {
          this.settings = MemberSettings.DEFAULT;
          if (this.uid == auth.currentUser?.uid) {
            this.settings.email = auth.currentUser.email;
          }
        }
        this.requestUpdate();
      },
      error => {
        console.log("[profile-editor] Failed to read settings:", error);
      }
    );
  }

  static styles = css`
    #contents {
      display: flex;
      flex-direction: column;
      width: 300px;
    }
    #contents:not(.admin) .admin {
      display: none;
    }
    #notify {
      padding: 1em;
    }
    mwc-formfield {
      width: 100%;
      padding: 8px 0;
    }
  `;

  render() {
    const classes = { admin: !!this.membership?.admin };
    return html`
      <div id="contents" class=${classMap(classes)}>
        <mwc-textfield
          id="display_name"
          label="Namn"
          type="text"
          placeholder="Ditt namn som det syns för andra"
          required
          value=${this.membership?.display_name}
        ></mwc-textfield>
        <p>Notifieringar</p>
        <mwc-textfield
          id="email"
          label="E-post"
          type="email"
          value=${this.settings.email}
        ></mwc-textfield>
        <div id="notify">
          <mwc-formfield alignEnd spaceBetween label="Nya händelser">
            <mwc-switch
              id="new_event"
              ?selected=${this.settings.notify.new_event}
            ></mwc-switch>
          </mwc-formfield>
          <mwc-formfield
            alignEnd
            spaceBetween
            label="Ny ansökning om medlemskap"
            class="admin"
          >
            <mwc-switch
              id="new_join_request"
              ?selected=${this.settings.notify.new_join_request}
            ></mwc-switch>
          </mwc-formfield>
          <mwc-formfield alignEnd spaceBetween label="Ny medlem" class="admin">
            <mwc-switch
              id="new_member"
              ?selected=${this.settings.notify.new_member}
            ></mwc-switch>
          </mwc-formfield>
        </div>
      </div>
    `;
  }

  // Returns true if valid settings were successfully saved, and false if there was a validation problem.
  async save(): Promise<boolean> {
    const nameField: TextField = this.shadowRoot.querySelector("#display_name");
    const emailField: TextField = this.shadowRoot.querySelector("#email");
    nameField.reportValidity();
    emailField.reportValidity();
    if (!nameField.checkValidity() || !emailField.checkValidity()) {
      return false;
    }

    if (nameField.value != this.membership.display_name) {
      console.log("[profile-editor] New display name:", nameField.value);
      await setDoc(
        //Member.ref(db, this.bandid, this.uid),
        doc(db, "bands", this.bandid, "members", this.uid),
        { display_name: nameField.value },
        { merge: true }
      );
    }

    const getSwitch = (id: string) =>
      this.shadowRoot.querySelector("#" + id) as Switch;
    const settings = new MemberSettings(emailField.value, {
      new_event: getSwitch("new_event").selected,
      new_join_request: getSwitch("new_join_request").selected,
      new_member: getSwitch("new_member").selected
    });
    console.log("[profile-editor] New member settings:", settings);
    await setDoc(
      MemberSettings.ref(db, this.bandid, this.uid).withConverter(
        MemberSettings.converter
      ),
      settings
    );

    return true;
  }
}
