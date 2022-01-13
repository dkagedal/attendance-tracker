import "@material/mwc-linear-progress/mwc-linear-progress";
import "@material/mwc-icon";
import "@material/mwc-button";
import "@material/mwc-linear-progress";
import "@material/mwc-list/mwc-list";
import "@material/mwc-list/mwc-list-item";
import "./time-range";
import "./event-card";
import "./mini-roster";
import { BandEvent, bandEventYear, db } from "./storage";
import {
  collection,
  doc,
  DocumentSnapshot,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where
} from "firebase/firestore";
import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators";
import { repeat } from "lit/directives/repeat";
import { Member } from "./datamodel";

interface EventsSnapshot {
  docs: DocumentSnapshot<BandEvent>[];
  size: number;
}

@customElement("band-schedule")
export class BandSchedule extends LitElement {
  @property({ type: String })
  uid: string = "";

  @property({ type: String })
  bandid: string | null = null;

  @property({ type: Object, attribute: false })
  events: EventsSnapshot = { docs: [], size: 0 };

  @state()
  loaded = false;

  @property({ type: Object })
  selected_event = null;

  @property({ type: Boolean })
  event_expanded = false;

  @property({ type: Array, attribute: false })
  members: Member[] = [];

  updated(changedProperties: any) {
    console.log("[schedule] Updated", changedProperties);
    if (changedProperties.has("bandid")) {
      if (this.bandid == null) {
        this.events = { docs: [], size: 0 };
        this.selected_event = null;
        this.members = [];
        return;
      }

      const now = Timestamp.now();
      const nowMinus24h = new Timestamp(now.seconds - 86400, 0).toDate();
      const yesterday = nowMinus24h.toISOString().split("T")[0];
      console.log("[schedule] Getting band events and members...", yesterday);
      const bandref = doc(db, "bands", this.bandid);
      const eventQuery = query(
        collection(bandref, "events"),
        where("start", ">=", yesterday),
        orderBy("start")
      );
      onSnapshot(eventQuery, (querySnapshot): void => {
        this.events = (querySnapshot as unknown) as EventsSnapshot;
        this.loaded = true;
        this.dispatchEvent(new CustomEvent("loaded"));
      });
      const memberQuery = query(collection(bandref, "members")).withConverter(
        Member.converter
      );
      onSnapshot(memberQuery, (querySnapshot): void => {
        this.members = querySnapshot.docs.map(s => s.data());
        this.members.sort((m1, m2) => {
          if (m1.uid < m2.uid) {
            return -1;
          }
          if (m1.uid > m2.uid) {
            return 1;
          }
          return 0;
        });
        console.log("SCHEDULE MEMBERS", querySnapshot, this.members);
      });
    }
  }

  static get styles() {
    return css`
      .list {
        display: flex;
        flex-direction: column;
      }
      .type {
        font-weight: 600;
      }
      time-range {
        color: rgba(0, 0, 0, 0.7);
      }
      @media (max-width: 600px) {
        div.schedule {
          padding: 16px 16px;
        }
      }
      event-card {
        border-top: 1px solid rgba(0, 0, 0, 0.3);
      }
      event-card:first-of-type {
        border-top: none;
      }
    `;
  }

  render() {
    const years = [] as any[];
    let currentYear = { year: "", events: [] };
    this.events.docs.forEach(e => {
      const year = bandEventYear(e.data());
      if (year != currentYear.year) {
        currentYear = { year: year, events: [] };
        years.push(year);
      }
      currentYear.events.push(e.data());
    });
    return html`
      <div class="list">
        ${repeat(
          this.events.docs,
          e => e.id,
          (e: DocumentSnapshot<BandEvent>) => html`
            <event-card
              selfuid=${this.uid}
              .members=${this.members}
              .event=${e}
            ></event-card>
          `
        )}
        ${this.loaded
          ? ""
          : html`
              <div>
                Inget planerat
              </div>
            `}
      </div>
    `;
  }

  selected(selectEvent: any, gig: Event) {
    // console.log("band-schedule selected", selectEvent.target);
    // this.selected_event = gig.id

    let listItem = selectEvent.target;
    let event = new CustomEvent("select-event", {
      detail: {
        item: listItem,
        gig: gig
      }
    });
    this.dispatchEvent(event);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "band-schedule": BandSchedule;
  }
}
