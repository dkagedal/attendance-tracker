import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Timestamp } from "firebase/firestore";
import { band } from "../model/band";
import { db } from "../storage";
import "./app-button";
import "./app-dialog";
import "./app-icon";
import "./app-toast";
import { generateRandomSecret } from "../secret";

function encodeCalendarToken(
  bandId: string,
  uid: string,
  secret: string
): string {
  const json = JSON.stringify({ b: bandId, u: uid, s: secret });
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

@customElement("calendar-subscription")
export class CalendarSubscription extends LitElement {
  @property({ type: String })
  bandid: string = "";

  @property({ type: String })
  bandName: string = "";

  @property({ type: String })
  uid: string = "";

  @state()
  private secret: string | null = null;

  @state()
  private createdAt: Timestamp | null = null;

  @state()
  private loading = true;

  @state()
  private loadError: string | null = null;

  @state()
  private busy = false;

  @state()
  private confirmRotateOpen = false;

  @state()
  private confirmDeactivateOpen = false;

  @state()
  private copiedToastVisible = false;

  @state()
  private rotatedToastVisible = false;

  private unsubscribe: (() => void) | null = null;
  private subscriptionSeq = 0;
  private copyToastTimer: number | null = null;
  private rotateToastTimer: number | null = null;

  connectedCallback() {
    super.connectedCallback();
    if (this.bandid && this.uid && !this.unsubscribe) {
      this.subscribeToCalendar();
    }
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has("bandid") || changedProperties.has("uid")) {
      this.confirmRotateOpen = false;
      this.confirmDeactivateOpen = false;
      this.subscribeToCalendar();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.cleanupSubscription();
    if (this.copyToastTimer !== null) {
      window.clearTimeout(this.copyToastTimer);
      this.copyToastTimer = null;
    }
    if (this.rotateToastTimer !== null) {
      window.clearTimeout(this.rotateToastTimer);
      this.rotateToastTimer = null;
    }
  }

  private cleanupSubscription() {
    this.subscriptionSeq++;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private subscribeToCalendar() {
    this.cleanupSubscription();
    this.loadError = null;

    if (!this.bandid || !this.uid) {
      this.secret = null;
      this.createdAt = null;
      this.loading = false;
      return;
    }

    this.loading = true;
    const seq = this.subscriptionSeq;
    const calendarRef = band(db, this.bandid).member(this.uid).calendar();

    this.unsubscribe = calendarRef.subscribe(
      (calendar) => {
        if (seq !== this.subscriptionSeq) return;
        this.loadError = null;
        if (calendar && calendar.secret) {
          this.secret = calendar.secret;
          this.createdAt = calendar.createdAt || null;
        } else {
          this.secret = null;
          this.createdAt = null;
        }
        this.loading = false;
      },
      (error) => {
        if (seq !== this.subscriptionSeq) return;
        console.error(
          "[calendar-subscription] Failed to read calendar secret:",
          error
        );
        this.loadError =
          "Kunde inte läsa in kalenderlänken. Försök igen senare.";
        this.loading = false;
      }
    );
  }

  private async createOrRotateSecret(showRotatedToast: boolean) {
    if (!this.bandid || !this.uid || this.busy) return;
    const targetBandId = this.bandid;
    const targetUid = this.uid;
    const calendarRef = band(db, targetBandId).member(targetUid).calendar();

    this.busy = true;
    this.loadError = null;
    try {
      await calendarRef.save(generateRandomSecret());
      if (
        showRotatedToast &&
        this.bandid === targetBandId &&
        this.uid === targetUid
      ) {
        this.showRotatedToast();
      }
    } catch (error) {
      console.error(
        "[calendar-subscription] Failed to save calendar secret:",
        error
      );
      if (this.bandid === targetBandId && this.uid === targetUid) {
        this.loadError = "Kunde inte spara kalenderlänken. Försök igen.";
      }
    } finally {
      this.busy = false;
      this.confirmRotateOpen = false;
    }
  }

  private async deactivateSubscription() {
    if (!this.bandid || !this.uid || this.busy) return;
    const targetBandId = this.bandid;
    const targetUid = this.uid;
    const calendarRef = band(db, targetBandId).member(targetUid).calendar();

    this.busy = true;
    this.loadError = null;
    try {
      await calendarRef.delete();
    } catch (error) {
      console.error(
        "[calendar-subscription] Failed to delete calendar secret:",
        error
      );
      if (this.bandid === targetBandId && this.uid === targetUid) {
        this.loadError = "Kunde inte inaktivera kalenderlänken. Försök igen.";
      }
    } finally {
      this.busy = false;
      this.confirmDeactivateOpen = false;
    }
  }

  private get feedPath(): string | null {
    if (!this.secret || !this.bandid || !this.uid) {
      return null;
    }
    const encoded = encodeCalendarToken(this.bandid, this.uid, this.secret);
    return `/_/calendar/${encoded}.ics`;
  }

  private get feedUrl(): string | null {
    const path = this.feedPath;
    return path ? `${location.origin}${path}` : null;
  }

  private get webcalUrl(): string | null {
    const path = this.feedPath;
    return path ? `webcal://${location.host}${path}` : null;
  }

  private get googleCalendarUrl(): string | null {
    const webcal = this.webcalUrl;
    return webcal
      ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(
          webcal
        )}`
      : null;
  }

  private async copyUrl() {
    const url = this.feedUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.copiedToastVisible = true;
      if (this.copyToastTimer !== null) {
        window.clearTimeout(this.copyToastTimer);
      }
      this.copyToastTimer = window.setTimeout(() => {
        this.copiedToastVisible = false;
        this.copyToastTimer = null;
      }, 3000);
    } catch (error) {
      console.error("[calendar-subscription] Failed to copy URL:", error);
    }
  }

  private showRotatedToast() {
    this.rotatedToastVisible = true;
    if (this.rotateToastTimer !== null) {
      window.clearTimeout(this.rotateToastTimer);
    }
    this.rotateToastTimer = window.setTimeout(() => {
      this.rotatedToastVisible = false;
      this.rotateToastTimer = null;
    }, 3000);
  }

  static styles = css`
    :host {
      display: block;
      max-width: 720px;
      margin: 0 auto;
    }

    .card {
      background: var(--app-color-surface);
      border-radius: var(--app-radius-lg);
      padding: var(--app-spacing-lg);
      box-shadow: var(--app-shadow-sm);
    }

    .header {
      display: flex;
      align-items: center;
      gap: var(--app-spacing-sm);
      margin-bottom: var(--app-spacing-md);
    }

    h2 {
      margin: 0;
      color: var(--app-color-text);
      font-size: var(--app-font-size-xl);
    }

    .lead {
      color: var(--app-color-text-secondary);
      line-height: 1.5;
      margin: 0 0 var(--app-spacing-lg) 0;
    }

    .error-msg {
      color: var(--app-color-red-700);
      background: var(--app-color-red-100);
      padding: var(--app-spacing-sm) var(--app-spacing-md);
      border-radius: var(--app-radius-md);
      font-size: var(--app-font-size-sm);
      margin-bottom: var(--app-spacing-md);
    }

    .url-box {
      display: flex;
      align-items: center;
      gap: var(--app-spacing-sm);
      background: var(--app-color-background);
      border: 1px solid var(--app-color-border);
      padding: var(--app-spacing-sm) var(--app-spacing-md);
      border-radius: var(--app-radius-md);
      font-family: monospace;
      font-size: var(--app-font-size-sm);
      margin-bottom: var(--app-spacing-md);
    }

    .url-text {
      flex: 1;
      min-width: 0;
      overflow-x: auto;
      white-space: nowrap;
      user-select: all;
    }

    .copy-btn {
      background: transparent;
      border: none;
      border-radius: var(--app-radius-full);
      padding: var(--app-spacing-sm);
      min-block-size: 24px;
      min-inline-size: 24px;
      cursor: pointer;
      color: var(--app-color-text);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .copy-btn:hover {
      background-color: rgba(0, 0, 0, 0.06);
    }

    .copy-btn:focus-visible {
      outline: 2px solid var(--app-color-primary-600);
      outline-offset: 2px;
    }

    .subscribe-actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--app-spacing-sm);
      margin-bottom: var(--app-spacing-lg);
    }

    .action-link {
      box-sizing: border-box;
      font-family: var(--app-font-family);
      font-size: var(--app-font-size-sm);
      font-weight: var(--app-font-weight-medium);
      border-radius: var(--app-radius-md);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--app-spacing-sm);
      padding: var(--app-spacing-sm) var(--app-spacing-md);
      transition: background-color 0.2s, color 0.2s;
    }

    .action-link app-icon {
      font-size: var(--app-font-size-lg);
    }

    .action-link:focus-visible {
      outline: 2px solid var(--app-color-primary-600);
      outline-offset: 2px;
    }

    .action-link.primary {
      background: var(--app-color-primary-600);
      color: white;
    }

    .action-link.primary:hover {
      background: var(--app-color-primary-400);
    }

    .action-link.secondary {
      background: white;
      color: var(--app-color-text);
      border: 1px solid var(--app-color-border);
    }

    .action-link.secondary:hover {
      background: var(--app-color-background);
    }

    .info-box {
      background: var(--app-color-background);
      border-radius: var(--app-radius-md);
      padding: var(--app-spacing-md);
      font-size: var(--app-font-size-sm);
      color: var(--app-color-text-secondary);
      line-height: 1.5;
      margin-bottom: var(--app-spacing-lg);
    }

    .info-box ul {
      margin: var(--app-spacing-xs) 0 0 0;
      padding-left: 1.25rem;
    }

    .manage-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--app-spacing-sm);
      border-top: 1px solid var(--app-color-border);
      padding-top: var(--app-spacing-md);
    }

    .created-meta {
      font-size: var(--app-font-size-sm);
      color: var(--app-color-text-secondary);
    }

    .manage-buttons {
      display: flex;
      gap: var(--app-spacing-sm);
      flex-wrap: wrap;
    }
  `;

  render() {
    const title = this.bandName
      ? `Kalenderprenumeration – ${this.bandName}`
      : "Kalenderprenumeration";

    return html`
      ${this.copiedToastVisible
        ? html`<app-toast>Kalenderlänken kopierad till urklipp!</app-toast>`
        : ""}
      ${this.rotatedToastVisible
        ? html`<app-toast>Ny kalenderlänk skapad!</app-toast>`
        : ""}

      <div class="card">
        <div class="header">
          <app-button
            variant="icon"
            icon="arrow_back"
            label="Tillbaka"
            @click=${() => this.dispatchEvent(new CustomEvent("back"))}
          ></app-button>
          <h2>${title}</h2>
        </div>

        <p class="lead">
          Prenumerera på bandets schema i Google Kalender, Apple Kalender eller
          Outlook. Kalendern uppdateras automatiskt och visar ditt personliga
          svar på varje händelse.
        </p>

        ${this.loadError
          ? html`<div class="error-msg" role="alert">${this.loadError}</div>`
          : ""}
        ${this.loading
          ? html`<p class="lead">Laddar kalenderlänk...</p>`
          : this.feedUrl
          ? html`
              <div class="url-box">
                <span class="url-text">${this.feedUrl}</span>
                <button
                  type="button"
                  class="copy-btn"
                  aria-label="Kopiera kalenderlänk"
                  @click=${this.copyUrl}
                >
                  <app-icon icon="content_copy" aria-hidden="true"></app-icon>
                </button>
              </div>

              <div class="subscribe-actions">
                <a
                  class="action-link primary"
                  href=${this.googleCalendarUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <app-icon icon="event" aria-hidden="true"></app-icon>
                  <span>Lägg till i Google Kalender</span>
                </a>
                <a class="action-link secondary" href=${this.webcalUrl!}>
                  <app-icon icon="open_in_new" aria-hidden="true"></app-icon>
                  <span>Öppna i kalenderapp</span>
                </a>
              </div>

              <div class="info-box">
                <strong>Bra att veta:</strong>
                <ul>
                  <li>
                    Länken är personlig — dela den inte med andra, eftersom den
                    visar dina svar.
                  </li>
                  <li>
                    Händelser där du svarat <em>Kan inte</em> eller
                    <em>Vikarie</em> markeras som lediga i din kalender, och
                    inställda händelser döljs automatiskt.
                  </li>
                </ul>
              </div>

              <div class="manage-row">
                <span class="created-meta">
                  ${this.createdAt
                    ? `Skapad: ${this.createdAt
                        .toDate()
                        .toLocaleString("sv-SE")}`
                    : ""}
                </span>
                <div class="manage-buttons">
                  <app-button
                    variant="secondary"
                    icon="refresh"
                    ?disabled=${this.busy}
                    @click=${() => (this.confirmRotateOpen = true)}
                  >
                    Återställ länk
                  </app-button>
                  <app-button
                    variant="secondary"
                    icon="link_off"
                    ?disabled=${this.busy}
                    @click=${() => (this.confirmDeactivateOpen = true)}
                  >
                    Inaktivera
                  </app-button>
                </div>
              </div>
            `
          : !this.loadError
          ? html`
              <p class="lead">
                Du har ingen aktiv kalenderlänk för det här bandet ännu.
              </p>
              <app-button
                variant="primary"
                icon="add_link"
                ?disabled=${this.busy}
                @click=${() => this.createOrRotateSecret(false)}
              >
                Aktivera kalenderlänk
              </app-button>
            `
          : ""}
      </div>

      <app-dialog
        ?open=${this.confirmRotateOpen}
        heading="Återställ kalenderlänk"
        @closed=${() => (this.confirmRotateOpen = false)}
      >
        <p>
          Är du säker på att du vill skapa en ny kalenderlänk? Den gamla länken
          slutar fungera direkt och du behöver lägga in den nya länken i din
          kalenderapp.
        </p>
        <app-button
          slot="primaryAction"
          variant="primary"
          ?disabled=${this.busy}
          @click=${() => this.createOrRotateSecret(true)}
        >
          Återställ
        </app-button>
        <app-button
          slot="secondaryAction"
          variant="secondary"
          @click=${() => (this.confirmRotateOpen = false)}
        >
          Avbryt
        </app-button>
      </app-dialog>

      <app-dialog
        ?open=${this.confirmDeactivateOpen}
        heading="Inaktivera kalenderlänk"
        @closed=${() => (this.confirmDeactivateOpen = false)}
      >
        <p>
          Vill du inaktivera din kalenderlänk för det här bandet? Eventuella
          kalenderappar som prenumererar på länken slutar uppdateras.
        </p>
        <app-button
          slot="primaryAction"
          variant="primary"
          ?disabled=${this.busy}
          @click=${() => this.deactivateSubscription()}
        >
          Inaktivera
        </app-button>
        <app-button
          slot="secondaryAction"
          variant="secondary"
          @click=${() => (this.confirmDeactivateOpen = false)}
        >
          Avbryt
        </app-button>
      </app-dialog>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "calendar-subscription": CalendarSubscription;
  }
}
