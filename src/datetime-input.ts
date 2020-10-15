import { LitElement, html, customElement, property, query, css } from 'lit-element';
import { ifDefined } from 'lit-html/directives/if-defined';
import '@material/mwc-textfield';
import './time-range.js';
import type { TextField } from '@material/mwc-textfield';

@customElement("datetime-input")
export class DatetimeInput extends LitElement {

  @property({ type: String })
  initial_value: string; // "2020-02-29T19:50" or "2020-02-29"

  @property({ type: Boolean })
  required = false;

  @query('#date')
  date: TextField;

  @query('#time')
  time: TextField;

  get value() {
    const date = this.date.value;
    const time = this.time.value;
    if (date) {
      if (time) {
        return `${date}T${time}`;
      } else {
        return date;
      }
    } else {
      return undefined;
    }
  }

  set value(value) {
    let [dateval, timeval] = value.split("T");
    this.date.value = dateval;
    if (timeval != undefined) {
      this.time.value = timeval;
    }
  }

  static styles = css`
    :host {
      display: inline-flex;
    }
    mwc-textfield[type=date] {
      margin-right: -2rem;
    }
  `;

  render() {
    const date = this.initial_value ? this.initial_value.split('T')[0] : undefined;
    const time = this.initial_value ? this.initial_value.split('T')[1] : undefined;
    return html`
      <mwc-textfield ?required=${this.required} label="Datum" id="date" type="date"
        value=${ifDefined(date)}></mwc-textfield>
      <mwc-textfield label="Tid" id="time" type="time"
        value=${ifDefined(time)}></mwc-textfield>`;
  }

  checkValidity(): boolean {
    return this.date.checkValidity() && this.time.checkValidity();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'datetime-input': DatetimeInput;
  }
}