import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("app-toast")
export class AppToast extends LitElement {
  @property({ type: Boolean, reflect: true })
  error: boolean = false;

  static styles = css`
    :host {
      display: flex;
      background: var(--app-color-amber-100);
      border-radius: var(--app-radius-lg);
      box-shadow: var(--app-shadow-sm);
      padding: var(--app-spacing-md);
      margin-bottom: var(--app-spacing-md);
      transition: box-shadow 0.2s ease-in-out, transform 0.2s ease-in-out;
      border: 1px solid var(--app-color-amber-300);
      align-items: center;
      justify-content: space-between;
      gap: var(--app-spacing-md);
      flex-wrap: wrap;
      text-align: left;
    }

    .toast-content {
      flex-grow: 1;
    }

    .toast-actions {
      display: flex;
      gap: var(--app-spacing-sm);
    }

    :host([error]) {
      background: var(--app-color-red-100);
      border-color: var(--app-color-red-300);
      flex-direction: column;
      justify-content: center;
      text-align: center;
    }
  `;

  render() {
    return html`
      <span class="toast-content">
        <slot></slot>
      </span>
      <div class="toast-actions">
        <slot name="actions"></slot>
      </div>
    `;
  }
}
