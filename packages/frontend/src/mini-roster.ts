import "./response-chip";
import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators";
import { repeat } from "lit/directives/repeat";
import { BandEvent } from "./model/bandevent";
import { ParticipantResponse } from "./model/participant";
import { Member } from "./model/member";

interface Responses {
  [uid: string]: ParticipantResponse;
}

@customElement("mini-roster")
export class MiniRoster extends LitElement {
  @property({ type: Array, attribute: false })
  members: Member[] = [];

  @property({ type: Object, attribute: false })
  event: BandEvent = null;

  @property({ type: Object, attribute: false })
  responses = {} as Responses;

  static get styles() {
    return css`
      :host {
        display: flex;
        flex-wrap: wrap;
        align-content: flex-start;
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
    if (this.event.cancelled) {
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
            >${member.display_name}</response-chip
          >
        `
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
