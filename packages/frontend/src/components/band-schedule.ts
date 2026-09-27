import {
  onSnapshot,
  orderBy,
  query as firestoreQuery,
  Timestamp,
  where,
} from "firebase/firestore";
import { css, html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat";
import { UID } from "../datamodel";
import { db } from "../storage";
import { BandEvent } from "../model/bandevent";
import { band, Band } from "../model/band";
import { Member } from "../model/member";
import "./event-card";

@customElement("band-schedule")
export class BandSchedule extends LitElement {
  @property({ type: String })
  uid: UID = "";

  @property({ type: String })
  bandid: string | null = null;

  @property({ type: Array, attribute: false })
  events: BandEvent[] = [];

  @state()
  loaded = false;

  @property({ type: String, attribute: "selected" })
  selected_event_id: string | null = null;

  @state()
  selected_event: BandEvent | null = null;

  @property({ type: Array, attribute: false })
  members: Member[] = [];

  @state()
  bandData: Band | null = null;

  private _unsubscribeGigs: () => void = () => {};
  private _unsubscribeMembers: () => void = () => {};
  private _unsubscribeBand: () => void = () => {};

  updated(changedProperties: any) {
    if (changedProperties.has("bandid")) {
      this.fetchGigs();
      this.fetchMembers();
      this.fetchBandData();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribeGigs();
    this._unsubscribeMembers();
    this._unsubscribeBand();
  }

  fetchGigs() {
    this._unsubscribeGigs();
    if (!this.bandid) {
      this.events = [];
      this.loaded = false;
      return;
    }

    const now = Timestamp.now();
    const nowMinus24h = new Timestamp(now.seconds - 86400, 0).toDate();
    const yesterday = nowMinus24h.toISOString().split("T")[0];

    const bandRef = band(db, this.bandid);
    const q = firestoreQuery(
      bandRef.events().dbref,
      where("start", ">=", yesterday),
      orderBy("start")
    );

    this._unsubscribeGigs = onSnapshot(q, (snapshot) => {
      this.events = snapshot.docs.map((doc) => doc.data());
      this.loaded = true;

      for (const event of this.events) {
        if (event.ref.id === this.selected_event_id) {
          if (event.cancelled) {
            this.setSelected(null);
          } else {
            this.selected_event = event;
          }
          break;
        }
      }
    });
  }

  fetchMembers() {
    this._unsubscribeMembers();
    if (!this.bandid) {
      this.members = [];
      return;
    }

    const bandRef = band(db, this.bandid);
    const q = firestoreQuery(bandRef.members().dbref);

    this._unsubscribeMembers = onSnapshot(q, (snapshot) => {
      this.members = snapshot.docs.map((doc) => doc.data());
      this.members.sort((m1, m2) => m1.id.localeCompare(m2.id));
    });
  }

  fetchBandData() {
    this._unsubscribeBand();
    if (!this.bandid) {
      this.bandData = null;
      return;
    }

    const bandRef = band(db, this.bandid);
    this._unsubscribeBand = onSnapshot(bandRef.dbref, (snapshot) => {
      if (snapshot.exists()) {
        this.bandData = snapshot.data();
      }
    });
  }

  static get styles() {
    return css`
      .top {
        width: 100%;
      }
      .list {
        display: flex;
        flex-direction: column;
        margin-bottom: var(--app-spacing-md);
        container-type: inline-size;
        max-width: 60ch;
        margin: auto;
        gap: var(--app-spacing-md);
      }
    `;
  }

  render() {
    return html`
      <div class="top" @click=${(_: Event) => this.setSelected(null)}>
        <div class="list">
          ${repeat(
            this.events,
            (e) => e.ref.id,
            (e: BandEvent) => {
              const selected = this.selected_event_id === e.ref.id;
              return html`
                <event-card
                  id="event-${e.ref.id}"
                  .event=${e}
                  .members=${this.members}
                  .sections=${this.bandData?.sections || []}
                  uid=${this.uid}
                  ?selected=${selected}
                  @select=${(ev: CustomEvent) => {
                    ev.stopPropagation();
                    this.setSelected(e);
                  }}
                  @close=${(ev: CustomEvent) => {
                    ev.stopPropagation();
                    this.setSelected(null);
                  }}
                ></event-card>
              `;
            }
          )}
          ${this.loaded && this.events.length === 0
            ? html`
                <div
                  style="text-align: center; padding: 40px; color: var(--app-color-text-secondary);"
                >
                  Inget planerat
                </div>
              `
            : ""}
        </div>
      </div>
    `;
  }

  setSelected(gig: BandEvent | null) {
    const id = gig?.ref?.id;
    if (id == this.selected_event_id) {
      return;
    }
    console.log("changing selection:", this.selected_event_id, "->", id);

    this.selected_event = gig;
    this.selected_event_id = id || null;

    if (gig) {
      this.updateComplete.then(() => {
        const newTarget = this.shadowRoot?.getElementById(`event-${id}`);
        newTarget?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "band-schedule": BandSchedule;
  }
}
