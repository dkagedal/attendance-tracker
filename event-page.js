import { LitElement, html, css } from 'lit-element';
import { classMap } from 'lit-html/directives/class-map';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';
import '@material/mwc-icon';
import '@material/mwc-icon-button';
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

function isoDate(millis) {
  let date = new Date(millis);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

class EventPage extends LitElement {

  static get properties() {
    return {
      bandref: { type: String }, // "bands/abc"
      eventref: { type: String }, // "bands/abc/events/def"
      itemTop: { type: String },
      itemHeight: { type: String },
      state: { type: String }, // "hidden", "small", "expanded"
    }
  }

  constructor() {
    super();
    this.bandref = "";
    this.eventref = "";
    this.itemTop = 0;
    this.itemHeight = 0;
    this.state = "hidden";
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
        transition: all 0.5s cubic-bezier(0.4, 0.0, 0.2, 1);
      }
      .expand {
        background: white; opacity: 100%;
        top: 0; height: 100%;
        transition: all 0.5s cubic-bezier(0.4, 0.0, 0.2, 1);
      }
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
    let form = html`<div class="edit-form">
      <label for="type">Typ:</label><input type="text" id="type" name="type"><br>
      <label for="location">Plats:</label><input type="text" id="location" name="location"><br>
      <label for="desc">Beskrivning:</label><input type="text" id="desc" name="desc"><br>
      <label for="start">Datum:</label><input type="date" id="start" name="start"><br>
      <mwc-button dense raised type="button" @click=${this}>Lägg till</mwc-button>
      </div>`;
    let classes = { hidden: this.state == "hidden", 
                    shrink: this.state == "small", 
                    expand: this.state == "expanded" };
    return html`<div id="top" class=${classMap(classes)}
          style="${this.state == "small" ? `top: ${this.itemTop}px; height: ${this.itemHeight}px;` : ''}">
        <mwc-icon-button icon="close" @click=${e => this.close()}></mwc-icon-button>
        ${form}
      </div>`;
  }

  async expandFrom(top, height) {
    this.state = "hidden"
    this.itemTop = top;
    this.itemHeight = height;
    await this.updateComplete;
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
