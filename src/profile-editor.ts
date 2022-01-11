import "@material/mwc-formfield/mwc-formfield";
import "@material/mwc-button/mwc-button";
import "@material/mwc-textfield/mwc-textfield";
import "@material/mwc-dialog/mwc-dialog";
import "@material/mwc-switch/mwc-switch";
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators";
import { TextField } from "@material/mwc-textfield/mwc-textfield";
import { Member, MemberSettings } from "./datamodel";
import { getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./storage";
import { Switch } from "@material/mwc-switch/mwc-switch";

@customElement("profile-editor")
export class ProfileEditor extends LitElement {
  @property()
  bandid: string = null;

  @property()
  uid: string = null;

  // Enable UI for admin access.
  @property({ type: Boolean })
  admin: boolean = false;

  @state()
  settings: MemberSettings = MemberSettings.DEFAULT;

  @state()
  member: Member = null;

  @state()
  settingsLoaded = false;

  loaded() {
    return this.settingsLoaded && this.member != null;
  }

  show() {
    getDoc(Member.ref(db, this.bandid, this.uid)).then(
      snapshot => {
        this.member = snapshot.data();
      },
      error => {
        console.log("[profile-editor] Failed to read member:", error);
      }
    );
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
        this.settingsLoaded = true;
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
    #notify {
      padding: 1em;
    }
    mwc-formfield {
      width: 100%;
      padding: 8px 0;
    }
    :host(:not([admin])) .admin {
      display: none;
    }
  `;

  render() {
    return html`
      <mwc-dialog
        heading="Inställningar för ${this.bandid}"
        ?open=${this.loaded()}
        @closed=${() => {
          this.settings = MemberSettings.DEFAULT;
          this.settingsLoaded = false;
          this.member = null;
        }}
      >
        <div id="contents">
          <mwc-textfield
            id="display_name"
            label="Namn"
            type="text"
            placeholder="Ditt namn som det syns för andra"
            required
            value=${this.member ? this.member.display_name : ""}
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
            <mwc-formfield
              alignEnd
              spaceBetween
              label="Ny medlem"
              class="admin"
            >
              <mwc-switch
                id="new_member"
                ?selected=${this.settings.notify.new_member}
              ></mwc-switch>
            </mwc-formfield>
          </div>
        </div>
        <mwc-button slot="primaryAction" @click=${() => this.save()}
          >OK</mwc-button
        >
        <mwc-button slot="secondaryAction" dialogAction="cancel"
          >Avbryt</mwc-button
        >
      </mwc-dialog>
    `;
  }

  async save() {
    const dialog = this.shadowRoot.querySelector("mwc-dialog");
    const nameField: TextField = this.shadowRoot.querySelector("#display_name");
    const emailField: TextField = this.shadowRoot.querySelector("#email");
    nameField.reportValidity();
    emailField.reportValidity();
    if (!nameField.checkValidity() || !emailField.checkValidity()) {
      return;
    }

    if (nameField.value != this.member.display_name) {
      console.log("[profile-editor] New display name:", nameField.value);
      await setDoc(
        Member.ref(db, this.bandid, this.uid),
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
    await setDoc(MemberSettings.ref(db, this.bandid, this.uid), settings);

    dialog.close();
  }
}
