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
    describe("User documents", () => {
        it("can be created by the user", async () => {
            const auth = {uid: "user1", email: "user1@gmail.com"};
            const db = getFirestore(auth);
            const doc = db.collection("users").doc(auth.uid);
            await firebase.assertSucceeds(doc.set({}));
        });
        
        it("can't be created by another user", async () => {
            const auth = {uid: "user1", email: "user1@gmail.com"};
            const db = getFirestore(auth);
            const doc = db.collection("users").doc("user2");
            await firebase.assertFails(doc.set({}));
        });
        
        it("can't be created by an unauthenticated user", async () => {
            const db = getFirestore(null);
            const doc = db.collection("users").doc("user1");
            await firebase.assertFails(doc.set({}));
        });

        it("can be update by the user if they don't change anything", async () => {
            const admin = getAdminFirestore();
            await admin.collection("users").doc("user1").set({display_name: "User One"});

            const auth = {uid: "user1", email: "user1@gmail.com"};
            const db = getFirestore(auth);
            const doc = db.collection("users").doc(auth.uid);
            await firebase.assertSucceeds(doc.set({}, { merge: true }));
        });

        it("can't be update by the user if they change anything", async () => {
            const admin = getAdminFirestore();
            await admin.collection("users").doc("user1").set({display_name: "User One"});

            const auth = {uid: "user1", email: "user1@gmail.com"};
            const db = getFirestore(auth);
            const doc = db.collection("users").doc(auth.uid);
            await firebase.assertFails(doc.set({admin: true}, { merge: true }));
        });
    });
    
    describe("Band documents", () => {
        it("can be read by unauthenticated users", async () => {
            const db = getFirestore(null);
            const doc = db.collection("bands").doc("beatles");
            await firebase.assertSucceeds(doc.get());
        });
        
        it("can't be queried by unauthenticated users", async () => {
            const db = getFirestore(null);
            const query = db.collection("bands");
            await firebase.assertFails(query.get());
        });
        
        it("can be read by ACL'd users", async () => {
            const admin = getAdminFirestore();
            await admin.collection("bands").doc("beatles").set({acl: ["user1"]});
            
            const auth = {uid: "user1", email: "user1@gmail.com"};
            const db = getFirestore(auth);
            const doc = db.collection("bands").doc("beatles");
            await firebase.assertSucceeds(doc.get());
        });
        
        it("can't be queried by by ACL'd users", async () => {
            const auth = {uid: "user1", email: "user1@gmail.com"};
            const db = getFirestore(auth);
            const query = db.collection("bands").where("acl", "array-contains", auth.uid);
            await firebase.assertFails(query.get());
        });
        
        it("can't be written by unauthenticated users", async () => {
            const db = getFirestore(null);
            const doc = db.collection("bands").doc("beatles");
            await firebase.assertFails(doc.set({foo: "bar"}));
        });
        
        it("can't be written by authenticated users", async () => {
            const auth = {uid: "user1", email: "user1@gmail.com"};
            const db = getFirestore(auth);
            const doc = db.collection("bands").doc("beatles");
            await firebase.assertFails(doc.set({foo: "bar"}));
        });
    });
    
    describe("Memberships", () => {
        it("can be listed by members", async () => {
            const admin = getAdminFirestore();
            await admin.collection("users").doc("ringo").set({bands: {beatles: {}}})
            await admin.collection("bands").doc("beatles").set({display_name: "The Beatles"});
            await admin.collection("bands").doc("beatles").collection("members").doc("ringo").set({});
            
            const auth = {uid: "ringo", email: "ringo@beatles.com"};
            const db = getFirestore(auth);
            const query = db.collection("bands").doc("beatles").collection("members");
            await firebase.assertSucceeds(query.get());
        })
        
        it("can't be listed by non-members", async () => {
            const admin = getAdminFirestore();
            await admin.collection("users").doc("ringo").set({bands: {beatles: {}}})
            await admin.collection("bands").doc("beatles").set({display_name: "The Beatles"});
            
            const auth = {uid: "ringo", email: "ringo@beatles.com"};
            const db = getFirestore(auth);
            const query = db.collection("bands").doc("beatles").collection("members");
            await firebase.assertFails(query.get());
        })
        
        it("members can get other members", async () => {
            const admin = getAdminFirestore();
            await admin.collection("users").doc("ringo").set({bands: {beatles: {}}})
            await admin.collection("bands").doc("beatles").set({display_name: "The Beatles"});
            await admin.collection("bands").doc("beatles").collection("members").doc("ringo").set({});
            await admin.collection("bands").doc("beatles").collection("members").doc("paul").set({});
            
            const auth = {uid: "ringo", email: "ringo@beatles.com"};
            const db = getFirestore(auth);
            const doc = db.collection("bands").doc("beatles").collection("members").doc("paul");
            await firebase.assertSucceeds(doc.get());
        })
        
        it("non-members can't get other members", async () => {
            const admin = getAdminFirestore();
            await admin.collection("users").doc("ringo").set({bands: {beatles: {}}})
            await admin.collection("bands").doc("beatles").set({display_name: "The Beatles"});
            await admin.collection("bands").doc("beatles").collection("members").doc("paul").set({});
            
            const auth = {uid: "ringo", email: "ringo@beatles.com"};
            const db = getFirestore(auth);
            const doc = db.collection("bands").doc("beatles").collection("members").doc("paul");
            await firebase.assertFails(doc.get());
        })
        
        it("can't be self-added", async () => {
            const admin = getAdminFirestore();
            await admin.collection("users").doc("ringo").set({bands: {beatles: {}}})
            await admin.collection("bands").doc("beatles").set({display_name: "The Beatles"});
            
            const auth = {uid: "ringo", email: "ringo@beatles.com"};
            const db = getFirestore(auth);
            const query = db.collection("bands").doc("beatles").collection("members").doc("ringo");
            await firebase.assertFails(query.set({}));
        })
        
    });
    
    describe("Join Requests", () => {
        it("request members can get their own request", async () => {
            const admin = getAdminFirestore();
            await admin.collection("users").doc("ringo").set({bands: {beatles: {}}})
            await admin.collection("bands").doc("beatles").set({display_name: "The Beatles"});
            await admin.collection("bands").doc("beatles").collection("join_requests").doc("ringo").set({status: "request"});
            
            const auth = {uid: "ringo", email: "ringo@beatles.com"};
            const db = getFirestore(auth);
            const doc = db.collection("bands").doc("beatles").collection("join_requests").doc("ringo");
            await firebase.assertSucceeds(doc.get());
        })
        
        it("can be self-added", async () => {
            const admin = getAdminFirestore();
            await admin.collection("users").doc("ringo").set({bands: {beatles: {}}})
            await admin.collection("bands").doc("beatles").set({display_name: "The Beatles"});
            
            const auth = {uid: "ringo", email: "ringo@beatles.com"};
            const db = getFirestore(auth);
            const query = db.collection("bands").doc("beatles").collection("join_requests").doc("ringo");
            await firebase.assertSucceeds(query.set({ approved: false }));
        })
        
        it("can be pre-approved", async () => {
            const admin = getAdminFirestore();
            await admin.collection("users").doc("ringo").set({bands: {beatles: {}}})
            await admin.collection("bands").doc("beatles").set({display_name: "The Beatles"});
            
            const auth = {uid: "ringo", email: "ringo@beatles.com"};
            const db = getFirestore(auth);
            const query = db.collection("bands").doc("beatles").collection("join_requests").doc("ringo");
            await firebase.assertFails(query.set({ approved: true }));
        })
        
        it("requires the user to exist", async () => {
            const admin = getAdminFirestore();
            await admin.collection("bands").doc("beatles").set({display_name: "The Beatles"});
            
            const auth = {uid: "ringo", email: "ringo@beatles.com"};
            const db = getFirestore(auth);
            const query = db.collection("bands").doc("beatles").collection("join_requests").doc("ringo");
            await firebase.assertFails(query.set({}));
        })
    });
    
    describe("Events", () => {
        const EVENT = {
            type: "Gig",
            location: "Cavern Club",
            description: "Yeah Yeah Yeah",
            start: "2020-09-19T22:00",
            stop: "2020-09-20T04:00",
        };
        
        it("can be listed by active members", async () => {
            const admin = getAdminFirestore();
            await admin.collection("users").doc("ringo").set({bands: {beatles: {}}})
            await admin.collection("bands").doc("beatles").set({display_name: "The Beatles"});
            await admin.collection("bands").doc("beatles").collection("members").doc("ringo").set({status: "active"});
            
            const auth = {uid: "ringo", email: "ringo@beatles.com"};
            const db = getFirestore(auth);
            const query = db.collection("bands").doc("beatles").collection("events");
            await firebase.assertSucceeds(query.get());
        })
        
        it("can't be listed by non-members", async () => {
            const admin = getAdminFirestore();
            await admin.collection("users").doc("ringo").set({bands: {beatles: {}}})
            await admin.collection("bands").doc("beatles").set({display_name: "The Beatles"});
            
            const auth = {uid: "ringo", email: "ringo@beatles.com"};
            const db = getFirestore(auth);
            const query = db.collection("bands").doc("beatles").collection("events");
            await firebase.assertFails(query.get());
        })
        
        it("can be added by members", async () => {
            const admin = getAdminFirestore();
            await admin.collection("users").doc("ringo").set({bands: {beatles: {}}})
            await admin.collection("bands").doc("beatles").set({display_name: "The Beatles"});
            await admin.collection("bands").doc("beatles").collection("members").doc("ringo").set({status: "active"});
            
            const auth = {uid: "ringo", email: "ringo@beatles.com"};
            const db = getFirestore(auth);
            const events = db.collection("bands").doc("beatles").collection("events");
            await firebase.assertSucceeds(events.add(EVENT));
        })
        
        it("can be updated by members", async () => {
            const admin = getAdminFirestore();
            await admin.collection("users").doc("ringo").set({bands: {beatles: {}}})
            await admin.collection("bands").doc("beatles").set({display_name: "The Beatles"});
            await admin.collection("bands").doc("beatles").collection("members").doc("ringo").set({status: "active"});
            await admin.collection("bands").doc("beatles").collection("events").doc("ev1").set(EVENT);
            
            const auth = {uid: "ringo", email: "ringo@beatles.com"};
            const db = getFirestore(auth);
            const event = db.collection("bands").doc("beatles").collection("events").doc("ev1");
            const data = EVENT;
            data.location = "Abbey Road Studios";
            await firebase.assertSucceeds(event.set(data));
        })

        describe("Participants", () => {
            it("can be listed by members", async () => {
                const admin = getAdminFirestore();
                await admin.collection("users").doc("ringo").set({bands: {beatles: {}}})
                await admin.collection("bands").doc("beatles").set({display_name: "The Beatles"});
                await admin.collection("bands").doc("beatles").collection("members").doc("ringo").set({status: "active"});
                await admin.collection("bands").doc("beatles").collection("events").doc("ev1").set(EVENT);

                const auth = {uid: "ringo", email: "ringo@beatles.com"};
                const db = getFirestore(auth);
                const query = db.collection("bands").doc("beatles").collection("events").doc("ev1").collection("participants");
                await firebase.assertSucceeds(query.get());
            });
        });
    });
})

after(async() => {
    await firebase.clearFirestoreData({projectId: PROJECT_ID});
})