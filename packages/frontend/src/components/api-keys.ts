import { LitElement, html, css } from "lit";
import { customElement, property, state, query } from "lit/decorators.js";
import {
  collection,
  query as firestoreQuery,
  onSnapshot,
  deleteDoc,
  doc,
  setDoc,
  Timestamp,
  orderBy
} from "firebase/firestore";
import { db } from "../storage";
import "./app-button";
import "./app-dialog";

interface ApiKey {
  id: string;
  name: string;
  createdAt: Timestamp;
  isReadonly: boolean;
}

@customElement("api-keys")
export class ApiKeys extends LitElement {
  @property({ type: String })
  uid: string;

  @state()
  keys: ApiKey[] = [];

  @state()
  showCreateDialog = false;

  @state()
  newKeyToken = "";

  @query("#key-name")
  keyNameInput: HTMLInputElement;

  @query("#key-readonly")
  keyReadonlyInput: HTMLInputElement;

  private unsubscribe: (() => void) | null = null;

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has("uid") && this.uid) {
      if (this.unsubscribe) {
        this.unsubscribe();
      }
      
      const keysRef = collection(db, "users", this.uid, "apikeys");
      const q = firestoreQuery(keysRef, orderBy("createdAt", "desc"));
      
      this.unsubscribe = onSnapshot(q, (snapshot) => {
        this.keys = snapshot.docs.map(d => ({
          id: d.id,
          name: d.data().name,
          createdAt: d.data().createdAt,
          isReadonly: d.data().readonly || false
        }));
      });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  private generateRandomToken(): string {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async createKey() {
    const name = this.keyNameInput.value.trim();
    if (!name) return;

    const isReadonly = this.keyReadonlyInput.checked;
    const randomPart = this.generateRandomToken();
    const token = `at_${this.uid}_${randomPart}`;

    await setDoc(doc(db, "users", this.uid, "apikeys", token), {
      name: name,
      createdAt: Timestamp.now(),
      readonly: isReadonly
    });

    this.newKeyToken = token;
    this.showCreateDialog = false;
  }

  async deleteKey(tokenId: string) {
    if (confirm("Är du säker på att du vill ta bort denna API-nyckel? Eventuella script som använder den kommer sluta fungera.")) {
      await deleteDoc(doc(db, "users", this.uid, "apikeys", tokenId));
    }
  }

  copyToken(token: string) {
    navigator.clipboard.writeText(token);
    alert("Nyckeln kopierad till urklipp!");
  }

  static styles = css`
    :host {
      display: block;
      padding: var(--app-spacing-md);
      max-width: 800px;
      margin: 0 auto;
    }
    h2 {
      margin-top: 0;
      color: var(--app-color-primary);
    }
    .key-list {
      display: flex;
      flex-direction: column;
      gap: var(--app-spacing-md);
      margin-top: var(--app-spacing-md);
    }
    .key-card {
      background: var(--app-color-surface);
      border-radius: var(--app-radius-md);
      padding: var(--app-spacing-md);
      box-shadow: var(--app-shadow-sm);
      display: flex;
      flex-direction: column;
      gap: var(--app-spacing-sm);
    }
    .key-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .key-name {
      font-weight: bold;
      font-size: 1.1em;
    }
    .key-badge {
      font-size: 0.8em;
      padding: 2px 6px;
      border-radius: 4px;
      background: #eee;
      color: #555;
    }
    .key-badge.readonly {
      background: #e3f2fd;
      color: #1976d2;
    }
    .key-badge.readwrite {
      background: #ffebee;
      color: #c62828;
    }
    .key-token-container {
      display: flex;
      align-items: center;
      gap: var(--app-spacing-sm);
      background: var(--app-color-background);
      padding: var(--app-spacing-sm);
      border-radius: var(--app-radius-sm);
      font-family: monospace;
      word-break: break-all;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 16px;
    }
    .form-group label {
      font-weight: bold;
    }
    .form-group input[type="text"] {
      padding: 8px;
      border: 1px solid var(--app-color-border);
      border-radius: 4px;
    }
    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .new-key-alert {
      background: #e8f5e9;
      border: 1px solid #4caf50;
      padding: var(--app-spacing-md);
      border-radius: var(--app-radius-md);
      margin-bottom: var(--app-spacing-md);
    }
  `;

  render() {
    return html`
      <div class="header">
        <h2>Mina API-nycklar</h2>
        <p>Här kan du skapa anpassade API-nycklar för att använda med externa script och integrationer.</p>
        <app-button variant="primary" icon="add" @click=${() => this.showCreateDialog = true}>Skapa ny nyckel</app-button>
      </div>

      ${this.newKeyToken ? html`
        <div class="new-key-alert">
          <strong>Nyckel skapad!</strong>
          <p>Kopiera din nya API-nyckel nu.</p>
          <div class="key-token-container">
            <span>${this.newKeyToken}</span>
            <app-button variant="icon" icon="content_copy" @click=${() => this.copyToken(this.newKeyToken)}></app-button>
          </div>
          <div style="margin-top: 8px;">
            <app-button variant="secondary" @click=${() => this.newKeyToken = ""}>Stäng</app-button>
          </div>
        </div>
      ` : ""}

      <div class="key-list">
        ${this.keys.length === 0 ? html`<p>Du har inga API-nycklar än.</p>` : ""}
        ${this.keys.map(key => html`
          <div class="key-card">
            <div class="key-header">
              <span class="key-name">${key.name}</span>
              <span class="key-badge ${key.isReadonly ? 'readonly' : 'readwrite'}">
                ${key.isReadonly ? 'Skrivskyddad (Endast Läs)' : 'Full åtkomst (Läs/Skriv)'}
              </span>
            </div>
            <div style="font-size: 0.8em; color: var(--app-color-text-secondary);">
              Skapad: ${key.createdAt.toDate().toLocaleString("sv-SE")}
            </div>
            <div class="key-token-container">
              <span>${key.id}</span>
              <app-button variant="icon" icon="content_copy" title="Kopiera" @click=${() => this.copyToken(key.id)}></app-button>
              <app-button variant="icon" icon="delete" title="Ta bort" style="color: #c62828; margin-left: auto;" @click=${() => this.deleteKey(key.id)}></app-button>
            </div>
          </div>
        `)}
      </div>

      <app-dialog ?open=${this.showCreateDialog} heading="Skapa ny API-nyckel" @closed=${() => this.showCreateDialog = false}>
        <div class="form-group">
          <label for="key-name">Namn</label>
          <input type="text" id="key-name" placeholder="T.ex. Mitt script" />
        </div>
        <div class="form-group checkbox-group">
          <input type="checkbox" id="key-readonly" checked />
          <label for="key-readonly">Skrivskyddad (Endast läsrättigheter)</label>
        </div>
        <p style="font-size: 0.9em; color: var(--app-color-text-secondary);">
          Skrivskyddade nycklar kan bara hämta data (GET-förfrågningar) och kan inte ändra eller ta bort händelser.
        </p>

        <app-button slot="primaryAction" variant="primary" @click=${this.createKey}>Skapa</app-button>
        <app-button slot="secondaryAction" variant="secondary" @click=${() => this.showCreateDialog = false}>Avbryt</app-button>
      </app-dialog>
    `;
  }
}
