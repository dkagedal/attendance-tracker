var db = firebase.firestore();

export async function getUser(uid) {
    const docRef = db.doc(`users/${uid}`);
    const snapshot = await docRef.get();
    if (snapshot.exists) {
        console.log("Found user", uid, snapshot.data());
        return snapshot.data();
    } else {
        return null;
    }
}

export async function getOrCreateUser(user) {
    const docRef = db.doc(`users/${user.uid}`);
    const snapshot = await docRef.get();
    if (snapshot.exists) {
        console.log("Found user", snapshot.data());
        return snapshot.data();
    }
    const data = { display_name: user.displayName };
    console.log("Creating user record for", user.displayName);
    await docRef.set(data, { merge: true });
    return data;
}

