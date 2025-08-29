import "@material/mwc-textfield/mwc-textfield";
import "@material/mwc-dialog";
import "@material/mwc-icon";
import "@material/mwc-icon-button";
import "@material/mwc-menu";
import "@material/mwc-formfield";
import "@material/mwc-radio";
import "./time-range";
import "./mini-roster";
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators";
import { ifDefined } from "lit/directives/if-defined";
import { hasResponded, UID } from "./datamodel";
import { TextField } from "@material/mwc-textfield/mwc-textfield";
import { ParticipantResponse } from "./model/participant";

@customElement("response-selector")
export class ResponseSelector extends LitElement {
  @property({ type: String })
  uid: UID = "";

  @property({ type: String })
  response: ParticipantResponse = null;

  @property({ type: String })
  comment: string = undefined;

  @property({ type: Boolean })
  menu: boolean = false;

  static styles = css`
    :host(:not([menu])) {
      display: flex;
      flex-direction: column;
    }
  `;

  render() {
    if (this.menu) {
      return html`
        <mwc-list-item graphic="icon" ?selected=${this.response == "yes"}>
          <mwc-icon slot="graphic">check</mwc-icon>
          <span>Kommer</span>
        </mwc-list-item>
        <mwc-list-item graphic="icon" ?selected=${this.response == "no"}>
          <mwc-icon slot="graphic">check</mwc-icon>
          <span>Kommer inte</span>
        </mwc-list-item>
        <mwc-list-item graphic="icon" ?selected=${this.response == "sub"}>
          <mwc-icon slot="graphic">check</mwc-icon>
          <span>Skickar ersättare</span>
        </mwc-list-item>
        <mwc-list-item graphic="icon" ?selected=${this.response == null}>
          <mwc-icon slot="graphic">check</mwc-icon>
          <span>Inget svar</span>
        </mwc-list-item>
      `;
    }
    return html`
      <mwc-formfield label="Jag kommer">
        <mwc-radio
          id="yes"
          name="response"
          ?checked=${this.response == "yes"}
        ></mwc-radio>
      </mwc-formfield>
      <mwc-formfield label="Jag kommer inte">
        <mwc-radio
          id="no"
          name="response"
          ?checked=${this.response == "no"}
        ></mwc-radio>
      </mwc-formfield>
      <mwc-formfield label="Jag skickar ersättare">
        <mwc-radio
          id="sub"
          name="response"
          ?checked=${this.response == "sub"}
        ></mwc-radio>
      </mwc-formfield>
      <mwc-formfield label="Inget svar">
        <mwc-radio
          id="na"
          name="response"
          ?checked=${!hasResponded(this.response)}
        ></mwc-radio>
      </mwc-formfield>
      <mwc-textfield
        id="comment"
        label="Kommentar"
        value=${ifDefined(this.comment)}
      ></mwc-textfield>
    `;
  }

  getResponse(): ParticipantResponse {
    return this.shadowRoot.querySelector("mwc-radio[checked]")
      .id as ParticipantResponse;
  }

  getComment() {
    const commentField = this.shadowRoot.querySelector(
      "#comment"
    )! as TextField;
    return commentField.value || null;
  }
}
