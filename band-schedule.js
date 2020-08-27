import { LitElement, html, css, query } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';
import '@material/mwc-icon';
import '@material/mwc-button';
import '@material/mwc-linear-progress';
import '@material/mwc-list/mwc-list';
import '@material/mwc-list/mwc-list-item';
import './time-range.js';
import './event-card.js'

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
      path: { type: String }, // "bands/abc"
      events: { type: Array },
      loaded: { type: Boolean },
      selected_event: { type: Object },
      event_expanded: { type: Boolean },
    }
  }

  constructor() {
    super();
    this.path = "";
    this.events = [];
    this.loaded = false;
    this.selected_event = null;
    this.event_expanded = false;
  }

  attributeChangedCallback(name, oldval, newval) {
    console.log('attribute change: ', name, newval);
    super.attributeChangedCallback(name, oldval, newval);
    if (name == 'path') {
      let ref = `${newval}/events`;
      console.log('Fetching ', ref)
      firebase.firestore().collection(ref).orderBy('start').onSnapshot((querySnapshot) => {
        console.log('got snapshot ', querySnapshot.docs);
        this.events = querySnapshot.docs.map((event) => event);
        this.loaded = true;
      });
    }
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
      event-card {
        z-index: 4;
        overflow: hidden;
        transition:
          opacity 0.2s cubic-bezier(0.4, 0.0, 0.2, 1) 0.3s,
          background 0.5s cubic-bezier(0.4, 0.0, 0.2, 1),
          top 0.3s cubic-bezier(0.4, 0.0, 0.2, 1),
          height 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
      }
      event-card.expanded {
        position: fixed;
        top: 5vh;
        left: 30px;
        height: 90vh;
        width: 500px;
      }
      event-card.small {
        position: absolute;
        opacity: 0%;
        top: 0;
        left: 0;
        height: 72px;
        width: 100%;
      }
    `;
  }

  render() {
    let elt = this;
    return html`
      <mwc-linear-progress indeterminate ?closed=${this.loaded}></mwc-linear-progress>
      <mwc-list>
          ${repeat(this.events, (e) => e.id, 
            (e, index) => html`<mwc-list-item graphic="icon" twoline @request-selected=${ev => this.selected(ev, e)}>
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
            </mwc-list-item>
            `)}
            ${this.loaded && this.events.length == 0 ? html`<mwc-list-item noninteractive>Inget planerat</mwc-list-item>` : ''}
      </mwc-list>
    `;
  }

  renderTime(event) {
    return html`${event.starttime
      ? html`<span class="time">${event.starttime}${event.stoptime ? html`-${event.stoptime}` : ''}</span>`
      : ''}`
  }

  selected(selectEvent, gig) {
    // console.log("band-schedule selected", gig.ref.path);
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
