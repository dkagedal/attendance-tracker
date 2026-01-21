import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("app-button")
export class AppButton extends LitElement {
  @property({ type: String })
  variant: "primary" | "secondary" | "text" | "icon" = "primary";

  @property({ type: Boolean })
  disabled = false;

  @property({ type: String })
  icon = "";

  static styles = css`
    :host {
      display: inline-block;
    }

    button {
      font-family: var(--app-font-family);
      font-size: var(--app-font-size-sm);
      font-weight: var(--app-font-weight-medium);
      border-radius: var(--app-radius-md);
      border: none;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--app-spacing-sm);
      padding: var(--app-spacing-sm) var(--app-spacing-md);
      transition: background-color 0.2s, color 0.2s, opacity 0.2s;
      outline: none;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Primary */
    button.primary {
      background: var(--app-color-primary-gradient);
      color: white;
    }
    button.primary:hover:not(:disabled) {
      background-color: var(--app-color-primary-dark);
    }

    /* Secondary */
    button.secondary {
      background-color: white;
      color: var(--app-color-text);
      border: 1px solid var(--app-color-border);
    }
    button.secondary:hover:not(:disabled) {
      background-color: var(--app-color-background);
    }

    /* Text */
    button.text {
      background-color: transparent;
      color: var(--app-color-primary);
      padding: var(--app-spacing-sm);
    }
    button.text:hover:not(:disabled) {
      background-color: rgba(37, 99, 235, 0.1); /* Primary with opacity */
    }

    /* Icon */
    button.icon {
      background-color: transparent;
      color: var(--app-color-text-secondary);
      padding: var(--app-spacing-sm);
      border-radius: var(--app-radius-full);
    }
    button.icon:hover:not(:disabled) {
      background-color: rgba(0, 0, 0, 0.05);
      color: var(--app-color-text);
    }

    .material-icons {
      font-family: "Material Icons";
      font-weight: normal;
      font-style: normal;
      font-size: var(--app-font-size-sm);
      display: inline-block;
      line-height: 1;
      text-transform: none;
      letter-spacing: normal;
      word-wrap: normal;
      white-space: nowrap;
      direction: ltr;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      -moz-osx-font-smoothing: grayscale;
      font-feature-settings: "liga";
    }
  `;

  render() {
    return html`
      <button
        class="${this.variant}"
        ?disabled=${this.disabled}
        @click=${this.handleClick}
      >
        ${this.icon
        ? html`<span class="material-icons">${this.icon}</span>`
        : html`<slot name="icon"></slot>`}
        <slot></slot>
      </button>
    `;
  }

  private handleClick(e: Event) {
    if (this.disabled) {
      e.stopPropagation();
      e.preventDefault();
    }
  }
}
