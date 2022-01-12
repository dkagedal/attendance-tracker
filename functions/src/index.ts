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

async function getBandAdmins(bandid: string) {
  return await db
    .collection("bands")
    .doc(bandid)
    .collection("members")
    .where("admin", "==", true)
    .where("email", "!=", "")
    .get();
}

async function approve(
  joinRequestSnapshot: functions.firestore.QueryDocumentSnapshot,
  options: { makeAdmin?: boolean } = {}
) {
  const bandRef = joinRequestSnapshot.ref.parent.parent!;
  const uid = joinRequestSnapshot.id;
  const logger = createLogger({ bandId: bandRef.id, uid });
  const memberDocRef = bandRef.collection("members").doc(uid);
  const userDocRef = db.collection("users").doc(uid);
  const bandSnapshot = await bandRef.get();
  const userData = (await userDocRef.get()).data()!;
  if (userData.bands === undefined) {
    logger.warn("Missing 'bands' field in", userDocRef.path);
    userData.bands = {};
  }
  let bandName = bandSnapshot.data()?.display_name;
  if (!bandName) {
    logger.warn("Missing 'display_name' in", bandRef.path);
    bandName = "??";
  }
  // Update user and band information.
  userData.bands[bandRef.id] = { display_name: bandName };
  const memberData = {
    display_name: joinRequestSnapshot.data().display_name,
    admin: !!options.makeAdmin
  };
  logger.info("Updating", userDocRef.path, "to", userData);
  logger.info("Updating", memberDocRef.path, "to", memberData);
  await Promise.all([
    userDocRef.set(userData),
    memberDocRef.set(memberData),
    joinRequestSnapshot.ref.delete()
  ]);
  logger.info("Done");
  return "OK";
}

export const joinRequestCreated = functions.firestore
  .document("bands/{bandId}/join_requests/{uid}")
  .onCreate(
    async (snapshot, context): Promise<void> => {
      const bandId = context.params.bandId;
      const uid = context.params.uid;
      const logger = createLogger({ bandId, uid });
      logger.info("New join request");
      // If this is the first user to apply, auto-accept and make them admin.
      const members = await db
        .collection("bands")
        .doc(bandId)
        .collection("members")
        .get();
      if (members.docs.length == 0) {
        logger.info("Auto-accepting first member");
        await approve(snapshot, { makeAdmin: true });
        return;
      }
      // Otherwise, notify admins.
      const band = await getBand(bandId);
      const user = await admin.auth().getUser(uid);
      const admins = await getBandAdmins(bandId);
      db.collection("mail").add({
        to: admins.docs.map(snap => snap.data().email),
        message: {
          messageId: uid + "-joinreq",
          subject: `Någon vill gå med i ${band.display_name}`,
          text: `Begäran om om att få bli medlem i ${
            band.display_name
          } via ${snapshot.get("url") || "??"}:

  ${user.displayName ? user.displayName : " "} <${user.email}>
`
        }
      });
    }
  );

  export const memberCreated = functions.firestore
  .document("bands/{bandId}/members/{uid}")
  .onCreate(
    async (snapshot, context): Promise<void> => {
      const bandId = context.params.bandId;
      const uid = context.params.uid;
      const logger = createLogger({ bandId, uid });
      logger.info("New member");
      // Notify admins.
      const band = await getBand(bandId);
      const user = await admin.auth().getUser(uid);
      const admins = await getBandAdmins(bandId);
      db.collection("mail").add({
        to: admins.docs.map(snap => snap.data().email),
        message: {
          messageId: uid + "-join",
          subject: `Ny medlem i ${band.display_name}`,
          text: `Ny medlem i ${band.display_name}:

  ${snapshot.get("display_name")}

Inloggad som:

  ${user.displayName ? user.displayName : " "} <${user.email}>
`
        }
      });
    }
  );

export const approval = functions.firestore
  .document("bands/{bandId}/join_requests/{uid}")
  .onUpdate(
    async (change, context): Promise<string> => {
      const bandId = context.params.bandId;
      const uid = context.params.uid;
      const logger = createLogger({ bandId, uid });
      logger.info("Join request for", uid, "was updated");
      if (change.before.get("approved") || !change.after.get("approved")) {
        logger.info("Not approved, nothing to do");
        return "OK";
      }
      const joinRequest = change.after.data();
      logger.info("Approving join request for", uid, ":", joinRequest);
      const band = await getBand(bandId);
      const admins = await getBandAdmins(bandId);
      db.collection("mail").add({
        to: admins.docs.map(snap => snap.data().email),
        Headers: {
          "In-Reply-To": uid + "-joinreq"
        },
        message: {
          messageId: uid + "-approved",
          subject: `Någon vill gå med i ${band.display_name}`,
          text: `Insläppt.`
        }
      });
      return approve(change.after);
    }
  );

export const authUserCreated = functions.auth.user().onCreate(async user => {
  const logger = createLogger({ uid: user.uid });
  logger.info("New auth user");
  await db
    .collection("users")
    .doc(user.uid)
    .set({ bands: {} });
});

export const authUserDeleted = functions.auth.user().onDelete(async user => {
  const logger = createLogger({ uid: user.uid });
  logger.info("Deleted auth user");
  // This should trigger userDeleted below as well.
  await db
    .collection("users")
    .doc(user.uid)
    .delete();
});

export const userDeleted = functions.firestore
  .document("users/{uid}")
  .onDelete(async (snapshot, context) => {
    const uid = context.params.uid;
    const logger = createLogger({ uid });
    logger.info("User was deleted. Snapshot:", snapshot.data());
    const deleteDoc = (
      ref: admin.firestore.DocumentReference<admin.firestore.DocumentData>
    ) => {
      ref.delete().then(
        () => {
          logger.info("Deleted", ref.path);
        },
        error => {
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

export const scheduled = functions.pubsub
  .schedule("0,10,20,30,40 * * * *")
  .timeZone("Europe/Stockholm")
  .onRun(context => {
    functions.logger.info("Scheduled run");
  });
