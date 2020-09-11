import { LitElement, html, css } from 'lit-element';
import '@material/mwc-menu';
import '@material/mwc-list';

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
    this.bands = {};
  }

  setBands(bands) {
    console.log("setBands", bands);
    this.bands = bands;
    const ids = Object.keys(bands);
    if (ids.length == 0) {
      this.current = "";
    } else if (this.current == "") {
      this.selectBand(ids[0]);
    } else {
      for (var id in bands) {
        if (id == this.current) {
          this.selectBand(this.current);
          return;
        }
      }
      this.selectBand(ids[0]);
    }
  }

  currentName() {
    const band = this.bands[this.current]
    return band ? band.display_name : "";
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
    return html`<h1 @click=${e => this.openMenu()} >${this.currentName()}</h1>
      <mwc-menu fullwidth id="menu" @selected=${ev => this.selectBand(this.bands[ev.detail.index].id)}>
        ${Object.keys(this.bands).map(
            (bandId) => html`<mwc-list-item id=${bandId}>${this.bands[bandId].display_name}</mwc-list-item>`)}
      </mwc-menu>`;
  }

  openMenu() {
    if (Object.keys(this.bands).length > 1) {
      this.shadowRoot.getElementById("menu").show();
    }
  }
}

customElements.define('band-selector', BandSelector);
