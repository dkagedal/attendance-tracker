import { LitElement, html, css } from 'lit-element';

class BandSelector extends LitElement {
  static get properties() {
    return {
      current: { type: String },
      bands: { type: Array },
    }
  }
  
  constructor() {
    super();
    this.current = "";
    this.bands = [];
  }

  setBands(bands) {
    this.bands = bands;
    if (bands.length == 0) {
      this.current = "";
    } else if (this.current == "") {
      this.current = bands[0].id;
    } else {
      for (var i = 0; i < bands.length; i++) {
        if (bands[i].id == this.current) {
          return;
        }
      }
      this.current = bands[0].id;
    }
  }

  currentName() {
    for (var i = 0; i < this.bands.length; i++) {
      if (this.bands[i].id == this.current) {
        return this.bands[i].data().display_name;
      }
    }
    return "";
  }

  currentRef() {
    if (this.current == "") {
      return "";
    }
    return "bands/" + this.current;
  }

  static get styles() {
    return css`
      h1 {
        margin: 0; font-size: 24px; font-weight: bold; 
        padding: 8px 16px 8px 16px;
      }`
  }
  render() {
    return html`<h1>${this.currentName()}</h1>`;
  }
}

customElements.define('band-selector', BandSelector);
