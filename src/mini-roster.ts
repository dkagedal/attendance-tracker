import { LitElement, html, css, property, customElement } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat';

interface Member {
  display_name: string,
}

type ParticipantResponse = "yes" | "no" | "maybe" | "sub" | null

interface Responses {
  [uid: string]: ParticipantResponse
}

@customElement("mini-roster")
export class MiniRoster extends LitElement {
  @property({ type: Array, attribute: false })
  members: firebase.firestore.DocumentSnapshot[] = []

  @property({ type: Object, attribute: false })
  event: firebase.firestore.DocumentSnapshot | null = null

  @property({ type: Object, attribute: false })
  responses = {} as Responses

  static get styles() {
    return css`
      :host {
        display: flex;
      }
      span {
        flex: 1 1 8px;
        height: 8px;
        margin: 1px;
        border: inset 1px;
        box-shadow: inset 0 0 2px 1px rgba(0, 0, 0, 0.3);
      }
      .yes {
        background: rgb(139 195 74)
      }
      .maybe {
        background: lightgray
        }
      .unknown {
        background: white
      }
      .no {
        background: rgb(255, 87, 34)
      }
      .sub {
        background: rgb(255 235 59)
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
      return html`<p class="cancelled">I N S T Ä L L T</p>`;
    }
    return html`
        ${repeat(this.members, member => member.id, member => {
      const data = member.data() as Member
      return html`<span title=${data.display_name} class=${this.responses[member.id] || 'unknown'}></span>`;
    })}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mini-roster': MiniRoster;
  }
}