# Development environment

## Prerequisites

- **Node.js**: The project requires Node.js v20 (an `.nvmrc` is included if you use `nvm`, just run `nvm use`).
- **Firebase CLI**: Install the Firebase CLI globally using `npm install -g firebase-tools`. (See [Firebase CLI Docs](https://firebase.google.com/docs/cli)).

## Project Structure

This project is an npm workspace monorepo containing:

- `packages/frontend`: A web application built with Lit.
- `packages/backend`: A set of Firebase Functions written in TypeScript.

## Clone Git repository

```shell
git clone whatever:attendance-tracker
cd attendance-tracker
```

## Install npm modules

```shell
npm ci
```

## Local Development (Emulators)

To run the application locally without needing a live Firebase project, use the Firebase Emulators:

```shell
npm run dev
```

This will build both packages, start watch tasks, and boot up the Firebase Emulators.
You can then access:

- **Application**: <http://localhost:5002/beatles>
- **Emulator UI**: <http://localhost:4000>

**Local Login Flow**: Click "Logga in med Google". In the emulator widget, click "Add new account", select "Auto-generate user information", and click "Sign in".

## Set up Firebase Project

When you are ready to deploy to a live environment, login to Firebase:

```shell
firebase login
```

Set the current project to work with, and pick an alias for it (e.g., `staging` or `prod`):

```shell
firebase use --add
```

## Set up Email Extension

This project uses the `firestore-send-email` extension to handle email delivery.
To set this up for your project:

1. Go to the [Firebase Extensions Console](https://console.firebase.google.com/project/_/extensions).
2. Install the **Trigger Email from Firestore** (`firestore-send-email`) extension.
3. Configure it using your SMTP provider's details and set the appropriate mail collections (e.g. `mail`).

## Deployment

The project handles its own builds and target projects via npm scripts, allowing you to easily deploy to different environments. Example deployment commands include:

- `npm run deploy-staging`: Deploys the frontend to the staging alias.
- `npm run deploy-prod`: Deploys the frontend to the prod alias.

See the scripts in `package.json` for all options, and read more about multiple environments in the [Firebase documentation](https://firebase.google.com/docs/projects/multiprojects).
