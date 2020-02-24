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

class BandEvent extends LitElement {

  static get properties() {

    return {
      edit: { type: Boolean },
      eventref: { type: String }, // "bands/abc/events/123"
      type: { type: String },
      location: { type: String },
      description: { type: String },
      start: timestampProperty,
      stop: timestampProperty,
      participants: { type: Array },
      myresponse: { type: String },
    }
  }

  constructor() {
    super();
    this.edit = false
    this.eventref = ""
    this.type = ""
    this.location = ""
    this.description = ""
    this.start = null
    this.stop = null
    this.participants = []
    this.myresponse = undefined // means unknown, not loaded
  }

  attributeChangedCallback(name, oldval, newval) {
    console.log('band-event attribute change: ', name, oldval, '->', newval);
    super.attributeChangedCallback(name, oldval, newval);
    if (name == 'eventref') {
      let ref = `${newval}/participants`;
      console.log('Fetching ', ref)
      firebase.firestore().collection(ref).onSnapshot((querySnapshot) => {
        // console.log('got participants snapshot ', querySnapshot.docs.map(p => p.data()));
        this.participants = querySnapshot.docs;
        let user = firebase.auth().currentUser;
        var myresponse = ''
        for (let i = 0; i < this.participants.length; i++) {
          let p = this.participants[i];
          if (p.id == user.uid) {
            myresponse = p.data().attending || '';
          }
        }
        this.myresponse = myresponse;
      });
    }
  }

  formatDate(timestamp) {
    let datefmt = new Intl.DateTimeFormat('default', {
      timeZone: 'Europe/Stockholm',
      month: 'short',
      day: 'numeric',
    });
    return datefmt.format(timestamp)
  }

  fmtTimeRange(start, stop) {
    if (start === undefined) {
      return html`okänd tid`
    }
    let timefmt = new Intl.DateTimeFormat('default', {
      hour12: false,
      timeZone: 'Europe/Stockholm',
      hour: 'numeric',
      minute: 'numeric',
    });
    let startDate = datefmt.format(start)
    if (stop === undefined) {
      return html`${startDate} ${timefmt.format(start)}`
    }
    let stopDate = datefmt.format(stop)
    if (startDate == stopDate) {
      return html`${startDate} ${timefmt.format(start)}
          - ${timefmt.format(stop)}`;
    }
    return html`${startDate} - ${stopDate}`;
  }

  static get styles() {
    return css`
      div.event {
        display: flex;
        padding: 4px;
      }
      div.time {
        display: inline-block;
        flex: 0 0 60px;
        vertical-align: top;
        padding: 5px 10px;
      }
      div.info {
        flex: 1;
        vertical-align: top;
        padding: 5px 10px;
      }
      div.buttons {
        flex: 0 0 24px;
        text-align: right;
        padding: 5px 10px;
        color: rgba(0,0,0,0.5);
        --mdc-icon-size: 18px;
      }
      p { margin: 2px }
      .location { font-weight: bold }
      p.time { color: #888888 }
      ul { list-style: none; padding-inline-start: 0; margin: 0; }
      li.participant { border: none; }
      div.edit-form {
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

  render() {
    return html`${this.edit ? this.renderEdit() : this.renderPresent()}`;
  }

  renderPresent() {
    return html`
      <div class='event'>
      <div class='time'>
        <p class='date'>${this.formatDate(this.start)}</p>
      </div>
      <div class='info'>
        <p class='summary'>
          <span class='type'>${this.type}</span>
          <span class='location'>${this.location}</span>
        </p>
        ${this.description.length
          ? html`<p>${this.description}</p>`
          : html``}
      </div>
      <div class='buttons'>
        <mwc-icon @click=${e => this.openEdit()}>edit</mwc-icon>
      </div>
    `;
  }

  renderEdit(){
    return html`<div class="edit-form">
      <label for="type">Typ:</label><input type="text" id="type" name="type" value="${this.type}"><br>
      <label for="location">Plats:</label><input type="text" id="location" name="location" value="${this.location}"><br>
      <label for="desc">Beskrivning:</label><input type="text" id="desc" name="desc" value="${this.description}"><br>
      <label for="start">Datum:</label><input type="date" id="start" name="start" value="${shortDate.format(new Date(this.start))}"><br>
      <mwc-button dense raised @click=${e => this.save()} label="Spara"></mwc-button>
      </div>`;
  }

  openEdit() {
    this.edit = true;
  }

  save() {
    console.log("Saving, promise");
    this.edit = false;
  }
}

customElements.define('band-event', BandEvent);
