process.env.FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";

import * as assert from "assert";
import * as http from "http";
import { AddressInfo } from "net";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import {
  decodeCalendarToken,
  encodeCalendarToken,
  foldIcalLine,
  generateIcalFeed,
  secretsMatch,
  sixMonthsAgoIsoDate,
  wallClockToUtc,
} from "../src/ical";
import { expressApp } from "../src/api";

// Unfold RFC 5545 folded lines for easier assertions on semantic content
function unfoldIcal(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, "");
}

describe("iCalendar feed generation (unit)", () => {
  it("encodes and decodes calendar tokens safely", () => {
    const secret = "0123456789abcdef0123456789abcdef0123456789abcdef";
    const token = encodeCalendarToken("stor_band-1", "user_abc", secret);
    const decoded = decodeCalendarToken(`${token}.ics`);
    assert.deepStrictEqual(decoded, {
      bandId: "stor_band-1",
      uid: "user_abc",
      secret,
    });

    // Reject path traversal or short secrets
    const badPath = Buffer.from(
      JSON.stringify({ b: "a/b", u: "u1", s: secret }),
      "utf8"
    ).toString("base64url");
    assert.strictEqual(decodeCalendarToken(badPath), null);

    const shortSecret = Buffer.from(
      JSON.stringify({ b: "band", u: "u1", s: "short" }),
      "utf8"
    ).toString("base64url");
    assert.strictEqual(decodeCalendarToken(shortSecret), null);
    assert.strictEqual(decodeCalendarToken("not-valid-base64-json"), null);
  });

  it("compares secrets in constant time", () => {
    assert.strictEqual(
      secretsMatch("abcdef0123456789", "abcdef0123456789"),
      true
    );
    assert.strictEqual(
      secretsMatch("abcdef0123456789", "abcdef0123456780"),
      false
    );
    assert.strictEqual(secretsMatch("abcdef0123456789", "short"), false);
    assert.strictEqual(secretsMatch("", ""), false);
  });

  it("converts wall-clock times across CET, CEST, and custom timezones", () => {
    // Winter (CET = UTC+1): 19:00 Stockholm -> 18:00 UTC
    const winter = wallClockToUtc("2026-11-11", "19:00", "Europe/Stockholm");
    assert.strictEqual(winter?.toISOString(), "2026-11-11T18:00:00.000Z");

    // Summer (CEST = UTC+2): 19:00 Stockholm -> 17:00 UTC
    const summer = wallClockToUtc("2026-07-15", "19:00", "Europe/Stockholm");
    assert.strictEqual(summer?.toISOString(), "2026-07-15T17:00:00.000Z");

    // Custom timezone (EST = UTC-5): 19:00 New York -> 00:00 next day UTC
    const ny = wallClockToUtc("2026-11-11", "19:00", "America/New_York");
    assert.strictEqual(ny?.toISOString(), "2026-11-12T00:00:00.000Z");

    // Non-existent calendar dates return null
    assert.strictEqual(
      wallClockToUtc("2026-02-31", "19:00", "Europe/Stockholm"),
      null
    );
  });

  it("clamps end-of-month dates when computing 6-month history window", () => {
    assert.strictEqual(
      sixMonthsAgoIsoDate(new Date("2026-08-31T12:00:00Z")),
      "2026-02-28"
    );
    assert.strictEqual(
      sixMonthsAgoIsoDate(new Date("2024-08-31T12:00:00Z")),
      "2024-02-29"
    );
  });

  it("folds lines to at most 75 UTF-8 octets without corrupting åäö", () => {
    const longSwedish =
      "DESCRIPTION:" + "Övning med storbandet på Södermalm åäöÅÄÖ! ".repeat(5);
    const folded = foldIcalLine(longSwedish);
    const physicalLines = folded.split("\r\n");
    assert.ok(physicalLines.length > 1, "should fold into multiple lines");
    for (const line of physicalLines) {
      assert.ok(
        Buffer.byteLength(line, "utf8") <= 75,
        `line exceeded 75 octets: ${Buffer.byteLength(line, "utf8")}`
      );
    }
    assert.strictEqual(unfoldIcal(folded), longSwedish);
  });

  it("maps RSVP states, default 2h duration, all-day events, and omits cancelled", () => {
    const ics = generateIcalFeed({
      bandId: "hornet",
      band: { display_name: "Hornet Storband" },
      bandUrl: "https://kommer.example.com/hornet",
      now: new Date("2026-11-11T12:00:00Z"),
      events: [
        {
          id: "ev-yes",
          event: {
            type: "Repetition",
            start: "2026-11-12T19:00",
            location: "Kulturhuset, Sal 2",
            description: "Ta med mappar;\nnya låtar!",
          },
          participant: { attending: "yes", comment: "Kommer 5 min sent" },
        },
        {
          id: "ev-na",
          event: {
            type: " Julkonsert",
            start: "2026-12-10T18:00",
            stop: "2026-12-10T21:30",
          },
        },
        {
          id: "ev-no",
          event: {
            type: "Rep",
            start: "2026-11-19T19:00",
          },
          participant: { attending: "no" },
        },
        {
          id: "ev-sub",
          event: {
            type: "Spelning",
            start: "2026-12-31",
          },
          participant: { attending: "sub", comment: "Anna vikarierar" },
        },
        {
          id: "ev-utc-midnight",
          event: {
            type: "Midnattsspelning",
            start: "2026-07-15T00:00:00Z",
          },
          participant: { attending: "yes" },
        },
        {
          id: "ev-multiday",
          event: {
            type: "Turnéhelg",
            start: "2026-07-10",
            stop: "2026-07-12",
          },
          participant: { attending: "yes" },
        },
        {
          id: "ev-bad-date",
          event: {
            type: "Ogiltigt datum",
            start: "2026-02-31",
          },
        },
        {
          id: "ev-cancelled",
          event: {
            type: "Inställt rep",
            start: "2026-11-26T19:00",
            cancelled: true,
          },
          participant: { attending: "yes" },
        },
      ],
    });

    // Verify CRLF line endings and max 75 octets per line
    assert.ok(ics.endsWith("\r\n"));
    for (const rawLine of ics.slice(0, -2).split("\r\n")) {
      assert.ok(Buffer.byteLength(rawLine, "utf8") <= 75);
    }

    const unfolded = unfoldIcal(ics);
    assert.ok(unfolded.includes("X-WR-CALNAME:Hornet Storband\r\n"));
    assert.ok(unfolded.includes("X-WR-TIMEZONE:Europe/Stockholm\r\n"));

    // Cancelled event is omitted
    assert.ok(!unfolded.includes("ev-cancelled"));
    assert.ok(!unfolded.includes("Inställt rep"));

    // "yes" event: no prefix, 2h default duration (18:00Z -> 20:00Z), CONFIRMED + OPAQUE
    assert.ok(unfolded.includes("UID:ev-yes@hornet.kommer\r\n"));
    assert.ok(unfolded.includes("DTSTART:20261112T180000Z\r\n"));
    assert.ok(unfolded.includes("DTEND:20261112T200000Z\r\n"));
    assert.ok(unfolded.includes("SUMMARY:Repetition\r\n"));
    assert.ok(unfolded.includes("LOCATION:Kulturhuset\\, Sal 2\r\n"));
    assert.ok(
      unfolded.includes(
        "DESCRIPTION:Ta med mappar\\;\\nnya låtar!\\n\\nDitt svar: Kommer\\nKommentar: Kommer 5 min sent\\nÖppna i Kommer: https://kommer.example.com/hornet\r\n"
      )
    );

    // Unanswered ("na") event: [Ej svarat], explicit stop (17:00Z -> 20:30Z), trimmed title, TENTATIVE + OPAQUE
    assert.ok(unfolded.includes("UID:ev-na@hornet.kommer\r\n"));
    assert.ok(unfolded.includes("DTSTART:20261210T170000Z\r\n"));
    assert.ok(unfolded.includes("DTEND:20261210T203000Z\r\n"));
    assert.ok(unfolded.includes("SUMMARY:[Ej svarat] Julkonsert\r\n"));
    assert.ok(unfolded.includes("STATUS:TENTATIVE\r\n"));

    // Explicit UTC midnight is timed (not misclassified as all-day)
    assert.ok(unfolded.includes("UID:ev-utc-midnight@hornet.kommer\r\n"));
    assert.ok(unfolded.includes("DTSTART:20260715T000000Z\r\n"));
    assert.ok(unfolded.includes("DTEND:20260715T020000Z\r\n"));

    // Multi-day all-day event uses exclusive next-day DTEND after stop date
    assert.ok(unfolded.includes("UID:ev-multiday@hornet.kommer\r\n"));
    assert.ok(unfolded.includes("DTSTART;VALUE=DATE:20260710\r\n"));
    assert.ok(unfolded.includes("DTEND;VALUE=DATE:20260713\r\n"));

    // Invalid date is skipped
    assert.ok(!unfolded.includes("ev-bad-date"));

    // "no" event: [Kan inte], CONFIRMED + TRANSPARENT
    assert.ok(unfolded.includes("SUMMARY:[Kan inte] Rep\r\n"));
    assert.ok(unfolded.includes("TRANSP:TRANSPARENT\r\n"));

    // "sub" all-day event on New Year's Eve: rolls over to 20270101
    assert.ok(unfolded.includes("DTSTART;VALUE=DATE:20261231\r\n"));
    assert.ok(unfolded.includes("DTEND;VALUE=DATE:20270101\r\n"));
    assert.ok(unfolded.includes("SUMMARY:[Vikarie] Spelning\r\n"));
  });
});

describe("Calendar HTTP endpoint (emulator integration)", () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    if (admin.apps.length === 0) {
      admin.initializeApp({ projectId: "demo-test" });
    }
    server = http.createServer(expressApp);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve)
    );
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  });

  it("serves personalized .ics feed and enforces token rotation & membership", async () => {
    const db = getFirestore();
    const bandId = `calband_${Date.now()}`;
    const uid = "alice";
    const secret = "a1b2c3d4e5f60123456789abcdef0123456789abcdef0123";

    const bandRef = db.collection("bands").doc(bandId);
    await bandRef.set({ display_name: "Testbandet" });
    await bandRef.collection("members").doc(uid).set({
      display_name: "Alice",
      admin: false,
    });
    await bandRef
      .collection("members")
      .doc(uid)
      .collection("private")
      .doc("calendar")
      .set({
        secret,
        createdAt: admin.firestore.Timestamp.now(),
      });

    // Future event where Alice says "no" and Bob says "yes"
    const futureEventRef = bandRef.collection("events").doc("future1");
    await futureEventRef.set({
      type: " Konsert",
      start: "2099-05-01T19:30",
      location: "Konserthuset",
    });
    await futureEventRef
      .collection("participants")
      .doc(uid)
      .set({ attending: "no", comment: "Bortrest" });
    await futureEventRef
      .collection("participants")
      .doc("bob")
      .set({ attending: "yes" });

    // Cancelled future event
    await bandRef.collection("events").doc("cancelled1").set({
      type: "Inställt rep",
      start: "2099-05-02T19:00",
      cancelled: true,
    });

    // Very old event (> 6 months ago)
    await bandRef.collection("events").doc("ancient1").set({
      type: "Gammal spelning",
      start: "2020-01-01T19:00",
    });

    const encoded = encodeCalendarToken(bandId, uid, secret);
    const res = await fetch(`${baseUrl}/_/calendar/${encoded}.ics`, {
      headers: {
        "X-Forwarded-Host": "kommer.example.se",
        "X-Forwarded-Proto": "https",
      },
    });

    assert.strictEqual(res.status, 200);
    assert.ok(
      res.headers.get("content-type")?.includes("text/calendar"),
      "should return text/calendar"
    );
    const body = unfoldIcal(await res.text());
    assert.ok(body.includes("X-WR-CALNAME:Testbandet\r\n"));
    assert.ok(body.includes("SUMMARY:[Kan inte] Konsert\r\n"));
    assert.ok(body.includes("TRANSP:TRANSPARENT\r\n"));
    assert.ok(
      body.includes(`URL:https://kommer.example.se/${bandId}\r\n`),
      "should include link back to band"
    );
    assert.ok(!body.includes("cancelled1"), "should omit cancelled events");
    assert.ok(!body.includes("ancient1"), "should omit events older than 6m");

    // Custom /hosts/{hostname} mapping resolves to root URL without band slug
    const customHost = `calband-${Date.now()}.example.se`;
    await db.collection("hosts").doc(customHost).set({ band: bandId });
    const customHostRes = await fetch(`${baseUrl}/_/calendar/${encoded}.ics`, {
      headers: {
        "X-Forwarded-Host": customHost,
        "X-Forwarded-Proto": "https",
      },
    });
    assert.strictEqual(customHostRes.status, 200);
    const customHostBody = unfoldIcal(await customHostRes.text());
    assert.ok(
      customHostBody.includes(`URL:https://${customHost}/\r\n`),
      "custom host mapped to band should link to root"
    );

    // Malformed X-Forwarded-Host (with '/') or invalid X-Forwarded-Proto do not crash or inject scheme
    const badHeadersRes = await fetch(`${baseUrl}/_/calendar/${encoded}.ics`, {
      headers: {
        "X-Forwarded-Host": "evil.example.se/injected/path",
        "X-Forwarded-Proto": "javascript",
      },
    });
    assert.strictEqual(badHeadersRes.status, 200);
    const badHeadersBody = unfoldIcal(await badHeadersRes.text());
    assert.ok(!badHeadersBody.includes("javascript:"));
    assert.ok(!badHeadersBody.includes("injected/path"));

    // Non-.ics path returns 404
    const notIcsRes = await fetch(`${baseUrl}/_/calendar/${encoded}.json`);
    assert.strictEqual(notIcsRes.status, 404);

    // Calendar token cannot be used as a Bearer token on REST API
    const apiRes = await fetch(`${baseUrl}/bands/${bandId}/events`, {
      headers: { Authorization: `Bearer ${encoded}` },
    });
    assert.strictEqual(apiRes.status, 401);

    // Wrong secret -> 401
    const wrongEncoded = encodeCalendarToken(
      bandId,
      uid,
      "ffffffffffffffffffffffffffffffffffffffffffffffff"
    );
    const wrongRes = await fetch(`${baseUrl}/_/calendar/${wrongEncoded}.ics`);
    assert.strictEqual(wrongRes.status, 401);

    // Rotate secret -> old URL immediately returns 401
    await bandRef
      .collection("members")
      .doc(uid)
      .collection("private")
      .doc("calendar")
      .set({
        secret: "999999999999999999999999999999999999999999999999",
        createdAt: admin.firestore.Timestamp.now(),
      });
    const rotatedOldRes = await fetch(`${baseUrl}/_/calendar/${encoded}.ics`);
    assert.strictEqual(rotatedOldRes.status, 401);

    // Delete calendar doc (deactivation) -> returns 401
    await bandRef
      .collection("members")
      .doc(uid)
      .collection("private")
      .doc("calendar")
      .delete();
    const deactivatedRes = await fetch(`${baseUrl}/_/calendar/${encoded}.ics`);
    assert.strictEqual(deactivatedRes.status, 401);

    // Restore secret, then remove member -> 403 Forbidden
    await bandRef
      .collection("members")
      .doc(uid)
      .collection("private")
      .doc("calendar")
      .set({
        secret,
        createdAt: admin.firestore.Timestamp.now(),
      });
    await bandRef.collection("members").doc(uid).delete();
    const removedMemberRes = await fetch(
      `${baseUrl}/_/calendar/${encoded}.ics`
    );
    assert.strictEqual(removedMemberRes.status, 403);
  });
});
