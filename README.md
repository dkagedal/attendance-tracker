# Development environment

## Clone Git repository

```shell
git clone whatever:attendance-tracker
cd attendance-tracker
```

## Install npm modules

```shell
npm ci
```

## Set up Firebase

Login to Firebase (if not already logged in):

```shell
firebase login
```

Make sure you have a Firebase project to work with, created in the Firebase console.

Set the current project to work with, and pick an alias for it:

```shell
firebase use --add
```

## Set up Email Extension

This project uses the `firestore-send-email` extension to handle email delivery. 
To set this up for your project:
1. Go to the [Firebase Extensions Console](https://console.firebase.google.com/project/_/extensions).
2. Install the **Trigger Email from Firestore** (`firestore-send-email`) extension.
3. Configure it using your SMTP provider's details and set the appropriate mail collections (e.g. `mail`).

## Build functions

```shell
npm -w backend run build
```

## Run locally

For testing:

```shell
npm run serve
```

To upload:

```shell
firebase deploy
```

See <https://firebase.google.com/docs/hosting/deploying> tolearn more about how to deploy the app.


