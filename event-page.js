import { LitElement, html, css } from 'lit-element';
import { classMap } from 'lit-html/directives/class-map';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';
import '@material/mwc-icon';
import '@material/mwc-icon-button';
import '@material/mwc-button';
import '@material/mwc-textfield';

const timestampProperty = { 
  type: Object,  
  converter: (value, type) => {
    return Date.parse(value);
  }
};

const shortDate = new Intl.DateTimeFormat('sv-SE', {
  'year': 'numeric', 'month': '2-digit', 'day': '2-digit'
});

const shortTime = new Intl.DateTimeFormat('sv-SE', {
  'hour': '2-digit', 'minute': '2-digit'
});

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
    this.event = null;
  }

  clear() {
    this.bandref = null;
    this.eventref = null;
    this.event = null;
    this.edit = false;
  }

  prepareAdd(bandref) {
    this.clear();
    this.bandref = bandref;
    this.edit = true;
  }

  loadEvent(eventref) {
    this.clear();
    this.eventref = eventref;
    console.log('Fetching ', eventref)
    return firebase.firestore().doc(eventref).get().then(doc => {
      if (doc.exists) {
        this.event = doc.data();
        console.log('Got event snapshot ', this.event);
      } else {
        console.log('event', eventref, 'did not exist');
      }
    });
  }

  attributeChangedCallback(name, oldval, newval) {
    super.attributeChangedCallback(name, oldval, newval);
    if (name == 'bandref') {
      this.event = null;
    }
    if (name == 'eventref') {
      this.event = null;
      if (newval) {
      }
    }
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
          opacity 0.5s cubic-bezier(0.4, 0.0, 0.2, 1) 0.5s,
          top 0.4s cubic-bezier(0.4, 0.0, 0.2, 1),
          height 0.5s cubic-bezier(0.4, 0.0, 0.2, 1);
      }
      .expand {
        background: white; opacity: 100%;
        top: 0; height: 100%;
        transition:
          opacity 0.5s cubic-bezier(0.4, 0.0, 0.2, 1),
          top 0.4s cubic-bezier(0.4, 0.0, 0.2, 1) 0.6s,
          height 0.5s cubic-bezier(0.4, 0.0, 0.2, 1) 0.5s;
      }
      .buttons {
        padding: 10px;
        display: flex;
      }
      .info {
        padding: 10px;
        height: 600px;
        overflow: hidden;
      }
      div.edit-form {
      }
      mwc-textfield {
        margin-bottom: 10px;
      }
      mwc-textfield[type=text] {
        width: 100%;
      }
    `;
  }

  render(){
    let form = html`<div class="edit-form" style="display: ${this.edit ? 'block' : 'none'}">
      <mwc-textfield label="Typ" id="type" type="text" 
        value="${this.event ? this.event.type : ''}"></mwc-textfield>
      <mwc-textfield label="Plats" id="location" type="text"
        value="${this.event ? this.event.location : ''}"></mwc-textfield>
      <mwc-textfield label="Beskrivning" id="desc" type="text"
        value="${this.event ? this.event.description : ''}"></mwc-textfield>
      <mwc-textfield label="Datum" id="startdate" type="date"
        value="${this.event ? shortDate.format(this.event.start.toDate()) : ''}"></mwc-textfield>
      <mwc-textfield label="Tid" id="starttime" type="time"
        value="${this.event ? shortTime.format(this.event.start.toDate()) : ''}"></mwc-textfield>
      <br>
      <mwc-button raised type="button" @click=${e => this.save()}>Spara</mwc-button>
      </div>`;
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
        ${this.event ? this.event.type + " " + this.event.location : ''}
        ${form}
        </div>
      </div>`;
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

  save(event) {
    let doc = {
      type: this.shadowRoot.getElementById('type').value,
      location: this.shadowRoot.getElementById('location').value,
      description: this.shadowRoot.getElementById('desc').value,
    };
    let startdate = this.shadowRoot.getElementById('startdate').value;
    let starttime = this.shadowRoot.getElementById('starttime').value;
    if (startdate) {
      if (starttime) {
        doc.start = firebase.firestore.Timestamp.fromDate(new Date(Date.parse(`${startdate}T${starttime}`)));
      }
      doc.start = firebase.firestore.Timestamp.fromDate(new Date(Date.parse(startdate)));
    }
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
