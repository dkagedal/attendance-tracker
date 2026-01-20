import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BandEvent } from "../model/bandevent";
import { Member } from "../model/member";
import { Participant } from "../model/participant";
import { onSnapshot } from "firebase/firestore";
import "./app-card";
import "./app-icon";
import "./attendance-progress-bar";

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

  unsubscribe: () => void = () => { };

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
      console.log(`[event-summary-card] Event ${this.event.ref.id} updated. Cancelled: ${this.cancelled}`);
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
      snapshot => {
        const participants: { [uid: string]: Participant } = {};
        snapshot.docs.forEach(doc => {
          const p = doc.data();
          participants[p.uid] = p;
        });
        this.participants = participants;
        this.loading = false;
      }
    );
  }

  get yesCount() {
    return Object.values(this.participants).filter(p => p.attending === "yes")
      .length;
  }

  get noCount() {
    return Object.values(this.participants).filter(p => p.attending === "no")
      .length;
  }

  get subCount() {
    return Object.values(this.participants).filter(p => p.attending === "sub")
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
      margin-bottom: var(--app-spacing-md);
    }

    .content {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: var(--app-spacing-md);
      align-items: center;
      position: relative;
    }

    /* Desktop Layout */
    .date-box { grid-column: 1; align-self: start; }
    .info { grid-column: 2; align-self: start; }
    .status { grid-column: 3; align-self: start; }

    @media (max-width: 768px) {
      .content {
        grid-template-columns: auto 1fr auto;
        grid-template-rows: auto auto;
        gap: var(--app-spacing-sm);
      }

      .info {
        padding-right: 8px;
      }

      .status {
        grid-column: 1 / -1;
        grid-row: 2;
        display: block; /* Ensure it's a block to contain the bar */
        width: 100%;
        margin-top: var(--app-spacing-xs);
      }

      .response-icon {
        grid-column: 3;
      }

      .attendance-container {
        width: 100%;
        align-items: flex-start;
      }

      .date-box {
        min-width: 40px;
        padding: 4px;
      }

      .date-day {
        font-size: 1.1rem;
      }
      
      .date-month {
        font-size: 0.65rem;
      }
    }

    /* Date Box */
    .date-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background-color: var(--app-color-background);
      border-radius: var(--app-radius-md);
      padding: var(--app-spacing-sm);
      min-width: 60px;
      text-align: center;
      border: 1px solid var(--app-color-border);
    }

    .date-month {
      font-size: 0.75rem;
      text-transform: uppercase;
      color: var(--app-color-error);
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

    /* Info Section */
    .info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .title {
      font-size: var(--app-font-size-lg);
      font-weight: var(--app-font-weight-bold);
      color: var(--app-color-text);
      margin: 0;
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

    /* Status Section */
    .status {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--app-spacing-sm);
      min-width: 100px;
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
      color: var(--app-color-error);
      border: 1px solid var(--app-color-error);
      box-shadow: none;
    }

    .badge.cancelled {
      background-color: var(--app-color-text-secondary);
      color: white;
    }

    .response-icon {
      font-size: 24px;
    }
    .response-icon.yes { color: var(--app-color-success); }
    .response-icon.no { color: var(--app-color-error); }
    .response-icon.sub { color: var(--app-color-warning); }
    .response-icon.na { color: var(--app-color-text-secondary); opacity: 0.5; }

    :host([cancelled]) {
      opacity: 0.6;
    }
  `;

  renderResponseStatus() {
    const response = this.userResponse || "na";
    let icon = "help_outline";
    let statusClass = "na";

    switch (response) {
      case "yes":
        icon = "check_circle";
        statusClass = "yes";
        break;
      case "no":
        icon = "cancel";
        statusClass = "no";
        break;
      case "sub":
        icon = "swap_horiz";
        statusClass = "sub";
        break;
      case "na":
      default:
        icon = "help_outline";
        statusClass = "na";
        break;
    }

    return html`<app-icon icon="${icon}" class="response-icon ${statusClass}"></app-icon>`;
  }

  render() {
    if (!this.event) return html``;

    const dateObj = this.event.start ? new Date(this.event.start) : new Date();
    const month = dateObj.toLocaleDateString("sv-SE", { month: "short" }).replace(".", "");
    const day = dateObj.getDate();
    const time = dateObj.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });

    const total = this.members.length || 1; // Avoid division by zero

    return html`
      <app-card clickable ?disabled=${this.cancelled}>
        <div class="content">
          
          <div class="date-box">
            <span class="date-month">${month}</span>
            <span class="date-day">${day}</span>
          </div>

          <div class="info">
            <h3 class="title">
              ${this.event.type}
              ${this.event.cancelled ? html`<span class="badge cancelled" style="margin-left: 8px; vertical-align: middle;">Inställt</span>` : ""}
            </h3>
            <div class="meta">
              <div class="meta-item">
                <app-icon icon="schedule" style="font-size: 16px;"></app-icon>
                ${time}
              </div>
              ${this.event.location ? html`
                <div class="meta-item location">
                  <app-icon icon="place" style="font-size: 16px;"></app-icon>
                  <span>${this.event.location}</span>
                </div>
              ` : ""}
            </div>
            <div class="description">
              ${this.event.description?.split("\n\n")[0]}
            </div>
          </div>
          ${this.renderResponseStatus()}

          <div class="status">
            ${this.event.cancelled
        ? html`<span class="badge cancelled">Inställt</span>`
        : html`
                  <attendance-progress-bar
                    .yes=${this.yesCount}
                    .no=${this.noCount}
                    .sub=${this.subCount}
                    .total=${total}
                  ></attendance-progress-bar>
                `}
          </div>

        </div>
      </app-card>
    `;
  }
}
