import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ParticipantResponse } from "../model/participant";
import "./app-icon";

@customElement("response-icon")
export class ResponseIcon extends LitElement {
    @property({ type: String })
    response: ParticipantResponse | null = null;

    static styles = css`
    :host {
      align-items: center;
      vertical-align: middle;
    }

    .icon {
      font-size: inherit;
    }

    .icon.yes { color: var(--app-color-success); }
    .icon.no { color: var(--app-color-error); }
    .icon.sub { color: var(--app-color-warning); }
    .icon.na { color: var(--app-color-text-secondary); opacity: 0.5; }
  `;

    render() {
        let icon = "help_outline";
        let iconClass = "na";

        switch (this.response) {
            case "yes":
                icon = "check_circle";
                iconClass = "yes";
                break;
            case "no":
                icon = "cancel";
                iconClass = "no";
                break;
            case "sub":
                icon = "swap_horiz";
                iconClass = "sub";
                break;
            case "na":
            default:
                icon = "help_outline";
                iconClass = "na";
                break;
        }

        return html`<app-icon icon="${icon}" class="icon ${iconClass}"></app-icon>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        "response-icon": ResponseIcon;
    }
}
