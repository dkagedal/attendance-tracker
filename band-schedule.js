import { LitElement, html, css, query } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';
import '@material/mwc-icon';
import '@material/mwc-button';
import '@material/mwc-linear-progress';
import '@material/mwc-list/mwc-list';
import '@material/mwc-list/mwc-list-item';
import './time-range.js';
import './event-card.js';
import './mini-roster.js';

const dateFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  month: 'numeric',
  day: 'numeric',
});

const timeFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  hour: 'numeric',
  minute: 'numeric',
});

var db = firebase.firestore();
if (location.hostname === "localhost") {
  db.settings({
    host: "localhost:8080",
    ssl: false
  });
}

class BandSchedule extends LitElement {
  static get properties() {
    return {
      path: { type: String }, // "bands/abc"
      events: { type: Object }, // QuerySnapshot
      loaded: { type: Boolean },
      selected_event: { type: Object },
      event_expanded: { type: Boolean },
      members: { type: Array },
    }
  }

  constructor() {
    super();
    this.path = "";
    this.events = null;
    this.loaded = false;
    this.selected_event = null;
    this.event_expanded = false;
    this.members = [];
  }

  attributeChangedCallback(name, oldval, newval) {
    console.log('attribute change: ', name, newval);
    super.attributeChangedCallback(name, oldval, newval);
    if (name == 'path') {
      db.collection(`${newval}/events`).orderBy('start').onSnapshot((querySnapshot) => {
        this.events = querySnapshot;
        this.loaded = true;
      });
      db.collection(`${newval}/members`).onSnapshot((querySnapshot) => {
        this.members = querySnapshot.docs.sort((m1, m2) => {
          if (m1.id < m2.id) {
            return -1;
          }
          if (m1.id > m2.id) {
            return 1;
          }
          return 0;
        });
      });
    }
  }

  static get styles() {
    return css`
      .list {
        display: flex;
        flex-direction: column;
      }
      .type { font-weight: 600; }
      time-range { color: rgba(0,0,0,0.7); }
      @media (max-width: 600px) {
        div.schedule {
          padding: 16px 16px;
        }
      }
      mini-roster {
        margin-left: 72px;
        margin-right: 16px;
      }
    `;
  }

  render() {
    let elt = this;
    return html`
      <mwc-linear-progress indeterminate ?closed=${this.loaded}></mwc-linear-progress>
      <div class="list">
        ${repeat(this.events ? this.events.docs : [], (e) => e.id, (e, index) => html`
          <event-card .members=${this.members} .event=${e}></event-card>
          `)}
          <div style="display: ${this.loaded && this.events.size == 0 ? "block" : "none"}">Inget planerat</div>
      </div>
    `;
  }

  renderTime(event) {
    return html`${event.starttime
      ? html`<span class="time">${event.starttime}${event.stoptime ? html`-${event.stoptime}` : ''}</span>`
      : ''}`
  }

  selected(selectEvent, gig) {
    // console.log("band-schedule selected", selectEvent.target);
    // this.selected_event = gig.id

    let listItem = selectEvent.target;
    let event = new CustomEvent("select-event", {
      detail: {
        item: listItem,
        gig: gig,
      }
    });
    this.dispatchEvent(event);
  }
}

customElements.define('band-schedule', BandSchedule);
