import "./response-selector";
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
import "@material/mwc-list/mwc-radio-list-item";
import "./time-range";
import "./mini-roster";
import { Menu } from "@material/mwc-menu";
import { IconButton } from "@material/mwc-icon-button";
import { ActionDetail } from "@material/mwc-list/mwc-list-foundation";
import { auth } from "./storage";
import { Dialog } from "@material/mwc-dialog";
import { EventEditor } from "./event-editor";
import { onSnapshot, setDoc } from "firebase/firestore";
import { customElement, property, query, state } from "lit/decorators";
import { responseString, UID } from "./datamodel";
import { ResponseSelector } from "./response-selector";
import { Button } from "@material/mwc-button";
import { List } from "@material/mwc-list";
import { BandEvent } from "./model/bandevent";
import {
  emptyParticipant,
  Participant,
  ParticipantResponse
} from "./model/participant";
import { Member } from "./model/member";

@customElement("event-card")
export class EventCard extends LitElement {
  @property({ type: Array, attribute: false })
  members: Member[] = [];

  @property({ type: Object, attribute: false })
  event: BandEvent = null;

  @state()
  participants: { [uid: UID]: Participant } = {};

  // Export this as an attribute so it can be used in CSS selectors.
  @property({ type: Boolean, reflect: true })
  get cancelled() {
    return this.event.cancelled;
  }

  @state()
  responseuid: string = null;

  @query("#menu-button")
  menuButton: IconButton;

  @query("#menu")
  menu: Menu;

  @query("#prompt mwc-button")
  promptButton: Button;

  @query("#prompt mwc-menu")
  promptMenu: Menu;

  @query("#event-editor-dialog")
  editDialog: Dialog;

  @query("event-editor")
  editor: EventEditor;

  @query("#response-dialog")
  responseDialog: Dialog;

  cancelParticipantsListener: () => void = () => {};

  needsResponse: boolean = false;

  getMemberData(uid: UID): Member {
    for (const member of this.members) {
      if (member.id == uid) {
        return member;
      }
    }
    return null;
  }

  fetchParticipants() {
    const event = this.event!;
    this.cancelParticipantsListener();
    this.cancelParticipantsListener = onSnapshot(
      event.ref.participants().dbref,
      snapshot => {
        this.participants = {};
        this.needsResponse = true;
        snapshot.docs.forEach(doc => {
          const participant: Participant = doc.data();
          if (participant.uid == auth.currentUser.uid) {
            this.needsResponse = !participant.hasResponded();
          }
          this.participants[participant.uid] = participant;
        });
        // Set defaults for missing responses, so that this.participants is always fully populated.
        for (const member of this.members) {
          if (!(member.id in this.participants)) {
            this.participants[member.id] = emptyParticipant(member.id);
          }
        }
        console.log("[event-card] Updated participants", this.participants);
      }
    );
  }

  updated(changedProperties: any) {
    if (changedProperties.has("event") && this.event) {
      this.fetchParticipants();
    }
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
    #prompt {
      position: relative;
    }
  `;

  menuAction(event: CustomEvent): void {
    const detail = event.detail as ActionDetail;
    switch (detail.index) {
      case 0: // edit
        console.log("Edit event");
        this.editor.data = this.event;
        this.editor.range = this.event.hasStopTime();
        this.editDialog.show();
        return;
      case 1: // cancel
        console.log(
          "Cancel event",
          this.event.cancelled,
          "to",
          !this.event.cancelled
        );
        this.event.ref
          .update({ cancelled: !this.event.cancelled }, { merge: true })
          .then(
            () => console.log("Cancel successful"),
            reason => console.log("Cancel failed:", reason)
          );
        return;
      case 2: // change response
        this.openResponseDialog(auth.currentUser.uid);
        return;
      default:
        const menu = event.target as Menu;
        const item = menu.items[detail.index];
        console.log("[menu action]", item);
        if (item.group && item.group.endsWith("menu-response")) {
          this.setResponse(
            auth.currentUser.uid,
            item.dataset["response"] as ParticipantResponse
          );
        }
        this.requestUpdate();
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
    if (!member) {
      return "";
    }
    const participant = this.participants[this.responseuid];
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
        <response-selector
          id="myresponse"
          uid=${this.responseuid}
          response=${participant.attending}
          comment=${participant.comment}
        ></response-selector>
        <mwc-button slot="primaryAction" dialogAction="ok">OK</mwc-button>
      </mwc-dialog>
    `;
  }

  setResponse(uid: UID, response?: ParticipantResponse, comment?: string) {
    console.log("REF", this.event.ref, "participants", uid);
    const ref = this.event.ref.participant(uid);
    const participant = this.participants[uid];
    if (response != undefined) {
      participant.attending = response;
    }
    if (comment !== undefined) {
      participant.comment = comment;
    }
    console.log("New data:", ref.dbref.path, participant);
    setDoc(ref.dbref, participant, { merge: false }).then(
      () => console.log("Update successful"),
      reason => console.log("Update failed:", reason)
    );
  }

  sendResponse(event: CustomEvent): void {
    const uid = this.responseuid;
    this.responseuid = "";
    if (event.detail.action != "ok") {
      return;
    }
    console.log("Sending response");
    const dialog = event.target as Dialog;
    const selector = dialog.querySelector(
      "response-selector"
    ) as ResponseSelector;
    this.setResponse(uid, selector.getResponse(), selector.getComment());
  }

  renderComments() {
    if (this.cancelled || Object.keys(this.participants).length == 0) {
      return "";
    }
    return html`
      <div class="comments">
        ${repeat(
          this.members,
          member => member.id,
          member => {
            const participant = this.participants[member.id];
            return participant?.comment
              ? html`
                  <p class="comment">
                    <b>${member.display_name} —</b> ${participant.comment}
                  </p>
                `
              : "";
          }
        )}
      </div>
    `;
  }

  renderResponseMenuItems(group: string, currentResponse: ParticipantResponse) {
    return html`
      ${repeat(["yes", "no", "sub", "na"], resp => {
        const selected = resp == currentResponse;
        return html`
          <mwc-list-item
            graphic="icon"
            group=${this.event.ref.id + "-" + group}
            data-response=${resp}
            ?selected=${selected}
          >
            ${selected
              ? html`
                  <mwc-icon slot="graphic">check</mwc-icon>
                `
              : ""}
            <span>${responseString(resp as ParticipantResponse)}</span>
          </mwc-list-item>
        `;
      })}
    `;
  }

  renderResponsePrompt() {
    const response = this.participants[auth.currentUser.uid].attending;
    return html`
      <div id="prompt">
        <mwc-button
          trailingIcon
          icon="arrow_drop_down"
          @click=${() => this.promptMenu.show()}
          >${responseString(response)}</mwc-button
        >
        <mwc-menu
          corner="TOP_START"
          menuCorner="START"
          .anchor=${this.promptButton}
          @action=${(e: CustomEvent) => {
            const detail = e.detail as ActionDetail;
            const list = e.target as List;
            const response = list.items[detail.index].dataset[
              "response"
            ] as ParticipantResponse;
            const participantRef = this.event.ref.participant(
              auth.currentUser.uid
            );
            console.log(
              "[response menu] Updating response",
              response,
              participantRef.dbref.path
            );
            setDoc(
              participantRef.dbref,
              { attending: response },
              { merge: true }
            ).then(
              () => console.log("Update successful"),
              reason => console.log("Update failed:", reason)
            );
          }}
        >
          ${this.renderResponseMenuItems("prompt-response", response)}
        </mwc-menu>
      </div>
    `;
  }

  renderHead() {
    return html`
      <div id="desc">
        <div id="head">
          <span class="event-type">${this.event.type}</span>
          <time-range
            start=${ifDefined(this.event.start)}
            stop=${ifDefined(this.event.stop)}
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
          <p>${this.event.location}</p>
          <p>${this.event.description}</p>
        </div>
        ${this.needsResponse ? this.renderResponsePrompt() : ""}
      </div>
    `;
  }

  renderResponses() {
    let responses = {};
    for (const uid in this.participants) {
      responses[uid] = this.participants[uid].attending;
    }
    return html`
      ${this.renderResponseDialog(this.event)}
      <mini-roster
        .members=${this.members}
        .event=${this.event}
        .responses=${responses}
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
          <mwc-list-item graphic="icon">Redigera</mwc-list-item>
          <mwc-list-item graphic="icon"
            >${this.cancelled ? "Ångra ställ in" : "Ställ in"}</mwc-list-item
          >
          <mwc-list-item graphic="icon">Ändra svar</mwc-list-item>
          <li divider role="separator"></li>
          ${!this.cancelled && auth.currentUser.uid in this.participants
            ? this.renderResponseMenuItems(
                "menu-response",
                this.participants[auth.currentUser.uid].attending
              )
            : ""}
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
      const event = this.editor.data;
      console.log("New data:", event);
      setDoc(this.event.ref.dbref, event, {
        merge: false
      }).then(
        () => console.log("Update successful"),
        reason => console.log("Update failed:", reason)
      );
    }
  }
}
