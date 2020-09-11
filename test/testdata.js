const assert = require('assert');
const firebase = require('@firebase/testing');
const { promises } = require('dns');

const PROJECT_ID = "attendance-tracker-b8e9f";

const admin = firebase.initializeAdminApp({projectId: PROJECT_ID}).firestore();

const data = {
    users: {
        uid_duke: {
            display_name: "Duke Ellington",
            bands: {
                ellington: {
                    display_name: "The Duke Ellington Orchestra",
                }
            }
        },
        uid_carney: {
            display_name: "Harry Carney",
            bands: {
                ellington: {
                    display_name: "The Duke Ellington Orchestra",
                }
            }
        },
        uid_cootie: {
            display_name: "Cootie Williams",
            bands: {}
        },
    },
    bands: {
        ellington: {
            display_name: "The Duke Ellington Orchestra",
            collections: {
                members: {
                    uid_duke: {status: "active", admin: true},
                    uid_carney: {status: "active"},
                },
                join_requests: {
                    uid_cootie: {},
                },
                events: {
                    aaa: {
                        type: "Rehearsal",
                        location: "Cotton Club",
                        start: "2020-09-19T20:00",
                        collections: {
                            participants: {
                                uid_duke: {attending: true}
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
    firebase.clearFirestoreData({projectId: PROJECT_ID}).then((result) => {
        return  walkTestData(data, admin);
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