import * as express from "express";
import * as cors from "cors";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { Band, BandEvent, MemberCalendar } from "./types";
import {
  CalendarEventInput,
  CalendarParticipant,
  decodeCalendarToken,
  generateIcalFeed,
  secretsMatch,
  sixMonthsAgoIsoDate,
} from "./ical";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const getDb = () => getFirestore();

// Middleware to authenticate via Firebase Auth or Custom API Tokens
const requireAuth = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ error: "Unauthorized: Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.split("Bearer ")[1].trim();

  let uid: string;
  let isReadOnly = false;

  try {
    if (token.startsWith("at_")) {
      // Custom API token format: at_{UID}_{RANDOM}
      const parts = token.split("_");
      if (parts.length >= 3) {
        uid = parts[1];
        // Verify token in Firestore
        const apiKeyDoc = await getDb()
          .collection("users")
          .doc(uid)
          .collection("apikeys")
          .doc(token)
          .get();
        if (!apiKeyDoc.exists) {
          res
            .status(401)
            .json({ error: "Unauthorized: Invalid custom API token" });
          return;
        }

        const keyData = apiKeyDoc.data();
        if (keyData?.readonly) {
          isReadOnly = true;
        }
      } else {
        res
          .status(401)
          .json({ error: "Unauthorized: Invalid custom API token format" });
        return;
      }
    } else {
      // Standard Firebase Auth ID token
      const decodedToken = await getAuth().verifyIdToken(token);
      uid = decodedToken.uid;
    }

    // If the key is readonly, block non-GET requests
    if (isReadOnly && req.method !== "GET") {
      res.status(403).json({ error: "Forbidden: This API key is read-only" });
      return;
    }

    // Add uid to request for potential use in routes
    (req as any).uid = uid;

    next();
  } catch (error) {
    console.error("Error during authentication:", error);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

const requireBandMember = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const bandId = (req.params as any).bandId;
  const uid = (req as any).uid;

  try {
    // Check if user is a member of the band to mirror frontend rules
    const memberDoc = await getDb()
      .collection("bands")
      .doc(bandId)
      .collection("members")
      .doc(uid)
      .get();
    if (!memberDoc.exists) {
      res
        .status(403)
        .json({ error: "Forbidden: User is not a member of this band" });
      return;
    }

    next();
  } catch (error) {
    console.error("Error during authorization:", error);
    res.status(500).json({ error: "Failed to verify band membership" });
  }
};

const bandRouter = express.Router({ mergeParams: true });
bandRouter.use(requireAuth);
bandRouter.use(requireBandMember);

// Get user's bands
app.get("/users/me/bands", requireAuth, async (req, res) => {
  try {
    const uid = (req as any).uid;
    const userDoc = await getDb().collection("users").doc(uid).get();
    if (!userDoc.exists) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const userData = userDoc.data();
    res.json(userData?.bands || {});
  } catch (error) {
    console.error("Error fetching user bands:", error);
    res.status(500).json({ error: "Failed to fetch user bands" });
  }
});

// Get all events for a band
bandRouter.get("/events", async (req, res) => {
  try {
    const eventsSnapshot = await getDb()
      .collection("bands")
      .doc((req.params as any).bandId)
      .collection("events")
      .get();
    const events: Record<string, BandEvent> = {};
    eventsSnapshot.forEach((doc) => {
      events[doc.id] = doc.data() as BandEvent;
    });
    res.json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// Get a single event
bandRouter.get("/events/:eventId", async (req, res) => {
  try {
    const doc = await getDb()
      .collection("bands")
      .doc((req.params as any).bandId)
      .collection("events")
      .doc((req.params as any).eventId)
      .get();
    if (!doc.exists) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

// Create a new event
bandRouter.post("/events", async (req, res) => {
  try {
    const eventData = req.body as BandEvent;
    // Basic validation
    if (!eventData.type || !eventData.start) {
      res
        .status(400)
        .json({ error: "Missing required fields: type and start" });
      return;
    }

    const docRef = await getDb()
      .collection("bands")
      .doc((req.params as any).bandId)
      .collection("events")
      .add(eventData);
    res.status(201).json({ id: docRef.id, ...eventData });
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ error: "Failed to create event" });
  }
});

// Update an event
bandRouter.put("/events/:eventId", async (req, res) => {
  try {
    const eventData = req.body;
    const docRef = getDb()
      .collection("bands")
      .doc((req.params as any).bandId)
      .collection("events")
      .doc((req.params as any).eventId);

    // We can use { merge: true } or just update. For REST PUT, it's typically a full replace,
    // but update is safer to not delete subcollections. Let's use set with merge.
    await docRef.set(eventData, { merge: true });

    const updatedDoc = await docRef.get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ error: "Failed to update event" });
  }
});

// Delete an event
bandRouter.delete("/events/:eventId", async (req, res) => {
  try {
    await getDb()
      .collection("bands")
      .doc((req.params as any).bandId)
      .collection("events")
      .doc((req.params as any).eventId)
      .delete();
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

app.use("/bands/:bandId", bandRouter);

function parseValidatedHost(
  rawHeader: string
): { host: string; hostname: string } | null {
  const trimmed = rawHeader.trim();
  if (!trimmed || trimmed.length > 260) {
    return null;
  }
  // IPv6 literal, e.g. [::1] or [::1]:5002
  const ipv6Match = /^(\[[0-9a-fA-F:]+\])(?::(\d{1,5}))?$/.exec(trimmed);
  if (ipv6Match) {
    return { host: trimmed, hostname: ipv6Match[1].toLowerCase() };
  }
  const hostMatch = /^([a-zA-Z0-9._-]+)(?::(\d{1,5}))?$/.exec(trimmed);
  if (
    !hostMatch ||
    hostMatch[1] === "." ||
    hostMatch[1] === ".." ||
    hostMatch[1].length > 253
  ) {
    return null;
  }
  return {
    host: `${hostMatch[1].toLowerCase()}${
      hostMatch[2] ? `:${hostMatch[2]}` : ""
    }`,
    hostname: hostMatch[1].toLowerCase(),
  };
}

function resolveHttpProtocol(
  req: express.Request,
  hostname: string
): "http" | "https" {
  const forwarded = (req.headers["x-forwarded-proto"] as string | undefined)
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  if (forwarded === "https" || forwarded === "http") {
    return forwarded;
  }
  const proto = req.protocol?.toLowerCase();
  if (proto === "https" || proto === "http") {
    return proto;
  }
  return hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
    ? "http"
    : "https";
}

const handleCalendarFeed = async (
  req: express.Request,
  res: express.Response
) => {
  const tokenFile = (req.params as any).tokenFile || "";
  if (!tokenFile.endsWith(".ics")) {
    res.status(404).send("Not found");
    return;
  }

  const decoded = decodeCalendarToken(tokenFile);
  if (!decoded) {
    res.status(401).send("Unauthorized: Invalid calendar token");
    return;
  }

  const { bandId, uid, secret } = decoded;

  try {
    const db = getDb();
    const bandRef = db.collection("bands").doc(bandId);
    const memberRef = bandRef.collection("members").doc(uid);
    const calendarRef = memberRef.collection("private").doc("calendar");

    const rawHostHeader =
      (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0] ||
      req.headers.host ||
      "";
    const parsedHost = parseValidatedHost(rawHostHeader);
    const canLookupHostDoc =
      parsedHost !== null && !parsedHost.hostname.startsWith("[");
    const refs = canLookupHostDoc
      ? [
          bandRef,
          memberRef,
          calendarRef,
          db.collection("hosts").doc(parsedHost.hostname),
        ]
      : [bandRef, memberRef, calendarRef];

    const snapshots = await db.getAll(...refs);
    const [bandSnap, memberSnap, calendarSnap, hostSnap] = snapshots;

    const rawStoredSecret = calendarSnap.exists
      ? (calendarSnap.data() as Partial<MemberCalendar> | undefined)?.secret
      : undefined;
    const storedSecret =
      typeof rawStoredSecret === "string" ? rawStoredSecret : undefined;
    if (!storedSecret || !secretsMatch(storedSecret, secret)) {
      res.status(401).send("Unauthorized: Invalid or revoked calendar token");
      return;
    }

    if (!memberSnap.exists || !bandSnap.exists) {
      res.status(403).send("Forbidden: User is not a member of this band");
      return;
    }

    const bandData = bandSnap.data() as Band;
    const cutoffDate = sixMonthsAgoIsoDate();

    const eventsSnapshot = await bandRef
      .collection("events")
      .where("start", ">=", cutoffDate)
      .orderBy("start")
      .get();

    const activeEventDocs = eventsSnapshot.docs.filter(
      (doc) => !(doc.data() as BandEvent).cancelled
    );

    const participantByEventId = new Map<string, CalendarParticipant>();
    if (activeEventDocs.length > 0) {
      const participantRefs = activeEventDocs.map((doc) =>
        doc.ref.collection("participants").doc(uid)
      );
      const participantSnaps = await db.getAll(...participantRefs);
      activeEventDocs.forEach((doc, idx) => {
        const snap = participantSnaps[idx];
        if (snap.exists) {
          participantByEventId.set(doc.id, snap.data() as CalendarParticipant);
        }
      });
    }

    const events: CalendarEventInput[] = activeEventDocs.map((doc) => ({
      id: doc.id,
      event: doc.data() as BandEvent,
      participant: participantByEventId.get(doc.id),
    }));

    let bandUrl: string | undefined;
    if (
      parsedHost &&
      !parsedHost.hostname.endsWith(".cloudfunctions.net") &&
      !parsedHost.hostname.endsWith(".run.app")
    ) {
      const proto = resolveHttpProtocol(req, parsedHost.hostname);
      const isDefaultHostBand =
        hostSnap?.exists && hostSnap.data()?.band === bandId;
      bandUrl = isDefaultHostBand
        ? `${proto}://${parsedHost.host}/`
        : `${proto}://${parsedHost.host}/${encodeURIComponent(bandId)}`;
    }

    const icsBody = generateIcalFeed({
      bandId,
      band: bandData,
      events,
      bandUrl,
    });

    const safeFilename = bandId.replace(/[^a-zA-Z0-9_-]/g, "_") || "calendar";
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${safeFilename}.ics"`
    );
    res.setHeader("Cache-Control", "private, no-cache");
    res.status(200).send(icsBody);
  } catch (error) {
    console.error("Error generating calendar feed:", error);
    res.status(500).send("Failed to generate calendar feed");
  }
};

app.get("/_/calendar/:tokenFile", handleCalendarFeed);

export { app as expressApp };
