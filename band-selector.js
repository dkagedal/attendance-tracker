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
    this.bands = [];
  }

  setBands(bands) {
    this.bands = bands;
    if (bands.length == 0) {
      this.current = "";
    } else if (this.current == "") {
      this.selectBand(bands[0].id);
    } else {
      for (var i = 0; i < bands.length; i++) {
        if (bands[i].id == this.current) {
          this.selectBand(this.current);
          return;
        }
      }
      this.selectBand(bands[0].id);
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
    return html`<h1 @click=${e => this.openMenu()} >${this.currentName()}</h1>
      <mwc-menu fullwidth id="menu" @selected=${ev => this.selectBand(this.bands[ev.detail.index].id)}>
        ${this.bands.map(
            (band) => html`<mwc-list-item id=${band.id}>${band.data().display_name}</mwc-list-item>`)}
      </mwc-menu>`;
  }

  openMenu() {
    if (this.bands.length > 1) {
      this.shadowRoot.getElementById("menu").show();
    }
  }

  selectBand(id) {
    console.log("Selected band", id);
    this.current = id;
    let event = new CustomEvent(
      "select-band",
      {detail: {id: this.current,
                ref: this.currentRef()}});
    this.dispatchEvent(event);
  }
}

customElements.define('band-selector', BandSelector);
