import { LitElement, html, css } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';
import '@material/mwc-fab';
import '@material/mwc-icon';
import '@material/mwc-button';
import '@material/mwc-list/mwc-list';
import '@material/mwc-list/mwc-list-item';
import './band-event.js';
import './band-edit-event.js';

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

class BandSchedule extends LitElement {
  static get properties() {
    return {
      bandref: { type: String }, // "bands/abc"
      events: { type: Array },
      emptymsg: { type: String },
      adding: { type: Boolean },
    }
  }

  constructor() {
    super();
    this.bandref = "";
    this.events = [];
    this.emptymsg = "...";
    this.adding = false;
  }

  attributeChangedCallback(name, oldval, newval) {
    console.log('attribute change: ', name, newval);
    super.attributeChangedCallback(name, oldval, newval);
    if (name == 'bandref') {
      let ref = `${newval}/events`;
      console.log('Fetching ', ref)
      firebase.firestore().collection(ref).orderBy('start').onSnapshot((querySnapshot) => {
        console.log('got snapshot ', querySnapshot.docs.map(e => e.data()));
        this.events = querySnapshot.docs.map((event) => event);
        this.emptymsg = "Inget planerat";
      });
    }
  }

  setBand(bandref) {
  }

  static get styles() {
    return css`
      .date { display: inline-block; width: 2.2em; }
      .type { font-weight: 600; }
      @media (max-width: 600px) {
        div.schedule {
          padding: 16px 16px;
        }
      }
      .toggle {
        font-size: 12px;
        font-weight: 600;
        margin: 0;
        color: #4a7cf1;
      }
      mwc-fab {
        position: fixed;
        bottom: 1rem;
        right: 1rem;
      }
    `;
  }

  render() {
    let formatDate = (ts) => {
      console.log("formatDate", ts)
      if (ts === undefined || ts == null) {
        return undefined;
      }
      return dateFmt.format(ts.toDate());
    }

    let elt = this;
    return html`
      <mwc-list @selected=${event => { console.log("Selected", event.detail); }}>
          ${repeat(this.events, (e) => e.id, 
            (e, index) => html`<mwc-list-item graphic="icon" twoline>
              <mwc-icon slot="graphic">event</mwc-icon>
              <span>
                <span class="date">${formatDate(e.data().start)}</span>
                <span class="type">${e.data().type}</span>
                ${this.renderTime(e.data())}
              </span>
              <span slot="secondary">
                <span class="location">${e.data().location}</span>
                ${e.data().description ? html` · <span class="description">${e.data().description}</span>` : ''} 
             </span>
            </mwc-list-item>`)}
          ${this.events.length ? html`` : html`<p>${this.emptymsg}</p>`}
          ${this.adding ? html`<band-edit-event bandref="${this.bandref}"></band-edit-event>` 
                        : ''}
      </mwc-list>
      <mwc-fab icon="add" @click=${e => this.toggleAdd()}></mwc-fab>      
    `;
  }

  renderTime(event) {
    let start = event.start.toDate();
    let stop = event.stop ? event.stop.toDate() : null;
    return html`${start.getUTCHours() > 0
      ? html`<span class="time">${timeFmt.format(start)}${stop ? html`-${timeFmt.format(stop)}` : ''}</span>`
      : ''}`
  }

  toggleAdd() {
    console.log('Toggle add: %s -> %s', this.adding, !this.adding);
    this.adding = !this.adding;
  }
}

customElements.define('band-schedule', BandSchedule);
