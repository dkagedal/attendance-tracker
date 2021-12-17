import { css, customElement, html, LitElement, property, query } from "lit-element";
import { ifDefined } from 'lit-html/directives/if-defined';
import '@material/mwc-textfield';
import "@material/mwc-icon-button";
import "@material/mwc-button";
import { BandEvent } from "./storage";
import "./datetime-input";
import { DatetimeInput } from "./datetime-input";
import { TextField } from "@material/mwc-textfield";

@customElement("event-editor")
export class EventEditor extends LitElement {
  @property({ type: Object, attribute: false })
  data: BandEvent = { type: "", start: "" };

  @property({ type: Boolean, reflect: true })
  range: boolean = false;

  @query('#type')
  typeInput: TextField;

  @query('#location')
  locationInput: TextField;

  @query('#desc')
  descriptionInput: TextField;

  @query('#start')
  startInput: DatetimeInput;

  @query('#stop')
  stopInput: DatetimeInput;

  static styles = css`
    mwc-textfield {
      width: 100%;
      margin-bottom: 12px;
    }

    :host(:not([range])) .ranged {
      display: none;
    }

    :host([range]) .notranged {
      display: none;
    }
`;

  render() {
    return html`
          <mwc-textfield label="Typ" id="type" type="text" required
            value="${this.data.type}"></mwc-textfield>
          <mwc-textfield label="Plats" id="location" type="text"
            value="${ifDefined(this.data.location)}"></mwc-textfield>
          <mwc-textfield label="Beskrivning" id="desc" type="text"
            value="${ifDefined(this.data.description)}"></mwc-textfield>
          <datetime-input id="start" required initial_value="${ifDefined(this.data.start)}"></datetime-input>
          <span class="ranged">-</span>
          <datetime-input id="stop" class="ranged" initial_value="${ifDefined(this.data.stop)}"></datetime-input>
          <mwc-icon-button icon="delete" class="ranged" @click=${() => { this.range = false }}></mwc-icon-button>
          <mwc-button icon="add" class="notranged" @click=${this.addStop}>Lägg till sluttid</mwc-button>
          `;
  }

  addStop() {
    this.range = true;
    if (!this.stopInput.value) {
      // Just the date. TODO: set time to +1 hour
      this.stopInput.value = this.startInput.value.split("T")[0];
    }
  }

  save() {
    this.data.type = this.typeInput.value;
    this.data.location = this.locationInput.value;
    this.data.description = this.descriptionInput.value;

    delete this.data.start;
    delete this.data.stop;
    const start = this.startInput.value;
    if (start) {
      this.data.start = start;
      // Don't even look at stopInput when range is false.
      if (this.range) {
        const stop = this.stopInput.value;
        if (stop &&
          start != stop &&
          start.indexOf("T") == stop.indexOf("T")) {
          this.data.stop = stop;
        }
      }
    }
  }

  checkValidity(): boolean {
    if (!this.startInput.checkValidity()) {
      return false;
    }
    if (this.range) {
      // Check that stop is after start.
      if (!this.stopInput.checkValidity() || this.stopInput.value < this.startInput.value) {
        console.log('Stop time is before start time');
        return false;
      }
    }
    return this.typeInput.checkValidity() && this.locationInput.checkValidity() && this.descriptionInput.checkValidity();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'event-editor': EventEditor;
  }
}