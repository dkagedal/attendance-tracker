import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("app-switch")
export class AppSwitch extends LitElement {
    @property({ type: Boolean })
    selected = false;

    @property({ type: Boolean })
    disabled = false;

    static styles = css`
    :host {
      display: inline-block;
      vertical-align: middle;
    }

    .switch {
      position: relative;
      display: inline-block;
      width: 40px;
      height: 24px;
    }

    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .slider {
      position: absolute;
      cursor: pointer;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: var(--app-color-border);
      transition: .4s;
      border-radius: 24px;
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }

    input:checked + .slider {
      background-color: var(--app-color-primary);
    }

    input:focus + .slider {
      box-shadow: 0 0 1px var(--app-color-primary);
    }

    input:checked + .slider:before {
      transform: translateX(16px);
    }

    input:disabled + .slider {
      background-color: var(--app-color-background);
      cursor: not-allowed;
    }
  `;

    render() {
        return html`
      <label class="switch">
        <input 
          type="checkbox" 
          ?checked=${this.selected} 
          ?disabled=${this.disabled}
          @change=${this.handleChange}
        >
        <span class="slider"></span>
      </label>
    `;
    }

    private handleChange(e: Event) {
        const checkbox = e.target as HTMLInputElement;
        this.selected = checkbox.checked;
        this.dispatchEvent(new CustomEvent("change", { bubbles: true, composed: true }));
        // Dispatch 'click' as well to mimic MWC behavior if needed, but 'change' is better.
        // MWC switch dispatches 'change' and 'click'.
    }
}
