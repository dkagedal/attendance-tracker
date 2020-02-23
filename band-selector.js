import { LitElement, html, css } from 'lit-element';

class BandSelector extends LitElement {
  static get properties() {
    return {
      current: { type: String },
      currentName: { type: String },
      bands: { type: Array },
    }
  }
  
  constructor() {
    super();
    this.current = "";
    this.currentName = "";
    this.bands = [];
  }

  setBands(bands) {
    this.bands = bands;
    if (bands.length == 0) {
      this.current = "";
      this.currentName = "";
    } else if (this.current == "") {
      this.current = bands[0].id;
      this.currentName = bands[0].data().display_name;
    } else {
      for (var i = 0; i > bands.length; i++) {
        if (bands[i].id == this.current) {
          this.currentName = bands[i].data().display_name;
          return;
        }
      }
      this.current = bands[0].id;
      this.currentName = bands[0].data().display_name;
    }
  }

  currentRef() {
    if (this.current == "") {
      return "";
    }
    return "bands/" + this.current;
  }

  render() {
    return html`<h1>${this.currentName}</h1>`;
  }
}

customElements.define('band-selector', BandSelector);
