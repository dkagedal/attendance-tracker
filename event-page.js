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
      bandref: { type: String }, // "bands/abc"
      eventref: { type: String }, // "bands/abc/events/def"
      itemTop: { type: Number, reflect: true },
      itemHeight: { type: Number, reflect: true },
      state: { type: String, reflect: true }, // "hidden", "small", "expanded"
      event: { type: Object },
    }
  }

  constructor() {
    super();
    this.bandref = "";
    this.eventref = "";
    this.itemTop = 0;
    this.itemHeight = 0;
    this.state = "hidden";
    this.event = null;
  }

  attributeChangedCallback(name, oldval, newval) {
    super.attributeChangedCallback(name, oldval, newval);
    if (name == 'eventref') {
      console.log('Fetching ', newval)
      firebase.firestore().doc(newval).get().then(doc => {
        if (doc.exists) {
          this.event = doc.data();
          console.log('got event snapshot ', this.event);
        } else {
          console.log('event', newval, 'did not exist');
        }
      });
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
      div.edit-form {
        padding: 20px;
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
    let form = html`<div class="edit-form">
      <mwc-textfield label="Typ" id="type" type="text" required 
        value="${this.event ? this.event.type : ''}"></mwc-textfield>
      <mwc-textfield label="Plats" id="location" type="text"
        value="${this.event ? this.event.location : ''}"></mwc-textfield>
      <mwc-textfield label="Beskrivning" id="desc" type="text"
        ?value="${ifDefined(this.event ? this.event.description : undefined)}"></mwc-textfield>
      <mwc-textfield label="Datum" id="startdate" type="date"
        value="${ifDefined(this.event ? shortDate.format(this.event.start.toDate()) : undefined)}"></mwc-textfield>
      <mwc-textfield label="Tid" id="starttime" type="time"
        value="${ifDefined(this.event ? shortTime.format(this.event.start.toDate()) : undefined)}"></mwc-textfield>
      <br>
      <mwc-button raised type="button" @click=${e => this.save()}>Spara</mwc-button>
      </div>`;
    let classes = { hidden: this.state == "hidden", 
                    shrink: this.state == "small", 
                    expand: this.state == "expanded" };
    return html`<div id="top" class=${classMap(classes)}
          style="${this.state != "expanded" ? `top: ${this.itemTop}px; height: ${this.itemHeight}px;` : ''}">
        <mwc-icon-button icon="close" @click=${e => this.close()}></mwc-icon-button>
        ${form}
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
    let start = new Date(Date.parse(this.shadowRoot.getElementById('startdate').value + 'T' + this.shadowRoot.getElementById('starttime').value));
    console.log("start", start);
    let doc = {
      type: this.shadowRoot.getElementById('type').value,
      location: this.shadowRoot.getElementById('location').value,
      description: this.shadowRoot.getElementById('desc').value,
      start: firebase.firestore.Timestamp.fromDate(start),
    };
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
