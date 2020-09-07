const assert = require('assert');
const firebase = require('@firebase/testing');

const PROJECT_ID = "attendance-tracker-b8e9f";

function getFirestore(auth) {
    return firebase.initializeTestApp({projectId: PROJECT_ID, auth: auth}).firestore();
}

function getAdminFirestore() {
    return firebase.initializeAdminApp({projectId: PROJECT_ID}).firestore();
}

beforeEach(async() => {
    await firebase.clearFirestoreData({projectId: PROJECT_ID});
})

describe("Attendance tracker", () => {
    it("Unauthenticated users can't read bands", async () => {
        const db = getFirestore(null);
        const doc = db.collection("bands").doc("beatles");
        await firebase.assertFails(doc.get());
    });

    it("Unauthenticated users can't query for all bands", async () => {
        const db = getFirestore(null);
        const query = db.collection("bands");
        await firebase.assertFails(query.get());
    });

    it("Everyone can read bands they are in the ACL for", async () => {
        const admin = getAdminFirestore();
        await admin.collection("bands").doc("beatles").set({acl: ["user1"]});

        const auth = {uid: "user1", email: "user1@gmail.com"};
        const db = getFirestore(auth);
        const doc = db.collection("bands").doc("beatles");
        await firebase.assertSucceeds(doc.get());
    });

    it("Users can query for bands they are in the ACL for", async () => {
        const auth = {uid: "user1", email: "user1@gmail.com"};
        const db = getFirestore(auth);
        const query = db.collection("bands").where("acl", "array-contains", auth.uid);
        await firebase.assertSucceeds(query.get());
    });

    it("Unauthenticated users can't write bands", async () => {
        const db = getFirestore(null);
        const doc = db.collection("bands").doc("beatles");
        await firebase.assertFails(doc.set({foo: "bar"}));
    });

    it("Authenticated users can't write bands", async () => {
        const auth = {uid: "user1", email: "user1@gmail.com"};
        const db = getFirestore(auth);
        const doc = db.collection("bands").doc("beatles");
        await firebase.assertFails(doc.set({foo: "bar"}));
    });
})

after(async() => {
    await firebase.clearFirestoreData({projectId: PROJECT_ID});
})