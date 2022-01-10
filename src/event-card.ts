import "./event-editor";
import { LitElement, html, css } from "lit";
import { repeat } from "lit/directives/repeat";
import { ifDefined } from "lit/directives/if-defined";
import "@material/mwc-dialog";
import "@material/mwc-icon";
import "@material/mwc-icon-button";
import "@material/mwc-menu";
import "@material/mwc-formfield";
import "@material/mwc-radio";
import "./time-range";
import "./mini-roster";
import { Menu } from "@material/mwc-menu";
import { IconButton } from "@material/mwc-icon-button";
import { SelectedDetail } from "@material/mwc-list/mwc-list-foundation";
import { BandEvent, hasResponded, ParticipantResponse } from "./storage";
import { Dialog } from "@material/mwc-dialog";
import { EventEditor } from "./event-editor";
import { TextField } from "@material/mwc-textfield";
import { Radio } from "@material/mwc-radio";
import {
  collection,
  doc,
  DocumentSnapshot,
  onSnapshot,
  QueryDocumentSnapshot,
  setDoc
} from "firebase/firestore";
import { customElement, property, query } from "lit/decorators";
import { Member } from "./datamodel";

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
  [uid: string]: ParticipantResponse;
}

interface Comments {
  [uid: string]: string;
}

@customElement("event-card")
export class EventCard extends LitElement {
  @property({ type: String })
  selfuid: string = "";

  @property({ type: Array, attribute: false })
  members: QueryDocumentSnapshot<Member>[] = [];

  @property({ type: Object, attribute: false })
  event: DocumentSnapshot<BandEvent> | null = null;

  @property({ type: Object, attribute: false })
  responses = {} as Responses;

  @property({ type: Object, attribute: false })
  comments = {} as Comments;

  @property({ type: String })
  responseuid: string = "";

  @property({ type: Boolean, reflect: true })
  cancelled: boolean = false;

  @query("#menu-button")
  menuButton: IconButton;

  @query("#menu")
  menu: Menu;

  @query("#event-editor-dialog")
  editDialog: Dialog;

  @query("event-editor")
  editor: EventEditor;

  @query("#response-dialog")
  responseDialog: Dialog;

  cancelParticipantsListener: () => void = () => {};

  needsResponse: boolean = false;

  getMemberData(uid: string): Member {
    for (let i = 0; i < this.members.length; i++) {
      const member = this.members[i];
      if (member.id == uid) {
        return this.members[i].data();
      }
    }
    return null;
  }

  fetchParticipants() {
    const event = this.event!;
    const ref = event.ref;
    // console.log(`event-card: Fetching participants ${ref.path}/participants`);
    this.cancelParticipantsListener();
    this.cancelParticipantsListener = onSnapshot(
      collection(ref, "participants"),
      snapshot => {
        this.responses = {};
        this.comments = {};
        this.needsResponse = true;
        snapshot.docs.forEach(p => {
          if (p.id == this.selfuid) {
            this.needsResponse = !hasResponded(p.data().attending);
          }
          this.responses[p.id] = p.data().attending;
          if (p.data().comment != undefined) {
            this.comments[p.id] = p.data().comment;
          }
        });
      }
    );
  }

  updated(changedProperties: any) {
    changedProperties.forEach((_oldValue: any, propName: string) => {
      if (propName == "event") {
        this.fetchParticipants();
        this.cancelled = this.event.data().cancelled;
      }
    });
  }

  static styles = css`
    :host {
      display: flex;
      flex: row;
    }
    #main {
      flex-grow: 1;
      padding: 10px 10px;
    }
    .hstack {
      display: flex;
      flex-flow: row wrap;
      justify-content: space-between;
    }
    #desc {
      flex: 1 1 400px;
    }
    #head {
      display: flex;
      gap: 0.5em;
    }
    span.chip {
      border-radius: 0.5em;
      padding: 0 0.5em;
    }
    span.cancelled {
      background: rgba(200 0 0 / 30%);
    }
    .event-type {
      font-weight: 600;
    }
    time-range {
      color: rgba(0, 0, 0, 0.7);
    }
    .info {
      padding: 0 0 10px 0;
      color: rgba(0, 0, 0, 0.54);
      font-size: 0.875rem;
      font-weight: 400;
    }
    .comments {
      margin-bottom: 10px;
    }
    .comment {
      margin: 0 20px;
      color: rgba(0, 0, 0, 0.54);
      font-size: 0.875rem;
      font-weight: 400;
    }
    mini-roster {
      flex: 5 1 400px;
      margin: 6px 0;
    }
    .summary {
      padding: 0 40px 0 40px;
      font-variant: all-petite-caps;
      color: rgba(0, 0, 0, 0.5);
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
    const data = this.event!.data()! as BandEvent;
    switch (detail.index) {
      case 0: // edit
        console.log("Edit event");
        this.editor.data = data;
        this.editor.range = "stop" in data;
        this.editDialog.show();
        return;
      case 1: // cancel
        console.log("Cancel event", data.cancelled, "to", !data.cancelled);
        setDoc(
          this.event.ref,
          { cancelled: !data.cancelled },
          { merge: true }
        ).then(
          () => console.log("Cancel successful"),
          reason => console.log("Cancel failed:", reason)
        );
        return;
      case 2: // change response
        this.openResponseDialog(this.selfuid);
    }
  }

  openResponseDialog(uid: string) {
    this.responseuid = uid;
  }

  renderResponseDialog(data: BandEvent) {
    if (this.responseuid == "") {
      return "";
    }
    const member = this.getMemberData(this.responseuid);
    const response = this.responses[this.responseuid];
    const comment = this.comments[this.responseuid];
    return html`
      <mwc-dialog
        id="response-dialog"
        open
        heading=${member.display_name}
        @closed=${this.sendResponse}
      >
        <div>
          <span class="event-type">${data.type}</span>
          <time-range
            start=${ifDefined(data.start)}
            stop=${ifDefined(data.stop)}
          ></time-range>
        </div>
        <div class="info">
          <p>${data.location}</p>
          <p>${data.description}</p>
        </div>
        <div id="myresponse">
          <mwc-formfield label="Jag kommer">
            <mwc-radio
              id="yes"
              name="response"
              ?checked=${response == "yes"}
            ></mwc-radio>
          </mwc-formfield>
          <mwc-formfield label="Jag kommer inte">
            <mwc-radio
              id="no"
              name="response"
              ?checked=${response == "no"}
            ></mwc-radio>
          </mwc-formfield>
          <mwc-formfield label="Jag skickar ersättare">
            <mwc-radio
              id="sub"
              name="response"
              ?checked=${response == "sub"}
            ></mwc-radio>
          </mwc-formfield>
          <mwc-formfield label="Inget svar">
            <mwc-radio
              id="maybe"
              name="response"
              ?checked=${!hasResponded(response)}
            ></mwc-radio>
          </mwc-formfield>
          <mwc-textfield
            id="mycomment"
            label="Kommentar"
            value=${ifDefined(comment)}
          ></mwc-textfield>
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
    console.log("Radio buttons:");
    dialog
      .querySelectorAll("mwc-radio[name=response]")
      .forEach((radio: Radio) => {
        if (radio.checked) {
          data.attending = radio.id;
        }
      });
    const commentField = dialog.querySelector("#mycomment")! as TextField;
    if (commentField.value) {
      data.comment = commentField.value;
    }
    const participantRef = doc(this.event.ref, "participants", uid);
    console.log("New data:", participantRef.path, data);
    setDoc(participantRef, data, { merge: false }).then(
      () => console.log("Update successful"),
      reason => console.log("Update failed:", reason)
    );
  }

  renderComments() {
    if (this.cancelled) {
      return "";
    }
    return html`
      <div class="comments">
        ${repeat(
          this.members,
          member => member.id,
          member => {
            const data = member.data();
            return member.id in this.comments
              ? html`
                  <p class="comment">
                    <b>${data.display_name} —</b> ${this.comments[member.id]}
                  </p>
                `
              : "";
          }
        )}
      </div>
    `;
  }

  renderResponsePrompt() {
    return html`
      <div class="prompt">
        <mwc-button
          outlined
          icon="add_task"
          @click=${() => this.openResponseDialog(this.selfuid)}
          >Svara</mwc-button
        >
      </div>
    `;
  }

  renderHead() {
    const data = this.event!.data()!;
    return html`
      <div id="desc">
        <div id="head">
          <span class="event-type">${data.type}</span>
          <time-range
            start=${ifDefined(data.start)}
            stop=${ifDefined(data.stop)}
          ></time-range>
          ${this.cancelled
            ? html`
                <span class="chip cancelled">Inställt</span>
              `
            : ""}
          <mwc-dialog id="event-editor-dialog" @closing=${this.closingEditor}>
            <event-editor></event-editor>
            <mwc-button slot="primaryAction" dialogAction="save"
              >Spara</mwc-button
            >
            <mwc-button slot="secondaryAction" dialogAction="cancel"
              >Avbryt</mwc-button
            >
          </mwc-dialog>
        </div>
        <div class="info">
          <p>${data.location}</p>
          <p>${data.description}</p>
        </div>
        ${this.needsResponse ? this.renderResponsePrompt() : ""}
      </div>
    `;
  }

  renderResponses() {
    const data = this.event!.data()!;
    return html`
      ${this.renderResponseDialog(data)}
      <mini-roster
        .members=${this.members}
        .event=${this.event}
        .responses=${this.responses}
        @click-participant=${e => this.openResponseDialog(e.detail.uid)}
      ></mini-roster>
    `;
  }

  render() {
    return html`
      <div id="main">
        <div class="hstack">
          ${this.renderHead()} ${this.cancelled ? "" : this.renderResponses()}
        </div>
        ${this.renderComments()}
      </div>
      <div style="position: relative">
        <mwc-icon-button
          id="menu-button"
          icon="more_vert"
          @click=${() => this.menu.show()}
        ></mwc-icon-button>
        <mwc-menu
          id="menu"
          corner="TOP_END"
          menuCorner="END"
          .anchor=${this.menuButton}
          @action=${this.menuAction}
        >
          <mwc-list-item>Redigera</mwc-list-item>
          <mwc-list-item
            >${this.cancelled ? "Ångra ställ in" : "Ställ in"}</mwc-list-item
          >
          <mwc-list-item>Ändra svar</mwc-list-item>
        </mwc-menu>
      </div>
    `;
  }

  closingEditor(event: CustomEvent): void {
    console.log("Closing editor:", event.detail);
    if (event.detail.action == "save") {
      if (!this.editor.checkValidity()) {
        console.log("Invalid data, not saving");
      }
      this.editor.save();
      const data = this.editor.data;
      console.log("New data:", data);
      setDoc(this.event.ref, data, { merge: false }).then(
        () => console.log("Update successful"),
        reason => console.log("Update failed:", reason)
      );
    }
  }
}
