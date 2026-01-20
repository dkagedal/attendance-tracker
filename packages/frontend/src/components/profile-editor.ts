import "./app-input";
import "./app-switch";
import { AppInput } from "./app-input";
import { AppSwitch } from "./app-switch";
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { auth, db } from "../storage";
import { classMap } from "lit/directives/class-map";
import { Member } from "../model/member";
import { MemberSettings } from "../model/membersettings";
import { band } from "../model/band";

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


  show() {
    band(db, this.bandid)
      .member(this.uid)
      .settings()
      .read()
      .then(
        settings => {
          if (settings != null) {
            this.settings = settings;
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
    .form-field {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
    }
    .form-field label {
      color: var(--app-color-text);
    }
  `;

  render() {
    const classes = { admin: !!this.membership?.admin };
    return html`
      <div id="contents" class=${classMap(classes)}>
        <app-input
          id="display_name"
          label="Namn"
          type="text"
          placeholder="Ditt namn som det syns för andra"
          value=${this.membership?.display_name || ""}
        ></app-input>
        <p>Notifieringar</p>
        <app-input
          id="email"
          label="E-post"
          type="email"
          value=${this.settings.email || ""}
        ></app-input>
        <div id="notify">
          <div class="form-field">
            <label>Nya händelser</label>
            <app-switch
              id="new_event"
              ?selected=${this.settings.notify.new_event}
            ></app-switch>
          </div>
          <div class="form-field admin">
            <label>Ny ansökning om medlemskap</label>
            <app-switch
              id="new_join_request"
              ?selected=${this.settings.notify.new_join_request}
            ></app-switch>
          </div>
          <div class="form-field admin">
            <label>Ny medlem</label>
            <app-switch
              id="new_member"
              ?selected=${this.settings.notify.new_member}
            ></app-switch>
          </div>
        </div>
      </div>
    `;
  }

  // Returns true if valid settings were successfully saved, and false if there was a validation problem.
  async save(): Promise<boolean> {
    const nameField: AppInput = this.shadowRoot.querySelector("#display_name");
    const emailField: AppInput = this.shadowRoot.querySelector("#email");
    // app-input doesn't support reportValidity yet, but we can check value
    if (!nameField.value || !emailField.value) {
      return false;
    }

    if (nameField.value != this.membership?.display_name) {
      console.log("[profile-editor] New display name:", nameField.value);
      await band(db, this.bandid)
        .member(this.uid)
        .update({ display_name: nameField.value }, { merge: true });
    }

    const getSwitch = (id: string) =>
      this.shadowRoot.querySelector("#" + id) as AppSwitch;
    const settings = new MemberSettings(emailField.value, {
      new_event: getSwitch("new_event").selected,
      new_join_request: getSwitch("new_join_request").selected,
      new_member: getSwitch("new_member").selected
    });
    console.log("[profile-editor] New member settings:", settings);
    await band(db, this.bandid)
      .member(this.uid)
      .settings()
      .update(settings);
    return true;
  }
}
