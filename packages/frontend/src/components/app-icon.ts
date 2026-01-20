import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("app-icon")
export class AppIcon extends LitElement {
  @property({ type: String })
  icon = "";

  static styles = css`
    :host {
      align-items: center;
      vertical-align: middle;
      font-size: 24px;
    }

    .material-icons {
      font-family: "Material Icons";
      font-weight: normal;
      font-style: normal;
      font-size: inherit;
      display: inline-block;
      line-height: 1;
      text-transform: none;
      letter-spacing: normal;
      word-wrap: normal;
      white-space: nowrap;
      direction: ltr;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      -moz-osx-font-smoothing: grayscale;
      font-feature-settings: "liga";
    }
  `;

  render() {
    return html`<span class="material-icons">${this.icon}</span>`;
  }
}
