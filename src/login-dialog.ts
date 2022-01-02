
import "@material/mwc-textfield/mwc-textfield";
import "@material/mwc-button/mwc-button"; import { css, html, LitElement } from "lit";
import { customElement, property, query } from "lit/decorators";
import { createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { FirebaseApp } from "firebase/app";
import { TextField } from "@material/mwc-textfield/mwc-textfield";


@customElement("login-dialog")
export class AppMain extends LitElement {
  @property({ attribute: false })
  app: FirebaseApp = null;

  @property({ type: String })
  state: null | "login" | "create" = null;

  @property({ type: String})
  errormsg: string = null;

  @query("#email")
  emailField: TextField

  @query("#pwd")
  pwdField: TextField

  static styles = css`
    #top {
      width: 300px;
      margin: 1rem 1rem;
      display: flex;
      flex-direction: column;
    }

    mwc-textfield {
      width: 100%;
    }

    .sep {
      text-align: center;
    }

    .error {
      color: #660000;
    }
  `;

  render() {
    return html`
      <div id="top">
        <mwc-button raised @click=${this.loginWithGoogle}>Logga in med Google</mwc-button>
        <p class="sep">eller</p>
        <mwc-textfield id="email" type="email" label="Epost"></mwc-textfield>
        <mwc-textfield
          id="pwd" type="password" label="Lösenord"
          style=${this.state == null ? "display: none" : undefined}></mwc-textfield>
        <p>
          <mwc-button 
            raised @click=${this.loginWithPassword.bind(this)}
            style=${this.state == "create" ? "display: none" : undefined}
            >Logga in</mwc-button>
          <mwc-button
            raised @click=${this.createPasswordUser.bind(this)}
            style=${this.state == "login" ? "display: none" : undefined}
            >Ny inloggning</mwc-button>
        </p>
        ${this.errormsg ? html`<p class="error">${this.errormsg}</p>`: ""}
      </div>`;
  }

  loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    signInWithPopup(getAuth(this.app), provider)
      .then((result) => {
        console.log("[google login] Success:", result);
      }).catch((error) => {
        console.log("[google login] Failure:", error)
      });
  }

  loginWithPassword() {
    if (this.state == null) {
      this.state = "login";
      return;
    }

    signInWithEmailAndPassword(getAuth(this.app), this.emailField.value, this.pwdField.value)
      .then((userCredential) => {
        console.log("[pw login] Success:", userCredential)
      })
      .catch((error) => {
        console.log("[pw login] Failure:", error)
        this.errormsg = error.message;
      });
  }

  createPasswordUser() {
    if (this.state == null) {
      this.state = "create";
      return;
    }

    createUserWithEmailAndPassword(getAuth(this.app), this.emailField.value, this.pwdField.value)
    .then((userCredential) => {
      console.log("[pw create] Success:", userCredential)
    })
    .catch((error) => {
      console.log("[pw create] Failure:", error);
      this.errormsg = error.message;
    });
  
  }
}
