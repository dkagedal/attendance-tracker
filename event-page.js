import { LitElement, html, css } from 'lit-element';
import { classMap } from 'lit-html/directives/class-map';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';
import '@material/mwc-icon';
import '@material/mwc-icon-button';
import '@material/mwc-button';
import '@material/mwc-textfield';
import './time-range.js';

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
    }
  }

  constructor() {
    super();
    this.bandref = null;
    this.eventref = null;
    this.edit = false;
    this.itemTop = 0;
    this.itemHeight = 0;
    this.state = "hidden";
    this.event = {};
    this.myResponse = null;
  }

  clear() {
    this.bandref = null;
    this.eventref = null;
    this.event = {};
    this.edit = false;
    this.myResponse = null;
  }

  prepareAdd(bandref) {
    this.clear();
    this.bandref = bandref;
    this.edit = true;
  }

  joinDateTime(date, time) {
    console.log("joining", date, time)
    if (date) {
      if (time) {
        return `${date}T${time}`;
      } else {
        return date;
      }
    } else {
      return undefined;
    }
  }

  loadEvent(eventref) {
    this.clear();
    this.eventref = eventref;

    console.log('Fetching event', eventref)
    firebase.firestore().doc(eventref).get().then(doc => {
      if (doc.exists) {
        this.event = doc.data();
        var convstart = this.joinDateTime(this.event.startdate, this.event.starttime);
        if (convstart) {
          this.event.start = convstart
          delete this.event.startdate;
          delete this.event.starttime;
        }
        var convstop = this.joinDateTime(this.event.stopdate, this.event.stoptime);
        if (convstop) {
          this.event.stop = convstop
          delete this.event.stopdate;
          delete this.event.stoptime;
        }
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
          opacity 0.2s cubic-bezier(0.4, 0.0, 0.2, 1) 0.2s,
          top 0.2s cubic-bezier(0.4, 0.0, 0.2, 1),
          height 0.2s cubic-bezier(0.4, 0.0, 0.2, 1);
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
      .response {
        padding: 20px 50px;
      }
    `;
  }

  renderForm() {
    let startdate = this.event.start ? this.event.start.split('T')[0] : undefined;
    let starttime = this.event.start ? this.event.start.split('T')[1] : undefined;
    let stopdate = this.event.stop ? this.event.stop.split('T')[0] : undefined;
    let stoptime = this.event.stop ? this.event.stop.split('T')[1] : undefined;
    return html`<div class="edit-form">
      <mwc-textfield label="Typ" id="type" type="text" 
        value="${this.event ? this.event.type : ''}"></mwc-textfield>
      <mwc-textfield label="Plats" id="location" type="text"
        value="${this.event ? this.event.location : ''}"></mwc-textfield>
      <mwc-textfield label="Beskrivning" id="desc" type="text"
        value="${this.event ? this.event.description : ''}"></mwc-textfield>
      <mwc-textfield label="Datum" id="startdate" type="date"
        value="${ifDefined(startdate)}"></mwc-textfield>
      <mwc-textfield label="Tid" id="starttime" type="time"
        value="${ifDefined(starttime)}"></mwc-textfield>
      <mwc-textfield label="Datum" id="stopdate" type="date"
        value="${ifDefined(stopdate)}"></mwc-textfield>
      <mwc-textfield label="Tid" id="stoptime" type="time"
        value="${ifDefined(stoptime)}"></mwc-textfield>
      <br>
      <mwc-button raised type="button" @click=${e => this.save()}>Spara</mwc-button>
      </div>`;
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
          ${this.edit ? this.renderForm() : this.renderDisplay()}
        </div>
        <div class="response">
          <mwc-button dense @click=${e => this.respond("yes")} id="yes" label="Ja" ?outlined=${this.myResponse == 'yes'}></mwc-button>
          <mwc-button dense @click=${e => this.respond("no")} id="no" label="Nej" ?outlined=${this.myResponse == 'no'}></mwc-button>
          <mwc-button dense @click=${e => this.respond("maybe")} id="maybe" label="Kanske" ?outlined=${this.myResponse == 'maybe'}></mwc-button>
          <mwc-button dense @click=${e => this.respond("sub")} id="sub" label="Vikarie" ?outlined=${this.myResponse == 'sub'}></mwc-button>
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

  save() {
    let doc = {
      type: this.shadowRoot.getElementById('type').value,
      location: this.shadowRoot.getElementById('location').value,
      description: this.shadowRoot.getElementById('desc').value,
    };
    let start = this.joinDateTime(this.shadowRoot.getElementById('startdate').value,
                                  this.shadowRoot.getElementById('starttime').value);
    let stop = this.joinDateTime(this.shadowRoot.getElementById('stopdate').value,
                                 this.shadowRoot.getElementById('stoptime').value);
    if (start) { doc.start = start; }
    if (stop) { doc.stop = stop; }
    console.log("doc", doc);
    var promise;
    if (this.eventref) {
      console.log("Updating", this.eventref);
      promise = firebase.firestore().doc(this.eventref).set(doc).then(() => {
        console.log("Successfully updated event");
      })
    } else {
      let ref = this.bandref+"/events";
      console.log("Adding to %s", ref)
      promise = firebase.firestore().collection(ref).add(doc).then(docRef => {
        console.log("New event created with ID", docRef.id);
      });
    }
    promise.then(docRef => {
      this.close()
    }).catch(err => {
      console.error("Error creating event: ", err);
    });
  }
}

customElements.define('event-page', EventPage);
