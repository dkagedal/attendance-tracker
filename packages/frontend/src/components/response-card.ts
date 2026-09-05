import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { onSnapshot } from "firebase/firestore";
import { auth } from "../storage";
import { BandEvent } from "../model/bandevent";
import { ParticipantResponse } from "../model/participant";
import { UID } from "../datamodel";
import "./app-button";
import "./app-input";
import "./app-icon";
import "./response-icon";

@customElement("response-card")
export class ResponseCard extends LitElement {
  @property({ attribute: false })
  event: BandEvent | null = null;

  @property({ type: String })
  uid: UID = "";

  @property({ type: String })
  response: ParticipantResponse | null = null;

  @property({ type: String })
  comment: string = "";

  @property({ type: String, reflect: true })
  mode: "auto" | "view" | "edit" = "auto";

  @query("#comment-input")
  commentInput: HTMLInputElement;

  private _unsubscribe: (() => void) | null = null;

  static styles = css`
    :host {
      display: block;
      &:hover {
        background-color: var(--app-color-surface-hover, rgba(0, 0, 0, 0.05));
      }
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

    .container {
      padding: var(--app-spacing-sm);
    }

    .view-container {
      display: flex;
      align-items: center;
      gap: var(--app-spacing-sm);
      cursor: pointer;
      padding: var(--app-spacing-sm);
      border-radius: var(--app-radius-md);
      transition: background-color 0.2s;
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
    if (this.event) {
      this.subscribeParticipant();
    } else if (this.response && this.response !== "na") {
      this.mode = "view";
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribeParticipant();
  }

  updated(changedProperties: PropertyValues<this>) {
    super.updated(changedProperties);
    if (changedProperties.has("event") || changedProperties.has("uid")) {
      if (this.event) {
        this.subscribeParticipant();
      } else {
        this.unsubscribeParticipant();
      }
    }
  }

  private unsubscribeParticipant() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  }

  private subscribeParticipant() {
    this.unsubscribeParticipant();

    const uid = this.uid || auth?.currentUser?.uid;
    if (!this.event || !this.event.ref || !uid) {
      return;
    }

    const participantRef = this.event.ref.participant(uid);
    this._unsubscribe = onSnapshot(
      participantRef.dbref,
      (snapshot) => {
        if (snapshot.exists()) {
          const participant = snapshot.data();
          this.response = participant.attending;
          this.comment = participant.comment || "";
        } else {
          this.response = "na";
          this.comment = "";
        }

        if (this.mode === "auto") {
          this.mode = this.response && this.response !== "na" ? "view" : "edit";
        }
      },
      (error) => {
        console.error("Failed to subscribe to participant updates:", error);
      }
    );
  }

  private async saveResponse(
    newResponse?: ParticipantResponse,
    newComment?: string
  ) {
    const responseToSave =
      newResponse !== undefined ? newResponse : this.response;
    const commentToSave = newComment !== undefined ? newComment : this.comment;

    const uid = this.uid || auth?.currentUser?.uid;
    if (this.event && this.event.ref && uid) {
      const participantRef = this.event.ref.participant(uid);
      try {
        await participantRef.update({
          attending: responseToSave || "na",
          comment: commentToSave || "",
        });
      } catch (error) {
        console.error("Failed to update participant:", error);
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
    console.log("handleResponseClick", newResponse);
    this.response = newResponse;
    this.mode = "view";
    this.saveResponse(newResponse, this.comment);
    this.requestUpdate();
  }

  private handleCommentBlur() {
    if (this.response || this.comment) {
      this.saveResponse(this.response || "na", this.comment);
    }
  }

  render() {
    if (this.mode === "view") {
      const { text } = this.getIconAndText();
      return html`
          <div class="container view-container">
            <response-icon .response=${this.response}></response-icon>
            <span class="response-text">${text}</span>
            <app-icon
              icon="edit"
              style="color: var(--app-color-text-secondary);"
            ></app-icon>
          </div>
        </div>
      `;
    }

    return html`
      <div class="container">
        <div class="response-buttons">
          <app-button
            variant="${this.response === "yes" ? "primary" : "secondary"}"
            @click=${(ev: Event) => {
              ev.stopPropagation();
              this.handleResponseClick("yes");
            }}
          >
            <response-icon slot="icon" response="yes"></response-icon>
            Kommer
          </app-button>
          <app-button
            variant="${this.response === "sub" ? "primary" : "secondary"}"
            @click=${(ev: Event) => {
              ev.stopPropagation();
              this.handleResponseClick("sub");
            }}
          >
            <response-icon slot="icon" response="sub"></response-icon>
            Vikarie
          </app-button>
          <app-button
            variant="${this.response === "no" ? "primary" : "secondary"}"
            @click=${(ev: Event) => {
              ev.stopPropagation();
              this.handleResponseClick("no");
            }}
          >
            <response-icon slot="icon" response="no"></response-icon>
            Kan inte
          </app-button>
        </div>
        <app-input
          id="comment-input"
          .value=${this.comment}
          @input=${(e: any) => (this.comment = e.target.value)}
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
