import * as crypto from "crypto";
import { Band, BandEvent } from "./types";

export const DEFAULT_TIMEZONE = "Europe/Stockholm";
export const DEFAULT_EVENT_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours

export type ParticipantResponse = "yes" | "no" | "sub" | "na";

export interface CalendarParticipant {
  attending?: string;
  comment?: string;
}

export interface CalendarEventInput {
  id: string;
  event: BandEvent;
  participant?: CalendarParticipant;
}

/**
 * Compact wire format encoded as base64url JSON inside `/_/calendar/<token>.ics`.
 * `secret` is the raw random secret stored in Firestore (`private/calendar.secret`),
 * whereas `token` is the encoded URL credential containing `(bandId, uid, secret)`.
 */
interface WireCalendarTokenPayload {
  b: string;
  u: string;
  s: string;
}

export interface CalendarTokenPayload {
  bandId: string;
  uid: string;
  secret: string;
}

export interface GenerateIcalOptions {
  bandId: string;
  band: Band;
  events: CalendarEventInput[];
  bandUrl?: string;
  now?: Date;
}

export function encodeCalendarToken(
  bandId: string,
  uid: string,
  secret: string
): string {
  const payload: WireCalendarTokenPayload = { b: bandId, u: uid, s: secret };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCalendarToken(
  rawToken: string
): CalendarTokenPayload | null {
  const cleaned = rawToken.endsWith(".ics") ? rawToken.slice(0, -4) : rawToken;
  if (!cleaned || cleaned.length > 1024) {
    return null;
  }
  try {
    const json = Buffer.from(cleaned, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.b !== "string" ||
      typeof parsed.u !== "string" ||
      typeof parsed.s !== "string"
    ) {
      return null;
    }
    if (
      parsed.b.length === 0 ||
      parsed.u.length === 0 ||
      parsed.s.length < 16 ||
      parsed.b.includes("/") ||
      parsed.u.includes("/")
    ) {
      return null;
    }
    return { bandId: parsed.b, uid: parsed.u, secret: parsed.s };
  } catch {
    return null;
  }
}

export function secretsMatch(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(actual, "utf8");
  if (a.length === 0 || a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

export function resolveTimeZone(tz?: string): string {
  const candidate = tz?.trim();
  if (!candidate) {
    return DEFAULT_TIMEZONE;
  }
  try {
    Intl.DateTimeFormat("en-US", { timeZone: candidate });
    return candidate;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let dtf = dtfCache.get(timeZone);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    dtfCache.set(timeZone, dtf);
  }
  return dtf;
}

function getTimeZoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = getFormatter(timeZone).formatToParts(new Date(utcMs));
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = parseInt(part.value, 10);
    }
  }
  const asUtcMs = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour === 24 ? 0 : map.hour,
    map.minute,
    map.second
  );
  return asUtcMs - utcMs;
}

function isValidCalendarDate(
  year: number,
  month: number,
  day: number
): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() + 1 === month &&
    d.getUTCDate() === day
  );
}

export function wallClockToUtc(
  dateStr: string,
  timeStr: string,
  timeZone: string
): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(timeStr);
  if (!dateMatch || !timeMatch) {
    return null;
  }
  const year = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const day = parseInt(dateMatch[3], 10);
  const hour = parseInt(timeMatch[1], 10);
  const minute = parseInt(timeMatch[2], 10);
  const second = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;

  if (
    !isValidCalendarDate(year, month, day) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  const guessMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstCandidate = guessMs - getTimeZoneOffsetMs(guessMs, timeZone);
  const refinedUtcMs = guessMs - getTimeZoneOffsetMs(firstCandidate, timeZone);
  return new Date(refinedUtcMs);
}

export function parseEventDateTime(
  isoString: string,
  timeZone: string
): Date | null {
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(isoString)) {
    const parsed = new Date(isoString);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  const [datePart, timePart] = isoString.split("T");
  if (!datePart || !timePart) {
    return null;
  }
  return wallClockToUtc(datePart, timePart, timeZone);
}

function isZeroTime(timePart: string): boolean {
  return (
    timePart === "00:00" ||
    timePart === "00:00:00" ||
    timePart.startsWith("00:00:00.")
  );
}

function parseDateOnly(
  datePart: string
): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!m) {
    return null;
  }
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (!isValidCalendarDate(year, month, day)) {
    return null;
  }
  return { year, month, day };
}

function formatIcalDate(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month - 1, day));
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${da}`;
}

export function formatIcalUtcDateTime(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

export function escapeIcalText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function foldIcalLine(line: string): string {
  if (Buffer.byteLength(line, "utf8") <= 75) {
    return line;
  }
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  let maxBytes = 75;

  for (const char of line) {
    const charBytes = Buffer.byteLength(char, "utf8");
    if (currentBytes + charBytes > maxBytes && current.length > 0) {
      chunks.push(current);
      current = " " + char;
      currentBytes = 1 + charBytes;
      maxBytes = 75;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks.join("\r\n");
}

function normalizeResponse(attending?: string): ParticipantResponse {
  if (attending === "yes" || attending === "no" || attending === "sub") {
    return attending;
  }
  return "na";
}

function getRsvpMeta(response: ParticipantResponse): {
  prefix: string;
  label: string;
  status: "CONFIRMED" | "TENTATIVE";
  transp: "OPAQUE" | "TRANSPARENT";
} {
  switch (response) {
    case "yes":
      return {
        prefix: "",
        label: "Kommer",
        status: "CONFIRMED",
        transp: "OPAQUE",
      };
    case "no":
      return {
        prefix: "[Kan inte] ",
        label: "Kan inte",
        status: "CONFIRMED",
        transp: "TRANSPARENT",
      };
    case "sub":
      return {
        prefix: "[Vikarie] ",
        label: "Vikarie",
        status: "CONFIRMED",
        transp: "TRANSPARENT",
      };
    case "na":
      return {
        prefix: "[Ej svarat] ",
        label: "Ej svarat",
        status: "TENTATIVE",
        transp: "OPAQUE",
      };
  }
}

export function sixMonthsAgoIsoDate(now: Date = new Date()): string {
  const targetMonthIndex = now.getUTCMonth() - 6;
  const firstOfTargetMonth = new Date(
    Date.UTC(now.getUTCFullYear(), targetMonthIndex, 1)
  );
  const targetYear = firstOfTargetMonth.getUTCFullYear();
  const targetMonth = firstOfTargetMonth.getUTCMonth();
  const daysInTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0)
  ).getUTCDate();
  const clampedDay = Math.min(now.getUTCDate(), daysInTargetMonth);
  const d = new Date(Date.UTC(targetYear, targetMonth, clampedDay));
  return d.toISOString().split("T")[0];
}

export function generateIcalFeed(options: GenerateIcalOptions): string {
  const { bandId, band, events, bandUrl } = options;
  const now = options.now || new Date();
  const dtstamp = formatIcalUtcDateTime(now);
  const timeZone = resolveTimeZone(band.timezone);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kommer//Attendance Tracker//SV",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcalText(band.display_name || bandId)}`,
    `X-WR-TIMEZONE:${escapeIcalText(timeZone)}`,
  ];

  for (const { id, event, participant } of events) {
    if (event.cancelled || !event.start) {
      continue;
    }

    const [startDatePart, rawStartTimePart] = event.start.split("T");
    const hasExplicitOffset = rawStartTimePart
      ? /Z$|[+-]\d{2}:?\d{2}$/.test(rawStartTimePart)
      : false;
    const isAllDay =
      !rawStartTimePart ||
      (!hasExplicitOffset && isZeroTime(rawStartTimePart) && !event.stop);

    let dtStartLine: string | null = null;
    let dtEndLine: string | null = null;

    if (isAllDay) {
      const startDate = parseDateOnly(startDatePart);
      if (!startDate) {
        continue;
      }
      dtStartLine = `DTSTART;VALUE=DATE:${formatIcalDate(
        startDate.year,
        startDate.month,
        startDate.day
      )}`;

      const stopDatePart = event.stop ? event.stop.split("T")[0] : "";
      const stopDate = stopDatePart ? parseDateOnly(stopDatePart) : null;
      if (
        stopDate &&
        Date.UTC(stopDate.year, stopDate.month - 1, stopDate.day) >=
          Date.UTC(startDate.year, startDate.month - 1, startDate.day)
      ) {
        dtEndLine = `DTEND;VALUE=DATE:${formatIcalDate(
          stopDate.year,
          stopDate.month,
          stopDate.day + 1
        )}`;
      } else {
        dtEndLine = `DTEND;VALUE=DATE:${formatIcalDate(
          startDate.year,
          startDate.month,
          startDate.day + 1
        )}`;
      }
    } else {
      const startUtc = parseEventDateTime(event.start, timeZone);
      if (!startUtc) {
        continue;
      }
      let stopUtc = event.stop
        ? parseEventDateTime(event.stop, timeZone)
        : null;
      if (!stopUtc || stopUtc.getTime() <= startUtc.getTime()) {
        stopUtc = new Date(startUtc.getTime() + DEFAULT_EVENT_DURATION_MS);
      }
      dtStartLine = `DTSTART:${formatIcalUtcDateTime(startUtc)}`;
      dtEndLine = `DTEND:${formatIcalUtcDateTime(stopUtc)}`;
    }

    const response = normalizeResponse(participant?.attending);
    const rsvp = getRsvpMeta(response);
    const eventTitle = event.type?.trim() || "Händelse";
    const summary = `${rsvp.prefix}${eventTitle}`;

    const descSections: string[] = [];
    if (event.description && event.description.trim().length > 0) {
      descSections.push(event.description.trim());
    }
    const statusLines: string[] = [`Ditt svar: ${rsvp.label}`];
    if (participant?.comment && participant.comment.trim().length > 0) {
      statusLines.push(`Kommentar: ${participant.comment.trim()}`);
    }
    if (bandUrl) {
      statusLines.push(`Öppna i Kommer: ${bandUrl}`);
    }
    descSections.push(statusLines.join("\n"));
    const description = descSections.join("\n\n");

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeIcalText(`${id}@${bandId}.kommer`)}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(dtStartLine);
    lines.push(dtEndLine);
    lines.push(`SUMMARY:${escapeIcalText(summary)}`);
    lines.push(`STATUS:${rsvp.status}`);
    lines.push(`TRANSP:${rsvp.transp}`);
    if (event.location && event.location.trim().length > 0) {
      lines.push(`LOCATION:${escapeIcalText(event.location.trim())}`);
    }
    lines.push(`DESCRIPTION:${escapeIcalText(description)}`);
    if (bandUrl) {
      lines.push(`URL:${bandUrl}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldIcalLine).join("\r\n") + "\r\n";
}
