import { LitElement, html, css, query } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';

class MiniRoster extends LitElement {
  static get properties() {
    return {
      members: { type: Array, attribute: false }, // [DocumentSnapshot]
      event: { type: Object, attribute: false },  // DocumentSnapshot
      responses: { type: Object, attribute: false },
    }
  }

  constructor() {
    super();
    this.members = [];
    this.event = null;
    this.responses = [];
  }

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
    `;
  }

  render() {
    return html`
        ${repeat(this.members, member => member.id, member => {
      return html`<span title=${member.data().display_name} class=${this.responses[member.id] || 'unknown'}></span>`;
    })}
    `;
  }
}

customElements.define('mini-roster', MiniRoster);
