import {
  onSnapshot,
  orderBy,
  query as firestoreQuery,
  Timestamp,
  where,
  deleteDoc,
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
import "./event-card";
import "./app-menu";
import { AppMenu } from "./app-menu";
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

  @query("#action-menu")
  actionMenu!: AppMenu;

  @property({ type: Array, attribute: false })
  members: Member[] = [];

  @query("event-editor")
  editor: EventEditor;

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
    if (changedProperties.has("selected_event_id")) {
      this.updateSelectedEvent();
    }
  }

  updateSelectedEvent() {
    if (!this.selected_event_id) {
      this.selected_event = null;
      this.edit_snapshot = null;
      return;
    }
    const found = this.events.find((e) => e.ref.id === this.selected_event_id);
    if (found) {
      this.selected_event = found;
    } else if (this.loaded) {
      this.selected_event = null;
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
      this.updateSelectedEvent();
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
      :host {
        display: block;
        width: 100%;
      }

      .schedule-container {
        display: flex;
        width: 100%;
        position: relative;
        align-items: flex-start;
      }

      .list-column {
        display: flex;
        flex-direction: column;
        position: relative;
        flex: 1 1 100%;
        max-width: 800px;
        margin: 0 auto;
        transition: flex-basis 0.3s cubic-bezier(0.4, 0, 0.2, 1),
          max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .list {
        display: flex;
        flex-direction: column;
        padding-bottom: 80px;
      }

      @media (max-width: 768px) {
        .list {
          padding-left: var(--app-spacing-md);
          padding-right: var(--app-spacing-md);
        }
      }

      /* Desktop detail column styles */
      .detail-column {
        flex: 0 0 0%;
        opacity: 0;
        pointer-events: none;
        transition: flex-basis 0.3s cubic-bezier(0.4, 0, 0.2, 1),
          opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        overflow: hidden;
      }

      /* Active state on card */
      event-summary-card.active {
        outline: 2px solid var(--app-color-primary-500);
        outline-offset: -2px;
        border-radius: var(--app-radius-lg);
        box-shadow: var(--app-shadow-md);
      }

      /* Desktop Split-Pane active styles */
      @media (min-width: 769px) {
        .schedule-container.has-selection {
          max-width: 1200px;
          margin: 0 auto;
          gap: var(--app-spacing-lg);
        }

        .schedule-container.has-selection .list-column {
          flex: 0 0 35%;
          max-width: 400px;
          margin: 0;
        }

        .schedule-container.has-selection .detail-column {
          flex: 1 1 65%;
          opacity: 1;
          pointer-events: auto;
          min-width: 0; /* Prevents flex items from overflowing */
        }
      }

      /* Mobile styles with slide-in transition */
      @media (max-width: 768px) {
        .schedule-container {
          width: 200vw;
          overflow-x: clip;
          overflow-y: visible;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .schedule-container.has-selection {
          transform: translateX(-100vw);
        }

        .list-column {
          width: 100vw;
          flex: 0 0 100vw;
          max-width: 100vw;
        }

        .detail-column {
          width: 100vw;
          flex: 0 0 100vw;
          max-width: 100vw;
          opacity: 1; /* Keep visible so it can slide in smoothly */
          pointer-events: auto;
        }
      }

      /* Detail view inner styling */
      .detail-card-wrapper {
        background-color: var(--app-color-surface);
        border: 1px solid var(--app-color-border);
        border-radius: var(--app-radius-lg);
        box-shadow: var(--app-shadow-sm);
        padding: var(--app-spacing-lg);
      }

      .detail-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--app-color-border);
        padding-bottom: var(--app-spacing-md);
        margin-bottom: var(--app-spacing-md);
        gap: var(--app-spacing-md);
      }

      .detail-header-title {
        font-size: var(--app-font-size-xl);
        font-weight: var(--app-font-weight-bold);
        color: var(--app-color-text);
        flex: 1;
      }

      @media (max-width: 768px) {
        .detail-card-wrapper {
          border: none;
          box-shadow: none;
          background: transparent;
          padding: var(--app-spacing-md);
        }
      }

      .editor-actions,
      .detail-actions {
        display: flex;
        gap: var(--app-spacing-md);
        margin-top: var(--app-spacing-lg);
        justify-content: flex-end;
      }

      /* Action Menu item styles */
      .menu-item {
        display: flex;
        align-items: center;
        gap: var(--app-spacing-sm);
        padding: var(--app-spacing-sm) var(--app-spacing-md);
        cursor: pointer;
      }

      .menu-item:hover {
        background-color: var(--app-color-background);
      }

      .menu-item.delete {
        color: var(--app-color-red-600);
      }

      .fab {
        position: sticky;
        bottom: calc(var(--app-spacing-lg) + 56px);
        align-self: flex-end;
        z-index: 90;
        height: 0;
        margin-right: var(--app-spacing-lg);
        pointer-events: none;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .fab app-button {
        pointer-events: auto;
      }
    `;
  }

  render() {
    const hasSelection =
      this.selected_event_id != null && this.selected_event_id !== "";
    return html`
      <div class="schedule-container ${hasSelection ? "has-selection" : ""}">
        <div class="list-column">
          <div class="list">
            ${repeat(
              this.events,
              (e) => e.ref.id,
              (e: BandEvent) => html`
                <event-summary-card
                  class="${this.selected_event_id === e.ref.id ? "active" : ""}"
                  uid=${this.uid}
                  .members=${this.members}
                  .event=${e}
                  @click=${(ev: Event) => this.selected(ev, e)}
                ></event-summary-card>
              `
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
          <div class="fab">
            <app-button
              variant="primary"
              icon="add"
              style="border-radius: 9999px; padding: 16px; box-shadow: var(--app-shadow-lg);"
              @click=${this.handleAddEvent}
            ></app-button>
          </div>
        </div>

        <div class="detail-column">
          ${this.selected_event
            ? html`
                <div class="detail-card-wrapper">
                  <div class="detail-header">
                    <div class="detail-header-title">
                      ${this.edit_snapshot
                        ? "Redigera händelse"
                        : this.selected_event.type}
                    </div>
                    ${!this.edit_snapshot
                      ? html`
                          <app-menu id="action-menu" slot="headerActions">
                            ${this.selected_event.cancelled
                              ? html`
                                  <div
                                    class="menu-item"
                                    @click=${() => {
                                      this.setCancelled(false);
                                      this.actionMenu.close();
                                    }}
                                  >
                                    <app-icon icon="history"></app-icon>
                                    <span>Återställ</span>
                                  </div>
                                  <div
                                    class="menu-item delete"
                                    @click=${() => {
                                      this.deleteEvent();
                                      this.actionMenu.close();
                                    }}
                                  >
                                    <app-icon icon="delete"></app-icon>
                                    <span>Radera</span>
                                  </div>
                                `
                              : html`
                                  <div
                                    class="menu-item"
                                    @click=${() => {
                                      this.edit_snapshot =
                                        this.selected_event.clone();
                                      this.actionMenu.close();
                                    }}
                                  >
                                    <app-icon icon="edit"></app-icon>
                                    <span>Redigera händelse</span>
                                  </div>
                                  <div
                                    class="menu-item"
                                    @click=${() => {
                                      this.setCancelled(true);
                                      this.actionMenu.close();
                                    }}
                                  >
                                    <app-icon icon="cancel"></app-icon>
                                    <span>Ställ in</span>
                                  </div>
                                `}
                          </app-menu>
                        `
                      : ""}
                  </div>
                  <div class="detail-content">
                    ${this.edit_snapshot
                      ? html`
                          <event-editor
                            .data=${this.edit_snapshot}
                          ></event-editor>
                          <div class="editor-actions">
                            <app-button
                              variant="primary"
                              @click=${this.saveAndClose}
                              >Spara</app-button
                            >
                            <app-button
                              variant="secondary"
                              @click=${() => (this.edit_snapshot = null)}
                              >Avbryt</app-button
                            >
                          </div>
                        `
                      : html`
                          <event-card
                            .event=${this.selected_event}
                            .members=${this.members}
                            .sections=${this.bandData?.sections || []}
                          ></event-card>
                          <div class="detail-actions">
                            <app-button
                              variant="primary"
                              @click=${this.closeDetails}
                              >Stäng</app-button
                            >
                          </div>
                        `}
                  </div>
                </div>
              `
            : ""}
        </div>
      </div>
    `;
  }

  async setCancelled(cancelled: boolean) {
    this.selected_event.cancelled = cancelled;
    await this.selected_event.ref.update(this.selected_event);
    this.requestUpdate();
  }

  deleteEvent() {
    if (
      confirm(
        "Är du säker på att du vill ta bort den här händelsen? Detta går inte att ångra."
      )
    ) {
      deleteDoc(this.selected_event.ref.dbref).then(
        () => {
          this.closeDetails();
          console.log("Delete successful");
        },
        (reason) => {
          console.log("Delete failed:", reason);
        }
      );
    }
  }

  selected(_selectEvent: any, gig: BandEvent) {
    this.dispatchEvent(
      new CustomEvent("event-selected", {
        detail: { eventId: gig.ref.id },
        bubbles: true,
        composed: true,
      })
    );
  }

  closeDetails() {
    this.dispatchEvent(
      new CustomEvent("event-selected", {
        detail: { eventId: null },
        bubbles: true,
        composed: true,
      })
    );
    this.edit_snapshot = null;
    this.actionMenu?.close();
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
    this.closeDetails();
  }

  handleAddEvent() {
    this.dispatchEvent(
      new CustomEvent("add-event", {
        bubbles: true,
        composed: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "band-schedule": BandSchedule;
  }
}
