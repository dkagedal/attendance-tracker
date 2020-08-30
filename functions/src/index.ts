import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

admin.initializeApp();

const db = admin.firestore();

export const helloWorld = functions.https.onRequest((request, response) => {
    functions.logger.info("Hello logs!", {structuredData: true});
    response.send("Hello from Firebase!");
});

export const testinit = functions.https.onRequest((request, response) => {
    functions.logger.info("Creating test data.", {structuredData: true});
    db.doc('bands/test').set({display_name: 'Testband'}).then(_ => {
        response.send("Created test data\n");
    }).catch(error => {
        functions.logger.error(error);
        response.sendStatus(500);
    })
});

export const testusers = functions.https.onRequest((request, response) => {
    functions.logger.info("Creating test users.", {structuredData: true});
    db.doc('bands/test').set({
        acl: ["user1", "user2", "user3", "user4", "user5", "user6", "user7", "user8", "user9", "user10"],
        users: {
            user1: {display_name: "Allan Allansson"},
            user2: {display_name: "Bertil Bertilsson"},
            user3: {display_name: "Cecilia Certifikat"},
            user4: {display_name: "David Dumbom"},
            user5: {display_name: "Elsa Elendil"},
            user6: {display_name: "Fegis Fafnersbane"},
            user7: {display_name: "Greta Gul"},
            user8: {display_name: "Hakan Hector"},
            user9: {display_name: "Inge Is"},
            user10: {display_name: "Jöns Jakobsson"},
        }
    }, {merge: true}).then(_ => {
        response.send("Created test data\n");
    }).catch(error => {
        functions.logger.error(error);
        response.sendStatus(500);
    })
});

export const newjoin = functions.firestore.document('joins/{userId}').onCreate((snapshot, context) => {
    functions.logger.info('newjoin', snapshot.data());
    const bandPath = snapshot.data().band;
    const joinRequestDoc = db.doc(`${bandPath}/join_requests/${snapshot.ref.id}`)
    functions.logger.info(`${snapshot.data().display_name} wants to join ${bandPath}, creating ${joinRequestDoc.path}`);
    joinRequestDoc.set({
        timestamp: snapshot.data().timestamp,
        display_name: snapshot.data().display_name,
        approved: false
    }).then(_ => {
        functions.logger.info(`Created join request, deleting ${snapshot.ref.path}`);
        return snapshot.ref.delete();
    }).catch(error => {
        functions.logger.error(error);
    });
    return "OK";
});

export const approval = functions.firestore.document('bands/{bandid}/join_requests/{userId}').onUpdate((change, context) => {
    functions.logger.info(change.after.data()?.approved) ;
    if (change.after.data()?.approved) {
        functions.logger.info('Approving join request', change.after.ref.path);
        const bandDocRef = change.after.ref.parent.parent!;
        bandDocRef.get().then(doc => {
            const data = doc.data()!;
            const acl = data.acl || [];
            const users = data.users || {};
            acl.push(context.params.userId);
            users[context.params.userId] = {
                display_name: change.after.data()?.display_name
            };
            
            return bandDocRef.set({acl: acl, users: users}, {merge: true});
        }).then(_ => {
            return change.after.ref.delete();
        }).catch(error => {
            functions.logger.error(error);
        });
    }
    return "OK";
})