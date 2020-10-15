import { LitElement, html, css, property, customElement } from 'lit-element';
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

function utcDate(timestring: string): number {
  let [date, time] = timestring.split("T");
  let [year, month, day] = date.split('-').map(s => parseInt(s));
  month -= 1;  // adjust month number to be zero-based
  if (time) {
    return Date.UTC(year, month, day, ...time.split(':').map(s => parseInt(s)))
  } else {
    return Date.UTC(year, month, day);
  }
}

function range(start: string, stop: string): string {
  let fmt = (start.indexOf("T") > 0) ? dateTimeFmt : dateFmt;
  if ("formatRange" in fmt) {
    return (fmt as any).formatRange(utcDate(start), utcDate(stop));
  } else {
    return `${fmt.format(utcDate(start))} – ${fmt.format(utcDate(stop))}`
  }
}

function single(start: string): string {
  const fmt = (start.indexOf("T") > 0) ? dateTimeFmt : dateFmt;
  const milliseconds = utcDate(start);
  return fmt.format(milliseconds);
}

@customElement("time-range")
export class TimeRange extends LitElement {
  @property({ type: String })
  start = "";

  @property({ type: String })
  stop = "";

  static = css``;

  render() {
    return html`
        ${this.start && this.stop ? range(this.start, this.stop)
        : this.start ? single(this.start) : ''}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'time-range': TimeRange;
  }
}