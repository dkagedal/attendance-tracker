# Specification 0004: Calendar Subscription

## Overview

Calendar Subscription lets each band member subscribe to a live, personalized iCalendar (`.ics`) feed for a band in external calendar applications such as Google Calendar, Apple Calendar, and Outlook. Each feed is scoped to one member and one band, reflects all non-cancelled band events along with the member's personal RSVP status, and can be rotated or deactivated without affecting other bands or API keys.

## User Interaction

- **Navigation**:
  - The left navigation drawer contains a **Kalenderprenumeration** item alongside **Schema** and **Översikt**, scoped to the currently selected band.
  - Selecting **Kalenderprenumeration** opens the Calendar Subscription view with an icon back button (accessible name **Tillbaka**) at the top to return to the schedule.
- **Subscribing**:
  - When a member opens the Calendar Subscription view for a band and has no active calendar link, the view displays an **Aktivera kalenderlänk** button.
  - Once activated, the view displays:
    - The band's subscription URL (`<origin>/_/calendar/<token>.ics`) with a one-click copy icon button and confirmation toast.
    - A **Lägg till i Google Kalender** button that opens Google Calendar's subscription prompt (`https://calendar.google.com/calendar/r?cid=webcal://...`).
    - An **Öppna i kalenderapp** link (`webcal://<host>/_/calendar/<token>.ics`) for native calendar clients (Apple Calendar, Outlook, etc.).
- **Managing the Link**:
  - **Återställ länk**: Opens a confirmation dialog warning that existing calendar subscriptions using the old URL will stop updating. Confirming replaces the stored secret, updates the displayed URL immediately, and shows a confirmation toast.
  - **Inaktivera**: Opens a confirmation dialog and deletes the stored calendar secret so existing feed URLs immediately stop serving events and the view remains in its inactive state (**Aktivera kalenderlänk**) across navigation and page reloads until re-activated.

## Functional Requirements

- Each calendar feed URL is unique to a `(band, member)` pair and authenticates using the token embedded in the URL path without requiring HTTP `Authorization` headers.
- A calendar token grants read-only access exclusively to that band's `.ics` feed and cannot be used to access JSON REST API endpoints or other bands.
- Requests under `/_/calendar/` whose path does not end in `.ics` return `404 Not Found`.
- Requests with a malformed, rotated, or deactivated calendar token return `401 Unauthorized`; requests with a matching secret whose user is no longer a member of an existing band return `403 Forbidden`.
- Valid requests return an RFC 5545 `VCALENDAR` document (`Content-Type: text/calendar; charset=utf-8`, `Content-Disposition: inline; filename="<band>.ics"`, `Cache-Control: private, no-cache`) with CRLF line endings and 75-octet UTF-8 line folding.
- Calendar-level metadata sets `X-WR-CALNAME` to the band's display name and `X-WR-TIMEZONE` to the band's configured IANA timezone (defaulting to `Europe/Stockholm`).
- The feed includes band events starting from 6 months prior to the current date (clamped to valid month-end dates) onward, including all future events.
- Cancelled events are omitted from the feed so calendar clients remove them.
- All non-cancelled events with valid dates within the time window are included regardless of the member's RSVP, with trimmed event titles and RSVP reflected as follows:
  - `"yes"` (Kommer): `SUMMARY` is `{type}`, `STATUS:CONFIRMED`, `TRANSP:OPAQUE` (Busy).
  - `"na"` or unanswered: `SUMMARY` is `[Ej svarat] {type}`, `STATUS:TENTATIVE`, `TRANSP:OPAQUE` (Busy).
  - `"no"` (Kan inte): `SUMMARY` is `[Kan inte] {type}`, `STATUS:CONFIRMED`, `TRANSP:TRANSPARENT` (Free).
  - `"sub"` (Vikarie): `SUMMARY` is `[Vikarie] {type}`, `STATUS:CONFIRMED`, `TRANSP:TRANSPARENT` (Free).
- Events with a date only (or a floating `00:00` start time without a stop time) are emitted as all-day events (`DTSTART;VALUE=DATE:YYYYMMDD` and exclusive `DTEND;VALUE=DATE:YYYYMMDD`, extending to the day after `stop` for multi-day date ranges).
- Timed events interpret floating wall-clock times in the band's timezone (while preserving explicit UTC or offset timestamps) and emit UTC timestamps (`YYYYMMDDTHHMMSSZ`). When `stop` is omitted or not after `start`, the duration defaults to 2 hours.
- Each `VEVENT` includes a `DESCRIPTION` containing the event's description (when present), the member's current RSVP status (and comment when present), and—when requested via a valid non-Cloud-Functions/Cloud-Run application host—a link back to the band in Kommer (also emitted as the `URL` property on the `VEVENT`).

## Technical Design

- **Firestore Schema**:
  - `/bands/{bandId}`: Optional `timezone` string field (IANA timezone, default `"Europe/Stockholm"`).
  - `/bands/{bandId}/members/{uid}/private/calendar`: `{ secret: string, createdAt: Timestamp }`, where `secret` is `16..256` characters (48-character random hex generated by the frontend). Deleting this document deactivates the subscription.
  - Security rules (`authenticatedAs(uid) && isMember(uid)` with `isValidCalendarDoc(request.resource.data)`) permit a band member to read, create, update, and delete only their own `private/calendar` document.
- **Token Encoding & Verification**:
  - The URL path `/_/calendar/<token>.ics` encodes `{ b: bandId, u: uid, s: secret }` as base64url JSON.
  - On `GET /_/calendar/:tokenFile`, the backend decodes `(bandId, uid, secret)`, fetches `/bands/{bandId}`, `/bands/{bandId}/members/{uid}`, `/bands/{bandId}/members/{uid}/private/calendar`, and (when a validated `Host` / `X-Forwarded-Host` hostname is present) `/hosts/{hostname}` in a single `db.getAll()` round-trip, compares `secret` against `calendar.secret` with `crypto.timingSafeEqual` (`401` on mismatch/missing), and verifies band and member existence (`403` if missing).
  - When `/hosts/{hostname}` maps `band === bandId`, the generated band URL links to `<proto>://<host>/`; otherwise `<proto>://<host>/<bandId>`.
- **Hosting & Backend Endpoint**:
  - Firebase Hosting rewrites `/_/calendar/**` to the `api` Cloud Function (`packages/backend/src/api.ts`), avoiding path collisions with band slugs by using the reserved `/_/` prefix.
  - Participant documents (`/bands/{bandId}/events/{eventId}/participants/{uid}`) for all non-cancelled events in the 6-month window are fetched in a single batch `db.getAll()` call.
