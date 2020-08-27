import "./band-selector.js";
import "./band-schedule.js";
import './event-card.js';
import '@material/mwc-fab';
import '@material/mwc-top-app-bar-fixed';

let bands = {};

function selector() {
  return document.getElementById("selector");
}

function selectBand(id, data) {
  let editpage = document.getElementById("editpage");
  editpage.setBand(band);
}

function openBand(e) {
  let schedule = document.getElementById("band");
  schedule.users = bands[e.detail.id].users || {};
  console.log("Current band:", e.detail.id);
  schedule.setAttribute('path', e.detail.path);
  window.location = "#" + e.detail.id;
}

function createEventCard() {
  let card = document.createElement("event-card")
  card.users = bands[selector().current].users || {}
  card.classList.add('expanded')
  card.addEventListener('close', e => { card.remove() });
  return card
}
function openEvent(e) {
  console.log("Selected event", e.detail);
  let card = createEventCard()
  card.setGig(e.detail.gig)
  document.body.appendChild(card)
}

function addEvent(e) {
  console.log("Add event", e);
  let card = createEventCard()
  card.bandref = selector().currentRef()
  card.edit = true
  document.body.appendChild(card)
}

firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    // User is signed in.
    let query = firebase.firestore().collection("bands")
        .where("acl", "array-contains", user.uid);
    let selector = document.getElementById("selector");
    let schedule = document.getElementById("band");
    let editpage = document.getElementById("editpage");
    selector.addEventListener('select-band', e => { openBand(e) });
    schedule.addEventListener('select-event', e => { openEvent(e) });
    document.getElementById('fab').addEventListener('click', e => { addEvent(e) });
    selector.style.display = 'block';
    schedule.style.display = 'block';
    query.get().then((querySnapshot) => {
      bands = {};
      querySnapshot.docs.forEach(b => {
        bands[b.id] = b.data();
      });

      let fromUrl = location.hash.substr(1);
      if (fromUrl.length > 0 && !(fromUrl in bands)) {
        console.log("Making a join request to", fromUrl);
        let joinreq = {};
        joinreq[fromUrl] = firebase.firestore.Timestamp.now();
        firebase.firestore().doc("joins/" + user.uid).set(joinreq, { merge: true }).then(d => {
          console.log("Done", d);
        });
        return;
      }
      selector.current = fromUrl;
      selector.setBands(querySnapshot.docs);
    });
    document.getElementById("firebaseui-auth-container").style.display = 'none'
    document.getElementById("username").innerText = user.displayName + ' - ' + user.email
  } else {
    // No user is signed in.
    document.getElementById("firebaseui-auth-container").style.display = 'block'
    document.getElementById("username").innerText = "inte inloggad"
  }
});

// Initialize the FirebaseUI Widget using Firebase.
var ui = new firebaseui.auth.AuthUI(firebase.auth());
ui.start('#firebaseui-auth-container', {
  signInOptions: [
    firebase.auth.EmailAuthProvider.PROVIDER_ID,
    firebase.auth.GoogleAuthProvider.PROVIDER_ID,
  ],
  // Other config options...
});
