import "./app-input";
import "./app-button";
import { AppInput } from "./app-input";
import { css, html, LitElement } from "lit";
import { ifDefined } from "lit/directives/if-defined.js";
import "./datetime-input";
import { DatetimeInput } from "./datetime-input";
import { customElement, property, query } from "lit/decorators.js";
import { BandEvent } from "../model/bandevent";

@customElement("event-editor")
export class EventEditor extends LitElement {
  @property({ type: Object, attribute: false })
  data: BandEvent = {
    ref: null,
    type: "",
    start: "",
    year: () => "",
    hasStopTime: () => false,
    clone: () => ({} as any)
  };

  @property({ type: Boolean, reflect: true })
  range: boolean = false;

  @property({ type: Boolean })
  editing: boolean = false;

  @query("#type")
  typeInput: AppInput;

  @query("#location")
  locationInput: AppInput;

  @query("#desc")
  descriptionInput: AppInput;

  @query("#start")
  startInput: DatetimeInput;

  @query("#stop")
  stopInput: DatetimeInput;

  static styles = css`
    app-input {
      width: 100%;
    }

    :host(:not([range])) .ranged {
      display: none;
    }

    :host([range]) .notranged {
      display: none;
    }

    .cancel-section {
      margin-top: var(--app-spacing-md);
      padding-top: var(--app-spacing-md);
      border-top: 1px solid var(--app-color-border);
      display: flex;
      justify-content: center;
    }
  `;

  render() {
    const isCancelled = !!this.data.cancelled;

    return html`
      <app-input
        label="Typ"
        id="type"
        type="text"
        required
        ?disabled=${isCancelled}
        value="${this.data.type}"
        @input=${(e: CustomEvent) => { this.data.type = (e.target as AppInput).value; }}
      ></app-input>
      <app-input
        label="Plats"
        id="location"
        type="text"
        ?disabled=${isCancelled}
        value="${ifDefined(this.data.location)}"
        @input=${(e: CustomEvent) => { this.data.location = (e.target as AppInput).value; }}
      ></app-input>
      <app-input
        label="Beskrivning"
        id="desc"
        type="text"
        ?disabled=${isCancelled}
        value="${ifDefined(this.data.description)}"
        @input=${(e: CustomEvent) => { this.data.description = (e.target as AppInput).value; }}
      ></app-input>
      <datetime-input
        id="start"
        required
        ?disabled=${isCancelled}
        initial_value="${ifDefined(this.data.start)}"
      ></datetime-input>
      <span class="ranged">-</span>
      <datetime-input
        id="stop"
        class="ranged"
        ?disabled=${isCancelled}
        initial_value="${ifDefined(this.data.stop)}"
      ></datetime-input>
      <app-button
        variant="icon"
        icon="delete"
        class="ranged"
        ?disabled=${isCancelled}
        @click=${() => {
        this.range = false;
      }}
      ></app-button>
      <app-button variant="secondary" icon="add" class="notranged" ?disabled=${isCancelled} @click=${this.addStop}
        >Lägg till sluttid</app-button
      >

      ${this.editing ? html`
        <div class="cancel-section">
          ${isCancelled ? html`
            <app-button variant="secondary" icon="history" @click=${() => { this.data.cancelled = false; this.requestUpdate(); }}>
              Återställ händelse
            </app-button>
          ` : html`
            <app-button variant="secondary" icon="cancel" @click=${() => { this.data.cancelled = true; this.requestUpdate(); }}>
              Ställ in händelse
            </app-button>
          `}
        </div>
      ` : ""}
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
        if (stop && start != stop && start.indexOf("T") == stop.indexOf("T")) {
          this.data.stop = stop;
        }
      }
    }
    // Cancellation state is already updated on this.data via click handlers,
    // but we ensure it persists through the save call if we ever re-assign.
    this.data.cancelled = !!this.data.cancelled;
  }

  checkValidity(): boolean {
    if (this.data.cancelled) {
      return true;
    }
    if (!this.startInput.checkValidity()) {
      return false;
    }
    if (this.range) {
      // Check that stop is after start.
      if (
        !this.stopInput.checkValidity() ||
        this.stopInput.value < this.startInput.value
      ) {
        console.log("Stop time is before start time");
        return false;
      }
    }
    const startValid = this.startInput.checkValidity();
    const typeValid = this.typeInput.checkValidity();
    return startValid && typeValid;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "event-editor": EventEditor;
  }
}
