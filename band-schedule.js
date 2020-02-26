import { LitElement, html, css, query } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';
import '@material/mwc-icon';
import '@material/mwc-button';
import '@material/mwc-linear-progress';
import '@material/mwc-list/mwc-list';
import '@material/mwc-list/mwc-list-item';
import './band-event.js';
import './band-edit-event.js';
import './time-range.js';

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
      loaded: { type: Boolean },
      adding: { type: Boolean },
    }
  }

  constructor() {
    super();
    this.bandref = "";
    this.events = [];
    this.loaded = false;
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
        this.loaded = true;
      });
    }
  }
  
  setBand(bandref) {
  }

  static get styles() {
    return css`
      .type { font-weight: 600; }
      time-range { color: rgba(0,0,0,0.7); }
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
    `;
  }

  render() {
    let elt = this;
    return html`
      <mwc-linear-progress indeterminate ?closed=${this.loaded}></mwc-linear-progress>
      <mwc-list @selected=${event => { this.selected(event) }}>
          ${repeat(this.events, (e) => e.id, 
            (e, index) => html`<mwc-list-item graphic="icon" twoline>
              <mwc-icon slot="graphic">event</mwc-icon>
              <span>
                <span class="type">${e.data().type}</span>
                <time-range start=${ifDefined(e.data().start)}
                            stop=${ifDefined(e.data().stop)}></time-range>
              </span>
              <span slot="secondary">
                <span class="location">${e.data().location}</span>
                ${e.data().description ? html` · <span class="description">${e.data().description}</span>` : ''} 
             </span>
            </mwc-list-item>`)}
          ${this.loade && this.events.length == 0 ? html`<mwc-list-item noninteractive>Inget planerat</mwc-list-item>` : ''}
          ${this.adding ? html`<band-edit-event bandref="${this.bandref}"></band-edit-event>` 
                        : ''}
      </mwc-list>
    `;
  }

  renderTime(event) {
    return html`${event.starttime
      ? html`<span class="time">${event.starttime}${event.stoptime ? html`-${event.stoptime}` : ''}</span>`
      : ''}`
  }

  toggleAdd() {
    console.log('Toggle add: %s -> %s', this.adding, !this.adding);
    this.adding = !this.adding;
  }

  selected(listEvent) {
    console.log("Selected", listEvent);
    let event = new CustomEvent("select-event", {
      detail: {
        index: listEvent.detail.index, 
        item: listEvent.target.children[listEvent.detail.index],
        eventref: this.bandref + "/events/" + this.events[listEvent.detail.index].id,
      }
    });
    this.dispatchEvent(event);
  }
}

customElements.define('band-schedule', BandSchedule);
