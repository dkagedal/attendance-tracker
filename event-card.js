import { LitElement, html, css } from 'lit-element';
import { classMap } from 'lit-html/directives/class-map';
import { styleMap } from 'lit-html/directives/style-map';
import { repeat } from 'lit-html/directives/repeat';
import { ifDefined } from 'lit-html/directives/if-defined';
import '@material/mwc-dialog';
import '@material/mwc-icon';
import '@material/mwc-icon-button';
import '@material/mwc-button';
import '@material/mwc-tab';
import '@material/mwc-tab-bar';
import '@material/mwc-textfield';
import './datetime-input.js';
import './event-editor.js';
import './time-range.js';

const responseIcons = {
    yes: "thumb_up",
    no: "thumb_down",
    maybe: "thumbs_up_down",
    sub: "import_export",
}

const attendances = {
    "yes": "Ja",
    "no": "Nej",
    "maybe": "Återkommer",
    "sub": "Vikarie",
    "unknown": "",
}

class EventCard extends LitElement {
    
    static get properties() {
        return {
            bandref: { type: String, reflect: true }, // "bands/abc"
            edit: { type: Boolean, reflect: true },
            event: { type: Object },  // QueryDocumentSnapshot
            editResponse: { type: String }, // UID or null
            participants: { type: Object },
            users: { type: Object },
        }
    }
    
    constructor() {
        super();
        this.bandref = null;
        this.event = null;
        this.edit = false;
        this.editResponse = null;
        this.participants = {};
        this.edit = false;
        this.users = {};
    }
    
    setGig(gig) {
        this.event = gig
        console.log(`event-card: Fetching participants ${this.event.ref.path}/participants`);
        firebase.firestore().collection(`${this.event.ref.path}/participants`).onSnapshot(snapshot => {
            let participants = {}
            snapshot.docs.forEach(p => {
                participants[p.id] = p.data();
            });
            console.log("event-card: Got participants", participants);
            this.participants = participants
        });
    }

    attributeChangedCallback(name, oldval, newval) {
        console.log('event-card attribute change: ', name, oldval, '->', newval);
        super.attributeChangedCallback(name, oldval, newval);
        if (name == 'event' && newval != oldval) {
            this.setGig(newval)
        }
    }
    
    countResponses() {
        let counts = { yes: 0, no: 0, maybe: 0, sub: 0 };
        for (let uid in this.participants) {
            let response = this.participants[uid].attending;
            counts[response] += 1;
        }
        return counts;
    }
    
    static get styles() {
        return css`
        #top {
            position: absolute; left: 0; 
            height: 100%; width: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 3px 3px 8px 1px rgba(0,0,0,0.4);
        }
        #buttons {
            padding: 10px;
            display: flex;
        }
        #info {
            padding: 0 30px 1rem;
        }
        #summary {
            padding: 0 60px 0 60px;
            font-variant: all-petite-caps;
            font-weight: 600;
            background: white;
            color: rgba(0,0,0,0.5);
        }
        #participants {
            flex: 1;
            padding: 0 20px;
            display: flex;
            flex-direction: column;
            justify-contents: space-between;
            background: white;
            color: rgba(0,0,0,0.87);
            overflow: scroll;
        }
        .inverted {
            color: white;
            background: #2f9856;
        }
        div.edit-form {
        }
        .display {
            margin: 0 30px;
        }
        p {
            margin: 4px 0;
        }
        .heading {
            font-size: 20px;
            font-weight: 600;
            margin-top: 16px;
        }
        .participant-row {
            display: flex;
            flex-direction: row;
            align-items: center;
            margin: 1px 0px;
            max-height: 40px;
            flex: 1 1;
        } 
        @media (max-height: 700px) {
        }
        .participant-row .avatar {
            flex: 0 1 30px;
            padding: 0 5px;
        }
        .dimmed {
            color: rgba(0, 0, 0, 0.3);
        }
        .participant-row .row-main {
            display: inline;
            margin: 0;
            flex: 1;
            overflow: hidden;
        }
        .participant-row .participant-name {
            margin: 4px 0;
            overflow: hidden;
        }
        .participant-row .comment {
            margin: 4px 0;
            font-size: 14px;
            overflow: hidden;
            color: rgba(0, 0, 0, 0.5);
        }
        .participant-row .response {
            padding: 0 5px;
            font-weight: 600;
        }
        #myresponse {
            display: flex;
            flex-direction: column;
        }
        `;
    }
    
    renderDisplay() {
        if (this.event == null) {
            return ''
        }
        return html`<div class="display">
        <time-range start=${ifDefined(this.event.data().start)}
        stop=${ifDefined(this.event.data().stop)}></time-range>
        <p class="heading">${this.event.data().type}</p>
        <p>${this.event.data().location}</p>
        <p>${this.event.data().description}</p>
        </div>`;
    }
    
    participantName(id) {
        console.log("users", this.users);
        let user = this.users[id];
        return user ? user.display_name : id;
    }
    
    responseButton(uid, participant, response) {
        return html`<mwc-button @click=${e => this.setAttending(uid, response)}
        id="${response}"
        icon="${responseIcons[response]}"
        label="${attendances[response]}"
        ?outlined="${participant.attending == response}"
        ></mwc-button>`;
    }
    
    clickParticipant(uid) {
        if (!this.edit && uid == firebase.auth().currentUser.uid) {
            this.editResponse = uid;
        }
    }
    
    userRow(uid, user) {
        let participant = this.participants[uid] || {};
        return html`<div class="participant-row" @click=${e => this.clickParticipant(uid)}>
        <mwc-icon class=${classMap({avatar: true, dimmed: !participant.attending})}>person</mwc-icon>
        <div class="row-main">
        <p class="participant-name">${user.display_name}</p>
        ${participant.comment
            ? html`<p class="comment">${participant.comment}</p>`
            : ''
        }
        </div>
        <span class="response">${attendances[participant.attending || "unknown"]}</span>
        </div>`;
    }
    
    render() {
        let counts = this.countResponses();
        return html`<div id="top">
        <div id="buttons" class="inverted">
        <mwc-icon-button icon="close" @click=${e => this.close()}></mwc-icon-button>
        <span style="flex: 1"> </span>
        ${this.event ? html`<mwc-icon-button icon="edit" @click=${e => { this.edit = !this.edit; }}></mwc-icon-button>` : ''}
        </div>
        <div id="info" class="inverted">
        ${this.edit ? html`<event-editor ?range=${this.event ? this.event.data().stop : false}
        bandref="${ifDefined(this.bandref || undefined)}"
        .event=${this.event}
        @saved=${e => this.close()}></event-editor>`
        : this.renderDisplay()}
        </div>
        <div id="summary">
        ${counts["yes"] + counts["sub"]} ja/vik &ndash;
        ${counts["no"] + counts["sub"]} nej
        </div>
        <div id="participants">
        ${Object.entries(this.users).map(([uid, user]) => this.userRow(uid, user))}
        </div>
        </div>`;
    }
    
    setAttending(uid, response) {
        let ref = `${this.event.ref.path}/participants/${uid}`;
        firebase.firestore().doc(ref).set({ attending: response },  { merge: true });
    }
    
    setComment(uid, comment) {
        let ref = `${this.event.ref.path}/participants/${uid}`;
        firebase.firestore().doc(ref).set({ comment: comment }, { merge: true });
    }
    
    close() {
        let event = new CustomEvent("close", {});
        this.dispatchEvent(event);
    }
}

customElements.define('event-card', EventCard);
