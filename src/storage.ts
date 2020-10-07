import firebase from "firebase/app";  // HIDE

export interface UserBand {
    display_name: string,
}

export interface User {
    display_name: string,
    bands: {
        [id: string]: UserBand,
    },
}

export type UID = string

export const db = firebase.firestore();
if (location.hostname === "localhost") {
    db.settings({
        host: "localhost:8080",
        ssl: false
    });
}

export async function getUser(uid: UID) {
    const docRef = db.doc(`users/${uid}`);
    const snapshot = await docRef.get();
    if (snapshot.exists) {
        console.log("Found user", uid, snapshot.data());
        return snapshot.data();
    } else {
        return null;
    }
}

export async function getOrCreateUser(user: firebase.User): Promise<User> {
    const docRef = db.doc(`users/${user.uid}`);
    const snapshot = await docRef.get();
    if (snapshot.exists) {
        console.log("Found user", snapshot.data());
        return snapshot.data() as User;
    }
    const data = {
        display_name: user.displayName || "??",
        bands: {}
    };
    console.log("Creating user record for", user.displayName);
    await docRef.set(data, { merge: true });
    return data;
}
