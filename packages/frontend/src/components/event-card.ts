import { LitElement, html, css } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { deleteDoc, onSnapshot } from "firebase/firestore";
import { BandEvent } from "../model/bandevent";
import { Member } from "../model/member";
import { Section } from "../model/band";
import { Participant } from "../model/participant";
import { UID } from "../datamodel";
import { auth } from "../storage";
import "./date-box";
import "./app-icon";
import "./attendance-progress-bar";
import "./response-icon";
import "./mini-roster";
import "./response-card";
import { ResponseCard } from "./response-card";
import "./app-menu";
import { AppMenu } from "./app-menu";
import "./app-dialog";
import "./app-button";
import "./event-editor";
import { EventEditor } from "./event-editor";

@customElement("event-card")
export class EventCard extends LitElement {
  @property({ type: Object, attribute: false })
  event: BandEvent | null = null;
  @property({ type: Boolean, reflect: true })
  selected = false;

  @property({ type: Boolean, reflect: true })
  cancelled = false;

  @property({ type: Array, attribute: false })
  members: Member[] = [];

  @property({ type: Array, attribute: false })
  sections: Section[] = [];

  @property({ type: String })
  uid: string = "";

  @state()
  participants: { [uid: string]: Participant } = {};

  @state()
  loading = true;

  @state()
  edit_snapshot: BandEvent | null = null;

  @query("#action-menu")
  actionMenu!: AppMenu;

  @query("event-editor")
  editor!: EventEditor;

  private unsubscribe: () => void = () => {};

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("click", this.handleHostClick);
    if (this.event) {
      this.cancelled = !!this.event.cancelled;
      this.fetchParticipants();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("click", this.handleHostClick);
    this.unsubscribe();
  }

  willUpdate(changedProperties: any) {
    if (changedProperties.has("event") && this.event) {
      this.cancelled = !!this.event.cancelled;
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
    if (!this.event?.ref) {
      this.participants = {};
      this.loading = false;
      return;
    }

    this.unsubscribe = onSnapshot(
      this.event.ref.participants().dbref,
      (snapshot) => {
        const participants: { [uid: string]: Participant } = {};
        snapshot.docs.forEach((doc) => {
          const p = doc.data();
          participants[p.uid] = p;
        });
        this.participants = participants;
        this.loading = false;
      }
    );
  }

  get effectiveUid() {
    return this.uid || auth?.currentUser?.uid || "";
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
    return this.participants[this.effectiveUid]?.attending;
  }

  get actionRequired() {
    return !this.userResponse && !this.event?.cancelled;
  }

  getMemberData(uid: UID): Member | null {
    for (const member of this.members) {
      if (member.id === uid) {
        return member;
      }
    }
    return null;
  }

  private handleHostClick = (ev: Event) => {
    ev.stopPropagation();
    if (!this.selected && !this.event?.cancelled) {
      this.dispatchEvent(
        new CustomEvent("select", {
          bubbles: true,
          composed: true,
          detail: this.event,
        })
      );
    }
  };

  private handleDateBoxClick = (ev: MouseEvent) => {
    if (this.selected) {
      ev.stopPropagation();
      this.dispatchEvent(
        new CustomEvent("close", { bubbles: true, composed: true })
      );
    }
  };

  private handleClose = (ev: MouseEvent) => {
    ev.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("close", { bubbles: true, composed: true })
    );
  };

  deleteEvent() {
    if (
      confirm(
        "Är du säker på att du vill ta bort den här händelsen? Detta går inte att ångra."
      )
    ) {
      deleteDoc(this.event!.ref.dbref).then(
        () => {
          this.dispatchEvent(
            new CustomEvent("close", { bubbles: true, composed: true })
          );
          console.log("Delete successful");
        },
        (reason) => {
          console.log("Delete failed:", reason);
        }
      );
    }
  }

  async saveAndClose() {
    if (this.editor) {
      try {
        await this.editor.save();
      } catch (e) {
        console.error("Save failed:", e);
        return;
      }
    }
    this.edit_snapshot = null;
  }

  static styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      background-color: var(--app-color-surface);
      border-radius: var(--app-radius-lg);
      box-shadow: var(--app-shadow-sm);
      border: 1px solid var(--app-color-border);
      padding: var(--app-spacing-md);
      height: 8.5em;
      transition: height 0.3s ease, box-shadow 0.2s ease-in-out,
        transform 0.2s ease-in-out;
      overflow: hidden;
      cursor: pointer;
    }

    :host([cancelled]) {
      height: 6.5em;
      opacity: 0.6;
      cursor: default;
    }

    :host(:not([selected]):not([cancelled]):hover) {
      box-shadow: var(--app-shadow-md);
      transform: translateY(-1px);
    }

    :host(:not([selected]):not([cancelled]):active) {
      transform: translateY(0);
      box-shadow: var(--app-shadow-sm);
    }

    :host([selected]) {
      height: fit-content;
      cursor: default;
      transition: height 0.3s ease;
    }

    .content {
      display: flex;
      flex-direction: column;
      gap: var(--app-spacing-md);
    }

    .content .main {
      width: 100%;
      display: flex;
      flex-grow: 1;
      flex-direction: row;
      gap: var(--app-spacing-md);
      align-items: center;
      position: relative;
    }

    .content response-icon {
      font-size: 1.5rem;
      align-self: start;
    }

    .content app-menu {
      align-self: start;
    }

    .content date-box {
      align-self: start;
      width: clamp(40px, 10vw, 60px);
    }

    :host([selected]) date-box {
      cursor: pointer;
    }

    .info {
      flex: 1;
      align-self: start;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .content .title {
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
    }

    .description > p:first-child {
      margin-top: 0;
    }

    .description > p:last-child {
      margin-bottom: 0;
    }

    .status {
      width: 100%;
    }

    attendance-progress-bar {
      width: 100%;
      height: 1ex;
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

    :host([cancelled]) {
      .status,
      .description,
      .roster-section {
        display: none;
      }
    }

    .section-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      column-gap: var(--app-spacing-md);
      align-items: baseline;
    }

    .section-header {
      font-weight: var(--app-font-weight-bold);
      font-size: var(--app-font-size-sm);
      color: var(--app-color-text-secondary);
      white-space: nowrap;
    }

    .section-roster {
      min-width: 0;
    }

    .comments-section {
      margin-top: var(--app-spacing-lg);
    }

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

    :host(:not([selected])) a {
      pointer-events: none;
      cursor: default;
      text-decoration: none;
      color: inherit;
    }

    :host(:not([selected])) .truncate-in-summary {
      height: 1lh;
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
      transition: height 0.3s ease;
    }

    :host(:not([selected])) .description {
      height: 1lh;
      p {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
    }

    :host(:not([selected])) .roster-section {
      display: none;
    }

    .footer {
      margin-left: calc(var(--app-spacing-md) * -1);
      margin-right: calc(var(--app-spacing-md) * -1);
      margin-bottom: calc(var(--app-spacing-md) * -1);
      margin-top: var(--app-spacing-md);
    }

    .footer response-card {
      background: var(--app-color-amber-100);
      padding: 0 var(--app-spacing-md);
    }

    .closer {
      display: flex;
      height: 1.5em;
      cursor: pointer;
      align-items: center;
      justify-content: center;
      color: var(--app-color-primary-700);
    }

    .closer:hover {
      background-color: var(--app-color-primary-100);
    }

    .closer app-icon {
      margin-bottom: -0.5ex;
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
      (m) => !m.section_id || !sectionIds.has(m.section_id)
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
      (s) => s.members.length > 0
    );
    const responses = Object.fromEntries(
      Object.entries(this.participants).map(([k, v]) => [k, v.attending])
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
          `
        )}
      </div>
    `;
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
            `
          )}
        </div>
      </div>
    `;
  }

  renderMenu() {
    return html`
      <app-menu id="action-menu">
        ${this.event?.cancelled
          ? html`
              <div
                class="menu-item"
                @click=${async (ev: Event) => {
                  ev.stopPropagation();
                  const event = this.event!.clone();
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
                @click=${(ev: Event) => {
                  ev.stopPropagation();
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
                  this.edit_snapshot = this.event!.clone();
                  this.actionMenu.close();
                }}
              >
                <app-icon icon="edit"></app-icon>
                <span>Redigera händelse</span>
              </div>
              <div
                class="menu-item"
                @click=${async (ev: Event) => {
                  ev.stopPropagation();
                  const event = this.event!.clone();
                  event.cancelled = true;
                  await event.ref.update(event);
                  this.actionMenu.close();
                }}
              >
                <app-icon icon="cancel"></app-icon>
                <span>Ställ in</span>
              </div>
            `}
      </app-menu>
    `;
  }

  render() {
    if (!this.event) return html``;

    let time = "";
    if (this.event.start) {
      const [, timePart] = this.event.start.split("T");
      if (timePart) {
        const isZeroTime =
          timePart === "00:00" ||
          timePart === "00:00:00" ||
          timePart.startsWith("00:00:00.");
        if (!isZeroTime) {
          const timeTokens = timePart.split(":");
          time = `${timeTokens[0]}:${timeTokens[1]}`;
        }
      }
    }

    const total = this.members.length || 1;

    return html`
      <div class="content">
        <div class="main">
          <date-box
            date=${this.event.start}
            @click=${this.handleDateBoxClick}
          ></date-box>

          <div class="info">
            <h3 class="title ${!this.selected ? "truncate-in-summary" : ""}">
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
              <div
                class="meta-item location ${!this.selected
                  ? "truncate-in-summary"
                  : ""}"
              >
                <app-icon icon="place" style="font-size: 16px;"></app-icon>
                <span class="${!this.selected ? "truncate-in-summary" : ""}">
                  ${this.event.location
                    ? html`
                        <a
                          href="http://maps.google.se/maps?q=${encodeURIComponent(
                            this.event.location
                          )}"
                          target="_blank"
                          @click=${(ev: MouseEvent) => {
                            if (this.selected) {
                              ev.stopPropagation();
                            }
                          }}
                          >${this.event.location}</a
                        >
                      `
                    : "-"}
                </span>
              </div>
            </div>
            <div
              class="description ${!this.selected ? "truncate-in-summary" : ""}"
            >
              ${this.event.description
                ? html`
                    ${unsafeHTML(
                      DOMPurify.sanitize(
                        marked.parse(this.event.description) as string
                      )
                    )}
                  `
                : ""}
            </div>
          </div>

          ${!this.selected && !this.cancelled
            ? this.renderResponseStatus()
            : !this.selected
            ? ""
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

        ${this.selected && !this.cancelled
          ? html`
              <div class="roster-section">
                ${this.renderSectionRosters()} ${this.renderComments()}
              </div>
            `
          : ""}
      </div>

      ${this.selected
        ? html`
            <div class="footer">
              ${!this.cancelled
                ? html`
                    <response-card
                      .event=${this.event}
                      uid=${this.effectiveUid}
                      @click=${(ev: Event) => {
                        ev.stopPropagation();
                        const rc = ev.currentTarget as ResponseCard;
                        if (rc.mode === "view") {
                          rc.mode = "edit";
                        }
                      }}
                    ></response-card>
                  `
                : ""}
              <div class="closer" @click=${this.handleClose}>
                <app-icon icon="arrow_drop_up"></app-icon>
              </div>
            </div>
          `
        : ""}

      <app-dialog
        heading="${this.edit_snapshot
          ? "Redigera händelse"
          : this.event?.type || "Händelse"}"
        ?open=${!!this.edit_snapshot}
        @closed=${() => {
          this.edit_snapshot = null;
        }}
        hideCloseButton
      >
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
          : ""}
      </app-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "event-card": EventCard;
  }
}
