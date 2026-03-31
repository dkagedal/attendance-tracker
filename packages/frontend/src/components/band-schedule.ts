
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
import { band, Band } from "../model/band";
import { Member } from "../model/member";
import "./time-range";
import "./event-summary-card";
import "./app-dialog";
import "./app-button";
import "./app-icon";
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

  @state()
  actionMenuOpen = false;

  @property({ type: Array, attribute: false })
  members: Member[] = [];

  @query("event-editor")
  editor: EventEditor;

  @state()
  bandData: Band | null = null;

  private _unsubscribeGigs: () => void = () => { };
  private _unsubscribeMembers: () => void = () => { };
  private _unsubscribeBand: () => void = () => { };

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
      .list {
        display: flex;
        flex-direction: column;
      }

      /* Action Menu */
      .action-menu-container {
        position: relative;
      }

      .action-menu {
        position: absolute;
        top: 100%;
        right: 0;
        background: var(--app-color-surface);
        border-radius: var(--app-radius-md);
        box-shadow: var(--app-shadow-lg);
        padding: var(--app-spacing-xs) 0;
        min-width: 200px;
        display: none;
        z-index: 1000;
        color: var(--app-color-text);
        text-align: left;
      }

      .action-menu.open {
        display: block;
      }

      .menu-item {
        padding: var(--app-spacing-sm) var(--app-spacing-md);
        display: flex;
        align-items: center;
        gap: var(--app-spacing-sm);
        cursor: pointer;
        transition: background-color 0.2s;
        font-size: var(--app-font-size-md);
      }

      .menu-item:hover {
        background-color: var(--app-color-background);
      }
    `;
  }

  render() {
    return html`
      <div class="list" @click=${() => { if (this.actionMenuOpen) this.actionMenuOpen = false; }}>
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
        @click=${() => { if (this.actionMenuOpen) this.actionMenuOpen = false; }}
        hideCloseButton
      >
        ${this.selected_event ? html`
          ${this.edit_snapshot ? html`
            <event-editor .data=${this.edit_snapshot}></event-editor>
            <app-button slot="primaryAction" variant="primary" @click=${this.saveAndClose}>Spara</app-button>
            <app-button slot="secondaryAction" variant="secondary" @click=${() => this.edit_snapshot = null}>Avbryt</app-button>
          ` : html`
            <div slot="headerActions" class="action-menu-container">
              <app-button variant="icon" icon="more_vert" @click=${(e: Event) => {
                e.stopPropagation();
                this.actionMenuOpen = !this.actionMenuOpen;
              }}></app-button>
              <div class="action-menu ${this.actionMenuOpen ? 'open' : ''}" @click=${(e: Event) => e.stopPropagation()}>
                ${this.selected_event.cancelled ? html`
                  <div class="menu-item" @click=${() => { this.setCancelled(false); this.actionMenuOpen = false; }}>
                    <app-icon icon="history" style="font-size: 20px;"></app-icon>
                    <span>Återställ</span>
                  </div>
                  <div class="menu-item" @click=${() => { this.deleteEvent(); this.actionMenuOpen = false; }}>
                    <app-icon icon="delete" style="font-size: 20px;"></app-icon>
                    <span style="color: var(--app-color-error);">Radera</span>
                  </div>
                ` : html`
                  <div class="menu-item" @click=${() => { this.edit_snapshot = this.selected_event.clone(); this.actionMenuOpen = false; }}>
                    <app-icon icon="edit" style="font-size: 20px;"></app-icon>
                    <span>Redigera händelse</span>
                  </div>
                  <div class="menu-item" @click=${() => { this.setCancelled(true); this.actionMenuOpen = false; }}>
                    <app-icon icon="cancel" style="font-size: 20px;"></app-icon>
                    <span>Ställ in</span>
                  </div>
                `}
              </div>
            </div>
            <event-card
              .event=${this.selected_event}
              .members=${this.members}
              .sections=${this.bandData?.sections || []}
             ></event-card>
            <app-button slot="primaryAction" variant="primary" @click=${this.closeDialog}>Stäng</app-button>
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
    this.actionMenuOpen = false;
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
