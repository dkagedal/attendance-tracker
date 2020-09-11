import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

admin.initializeApp();

const db = admin.firestore();

export const approval = functions.firestore.document('bands/{bandId}/join_requests/{userId}').onUpdate(async (change, context) => {
    functions.logger.info(change.after.data()?.approved);
    if (change.after.data()?.approved) {
        functions.logger.info('Approving join request', change.after.ref.path);
        const bandDocRef = change.after.ref.parent.parent!;
        const memberDocRef = bandDocRef.collection("members").doc(context.params.userId);
        const userDocRef = db.collection("users").doc(context.params.userId);
        const bandSnapshot = await bandDocRef.get();
        const userSnapshot = await userDocRef.get();
        const data = userSnapshot.data()!;
        if (data.bands == undefined) {
            data.bands = {};
        }
        data.bands[context.params.bandId] = { display_name: bandSnapshot.data()!.display_name };
        await Promise.all([
            userDocRef.set(data),
            memberDocRef.set({ display_name: data.display_name }),
            change.after.ref.delete()
        ]);
        functions.logger.info('Approved', change.after.ref.path);
    }
    return "OK";
})

async function migrateUser(uid: string, data: any) {
    const userDoc = db.collection("users").doc(uid)
    const existing = await userDoc.get()
    if (existing.exists) {
        functions.logger.info("Updating global user", uid)
        Object.assign(data.bands, existing.data()!.bands)
    } else {
        functions.logger.info("Creating global user", uid)
    }
    functions.logger.info("Setting global user", uid, data)
    await userDoc.set(data)
}

export const migrate = functions.https.onRequest((req, resp) => {
    db.collection("bands").get().then(async (snap) => {
        const users: any = {}
        snap.docs.forEach(band => {
            for (const uid in band.data().users) {
                if (!(uid in users)) {
                    users[uid] = { display_name: "?", bands: {} }
                }
                users[uid].display_name = band.data().users[uid].display_name
                users[uid].bands[band.id] = { display_name: band.data().display_name }
            }
        })
        functions.logger.info("Users to migrate", users)
        await Promise.all(Object.entries(users).map((elt: any[]) => {
            return migrateUser(elt[0], elt[1])
        }))
        resp.sendStatus(200);
    }).catch(reason => {
        functions.logger.error(reason)
        resp.sendStatus(500)
    })
})