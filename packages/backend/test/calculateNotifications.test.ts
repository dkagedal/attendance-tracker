import * as assert from "assert";
/// <reference path="../src/types.ts" />
import * as admin from "firebase-admin";
import * as fft from "firebase-functions-test";

const testEnv = fft({ projectId: "demo-test" });

import { calculateNotifications } from "../src/index";

describe("calculateNotifications", () => {
    let db: admin.firestore.Firestore;

    before(async () => {
        db = admin.firestore();
    });

    beforeEach(async () => {
        // Clear demo DB for this band.
        // In practice we just pick a unique ID for the test.
    });

    after(async () => {
        testEnv.cleanup();
    });

    it("should aggregate emails according to user settings and admin status", async () => {
        const bandId = "test_band_" + Date.now();
        const bandRef = db.collection("bands").doc(bandId);

        // Setup band admin settings
        await bandRef.collection("admin").doc("settings").set({
            from_address: "band@example.com"
        });

        // Setup member 1 (Admin)
        await bandRef.collection("members").doc("user1").set({
            display_name: "Admin User",
            admin: true
        });
        await bandRef.collection("members").doc("user1").collection("private").doc("settings").set({
            email: "admin@example.com",
            notify: {
                new_event: true,
                new_join_request: true,
                new_member: false
            }
        });

        // Setup member 2 (Non-Admin)
        await bandRef.collection("members").doc("user2").set({
            display_name: "Normal User",
            admin: false
        });
        await bandRef.collection("members").doc("user2").collection("private").doc("settings").set({
            email: "normal@example.com",
            notify: {
                new_event: true,
                new_join_request: true, // should be ignored as they are non-admin
                new_member: true // should be ignored as they are non-admin
            }
        });

        // Setup member 3 (Admin, but all false)
        await bandRef.collection("members").doc("user3").set({
            display_name: "Quiet Admin",
            admin: true
        });
        await bandRef.collection("members").doc("user3").collection("private").doc("settings").set({
            email: "quiet@example.com",
            notify: {
                new_event: false,
                new_join_request: false,
                new_member: false
            }
        });

        // Execute function
        await calculateNotifications(bandId);

        // Assert
        const notifyDoc = await bandRef.collection("admin").doc("notify").get();
        const notifyData = notifyDoc.data();
        assert.ok(notifyData, "notify doc not found");

        // Check new_event (both should get it)
        const newEventTo = notifyData.new_event.to;
        assert.ok(newEventTo.includes("admin@example.com"), "admin should get new_event");
        assert.ok(newEventTo.includes("normal@example.com"), "normal user should get new_event");
        assert.ok(!newEventTo.includes("quiet@example.com"), "quiet admin should NOT get new_event");

        // Check new_join_request (only admin should get it)
        const newJoin = notifyData.new_join_request.to;
        assert.ok(newJoin.includes("admin@example.com"), "admin should get new_join_request");
        assert.ok(!newJoin.includes("normal@example.com"), "normal user shouldn't get new_join_request");

        // Check new_member (nobody opted in properly)
        const newMember = notifyData.new_member.to;
        assert.strictEqual(newMember.length, 0, "nobody should get new_member");
    });
});
