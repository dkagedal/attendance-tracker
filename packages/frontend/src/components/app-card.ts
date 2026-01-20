import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("app-card")
export class AppCard extends LitElement {
  @property({ type: Boolean })
  clickable = false;

  @property({ type: Boolean, reflect: true })
  disabled = false;

  static styles = css`
    :host {
      display: block;
    }

    .card {
      background-color: var(--app-color-surface);
      border-radius: var(--app-radius-lg);
      box-shadow: var(--app-shadow-sm);
      padding: var(--app-spacing-md);
      transition: box-shadow 0.2s ease-in-out, transform 0.2s ease-in-out;
      border: 1px solid var(--app-color-border);
    }

    .card.clickable {
      cursor: pointer;
    }

    .card.clickable:hover {
      box-shadow: var(--app-shadow-md);
      transform: translateY(-1px);
    }

    .card.clickable:active {
      transform: translateY(0);
      box-shadow: var(--app-shadow-sm);
    }

    :host([disabled]) .card {
      opacity: 0.6;
      filter: grayscale(1);
      cursor: not-allowed;
      pointer-events: none;
    }
  `;

  render() {
    return html`
      <div class="card ${this.clickable ? "clickable" : ""}">
        <slot></slot>
      </div>
    `;
  }
}
