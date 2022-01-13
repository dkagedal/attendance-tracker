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
import { BandEvent } from "./storage";
import { Dialog } from "@material/mwc-dialog";
import { EventEditor } from "./event-editor";
import {
  collection,
  doc,
  DocumentSnapshot,
  onSnapshot,
  setDoc
} from "firebase/firestore";
import { customElement, property, query, state } from "lit/decorators";
import {
  Member,
  Participant,
  ParticipantResponse,
  responseString,
  UID
} from "./datamodel";
import { ResponseSelector } from "./response-selector";
import { Button } from "@material/mwc-button";
import { List } from "@material/mwc-list";

interface Participants {
  [uid: string]: Participant;
}

@customElement("event-card")
export class EventCard extends LitElement {
  @property({ type: String })
  selfuid: string = "";

  @property({ type: Array, attribute: false })
  members: Member[] = [];

  @property({ type: Object, attribute: false })
  event: DocumentSnapshot<BandEvent> | null = null;

  @state()
  participants = {} as Participants;

  @property({ type: String })
  responseuid: string = "";

  @property({ type: Boolean, reflect: true })
  cancelled: boolean = false;

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
      if (member.uid == uid) {
        return member;
      }
    }
    return null;
  }

  // Returns the participation info for uid, with a default if nothing is stored.
  getParticipant(uid: UID): Participant {
    return this.participants[uid] || new Participant(uid, "na", "");
  }

  fetchParticipants() {
    const event = this.event!;
    const ref = event.ref;
    this.cancelParticipantsListener();
    this.cancelParticipantsListener = onSnapshot(
      collection(ref, "participants").withConverter(Participant),
      snapshot => {
        this.participants = {};
        this.needsResponse = true;
        snapshot.docs.forEach(doc => {
          const participant: Participant = doc.data();
          if (participant.uid == this.selfuid) {
            this.needsResponse = !participant.hasResponded();
          }
          this.participants[participant.uid] = participant;
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
    #prompt {
      position: relative;
    }
    #prompt [mwc-list-item]:not([selected]) [slot="graphic"] {
      display: none;
    }
  `;

  menuAction(event: CustomEvent): void {
    const detail = event.detail as ActionDetail;
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
        return;
      default:
        const menu = event.target as Menu;
        const item = menu.items[detail.index];
        console.log("[menu action]", item);
        if (item.group && item.group.endsWith("menu-response")) {
          this.setResponse(
            this.selfuid,
            item.dataset["response"] as ParticipantResponse
          );
        }
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
    const participant = this.getParticipant(this.responseuid);
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
          response=${participant.response}
          comment=${participant.comment}
        ></response-selector>
        <mwc-button slot="primaryAction" dialogAction="ok">OK</mwc-button>
      </mwc-dialog>
    `;
  }

  setResponse(uid: UID, response?: ParticipantResponse, comment?: string) {
    const participantRef = doc(
      this.event.ref,
      "participants",
      uid
    ).withConverter(Participant);
    const participant = this.participants[uid];
    if (response != undefined) {
      participant.response = response;
    }
    if (comment != undefined) {
      participant.comment = comment;
    }
    console.log("New data:", participantRef.path, participant);
    setDoc(participantRef, participant, { merge: false }).then(
      () => console.log("Update successful"),
      reason => console.log("Update failed:", reason)
    );
  }

  sendResponse(event: CustomEvent): void {
    this.responseuid = "";
    if (event.detail.action != "ok") {
      return;
    }
    console.log("Sending response");
    const dialog = event.target as Dialog;
    const selector = dialog.querySelector(
      "response-selector"
    ) as ResponseSelector;
    this.setResponse(
      this.responseuid,
      selector.getResponse(),
      selector.getComment()
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
          member => member.uid,
          member => {
            const participant = this.participants[member.uid];
            return participant && participant.comment
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
        console.log(
          "RESPONSE",
          this.event.data().type,
          group,
          resp,
          currentResponse,
          selected
        );
        return html`
          <mwc-radio-list-item
            group=${this.event.id + "-" + group}
            data-response=${resp}
            ?selected=${selected}
          >
            ${responseString(resp as ParticipantResponse)}
          </mwc-radio-list-item>
        `;
      })}
    `;
  }

  renderResponsePrompt() {
    const response = this.participants[this.selfuid]?.response;
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
            const response = list.items[detail.index].dataset["response"];
            const participantRef = doc(
              this.event.ref,
              "participants",
              this.selfuid
            );
            console.log(
              "[response menu] Updating response",
              response,
              participantRef.path
            );
            setDoc(
              participantRef,
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
    let responses = {};
    for (const uid in this.participants) {
      responses[uid] = this.participants[uid].response;
    }
    console.log("RESPONSES", responses);
    return html`
      ${this.renderResponseDialog(data)}
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
          <mwc-list-item>Redigera</mwc-list-item>
          <mwc-list-item
            >${this.cancelled ? "Ångra ställ in" : "Ställ in"}</mwc-list-item
          >
          <mwc-list-item>Ändra svar</mwc-list-item>
          <li divider role="separator"></li>
          ${this.renderResponseMenuItems(
            "menu-response",
            this.participants[this.selfuid]?.response || "na"
          )}
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
