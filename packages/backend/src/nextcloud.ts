import * as crypto from "crypto";
import { Firestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { formatStart } from "./email";
import { Band, BandEvent } from "./types";

export type NextcloudAuth = {
  username: string;
  app_password: string;
};

export type NextcloudTalkEvents = {
  event_created?: boolean;
  event_updated?: boolean;
};

export type NextcloudTalkConfig = {
  enabled?: boolean;
  room_token: string;
  bot_secret?: string;
  events?: NextcloudTalkEvents;
};

export type NextcloudConfig = {
  base_url: string;
  auth?: NextcloudAuth;
  talk?: NextcloudTalkConfig;
};

export type NextcloudEventTrigger = "event_created" | "event_updated";

function formatEventDetails(event: BandEvent): string {
  const start = formatStart(event.start);
  if (event.cancelled) {
    return `**INSTÄLLT: ${event.type}** — ${start}`;
  }

  const lines = [`**${event.type}** — ${start}`];
  if (event.location) {
    lines.push(`Plats: ${event.location}`);
  }
  if (event.description) {
    lines.push("", event.description.trim());
  }
  return lines.join("\n");
}

export function newEventTalkMessage(band: Band, event: BandEvent): string {
  return `En ny händelse har lagts till i kalendern för **${
    band.display_name
  }**.\n\n${formatEventDetails(event)}`;
}

export function changedEventTalkMessage(band: Band, event: BandEvent): string {
  return `En händelse har ändrats i kalendern för **${
    band.display_name
  }**.\n\n${formatEventDetails(event)}`;
}

export function signTalkBotMessage(
  random: string,
  message: string,
  secret: string
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(random + message, "utf8")
    .digest("hex");
}

export async function postTalkMessage(
  config: NextcloudConfig,
  message: string,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const talk = config.talk;
  if (!config.base_url || !talk?.room_token) {
    logger.warn("Nextcloud Talk config missing base_url or room_token");
    return;
  }

  const baseUrl = config.base_url.replace(/\/+$/, "");
  const token = encodeURIComponent(talk.room_token);
  const body = JSON.stringify({ message });

  let url: string;
  let headers: Record<string, string>;

  if (talk.bot_secret) {
    const random = crypto.randomBytes(32).toString("hex");
    const signature = signTalkBotMessage(random, message, talk.bot_secret);
    url = `${baseUrl}/ocs/v2.php/apps/spreed/api/v1/bot/${token}/message`;
    headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "OCS-APIRequest": "true",
      "X-Nextcloud-Talk-Bot-Random": random,
      "X-Nextcloud-Talk-Bot-Signature": signature,
    };
  } else if (config.auth?.username && config.auth?.app_password) {
    const credentials = Buffer.from(
      `${config.auth.username}:${config.auth.app_password}`,
      "utf8"
    ).toString("base64");
    url = `${baseUrl}/ocs/v2.php/apps/spreed/api/v1/chat/${token}`;
    headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "OCS-APIRequest": "true",
      Authorization: `Basic ${credentials}`,
    };
  } else {
    logger.warn(
      "Nextcloud Talk config has neither talk.bot_secret nor auth credentials"
    );
    return;
  }

  const response = await fetchImpl(url, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error(
      `Nextcloud Talk API error (${response.status}): ${responseText}`
    );
  }
}

export async function exportEventToNextcloud(
  db: Firestore,
  bandId: string,
  band: Band,
  event: BandEvent,
  trigger: NextcloudEventTrigger,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const doc = await db
    .collection("bands")
    .doc(bandId)
    .collection("admin")
    .doc("nextcloud")
    .get();

  if (!doc.exists) {
    return;
  }

  const config = doc.data() as NextcloudConfig;
  if (!config.talk || config.talk.enabled === false) {
    return;
  }

  const triggerEnabled = config.talk.events?.[trigger] ?? true;
  if (!triggerEnabled) {
    return;
  }

  const message =
    trigger === "event_created"
      ? newEventTalkMessage(band, event)
      : changedEventTalkMessage(band, event);

  logger.info("Posting Nextcloud Talk notification", { bandId, trigger });
  await postTalkMessage(config, message, fetchImpl);
}
