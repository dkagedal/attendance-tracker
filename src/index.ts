import '@material/mwc-drawer';
import '@material/mwc-fab';
import '@material/mwc-top-app-bar-fixed';
import '@material/mwc-icon-button';
import * as firebase from "firebase/app";  // HIDE
import firebaseui from 'firebaseui';  // HIDE
import { Drawer } from "@material/mwc-drawer";
import './band-schedule';
// import type { BandSchedule } from "./band-schedule";
import { getOrCreateUser, db } from './storage';

interface BandMap {
  [key: string]: any
}

let bands = {} as BandMap;

interface HostMap {
  [key: string]: string | null
}

var hostmap = {} as HostMap
async function bandFromHostname(): Promise<string | null> {
  if (!(location.hostname in hostmap)) {
    const snapshot = await db.collection("hosts").doc(location.hostname).get();
    if (snapshot.exists) {
      hostmap[location.hostname] = snapshot.data()!.band;
    } else {
      hostmap[location.hostname] = null;
    }
  }
  return hostmap[location.hostname];
}

function selectBand(id: string): void {
  console.log("Selected band", id);
  const schedule = document.getElementById("band")! as any /*as BandSchedule*/;
  db.collection("bands").doc(id).get().then(snapshot => {
    console.log("Updating schedule", snapshot);
    schedule.band = snapshot;
  })
  bandFromHostname().then(canon => {
    const urlPath = (canon == id) ? '/' : `/${id}`;
    if (location.pathname != urlPath) {
      history.replaceState({}, "", urlPath);
    }
  })
}

async function joinRequest(uid: string, bandId: string) {
  const docPath = `bands/${bandId}/join_requests/${uid}`;
  console.log("Making a join request to", docPath);
  await db.doc(docPath).set({ approved: false }, { merge: true });
  console.log("Done");
}

firebase.auth().onAuthStateChanged(async (authUser) => {
  if (!authUser) {
    // No user is signed in.
    document.getElementById("firebaseui-auth-container")!.style.display = 'block';
    document.getElementById("username")!.innerText = "inte inloggad";
    return;
  }

  const user = await getOrCreateUser(authUser);
  const drawer = document.getElementById('mainMenuDrawer')! as Drawer;

  bands = {};
  for (const bandId in user.bands) {
    const band = user.bands[bandId];
    console.log('Found band', bandId, band)
    bands[bandId] = Object.assign({}, band);
    let bandElt = document.createElement('p')
    let bandName = document.createTextNode(band.display_name)
    bandElt.appendChild(bandName)
    bandElt.addEventListener('click', () => { drawer.open = false; selectBand(bandId) });
    document.getElementById('bandList')!.appendChild(bandElt)
  }
  console.log("Bands:", bands);

  let fromUrl = location.hash != "" ? location.hash.substr(1) : location.pathname.substr(1);
  if (fromUrl.length == 0) {
    fromUrl = await bandFromHostname() || "";
  };

  console.log("Band id from URL:", fromUrl);
  if (fromUrl.length > 0 && !(fromUrl in bands)) {
    await joinRequest(authUser.uid, fromUrl);
    const msg = document.createTextNode("Registrering inskickad!");
    const msgDiv = document.getElementById("message")!;
    msgDiv.appendChild(msg);
    msgDiv.style.display = 'block'
    return;
  }

  if (fromUrl in bands) {
    selectBand(fromUrl);
  }

  const schedule = document.getElementById("band")! as any /*BandSchedule*/;
  schedule.style.display = 'block';

  document.getElementById("mainMenuButton")!.addEventListener('click', () => drawer.open = !drawer.open)
  // document.getElementById('fab')!.addEventListener('click', e => { addEvent(e) });

  document.getElementById("firebaseui-auth-container")!.style.display = 'none'
  document.getElementById("username")!.innerText = user.display_name;
});

// Initialize the FirebaseUI Widget using Firebase.
var ui = new firebaseui.auth.AuthUI(window.firebase.auth());
ui.start('#firebaseui-auth-container', {
  signInOptions: [
    firebase.auth.EmailAuthProvider.PROVIDER_ID,
    firebase.auth.GoogleAuthProvider.PROVIDER_ID,
  ],
  // Other config options...
});
