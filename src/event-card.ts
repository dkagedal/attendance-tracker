
import "./event-editor"; import { LitElement, html, css, customElement, property, query } from 'lit-element';
// import { classMap } from 'lit-html/directives/class-map';
// import { styleMap } from 'lit-html/directives/style-map';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';
import '@material/mwc-dialog';
import '@material/mwc-icon';
import '@material/mwc-icon-button';
// import '@material/mwc-button';
import '@material/mwc-menu';
// import '@material/mwc-list/mwc-list-item';
// import '@material/mwc-tab';
// import '@material/mwc-tab-bar';
// import '@material/mwc-textfield';
// import './datetime-input.js';
// import './event-editor.js';
import './time-range';
import './mini-roster';
import { Menu } from '@material/mwc-menu';
import { IconButton } from '@material/mwc-icon-button';
import { SelectedDetail } from '@material/mwc-list/mwc-list-foundation';
import { BandEvent, ParticipantResponse } from './storage';
import { Dialog } from "@material/mwc-dialog";
import { EventEditor } from "./event-editor";

// const responseIcons = {
//   yes: "thumb_up",
//   no: "thumb_down",
//   maybe: "thumbs_up_down",
//   sub: "import_export",
// }

// const attendances = {
//   "yes": "Ja",
//   "no": "Nej",
//   "maybe": "Återkommer",
//   "sub": "Vikarie",
//   "unknown": "",
// }

interface Member {
  display_name: string,
}

interface Responses {
  [uid: string]: ParticipantResponse
}

interface Comments {
  [uid: string]: string,
}

@customElement("event-card")
export class EventCard extends LitElement {

  @property({ type: Array, attribute: false })
  members: firebase.firestore.DocumentSnapshot[] = [];

  @property({ type: Object, attribute: false })
  event: firebase.firestore.DocumentSnapshot | null = null;

  @property({ type: Object, attribute: false })
  responses = {} as Responses;

  @property({ type: Object, attribute: false })
  comments = {} as Comments;

  @query('#menu-button')
  menuButton: IconButton;

  @query('#menu')
  menu: Menu;

  @query('mwc-dialog')
  editDialog: Dialog;

  @query('event-editor')
  editor: EventEditor;

  cancelParticipantsListener: () => void = () => { };

  fetchParticipants() {
    const event = this.event!;
    const ref = event.ref;
    // console.log(`event-card: Fetching participants ${ref.path}/participants`);
    this.cancelParticipantsListener();
    this.cancelParticipantsListener = ref.collection('participants').onSnapshot((snapshot) => {
      this.responses = {};
      this.comments = {};
      snapshot.docs.forEach((p) => {
        this.responses[p.id] = p.data().attending;
        if (p.data().comment != undefined) {
          this.comments[p.id] = p.data().comment;
        }
      });
    });
  }

  updated(changedProperties: any) {
    changedProperties.forEach((_oldValue: any, propName: string) => {
      if (propName == 'event') {
        this.fetchParticipants()
      }
    })
  }

  static styles = css`
        :host {
          margin: 4px;
          border-radius: 5px;
          border: solid #ddd 1px;
          background: white;
          cursor: pointer;
        }
        #top {
            position: absolute; left: 0; 
            height: 100%; width: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 3px 3px 8px 1px rgba(0,0,0,0.4);
        }
        #head {
          display: flex;
          margin-bottom: -16px;
        }
        #head .event-type {
          font-weight: 600;
          margin: 16px 10px 16px 20px;
        }
        #head time-range {
          color: rgba(0, 0, 0, 0.7);
          margin: 16px 0;
        }
        #head .push-right {
          margin-left: auto;
        }
        #info {
          padding: 0 20px 10px 20px;
          color: rgba(0, 0, 0, 0.54);
          font-size: 0.875rem;
          font-weight: 400;
        }
        .comment {
          margin: 0 20px;
          color: rgba(0, 0, 0, 0.54);
          font-size: 0.875rem;
          font-weight: 400;
        }
        mini-roster {
          margin: 4px 20px;
        }
        .summary {
            padding: 0 40px 0 40px;
            font-variant: all-petite-caps;
            color: rgba(0,0,0,0.5);
        }
        .display {
          margin: 0;
        }
        p {
            margin: 4px 0;
        }
        .heading {
            font-size: 20px;
            font-weight: 600;
            margin-top: 16px;
        }
        .participant-row {
            display: flex;
            flex-direction: row;
            align-items: center;
            margin: 1px 0px;
            max-height: 40px;
            flex: 1 1;
        } 
        @media (max-height: 700px) {
        }
        .participant-row .avatar {
            flex: 0 1 30px;
            padding: 0 5px;
        }
        .dimmed {
            color: rgba(0, 0, 0, 0.3);
        }
        .participant-row .row-main {
            display: inline;
            margin: 0;
            flex: 1;
            overflow: hidden;
        }
        .participant-row .participant-name {
            margin: 4px 0;
            overflow: hidden;
        }
        .participant-row .comment {
            margin: 4px 0;
            font-size: 14px;
            overflow: hidden;
            color: rgba(0, 0, 0, 0.5);
        }
        .participant-row .response {
            padding: 0 5px;
            font-weight: 600;
        }
        #myresponse {
            display: flex;
            flex-direction: column;
        }
        `;

  menuAction(event: CustomEvent): void {
    const detail = event.detail as SelectedDetail;
    const data = this.event!.data()! as BandEvent
    switch (detail.index) {
      case 0:  // edit
        console.log(("Edit event"));
        this.editor.data = data;
        this.editor.range = 'stop' in data;
        this.editDialog.show();
        return;
      case 1:  // cancel
        console.log("Cancel event", data.cancelled, "to", !data.cancelled);
        this.event.ref.set({ cancelled: !data.cancelled }, { merge: true }).then(
          () => console.log("Cancel successful"),
          reason => console.log("Cancel failed:", reason));
        return;
    }
  }

  render() {
    const data = this.event!.data()! as BandEvent
    return html`
      <div id="head">
        <span class="event-type">${data.type}</span>
        <time-range start=${ifDefined(data.start)} stop=${ifDefined(data.stop)}></time-range>
        <mwc-icon-button id="menu-button" class="push-right" icon="more_vert" 
            @click=${() => this.menu.show()}></mwc-icon-button>
        <mwc-menu id="menu" fixed corner="TOP_END" menuCorner="END" .anchor=${this.menuButton}
            @action=${this.menuAction}>
          <mwc-list-item>Redigera</mwc-list-item>
          <mwc-list-item>${data.cancelled ? "Ångra ställ in" : "Ställ in"}</mwc-list-item>
        </mwc-menu>
        <mwc-dialog @closing=${this.closingEditor}>
          <event-editor></event-editor>
          <mwc-button slot="primaryAction" dialogAction="save">Spara</mwc-button>
          <mwc-button slot="secondaryAction" dialogAction="cancel">Avbryt</mwc-button>
        </mwc-dialog>
      </div>
      <div id="info">
        <p>${data.location}</p>
        <p>${data.description}</p>
      </div>
      ${repeat(this.members, member => member.id, member => {
      const data = member.data() as Member
      return member.id in this.comments ? html`<p class="comment"><b>${data.display_name}</b> ${this.comments[member.id]}</p>` : '';
    })}
    <mini-roster .members=${this.members} .event=${this.event} .responses=${this.responses}></mini-roster>
    `;
  }

  closingEditor(event: CustomEvent): void {
    console.log("Closing editor:", event.detail);
    if (event.detail.action == "save") {
      if (!this.editor.checkValidity()) {
        console.log("Invalid data, not saving")
      }
      this.editor.save();
      const data = this.editor.data;
      console.log("New data:", data);
      this.event.ref.set(data, { merge: false }).then(
        () => console.log("Update successful"),
        reason => console.log("Update failed:", reason));
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'event-card': EventCard;
  }
}