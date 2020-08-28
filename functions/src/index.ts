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

export const testinint = functions.https.onRequest((request, response) => {
    functions.logger.info("Creating test data.", {structuredData: true});
    response.send("Created test data\n");
  });

export const newjoin = functions.firestore.document('joins/{userId}').onWrite((change, context) => {
    let bandPath = change.after.data()!.band;
    let joinRequestDoc = db.doc(`${bandPath}/join_requests/${context.params.userId}`)
    functions.logger.info(`Someone wants to join ${bandPath}, creating ${joinRequestDoc.path}`);
    joinRequestDoc.set({
        timestamp: change.after.data()?.timestamp,
        display_name: change.after.data()?.display_name,
        approved: false
    }).then(_ => {
        functions.logger.info('Created join request');
        return change.after.ref.delete();
    }).catch(error => {
        functions.logger.error(error);
    });
    return "OK";
});

export const approval = functions.firestore.document('bands/{bandid}/join_requests/{userId}').onUpdate((change, context) => {
    functions.logger.info(change.after.data()?.approved) ;
    if (change.after.data()?.approved) {
        functions.logger.info('Approving join request', change.after.ref.path);
        let bandDocRef = change.after.ref.parent.parent!;
        bandDocRef.get().then(doc => {
            let data = doc.data()!;
            let acl = data.acl || [];
            let users = data.users || {};
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