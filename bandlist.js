import { LitElement, html } from 'lit-element';
import './band-schedule.js';

class BandList extends LitElement {

  static get properties() {
    return {
      bands : { type: Array, attribute: false } 
    }
  }

  constructor() {
    super();
    this.bands = [];
    let db = firebase.firestore();
    db.collection("bands").get().then((querySnapshot) => {
      this.bands = querySnapshot.docs;
    });
  }

  render(){
    return html`
      ${this.bands.map(band => html`<band-schedule dbid="bands/${band.id}" .dbDoc=${band.data()} name="${band.data().display_name}"></band-schedule>
        `)}
    `;
  }
}
// Register the new element with the browser.
customElements.define('band-list', BandList);

