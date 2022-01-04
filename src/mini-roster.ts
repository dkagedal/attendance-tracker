
import "./response-chip";import { BandEvent, ParticipantResponse } from "./storage";
import { DocumentSnapshot, QueryDocumentSnapshot } from "firebase/firestore";
import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators";
import {repeat} from 'lit/directives/repeat';

interface Member {
  display_name: string;
}

interface Responses {
  [uid: string]: ParticipantResponse;
}

@customElement("mini-roster")
export class MiniRoster extends LitElement {
  @property({ type: Array, attribute: false })
  members: QueryDocumentSnapshot<Member>[] = [];

  @property({ type: Object, attribute: false })
  event: DocumentSnapshot<BandEvent> | null = null;

  @property({ type: Object, attribute: false })
  responses = {} as Responses;

  static get styles() {
    return css`
      :host {
        display: flex;
        flex-wrap: wrap;
      }
      .cancelled {
        background: rgb(255, 87, 34);
        color: white;
        text-align: center;
        font-weight: 600;
        font-stretch: expanded;
        margin: 0;
        width: 100%;
      }
    `;
  }

  render() {
    if (this.event.data().cancelled) {
      return html`
        <p class="cancelled">I N S T Ä L L T</p>
      `;
    }
    return html`
      ${repeat(
        this.members,
        member => member.id,
        member => html`
          <response-chip 
            response=${this.responses[member.id]}
            @click=${() => this.clickOne(member.id)}
          >${member.data().display_name}</response-chip>`
      )}
    `;
  }

  clickOne(uid: string) {
    let event = new CustomEvent("click-participant", {
      detail: {
        uid: uid
      }
    });
    this.dispatchEvent(event);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mini-roster": MiniRoster;
  }
}
