import "./band-selector.js";
import "./band-schedule.js";
import "./event-page.js";
import '@material/mwc-fab';

var bands;

function selector() {
  return document.getElementById("selector");
}

function openEvent(e) {
  console.log("Selected event", e.detail);
  let editpage = document.getElementById("editpage");
  editpage.loadEvent(e.detail.eventref);
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
    schedule.addEventListener('select-event', e => { openEvent(e) });
    document.getElementById('fab').addEventListener('click', e => { addEvent(e) });
    selector.style.display = 'block';
    schedule.style.display = 'block';
    query.get().then((querySnapshot) => {
      selector.setBands(querySnapshot.docs);
      console.log("Current band:", selector.current), selector.currentName();
      schedule.setAttribute('bandref', selector.currentRef());
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
