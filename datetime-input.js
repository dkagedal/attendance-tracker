import { LitElement, html, css } from 'lit-element';
import { classMap } from 'lit-html/directives/class-map';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';
import '@material/mwc-textfield';
import './time-range.js';

class DatetimeInput extends LitElement {

  static get properties() {
    return {
      initial_value: { type: String }, // "2020-02-29T19:50" or "2020-02-29"
    }
  }

  get value() {
    let date = this.shadowRoot.getElementById('date').value;
    let time = this.shadowRoot.getElementById('time').value;
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
    let date = this.shadowRoot.getElementById('date');
    let time = this.shadowRoot.getElementById('time');
    let [dateval, timeval] = value.split("T");
    date.value = dateval;
    if (timeval != undefined) {
      time.value = timeval;
    }
  }

  constructor() {
    super();
    this.initial_value = "";
  }

  render() {
    let date = this.initial_value ? this.initial_value.split('T')[0] : undefined;
    let time = this.initial_value ? this.initial_value.split('T')[1] : undefined;
    return html`
      <mwc-textfield label="Datum" id="date" type="date"
        value="${ifDefined(date)}"></mwc-textfield>
      <mwc-textfield label="Tid" id="time" type="time"
        value="${ifDefined(time)}"></mwc-textfield>`;
  }
}

customElements.define('datetime-input', DatetimeInput);
