import { LitElement, html, css, query } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';

var db = firebase.firestore();
if (location.hostname === "localhost") {
    db.settings({
        host: "localhost:8080",
        ssl: false
    });
}

class MiniRoster extends LitElement {
    static get properties() {
        return {
            size: { type: Number },
            event: { type: String },  // DB path
            responses: { type: Object },
        }
    }

    constructor() {
        super();
        this.size = 0;
        this.event = null;
        this.responses = { "yes": [], "no": [], "sub": [], "maybe": [], "unknown": [] };
    }

    setGig(path) {
        this.event = path;
        console.log(`mini-roster: Fetching participants ${path}/participants`);
        // TODO: remember the cancel function.
        db.collection(`${path}/participants`).onSnapshot(snapshot => {
            const responses = { "yes": [], "no": [], "sub": [], "maybe": [] };
            let unknowns = this.size;
            snapshot.docs.forEach(p => {
                responses[p.data().attending].push(p.id);
                unknowns -= 1;
            });
            responses.unknown = Array(unknowns < 0 ? 0 : unknowns);
            console.log("mini-roster: got responses", responses);
            this.responses = responses;
        });
    }

    attributeChangedCallback(name, oldval, newval) {
        console.log('event-card attribute change: ', name, oldval, '->', newval);
        super.attributeChangedCallback(name, oldval, newval);
        if (name == 'event' && newval != oldval) {
            this.setGig(newval)
        }
    }
    static get styles() {
        return css`
        :host {
            display: flex;
        }
        span {
            width: 8px;
            height: 8px;
            margin: 1px;
            border: 1px solid #888;
        }
        .yes {
            background: green
        }
        .maybe {
            background: lightgray
          }
        .unknown {
            background: white
          }
        .no {
            background: red
          }
         .sub {
            background: yellow
          }
    `;
    }

    render() {
        return html`
        ${repeat(this.responses.yes, id => id, () => html`<span class="yes"></span>`)}
        ${repeat(this.responses.sub, id => id, () => html`<span class="sub"></span>`)}
        ${repeat(this.responses.no, id => id, () => html`<span class="no"></span>`)}
        ${repeat(this.responses.maybe, id => id, () => html`<span class="maybe"></span>`)}
        ${repeat(this.responses.unknown, id => id, () => html`<span class="unknown"></span>`)}
    `;
    }
}

customElements.define('mini-roster', MiniRoster);
