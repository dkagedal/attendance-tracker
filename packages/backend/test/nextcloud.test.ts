import * as assert from "assert";
import * as crypto from "crypto";
import { Firestore } from "firebase-admin/firestore";
import { describe, it } from "mocha";
import {
  changedEventTalkMessage,
  exportEventToNextcloud,
  newEventTalkMessage,
  NextcloudConfig,
  postTalkMessage,
  signTalkBotMessage,
} from "../src/nextcloud";
import { Band, BandEvent } from "../src/types";

type FetchCall = {
  url: string;
  init?: RequestInit;
};

function createMockFetch(status = 200, responseBody = '{"ocs":{}}') {
  const calls: FetchCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(responseBody, { status });
  };
  return { calls, fetchImpl };
}

function createMockDb(nextcloudDocData?: NextcloudConfig): Firestore {
  return {
    collection: (name: string) => {
      assert.strictEqual(name, "bands");
      return {
        doc: (_bandId: string) => ({
          collection: (sub: string) => {
            assert.strictEqual(sub, "admin");
            return {
              doc: (docId: string) => {
                assert.strictEqual(docId, "nextcloud");
                return {
                  get: async () => ({
                    exists: nextcloudDocData !== undefined,
                    data: () => nextcloudDocData,
                  }),
                };
              },
            };
          },
        }),
      };
    },
  } as unknown as Firestore;
}

describe("Nextcloud Talk integration", () => {
  const band: Band = { display_name: "Storbandet & Co" };
  const sampleEvent: BandEvent = {
    type: "Repetition",
    start: "2026-11-15T19:00",
    location: "Kulturhuset",
    description: "Ta med **noter**!",
  };

  describe("message formatting", () => {
    it("formats new event messages in Swedish with Markdown", () => {
      const msg = newEventTalkMessage(band, sampleEvent);
      assert.ok(
        msg.includes(
          "En ny händelse har lagts till i kalendern för **Storbandet & Co**."
        )
      );
      assert.ok(msg.includes("**Repetition** — 15 november kl. 19:00"));
      assert.ok(msg.includes("Plats: Kulturhuset"));
      assert.ok(msg.includes("Ta med **noter**!"));
    });

    it("formats updated and cancelled events cleanly", () => {
      const cancelledEvent: BandEvent = {
        ...sampleEvent,
        cancelled: true,
      };
      const msg = changedEventTalkMessage(band, cancelledEvent);
      assert.ok(
        msg.includes(
          "En händelse har ändrats i kalendern för **Storbandet & Co**."
        )
      );
      assert.ok(
        msg.includes("**INSTÄLLT: Repetition** — 15 november kl. 19:00")
      );
      assert.ok(!msg.includes("Kulturhuset"));
    });

    it("formats all-day events without time", () => {
      const allDayEvent: BandEvent = {
        type: "Konsertresa",
        start: "2026-12-05",
      };
      const msg = newEventTalkMessage(band, allDayEvent);
      assert.ok(msg.includes("**Konsertresa** — 5 december"));
    });
  });

  describe("postTalkMessage", () => {
    it("uses Bot API with HMAC-SHA256(random + message) when bot_secret is configured", async () => {
      const { calls, fetchImpl } = createMockFetch(201);
      const config: NextcloudConfig = {
        base_url: "https://cloud.example.com/",
        auth: {
          username: "fallback-user",
          app_password: "fallback-password",
        },
        talk: {
          room_token: "room_abc",
          bot_secret: "supersecretkey",
        },
      };

      const message = "Hej bandet!";
      await postTalkMessage(config, message, fetchImpl);

      assert.strictEqual(calls.length, 1);
      assert.strictEqual(
        calls[0].url,
        "https://cloud.example.com/ocs/v2.php/apps/spreed/api/v1/bot/room_abc/message"
      );
      assert.strictEqual(calls[0].init?.method, "POST");
      assert.strictEqual(
        calls[0].init?.body,
        JSON.stringify({ message: "Hej bandet!" })
      );

      const headers = calls[0].init?.headers as Record<string, string>;
      assert.strictEqual(headers["OCS-APIRequest"], "true");
      assert.strictEqual(headers["Content-Type"], "application/json");
      assert.ok(headers["Authorization"] === undefined);

      const random = headers["X-Nextcloud-Talk-Bot-Random"];
      const signature = headers["X-Nextcloud-Talk-Bot-Signature"];
      assert.strictEqual(random.length, 64);

      const expectedSig = crypto
        .createHmac("sha256", "supersecretkey")
        .update(random + message, "utf8")
        .digest("hex");
      assert.strictEqual(signature, expectedSig);
      assert.strictEqual(
        signTalkBotMessage(random, message, "supersecretkey"),
        expectedSig
      );
    });

    it("falls back to OCS Chat API with Basic Auth when bot_secret is omitted", async () => {
      const { calls, fetchImpl } = createMockFetch(201);
      const config: NextcloudConfig = {
        base_url: "https://cloud.example.com/nextcloud/",
        auth: {
          username: "bandbot",
          app_password: "app-pass-123",
        },
        talk: {
          room_token: "room_xyz",
        },
      };

      await postTalkMessage(config, "Testmeddelande", fetchImpl);

      assert.strictEqual(calls.length, 1);
      assert.strictEqual(
        calls[0].url,
        "https://cloud.example.com/nextcloud/ocs/v2.php/apps/spreed/api/v1/chat/room_xyz"
      );
      const headers = calls[0].init?.headers as Record<string, string>;
      assert.strictEqual(headers["OCS-APIRequest"], "true");
      const expectedAuth =
        "Basic " +
        Buffer.from("bandbot:app-pass-123", "utf8").toString("base64");
      assert.strictEqual(headers["Authorization"], expectedAuth);
    });

    it("throws on non-2xx Nextcloud responses", async () => {
      const { fetchImpl } = createMockFetch(401, "Unauthorized");
      const config: NextcloudConfig = {
        base_url: "https://cloud.example.com",
        talk: {
          room_token: "room_abc",
          bot_secret: "wrongsecret",
        },
      };

      await assert.rejects(
        () => postTalkMessage(config, "Hej", fetchImpl),
        /Nextcloud Talk API error \(401\): Unauthorized/
      );
    });

    it("does nothing if credentials are missing", async () => {
      const { calls, fetchImpl } = createMockFetch(200);
      const config: NextcloudConfig = {
        base_url: "https://cloud.example.com",
        talk: {
          room_token: "room_abc",
        },
      };

      await postTalkMessage(config, "Hej", fetchImpl);
      assert.strictEqual(calls.length, 0);
    });
  });

  describe("exportEventToNextcloud", () => {
    it("skips when admin/nextcloud document does not exist", async () => {
      const { calls, fetchImpl } = createMockFetch(201);
      const db = createMockDb(undefined);

      await exportEventToNextcloud(
        db,
        "band1",
        band,
        sampleEvent,
        "event_created",
        fetchImpl
      );
      assert.strictEqual(calls.length, 0);
    });

    it("skips when talk.enabled is false", async () => {
      const { calls, fetchImpl } = createMockFetch(201);
      const db = createMockDb({
        base_url: "https://cloud.example.com",
        talk: {
          enabled: false,
          room_token: "room1",
          bot_secret: "secret",
        },
      });

      await exportEventToNextcloud(
        db,
        "band1",
        band,
        sampleEvent,
        "event_created",
        fetchImpl
      );
      assert.strictEqual(calls.length, 0);
    });

    it("respects per-trigger opt-out flags and defaults unspecified triggers to true", async () => {
      const { calls, fetchImpl } = createMockFetch(201);
      const db = createMockDb({
        base_url: "https://cloud.example.com",
        talk: {
          room_token: "room1",
          bot_secret: "secret",
          events: {
            event_updated: false,
          },
        },
      });

      await exportEventToNextcloud(
        db,
        "band1",
        band,
        sampleEvent,
        "event_updated",
        fetchImpl
      );
      assert.strictEqual(calls.length, 0);

      await exportEventToNextcloud(
        db,
        "band1",
        band,
        sampleEvent,
        "event_created",
        fetchImpl
      );
      assert.strictEqual(calls.length, 1);
      const body = JSON.parse(calls[0].init?.body as string);
      assert.ok(body.message.includes("En ny händelse har lagts till"));
    });
  });
});
