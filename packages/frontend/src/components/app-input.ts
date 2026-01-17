import { LitElement, html, css } from "lit";
import { customElement, property, query } from "lit/decorators.js";

@customElement("app-input")
export class AppInput extends LitElement {
  @property({ type: String })
  label = "";

  @property({ type: String })
  value = "";

  @property({ type: String })
  type = "text";

  @property({ type: String })
  placeholder = "";

  @property({ type: String })
  errorMessage = "";

  @property({ type: Boolean })
  disabled = false;

  @property({ type: Boolean })
  required = false;

  @query("input")
  inputElement: HTMLInputElement;

  static styles = css`
    :host {
      display: block;
      margin-bottom: var(--app-spacing-md);
    }

    .label {
      display: block;
      font-size: var(--app-font-size-sm);
      font-weight: var(--app-font-weight-medium);
      color: var(--app-color-text);
      margin-bottom: var(--app-spacing-xs);
    }

    input {
      box-sizing: border-box;
      width: 100%;
      padding: var(--app-spacing-sm) var(--app-spacing-md);
      font-family: var(--app-font-family);
      font-size: var(--app-font-size-base);
      color: var(--app-color-text);
      background-color: var(--app-color-surface);
      border: 1px solid var(--app-color-border);
      border-radius: var(--app-radius-md);
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    input:focus {
      border-color: var(--app-color-primary);
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
    }

    input:disabled {
      background-color: var(--app-color-background);
      cursor: not-allowed;
      opacity: 0.7;
    }

    .error-message {
      font-size: var(--app-font-size-sm);
      color: var(--app-color-error);
      margin-top: var(--app-spacing-xs);
    }

    :host([invalid]) input {
      border-color: var(--app-color-error);
    }
  `;

  render() {
    return html`
      ${this.label ? html`<label class="label">${this.label}</label>` : ""}
      <input
        type="${this.type}"
        .value="${this.value}"
        placeholder="${this.placeholder}"
        ?disabled="${this.disabled}"
        ?required="${this.required}"
        @input="${this.handleInput}"
      />
      ${this.errorMessage
        ? html`<div class="error-message">${this.errorMessage}</div>`
        : ""}
    `;
  }

  private handleInput(e: Event) {
    const input = e.target as HTMLInputElement;
    this.value = input.value;
    this.dispatchEvent(new CustomEvent("input", { bubbles: true, composed: true }));
    this.dispatchEvent(new CustomEvent("change", { bubbles: true, composed: true }));
  }

  checkValidity() {
    return this.inputElement ? this.inputElement.checkValidity() : true;
  }

  reportValidity() {
    return this.inputElement ? this.inputElement.reportValidity() : true;
  }
}
