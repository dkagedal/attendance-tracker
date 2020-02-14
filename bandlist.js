import { LitElement, html, css } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';

const timestampProperty = { 
  type: Object,  
  converter: (value, type) => {
    return Date.parse(value);
  }
};

const db = firebase.firestore();

class BandEvent extends LitElement {

  static get properties() {

    return {
      eventref: { type: String }, // "bands/abc/events/123"
      type: { type: String },
      location: { type: String },
      description: { type: String },
      start: timestampProperty,
      stop: timestampProperty,
      participants: { type: Array },
    }
  }

  constructor() {
    super();
    this.eventref = ""
    this.type = ""
    this.location = ""
    this.description = ""
    this.start = null
    this.stop = null
    this.participants = []
  }

  attributeChangedCallback(name, oldval, newval) {
    console.log('band-event attribute change: ', name, oldval, '->', newval);
    super.attributeChangedCallback(name, oldval, newval);
    if (name == 'eventref') {
      let ref = `${newval}/participants`;
      console.log('Fetching ', ref)
      db.collection(ref).onSnapshot((querySnapshot) => {
        console.log('got participants snapshot ', querySnapshot.docs.map(p => p.data()));
        this.participants = querySnapshot.docs;
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
        border-top: 1px solid lightsalmon;
        padding: 0;
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
      p { margin: 2px }
      .location { font-weight: bold }
      p.time { color: #888888 }
      ul { list-style: none; padding-inline-start: 0; margin: 0; }
      li.participant { border: none; }
    `;
  }

  render(){
    return html`<div class='event'>
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
      ${this.participants.length
        ? html`<ul>${repeat(this.participants, p => p.id, 
                            (p, index) => html`<li>${p.id} ${p.data().attending}</li>`)}</ul>`
        : html``}
      </div>
      </div>`;
  }
}

class BandEditEvent extends LitElement {

  static get properties() {
    return {
      bandref: { type: String }, // "bands/abc"
      visible: { type: Boolean },
    }
  }

  constructor() {
    super();
    this.bandref = "";
    this.visible = false;
  }


  static get styles() {
    return css`
      .toggle {
        font-size: 12px;
        font-weight: 600;
        margin: 0;
        color: #4a7cf1;
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
      <button type="button" @click=${this}>Lägg till</button>
      </div>`;
    return html`<p class="toggle" @click=${e => this.toggle()}>Lägg till</p>${this.visible ? form : html``}`;
  }

  toggle() {
    console.log('Toggle visibility: %s -> %s', this.visible, !this.visible);
    this.visible = !this.visible;
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

class BandSchedule extends LitElement {
  static get properties() {
    return {
      dbDoc: { type: Object },
      bandref: { type: String }, // "bands/abc"
      events: { type: Array },
      emptymsg: { type: String },
      visible: { type: Boolean },
    }
  }

  constructor() {
    super();
    this.dbDoc = null;
    this.bandref = "";
    this.events = [];
    this.emptymsg = "...";
    this.visible = true;
  }

  attributeChangedCallback(name, oldval, newval) {
    // console.log('attribute change: ', name, newval);
    super.attributeChangedCallback(name, oldval, newval);
    if (name == 'bandref') {
      let ref = `${newval}/events`;
      console.log('Fetching ', ref)
      db.collection(ref).orderBy('start').onSnapshot((querySnapshot) => {
        console.log('got snapshot ', querySnapshot.docs.map(e => e.data()));
        this.events = querySnapshot.docs.map((event) => event);
        this.emptymsg = "Inget planerat";
      });
    }
  }

  static get styles() {
    return css`
      .schedule {
        background: white;
        max-width: 70em;
        margin: 16px auto 16px;
        padding: 32px 24px 24px;
        border-radius: 3px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24);
      }
      h1 {
        margin: 0; font-size: 20px; font-weight: bold; padding-bottom: 8px;
      }
      .eventlist {
        margin: 0;
        overflow: hidden;
        max-height: fit-content;
      }
      .hidden { display: none; }
      @media (max-width: 600px) {
        div.schedule {
          padding: 16px 16px;
        }
      }
    `;
  }

  render() {
    let formatTimestamp = (ts) => {
      if (ts === undefined || ts == null) {
        return undefined;
      }
      return ts.toDate().toJSON();
    }
    let elt = this;
    return html`<div class='schedule'>
      <h1 @click=${this}>${this.dbDoc.display_name}</h1>
      <div class="eventlist ${this.visible ? "" : "hidden"}">
          ${repeat(this.events, (e) => e.id, 
            (e, index) => html`<band-event eventref="${this.bandref}/events/${e.id}"
              type="${e.data().type}"
              location="${e.data().location}"
              description="${ifDefined(e.data().description)}"
              start="${ifDefined(formatTimestamp(e.data().start))}"
              stop="${ifDefined(formatTimestamp(e.data().stop))}"
            ></band-event>`)}
          ${this.events.length ? html`` : html`<p>${this.emptymsg}</p>`}
          <band-edit-event bandref="${this.bandref}"></band-edit-event>
        </div>
    </div>
    `;
  }

  handleEvent(event) {
    console.log("Clicked! Toggling visibility %s", event);
    this.visible = !this.visible;
  }
}

class BandList extends LitElement {

  static get properties() {
    return {
      bands : { type: Array, attribute: false } 
    }
  }

  constructor() {
    super();
    this.bands = [];
    this.xyz = 123
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        let query = db.collection("bands")
          .where("acl", "array-contains", user.uid);
        query.get().then((querySnapshot) => {
          this.bands = querySnapshot.docs;
        });
      } else {
        this.bands = [];
      }
    });
  }

  render(){
    return html`
      ${this.bands.map(band => html`<band-schedule bandref="bands/${band.id}" .dbDoc=${band.data()} name="${band.data().display_name}"></band-schedule>
        `)}
    `;
  }
}

customElements.define('band-event', BandEvent);
customElements.define('band-edit-event', BandEditEvent);
customElements.define('band-schedule', BandSchedule);
customElements.define('band-list', BandList);
