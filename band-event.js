import { LitElement, html, css } from 'lit-element';

class BandEvent extends LitElement {

  static get properties() {
    let timestamp = { 
        type: Object,  
        converter: (value, type) => {
          return Date.parse(value);
        }
    };

    return {
      dbid: { type: String },
      type: { type: String },
      location: { type: String },
      start: timestamp,
      stop: timestamp,
    }
  }

  constructor() {
    super();
    this.dbdoc = {}
    this.type = ""
    this.location = ""
  }

  fmtTimeRange(start, stop) {
    if (start === undefined) {
      return html`???`
    }
    let datefmt = new Intl.DateTimeFormat('default', {
      weekday: 'long',
      timeZone: 'Europe/Stockholm',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    let timefmt = new Intl.DateTimeFormat('default', {
      hour12: false,
      timeZone: 'Europe/Stockholm',
      hour: 'numeric',
      minute: 'numeric',
    });
    let startDate = datefmt.format(start)
    if (stop === undefined) {
      return html`${startDate} ${timefmt.format(start)}`
    }
    let stopDate = datefmt.format(stop)
    if (startDate == stopDate) {
      return html`${startDate} ${timefmt.format(start)}
          - ${timefmt.format(stop)}`;
    }
    return html`${startDate} - ${stopDate}`;
  }

  static get styles() {
    return css`
      li {
        border: 1px solid gray;
        margin: 10px;
      }
      p { margin: 0 }
      .location { font-weight: bold }
      p.time { color: #888888 }
    `;
  }

  render(){
    return html`<li>
      <p class='summary'>
        <span class='type'>${this.type}</span>
        <span class='location'>${this.location}</span>
      </p>
      <p class='time'>${this.fmtTimeRange(this.start, this.stop)}</p>
      </li>`;
  }

  attributeChangedCallback(name, oldval, newval) {
    console.log('attribute change: ', name, newval);
    super.attributeChangedCallback(name, oldval, newval);
  }
}

customElements.define('band-event', BandEvent);
