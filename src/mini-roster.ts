import { BandEvent, ParticipantResponse } from "./storage";
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
      }
      span {
        flex: 1 1 8px;
        height: 1.2em;
        margin: 1px;
        border: inset 1px;
        box-shadow: inset 0 0 2px 1px rgba(0, 0, 0, 0.3);
        cursor: pointer;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: clip;
        font-size: 0.7rem;
        color: rgba(0, 0, 0, 0.54);
      }
      .yes {
        background: rgb(139 195 74);
      }
      .maybe {
        background: lightgray;
      }
      .unknown {
        background: white;
      }
      .no {
        background: rgb(255, 87, 34);
      }
      .sub {
        background: rgb(255 235 59);
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
        member => {
          const data = member.data();
          return html`
            <span
              title=${data.display_name}
              class=${this.responses[member.id] || "unknown"}
              @click=${() => this.clickOne(member.id)}
              >${data.display_name}</span
            >
          `;
        }
      )}
    `;
  }

  clickOne(uid: string) {
    console.log("Clicked", uid);
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
