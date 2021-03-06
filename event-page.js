import { LitElement, html, css } from 'lit-element';
import { classMap } from 'lit-html/directives/class-map';
import { styleMap } from 'lit-html/directives/style-map';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';
import '@material/mwc-dialog';
import '@material/mwc-icon';
import '@material/mwc-icon-button';
import '@material/mwc-button';
import '@material/mwc-tab';
import '@material/mwc-tab-bar';
import '@material/mwc-textfield';
import './datetime-input.js';
import './event-editor.js';
import './time-range.js';

const responseIcons = {
  yes: "thumb_up",
  no: "thumb_down",
  maybe: "thumbs_up_down",
  sub: "import_export",
}

const attendances = {
  "yes": "Ja",
  "no": "Nej",
  "maybe": "Återkommer",
  "sub": "Vikarie",
  "unknown": "",
}

var db = firebase.firestore();
if (location.hostname === "localhost") {
    db.settings({
      host: "localhost:8080",
      ssl: false
    });
  }

class EventPage extends LitElement {

  static get properties() {
    return {
      bandref: { type: String, reflect: true }, // "bands/abc"
      eventref: { type: String, reflect: true }, // "bands/abc/events/def"
      edit: { type: Boolean, reflect: true },
      itemTop: { type: Number, reflect: true },
      itemHeight: { type: Number, reflect: true },
      state: { type: String, reflect: true }, // "hidden", "aligning-to-grow", "full", "aligning-to-hide"
      event: { type: Object },
      editResponse: { type: String }, // UID or null
      participants: { type: Object },
      users: { type: Object },
    }
  }

  constructor() {
    super();
    this.clear();
    this.edit = false;
    this.itemTop = 0;
    this.itemHeight = 0;
    this.state = "hidden";
    this.users = {};
  }

  clear() {
    this.bandref = null;
    this.eventref = null;
    this.event = {};
    this.edit = false;
    this.editResponse = null;
    this.participants = {};
  }

  prepareAdd(bandref) {
    this.clear();
    this.bandref = bandref;
    this.edit = true;
  }

  loadEvent(eventref, event) {
    this.clear();
    this.eventref = eventref;

    console.log('Loading event', eventref, event)
    this.event = event;

    console.log("Fetching participants");
    db.collection(eventref + "/participants").onSnapshot(snapshot => {
      console.log("Got participants", snapshot);
      this.participants = {};
      snapshot.docs.forEach(p => {
        this.participants[p.id] = p.data();
      });
    });
  }

  countResponses() {
    let counts = { yes: 0, no: 0, maybe: 0, sub: 0 };
    for (let uid in this.participants) {
      let response = this.participants[uid].attending;
      counts[response] += 1;
    }
    return counts;
  }

  static get styles() {
    return css`
      #top {
        position: absolute; left: 0; width: 100%;
        z-index: 4;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 3px 3px 8px 1px rgba(0,0,0,0.4);
      }
      #top.hidden {
        display: none;
        opacity: 0;
      }
      #top.small {
        background: white;
      }
      .fullscreen {
        opacity: 100%;
      }
      #buttons {
        padding: 10px;
        display: flex;
      }
      #info {
        padding: 0 30px 1rem;
      }
      #summary {
        padding: 0 60px 0 60px;
        font-variant: all-petite-caps;
        font-weight: 600;
        background: white;
        color: rgba(0,0,0,0.5);
      }
      #participants {
        flex: 1;
        padding: 0 20px;
        display: flex;
        flex-direction: column;
        justify-contents: space-between;
        background: white;
        color: rgba(0,0,0,0.87);
        overflow: scroll;
      }
      .grow {
        transition:
          opacity 2s cubic-bezier(0.4, 0.0, 0.2, 1) 3s,
          background 0.5s cubic-bezier(0.4, 0.0, 0.2, 1),
          top 3s cubic-bezier(0.4, 0.0, 0.2, 1),
          height 3s cubic-bezier(0.4, 0.0, 0.2, 1);
      }
      .shrink {
        opacity: 0;
        transition:
          opacity 2s cubic-bezier(0.4, 0.0, 0.2, 1) 3s,
          background 0.5s cubic-bezier(0.4, 0.0, 0.2, 1),
          top 3s cubic-bezier(0.4, 0.0, 0.2, 1),
          height 3s cubic-bezier(0.4, 0.0, 0.2, 1);
      }
      .inverted {
        color: white;
        background: #2f9856;
      }
      div.edit-form {
      }
      .display {
        margin: 0 30px;
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
  }

  renderDisplay() {
    return html`<div class="display">
        <time-range start=${ifDefined(this.event.start)}
                    stop=${ifDefined(this.event.stop)}></time-range>
        <p class="heading">${this.event.type}</p>
        <p>${this.event.location}</p>
        <p>${this.event.description}</p>
      </div>`;
  }

  participantName(id) {
    console.log("users", this.users);
    let user = this.users[id];
    return user ? user.display_name : id;
  }

  responseButton(uid, participant, response) {
    return html`<mwc-button @click=${e => this.setAttending(uid, response)}
                            id="${response}"
                            icon="${responseIcons[response]}"
                            label="${attendances[response]}"
                            ?outlined="${participant.attending == response}"
                ></mwc-button>`;
  }

  clickParticipant(uid) {
    if (!this.edit && uid == firebase.auth().currentUser.uid) {
      this.editResponse = uid;
    }
  }

  userRow(uid, user) {
    let participant = this.participants[uid] || {};
    return html`<div class="participant-row" @click=${e => this.clickParticipant(uid)}>
         <mwc-icon class=${classMap({avatar: true, dimmed: !participant.attending})}>person</mwc-icon>
         <div class="row-main">
           <p class="participant-name">${user.display_name}</p>
           ${participant.comment
             ? html`<p class="comment">${participant.comment}</p>`
             : ''}
         </div>
         <span class="response">${attendances[participant.attending || "unknown"]}</span>
      </div>`;
  }

  renderMyResponseDialog() {
    let uid = this.editResponse;
    let participant = this.participants[uid] || {};
    return html`
      <mwc-dialog heading="Närvaro" ?open=${this.editResponse} @closed=${e => { this.editResponse = null }}>
        <div id="myresponse">
          ${this.responseButton(uid, participant, "yes")}
          ${this.responseButton(uid, participant, "no")}
          ${this.responseButton(uid, participant, "maybe")}
          ${this.responseButton(uid, participant, "sub")}
          <mwc-textfield label="Kommentar" id="comment" type="text" 
            value=${participant.comment || ''}
            @blur=${e => this.setComment(uid, e.path[0].value)}></mwc-textfield>
        </div>
        <mwc-button dialogAction="ok" slot="primaryAction">ok</mwc-button>
      </mwc-dialog>`;
  }

  render() {
    let counts = this.countResponses();
    let classes = {
      hidden: this.state == "hidden",
      small: this.state == "aligning-to-grow" || this.state == "aligning-to-hide", 
      shrink: this.state == "aligning-to-hide", 
      grow: this.state == "aligning-to-grow" || this.state == "full",
      fullscreen: this.state == "full",
    };
    let style = {}; // { display: this.state == "hidden" ? "none" : "block" };
    if (this.state == "full") {
      style.top = "0";
      style.height = "100vh";
    } else {
      style.top = this.itemTop + 'px';
      style.height = this.itemHeight + "px";
    } 
    return html`<div id="top" class=${classMap(classes)} style=${styleMap(style)}
          @transitionend=${ev => this.transitionend(ev)}>
        <div id="buttons" class="inverted">
          <mwc-icon-button icon="close" @click=${e => this.close()}></mwc-icon-button>
          <span style="flex: 1"> </span>
          ${this.eventref ? html`<mwc-icon-button icon="edit" @click=${e => { this.edit = !this.edit; }}></mwc-icon-button>` : ''}
        </div>
        <div id="info" class="inverted">
          ${this.edit ? html`<event-editor ?range=${this.event.stop}
                                           bandref="${ifDefined(this.bandref || undefined)}"
                                           eventref="${ifDefined(this.eventref || undefined)}"
                                           .event=${this.event}
                                           @saved=${e => this.close()}></event-editor>`
                      : this.renderDisplay()}
        </div>
        ${this.renderMyResponseDialog()}
        <div id="summary">
          ${counts["yes"] + counts["sub"]} ja/vik &ndash;
          ${counts["no"] + counts["sub"]} nej
        </div>
        <div id="participants">
          ${Object.entries(this.users).map(([uid, user]) => this.userRow(uid, user))}
        </div>
      </div>`;
  }

  transitionend(ev) {
    console.log("Transition end", this.state, ev.propertyName);
    // if (this.state == "growing" && ev.propertyName == "height") {
    //   console.log("New state: full");
    //   this.state = "full";
    // }
    if (this.state == "aligning-to-hide" && ev.propertyName == "opacity") {
      console.log("New state: hidden");
      this.state = "hidden";
    }
  }

  setAttending(uid, response) {
    let ref = this.eventref + "/participants/" + uid;
    db.doc(ref).set({ attending: response },
                                        { merge: true });
  }

  setComment(uid, comment) {
    let ref = this.eventref + "/participants/" + uid;
    db.doc(ref).set({ comment: comment },
                                      { merge: true });
  }

  async expandFrom(top, height) {
    this.itemTop = top;
    this.itemHeight = height;
    console.log("New state: aligning-to-grow");
    this.state = "aligning-to-grow";
    while (!await this.updateComplete) {
      console.log("Not complete yet")
    }
    console.log("New state: full");
    this.state = "full";
  }

  close() {
    console.log("New state: aligning-to-hide");
    this.state = "aligning-to-hide";
  }
}

customElements.define('event-page', EventPage);
