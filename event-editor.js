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
import './time-range.js';

class EventEditor extends LitElement {

  static get properties() {
    return {
      bandref: { type: String, reflect: true }, // "bands/abc"
      eventref: { type: String, reflect: true }, // "bands/abc/events/def"
      event: { type: Object },
      range: { type: Boolean, reflect: true },
    }
  }

  constructor() {
    super();
    this.bandref = null;
    this.event = {};
    this.range = false;
  }

  static get styles() {
    return css`
      div.edit-form {
        display: flex;
        flex-direction: column;
      }
      mwc-textfield {
        margin-bottom: 10px;
      }
      mwc-button[icon=add]{
         align-self: flex-start;
      }
      mwc-button.submit {
         align-self: flex-end;
         margin-top: 16px;
      }
    `;
  }

  render() {
    return html`<div class="edit-form">
      <mwc-textfield label="Typ" id="type" type="text" 
        value="${this.event ? this.event.type : ''}"></mwc-textfield>
      <mwc-textfield label="Plats" id="location" type="text"
        value="${this.event ? this.event.location : ''}"></mwc-textfield>
      <mwc-textfield label="Beskrivning" id="desc" type="text"
        value="${this.event ? this.event.description : ''}"></mwc-textfield>
      <datetime-input id="start" initial_value="${ifDefined(this.event.start)}"></datetime-input><br>
      <span style="display: ${this.range ? 'inline' : 'none'}">
        <datetime-input id="stop" initial_value="${ifDefined(this.event.stop)}"></datetime-input>
        <mwc-icon-button icon="close" @click=${e => {this.range = false}}></mwc-icon-button>
      </span>
      <mwc-button style="display: ${this.range ? 'none' : 'block'}" icon="add" label="Lägg till sluttid"
                  @click=${e => this.addStop()}></mwc-button>
      <mwc-button class="submit"  raised type="button" @click=${e => this.save()} label="Spara"></mwc-button>
      </div>`;
  }

  addStop() {
    this.range = true;
    stop = this.shadowRoot.getElementById('stop');
    if (!stop.value) {
      // Just the date. TODO: set time to +1 hour
      stop.value = this.shadowRoot.getElementById('start').value.split("T")[0];
    }
  }

  save() {
    let doc = {
      type: this.shadowRoot.getElementById('type').value,
      location: this.shadowRoot.getElementById('location').value,
      description: this.shadowRoot.getElementById('desc').value,
    };
    let start = this.shadowRoot.getElementById('start').value;
    if (start) {
      doc.start = start;
      let stop = this.shadowRoot.getElementById('stop').value;
      if (this.range &&
          stop &&
          start != stop &&
          start.indexOf("T") == stop.indexOf("T")) {
        doc.stop = stop;
      }
    }
    console.log("doc", doc);
    var promise;
    console.log("Save", this.eventref, this);
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
      let event = new CustomEvent("saved", {});
      this.dispatchEvent(event);
    }).catch(err => {
      console.error("Error creating event: ", err);
    });
  }
}

customElements.define('event-editor', EventEditor);
