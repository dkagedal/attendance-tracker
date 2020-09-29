import { LitElement, html, css } from 'lit-element';
import { classMap } from 'lit-html/directives/class-map';
import { styleMap } from 'lit-html/directives/style-map';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';
import '@material/mwc-dialog';
import '@material/mwc-icon';
import '@material/mwc-icon-button';
import '@material/mwc-button';
import '@material/mwc-menu';
import '@material/mwc-list/mwc-list-item';
import '@material/mwc-tab';
import '@material/mwc-tab-bar';
import '@material/mwc-textfield';
import './datetime-input.js';
import './event-editor.js';
import './time-range.js';
import { getUser } from './users.js';

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

class EventCard extends LitElement {

  static get properties() {
    return {
      members: { type: Array, attribute: false }, // [DocumentSnapshot]
      event: { type: Object, attribute: false },  // QueryDocumentSnapshot
      responses: { type: Object, attribute: false },
      comments: { type: Object, attribute: false },
      expanded: { type: Boolean },
      openmenu: { type: Boolean },
    }
  }

  constructor() {
    super();
    this.members = [];
    this.event = null;
    this.responses = [];
    this.comments = []
    this.expanded = false;
    this.openmenu = false;
  }

  fetchParticipants() {
    console.log(`event-card: Fetching participants ${this.event.ref.path}/participants`);
    // TODO: remember the cancel function.
    this.event.ref.collection('participants').onSnapshot(snapshot => {
      const responses = {};
      this.comments = [];
      snapshot.docs.forEach(p => {
        responses[p.id] = p.data().attending;
        if (p.data().comment != undefined) {
          this.comments[p.id] = p.data().comment;
        }
      });
      this.responses = responses;
    });
  }

  updated(changedProperties) {
    changedProperties.forEach((oldValue, propName) => {
      if (propName == 'event') {
        this.fetchParticipants()
      }
    })
  }

  static get styles() {
    return css`
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
        #participants {
            flex: 1;
            padding: 0 20px;
            display: flex;
            flex-direction: column;
            justify-contents: space-between;
            color: rgba(0,0,0,0.87);
            overflow: scroll;
        }
        div.edit-form {
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
  }

  renderDisplay() {
    return html`<div class="display">
        <time-range start=${ifDefined(this.event.data().start)}
        stop=${ifDefined(this.event.data().stop)}></time-range>
        <p>${this.event.data().location}</p>
        <p>${this.event.data().description}</p>
        </div>`;
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
    console.log('participant clicked', uid, firebase.auth().currentUser);
    if (!this.edit && uid == firebase.auth().currentUser.uid) {
      this.editResponse = uid;
    }
  }

  userRow(uid, user) {
    let participant = this.participants[uid] || {};
    return html`<div class="participant-row" @click=${e => this.clickParticipant(uid)}>
        <mwc-icon class=${classMap({ avatar: true, dimmed: !participant.attending })}>person</mwc-icon>
        <div class="row-main">
        <p class="participant-name">${user.display_name}</p>
        ${participant.comment
        ? html`<p class="comment">${participant.comment}</p>`
        : ''
      }
        </div>
        <span class="response">${attendances[participant.attending || "unknown"]}</span>
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
    const sections = [];
    return html`
      <div id="head" @click=${e => { this.expanded = true }}>
        <span class="event-type">${this.edit ? '' : this.event.data().type}</span>
        <time-range start=${ifDefined(this.event.data().start)} stop=${ifDefined(this.event.data().stop)}></time-range>
        ${this.expanded ? html`<mwc-icon-button class="push-right" icon="more_vert" 
            @click=${e => { this.openmenu = !this.openmenu }}></mwc-icon-button>` : ''}
        <mwc-menu id="menu" ?open=${this.openmenu}>
          <mwc-list-item>Redigera</mwc-list-item>
          <mwc-list-item>Ställ in</mwc-list-item>
        </mwc-menu>
      </div>
      <div id="info">
        <p>${this.event.data().location}</p>
        <p>${this.event.data().description}</p>
      </div>
      ${repeat(this.members, member => member.id, member => {
      return member.id in this.comments ? html`<p class="comment"><b>${member.data().display_name}</b> ${this.comments[member.id]}</p>` : '';
    })}
      <mini-roster .members=${this.members} .event=${this.event} .responses=${this.responses}></mini-roster>
      `;
  }

  setAttending(uid, response) {
    let ref = `${this.event.ref.path}/participants/${uid}`;
    db.doc(ref).set({ attending: response }, { merge: true });
  }

  setComment(uid, comment) {
    let ref = `${this.event.ref.path}/participants/${uid}`;
    db.doc(ref).set({ comment: comment }, { merge: true });
  }

  close() {
    let event = new CustomEvent("close", {});
    this.dispatchEvent(event);
  }
}

customElements.define('event-card', EventCard);
