import "./event-editor";
import { LitElement, html, css } from "lit";
import { ifDefined } from "lit/directives/if-defined";
import "./time-range";
import "./mini-roster";
import "./components/app-button";
import "./components/app-icon";
import { auth } from "./storage";
import { EventEditor } from "./event-editor";
import { onSnapshot, setDoc } from "firebase/firestore";
import { customElement, property, query, state } from "lit/decorators";
import { UID } from "./datamodel";
import { BandEvent } from "./model/bandevent";
import {
  emptyParticipant,
  Participant,
  ParticipantResponse
} from "./model/participant";
import { Member } from "./model/member";

@customElement("event-card")
export class EventCard extends LitElement {
  @property({ type: Array, attribute: false })
  members: Member[] = [];

  @property({ type: Object, attribute: false })
  event: BandEvent = null;

  @state()
  participants: { [uid: UID]: Participant } = {};

  @property({ type: Boolean, reflect: true })
  get cancelled() {
    return this.event.cancelled;
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

    .response-section {
      background-color: var(--app-color-background);
      padding: var(--app-spacing-md);
      border-radius: var(--app-radius-md);
      margin-bottom: var(--app-spacing-lg);
    }

    .response-title {
      font-weight: var(--app-font-weight-bold);
      margin-bottom: var(--app-spacing-sm);
      display: block;
    }

    .response-buttons {
      display: flex;
      gap: var(--app-spacing-sm);
      flex-wrap: wrap;
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
      background-color: var(--app-color-error);
      color: white;
    }
  `;

  setResponse(response: ParticipantResponse) {
    const uid = auth.currentUser.uid;
    const ref = this.event.ref.participant(uid);
    let participant = this.participants[uid];
    if (!participant) {
      participant = emptyParticipant(uid);
    }
    participant.attending = response;

    setDoc(ref.dbref, participant, { merge: false }).then(
      () => console.log("Update successful"),
      reason => console.log("Update failed:", reason)
    );
  }

  renderResponseButtons() {
    const currentResponse = this.participants[auth.currentUser.uid]?.attending;

    return html`
      <div class="response-section">
        <span class="response-title">Ditt svar</span>
        <div class="response-buttons">
          <app-button 
            variant="${currentResponse === 'yes' ? 'primary' : 'secondary'}"
            @click=${() => this.setResponse('yes')}
          >
            Kommer
          </app-button>
          <app-button 
            variant="${currentResponse === 'sub' ? 'primary' : 'secondary'}"
            @click=${() => this.setResponse('sub')}
          >
            Vikarie
          </app-button>
          <app-button 
            variant="${currentResponse === 'no' ? 'primary' : 'secondary'}"
            @click=${() => this.setResponse('no')}
          >
            Kan inte
          </app-button>
        </div>
      </div>
    `;
  }

  render() {
    if (!this.event) return html``;

    return html`
      <div class="header">
        <div class="type">
          ${this.cancelled ? html`<span class="chip cancelled">Inställt</span>` : ""}
        </div>
        <div class="meta">
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
              <span>${this.event.location}</span>
            </div>
          ` : ""}
        </div>
        ${this.event.description ? html`
          <div class="description">${this.event.description}</div>
        ` : ""}
      </div>

      ${!this.cancelled ? this.renderResponseButtons() : ""}

      <div class="roster-section">
        <span class="roster-title">Vilka kommer?</span>
        <mini-roster
          .members=${this.members}
          .event=${this.event}
          .responses=${Object.fromEntries(Object.entries(this.participants).map(([k, v]) => [k, v.attending]))}
        ></mini-roster>
      </div>
    `;
  }
}
