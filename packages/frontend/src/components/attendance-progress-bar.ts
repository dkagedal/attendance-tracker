import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("attendance-progress-bar")
export class AttendanceProgressBar extends LitElement {
    @property({ type: Number })
    yes = 0;

    @property({ type: Number })
    no = 0;

    @property({ type: Number })
    sub = 0;

    @property({ type: Number })
    total = 1;

    static styles = css`
    :host {
      display: flex;
      width: 100%;
      height: 6px;
      background-color: #eeeeee; /* Light grey for empty space */
      border-radius: var(--app-radius-full);
      overflow: hidden;
      border: 1px solid var(--app-color-border);
    }

    .progress-fill {
      height: 100%;
      transition: width 0.3s ease;
    }
    
    .progress-fill.yes {
      background-color: var(--app-color-success);
    }
    
    .progress-fill.no {
      background-color: var(--app-color-error);
    }

    .progress-fill.sub {
      background-color: var(--app-color-warning);
    }
  `;

    render() {
        const total = this.total || 1;
        const yes_percentage = Math.min(100, Math.max(0, (this.yes / total) * 100));
        const no_percentage = Math.min(100, Math.max(0, (this.no / total) * 100));
        const sub_percentage = Math.min(100, Math.max(0, (this.sub / total) * 100));

        return html`
        <div 
          class="progress-fill yes" 
          style="width: ${yes_percentage}%"
        ></div>
        <div 
          class="progress-fill no" 
          style="width: ${no_percentage}%"
        ></div>
        <div 
          class="progress-fill sub" 
          style="width: ${sub_percentage}%"
        ></div>
    `;
    }
}
