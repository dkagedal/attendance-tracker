# Specification 0002: Firestore Data Model

## Overview

This document defines the current Firestore data model used in the application.

## Data Model

The database is structured as follows:

* `/bands/{bandId}`: Represents a band.
  * `display_name`: (string) Human-readable name of the band.
  * `logo`: (optional, string) URL to the band's logo.
  * `/bands/{bandId}/events/{eventId}`: Sub-collection of events for the band.
    * `type`: (string) The type of event (e.g., "rehearsal", "gig").
    * `start`: (string) ISO 8601 timestamp for when the event starts.
    * `stop`: (optional, string) ISO 8601 timestamp for when the event ends.
    * `location`: (optional, string) Venue name or address.
    * `description`: (optional, string) Description of the event.
    * `cancelled`: (optional, boolean) Set to true if the event is cancelled.
    * `/bands/{bandId}/events/{eventId}/participants/{uid}`: Sub-collection of participants for the event.
      * `attending`: (string) The user's response: "yes", "no", "sub", or "na".
      * `comment`: (optional, string) A comment from the user.
  * `/bands/{bandId}/members/{uid}`: Sub-collection of members in the band.
    * `display_name`: (string) The user's display name within the context of this band.
    * `admin`: (boolean) True if the user is an administrator for the band.
    * `/bands/{bandId}/members/{uid}/private/settings`: Private settings for the member.
      * `email`: (string) The user's email address.
      * `notify`: (map) Notification preferences.
        * `new_event`: (boolean)
        * `new_join_request`: (boolean)
        * `new_member`: (boolean)
  * `/bands/{bandId}/join_requests/{uid}`: Sub-collection of requests to join the band.
    * `display_name`: (string) The display name of the user requesting to join.
    * `url`: (string) The URL from which the join request was made.
    * `approved`: (boolean) Whether the request has been approved.
* `/users/{uid}`: Represents a user account.
  * `bands`: (map) A map of band IDs to band information that the user is a member of.
    * `{bandId}`: (map)
      * `display_name`: (string) The display name of the band.
* `/hosts/{hostname}`: Represents a custom hostname.
