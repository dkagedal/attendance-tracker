import { LitElement, html, css, query } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';
import '@material/mwc-icon';
import '@material/mwc-button';
import '@material/mwc-linear-progress';
import '@material/mwc-list/mwc-list';
import '@material/mwc-list/mwc-list-item';

const dateFmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'UTC',
      month: 'long',
      day: 'numeric',
    });

const dateTimeFmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'UTC',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });

class TimeRange extends LitElement {
  static get properties() {
    return {
      start: { type: String },
      stop: { type: String },
    }
  }

  constructor() {
    super();
    this.start = null;
    this.stop = null;
  }

  static get styles() {
    return css``;
  }

  utcDate(timestring) {
    if (timestring == "undefined") {
      timestring = "2021-01-01";
    }
    let [date, time] = timestring.split("T");
    let parts = date.split('-');
    parts[1] -= 1;  // adjust month number to be zero-based
    if (time) {
      parts.push(...time.split(':'));
    }
    return Date.UTC(...parts);
  }

  render() {
    let range = (start, stop) => {
      let fmt = (start.indexOf("T") > 0) ? dateTimeFmt : dateFmt;
      return fmt.formatRange(this.utcDate(start), this.utcDate(stop));
    }
    let single = (start) => {
      let fmt = (start.indexOf("T") > 0) ? dateTimeFmt : dateFmt;
      return fmt.format(this.utcDate(start));
    }

    return html`
        ${this.start && this.stop ? range(this.start, this.stop)
        : this.start ? single(this.start)
        : ''}`;
  }
}

customElements.define('time-range', TimeRange);
