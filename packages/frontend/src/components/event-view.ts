import { LitElement, html, css } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { BandEvent } from "../model/bandevent";
import { Member } from "../model/member";
import { Participant } from "../model/participant";
import { deleteDoc, onSnapshot } from "firebase/firestore";
import "./app-icon";
import "./attendance-progress-bar";
import "./response-icon";
import { UID } from "../datamodel";
import { Section } from "../model/band";
import { AppMenu } from "./app-menu";

@customElement("event-view")
export class EventView extends LitElement {
  @property({ type: Boolean, reflect: true })
  summary = false;

  @property({ type: Object })
  event: BandEvent | null = null;

  @property({ type: Boolean, reflect: true })
  cancelled = false;

  @property({ type: Array })
  members: Member[] = [];

  @property({ type: Array, attribute: false })
  sections: Section[] = [];

  @property({ type: String })
  uid: string = "";

  @state()
  participants: { [uid: string]: Participant } = {};

  @state()
  loading = true;

  @query("#action-menu")
  actionMenu!: AppMenu;

  unsubscribe: () => void = () => {};

  connectedCallback() {
    super.connectedCallback();
    if (this.event) {
      this.fetchParticipants();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe();
  }

  willUpdate(changedProperties: any) {
    if (changedProperties.has("event") && this.event) {
      this.cancelled = !!this.event.cancelled;
      console.log(
        `[event-summary-card] Event ${this.event.ref.id} updated. Cancelled: ${this.cancelled}`,
      );
    }
  }

  updated(changedProperties: any) {
    if (changedProperties.has("event") && this.event) {
      this.fetchParticipants();
    }
  }

  fetchParticipants() {
    this.unsubscribe();
    this.loading = true;
    this.unsubscribe = onSnapshot(
      this.event!.ref.participants().dbref,
      (snapshot) => {
        const participants: { [uid: string]: Participant } = {};
        snapshot.docs.forEach((doc) => {
          const p = doc.data();
          participants[p.uid] = p;
        });
        this.participants = participants;
        this.loading = false;
      },
    );
  }

  get yesCount() {
    return Object.values(this.participants).filter((p) => p.attending === "yes")
      .length;
  }

  get noCount() {
    return Object.values(this.participants).filter((p) => p.attending === "no")
      .length;
  }

  get subCount() {
    return Object.values(this.participants).filter((p) => p.attending === "sub")
      .length;
  }

  get userResponse() {
    return this.participants[this.uid]?.attending;
  }

  get actionRequired() {
    return !this.userResponse && !this.event?.cancelled;
  }

  static styles = css`
    :host {
      display: block;
    }

    .content {
      display: flex;
      flex-direction: column;
      gap: var(--app-spacing-md);

      .main {
        width: 100%;
        display: flex;
        flex-grow: 1;
        flex-direction: row;
        gap: var(--app-spacing-md);
        align-items: center;
        position: relative;
      }

      response-icon {
        font-size: 1.5rem;
        align-self: start;
      }

      app-menu {
        align-self: start;
      }

      .date-box {
        align-self: start;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background-color: var(--app-color-background);
        border-radius: var(--app-radius-md);
        padding: var(--app-spacing-sm);
        width: clamp(40px, 10vw, 60px);
        height: 3em;
        text-align: center;
        border: 1px solid var(--app-color-border);

        .date-month {
          font-size: 0.75rem;
          text-transform: uppercase;
          color: var(--app-color-primary-700);
          font-weight: var(--app-font-weight-bold);
          line-height: 1;
          margin-bottom: 4px;
        }

        .date-day {
          font-size: 1.5rem;
          font-weight: var(--app-font-weight-bold);
          color: var(--app-color-text);
          line-height: 1;
        }
      }

      .info {
        flex: 1;
        align-self: start;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;

        .title {
          font-size: var(--app-font-size-lg);
          font-weight: var(--app-font-weight-bold);
          color: var(--app-color-text);
          margin: 0;
        }

        .meta {
          display: flex;
          align-items: start;
          gap: var(--app-spacing-md);
          font-size: var(--app-font-size-sm);
          color: var(--app-color-text-secondary);
          // min-width: 0;
          width: 100%;
        }

        .meta-item {
          display: flex;
          gap: 4px;
        }

        .meta-item.location {
          flex: 1;
        }

        .description {
          transition: height 0.3s ease;
          min-height: 1lh;
          overflow: hidden;
          p {
            margin: 0;
          }
        }
      }

      .status {
        width: 100%;

        attendance-progress-bar {
          width: 100%;
          height: 1ex;
        }
      }

      .badge {
        font-size: 0.75rem;
        font-weight: var(--app-font-weight-bold);
        padding: 4px 10px;
        border-radius: var(--app-radius-full);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .badge.action {
        background-color: transparent;
        color: var(--app-color-red-600);
        border: 1px solid var(--app-color-red-600);
        box-shadow: none;
      }

      .badge.cancelled {
        background-color: var(--app-color-text-secondary);
        color: white;
      }
    }

    :host([cancelled]) {
      opacity: 0.6;

      .status,
      .description,
      roster-section {
        display: none;
      }
    }

    .section-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      column-gap: var(--app-spacing-md);
      // row-gap: var(--app-spacing-sm);
      align-items: baseline;

      .section-header {
        font-weight: var(--app-font-weight-bold);
        font-size: var(--app-font-size-sm);
        color: var(--app-color-text-secondary);
        white-space: nowrap;
      }

      .section-roster {
        min-width: 0;
      }
    }

    .comments-section {
      margin-top: var(--app-spacing-lg);

      .comment-list {
        display: grid;
        grid-template-columns: auto auto 1fr;
        gap: var(--app-spacing-sm);
        font-size: var(--app-font-size-sm);
      }

      .comment-author {
        font-weight: bold;
        grid-column: 1;
      }

      .comment-text {
        color: var(--app-color-text-secondary);
        grid-column: 3;
      }

      .comment-list response-icon {
        font-size: 16px;
        grid-column: 2;
      }

      .comment-list response-icon {
        font-size: 16px;
        grid-column: 2;
      }
    }

    :host([summary]) {
      a {
        pointer-events: none;
        cursor: default;
        text-decoration: none;
        color: inherit;
      }
      .truncate-in-summary {
        height: 1lh;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
        transition: height 0.3s ease;
      }

      .description {
        height: 1lh;
        p {
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
      }
      .roster-section {
        display: none;
      }
    }

    response-card {
      background: var(--app-color-amber-100);
    }
  `;

  renderResponseStatus() {
    return html`
      <response-icon .response=${this.userResponse}></response-icon>
    `;
  }

  renderSectionRosters() {
    if (!this.event || this.cancelled) return html``;

    const sectionIds = new Set(this.sections.map((s) => s.id));
    const sectionsWithMembers = this.sections.map((section) => ({
      id: section.id,
      name: section.name,
      emoji: section.emoji,
      members: this.members.filter((m) => m.section_id === section.id),
    }));

    const unassignedMembers = this.members.filter(
      (m) => !m.section_id || !sectionIds.has(m.section_id),
    );
    if (unassignedMembers.length > 0) {
      sectionsWithMembers.push({
        id: "unassigned",
        name: "Övriga",
        emoji: "🎵",
        members: unassignedMembers,
      });
    }

    const activeSections = sectionsWithMembers.filter(
      (s) => s.members.length > 0,
    );
    const responses = Object.fromEntries(
      Object.entries(this.participants).map(([k, v]) => [k, v.attending]),
    );

    return html`
      <div class="section-grid">
        ${activeSections.map(
          (s) => html`
            <div class="section-header">${s.emoji} ${s.name}</div>
            <div class="section-roster">
              <mini-roster
                .members=${s.members}
                .event=${this.event}
                .responses=${responses}
              ></mini-roster>
            </div>
          `,
        )}
      </div>
    `;
  }

  getMemberData(uid: UID): Member {
    for (const member of this.members) {
      if (member.id == uid) {
        return member;
      }
    }
    return null;
  }
  renderComments() {
    const comments = Object.values(this.participants)
      .filter((p) => p.comment && p.comment.trim().length > 0)
      .map((p) => {
        const member = this.getMemberData(p.uid);
        return {
          name: member ? member.display_name : "Okänd",
          comment: p.comment,
          uid: p.uid,
          response: p.attending,
        };
      });

    if (comments.length === 0) return html``;

    return html`
      <div class="comments-section">
        <div class="comment-list">
          ${comments.map(
            (c) => html`
              <span class="comment-author">${c.name}</span>
              <response-icon .response=${c.response}></response-icon>
              <span class="comment-text">${c.comment}</span>
            `,
          )}
        </div>
      </div>
    `;
  }

  deleteEvent() {
    if (
      confirm(
        "Är du säker på att du vill ta bort den här händelsen? Detta går inte att ångra.",
      )
    ) {
      deleteDoc(this.event.ref.dbref).then(
        () => {
          console.log("Delete successful");
        },
        (reason) => {
          console.log("Delete failed:", reason);
        },
      );
    }
  }

  renderMenu() {
    return html` <app-menu id="action-menu" class="unfold">
      ${this.event.cancelled
        ? html`
            <div
              class="menu-item"
              @click=${async () => {
                const event = this.event.clone();
                event.cancelled = false;
                await event.ref.update(event);
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
              @click=${(ev: Event) => {
                ev.stopPropagation();
                // Send a custom event up to the band schedule.
                this.dispatchEvent(
                  new CustomEvent("edit-event", {
                    detail: this.event.clone(),
                  }),
                );
                this.actionMenu.close();
              }}
            >
              <app-icon icon="edit"></app-icon>
              <span>Redigera händelse</span>
            </div>
            <div
              class="menu-item"
              @click=${async () => {
                this.event.cancelled = true;
                await this.event.ref.update(this.event);
                this.actionMenu.close();
              }}
            >
              <app-icon icon="cancel"></app-icon>
              <span>Ställ in</span>
            </div>
          `}
    </app-menu>`;
  }

  render() {
    if (!this.event) return html``;

    let month = "";
    let day: number | string = "";
    let time = "";

    if (this.event.start) {
      const [datePart, timePart] = this.event.start.split("T");
      const [y, m, d] = datePart.split("-").map(Number);

      // Use UTC to prevent local timezone offsets from changing the day
      const dateObj = new Date(Date.UTC(y, m - 1, d));
      month = dateObj
        .toLocaleDateString("sv-SE", { month: "short", timeZone: "UTC" })
        .replace(".", "");
      day = dateObj.getUTCDate();

      if (timePart) {
        let isZeroTime =
          timePart === "00:00" ||
          timePart === "00:00:00" ||
          timePart.startsWith("00:00:00.");
        if (!isZeroTime) {
          const timeTokens = timePart.split(":");
          time = `${timeTokens[0]}:${timeTokens[1]}`;
        }
      }
    } else {
      const dateObj = new Date();
      month = dateObj
        .toLocaleDateString("sv-SE", { month: "short" })
        .replace(".", "");
      day = dateObj.getDate();
    }

    const total = this.members.length || 1; // Avoid division by zero

    return html`
      <div class="content">
        <div class="main">
          <div
            class="date-box"
            @click=${(ev: MouseEvent) => {
              if (!this.summary) {
                ev.stopPropagation();
                this.dispatchEvent(new CustomEvent("close-event", {}));
              }
            }}
          >
            <span class="date-month">${month}</span>
            <span class="date-day">${day}</span>
          </div>

          <div class="info">
            <h3 class="title truncate-in-summary">
              ${this.event.type}
              ${this.event.cancelled
                ? html`
                    <span
                      class="badge cancelled"
                      style="margin-left: 8px; vertical-align: middle;"
                      >Inställt</span
                    >
                  `
                : ""}
            </h3>
            <div class="meta">
              <div class="meta-item">
                <app-icon icon="schedule" style="font-size: 16px;"></app-icon>
                ${time ? html` ${time} ` : "-"}
              </div>
              <div class="meta-item location truncate-in-summary">
                <app-icon icon="place" style="font-size: 16px;"></app-icon>
                <span class="truncate-in-summary">
                  ${this.event.location
                    ? html`
                        <a
                          href="http://maps.google.se/maps?q=${this.event
                            .location}"
                          target="_blank"
                          >${this.event.location}</a
                        >
                      `
                    : "-"}
                </span>
              </div>
            </div>
            <div class="description truncate-in-summary">
              ${this.event.description
                ? html`
                    ${unsafeHTML(
                      DOMPurify.sanitize(
                        marked.parse(
                          this.event.description.split("\n\n")[0],
                        ) as string,
                      ),
                    )}
                  `
                : ""}
            </div>
          </div>
          ${this.summary && !this.cancelled
            ? this.renderResponseStatus()
            : this.renderMenu()}
        </div>
        <div class="status">
          <attendance-progress-bar
            .yes=${this.yesCount}
            .no=${this.noCount}
            .sub=${this.subCount}
            .total=${total}
          ></attendance-progress-bar>
        </div>
        <div class="roster-section">
          ${!this.cancelled
            ? html` ${this.renderSectionRosters()} ${this.renderComments()} `
            : ""}
        </div>
      </div>
    `;
  }
}
