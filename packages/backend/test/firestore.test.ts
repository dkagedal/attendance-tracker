import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

const PROJECT_ID = "demo-kommer";
const [host, portStr] = (
  process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080"
).split(":");
const port = parseInt(portStr, 10);
process.env.FIRESTORE_EMULATOR_HOST = `${host}:${port}`;

let testEnv: RulesTestEnvironment;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host,
      port,
      // Rules are loaded by the emulator from firebase.json/firestore.rules
      // If running without emulator wrapper, we would need:
      // rules: fs.readFileSync("../../firestore.rules", "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

after(async () => {
  await testEnv.cleanup();
});

describe("Access rules", () => {
  describe("User documents", () => {
    it("can be created by the user", async () => {
      const context = testEnv.authenticatedContext("user1");
      const db = context.firestore();
      const doc = db.doc("users/user1");
      await assertSucceeds(doc.set({}));
    });

    it("can't be created by another user", async () => {
      const context = testEnv.authenticatedContext("user1");
      const db = context.firestore();
      const doc = db.doc("users/user2");
      await assertFails(doc.set({}));
    });

    it("can't be created by an unauthenticated user", async () => {
      const context = testEnv.unauthenticatedContext();
      const db = context.firestore();
      const doc = db.doc("users/user1");
      await assertFails(doc.set({}));
    });

    it("can be update by the user if they don't change anything", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc("users/user1").set({ display_name: "User One" });
      });

      const context = testEnv.authenticatedContext("user1");
      const db = context.firestore();
      const doc = db.doc("users/user1");
      await assertSucceeds(doc.set({}, { merge: true }));
    });

    it("can't be update by the user if they change anything", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc("users/user1").set({ display_name: "User One" });
      });

      const context = testEnv.authenticatedContext("user1");
      const db = context.firestore();
      const doc = db.doc("users/user1");
      await assertFails(doc.set({ admin: true }, { merge: true }));
    });
  });

  describe("Host mappings", () => {
    it("can be read by everyone", async () => {
      const context = testEnv.unauthenticatedContext();
      const db = context.firestore();
      const doc = db.collection("hosts").doc("beatles.com");
      await assertSucceeds(doc.get());
    });

    it("can't be written", async () => {
      const context = testEnv.unauthenticatedContext();
      const db = context.firestore();
      const doc = db.collection("hosts").doc("beatles.com");
      await assertFails(doc.set({ foo: 17 }));
    });
  });

  describe("Band documents", () => {
    it("can be read by unauthenticated users", async () => {
      const anon = testEnv.unauthenticatedContext();
      const db = anon.firestore();
      const doc = db.collection("bands").doc("beatles");
      await assertSucceeds(doc.get());
    });

    it("can't be queried by unauthenticated users", async () => {
      const anon = testEnv.unauthenticatedContext();
      const db = anon.firestore();
      const query = db.collection("bands");
      await assertFails(query.get());
    });

    it("can be read by ACL'd users", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db
          .collection("bands")
          .doc("beatles")
          .set({ acl: ["user1"] });
      });

      const user1 = testEnv.authenticatedContext("user1");
      const db = user1.firestore();
      const doc = db.collection("bands").doc("beatles");
      await assertSucceeds(doc.get());
    });

    it("can't be queried by by ACL'd users", async () => {
      const user1 = testEnv.authenticatedContext("user1");
      const db = user1.firestore();
      const query = db
        .collection("bands")
        .where("acl", "array-contains", "user1");
      await assertFails(query.get());
    });

    it("can't be written by unauthenticated users", async () => {
      const anon = testEnv.unauthenticatedContext();
      const db = anon.firestore();
      const doc = db.collection("bands").doc("beatles");
      await assertFails(doc.set({ foo: "bar" }));
    });

    it("can't be written by authenticated users", async () => {
      const user1 = testEnv.authenticatedContext("user1");
      const db = user1.firestore();
      const doc = db.collection("bands").doc("beatles");
      await assertFails(doc.set({ foo: "bar" }));
    });
  });

  describe("Memberships", () => {
    it("can be listed by members", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.doc("users/ringo").set({ bands: { beatles: {} } });
        await db.doc("bands/beatles").set({ display_name: "The Beatles" });
        await db
          .doc("bands/beatles/members/ringo")
          .set({ displan_name: "Ringo" });
      });

      const ringo = testEnv.authenticatedContext("ringo");
      const query = ringo.firestore().collection("bands/beatles/members");
      await assertSucceeds(query.get());
    });

    it("can't be listed by non-members", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db
          .collection("users")
          .doc("ringo")
          .set({ bands: { beatles: {} } });
        await db
          .collection("bands")
          .doc("beatles")
          .set({ display_name: "The Beatles" });
      });

      const ringo = testEnv.authenticatedContext("ringo");
      const query = ringo
        .firestore()
        .collection("bands")
        .doc("beatles")
        .collection("members");
      await assertFails(query.get());
    });

    it("members can get other members", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db
          .collection("users")
          .doc("ringo")
          .set({ bands: { beatles: {} } });
        await db
          .collection("bands")
          .doc("beatles")
          .set({ display_name: "The Beatles" });
        await db
          .collection("bands")
          .doc("beatles")
          .collection("members")
          .doc("ringo")
          .set({});
        await db
          .collection("bands")
          .doc("beatles")
          .collection("members")
          .doc("paul")
          .set({});
      });

      const ringo = testEnv.authenticatedContext("ringo");
      const doc = ringo
        .firestore()
        .collection("bands")
        .doc("beatles")
        .collection("members")
        .doc("paul");
      await assertSucceeds(doc.get());
    });

    it("non-members can't get other members", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db
          .collection("users")
          .doc("ringo")
          .set({ bands: { beatles: {} } });
        await db
          .collection("bands")
          .doc("beatles")
          .set({ display_name: "The Beatles" });
        await db
          .collection("bands")
          .doc("beatles")
          .collection("members")
          .doc("paul")
          .set({});
      });

      const ringo = testEnv.authenticatedContext("ringo");
      const doc = ringo
        .firestore()
        .collection("bands")
        .doc("beatles")
        .collection("members")
        .doc("paul");
      await assertFails(doc.get());
    });

    it("can't be self-added", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db
          .collection("users")
          .doc("ringo")
          .set({ bands: { beatles: {} } });
        await db
          .collection("bands")
          .doc("beatles")
          .set({ display_name: "The Beatles" });
      });

      const ringo = testEnv.authenticatedContext("ringo");
      const query = ringo
        .firestore()
        .collection("bands")
        .doc("beatles")
        .collection("members")
        .doc("ringo");
      await assertFails(query.set({}));
    });

    describe("Private calendar", () => {
      const CALENDAR_PATH = "bands/beatles/members/ringo/private/calendar";
      const VALID_SECRET = "0123456789abcdef0123456789abcdef";
      const ROTATED_SECRET = "fedcba9876543210fedcba9876543210";

      async function seedBandAndMembers() {
        await testEnv.withSecurityRulesDisabled(async (context) => {
          const db = context.firestore();
          await db.doc("users/ringo").set({ bands: { beatles: {} } });
          await db.doc("users/paul").set({ bands: { beatles: {} } });
          await db.doc("users/george").set({ bands: { beatles: {} } });
          await db.doc("bands/beatles").set({ display_name: "The Beatles" });
          const ringoMember = db.doc("bands/beatles/members/ringo");
          await ringoMember.set({ display_name: "Ringo", admin: false });
          const paulMember = db.doc("bands/beatles/members/paul");
          await paulMember.set({ display_name: "Paul", admin: true });
          const georgeMember = db.doc("bands/beatles/members/george");
          await georgeMember.set({ display_name: "George", admin: false });
        });
      }

      async function seedCalendarDoc() {
        await testEnv.withSecurityRulesDisabled(async (context) => {
          const doc = context.firestore().doc(CALENDAR_PATH);
          await doc.set({
            secret: VALID_SECRET,
            createdAt: new Date("2026-01-01T00:00:00Z"),
          });
        });
      }

      it("can be read by the member themselves", async () => {
        await seedBandAndMembers();

        const ringo = testEnv.authenticatedContext("ringo");
        const doc = ringo.firestore().doc(CALENDAR_PATH);
        await assertSucceeds(doc.get());

        await seedCalendarDoc();
        await assertSucceeds(doc.get());
      });

      it("can be created by the member themselves", async () => {
        await seedBandAndMembers();

        const ringo = testEnv.authenticatedContext("ringo");
        const doc = ringo.firestore().doc(CALENDAR_PATH);
        const payload = { secret: VALID_SECRET, createdAt: new Date() };
        await assertSucceeds(doc.set(payload));
      });

      it("can be updated by the member themselves", async () => {
        await seedBandAndMembers();
        await seedCalendarDoc();

        const ringo = testEnv.authenticatedContext("ringo");
        const doc = ringo.firestore().doc(CALENDAR_PATH);
        const rotated = { secret: ROTATED_SECRET, createdAt: new Date() };
        await assertSucceeds(doc.set(rotated));
        await assertSucceeds(doc.update({ secret: VALID_SECRET }));
      });

      it("can be deleted by the member themselves", async () => {
        await seedBandAndMembers();
        await seedCalendarDoc();

        const ringo = testEnv.authenticatedContext("ringo");
        const doc = ringo.firestore().doc(CALENDAR_PATH);
        await assertSucceeds(doc.delete());
      });

      it("is denied for other band members including admins", async () => {
        await seedBandAndMembers();

        const paulAdmin = testEnv.authenticatedContext("paul");
        const paulDoc = paulAdmin.firestore().doc(CALENDAR_PATH);
        const georgeMember = testEnv.authenticatedContext("george");
        const georgeDoc = georgeMember.firestore().doc(CALENDAR_PATH);
        const payload = { secret: VALID_SECRET, createdAt: new Date() };

        await assertFails(paulDoc.set(payload));
        await assertFails(georgeDoc.set(payload));

        await seedCalendarDoc();

        await assertFails(paulDoc.get());
        await assertFails(georgeDoc.get());
        const rotated = { secret: ROTATED_SECRET, createdAt: new Date() };
        await assertFails(paulDoc.set(rotated));
        await assertFails(georgeDoc.set(rotated));
        await assertFails(paulDoc.delete());
        await assertFails(georgeDoc.delete());
      });

      it("is denied for non-members even with matching uid", async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
          const db = context.firestore();
          await db.doc("users/ringo").set({ bands: { beatles: {} } });
          await db.doc("bands/beatles").set({ display_name: "The Beatles" });
        });

        const ringo = testEnv.authenticatedContext("ringo");
        const doc = ringo.firestore().doc(CALENDAR_PATH);
        const payload = { secret: VALID_SECRET, createdAt: new Date() };

        await assertFails(doc.get());
        await assertFails(doc.set(payload));

        // Even if an orphaned calendar doc exists, read/update/delete fail
        await seedCalendarDoc();
        await assertFails(doc.get());
        const rotated = { secret: ROTATED_SECRET, createdAt: new Date() };
        await assertFails(doc.set(rotated));
        await assertFails(doc.delete());
      });

      it("is denied for unauthenticated users", async () => {
        await seedBandAndMembers();

        const anon = testEnv.unauthenticatedContext();
        const doc = anon.firestore().doc(CALENDAR_PATH);
        const payload = { secret: VALID_SECRET, createdAt: new Date() };

        await assertFails(doc.get());
        await assertFails(doc.set(payload));

        await seedCalendarDoc();

        await assertFails(doc.get());
        const rotated = { secret: ROTATED_SECRET, createdAt: new Date() };
        await assertFails(doc.set(rotated));
        await assertFails(doc.delete());
      });

      it("enforces secret length boundaries (16..256)", async () => {
        await seedBandAndMembers();

        const ringo = testEnv.authenticatedContext("ringo");
        const doc = ringo.firestore().doc(CALENDAR_PATH);
        const now = new Date();

        const tooShort = { secret: "a".repeat(15), createdAt: now };
        const minValid = { secret: "a".repeat(16), createdAt: now };
        const maxValid = { secret: "a".repeat(256), createdAt: now };
        const tooLong = { secret: "a".repeat(257), createdAt: now };

        await assertFails(doc.set(tooShort));
        await assertSucceeds(doc.set(minValid));
        await assertSucceeds(doc.set(maxValid));
        await assertFails(doc.set(tooLong));
      });

      it("rejects invalid schema on create and update", async () => {
        await seedBandAndMembers();

        const ringo = testEnv.authenticatedContext("ringo");
        const doc = ringo.firestore().doc(CALENDAR_PATH);
        const now = new Date();

        await assertFails(doc.set({}));
        await assertFails(doc.set({ secret: VALID_SECRET }));
        await assertFails(doc.set({ createdAt: now }));
        const withExtra = {
          secret: VALID_SECRET,
          createdAt: now,
          extra: true,
        };
        await assertFails(doc.set(withExtra));
        const numericSecret = { secret: 1234567890123456, createdAt: now };
        await assertFails(doc.set(numericSecret));
        const stringDate = {
          secret: VALID_SECRET,
          createdAt: "2026-01-01T00:00:00Z",
        };
        await assertFails(doc.set(stringDate));
        await assertFails(doc.set({ secret: VALID_SECRET, createdAt: 12345 }));

        await seedCalendarDoc();
        await assertFails(doc.update({ secret: "too-short" }));
        await assertFails(doc.update({ secret: "a".repeat(257) }));
        await assertFails(doc.update({ secret: 1234567890123456 }));
        await assertFails(doc.update({ createdAt: "2026-01-01T00:00:00Z" }));
        await assertFails(doc.update({ extra: "disallowed" }));
        await assertFails(doc.set({ secret: VALID_SECRET }));
      });
    });
  });

  describe("Join Requests", () => {
    it("request members can get their own request", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db
          .collection("users")
          .doc("ringo")
          .set({ bands: { beatles: {} } });
        await db
          .collection("bands")
          .doc("beatles")
          .set({ display_name: "The Beatles" });
        await db
          .collection("bands")
          .doc("beatles")
          .collection("join_requests")
          .doc("ringo")
          .set({ status: "request" });
      });

      const ringo = testEnv.authenticatedContext("ringo");
      const doc = ringo
        .firestore()
        .collection("bands")
        .doc("beatles")
        .collection("join_requests")
        .doc("ringo");
      await assertSucceeds(doc.get());
    });

    it("can be self-added", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db
          .collection("users")
          .doc("ringo")
          .set({ bands: { beatles: {} } });
        await db
          .collection("bands")
          .doc("beatles")
          .set({ display_name: "The Beatles" });
      });

      const ringo = testEnv.authenticatedContext("ringo");
      const query = ringo
        .firestore()
        .collection("bands")
        .doc("beatles")
        .collection("join_requests")
        .doc("ringo");
      await assertSucceeds(query.set({ approved: false }));
    });

    it("can't be pre-approved", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db
          .collection("users")
          .doc("ringo")
          .set({ bands: { beatles: {} } });
        await db
          .collection("bands")
          .doc("beatles")
          .set({ display_name: "The Beatles" });
      });

      const ringo = testEnv.authenticatedContext("ringo");
      const query = ringo
        .firestore()
        .collection("bands")
        .doc("beatles")
        .collection("join_requests")
        .doc("ringo");
      await assertFails(query.set({ approved: true }));
    });

    it("requires the user to exist", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db
          .collection("bands")
          .doc("beatles")
          .set({ display_name: "The Beatles" });
      });

      const ringo = testEnv.authenticatedContext("ringo");
      const query = ringo
        .firestore()
        .collection("bands")
        .doc("beatles")
        .collection("join_requests")
        .doc("ringo");
      await assertFails(query.set({}));
    });
  });

  describe("Events", () => {
    const EVENT = {
      type: "Gig",
      location: "Cavern Club",
      description: "Yeah Yeah Yeah",
      start: "2020-09-19T22:00",
      stop: "2020-09-20T04:00",
    };

    it("can be listed by active members", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db
          .collection("users")
          .doc("ringo")
          .set({ bands: { beatles: {} } });
        await db
          .collection("bands")
          .doc("beatles")
          .set({ display_name: "The Beatles" });
        await db
          .collection("bands")
          .doc("beatles")
          .collection("members")
          .doc("ringo")
          .set({ status: "active" });
      });

      const ringo = testEnv.authenticatedContext("ringo");
      const query = ringo
        .firestore()
        .collection("bands")
        .doc("beatles")
        .collection("events");
      await assertSucceeds(query.get());
    });

    it("can't be listed by non-members", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db
          .collection("users")
          .doc("ringo")
          .set({ bands: { beatles: {} } });
        await db
          .collection("bands")
          .doc("beatles")
          .set({ display_name: "The Beatles" });
      });

      const ringo = testEnv.authenticatedContext("ringo");
      const query = ringo
        .firestore()
        .collection("bands")
        .doc("beatles")
        .collection("events");
      await assertFails(query.get());
    });

    it("can be added by members", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db
          .collection("users")
          .doc("ringo")
          .set({ bands: { beatles: {} } });
        await db
          .collection("bands")
          .doc("beatles")
          .set({ display_name: "The Beatles" });
        await db
          .collection("bands")
          .doc("beatles")
          .collection("members")
          .doc("ringo")
          .set({ status: "active" });
      });

      const ringo = testEnv.authenticatedContext("ringo");
      const events = ringo
        .firestore()
        .collection("bands")
        .doc("beatles")
        .collection("events");
      await assertSucceeds(events.add(EVENT));
    });

    it("can be updated by members", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db
          .collection("users")
          .doc("ringo")
          .set({ bands: { beatles: {} } });
        await db
          .collection("bands")
          .doc("beatles")
          .set({ display_name: "The Beatles" });
        await db
          .collection("bands")
          .doc("beatles")
          .collection("members")
          .doc("ringo")
          .set({ status: "active" });
        await db
          .collection("bands")
          .doc("beatles")
          .collection("events")
          .doc("ev1")
          .set(EVENT);
      });

      const ringo = testEnv.authenticatedContext("ringo");
      const event = ringo
        .firestore()
        .collection("bands")
        .doc("beatles")
        .collection("events")
        .doc("ev1");
      const data = { ...EVENT }; // clone
      data.location = "Abbey Road Studios";
      await assertSucceeds(event.set(data));
    });

    describe("Participants", () => {
      it("can be listed by members", async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
          const db = context.firestore();
          await db
            .collection("users")
            .doc("ringo")
            .set({ bands: { beatles: {} } });
          await db
            .collection("bands")
            .doc("beatles")
            .set({ display_name: "The Beatles" });
          await db
            .collection("bands")
            .doc("beatles")
            .collection("members")
            .doc("ringo")
            .set({ status: "active" });
          await db
            .collection("bands")
            .doc("beatles")
            .collection("events")
            .doc("ev1")
            .set(EVENT);
        });

        const ringo = testEnv.authenticatedContext("ringo");
        const query = ringo
          .firestore()
          .collection("bands")
          .doc("beatles")
          .collection("events")
          .doc("ev1")
          .collection("participants");
        await assertSucceeds(query.get());
      });
    });
  });
});
