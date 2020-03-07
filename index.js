import "./band-selector.js";
import "./band-schedule.js";
import './event-page.js';
import '@material/mwc-fab';

let bands = {};

function selector() {
  return document.getElementById("selector");
}

function selectBand(id, data) {
  let editpage = document.getElementById("editpage");
  editpage.setBand(band);
}

function openBand(e) {
  let editpage = document.getElementById("editpage");
  let schedule = document.getElementById("band");
  editpage.users = bands[e.detail.id].users || {};
  console.log("Current band:", e.detail.id);
  schedule.setAttribute('bandref', e.detail.ref);
  window.location = "#" + e.detail.id;
}

function openEvent(e) {
  let editpage = document.getElementById("editpage");
  console.log("Selected event", e.detail);
  editpage.loadEvent(e.detail.eventref, e.detail.event);
  editpage.expandFrom(e.detail.item.offsetTop, e.detail.item.offsetHeight);
}

function addEvent(e) {
  console.log("Add event", e);
  let editpage = document.getElementById("editpage");
  editpage.prepareAdd(selector().currentRef());
  editpage.expandFrom(0, 10);
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
