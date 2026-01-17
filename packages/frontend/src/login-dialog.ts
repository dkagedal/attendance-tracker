import "./components/app-input";
import "./components/app-button";
import { AppInput } from "./components/app-input";
import { css, html, LitElement } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithRedirect
} from "firebase/auth";
import { FirebaseApp } from "firebase/app";

@customElement("login-dialog")
export class LoginDialog extends LitElement {
  @property({ attribute: false })
  app: FirebaseApp = null;

  @property({ type: String })
  state: null | "login" | "create" = null;

  @property({ type: String })
  errormsg: string = null;

  @query("#email")
  emailField: AppInput;

  @query("#pwd")
  pwdField: AppInput;

  static styles = css`
    #top {
      width: 300px;
      margin: 1rem 1rem;
      display: flex;
      flex-direction: column;
    }

    app-input {
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
        <app-button variant="primary" @click=${this.loginWithGoogle}
          >Logga in med Google</app-button
        >
        <p class="sep">eller</p>
        <app-input id="email" type="email" label="Epost"></app-input>
        <app-input
          id="pwd"
          type="password"
          label="Lösenord"
          style=${this.state == null ? "display: none" : undefined}
        ></app-input>
        <p>
          <app-button
            variant="primary"
            @click=${this.loginWithPassword.bind(this)}
            style=${this.state == "create" ? "display: none" : undefined}
            >Logga in</app-button
          >
          <app-button
            variant="secondary"
            @click=${this.createPasswordUser.bind(this)}
            style=${this.state == "login" ? "display: none" : undefined}
            >Ny inloggning</app-button
          >
        </p>
        ${this.errormsg
        ? html`
              <p class="error">${this.errormsg}</p>
            `
        : ""}
      </div>
    `;
  }

  loginWithGoogle() {
    const auth = getAuth(this.app);
    const provider = new GoogleAuthProvider();
    signInWithRedirect(auth, provider)
      .then(result => {
        console.log("[google login] Success:", result);
      })
      .catch(error => {
        console.log("[google login] Failure:", error);
      });
  }

  loginWithPassword() {
    if (this.state == null) {
      this.state = "login";
      return;
    }

    signInWithEmailAndPassword(
      getAuth(this.app),
      this.emailField.value,
      this.pwdField.value
    )
      .then(userCredential => {
        console.log("[pw login] Success:", userCredential);
      })
      .catch(error => {
        console.log("[pw login] Failure:", error);
        this.errormsg = error.message;
      });
  }

  createPasswordUser() {
    if (this.state == null) {
      this.state = "create";
      return;
    }

    createUserWithEmailAndPassword(
      getAuth(this.app),
      this.emailField.value,
      this.pwdField.value
    )
      .then(userCredential => {
        console.log("[pw create] Success:", userCredential);
      })
      .catch(error => {
        console.log("[pw create] Failure:", error);
        this.errormsg = error.message;
      });
  }
}
