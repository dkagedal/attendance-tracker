import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import "./app-button";
import "./app-icon";

@customElement("app-dialog")
export class AppDialog extends LitElement {
  @property({ type: Boolean })
  open = false;

  @property({ type: String })
  heading = "";

  @property({ type: Boolean })
  hideCloseButton = false;

  static styles = css`
    :host {
      display: block;
    }

    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 1001;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
    }

    .overlay.open {
      opacity: 1;
      pointer-events: auto;
    }

    .dialog {
      background-color: var(--app-color-surface);
      border-radius: var(--app-radius-lg);
      box-shadow: var(--app-shadow-lg);
      width: 90%;
      max-width: 500px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
    }

    .overlay.open .dialog {
      /* transform: scale(1); */
    }

    .header {
      padding: var(--app-spacing-lg);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .title {
      margin: 0;
      font-size: var(--app-font-size-xl);
      font-weight: var(--app-font-weight-bold);
    }

    .content {
      padding: 0 var(--app-spacing-lg) var(--app-spacing-lg);
      overflow-y: auto;
    }

    .actions {
      padding: var(--app-spacing-lg);
      display: flex;
      justify-content: flex-end;
      gap: var(--app-spacing-md);
      border-top: 1px solid var(--app-color-border);
    }
  `;

  render() {
    return html`
      <div class="overlay ${this.open ? "open" : ""}" @click=${this.handleOverlayClick}>
        <div class="dialog">
          <div class="header">
            <h2 class="title">${this.heading}</h2>
            ${!this.hideCloseButton
        ? html`<app-button variant="icon" icon="close" @click=${this.close}></app-button>`
        : ""}
          </div>
          <div class="content">
            <slot></slot>
          </div>
          <div class="actions">
            <slot name="primaryAction"></slot>
            <slot name="secondaryAction"></slot>
          </div>
        </div>
      </div>
    `;
  }

  handleOverlayClick(e: Event) {
    if (e.target === e.currentTarget) {
      this.close();
    }
  }

  close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent("closed"));
  }

  show() {
    this.open = true;
  }
}
