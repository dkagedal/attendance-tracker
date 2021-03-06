
import "./event-editor"; import { LitElement, html, css, customElement, property, query } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';
import '@material/mwc-dialog';
import '@material/mwc-icon';
import '@material/mwc-icon-button';
import '@material/mwc-menu';
import '@material/mwc-formfield';
import '@material/mwc-radio';
import './time-range';
import './mini-roster';
import { Menu } from '@material/mwc-menu';
import { IconButton } from '@material/mwc-icon-button';
import { SelectedDetail } from '@material/mwc-list/mwc-list-foundation';
import { BandEvent, hasResponded, Member, ParticipantResponse } from './storage';
import { Dialog } from "@material/mwc-dialog";
import { EventEditor } from "./event-editor";
import { TextField } from "@material/mwc-textfield";
import { Radio } from "@material/mwc-radio";

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

interface Responses {
  [uid: string]: ParticipantResponse
}

interface Comments {
  [uid: string]: string,
}

@customElement("event-card")
export class EventCard extends LitElement {
  @property({ type: String })
  selfuid: string = "";

  @property({ type: Array, attribute: false })
  members: firebase.firestore.DocumentSnapshot[] = [];

  @property({ type: Object, attribute: false })
  event: firebase.firestore.DocumentSnapshot | null = null;

  @property({ type: Object, attribute: false })
  responses = {} as Responses;

  @property({ type: Object, attribute: false })
  comments = {} as Comments;

  @property({ type: String })
  responseuid: string = "";

  @query('#menu-button')
  menuButton: IconButton;

  @query('#menu')
  menu: Menu;

  @query('#event-editor-dialog')
  editDialog: Dialog;

  @query('event-editor')
  editor: EventEditor;

  @query('#response-dialog')
  responseDialog: Dialog;

  cancelParticipantsListener: () => void = () => { };

  needsResponse: boolean = false;

  getMemberData(uid: string): Member {
    for (let i = 0; i < this.members.length; i++) {
      const member = this.members[i];
      if (member.id == uid) {
        return this.members[i].data() as Member;
      }
    }
    return null;
  }

  fetchParticipants() {
    const event = this.event!;
    const ref = event.ref;
    // console.log(`event-card: Fetching participants ${ref.path}/participants`);
    this.cancelParticipantsListener();
    this.cancelParticipantsListener = ref.collection('participants').onSnapshot((snapshot) => {
      this.responses = {};
      this.comments = {};
      this.needsResponse = true;
      snapshot.docs.forEach((p) => {
        if (p.id == this.selfuid) {
          this.needsResponse = !hasResponded(p.data().attending);
        }
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
          padding: 0 20px;
          border-radius: 5px;
          border: solid #ddd 1px;
          background: white;
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
          margin: 16px 10px 16px 0;
        }
        .push-right {
          margin-left: auto;
          margin-right: -10px;
        }
        .event-type {
          font-weight: 600;
        }
        time-range {
          color: rgba(0, 0, 0, 0.7);
          margin: 16px 0;
        }
        .info {
          padding: 0 0 10px 0;
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
          margin: 6px 0;
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
        #myresponse {
            display: flex;
            flex-direction: column;
        }
        .prompt {
          display: flex;
          justify-content: center;
        }
        .prompt mwc-button {
          margin: 16px;
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
      case 2:  // change response
        this.openResponseDialog(this.selfuid);
    }
  }

  openResponseDialog(uid: string) {
    this.responseuid = uid;
  }

  renderResponseDialog(data: BandEvent) {
    if (this.responseuid == "") {
      return '';
    }
    const member = this.getMemberData(this.responseuid);
    const response = this.responses[this.responseuid];
    const comment = this.comments[this.responseuid];
    return html`
      <mwc-dialog id="response-dialog" open heading=${member.display_name} @closed=${this.sendResponse}>
        <div>
          <span class="event-type">${data.type}</span>
          <time-range start=${ifDefined(data.start)} stop=${ifDefined(data.stop)}></time-range>
        </div>
        <div class="info">
          <p>${data.location}</p>
          <p>${data.description}</p>
        </div>
        <div id="myresponse">
          <mwc-formfield label="Jag kommer">
            <mwc-radio id="yes" name="response" ?checked=${response == "yes"}></mwc-radio>
          </mwc-formfield>
          <mwc-formfield label="Jag kommer inte">
            <mwc-radio id="no" name="response" ?checked=${response == "no"}></mwc-radio>
          </mwc-formfield>
          <mwc-formfield label="Jag skickar ersättare">
            <mwc-radio id="sub" name="response" ?checked=${response == "sub"}></mwc-radio>
          </mwc-formfield>
          <mwc-formfield label="Inget svar">
            <mwc-radio id="maybe" name="response" ?checked=${!hasResponded(response)}></mwc-radio>
          </mwc-formfield>
          <mwc-textfield id="mycomment" label="Kommentar" value=${ifDefined(comment)}></mwc-textfield>
        </div>
        <mwc-button slot="primaryAction" dialogAction="ok">OK</mwc-button>
      </mwc-dialog>
    `;
  }

  sendResponse(event: CustomEvent): void {
    const uid = this.responseuid;
    this.responseuid = "";
    if (event.detail.action != "ok") {
      return;
    }
    console.log("Sending response");
    const dialog = event.target as Dialog;
    const data: any = {};
    console.log("Radio buttons:",);
    dialog.querySelectorAll('mwc-radio[name=response]').forEach((radio: Radio) => {
      if (radio.checked) {
        data.attending = radio.id;
      }
    })
    const commentField = dialog.querySelector('#mycomment')! as TextField;
    if (commentField.value) {
      data.comment = commentField.value;
    }
    const participantRef = this.event.ref.collection("participants").doc(uid);
    console.log("New data:", participantRef.path, data);
    participantRef.set(data, { merge: false }).then(
      () => console.log("Update successful"),
      reason => console.log("Update failed:", reason));
  }

  renderComment(member) {
    const data = member.data() as Member;
    return member.id in this.comments
      ? html`<p class="comment"><b>${data.display_name}</b> ${this.comments[member.id]}</p>`
      : '';
  }

  renderResponsePrompt() {
    return html`
      <div class="prompt">
        <mwc-button outlined icon="add_task" @click=${() => this.openResponseDialog(this.selfuid)}>Svara</mwc-button>
      </div>
      `;
  }

  render() {
    const data = this.event!.data()! as BandEvent
    return html`
      <div id="head">
        <span class="event-type">${data.type}</span>
        <time-range start=${ifDefined(data.start)} stop=${ifDefined(data.stop)}></time-range>
        <div class="push-right" style="position: relative">
          <mwc-icon-button id="menu-button" icon="more_vert" 
              @click=${() => this.menu.show()}></mwc-icon-button>
          <mwc-menu id="menu" corner="TOP_END" menuCorner="END" .anchor=${this.menuButton}
              @action=${this.menuAction}>
            <mwc-list-item>Redigera</mwc-list-item>
            <mwc-list-item>${data.cancelled ? "Ångra ställ in" : "Ställ in"}</mwc-list-item>
            <mwc-list-item>Ändra svar</mwc-list-item>
          </mwc-menu>
        </div>
        <mwc-dialog id="event-editor-dialog" @closing=${this.closingEditor}>
          <event-editor></event-editor>
          <mwc-button slot="primaryAction" dialogAction="save">Spara</mwc-button>
          <mwc-button slot="secondaryAction" dialogAction="cancel">Avbryt</mwc-button>
        </mwc-dialog>
      </div>
      <div class="info">
        <p>${data.location}</p>
        <p>${data.description}</p>
      </div>
      ${repeat(this.members, member => member.id, member => this.renderComment(member))}
      ${this.needsResponse && !data.cancelled ? this.renderResponsePrompt() : ''}
      ${this.renderResponseDialog(data)}
      <mini-roster .members=${this.members} .event=${this.event} .responses=${this.responses}
          @click-participant=${e => this.openResponseDialog(e.detail.uid)}></mini-roster>
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