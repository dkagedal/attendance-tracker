"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rules_unit_testing_1 = require("@firebase/rules-unit-testing");
const PROJECT_ID = "demo-kommer";
let testEnv;
before(async () => {
    testEnv = await (0, rules_unit_testing_1.initializeTestEnvironment)({
        projectId: PROJECT_ID,
        firestore: {
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
            await (0, rules_unit_testing_1.assertSucceeds)(doc.set({}));
        });
        it("can't be created by another user", async () => {
            const context = testEnv.authenticatedContext("user1");
            const db = context.firestore();
            const doc = db.doc("users/user2");
            await (0, rules_unit_testing_1.assertFails)(doc.set({}));
        });
        it("can't be created by an unauthenticated user", async () => {
            const context = testEnv.unauthenticatedContext();
            const db = context.firestore();
            const doc = db.doc("users/user1");
            await (0, rules_unit_testing_1.assertFails)(doc.set({}));
        });
        it("can be update by the user if they don't change anything", async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                await db.doc("users/user1").set({ display_name: "User One" });
            });
            const context = testEnv.authenticatedContext("user1");
            const db = context.firestore();
            const doc = db.doc("users/user1");
            await (0, rules_unit_testing_1.assertSucceeds)(doc.set({}, { merge: true }));
        });
        it("can't be update by the user if they change anything", async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                await db.doc("users/user1").set({ display_name: "User One" });
            });
            const context = testEnv.authenticatedContext("user1");
            const db = context.firestore();
            const doc = db.doc("users/user1");
            await (0, rules_unit_testing_1.assertFails)(doc.set({ admin: true }, { merge: true }));
        });
    });
    describe("Host mappings", () => {
        it("can be read by everyone", async () => {
            const context = testEnv.unauthenticatedContext();
            const db = context.firestore();
            const doc = db.collection("hosts").doc("beatles.com");
            await (0, rules_unit_testing_1.assertSucceeds)(doc.get());
        });
        it("can't be written", async () => {
            const context = testEnv.unauthenticatedContext();
            const db = context.firestore();
            const doc = db.collection("hosts").doc("beatles.com");
            await (0, rules_unit_testing_1.assertFails)(doc.set({ foo: 17 }));
        });
    });
    describe("Band documents", () => {
        it("can be read by unauthenticated users", async () => {
            const anon = testEnv.unauthenticatedContext();
            const db = anon.firestore();
            const doc = db.collection("bands").doc("beatles");
            await (0, rules_unit_testing_1.assertSucceeds)(doc.get());
        });
        it("can't be queried by unauthenticated users", async () => {
            const anon = testEnv.unauthenticatedContext();
            const db = anon.firestore();
            const query = db.collection("bands");
            await (0, rules_unit_testing_1.assertFails)(query.get());
        });
        it("can be read by ACL'd users", async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                await db.collection("bands").doc("beatles").set({ acl: ["user1"] });
            });
            const user1 = testEnv.authenticatedContext("user1");
            const db = user1.firestore();
            const doc = db.collection("bands").doc("beatles");
            await (0, rules_unit_testing_1.assertSucceeds)(doc.get());
        });
        it("can't be queried by by ACL'd users", async () => {
            const user1 = testEnv.authenticatedContext("user1");
            const db = user1.firestore();
            const query = db.collection("bands").where("acl", "array-contains", "user1");
            await (0, rules_unit_testing_1.assertFails)(query.get());
        });
        it("can't be written by unauthenticated users", async () => {
            const anon = testEnv.unauthenticatedContext();
            const db = anon.firestore();
            const doc = db.collection("bands").doc("beatles");
            await (0, rules_unit_testing_1.assertFails)(doc.set({ foo: "bar" }));
        });
        it("can't be written by authenticated users", async () => {
            const user1 = testEnv.authenticatedContext("user1");
            const db = user1.firestore();
            const doc = db.collection("bands").doc("beatles");
            await (0, rules_unit_testing_1.assertFails)(doc.set({ foo: "bar" }));
        });
    });
    describe("Memberships", () => {
        it("can be listed by members", async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                await db.doc("users/ringo").set({ bands: { beatles: {} } });
                await db.doc("bands/beatles").set({ display_name: "The Beatles" });
                await db.doc("bands/beatles/members/ringo").set({ displan_name: "Ringo" });
            });
            const ringo = testEnv.authenticatedContext("ringo");
            const query = ringo.firestore().collection("bands/beatles/members");
            await (0, rules_unit_testing_1.assertSucceeds)(query.get());
        });
        it("can't be listed by non-members", async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                await db.collection("users").doc("ringo").set({ bands: { beatles: {} } });
                await db.collection("bands").doc("beatles").set({ display_name: "The Beatles" });
            });
            const ringo = testEnv.authenticatedContext("ringo");
            const query = ringo.firestore().collection("bands").doc("beatles").collection("members");
            await (0, rules_unit_testing_1.assertFails)(query.get());
        });
        it("members can get other members", async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                await db.collection("users").doc("ringo").set({ bands: { beatles: {} } });
                await db.collection("bands").doc("beatles").set({ display_name: "The Beatles" });
                await db.collection("bands").doc("beatles").collection("members").doc("ringo").set({});
                await db.collection("bands").doc("beatles").collection("members").doc("paul").set({});
            });
            const ringo = testEnv.authenticatedContext("ringo");
            const doc = ringo.firestore().collection("bands").doc("beatles").collection("members").doc("paul");
            await (0, rules_unit_testing_1.assertSucceeds)(doc.get());
        });
        it("non-members can't get other members", async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                await db.collection("users").doc("ringo").set({ bands: { beatles: {} } });
                await db.collection("bands").doc("beatles").set({ display_name: "The Beatles" });
                await db.collection("bands").doc("beatles").collection("members").doc("paul").set({});
            });
            const ringo = testEnv.authenticatedContext("ringo");
            const doc = ringo.firestore().collection("bands").doc("beatles").collection("members").doc("paul");
            await (0, rules_unit_testing_1.assertFails)(doc.get());
        });
        it("can't be self-added", async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                await db.collection("users").doc("ringo").set({ bands: { beatles: {} } });
                await db.collection("bands").doc("beatles").set({ display_name: "The Beatles" });
            });
            const ringo = testEnv.authenticatedContext("ringo");
            const query = ringo.firestore().collection("bands").doc("beatles").collection("members").doc("ringo");
            await (0, rules_unit_testing_1.assertFails)(query.set({}));
        });
    });
    describe("Join Requests", () => {
        it("request members can get their own request", async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                await db.collection("users").doc("ringo").set({ bands: { beatles: {} } });
                await db.collection("bands").doc("beatles").set({ display_name: "The Beatles" });
                await db.collection("bands").doc("beatles").collection("join_requests").doc("ringo").set({ status: "request" });
            });
            const ringo = testEnv.authenticatedContext("ringo");
            const doc = ringo.firestore().collection("bands").doc("beatles").collection("join_requests").doc("ringo");
            await (0, rules_unit_testing_1.assertSucceeds)(doc.get());
        });
        it("can be self-added", async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                await db.collection("users").doc("ringo").set({ bands: { beatles: {} } });
                await db.collection("bands").doc("beatles").set({ display_name: "The Beatles" });
            });
            const ringo = testEnv.authenticatedContext("ringo");
            const query = ringo.firestore().collection("bands").doc("beatles").collection("join_requests").doc("ringo");
            await (0, rules_unit_testing_1.assertSucceeds)(query.set({ approved: false }));
        });
        it("can't be pre-approved", async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                await db.collection("users").doc("ringo").set({ bands: { beatles: {} } });
                await db.collection("bands").doc("beatles").set({ display_name: "The Beatles" });
            });
            const ringo = testEnv.authenticatedContext("ringo");
            const query = ringo.firestore().collection("bands").doc("beatles").collection("join_requests").doc("ringo");
            await (0, rules_unit_testing_1.assertFails)(query.set({ approved: true }));
        });
        it("requires the user to exist", async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                await db.collection("bands").doc("beatles").set({ display_name: "The Beatles" });
            });
            const ringo = testEnv.authenticatedContext("ringo");
            const query = ringo.firestore().collection("bands").doc("beatles").collection("join_requests").doc("ringo");
            await (0, rules_unit_testing_1.assertFails)(query.set({}));
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
                await db.collection("users").doc("ringo").set({ bands: { beatles: {} } });
                await db.collection("bands").doc("beatles").set({ display_name: "The Beatles" });
                await db.collection("bands").doc("beatles").collection("members").doc("ringo").set({ status: "active" });
            });
            const ringo = testEnv.authenticatedContext("ringo");
            const query = ringo.firestore().collection("bands").doc("beatles").collection("events");
            await (0, rules_unit_testing_1.assertSucceeds)(query.get());
        });
        it("can't be listed by non-members", async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                await db.collection("users").doc("ringo").set({ bands: { beatles: {} } });
                await db.collection("bands").doc("beatles").set({ display_name: "The Beatles" });
            });
            const ringo = testEnv.authenticatedContext("ringo");
            const query = ringo.firestore().collection("bands").doc("beatles").collection("events");
            await (0, rules_unit_testing_1.assertFails)(query.get());
        });
        it("can be added by members", async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                await db.collection("users").doc("ringo").set({ bands: { beatles: {} } });
                await db.collection("bands").doc("beatles").set({ display_name: "The Beatles" });
                await db.collection("bands").doc("beatles").collection("members").doc("ringo").set({ status: "active" });
            });
            const ringo = testEnv.authenticatedContext("ringo");
            const events = ringo.firestore().collection("bands").doc("beatles").collection("events");
            await (0, rules_unit_testing_1.assertSucceeds)(events.add(EVENT));
        });
        it("can be updated by members", async () => {
            await testEnv.withSecurityRulesDisabled(async (context) => {
                const db = context.firestore();
                await db.collection("users").doc("ringo").set({ bands: { beatles: {} } });
                await db.collection("bands").doc("beatles").set({ display_name: "The Beatles" });
                await db.collection("bands").doc("beatles").collection("members").doc("ringo").set({ status: "active" });
                await db.collection("bands").doc("beatles").collection("events").doc("ev1").set(EVENT);
            });
            const ringo = testEnv.authenticatedContext("ringo");
            const event = ringo.firestore().collection("bands").doc("beatles").collection("events").doc("ev1");
            const data = Object.assign({}, EVENT); // clone
            data.location = "Abbey Road Studios";
            await (0, rules_unit_testing_1.assertSucceeds)(event.set(data));
        });
        describe("Participants", () => {
            it("can be listed by members", async () => {
                await testEnv.withSecurityRulesDisabled(async (context) => {
                    const db = context.firestore();
                    await db.collection("users").doc("ringo").set({ bands: { beatles: {} } });
                    await db.collection("bands").doc("beatles").set({ display_name: "The Beatles" });
                    await db.collection("bands").doc("beatles").collection("members").doc("ringo").set({ status: "active" });
                    await db.collection("bands").doc("beatles").collection("events").doc("ev1").set(EVENT);
                });
                const ringo = testEnv.authenticatedContext("ringo");
                const query = ringo.firestore().collection("bands").doc("beatles").collection("events").doc("ev1").collection("participants");
                await (0, rules_unit_testing_1.assertSucceeds)(query.get());
            });
        });
    });
});
//# sourceMappingURL=firestore.test.js.map