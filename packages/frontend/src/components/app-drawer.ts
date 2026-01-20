import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("app-drawer")
export class AppDrawer extends LitElement {
    @property({ type: Boolean })
    open = false;

    static styles = css`
    :host {
      display: block;
    }

    .drawer-container {
      position: fixed;
      top: 0;
      left: 0;
      height: 100%;
      z-index: 1000;
      display: flex;
      pointer-events: none; /* Let clicks pass through when closed */
    }

    .drawer-container.open {
      pointer-events: auto;
    }

    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      opacity: 0;
      transition: opacity 0.3s ease;
      pointer-events: none;
    }

    .drawer-container.open .overlay {
      opacity: 1;
      pointer-events: auto;
    }

    .drawer {
      background-color: var(--app-color-surface);
      width: 280px;
      height: 100%;
      box-shadow: var(--app-shadow-lg);
      transform: translateX(-100%);
      transition: transform 0.3s ease;
      display: flex;
      flex-direction: column;
      pointer-events: auto; /* Always capture clicks on the drawer itself */
    }

    .drawer-container.open .drawer {
      transform: translateX(0);
    }

    .header {
      padding: var(--app-spacing-lg);
      border-bottom: 1px solid var(--app-color-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .content {
      flex: 1;
      overflow-y: auto;
      padding: var(--app-spacing-md);
    }
  `;

    render() {
        return html`
      <div class="drawer-container ${this.open ? "open" : ""}">
        <div class="overlay" @click=${this.close}></div>
        <div class="drawer">
          <div class="header">
            <slot name="header"></slot>
          </div>
          <div class="content">
            <slot></slot>
          </div>
        </div>
      </div>
    `;
    }

    close() {
        this.open = false;
        this.dispatchEvent(new CustomEvent("close"));
    }
}
