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
    },
    warn: (...args: any[]) => {
      functions.logger.warn(...args, context);
    }
  };
}

async function getBand(bandid: string) {
  const snapshot = await db
    .collection("bands")
    .doc(bandid)
    .get();
  return snapshot.data()!;
}

async function getUser(uid: string) {
  const snapshot = await db
    .collection("users")
    .doc(uid)
    .get();
  return snapshot.data()!;
}

export const joinRequestCreated = functions.firestore
  .document("bands/{bandId}/join_requests/{userId}")
  .onCreate(
    async (snapshot, context): Promise<void> => {
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
          text: `Begäran om om att få bli medlem i ${band.display_name
            } via ${snapshot.get("url") || "??"}.

Namn: ${user.display_name}
        `
        }
      });
    }
  );

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

export const userDeleted = functions.firestore
  .document("users/{uid}")
  .onDelete(async (snapshot, context) => {
    const uid = context.params.uid;
    const logger = createLogger({ uid });
    logger.info("User was deleted. Snapshot:", snapshot.data());
    const deleteDoc = (ref: admin.firestore.DocumentReference<admin.firestore.DocumentData>) => {
      ref.delete().then(
        () => {
          logger.info("Deleted", ref.path);
        },
        (error) => {
          logger.warn("Failed to delete", ref.path, ":", error);
        }
      );
    };
    const bands = await db.collection("bands").listDocuments();
    for (const bandRef of bands) {
      deleteDoc(bandRef.collection("members").doc(uid));
      deleteDoc(bandRef.collection("join_requests").doc(uid));
    }
  });
