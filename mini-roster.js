import { LitElement, html, css, query } from 'lit-element';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';

class MiniRoster extends LitElement {
    static get properties() {
        return {
            members: { type: Array, attribute: false }, // [DocumentSnapshot]
            event: { type: Object, attribute: false },  // DocumentSnapshot
            responses: { type: Object, attribute: false },
        }
    }

    constructor() {
        super();
        this.size = 0;
        this.event = null;
        this.responses = [];
    }

    fetchParticipants() {
        console.log(`mini-roster: Fetching participants ${this.event.ref.path}/participants`);
        // TODO: remember the cancel function.
        this.event.ref.collection('participants').onSnapshot(snapshot => {
            const responses = {};
            snapshot.docs.forEach(p => {
                responses[p.id] = p.data().attending;
            });
            this.responses = responses;
        });
    }

    updated(changedProperties) {
        changedProperties.forEach((oldValue, propName) => {
            if (propName == 'event') {
                this.fetchParticipants()
            }
        })
    }

    static get styles() {
        return css`
        :host {
            display: flex;
        }
        span {
            flex: 1 1 8px;
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
        ${repeat(this.members, member => member.id, member => {
            return html`<span title=${member.data().display_name} class=${this.responses[member.id] || 'unknown'}></span>`;
        })}
    `;
    }
}

customElements.define('mini-roster', MiniRoster);
