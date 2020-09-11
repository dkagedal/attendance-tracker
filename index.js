import "./band-schedule.js";
import './event-card.js';
import { getOrCreateUser } from './users.js';
import '@material/mwc-drawer';
import '@material/mwc-fab';
import '@material/mwc-top-app-bar-fixed';

let bands = {};
let current = null;

var db = firebase.firestore();
if (location.hostname === "localhost") {
  db.settings({
    host: "localhost:8080",
    ssl: false
  });
}

function selectBand(id) {
  console.log("Selected band", id);
  current = id;
  const path = `bands/${id}`
  const schedule = document.getElementById("band");
  console.log("Current band:", id);
  schedule.setAttribute('path', path);
  window.location = "#" + id;
}

function createEventCard(from) {
  console.log("Creating event card from", from);
  let card = document.createElement("event-card")
  card.bandref = `bands/${current}`
  // card.users = bands[selector().current].users || {}
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
  card.edit = true
}

async function joinRequest(uid, bandId) {
  const docPath = `bands/${bandId}/join_requests/${uid}`;
  console.log("Making a join request to", docPath);
  await db.doc(docPath).set({ approved: false }, { merge: true });
  console.log("Done");
}

firebase.auth().onAuthStateChanged(async(authUser) => {
  if (!authUser) {
    // No user is signed in.
    document.getElementById("firebaseui-auth-container").style.display = 'block';
    document.getElementById("username").innerText = "inte inloggad";
    return;
  }
  
  const user = await getOrCreateUser(authUser);
  const drawer = document.getElementById('mainMenuDrawer');
  
  bands = {};
  for (const bandId in user.bands) {
    const band = user.bands[bandId];
    console.log('Found band', bandId, band)
    bands[bandId] = Object.assign({}, band);
    let bandElt = document.createElement('p')
    let bandName = document.createTextNode(band.display_name)
    bandElt.appendChild(bandName)
    bandElt.addEventListener('click', e => { drawer.open = false; selectBand(bandId) });
    document.getElementById('bandList').appendChild(bandElt)
  }
  console.log("Bands:", bands);
  
  let fromUrl = location.hash.substr(1);
  if (fromUrl.length > 0 && !(fromUrl in bands)) {
    await joinRequest(authUser.uid, fromUrl);
    let msg = document.createTextNode("Registrering inskickad!");
    let msgDiv = document.getElementById("message");
    msgDiv.appendChild(msg);
    msgDiv.style.display = 'block'
    return;
  }

  if (fromUrl in bands) {
    selectBand(fromUrl);
  }

  const schedule = document.getElementById("band");
  schedule.style.display = 'block';
  schedule.addEventListener('select-event', e => { openEvent(e) });
  
  document.getElementById("mainMenuButton").addEventListener('click', e => drawer.open = !drawer.open)
  document.getElementById('fab').addEventListener('click', e => { addEvent(e) });
  
  document.getElementById("firebaseui-auth-container").style.display = 'none'
  document.getElementById("username").innerText = user.display_name;
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
