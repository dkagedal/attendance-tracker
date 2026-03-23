import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Member } from "../model/member";
import { Band, band as bandModel } from "../model/band";
import { db } from "../storage";
import { onSnapshot, updateDoc } from "firebase/firestore";
import "./app-input";
import "./app-button";
import "./app-icon";

@customElement("band-overview")
export class BandOverview extends LitElement {
  @property({ type: String })
  bandid: string;

  @property({ type: String })
  uid: string;

  @property({ type: Object, attribute: false })
  membership: Member;

  @state()
  bandData: Band = null;

  @state()
  members: Member[] = [];

  // Edit states
  @state()
  editingBandName = false;
  @state()
  editingBandLogo = false;
  @state()
  editingMemberId: string | null = null;

  @state()
  editBandNameValue = "";
  @state()
  editBandLogoValue = "";
  @state()
  editMemberNameValue = "";

  private subscriptions: (() => void)[] = [];

  connectedCallback() {
    super.connectedCallback();
    if (this.bandid) {
      this.subscribeToData();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribeFromData();
  }

  updated(changedProperties: Map<string, any>) {
    if (changedProperties.has("bandid")) {
      this.unsubscribeFromData();
      if (this.bandid) {
        this.subscribeToData();
      }
    }
  }

  private subscribeToData() {
    const bRef = bandModel(db, this.bandid);
    
    // Subscribe to band details
    this.subscriptions.push(
      onSnapshot(bRef.dbref, (snapshot) => {
        if (snapshot.exists()) {
          this.bandData = snapshot.data();
        }
      })
    );

    // Subscribe to members
    this.subscriptions.push(
      onSnapshot(bRef.members().dbref, (snapshot) => {
        this.members = snapshot.docs.map(doc => doc.data() as Member);
      })
    );
  }

  private unsubscribeFromData() {
    this.subscriptions.forEach(unsub => unsub());
    this.subscriptions = [];
  }

  private isAdmin(): boolean {
    return this.membership && this.membership.admin;
  }

  private async saveBandName() {
    if (!this.editBandNameValue.trim()) return;
    try {
      await updateDoc(bandModel(db, this.bandid).dbref.withConverter(null), {
        display_name: this.editBandNameValue.trim()
      });
      this.editingBandName = false;
    } catch (e) {
      console.error("Failed to update band name", e);
    }
  }

  private async saveBandLogo() {
    try {
      await updateDoc(bandModel(db, this.bandid).dbref.withConverter(null), {
        logo: this.editBandLogoValue.trim()
      });
      this.editingBandLogo = false;
    } catch (e) {
      console.error("Failed to update band logo", e);
    }
  }

  private async saveMemberName(memberId: string) {
    if (!this.editMemberNameValue.trim()) return;
    try {
      await updateDoc(bandModel(db, this.bandid).member(memberId).dbref.withConverter(null), {
        display_name: this.editMemberNameValue.trim()
      });
      this.editingMemberId = null;
    } catch (e) {
      console.error("Failed to update member name", e);
    }
  }

  static styles = css`
    :host {
      display: block;
      padding: var(--app-spacing-lg) 0;
    }
    .card {
      background: var(--app-color-surface);
      border-radius: var(--app-radius-lg);
      padding: var(--app-spacing-lg);
      box-shadow: var(--app-shadow-sm);
      margin-bottom: var(--app-spacing-lg);
    }
    .header {
      display: flex;
      align-items: center;
      gap: var(--app-spacing-md);
      margin-bottom: var(--app-spacing-lg);
    }
    .logo {
      width: 64px;
      height: 64px;
      border-radius: var(--app-radius-md);
      object-fit: cover;
      background: var(--app-color-background);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      color: var(--app-color-text-secondary);
      overflow: hidden;
      cursor: default;
      position: relative;
    }
    .logo-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .title-area {
      flex: 1;
      display: flex;
      align-items: center;
      gap: var(--app-spacing-sm);
    }
    .title {
      font-size: var(--app-font-size-xxl);
      font-weight: var(--app-font-weight-bold);
      margin: 0;
    }
    .member-list {
      display: flex;
      flex-direction: column;
      gap: var(--app-spacing-xs);
    }
    .member-item {
      display: flex;
      align-items: center;
      padding: var(--app-spacing-sm);
      background: var(--app-color-background);
      border-radius: var(--app-radius-md);
      justify-content: space-between;
    }
    .member-name {
      font-weight: var(--app-font-weight-medium);
    }
    .edit-row {
      display: flex;
      align-items: center;
      gap: var(--app-spacing-sm);
      width: 100%;
    }
  `;

  render() {
    if (!this.bandData) {
      return html`<div>Laddar översikt...</div>`;
    }

    return html`
      <div class="card">
        <div class="header">
          <app-button variant="icon" icon="arrow_back" @click=${() => this.dispatchEvent(new CustomEvent('back'))}></app-button>
          <div class="logo" @click=${() => {
            if (this.isAdmin() && !this.editingBandLogo) {
              this.editBandLogoValue = this.bandData.logo || "";
              this.editingBandLogo = true;
              this.updateComplete.then(() => {
                const input = this.renderRoot.querySelector('.logo .edit-row app-input') as HTMLElement;
                if (input) setTimeout(() => input.focus(), 0);
              });
            }
          }}>
            ${this.editingBandLogo ? html`
              <div class="edit-row" style="position: absolute; width: 250px; left: 0; z-index: 10; background: white; padding: 4px; box-shadow: var(--app-shadow-sm);">
                <app-input
                  style="flex: 1; min-width: 0;"
                  value=${this.editBandLogoValue}
                  @input=${(e: any) => this.editBandLogoValue = e.target.value}
                  placeholder="URL..."
                ></app-input>
                <app-button variant="icon" icon="check" @click=${(e: Event) => { e.stopPropagation(); this.saveBandLogo(); }}></app-button>
                <app-button variant="icon" icon="close" @click=${(e: Event) => { e.stopPropagation(); this.editingBandLogo = false; }}></app-button>
              </div>
            ` : (this.bandData.logo ? html`<img class="logo-img" src="${this.bandData.logo}" alt="Logo">` : html`<app-icon icon="groups"></app-icon>`)}
            ${this.isAdmin() && !this.editingBandLogo ? html`
              <div style="position: absolute; bottom: 0; right: 0; background: rgba(0,0,0,0.5); color: white; border-top-left-radius: 4px; padding: 2px;">
                <app-icon icon="edit" style="font-size: 14px;"></app-icon>
              </div>
            ` : nothing}
          </div>

          <div class="title-area">
            ${this.editingBandName ? html`
              <div class="edit-row">
                <app-input
                  value=${this.editBandNameValue}
                  @input=${(e: any) => this.editBandNameValue = e.target.value}
                ></app-input>
                <app-button variant="icon" icon="check" @click=${this.saveBandName}></app-button>
                <app-button variant="icon" icon="close" @click=${() => this.editingBandName = false}></app-button>
              </div>
            ` : html`
              <h1 class="title">${this.bandData.display_name}</h1>
              ${this.isAdmin() ? html`
                <app-button variant="icon" icon="edit" @click=${async () => {
                  this.editBandNameValue = this.bandData.display_name;
                  this.editingBandName = true;
                  await this.updateComplete;
                  const input = this.renderRoot.querySelector('.title-area app-input') as HTMLElement;
                  if (input) setTimeout(() => input.focus(), 0);
                }}></app-button>
              ` : nothing}
            `}
          </div>
        </div>

        <h2>Medlemmar</h2>
        <div class="member-list">
          ${this.members.map(member => html`
            <div class="member-item">
              ${this.editingMemberId === member.id ? html`
                <div class="edit-row">
                  <app-input
                    value=${this.editMemberNameValue}
                    @input=${(e: any) => this.editMemberNameValue = e.target.value}
                    @keyup=${(e: KeyboardEvent) => {
                      if (e.key === 'Enter') {
                        this.saveMemberName(member.id);
                      }
                    }}
                  ></app-input>
                  <app-button variant="icon" icon="check" @click=${() => this.saveMemberName(member.id)}></app-button>
                  <app-button variant="icon" icon="close" @click=${() => this.editingMemberId = null}></app-button>
                </div>
              ` : html`
                <div style="display: flex; align-items: center;">
                  <span class="member-name">${member.display_name}</span>
                </div>
                ${this.isAdmin() ? html`
                  <app-button variant="icon" icon="edit" @click=${async () => {
                    this.editMemberNameValue = member.display_name;
                    this.editingMemberId = member.id;
                    await this.updateComplete;
                    const input = this.renderRoot.querySelector('.member-item app-input') as HTMLElement;
                    if (input) {
                      setTimeout(() => input.focus(), 0);
                    }
                  }}></app-button>
                ` : nothing}
              `}
            </div>
          `)}
        </div>
      </div>
    `;
  }
}
