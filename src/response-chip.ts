import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators";

@customElement("response-chip")
export class ResponseChip extends LitElement {
  @property({ type: String })
  response: string = null;

  static get styles() {
    return css`
      :host {
        font-size: 0.7rem;
        width: 5em;
        height: 1.2em;
        margin: 1px;
        padding: 1px;
        border: 1px solid rgba(0 0 0 / 20%);
        border-radius: 3px;
        cursor: pointer;
        white-space: nowrap;
        overflow: hidden;
        text-align: center;
        text-overflow: clip;
        color: rgba(0, 0, 0, 0.54);
        transition: background 0.4s;
      }

      :host([response="yes"]) {
        background: rgba(0 200 0 / 50%);
        border-width: 2px;
        padding: 0;
      }

      :host([response="no"]) {
        background: rgb(200 0 0 / 50%);
        border-width: 2px;
        padding: 0;
      }

      :host([response="sub"]) {
        background: rgb(0 0 0 / 20%);
        border-width: 2px;
        padding: 0;
      }
    `;
  }

  render() {
    return html`
      <slot></slot>
    `;
  }
}
