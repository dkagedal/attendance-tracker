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

const shortDate = new Intl.DateTimeFormat(undefined, {
  'year': 'numeric', 'month': '2-digit', 'day': '2-digit'
});

function isoDate(millis) {
  let date = new Date(millis);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

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
      firebase.firestore().doc(newval).onSnapshot((snapshot) => {
        this.event = snapshot.data();
        console.log('got event snapshot ', this.event);
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
          all 0.5s cubic-bezier(0.4, 0.0, 0.2, 1);
      }
      .expand {
        background: white; opacity: 100%;
        top: 0; height: 100%;
        transition:
          opacity 0.5s cubic-bezier(0.4, 0.0, 0.2, 1),
          top 0.5s cubic-bezier(0.4, 0.0, 0.2, 1) 0.5s,
          height 0.5s cubic-bezier(0.4, 0.0, 0.2, 1) 0.5s;
      }
      div.edit-form {
        padding: 20px;
      }
    `;
  }

  render(){
    let form = html`<div class="edit-form">
      <mwc-textfield label="Typ" id="type" required 
        value="${this.event ? this.event.type : ''}"></mwc-textfield>
      <mwc-textfield label="Plats" id="location"
        value="${this.event ? this.event.location : ''}"></mwc-textfield>
      <mwc-textfield label="Beskrivning" id="desc"
        ?value="${ifDefined(this.event ? this.event.description : undefined)}"></mwc-textfield>
      <mwc-textfield label="Datum" id="start" type="date"
        value="${ifDefined(this.event ? shortDate.format(this.event.start.toDate()) : undefined)}"></mwc-textfield>
      <mwc-button dense raised type="button" @click=${this}>Lägg till</mwc-button>
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
    this.state = "hidden";
    this.itemTop = top;
    this.itemHeight = height;
    console.log("Requesting update");
    await this.requestUpdate();
    console.log("Updated?");
    this.state = "expanded";
  }

  close() {
    this.state = "small";
  }

  handleEvent(event) {
    let ref = this.bandref+"/events";
    console.log("Clicked! Adding to %s", ref)
    let start = this.shadowRoot.getElementById('start').valueAsDate;
    firebase.firestore().collection(ref).add({
      type: this.shadowRoot.getElementById('type').value,
      location: this.shadowRoot.getElementById('location').value,
      description: this.shadowRoot.getElementById('desc').value,
      start: firebase.firestore.Timestamp.fromDate(start),
    }).then(docRef => {
      console.log("New event created with ID ", docRef.id);
      this.toggle()
    }).catch(err => {
      console.error("Error creating event: ", err);
    });
  }
}

customElements.define('event-page', EventPage);
