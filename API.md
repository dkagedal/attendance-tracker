# Events REST API Documentation

The backend provides a REST API to manage events for a specific band. This is useful for integrating scripts or external applications with the Attendance Tracker.

## Base URL

When running locally:
```text
http://localhost:5001/<project-id>/<region>/api
```

When deployed to Firebase:
```text
https://<region>-<project-id>.cloudfunctions.net/api
```

## Authentication

All API endpoints require authentication using either a standard **Firebase Auth ID Token** or a **Custom API Token**. The token must belong to a user who is a registered member of the band they are trying to manage events for.

You must include this token in the `Authorization` header of your requests:
```text
Authorization: Bearer <TOKEN>
```

### Custom API Tokens

You can generate Custom API Tokens in the web application by navigating to the **API-nycklar** section in your profile menu. These tokens are permanent until deleted and can be configured with **Read/Write** or **Read-Only** permissions. Read-Only tokens are strictly limited to `GET` requests; attempting to use them for `POST`, `PUT`, or `DELETE` will result in a `403 Forbidden` error.

> [!IMPORTANT]
> The API will reject the request with `403 Forbidden` if the authenticated user is not a member of the requested `bandId`.

## Endpoints

### 1. List User's Bands
**`GET /users/me/bands`**

Retrieves a list of bands the authenticated user is a member of.

**Response:**
Returns a JSON object mapping band IDs to basic band information.
```json
{
  "bandId1": {
    "display_name": "My Band"
  },
  "bandId2": { ... }
}
```

---

### 2. List All Events
**`GET /bands/:bandId/events`**

Retrieves a list of all events for the specified band.

**Response:**
Returns a JSON object mapping event IDs to event objects.
```json
{
  "eventId1": {
    "type": "rehearsal",
    "start": "2026-05-10T19:00:00Z",
    "location": "Main Hall"
  },
  "eventId2": { ... }
}
```

---

### 3. Get a Single Event
**`GET /bands/:bandId/events/:eventId`**

Retrieves the details of a specific event.

**Response:**
Returns the event object including its `id`.
```json
{
  "id": "eventId1",
  "type": "rehearsal",
  "start": "2026-05-10T19:00:00Z",
  "location": "Main Hall"
}
```

---

### 4. Create a New Event
**`POST /bands/:bandId/events`**

Creates a new event for the specified band.

**Request Body:**
Expects a JSON payload representing the event. `type` and `start` are required fields.
```json
{
  "type": "gig",
  "start": "2026-06-15T20:00:00Z",
  "stop": "2026-06-15T23:00:00Z",
  "location": "City Square",
  "description": "Summer festival performance"
}
```

**Response:** `201 Created`
Returns the created event object including its generated `id`.

---

### 5. Update an Event
**`PUT /bands/:bandId/events/:eventId`**

Updates an existing event. This performs a partial update (merge) on the existing document.

**Request Body:**
Expects a JSON payload with the fields you wish to update.
```json
{
  "location": "New Venue",
  "cancelled": true
}
```

**Response:** `200 OK`
Returns the updated event object.

---

### 6. Delete an Event
**`DELETE /bands/:bandId/events/:eventId`**

Deletes the specified event from the band.

**Response:** `204 No Content`

## Event Data Model

The `BandEvent` object has the following structure:

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `type` | string | **Yes** | The type of event (e.g., "rehearsal", "gig"). |
| `start` | string | **Yes** | ISO 8601 timestamp for when the event starts. |
| `stop` | string | No | ISO 8601 timestamp for when the event ends. |
| `location`| string | No | Venue name or address. |
| `description`| string| No | Description of the event. |
| `cancelled`| boolean | No | Set to true if the event is cancelled. |
