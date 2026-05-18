import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("app-card")
export class AppCard extends LitElement {
  @property({ type: Boolean, reflect: true })
  clickable = false;

  @property({ type: Boolean, reflect: true })
  disabled = false;

  static styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      background-color: var(--app-color-surface);
      border-radius: var(--app-radius-lg);
      box-shadow: var(--app-shadow-sm);
      padding: var(--app-spacing-md);
      transition: box-shadow 0.2s ease-in-out, transform 0.2s ease-in-out;
      border: 1px solid var(--app-color-border);
    }

    :host([clickable]) {
      cursor: pointer;
    }

    :host([clickable]:hover) {
      box-shadow: var(--app-shadow-md);
      transform: translateY(-1px);
    }

    :host([clickable]:active) {
      transform: translateY(0);
      box-shadow: var(--app-shadow-sm);
    }

    :host([disabled]) {
      opacity: 0.6;
      filter: grayscale(1);
      cursor: not-allowed;
      pointer-events: none;
    }
  `;

  render() {
    return html` <slot></slot> `;
  }
}
