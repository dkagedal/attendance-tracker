import { LitElement, html, css } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';
import '@material/mwc-icon';
import '@material/mwc-button';

const timestampProperty = { 
  type: Object,  
  converter: (value, type) => {
    return Date.parse(value);
  }
};

const shortDate = new Intl.DateTimeFormat(undefined, {
  'year': 'numeric', 'month': '2-digit', 'day': '2-digit'
});

var db = firebase.firestore();
if (location.hostname === "localhost") {
    db.settings({
      host: "localhost:8080",
      ssl: false
    });
  }

function isoDate(millis) {
  let date = new Date(millis);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

class BandEditEvent extends LitElement {

  static get properties() {
    return {
      bandref: { type: String }, // "bands/abc"
      eventref: { type: String }, // "bands/abc/events/def"
      visible: { type: Boolean },
    }
  }

  constructor() {
    super();
    this.bandref = "";
    this.eventref = "";
    this.visible = false;
  }


  static get styles() {
    return css`
      div.edit-form {
        border: 1px solid #cccccc;
        padding: 20px;
      }
      label { display: inline-block; width: 6em; }
      input[type=text] {
        border: 1px solid #4a7cf1;
        border-radius: 3px;
        padding: 2px;
        margin: 2px;
        width: 20em;
      }
      input[type=date] {
        border: 1px solid #4a7cf1;
        border-radius: 3px;
        padding: 2px;
        margin: 2px;
      }
      button {
        font: inherit;
        background: #4a7cf1;
        color: white;
        padding: 5px 20px;
        margin-top: 10px;
        border-radius: 4px;
      }
    `;
  }

  render(){
    return html`<div class="edit-form">
      <label for="type">Typ:</label><input type="text" id="type" name="type"><br>
      <label for="location">Plats:</label><input type="text" id="location" name="location"><br>
      <label for="desc">Beskrivning:</label><input type="text" id="desc" name="desc"><br>
      <label for="start">Datum:</label><input type="date" id="start" name="start"><br>
      <mwc-button dense raised type="button" @click=${this}>Lägg till</mwc-button>
      </div>`;
  }

  handleEvent(event) {
    let ref = this.bandref+"/events";
    console.log("Clicked! Adding to %s", ref)
    let start = this.shadowRoot.getElementById('start').valueAsDate;
    db.collection(ref).add({
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

customElements.define('band-edit-event', BandEditEvent);
