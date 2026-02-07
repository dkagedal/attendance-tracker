
import {
  onSnapshot,
  orderBy,
  query as firestoreQuery,
  Timestamp,
  where,
  deleteDoc
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
import { EventEditor } from "./event-editor";

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

  @state()
  edit_snapshot: BandEvent | null = null;

  @property({ type: Array, attribute: false })
  members: Member[] = [];

  @query("event-editor")
  editor: EventEditor;

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

      for (const event of this.events) {
        if (event.ref.id === this.selected_event_id) {
          this.selected_event = event;
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
        heading="${this.edit_snapshot ? 'Redigera händelse' : this.selected_event?.type || 'Händelse'}" 
        ?open=${this.selected_event != null}
        @closed=${this.closeDialog}
        hideCloseButton
      >
        ${this.selected_event ? html`
          ${this.edit_snapshot ? html`
            <event-editor .data=${this.edit_snapshot}></event-editor>
            <app-button slot="primaryAction" variant="primary" @click=${this.saveAndClose}>Spara</app-button>
            <app-button slot="secondaryAction" variant="secondary" @click=${() => this.edit_snapshot = null}>Avbryt</app-button>
          ` : html`
            <event-card
              .event=${this.selected_event}
              .members=${this.members}
             ></event-card>
            <app-button slot="primaryAction" variant="primary" @click=${this.closeDialog}>Stäng</app-button>
            ${this.selected_event.cancelled ? html`
              <app-button slot="secondaryAction" variant="secondary" icon="history" @click=${() => this.setCancelled(false)}>
                Återställ
              </app-button>
              <app-button slot="secondaryAction" variant="secondary" icon="delete" @click=${this.deleteEvent}>Radera</app-button>
            ` : html`
              <app-button slot="secondaryAction" variant="secondary" icon="edit" @click=${() => this.edit_snapshot = this.selected_event.clone()}>Redigera</app-button>
              <app-button slot="secondaryAction" variant="secondary" icon="cancel" @click=${() => this.setCancelled(true)}>
                Ställ in
              </app-button>
            `}
          `}
        ` : ""}
      </app-dialog>
    `;
  }

  async setCancelled(cancelled: boolean) {
    this.selected_event.cancelled = cancelled;
    await this.selected_event.ref.update(this.selected_event);
    this.requestUpdate();
  }

  deleteEvent() {
    if (confirm("Är du säker på att du vill ta bort den här händelsen? Detta går inte att ångra.")) {
      deleteDoc(this.selected_event.ref.dbref).then(
        () => {
          this.closeDialog();
          console.log("Delete successful");
        },
        reason => {
          console.log("Delete failed:", reason);
        }
      );
    }
  }

  selected(_selectEvent: any, gig: BandEvent) {
    this.selected_event_id = gig.ref.id;
    this.selected_event = gig;
    this.edit_snapshot = null;
  }

  closeDialog() {
    this.selected_event_id = null;
    this.selected_event = null;
    this.edit_snapshot = null;
  }

  async saveAndClose() {
    if (this.editor) {
      try {
        await this.editor.save();
      } catch (e) {
        console.error("Save failed:", e);
        return; // Don't close on error
      }
    }
    this.closeDialog();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "band-schedule": BandSchedule;
  }
}
