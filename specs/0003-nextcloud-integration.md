# Specification 0003: Nextcloud Integration

## Overview

Bands can export calendar updates to an external Nextcloud deployment. Specifically, when calendar events are created, modified, or cancelled, the backend posts formatted chat notifications to a configured Nextcloud Talk conversation.

## User Interaction

- **Band Members**:
  - When a band member creates, edits, or cancels an event in the band schedule, a notification message appears automatically in the band's configured Nextcloud Talk chat room.
  - Messages are formatted in Swedish using Markdown, showing the band name, event type, start date/time, cancellation status (when applicable), location, and description.
- **Administrators / Operators**:
  - Nextcloud integration is configured per band via the backend-only Firestore document `/bands/{bandId}/admin/nextcloud`.
  - Operators can authenticate using either a dedicated Nextcloud Talk Bot shared secret (preferred) or a Nextcloud user account and app password (fallback).
  - Operators can enable or disable Talk notifications overall or selectively for event creation versus event updates.
  - Bands without `/bands/{bandId}/admin/nextcloud` configured are unaffected.

## Functional Requirements

- Creating an event in `/bands/{bandId}/events/{eventId}` posts a new-event chat message to the band's configured Nextcloud Talk conversation when `event_created` notifications are enabled.
- Updating an event in `/bands/{bandId}/events/{eventId}` (including marking it cancelled) posts an updated-event chat message to the band's configured Nextcloud Talk conversation when `event_updated` notifications are enabled.
- Nextcloud Talk configuration and credentials stored under `/bands/{bandId}/admin/nextcloud` are inaccessible to client applications via Firestore security rules.
- When `talk.bot_secret` is configured, messages are delivered through the Nextcloud Talk Bot API signed with HMAC-SHA256.
- When `talk.bot_secret` is omitted and `auth.username` and `auth.app_password` are configured, messages are delivered through the Nextcloud Talk Chat OCS API using HTTP Basic Authentication.
- Failures when communicating with Nextcloud are logged and do not prevent email notifications or other event processing from completing.

## Technical Design

- **Firestore Configuration (`/bands/{bandId}/admin/nextcloud`)**:
  - `base_url`: Base URL of the Nextcloud server (e.g., `"https://cloud.example.com"`).
  - `auth`: Optional `{ username, app_password }` object for HTTP Basic Authentication.
  - `talk`: Optional `{ enabled, room_token, bot_secret, events: { event_created, event_updated } }` object. `enabled`, `events.event_created`, and `events.event_updated` default to `true` when `talk` is present.
- **Nextcloud Talk Endpoints**:
  - **Bot API**: `POST {base_url}/ocs/v2.php/apps/spreed/api/v1/bot/{room_token}/message` with headers `OCS-APIRequest: true`, `X-Nextcloud-Talk-Bot-Random` (32 random bytes encoded as hex), and `X-Nextcloud-Talk-Bot-Signature` (`HMAC-SHA256(random + message, bot_secret)`).
  - **Chat API (Fallback)**: `POST {base_url}/ocs/v2.php/apps/spreed/api/v1/chat/{room_token}` with headers `OCS-APIRequest: true` and `Authorization: Basic <base64(username:app_password)>`.
- **Cloud Functions**:
  - The `eventCreated` and `eventUpdated` Firestore triggers invoke Nextcloud export alongside email notification delivery using independent error handling.
