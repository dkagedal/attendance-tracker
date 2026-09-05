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
import "./event-view";
import "./app-dialog";
import "./app-card";
import "./app-button";
import "./app-icon";
import "./event-card";
import "./app-menu";
import { AppMenu } from "./app-menu";
import { EventEditor } from "./event-editor";
import "./response-card";
import { ResponseCard } from "./response-card";
import { classMap } from "lit/directives/class-map";

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
      orderBy("start"),
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

      app-card * {
        transition: display 0.3s allow-discrete, opacity 0.3s ease;
      }

      /* Things to show when folded are visible by default */
      app-card .fold {
        display: block;
        opacity: 1;
        transition: display 0.3s allow-discrete, opacity 0.3s ease;
      }

      /* Things to show when unfolded are hidden by default. */
      app-card .unfold {
        display: none;
        opacity: 0;
        transition: display 0.3s allow-discrete, opacity 0.3s ease;
      }

      /* Things to show when folded are hidden when selected. */
      app-card.selected .fold {
        display: none;
        opacity: 0;
        transition: display 0.3s, opacity 0.3s ease;
      }

      /* Things to show when unfolded are visible when selected. */
      app-card.selected .unfold {
        display: block;
        opacity: 1;
        transition: display 0.3s allow-discrete, opacity 0.3s ease;
      }

      .closer {
        display: none;
      }

      event-view {
        margin-bottom: var(--app-spacing-md);
      }

      response-card {
        background: var(--app-color-amber-100);
        padding: 0 var(--app-spacing-md);
      }

      app-card.selected .closer {
        display: flex;
        height: 1.5em;
        cursor: pointer;
        align-items: center;
        justify-content: center;
        color: var(--app-color-primary-700);
        &:hover {
          background-color: var(--app-color-primary-100);
        }
        app-icon {
          margin-bottom: -0.5ex;
        }
      }

      app-card {
        height: 8.5em;
        transition: height 0.3s ease;
        overflow: hidden;
      }
      app-card.cancelled {
        height: 6.5em;
      }
      app-card.selected {
        height: fit-content;
        transition: height 0.3s ease;
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
                <app-card
                  class=${classMap({ cancelled: e.cancelled })}
                  ?clickable=${!selected}
                  id="event-${e.ref.id}"
                  @click=${(ev: Event) => {
                    ev.stopPropagation();
                    if (!selected && !e.cancelled) {
                      this.setSelected(e);
                    }
                  }}
                >
                  <event-view
                    uid=${this.uid}
                    .members=${this.members}
                    .sections=${this.bandData?.sections || []}
                    .event=${e}
                    ?summary=${!selected}
                    @edit-event=${(ev: CustomEvent) => {
                      this.edit_snapshot = ev.detail;
                    }}
                    @close-event=${(_: Event) => this.setSelected(null)}
                  ></event-view>
                  <response-card
                    class="unfold"
                    slot="footer"
                    .event=${e}
                    uid=${this.uid}
                    @click=${(ev: Event) => {
                      ev.stopPropagation();
                      const rc = ev.target as ResponseCard;
                      if (rc.mode === "view") {
                        rc.mode = "edit";
                      }
                    }}
                  ></response-card>
                  <div
                    class="closer"
                    slot="footer"
                    @click=${(ev: Event) => {
                      ev.stopPropagation();
                      this.setSelected(null);
                    }}
                  >
                    <app-icon icon="arrow_drop_up"></app-icon>
                  </div>
                </app-card>
              `;
            },
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

      <app-dialog
        heading="${this.edit_snapshot
          ? "Redigera händelse"
          : this.selected_event?.type || "Händelse"}"
        ?open=${this.edit_snapshot}
        @closed=${this.closeDialog}
        hideCloseButton
      >
        ${this.selected_event
          ? html`
              ${this.edit_snapshot
                ? html`
                    <event-editor .data=${this.edit_snapshot}></event-editor>
                    <app-button
                      slot="primaryAction"
                      variant="primary"
                      @click=${this.saveAndClose}
                      >Spara</app-button
                    >
                    <app-button
                      slot="secondaryAction"
                      variant="secondary"
                      @click=${() => (this.edit_snapshot = null)}
                      >Avbryt</app-button
                    >
                  `
                : html`
                    <app-menu slot="headerActions" id="action-menu">
                      ${this.selected_event.cancelled
                        ? html`
                            <div
                              class="menu-item"
                              @click=${() => {
                                this.setCancelled(this.selected_event, false);
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
                                this.setCancelled(this.selected_event, true);
                                this.actionMenu.close();
                              }}
                            >
                              <app-icon icon="cancel"></app-icon>
                              <span>Ställ in</span>
                            </div>
                          `}
                    </app-menu>
                    <event-card
                      .event=${this.selected_event}
                      .members=${this.members}
                      .sections=${this.bandData?.sections || []}
                    ></event-card>
                    <app-button
                      slot="primaryAction"
                      variant="primary"
                      @click=${this.closeDialog}
                      >Stäng</app-button
                    >
                  `}
            `
          : ""}
      </app-dialog>
    `;
  }

  async setCancelled(event: BandEvent, cancelled: boolean) {
    event.cancelled = cancelled;
    await event.ref.update(event);
    this.requestUpdate();
  }

  deleteEvent() {
    if (
      confirm(
        "Är du säker på att du vill ta bort den här händelsen? Detta går inte att ångra.",
      )
    ) {
      deleteDoc(this.selected_event.ref.dbref).then(
        () => {
          this.closeDialog();
          console.log("Delete successful");
        },
        (reason) => {
          console.log("Delete failed:", reason);
        },
      );
    }
  }

  setSelected(gig: BandEvent | null) {
    const id = gig?.ref?.id;
    if (id == this.selected_event_id) {
      return;
    }
    console.log("changing selection:", this.selected_event_id, "->", id);

    if (this.selected_event_id) {
      const oldTarget = this.shadowRoot.getElementById(
        `event-${this.selected_event_id}`,
      );
      oldTarget.classList.remove("selected");
    }

    this.selected_event = gig;
    this.selected_event_id = id;
    this.edit_snapshot = null;

    if (gig) {
      const newTarget = this.shadowRoot.getElementById(`event-${id}`);
      newTarget.classList.add("selected");
      newTarget.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }

  closeDialog() {
    this.setSelected(null);
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
    this.closeDialog();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "band-schedule": BandSchedule;
  }
}
