import "./components/app-input";
import { AppInput } from "./components/app-input";
import { LitElement, html, css } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import "./time-range.js";

@customElement("datetime-input")
export class DatetimeInput extends LitElement {
  @property({ type: String })
  initial_value: string; // "2020-02-29T19:50" or "2020-02-29"

  @state()
  private _date: string = "";

  @state()
  private _time: string = "";

  @property({ type: Boolean })
  required = false;

  @query("#date")
  date: AppInput;

  @query("#time")
  time: AppInput;

  willUpdate(changedProperties: Map<string, any>) {
    if (changedProperties.has("initial_value") && this.initial_value) {
      const [d, t] = this.initial_value.split("T");
      this._date = d || "";
      this._time = t || "";
    }
  }

  get value() {
    if (this._date) {
      if (this._time) {
        return `${this._date}T${this._time}`;
      } else {
        return this._date;
      }
    } else {
      return undefined;
    }
  }

  set value(value) {
    if (!value) {
      this._date = "";
      this._time = "";
      return;
    }
    let [dateval, timeval] = value.split("T");
    this._date = dateval || "";
    this._time = timeval || "";
  }

  static styles = css`
    :host {
      display: inline-flex;
      gap: var(--app-spacing-sm);
    }
    app-input {
      margin-bottom: 0;
    }
  `;

  render() {
    return html`
      <app-input
        label="Datum"
        id="date"
        type="date"
        .value=${this._date}
        @input=${(e: CustomEvent) => { this._date = (e.target as AppInput).value; }}
      ></app-input>
      <app-input
        label="Tid"
        id="time"
        type="time"
        .value=${this._time}
        @input=${(e: CustomEvent) => { this._time = (e.target as AppInput).value; }}
      ></app-input>
    `;
  }

  checkValidity(): boolean {
    if (this.required && !this._date) {
      return false;
    }
    return true;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "datetime-input": DatetimeInput;
  }
}
