import "./event-editor";
import { LitElement, html, css } from "lit";
import { ifDefined } from "lit/directives/if-defined";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { marked } from "marked";
import DOMPurify from "dompurify";
import "./time-range";
import "./mini-roster";
import "./app-button";
import "./app-input";
import "./app-icon";
import "./response-card";
import { auth } from "../storage";
import { EventEditor } from "./event-editor";
import { onSnapshot, setDoc } from "firebase/firestore";
import { customElement, property, query, state } from "lit/decorators.js";
import { UID } from "../datamodel";
import { BandEvent } from "../model/bandevent";
import {
  emptyParticipant,
  Participant,
  ParticipantResponse
} from "../model/participant";
import { Member } from "../model/member";

@customElement("event-card")
export class EventCard extends LitElement {
  @property({ type: Array, attribute: false })
  members: Member[] = [];

  @property({ type: Object, attribute: false })
  event: BandEvent = null;

  @property({ type: Boolean })
  admin: boolean = false;

  @property({ type: Boolean })
  editing: boolean = false;

  @state()
  participants: { [uid: UID]: Participant } = {};

  @property({ type: Boolean, reflect: true })
  get cancelled() {
    return this.event?.cancelled || false;
  }



  @query("event-editor")
  editor: EventEditor;

  cancelParticipantsListener: () => void = () => { };

  needsResponse: boolean = false;

  getMemberData(uid: UID): Member {
    for (const member of this.members) {
      if (member.id == uid) {
        return member;
      }
    }
    return null;
  }

  fetchParticipants() {
    const event = this.event!;
    this.cancelParticipantsListener();
    this.cancelParticipantsListener = onSnapshot(
      event.ref.participants().dbref,
      snapshot => {
        this.participants = {};
        this.needsResponse = true;
        snapshot.docs.forEach(doc => {
          const participant: Participant = doc.data();
          if (participant.uid == auth.currentUser.uid) {
            this.needsResponse = !participant.hasResponded();

          }
          this.participants[participant.uid] = participant;
        });
        // Set defaults for missing responses
        for (const member of this.members) {
          if (!(member.id in this.participants)) {
            this.participants[member.id] = emptyParticipant(member.id);
          }
        }
      }
    );
  }

  updated(changedProperties: any) {
    if (changedProperties.has("event") && this.event) {
      this.fetchParticipants();
    }
  }

  static styles = css`
    :host {
      display: block;
    }

    :host([cancelled]) .header,
    :host([cancelled]) .roster-section {
      opacity: 0.5;
    }

    .header {
      margin-bottom: var(--app-spacing-lg);
    }

    .type {
      font-size: var(--app-font-size-xl);
      font-weight: var(--app-font-weight-bold);
      margin-bottom: var(--app-spacing-xs);
    }

    .meta {
      display: flex;
      flex-direction: column;
      gap: var(--app-spacing-xs);
      color: var(--app-color-text-secondary);
      font-size: var(--app-font-size-sm);
    }

    .meta-row {
      display: flex;
      align-items: center;
      gap: var(--app-spacing-sm);
    }

    .description {
      margin: var(--app-spacing-md) 0;
      line-height: 1.5;
    }



    .roster-section {
      margin-top: var(--app-spacing-lg);
    }

    .roster-title {
      font-weight: var(--app-font-weight-bold);
      margin-bottom: var(--app-spacing-sm);
      display: block;
    }

    .chip {
      display: inline-block;
      padding: 4px 8px;
      border-radius: var(--app-radius-sm);
      font-size: 0.75rem;
      font-weight: bold;
      text-transform: uppercase;
    }

    .chip.cancelled {
      background-color: var(--app-color-text-secondary);
      color: white;
    }

    .admin-actions {
      margin-top: var(--app-spacing-lg);
      padding-top: var(--app-spacing-md);
      // border-top: 1px solid var(--app-color-border);
      display: flex;
      justify-content: flex-end;
    }

    .comments-section {
      margin-top: var(--app-spacing-lg);
    }

    .comment-list {
      display: flex;
      flex-direction: column;
      gap: var(--app-spacing-sm);
    }

    .comment-item {
      display: flex;
      gap: var(--app-spacing-sm);
      font-size: var(--app-font-size-sm);
    }

    .comment-author {
      font-weight: bold;
    }

    .comment-text {
      color: var(--app-color-text-secondary);
    }
  `;

  setResponse(response: ParticipantResponse, comment?: string) {
    const uid = auth.currentUser.uid;
    const ref = this.event.ref.participant(uid);
    let participant = this.participants[uid];
    if (!participant) {
      participant = emptyParticipant(uid);
    }
    participant.attending = response;
    // If a comment is passed, update it. Otherwise keep existing (or empty).
    if (comment !== undefined) {
      participant.comment = comment;
    }

    setDoc(ref.dbref, participant, { merge: false }).then(
      () => console.log("Update successful"),
      reason => console.log("Update failed:", reason)
    );
  }

  handleResponseUpdate(e: CustomEvent) {
    const { response, comment } = e.detail;
    this.setResponse(response, comment);
  }

  async save() {
    if (this.admin && this.editor) {
      if (this.editor.checkValidity()) {
        this.editor.save();
        const ref = this.event.ref;
        await ref.update(this.event);
        console.log("Update successful");
      } else {
        throw new Error("Invalid data");
      }
    }
  }

  renderResponseButtons() {
    const participant = this.participants[auth.currentUser.uid];
    const currentResponse = participant?.attending;
    const currentComment = participant?.comment || "";

    return html`
      <response-card
        .response=${currentResponse}
        .comment=${currentComment}
        @update-response=${this.handleResponseUpdate}
      ></response-card>
    `;
  }

  renderComments() {
    const comments = Object.values(this.participants)
      .filter(p => p.comment && p.comment.trim().length > 0)
      .map(p => {
        const member = this.getMemberData(p.uid);
        return {
          name: member ? member.display_name : "Okänd",
          comment: p.comment,
          uid: p.uid
        };
      });

    if (comments.length === 0) return html``;

    return html`
      <div class="comments-section">
        <div class="comment-list">
          ${comments.map(c => html`
            <div class="comment-item">
              <span class="comment-author">${c.name}:</span>
              <span class="comment-text">${c.comment}</span>
            </div>
          `)}
        </div>
      </div>
    `;
  }

  render() {
    if (!this.event) return html``;

    return html`
      ${this.editing ? html`
        <event-editor .data=${this.event}></event-editor>
      ` : html`
        <div class="header">
          <div class="meta">
            ${this.cancelled ? html`<div class="meta-row">
              <span class="chip cancelled">Inställt</span>
            </div>` : ""}
            <div class="meta-row">
              <app-icon icon="schedule"></app-icon>
              <time-range
                start=${ifDefined(this.event.start)}
                stop=${ifDefined(this.event.stop)}
              ></time-range>
            </div>
            ${this.event.location ? html`
              <div class="meta-row">
                <app-icon icon="place"></app-icon>
                <a href="http://maps.google.se/maps?q=${this.event.location}">${this.event.location}</a>
              </div>
            ` : ""}
          </div>
          ${this.event.description ? html`
            <div class="description">${unsafeHTML(DOMPurify.sanitize(marked.parse(this.event.description) as string))}</div>
          ` : ""}
        </div>
      `}

      ${(!this.cancelled && !this.editing) ? this.renderResponseButtons() : ""}

      <div class="roster-section" style="display: ${(this.cancelled || this.editing) ? "none" : "block"}">
        ${!this.cancelled ? html`
          <span class="roster-title">Vilka kommer?</span>
          <mini-roster
            .members=${this.members}
            .event=${this.event}
            .responses=${Object.fromEntries(Object.entries(this.participants).map(([k, v]) => [k, v.attending]))}
          ></mini-roster>
          ${this.renderComments()}
        ` : ""}
      </div>

      ${this.admin ? html`
        <div class="admin-actions" style="display: ${(this.cancelled || this.editing) ? "none" : "block"}">
          ${this.editing ? "" : html`
            <app-button variant="secondary" icon="edit" @click=${() => this.dispatchEvent(new CustomEvent("edit"))}>Redigera</app-button>
          `}
        </div>
      ` : ""}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "event-card": EventCard;
  }
}
