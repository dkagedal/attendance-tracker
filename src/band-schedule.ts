import { LitElement, html, css, property, customElement } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat';
import '@material/mwc-icon';
import '@material/mwc-button';
import '@material/mwc-linear-progress';
import '@material/mwc-list/mwc-list';
import '@material/mwc-list/mwc-list-item';
import './time-range';
import './event-card';
import './mini-roster';

interface EventsSnapshot {
  docs: firebase.firestore.DocumentSnapshot[],
  size: number,
}

interface Event {
  starttime: string,
  stoptime: string,
}

@customElement("band-schedule")
export class BandSchedule extends LitElement {
  @property({ type: Object, attribute: false })
  band: firebase.firestore.DocumentSnapshot | null = null

  @property({ type: Object, attribute: false })
  events: EventsSnapshot = { docs: [], size: 0 }

  @property({ type: Boolean })
  loaded = false

  @property({ type: Object })
  selected_event = null

  @property({ type: Boolean })
  event_expanded = false

  @property({ type: Array, attribute: false })
  members: firebase.firestore.QueryDocumentSnapshot<firebase.firestore.DocumentData>[] = []

  updated(changedProperties: any) {
    changedProperties.forEach((_oldValue: any, propName: string) => {
      if (propName == 'band' && this.band != null) {
        console.log('Getting band events and members...');
        this.band.ref.collection('events').orderBy('start').onSnapshot((querySnapshot) => {
          this.events = querySnapshot;
          this.loaded = true;
        });
        this.band!.ref.collection('members').onSnapshot((querySnapshot) => {
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
    })
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
    return html`
      <mwc-linear-progress indeterminate ?closed=${this.loaded}></mwc-linear-progress>
      <div class="list">
        ${repeat(this.events.docs, (e) => e.id, (e: firebase.firestore.DocumentSnapshot) => html`
          <event-card .members=${this.members} .event=${e}></event-card>
          `)}
          <div style="display: ${this.loaded && this.events.size == 0 ? "block" : "none"}">Inget planerat</div>
      </div>
    `;
  }

  renderTime(event: Event) {
    return html`${event.starttime
      ? html`<span class="time">${event.starttime}${event.stoptime ? html`-${event.stoptime}` : ''}</span>`
      : ''}`
  }

  selected(selectEvent: any, gig: Event) {
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

declare global {
  interface HTMLElementTagNameMap {
    'band-schedule': BandSchedule;
  }
}