import "./band-selector.js";
import "./band-schedule.js";
import './event-card.js';
import '@material/mwc-drawer';
import '@material/mwc-fab';
import '@material/mwc-top-app-bar-fixed';

let bands = {};

var db = firebase.firestore();
if (location.hostname === "localhost") {
  db.settings({
    host: "localhost:8080",
    ssl: false
  });
}

function selector() {
  return document.getElementById("selector");
}

function selectBand(id, data) {
  let editpage = document.getElementById("editpage");
  editpage.setBand(band);
}

function openBand(id, path) {
  let schedule = document.getElementById("band");
  schedule.users = bands[id].users || {};
  console.log("Current band:", id);
  schedule.setAttribute('path', path);
  window.location = "#" + id;
}

function createEventCard(from) {
  let card = document.createElement("event-card")
  card.users = bands[selector().current].users || {}
  let container = document.createElement("div");
  container.classList.add("event-container", "smallcard")
  container.style.top = `${from.offsetTop}px`;
  container.style.left = `${from.offsetleft}px`;
  container.style.height = `${from.offsetHeight}px`;
  container.style.width = `${from.offsetWidth}px`;
  card.addEventListener('close', e => {
    container.classList.remove('largecard');
    container.classList.add('smallcard');
    container.style.top = `${from.offsetTop}px`;
    container.style.left = `${from.offsetleft}px`;
    container.style.height = `${from.offsetHeight}px`;
    container.style.width = `${from.offsetWidth}px`;
    container.ontransitionend = (e => {
      container.remove();
    });
  });
  container.appendChild(card);
  document.body.appendChild(container)
  requestAnimationFrame(() => {
    container.classList.remove('smallcard')
    container.classList.add('largecard')
    container.style = null;
  });
  return card
}
function openEvent(e) {
  console.log("Selected event", e.detail);
  let card = createEventCard(e.detail.item)
  card.setGig(e.detail.gig)
}

function addEvent(e) {
  console.log("Add event", e);
  let card = createEventCard(document.getElementById("fab"));
  card.bandref = selector().currentRef()
  card.edit = true
}

function joinRequest(user, bandId) {
  console.log("Making a join request to", bandId, "for", user.displayName);
  let joinreq = {
    band: `bands/${bandId}`,
    timestamp: firebase.firestore.Timestamp.now(),
    display_name: user.displayName
  };
  db.doc(`joins/${user.uid}`).set(joinreq, { merge: true }).then(d => {
    console.log("Done", d);
  });
}

firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    let selector = document.getElementById("selector");
    let drawer = document.getElementById('mainMenuDrawer');
    
    // User is signed in.
    let query = db.collection("bands")
    .where("acl", "array-contains", user.uid);
    query.get().then((querySnapshot) => {
      bands = {};
      querySnapshot.docs.forEach(b => {
        console.log('Found band', b.ref, b.data())
        bands[b.id] = b.data();
        let bandElt = document.createElement('p')
        let bandName = document.createTextNode(b.data().display_name)
        bandElt.appendChild(bandName)
        bandElt.addEventListener('click', e => { drawer.open = false; selector.selectBand(b.id) });
        document.getElementById('bandList').appendChild(bandElt)
      });
      let fromUrl = location.hash.substr(1);
      if (fromUrl.length > 0 && !(fromUrl in bands)) {
        joinRequest(user, fromUrl);
        let msg = document.createTextNode("Registrering inskickad!");
        let msgDiv = document.getElementById("message");
        msgDiv.appendChild(msg);
        msgDiv.style.display = 'block'
        return;
      }
      selector.current = fromUrl;
      selector.setBands(querySnapshot.docs);
      selector.style.display = 'block';
      schedule.style.display = 'block';
    });
    
    document.getElementById("mainMenuButton").addEventListener('click', e => drawer.open = !drawer.open)
    let schedule = document.getElementById("band");
    selector.addEventListener('select-band', e => { openBand(e.detail.id, e.detail.path) });
    schedule.addEventListener('select-event', e => { openEvent(e) });
    document.getElementById('fab').addEventListener('click', e => { addEvent(e) });
    
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
