import { LitElement, html, css } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { ParticipantResponse } from "../model/participant";
import "./app-button";
import "./app-input";
import "./app-icon";
import "./response-icon";

@customElement("response-card")
export class ResponseCard extends LitElement {
    @property({ type: String })
    response: ParticipantResponse | null = null;

    @property({ type: String })
    comment: string = "";

    @property({ type: String })
    mode: "view" | "edit" = "edit";

    @query("#comment-input")
    commentInput: HTMLInputElement;

    static styles = css`
    :host {
      display: block;
    }

    .response-section {
      background-color: var(--app-color-background);
      padding: var(--app-spacing-md);
      border-radius: var(--app-radius-md);
      margin-bottom: var(--app-spacing-lg);
    }

    .response-title {
      font-weight: var(--app-font-weight-bold);
      margin-bottom: var(--app-spacing-sm);
      display: block;
    }

    .response-buttons {
      display: flex;
      gap: var(--app-spacing-sm);
      flex-wrap: wrap;
    }

    /* View Mode Styles */
    .view-container {
      display: flex;
      align-items: center;
      gap: var(--app-spacing-sm);
      cursor: pointer;
      padding: var(--app-spacing-sm);
      border-radius: var(--app-radius-md);
      transition: background-color 0.2s;
    }

    .view-container:hover {
      background-color: var(--app-color-surface-hover, rgba(0, 0, 0, 0.05));
    }

    .response-icon {
      /* font-size: 24px; - handled by component */
    }
    /* Colors handled by component */

    .response-text {
      flex: 1;
      font-size: var(--app-font-size-base);
      color: var(--app-color-text);
    }
  `;

    connectedCallback() {
        super.connectedCallback();
        if (this.response) {
            this.mode = "view";
        }
    }

    updated(changedProperties: Map<string, any>) {
        if (changedProperties.has("response")) {
            if (this.response && changedProperties.get("response") === undefined) {
                // Initial load with response, set view mode
                this.mode = "view";
            }
        }
    }

    private getIconAndText() {
        let text = "Inget svar";

        switch (this.response) {
            case "yes":
                text = "Kommer";
                break;
            case "no":
                text = "Kan inte";
                break;
            case "sub":
                text = "Vikarie";
                break;
        }

        if (this.comment) {
            text = this.comment;
        }

        return { text };
    }

    private handleResponseClick(newResponse: ParticipantResponse) {
        this.response = newResponse;
        const detail = {
            response: this.response,
            comment: this.comment
        };
        this.dispatchEvent(new CustomEvent("update-response", { detail }));
        this.mode = "view";
    }

    private handleCommentBlur() {
        // If we have a response, we can auto-save/update
        if (this.response) {
            const detail = {
                response: this.response,
                comment: this.comment
            };
            this.dispatchEvent(new CustomEvent("update-response", { detail }));
        }
    }

    render() {
        if (this.mode === "view" && this.response) {
            const { text } = this.getIconAndText();
            return html`
        <div class="response-section" @click=${() => this.mode = "edit"}>
          <span class="response-title">Ditt svar</span>
          <div class="view-container">
            <response-icon .response=${this.response}></response-icon>
            <span class="response-text">${text}</span>
            <app-icon icon="edit" style="color: var(--app-color-text-secondary);"></app-icon>
          </div>
        </div>
      `;
        }

        return html`
      <div class="response-section">
        <span class="response-title">Ditt svar</span>
        <div class="response-buttons">
          <app-button 
            variant="${this.response === 'yes' ? 'primary' : 'secondary'}"
            @click=${() => this.handleResponseClick('yes')}
          >
            <response-icon slot="icon" response="yes" style="font-size: 20px;"></response-icon>
            Kommer
          </app-button>
          <app-button 
            variant="${this.response === 'sub' ? 'primary' : 'secondary'}"
            @click=${() => this.handleResponseClick('sub')}
          >
            <response-icon slot="icon" response="sub" style="font-size: 20px;"></response-icon>
            Vikarie
          </app-button>
          <app-button 
            variant="${this.response === 'no' ? 'primary' : 'secondary'}"
            @click=${() => this.handleResponseClick('no')}
          >
            <response-icon slot="icon" response="no" style="font-size: 20px;"></response-icon>
            Kan inte
          </app-button>
        </div>
        <app-input
          id="comment-input"
          .value=${this.comment}
          @input=${(e: any) => this.comment = e.target.value}
          @focusout=${() => this.handleCommentBlur()}
          placeholder="T.ex. kommer sent, tar med noter..."
          style="margin-top: var(--app-spacing-md);"
        ></app-input>
      </div>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "response-card": ResponseCard;
    }
}
