import { LitElement, html } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';
import './band-event.js';

class BandSchedule extends LitElement {
  static get properties() {
    return {
      dbDoc: { type: Object },
      dbid: { type: String },
      events: { type: Array },
    }
  }

  constructor() {
    super();
    this.dbDoc = null
    this.dbid = ""
    this.events = []
  }

  attributeChangedCallback(name, oldval, newval) {
    console.log('attribute change: ', name, newval);
    super.attributeChangedCallback(name, oldval, newval);
    if (name == 'dbid') {
      let ref = `${newval}/events`;
      console.log('Fetching ', ref)
      let db = firebase.firestore();
      db.collection(ref).onSnapshot((querySnapshot) => {
        console.log('got snapshot ', querySnapshot.docs.map(e => e.data()));
        this.events = querySnapshot.docs.map((event) => event);
      });
    }
  }

  render() {
    let formatTimestamp = (ts) => {
      if (ts === undefined) {
        return undefined;
      }
      return ts.toDate().toJSON();
    }

    return html`<h1>${this.dbDoc.display_name}</h1>
    <ul>
      ${repeat(this.events, (e) => e.id, 
          (e, index) => html`<band-event dbid="${e.id}"
            type="${e.data().type}"
            location="${e.data().location}"
            start="${ifDefined(formatTimestamp(e.data().start))}"
            stop="${ifDefined(formatTimestamp(e.data().stop))}"
      ></band-event>`)}
    </ul>
    `;
  }
}
// Register the new element with the browser.
customElements.define('band-schedule', BandSchedule);
