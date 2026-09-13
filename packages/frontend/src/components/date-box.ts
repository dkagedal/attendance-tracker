import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("date-box")
export class DateBox extends LitElement {
  @property({ type: String })
  date: string = "";

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background-color: var(--app-color-background);
      border-radius: var(--app-radius-md);
      padding: var(--app-spacing-sm);
      text-align: center;
      border: 1px solid var(--app-color-border);
      box-sizing: border-box;
    }

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
  `;

  private formatDate(): { month: string; day: string | number } {
    if (!this.date) {
      return { month: "", day: "" };
    }

    const [datePart] = this.date.split("T");
    const [y, m, d] = datePart.split("-").map(Number);

    if (isNaN(y) || isNaN(m) || isNaN(d)) {
      return { month: "", day: "" };
    }

    // Use UTC to prevent local timezone offsets from changing the day
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    const month = dateObj
      .toLocaleDateString("sv-SE", { month: "short", timeZone: "UTC" })
      .replace(".", "");
    const day = dateObj.getUTCDate();

    return { month, day };
  }

  render() {
    const { month, day } = this.formatDate();

    return html`
      <span class="date-month">${month}</span>
      <span class="date-day">${day}</span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "date-box": DateBox;
  }
}
