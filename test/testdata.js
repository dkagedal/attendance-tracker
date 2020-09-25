const assert = require('assert');
const firebase = require('@firebase/testing');
const { promises } = require('dns');

const PROJECT_ID = "attendance-tracker-b8e9f";

const admin = firebase.initializeAdminApp({ projectId: PROJECT_ID }).firestore();

const bands = {
    ellington: {
        display_name: "The Duke Ellington Orchestra",
    }
};

function user(display_name, band) {
    const u = { display_name: display_name, bands: {} }
    if (band != undefined) {
        u.bands[band] = bands[band];
    }
    return u;
}

const data = {
    users: {
        uid_duke: user("Duke Ellington", "ellington"),
        uid_carney: user("Harry Carney", "ellington"),
        uid_carney: user("Juan Tizol", "ellington"),
        uid_guy: user("Fred Guy", "ellington"),
        uid_hodges: user("Johnny Hodges", "ellington"),
        uid_tricky: user("Joe Nanton", "ellington"),
        uid_cootie: user("Cootie Williams", "ellington"),
    },
    bands: {
        ellington: {
            display_name: "The Duke Ellington Orchestra",
            sections: ["sax", "rhythm"],
            collections: {
                members: {
                    uid_duke: { display_name: "Duke Ellington", admin: true },
                    uid_carney: { display_name: "Harry Carney" },
                    uid_tizol: { display_name: "Juan Tizol" },
                    uid_guy: { display_name: "Fred Guy", section: "rhythm" },
                    uid_hodges: { display_name: "Johnny Hodges", section: "sax" },
                    uid_tricky: { display_name: "Tricky Sam" },
                    uid_cootie: { display_name: "Cootie Williams" },
                },
                join_requests: {
                },
                events: {
                    aaa: {
                        type: "Rehearsal",
                        location: "Cotton Club",
                        start: "2020-09-19T20:00",
                        collections: {
                            participants: {
                                uid_duke: { attending: "yes" }
                            }
                        }
                    },
                    bbb: {
                        type: "Gig",
                        location: "Cotton Club",
                        description: "Don't get around much anymore.",
                        start: "2020-09-19T22:00",
                        stop: "2020-09-20T04:00",
                    },
                    ccc: {
                        type: "Rehearsal",
                        location: "Cotton Club",
                        cancelled: true,
                        start: "2020-09-20T20:00",
                    },
                    ccc: {
                        type: "Rehearsal",
                        location: "Cotton Club",
                        proposed: true,
                        start: "2020-09-21T20:00",
                    },

                }
            }
        }
    },
};


async function walkTestData(data, parent) {
    for (const collectionId in data) {
        const collection = parent.collection(collectionId);
        console.log("Collection:", collection.path);
        for (const docId in data[collectionId]) {
            const doc = collection.doc(docId);
            const docData = data[collectionId][docId];
            const subcollections = docData.collections;
            delete docData.collections;
            console.log("Document:", doc.path);
            await doc.set(docData);
            console.log("Created", doc.path);
            if (subcollections) {
                await walkTestData(subcollections, doc);
            }
        }
    }
}

function createTestData() {
    firebase.clearFirestoreData({ projectId: PROJECT_ID }).then((result) => {
        return walkTestData(data, admin);
    }).then((result) => {
        console.log("Done.");
    }).catch((reason) => {
        console.log("Failed", reason);
        process.exit(1);
    }).finally(() => {
        process.exit();
    })
}

createTestData();