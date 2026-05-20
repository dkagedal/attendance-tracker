import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
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

  @query("dialog")
  private dialogElement!: HTMLDialogElement;

  static styles = css`
    :host {
      display: block;
    }

    dialog {
      border: none;
      padding: 0;
      background-color: var(--app-color-surface);
      border-radius: var(--app-radius-lg);
      box-shadow: var(--app-shadow-lg);
      width: 90%;
      max-width: 500px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      color: inherit;
      margin: auto;
      overflow: visible;

      /* Entry and Exit Animations */
      opacity: 0;
      transform: scale(0.9);
      transition: opacity 0.2s ease, transform 0.2s ease,
        display 0.2s ease allow-discrete, overlay 0.2s ease allow-discrete;
    }

    dialog[open] {
      opacity: 1;
      transform: scale(1);
    }

    @starting-style {
      dialog[open] {
        opacity: 0;
        transform: scale(0.9);
      }
    }

    dialog::backdrop {
      background-color: rgba(0, 0, 0, 0);
      transition: background-color 0.2s ease, display 0.2s ease allow-discrete,
        overlay 0.2s ease allow-discrete;
    }

    dialog[open]::backdrop {
      background-color: rgba(0, 0, 0, 0.5);
    }

    @starting-style {
      dialog[open]::backdrop {
        background-color: rgba(0, 0, 0, 0);
      }
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
      flex-direction: row-reverse;
      flex-wrap: wrap-reverse;
      justify-content: flex-start;
      gap: var(--app-spacing-md);
      border-top: 1px solid var(--app-color-border);
    }
  `;

  protected updated(changedProperties: PropertyValues) {
    if (changedProperties.has("open")) {
      const dialog = this.dialogElement;
      if (dialog) {
        if (this.open) {
          if (!dialog.open) {
            try {
              dialog.showModal();
            } catch (e) {
              console.warn("Failed to show dialog modal:", e);
            }
          }
        } else {
          if (dialog.open) {
            try {
              dialog.close();
            } catch (e) {
              console.warn("Failed to close dialog:", e);
            }
          }
        }
      }
    }
  }

  render() {
    return html`
      <dialog
        closedby="any"
        aria-labelledby="dialog-title"
        @close=${this.handleNativeClose}
        @click=${this.handleDialogClick}
      >
        <div class="header">
          <h2 id="dialog-title" class="title">${this.heading}</h2>
          <div
            style="display: flex; align-items: center; gap: var(--app-spacing-sm);"
          >
            <slot name="headerActions"></slot>
            ${!this.hideCloseButton
              ? html`
                  <app-button
                    variant="icon"
                    icon="close"
                    @click=${this.close}
                  ></app-button>
                `
              : ""}
          </div>
        </div>
        <div class="content">
          <slot></slot>
        </div>
        <div class="actions">
          <slot name="primaryAction"></slot>
          <slot name="secondaryAction"></slot>
        </div>
      </dialog>
    `;
  }

  private handleNativeClose() {
    if (this.open) {
      this.open = false;
      this.dispatchEvent(new CustomEvent("closed"));
    }
  }

  private handleDialogClick(event: MouseEvent) {
    if ("closedBy" in HTMLDialogElement.prototype) return;

    const dialog = event.currentTarget as HTMLDialogElement;
    if (event.target !== dialog) return;

    const rect = dialog.getBoundingClientRect();
    const isDialogContent =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;

    if (isDialogContent) return;

    this.close();
  }

  close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent("closed"));
  }

  show() {
    this.open = true;
  }
}
