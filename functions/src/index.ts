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
  const bandSnapshot = await bandRef.get();
  let bandName = bandSnapshot.data()?.display_name;
  if (!bandName) {
    logger.warn("Missing 'display_name' in", bandRef.path);
    bandName = "??";
  }
  // Update  band information.
  const memberData = {
    display_name: joinRequestSnapshot.data().display_name,
    admin: !!options.makeAdmin
  };
  logger.info("Updating", memberDocRef.path, "to", memberData);
  await Promise.all([
    memberDocRef.set(memberData),
    joinRequestSnapshot.ref.delete()
  ]);
  logger.info("Done");
  return "OK";
}

async function calculateNotifications(bandid: string) {
  const logger = createLogger({ bandid });
  const notifications = {
    new_event: [] as string[]
  };
  const admin_notifications = {
    new_join_request: [] as string[],
    new_member: [] as string[]
  };
  const bandRef = db.collection("bands").doc(bandid);
  const members = await bandRef.collection("members").get();
  for (const doc of members.docs) {
    const member = doc.data();
    logger.info(
      "Checking member:",
      member.display_name,
      member.admin ? "(admin)" : "(non-admin)"
    );
    const settingsDoc = await doc.ref
      .collection("private")
      .doc("settings")
      .get();
    if (!settingsDoc.exists) {
      continue;
    }
    const settings = settingsDoc.data()!;
    if (!settings.email) {
      continue;
    }
    logger.info("Email:", settings.email);
    for (const [k, emails] of Object.entries(notifications)) {
      if (settings.notify[k]) {
        emails.push(settings.email);
      }
    }
    if (member.admin) {
      for (const [k, emails] of Object.entries(admin_notifications)) {
        if (settings.notify[k]) {
          emails.push(settings.email);
        }
      }
    }
  }
  logger.info("Notifications:", notifications);
  logger.info("Admin notifications:", admin_notifications);
  Object.assign(notifications, admin_notifications);
  await bandRef
    .collection("admin")
    .doc("notify")
    .set(notifications);
}

type MailMessage = {
  subject: string;
  text: string;
  messageId?: string;
  headers?: { [hdr: string]: string };
};

async function notify(
  bandid: string,
  notificationType: string,
  message: MailMessage,
  extraKey: string = "", // like a uid
  followUp: boolean = false
) {
  const notifyDoc = await db
    .collection("bands")
    .doc(bandid)
    .collection("admin")
    .doc("notify")
    .get();
  if (!notifyDoc.exists) {
    return;
  }
  const addresses = notifyDoc.data()![notificationType];
  functions.logger.info("Notify", bandid, notificationType, addresses);
  const envelope: any = {
    to: addresses,
    message: message
  };
  if (!message.messageId) {
    const baseMessageId = `<${notificationType}-${extraKey}@${bandid}>`;
    if (followUp) {
      message.messageId = `<${notificationType}-${extraKey}-${Date.now()}@${bandid}>`;
      envelope.headers = {
        "In-Reply-To": baseMessageId,
        References: baseMessageId
      };
    } else {
      message.messageId = baseMessageId;
    }
  }
  db.collection("mail").add(envelope);
}

///

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
      notify(
        bandId,
        "new_join_request",
        {
          subject: `Någon vill gå med i ${band.display_name}`,
          text: `Begäran om om att få bli medlem i ${
            band.display_name
          } via ${snapshot.get("url") || "??"}:

  ${user.displayName ? user.displayName : " "} <${user.email}>
`
        },
        uid
      );
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
      const band = await getBand(bandId);
      const authUser = await admin.auth().getUser(uid);

      // Update /users/{uid} field "bands".
      const userDocRef = db.collection("users").doc(uid);
      const userData = (await userDocRef.get()).data()!;
      if (userData.bands === undefined) {
        logger.warn("Missing 'bands' field in", userDocRef.path);
        userData.bands = {};
      }
      userData.bands[bandId] = { display_name: band.display_name };
      logger.info("Updating", userDocRef.path, "to", userData);
      await userDocRef.set(userData);

      // Create default settings.
      const settingsRef = snapshot.ref.collection("private").doc("settings");
      await settingsRef.set({
        email: authUser.email,
        notify: {
          new_event: true,
          new_join_request: true,
          new_member: true
        }
      });

      // Notify admins.
      const admins = await getBandAdmins(bandId);
      await db.collection("mail").add({
        to: admins.docs.map(snap => snap.data().email),
        message: {
          messageId: uid + "-join",
          subject: `Ny medlem i ${band.display_name}`,
          text: `Ny medlem i ${band.display_name}:

  ${snapshot.get("display_name")}

Inloggad som:

  ${authUser.displayName ? authUser.displayName : " "} <${authUser.email}>
`
        }
      });
    }
  );

export const joinRequestUpdated = functions.firestore
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

export const settingsChanged = functions.firestore
  .document("bands/{bandid}/members/{uid}/private/settings")
  .onWrite(async (snapshot, context) => {
    const bandid = context.params.bandid;
    const uid = context.params.uid;
    const logger = createLogger({ bandid, uid });
    logger.info("Settings changed");
    // TODO: Only update for this user once we're in a steady state.
    await calculateNotifications(bandid);
  });

type BandEvent = {
  type: string;
  start: string;
  stop?: string;
  location?: string;
  description?: string;
  cancelled?: boolean;
};

function formatEventInfo(event: BandEvent): string {
  if (event.cancelled) {
    return `${event.type}
Inställt`;
  }
  return `${event.type}
${event.description}
${event.location || "-"}
${event.start}`;
}

export const eventCreated = functions.firestore
  .document("bands/{bandid}/events/{eventid}")
  .onCreate(async (snapshot, context) => {
    const bandid = context.params.bandid;
    const eventid = context.params.eventid;
    const event = snapshot.data() as BandEvent;
    const band = await getBand(bandid);
    notify(
      bandid,
      "new_event",
      {
        subject: `Ny planerad händelse: ${event.type}`,
        text: `En ny händelse har lagts till i kalendariet för ${
          band.display_name
        }.

${formatEventInfo(event)}`
      },
      eventid
    );
  });

export const eventUpdated = functions.firestore
  .document("bands/{bandid}/events/{eventid}")
  .onUpdate(async (snapshot, context) => {
    const bandid = context.params.bandid;
    const eventid = context.params.eventid;
    const event = snapshot.after.data() as BandEvent;
    notify(
      bandid,
      "new_event",
      {
        subject: `Ny planerad händelse: ${event.type}`,
        text: `Händelsen har ändrats.

${formatEventInfo(event)}`
      },
      eventid,
      true
    );
  });

// export const scheduled = functions.pubsub
//   .schedule("0,10,20,30,40 * * * *")
//   .timeZone("Europe/Stockholm")
//   .onRun(context => {
//     functions.logger.info("Scheduled run");
//   });
