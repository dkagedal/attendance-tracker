import { LitElement, html, css } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import "./app-button";

@customElement("app-menu")
export class AppMenu extends LitElement {
  @property({ type: String })
  icon = "more_vert";

  @property({ type: String })
  triggerVariant: "primary" | "secondary" | "text" | "icon" = "icon";

  @property({ type: String })
  triggerStyle = "";

  @query(".menu-popover")
  private popoverElement!: HTMLElement;

  static styles = css`
    :host {
      display: inline-block;
      position: relative;
    }

    .menu-container {
      position: relative;
      display: inline-block;
      anchor-name: --menu-anchor;
    }

    .menu-popover {
      margin: 0;
      border: none;
      inset: auto;
      padding: var(--app-spacing-xs) 0;
      background: var(--app-color-surface);
      border-radius: var(--app-radius-md);
      box-shadow: var(--app-shadow-lg);
      min-width: 200px;
      z-index: 1000;
      color: var(--app-color-text);
      overflow: visible;

      /* Position relative to anchor */
      position: absolute;
      position-anchor: --menu-anchor;
      top: anchor(bottom);
      right: anchor(right);

      /* Entry and Exit Animations */
      opacity: 0;
      transform: scale(0.95);
      transition: opacity 0.15s ease-out, transform 0.15s ease-out,
        display 0.15s ease-out allow-discrete, overlay 0.15s ease-out allow-discrete;
    }

    .menu-popover:popover-open {
      opacity: 1;
      transform: scale(1);
    }

    @starting-style {
      .menu-popover:popover-open {
        opacity: 0;
        transform: scale(0.95);
      }
    }

    /* Slotted Styling */
    ::slotted(.menu-item) {
      padding: var(--app-spacing-sm) var(--app-spacing-md);
      display: flex !important;
      align-items: center;
      gap: var(--app-spacing-sm);
      cursor: pointer;
      transition: background-color 0.2s;
      font-size: var(--app-font-size-md);
      color: var(--app-color-text);
      text-decoration: none;
      box-sizing: border-box;
    }

    ::slotted(.menu-item:hover) {
      background-color: var(--app-color-background);
    }

    ::slotted(.menu-divider) {
      height: 1px;
      background-color: var(--app-color-border);
      margin: var(--app-spacing-xs) 0;
    }

    ::slotted(.menu-item.delete) {
      background-color: var(--app-color-red-700) !important;
      color: white !important;
    }

    ::slotted(.menu-item.delete:hover) {
      background-color: var(--app-color-red-800) !important;
    }
  `;

  firstUpdated() {
    this.popoverElement.addEventListener("beforetoggle", (event: any) => {
      if (event.newState === "open") {
        this.positionFallback();
      }
    });
  }

  toggle(e: Event) {
    e.stopPropagation();
    try {
      (this.popoverElement as any).togglePopover();
    } catch (err) {
      console.warn("Failed to toggle popover programmatically:", err);
    }
  }

  close() {
    try {
      (this.popoverElement as any).hidePopover();
    } catch (err) {
      console.warn("Failed to close popover programmatically:", err);
    }
  }

  private positionFallback() {
    // If browser lacks CSS Anchor Positioning, apply fallback positioning
    const supportsAnchor = window.CSS && CSS.supports("anchor-name", "--foo");
    if (!supportsAnchor) {
      const trigger = this.shadowRoot?.querySelector("app-button");
      if (trigger) {
        const rect = trigger.getBoundingClientRect();
        this.popoverElement.style.position = "fixed";
        this.popoverElement.style.margin = "0";
        this.popoverElement.style.inset = "auto";
        this.popoverElement.style.top = `${rect.bottom}px`;
        
        // Use requestAnimationFrame/setTimeout to ensure the popover is displayed
        // so offsetWidth is accurate.
        requestAnimationFrame(() => {
          const menuWidth = this.popoverElement.offsetWidth || 200;
          this.popoverElement.style.left = `${rect.right - menuWidth}px`;
        });
      }
    }
  }

  render() {
    return html`
      <div class="menu-container">
        <app-button
          variant=${this.triggerVariant}
          icon=${this.icon}
          style=${this.triggerStyle}
          @click=${this.toggle}
        ></app-button>
        <div class="menu-popover" popover id="menu-popover">
          <slot></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "app-menu": AppMenu;
  }
}
