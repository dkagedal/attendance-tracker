import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

admin.initializeApp();

const db = admin.firestore();

function createLogger(context: any) {
  return {
    info: (...args: any[]) => {
      functions.logger.info(...args, context);
    }
  };
}

async function getBand(bandid:string) {
  const snapshot = await db.collection("bands").doc(bandid).get();
  return snapshot.data()!;
}

async function getUser(uid:string) {
  const snapshot = await db.collection("users").doc(uid).get();
  return snapshot.data()!;
}

export const joinRequestCreated = functions.firestore
  .document("bands/{bandId}/join_requests/{userId}")
  .onCreate(async (snapshot, context): Promise<void> => {
    const bandId = context.params.bandId;
    const userId = context.params.userId;
    const logger = createLogger({ bandId, userId });
    logger.info("New join request");
    const band = await getBand(bandId);
    const user = await getUser(userId);
    db.collection("mail").add({
      to: "david@kagedal.org",
      message: {
        subject: `Någon vill gå med i ${band.display_name}`,
        text: `Begäran om om att få bli medlem i ${band.display_name} via ${snapshot.get("url") || "??"}.

Namn: ${user.display_name}
        `
      }
    });
  });

export const approval = functions.firestore
  .document("bands/{bandId}/join_requests/{userId}")
  .onUpdate(
    async (change, context): Promise<string> => {
      const bandId = context.params.bandId;
      const userId = context.params.userId;
      const logger = createLogger({ bandId, userId });
      logger.info("Join request for", userId, "was updated");
      if (change.before.get("approved") || !change.after.get("approved")) {
        logger.info("Not approved, nothing to do");
        return "OK";
      }
      const joinRequest = change.after.data();
      logger.info("Approving join request for", userId, ":", joinRequest);
      const bandDocRef = change.after.ref.parent.parent!;
      const memberDocRef = bandDocRef.collection("members").doc(userId);
      const userDocRef = db.collection("users").doc(userId);
      const bandSnapshot = await bandDocRef.get();
      const userSnapshot = await userDocRef.get();
      const userData = userSnapshot.data()!;
      if (userData.bands === undefined) {
        userData.bands = {};
      }
      userData.bands[bandId] = {
        display_name: bandSnapshot.data()?.display_name || "??"
      };
      const memberData = {
        display_name: joinRequest.display_name,
        admin: false
      };
      logger.info("Updating", userDocRef.path, "to", userData);
      logger.info("Updating", memberDocRef.path, "to", memberData);
      await Promise.all([
        userDocRef.set(userData),
        memberDocRef.set(memberData),
        change.after.ref.delete()
      ]);
      logger.info("Done");
      return "OK";
    }
  );

async function migrateUser(uid: string, data: any) {
  const userDoc = db.collection("users").doc(uid);
  const existing = await userDoc.get();
  if (existing.exists) {
    functions.logger.info("Updating global user", uid);
    Object.assign(data.bands, existing.data()!.bands);
  } else {
    functions.logger.info("Creating global user", uid);
  }
  functions.logger.info("Setting global user", uid, data);
  await userDoc.set(data);
}

async function migrateMember(
  doc: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>,
  data: any
) {
  functions.logger.info("Updating", doc.path, data);
  await doc.set(data, { merge: true });
}

export const migrate = functions.https.onRequest((req, resp) => {
  db.collection("bands")
    .get()
    .then(async snap => {
      const promises: Promise<void>[] = [];
      const users: any = {};
      snap.docs.forEach(band => {
        for (const uid in band.data().users) {
          if (!(uid in users)) {
            users[uid] = { display_name: "?", bands: {} };
          }
          users[uid].display_name = band.data().users[uid].display_name;
          users[uid].bands[band.id] = {
            display_name: band.data().display_name
          };

          const memberDoc = band.ref.collection("members").doc(uid);
          promises.push(migrateMember(memberDoc, band.data().users[uid]));
        }
      });
      functions.logger.info("Users to migrate", users);
      Object.entries(users).forEach((elt: any[]) => {
        promises.push(migrateUser(elt[0], elt[1]));
      });

      await Promise.all(promises);
      resp.sendStatus(200);
    })
    .catch(reason => {
      functions.logger.error(reason);
      resp.sendStatus(500);
    });
});
