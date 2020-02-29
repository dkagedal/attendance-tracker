import { LitElement, html, css } from 'lit-element';
import { classMap } from 'lit-html/directives/class-map';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';
import '@material/mwc-icon';
import '@material/mwc-icon-button';
import '@material/mwc-button';
import '@material/mwc-list';
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
  "maybe": "Kanske",
  "sub": "Vikarie",
  "unknown": "Inte svarat",
}

class EventPage extends LitElement {

  static get properties() {
    return {
      bandref: { type: String, reflect: true }, // "bands/abc"
      eventref: { type: String, reflect: true }, // "bands/abc/events/def"
      edit: { type: Boolean, reflect: true },
      itemTop: { type: Number, reflect: true },
      itemHeight: { type: Number, reflect: true },
      state: { type: String, reflect: true }, // "hidden", "small", "expanded"
      event: { type: Object },
      myResponse: { type: String },
      participants: { type: Array },
      users: { type: Array },
    }
  }

  constructor() {
    super();
    this.clear();
    this.edit = false;
    this.itemTop = 0;
    this.itemHeight = 0;
    this.state = "hidden";
    this.users = [];
  }

  clear() {
    this.bandref = null;
    this.eventref = null;
    this.event = {};
    this.edit = false;
    this.myResponse = null;
    this.participants = [];
  }

  prepareAdd(bandref) {
    this.clear();
    this.bandref = bandref;
    this.edit = true;
  }

  loadEvent(eventref) {
    this.clear();
    this.eventref = eventref;

    console.log('Fetching event', eventref)
    firebase.firestore().doc(eventref).get().then(doc => {
      if (doc.exists) {
        this.event = doc.data();
        console.log('Got event snapshot ', this.event);
      } else {
        console.log('event', eventref, 'did not exist');
      }
    });

    let user = firebase.auth().currentUser;
    let meref = eventref + "/participants/" + user.uid;
    console.log("Fetching my participant", meref);
    firebase.firestore().doc(meref).onSnapshot(doc => {
      console.log("Got my participant", doc);
      let attending = "unknown";
      if (doc.exists) {
        attending = doc.data().attending || "unknown";
      }
      this.myResponse = attending;
    });

    console.log("Fetching participants");
    firebase.firestore().collection(eventref + "/participants").onSnapshot(snapshot => {
      console.log("Got participants", snapshot);
      this.participants = snapshot.docs;
    });
  }

  static get styles() {
    return css`
      #top {
        position: absolute; left: 0; width: 100%;
        z-index: 1;
        overflow: hidden;
        box-shadow: 3px 3px 8px 1px rgba(0,0,0,0.4);
      }
      .hidden {
        opacity: 0;
      }
      .shrink {
        opacity: 0;
        transition:
          opacity 0.2s cubic-bezier(0.4, 0.0, 0.2, 1) 0.3s,
          top 0.3s cubic-bezier(0.4, 0.0, 0.2, 1),
          height 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
      }
      .expand {
        background: white; opacity: 100%;
        top: 0; height: 100%;
        transition:
          opacity 0.3s cubic-bezier(0.4, 0.0, 0.2, 1),
          top 0.3s cubic-bezier(0.4, 0.0, 0.2, 1) 0.2s,
          height 0.3s cubic-bezier(0.4, 0.0, 0.2, 1) 0.2s;
      }
      .buttons {
        padding: 10px;
        display: flex;
      }
      .info {
        padding: 0 20px;
      }
      div.edit-form {
      }
      mwc-textfield {
        margin-bottom: 10px;
      }
      mwc-textfield[type=text] {
        width: 100%;
      }
      .display {
        margin: 0 40px;
      }
      p {
        margin: 4px 0;
      }
      .heading {
        font-weight: 600;
        margin-top: 16px;
      }
      .myresponse {
        padding: 20px 50px;
      }
      .participant-row {
        display: flex;
        flex-direction: row;
        align-items: center;
        margin: 8px 32px;
      } 
      .participant-row .avatar {
        padding: 10px;
      }
      .participant-row .row-main {
        display: inline;
        margin: 0 16px;
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
        padding: 10px;
        font-weight: 600;
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

  responseButton(response) {
    return html`<mwc-icon-button @click=${e => this.respond(response)}
                            id="${response}"
                            icon="${responseIcons[response]}"
                            label="${attendances[response]}"
                            style="color: ${this.myResponse == response ? '#5544bb' : '#888888'}"
                ></mwc-icon-button>`;
  }

  render() {
    let classes = { hidden: this.state == "hidden", 
                    shrink: this.state == "small", 
                    expand: this.state == "expanded" };
    return html`<div id="top" class=${classMap(classes)}
          style="${this.state != "expanded" ? `top: ${this.itemTop}px; height: ${this.itemHeight}px;` : ''}">
        <div class="buttons">
          <mwc-icon-button icon="close" @click=${e => this.close()}></mwc-icon-button>
          <span style="flex: 1"> </span>
          ${this.eventref ? html`<mwc-icon-button icon="edit" @click=${e => { this.edit = !this.edit; }}></mwc-icon-button>` : ''}
        </div>
        <div class="info">
          ${this.edit ? html`<event-editor ?range=${this.event.stop}
                                           bandref="${ifDefined(this.bandref || undefined)}"
                                           eventref="${ifDefined(this.eventref || undefined)}"
                                           .event=${this.event}
                                            @saved=${e => this.close()}></event-editor>`
                      : this.renderDisplay()}
        </div>
        <div class="myresponse">
          ${this.responseButton("yes")}
          ${this.responseButton("no")}
          ${this.responseButton("maybe")}
          ${this.responseButton("sub")}
        </div>
        <div class="participants">
          ${repeat(this.participants, p => p.id, 
            (p, index) => html`<div class="participant-row">
               <mwc-icon class="avatar">person</mwc-icon>
               <div class="row-main">
                 <p class="participant-name">${this.participantName(p.id)}</p>
                 ${p.data().comment ? html`<p class="comment">${p.data().comment}</p>` : ''}
               </div>
               <span class="response">${attendances[p.data().attending || "unknown"]}</span>
               </p>
               
            </div>`)}
        </div>
      </div>`;
  }

  respond(response) {
    console.log("Responding", response);
    let user = firebase.auth().currentUser;
    let meref = this.eventref + "/participants/" + user.uid;
    firebase.firestore().doc(meref).set({
      attending: response
    }, { merge: true })
  }

  async expandFrom(top, height) {
    this.itemTop = top;
    this.itemHeight = height;
    this.state = "hidden";
    console.log("Requesting update", this.shadowRoot.getElementById("top").style.cssText);
    var promise = this.requestUpdate('state', 'hidden');
    while (!await promise) {
      promise = this.updateComplete;
    }
    console.log("Updated?", this.shadowRoot.getElementById("top").style.cssText);
    this.state = "expanded";
  }

  close() {
    this.state = "small";
  }
}

customElements.define('event-page', EventPage);
