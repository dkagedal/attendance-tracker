import "./app-input";
import { AppInput } from "./app-input";
import { css, html, LitElement } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
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
    clone: () => ({} as any),
  };

  @state()
  private _date: string = "";

  @state()
  private _startTime: string = "";

  @state()
  private _stopTime: string = "";

  @query("#type")
  typeInput: AppInput;

  @query("#location")
  locationInput: AppInput;

  @query("#desc")
  descriptionInput: AppInput;

  @query("#date")
  dateInput: AppInput;

  @query("#start-time")
  startTimeInput: AppInput;

  @query("#stop-time")
  stopTimeInput: AppInput;

  willUpdate(changedProperties: Map<string, any>) {
    if (changedProperties.has("data")) {
      const [datePart, startTimePart] = (this.data?.start || "").split("T");
      this._date = datePart || "";
      this._startTime = startTimePart || "";
      const [, stopTimePart] = (this.data?.stop || "").split("T");
      this._stopTime = this._startTime ? stopTimePart || "" : "";
    }
  }

  static styles = css`
    :host {
      display: block;
    }

    app-input {
      width: 100%;
    }

    .time-row {
      display: flex;
      gap: var(--app-spacing-sm);
    }

    .time-row app-input {
      flex: 1;
      min-width: 0;
      margin-bottom: 0;
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
        .value="${this.data.type}"
        @input=${(e: CustomEvent) => {
          this.data.type = (e.target as AppInput).value;
        }}
      ></app-input>
      <app-input
        label="Plats"
        id="location"
        type="text"
        ?disabled=${isCancelled}
        .value="${this.data.location || ""}"
        @input=${(e: CustomEvent) => {
          this.data.location = (e.target as AppInput).value;
        }}
      ></app-input>
      <app-input
        label="Beskrivning"
        id="desc"
        multiline
        ?disabled=${isCancelled}
        .value="${this.data.description || ""}"
        @input=${(e: CustomEvent) => {
          this.data.description = (e.target as AppInput).value;
        }}
      ></app-input>
      <app-input
        label="Datum"
        id="date"
        type="date"
        required
        ?disabled=${isCancelled}
        .value=${this._date}
        @input=${(e: CustomEvent) => {
          this._date = (e.target as AppInput).value;
        }}
      ></app-input>
      <div class="time-row">
        <app-input
          label="Starttid"
          id="start-time"
          type="time"
          ?disabled=${isCancelled}
          .value=${this._startTime}
          @input=${(e: CustomEvent) => {
            this._startTime = (e.target as AppInput).value;
            if (!this._startTime) {
              this._stopTime = "";
            }
          }}
        ></app-input>
        <app-input
          label="Sluttid"
          id="stop-time"
          type="time"
          ?disabled=${isCancelled || !this._startTime}
          .value=${this._stopTime}
          @input=${(e: CustomEvent) => {
            this._stopTime = (e.target as AppInput).value;
          }}
        ></app-input>
      </div>
    `;
  }

  async save() {
    console.log("Saving event", this.data);
    if (!this.checkValidity()) {
      throw new Error("Invalid data");
    }

    this.data.type = this.typeInput.value;
    this.data.location = this.locationInput.value;
    this.data.description = this.descriptionInput.value;

    delete this.data.start;
    delete this.data.stop;
    if (this._date) {
      this.data.start = this._startTime
        ? `${this._date}T${this._startTime}`
        : this._date;
      if (
        this._startTime &&
        this._stopTime &&
        this._stopTime !== this._startTime
      ) {
        this.data.stop = `${this._date}T${this._stopTime}`;
      }
    }
    // Cancellation state is already updated on this.data via click handlers,
    // but we ensure it persists through the save call if we ever re-assign.
    this.data.cancelled = !!this.data.cancelled;

    const ref = this.data.ref;
    await ref.update(this.data);
    console.log("Update successful");
  }

  checkValidity(): boolean {
    if (this.data.cancelled) {
      return true;
    }
    const typeValid = this.typeInput.checkValidity();
    const dateValid = this.dateInput.checkValidity() && !!this._date;
    if (!typeValid || !dateValid) {
      return false;
    }
    if (this._stopTime) {
      if (!this._startTime || this._stopTime < this._startTime) {
        console.log("Stop time is before start time");
        return false;
      }
    }
    return true;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "event-editor": EventEditor;
  }
}
