import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { BandEvent } from "../model/bandevent";
import { Member } from "../model/member";
import { Participant } from "../model/participant";
import { onSnapshot } from "firebase/firestore";
import "./app-icon";
import "./attendance-progress-bar";
import "./response-icon";

@customElement("event-summary-card")
export class EventSummaryCard extends LitElement {
  @property({ type: Object })
  event: BandEvent | null = null;

  @property({ type: Boolean, reflect: true })
  cancelled = false;

  @property({ type: Array })
  members: Member[] = [];

  @property({ type: String })
  uid: string = "";

  @state()
  participants: { [uid: string]: Participant } = {};

  @state()
  loading = true;

  unsubscribe: () => void = () => {};

  connectedCallback() {
    super.connectedCallback();
    if (this.event) {
      this.fetchParticipants();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe();
  }

  willUpdate(changedProperties: any) {
    if (changedProperties.has("event") && this.event) {
      this.cancelled = !!this.event.cancelled;
      console.log(
        `[event-summary-card] Event ${this.event.ref.id} updated. Cancelled: ${this.cancelled}`
      );
    }
  }

  updated(changedProperties: any) {
    if (changedProperties.has("event") && this.event) {
      this.fetchParticipants();
    }
  }

  fetchParticipants() {
    this.unsubscribe();
    this.loading = true;
    this.unsubscribe = onSnapshot(
      this.event!.ref.participants().dbref,
      (snapshot) => {
        const participants: { [uid: string]: Participant } = {};
        snapshot.docs.forEach((doc) => {
          const p = doc.data();
          participants[p.uid] = p;
        });
        this.participants = participants;
        this.loading = false;
      }
    );
  }

  get yesCount() {
    return Object.values(this.participants).filter((p) => p.attending === "yes")
      .length;
  }

  get noCount() {
    return Object.values(this.participants).filter((p) => p.attending === "no")
      .length;
  }

  get subCount() {
    return Object.values(this.participants).filter((p) => p.attending === "sub")
      .length;
  }

  get userResponse() {
    return this.participants[this.uid]?.attending;
  }

  get actionRequired() {
    return !this.userResponse && !this.event?.cancelled;
  }

  static styles = css`
    :host {
      display: block;
    }

    .content {
      display: flex;
      flex-direction: column;
      gap: var(--app-spacing-md);

      .main {
        width: 100%;
        display: flex;
        flex-grow: 1;
        flex-direction: row;
        gap: var(--app-spacing-md);
        align-items: center;
        position: relative;
      }

      response-icon {
        font-size: 1.5rem;
      }

      .date-box {
        align-self: start;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background-color: var(--app-color-background);
        border-radius: var(--app-radius-md);
        padding: var(--app-spacing-sm);
        width: clamp(40px, 10vw, 60px);
        min-height: 50px;
        text-align: center;
        border: 1px solid var(--app-color-border);

        .date-month {
          font-size: 0.75rem;
          text-transform: uppercase;
          color: var(--app-color-primary-700);
          font-weight: var(--app-font-weight-bold);
          line-height: 1;
          margin-bottom: 4px;
        }

        .date-day {
          font-size: 1.5rem;
          font-weight: var(--app-font-weight-bold);
          color: var(--app-color-text);
          line-height: 1;
        }
      }

      .info {
        flex: 1;
        align-self: start;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;

        .title {
          font-size: var(--app-font-size-lg);
          font-weight: var(--app-font-weight-bold);
          color: var(--app-color-text);
          margin: 0;
          text-overflow: ellipsis;
          white-space: nowrap;
          overflow: hidden;
        }

        .meta {
          display: flex;
          align-items: center;
          gap: var(--app-spacing-md);
          font-size: var(--app-font-size-sm);
          color: var(--app-color-text-secondary);
          min-width: 0;
          width: 100%;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .meta-item.location {
          min-width: 0;
          flex: 1;
          align-items: center;
        }

        .meta-item.location span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
        }

        .description {
          height: 1.5lh;
          overflow: hidden;
          p {
            margin: 0;
          }
        }
      }

      .status {
        grid-column: 1 / -1;
        grid-row: 2;
        width: 100%;
        align-self: start;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: var(--app-spacing-sm);
        min-width: 100px;

        attendance-progress-bar {
          width: 100%;
          height: 1ex;
        }
      }

      .badge {
        font-size: 0.75rem;
        font-weight: var(--app-font-weight-bold);
        padding: 4px 10px;
        border-radius: var(--app-radius-full);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .badge.action {
        background-color: transparent;
        color: var(--app-color-red-600);
        border: 1px solid var(--app-color-red-600);
        box-shadow: none;
      }

      .badge.cancelled {
        background-color: var(--app-color-text-secondary);
        color: white;
      }
    }

    :host([cancelled]) {
      opacity: 0.6;

      .status,
      .description {
        display: none;
      }
    }
  `;

  renderResponseStatus() {
    return html`
      <response-icon .response=${this.userResponse}></response-icon>
    `;
  }

  render() {
    if (!this.event) return html``;

    let month = "";
    let day: number | string = "";
    let time = "";

    if (this.event.start) {
      const [datePart, timePart] = this.event.start.split("T");
      const [y, m, d] = datePart.split("-").map(Number);

      // Use UTC to prevent local timezone offsets from changing the day
      const dateObj = new Date(Date.UTC(y, m - 1, d));
      month = dateObj
        .toLocaleDateString("sv-SE", { month: "short", timeZone: "UTC" })
        .replace(".", "");
      day = dateObj.getUTCDate();

      if (timePart) {
        let isZeroTime =
          timePart === "00:00" ||
          timePart === "00:00:00" ||
          timePart.startsWith("00:00:00.");
        if (!isZeroTime) {
          const timeTokens = timePart.split(":");
          time = `${timeTokens[0]}:${timeTokens[1]}`;
        }
      }
    } else {
      const dateObj = new Date();
      month = dateObj
        .toLocaleDateString("sv-SE", { month: "short" })
        .replace(".", "");
      day = dateObj.getDate();
    }

    const total = this.members.length || 1; // Avoid division by zero

    return html`
      <div class="content">
        <div class="main">
          <div class="date-box">
            <span class="date-month">${month}</span>
            <span class="date-day">${day}</span>
          </div>

          <div class="info">
            <h3 class="title">
              ${this.event.type}
              ${this.event.cancelled
                ? html`
                    <span
                      class="badge cancelled"
                      style="margin-left: 8px; vertical-align: middle;"
                      >Inställt</span
                    >
                  `
                : ""}
            </h3>
            <div class="meta">
              ${time
                ? html`
                    <div class="meta-item">
                      <app-icon
                        icon="schedule"
                        style="font-size: 16px;"
                      ></app-icon>
                      ${time}
                    </div>
                  `
                : ""}
              ${this.event.location
                ? html`
                    <div class="meta-item location">
                      <app-icon
                        icon="place"
                        style="font-size: 16px;"
                      ></app-icon>
                      <span>${this.event.location}</span>
                    </div>
                  `
                : ""}
            </div>
            <div class="description">
              ${this.event.description
                ? html`
                    ${unsafeHTML(
                      DOMPurify.sanitize(
                        marked.parse(
                          this.event.description.split("\n\n")[0]
                        ) as string
                      )
                    )}
                  `
                : ""}
            </div>
          </div>
          ${this.renderResponseStatus()}
        </div>
        <div class="status">
          <attendance-progress-bar
            .yes=${this.yesCount}
            .no=${this.noCount}
            .sub=${this.subCount}
            .total=${total}
          ></attendance-progress-bar>
        </div>
      </div>
    `;
  }
}
