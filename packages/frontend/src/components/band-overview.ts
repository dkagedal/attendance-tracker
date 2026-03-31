import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Member } from "../model/member";
import { Band, band as bandModel, Section } from "../model/band";
import { db } from "../storage";
import { onSnapshot, updateDoc, writeBatch } from "firebase/firestore";
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

  // Section editor states
  @state()
  addingSection = false;
  @state()
  newSectionNameValue = "";
  @state()
  newSectionEmojiValue = "";

  @state()
  editingSectionId: string | null = null;
  @state()
  editSectionNameValue = "";
  @state()
  editSectionEmojiValue = "";

  @state()
  draggedMemberId: string | null = null;

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

  private async saveNewSection() {
    if (!this.newSectionNameValue.trim()) return;
    const newSection: Section = {
      id: "sec_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
      name: this.newSectionNameValue.trim(),
      emoji: this.newSectionEmojiValue.trim()
    };
    const newSections = [...(this.bandData.sections || []), newSection];
    try {
      await updateDoc(bandModel(db, this.bandid).dbref.withConverter(null), {
        sections: newSections
      });
      this.addingSection = false;
      this.newSectionNameValue = "";
      this.newSectionEmojiValue = "";
    } catch (e) {
      console.error("Failed to add section", e);
    }
  }

  private async saveEditedSection(sectionId: string) {
    if (!this.editSectionNameValue.trim()) return;
    const newSections = (this.bandData.sections || []).map(s => {
      if (s.id === sectionId) {
        return { ...s, name: this.editSectionNameValue.trim(), emoji: this.editSectionEmojiValue.trim() };
      }
      return s;
    });
    try {
      await updateDoc(bandModel(db, this.bandid).dbref.withConverter(null), {
        sections: newSections
      });
      this.editingSectionId = null;
    } catch (e) {
      console.error("Failed to update section", e);
    }
  }

  private async deleteSection(sectionId: string) {
    if (!confirm("Är du säker på att du vill ta bort sektionen?")) return;
    
    const newSections = (this.bandData.sections || []).filter(s => s.id !== sectionId);
    try {
      const batch = writeBatch(db);
      
      // Update band document
      batch.update(bandModel(db, this.bandid).dbref.withConverter(null), {
        sections: newSections
      });
      
      // Update affected members to remove section_id
      this.members.forEach(m => {
        if (m.section_id === sectionId) {
          batch.update(bandModel(db, this.bandid).member(m.id).dbref.withConverter(null), {
            section_id: null
          });
        }
      });
      
      await batch.commit();
    } catch (e) {
      console.error("Failed to delete section", e);
    }
  }

  private onDragStart(e: DragEvent, memberId: string) {
    if (!this.isAdmin()) return;
    this.draggedMemberId = memberId;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", memberId);
    }
  }

  private onDragOver(e: DragEvent) {
    if (!this.isAdmin()) return;
    e.preventDefault(); // Necessary to allow dropping
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }
  }

  private async onDrop(e: DragEvent, targetSectionId: string | null) {
    if (!this.isAdmin()) return;
    e.preventDefault();
    const memberId = this.draggedMemberId;
    this.draggedMemberId = null;
    
    if (memberId) {
      const member = this.members.find(m => m.id === memberId);
      if (member && member.section_id !== targetSectionId) {
        try {
          await updateDoc(bandModel(db, this.bandid).member(memberId).dbref.withConverter(null), {
            section_id: targetSectionId
          });
        } catch (error) {
          console.error("Failed to move member to section", error);
        }
      }
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
    .section-list {
      display: flex;
      flex-direction: column;
      gap: var(--app-spacing-md);
    }
    .section-group {
      background: var(--app-color-background);
      border-radius: var(--app-radius-lg);
      padding: var(--app-spacing-md);
      min-height: 100px;
    }
    .section-group-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--app-spacing-sm);
      color: var(--app-color-text-primary);
      font-weight: var(--app-font-weight-bold);
      font-size: var(--app-font-size-lg);
    }
    .member-list {
      display: flex;
      flex-direction: column;
      gap: var(--app-spacing-xs);
      min-height: 48px;
    }
    .member-item {
      display: flex;
      align-items: center;
      padding: var(--app-spacing-sm);
      background: var(--app-color-surface);
      border-radius: var(--app-radius-md);
      justify-content: space-between;
      box-shadow: var(--app-shadow-sm);
    }
    .member-item[draggable="true"] {
      cursor: grab;
    }
    .member-item[draggable="true"]:active {
      cursor: grabbing;
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
    .section-editor-row {
      display: flex;
      gap: var(--app-spacing-sm);
      align-items: center;
      margin-bottom: var(--app-spacing-sm);
      width: 100%;
    }
    .add-section-btn {
      margin-top: var(--app-spacing-md);
      display: flex;
    }
  `;

  render() {
    if (!this.bandData) {
      return html`<div>Laddar översikt...</div>`;
    }

    const sections = this.bandData.sections || [];
    
    // Group members by section
    const membersBySection = new Map<string | null, Member[]>();
    membersBySection.set(null, []); // Unassigned members
    sections.forEach(s => membersBySection.set(s.id, []));
    
    this.members.forEach(m => {
      const secId = m.section_id || null;
      if (membersBySection.has(secId)) {
        membersBySection.get(secId)!.push(m);
      } else {
        // Fallback for orphaned section IDs or explicitly null
        membersBySection.get(null)!.push(m);
      }
    });

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

        <h2>Sektioner & Medlemmar</h2>
        
        <div class="section-list">
          ${sections.map(section => html`
            <div class="section-group"
                 @dragover=${this.onDragOver}
                 @drop=${(e: DragEvent) => this.onDrop(e, section.id)}>
              
              <div class="section-group-header">
                ${this.editingSectionId === section.id ? html`
                  <div class="section-editor-row">
                    <app-input
                      style="width: 50px;"
                      value=${this.editSectionEmojiValue}
                      @input=${(e: any) => this.editSectionEmojiValue = e.target.value}
                      placeholder="🎸"
                    ></app-input>
                    <app-input
                      style="flex: 1;"
                      value=${this.editSectionNameValue}
                      @input=${(e: any) => this.editSectionNameValue = e.target.value}
                      placeholder="Namn"
                    ></app-input>
                    <app-button variant="icon" icon="check" @click=${() => this.saveEditedSection(section.id)}></app-button>
                    <app-button variant="icon" icon="close" @click=${() => this.editingSectionId = null}></app-button>
                  </div>
                ` : html`
                  <div style="flex: 1;">
                    <span style="margin-right: 8px;">${section.emoji}</span>
                    <span>${section.name}</span>
                  </div>
                  ${this.isAdmin() ? html`
                    <div style="display: flex;">
                      <app-button variant="icon" icon="edit" @click=${() => {
                        this.editSectionNameValue = section.name;
                        this.editSectionEmojiValue = section.emoji;
                        this.editingSectionId = section.id;
                      }}></app-button>
                      <app-button variant="icon" icon="delete" @click=${() => this.deleteSection(section.id)}></app-button>
                    </div>
                  ` : nothing}
                `}
              </div>

              <div class="member-list">
                ${membersBySection.get(section.id)!.map(member => this.renderMemberItem(member))}
              </div>
            </div>
          `)}

          <!-- Unassigned Members -->
          ${(membersBySection.get(null) || []).length > 0 ? html`
            <div class="section-group"
                 @dragover=${this.onDragOver}
                 @drop=${(e: DragEvent) => this.onDrop(e, null)}>
              <div class="section-group-header">
                <div>
                  <span style="margin-right: 8px;">❓</span>
                  <span>Ingen sektion / Övriga</span>
                </div>
              </div>
              <div class="member-list">
                ${membersBySection.get(null)!.map(member => this.renderMemberItem(member))}
              </div>
            </div>
          ` : nothing}
        </div>

        ${this.isAdmin() ? html`
          <div class="add-section-btn">
            ${this.addingSection ? html`
              <div class="section-group" style="width: 100%;">
                <div class="section-editor-row">
                  <app-input
                    style="width: 50px;"
                    value=${this.newSectionEmojiValue}
                    @input=${(e: any) => this.newSectionEmojiValue = e.target.value}
                    placeholder="🎸"
                  ></app-input>
                  <app-input
                    style="flex: 1;"
                    value=${this.newSectionNameValue}
                    @input=${(e: any) => this.newSectionNameValue = e.target.value}
                    placeholder="Sektionsnamn"
                    @keyup=${(e: KeyboardEvent) => { if (e.key === 'Enter') this.saveNewSection(); }}
                  ></app-input>
                  <app-button variant="icon" icon="check" @click=${this.saveNewSection}></app-button>
                  <app-button variant="icon" icon="close" @click=${() => this.addingSection = false}></app-button>
                </div>
              </div>
            ` : html`
              <app-button icon="add" @click=${() => {
                this.addingSection = true;
                this.newSectionNameValue = "";
                this.newSectionEmojiValue = "";
              }}>
                Lägg till sektion
              </app-button>
            `}
          </div>
        ` : nothing}
      </div>
    `;
  }

  private renderMemberItem(member: Member) {
    return html`
      <div class="member-item"
           draggable=${this.isAdmin() ? "true" : "false"}
           @dragstart=${(e: DragEvent) => this.onDragStart(e, member.id)}>
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
          <div style="display: flex; align-items: center; gap: 8px;">
            ${this.isAdmin() ? html`<app-icon icon="drag_indicator" style="color: var(--app-color-text-secondary); cursor: grab;"></app-icon>` : nothing}
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
    `;
  }
}
