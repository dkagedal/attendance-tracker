# Development environment

## Nix

The instructions here assume you will be using Nix to set up the environment, using the included `shell.nix` file.

Read more at https://nixos.org/ or just install it with

```
$ curl -L https://nixos.org/nix/install | sh -s -- --daemon
```

## Clone Git repository

```
$ git clone whatever:attendance-tracker
$ cd attendance-tracker
```

## Enter the Nix environment

```
$ nix-shell
```

If you want to install dependencies yourself, check the `shell.nix` file for details.

## Install npm modules

```
$ npm ci
```

Note that in Nix, you typically don't use the `-g` flag too `npm install`.

## Set up Firebase

Login to Firebase (if not already logged in):

```
$ firebase login
```

Make sure you have a Firebase project to work with, created in the Firebase console.

Set the current project to work with, and pick an alias for it:

```
$ firebase use --add
```

## Build functions

```
$ cd functions
$ npm ci
$ npm run build
$ cd ..
```

TODO: make this part of top-level build.

## Run locally

For testing:

```
$ npm run serve
```

To upload:

```
$ firebase deploy
```

See https://firebase.google.com/docs/hosting/deploying tolearn more about how to deploy the app.

## Database schema

The database is structured as follows:

*   `/bands/{bandId}`: Represents a band.
    *   `display_name`: (string) Human-readable name of the band.
    *   `/bands/{bandId}/events/{eventId}`: Sub-collection of events for the band.
        *   `type`: (string) The type of event (e.g., "rehearsal", "gig").
        *   `start`: (string) ISO 8601 timestamp for when the event starts.
        *   `stop`: (optional, string) ISO 8601 timestamp for when the event ends.
        *   `location`: (optional, string) Venue name or address.
        *   `description`: (optional, string) Description of the event.
        *   `cancelled`: (optional, boolean) Set to true if the event is cancelled.
        *   `/bands/{bandId}/events/{eventId}/participants/{uid}`: Sub-collection of participants for the event.
            *   `attending`: (string) The user's response: "yes", "no", "sub", or "na".
            *   `comment`: (optional, string) A comment from the user.
    *   `/bands/{bandId}/members/{uid}`: Sub-collection of members in the band.
        *   `display_name`: (string) The user's display name within the context of this band.
        *   `admin`: (boolean) True if the user is an administrator for the band.
        *   `/bands/{bandId}/members/{uid}/private/settings`: Private settings for the member.
            *   `email`: (string) The user's email address.
            *   `notify`: (map) Notification preferences.
                *   `new_event`: (boolean)
                *   `new_join_request`: (boolean)
                *   `new_member`: (boolean)
    *   `/bands/{bandId}/join_requests/{uid}`: Sub-collection of requests to join the band.
        *   `display_name`: (string) The display name of the user requesting to join.
        *   `url`: (string) The URL from which the join request was made.
        *   `approved`: (boolean) Whether the request has been approved.
*   `/users/{uid}`: Represents a user account.
    *   `bands`: (map) A map of band IDs to band information that the user is a member of.
        *   `{bandId}`: (map)
            *   `display_name`: (string) The display name of the band.
