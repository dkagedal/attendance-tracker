import "@material/mwc-linear-progress/mwc-linear-progress";
import "@material/mwc-icon";
import "@material/mwc-button";
import "@material/mwc-linear-progress";
import "@material/mwc-list/mwc-list";
import "@material/mwc-list/mwc-list-item";
import {
  onSnapshot,
  orderBy,
  query as firestoreQuery,
  Timestamp,
  where
} from "firebase/firestore";
import { css, html, LitElement } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat";
import { UID } from "../datamodel";
import { db } from "../storage";
import { BandEvent } from "../model/bandevent";
import { band } from "../model/band";
import { Member } from "../model/member";
import "./time-range";
import "./event-summary-card";
import "./app-dialog";
import "./app-button";
import "./mini-roster";
import "./event-card";
import { EventCard } from "./event-card";

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

  @property({ type: Object })
  selected_event: BandEvent | null = null;

  @state()
  selected_event_snapshot: BandEvent | null = null;

  @state()
  isEditing = false;

  @property({ type: Array, attribute: false })
  members: Member[] = [];

  @query("event-card")
  card: EventCard;

  private _unsubscribeGigs: () => void = () => { };
  private _unsubscribeMembers: () => void = () => { };

  updated(changedProperties: any) {
    if (changedProperties.has("bandid")) {
      this.fetchGigs();
      this.fetchMembers();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribeGigs();
    this._unsubscribeMembers();
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
      this.events = snapshot.docs.map(doc => doc.data());
      this.loaded = true;
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
      this.members = snapshot.docs.map(doc => doc.data());
      this.members.sort((m1, m2) => m1.id.localeCompare(m2.id));
    });
  }

  static get styles() {
    return css`
      .list {
        display: flex;
        flex-direction: column;
      }
    `;
  }

  render() {
    return html`
      <div class="list">
        ${repeat(
      this.events,
      e => e.ref.id,
      (e: BandEvent) => html`
            <event-summary-card
              uid=${this.uid}
              .members=${this.members}
              .event=${e}
              @click=${(ev: Event) => this.selected(ev, e)}
            ></event-summary-card>
          `
    )}
        ${this.loaded && this.events.length === 0
        ? html`
              <div style="text-align: center; padding: 40px; color: var(--app-color-text-secondary);">
                Inget planerat
              </div>
            `
        : ""}
      </div>
      
      <app-dialog 
        heading="${this.isEditing ? 'Redigera händelse' : this.selected_event?.type || 'Händelse'}" 
        ?open=${this.selected_event != null}
        @closed=${() => this.selected_event = null}
        hideCloseButton
      >
        ${this.selected_event ? html`
          <event-card
            .event=${this.isEditing ? this.selected_event_snapshot : this.selected_event}
            .members=${this.members}
            .editing=${this.isEditing}
            @edit=${() => this.isEditing = true}
            @closed=${() => this.selected_event = null}
          ></event-card>
        ` : ""}
        
        ${this.isEditing ? html`
          <app-button slot="primaryAction" variant="primary" @click=${this.saveAndClose}>Spara</app-button>
          <app-button slot="secondaryAction" variant="secondary" @click=${this.cancelEdit}>Avbryt</app-button>
        ` : html`
          <app-button slot="primaryAction" variant="primary" @click=${() => this.selected_event = null}>Stäng</app-button>
        `}
      </app-dialog>
    `;
  }

  selected(_selectEvent: any, gig: BandEvent) {
    this.selected_event_snapshot = gig.clone();
    this.selected_event = gig;
    this.isEditing = false;
  }

  cancelEdit() {
    this.isEditing = false;
    if (this.selected_event) {
      this.selected_event_snapshot = this.selected_event.clone();
    }
  }

  async saveAndClose() {
    if (this.card) {
      try {
        await this.card.save();
      } catch (e) {
        console.error("Save failed:", e);
        return; // Don't close on error
      }
    }
    this.selected_event = null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "band-schedule": BandSchedule;
  }
}
