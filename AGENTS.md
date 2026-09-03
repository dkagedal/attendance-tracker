# Project Overview & Guidelines

This document provides an overview of the project structure, technologies used, and conventions to follow.

## Project Structure

This is a monorepo using npm workspaces. The main directories are:

- `packages/frontend`: A web application built with Lit.
- `packages/backend`: A set of Firebase Functions written in TypeScript.
- `specs/`: Project specifications and data models.

## Backend

The backend is a set of Firebase Functions written in TypeScript.

- **Framework**: Firebase Functions
- **Runtime**: Node.js 22
- **Language**: TypeScript
- **Dependencies**: `firebase-admin`, `firebase-functions`
- **Building**: The backend is built using `tsc`. The build command is `npm run build -w backend`.
- **Testing**: The backend uses `eslint` for linting (`npm run lint -w backend`).
- **Deployment**: Deployed as Firebase Functions (e.g. `npm run deploy-prod-api` or `firebase deploy --only functions`).

## Frontend

The frontend is a web application.

- **Framework**: Lit
- **UI Components**: Custom App Components (`app-*`)
- **Project Structure**: Source code is in `src`. Web components are located in `src/components`.
- **Key Dependencies**: `marked` (Markdown rendering), `dompurify` (HTML sanitization)
- **Language**: TypeScript
- **Building**: The frontend is built using `rollup` and `tsc`. The build command is `npm run build -w frontend`.
- **Testing**: The frontend uses `eslint` for linting and `prettier` for formatting.

## Specifications

The `specs/` directory contains all written specifications for new features and data models.

- **CRITICAL**: ALWAYS read `specs/0000-how-to-write-specifications.md` before attempting to write or modify any specifications.
- **Data Model**: The current Firestore schema is defined in `specs/0002-firestore-data-model.md`. Check this file before making database changes.
- **Naming**: Specifications must follow the zero-padded 4-digit formatting (e.g., `0000-name.md`).

## Testing, Formatting & Linting

The project has automated testing for security rules and backend logic, as well as code formatting and linting.

- **Testing**:
  - Tests are located in `packages/backend/test/`.
  - Testing framework: `mocha` with `@firebase/rules-unit-testing`.
  - Execution: Run `npm test` from the root directory (which delegates to `npm run test -w backend`).
- **Formatting**:
  - The project uses Prettier for formatting. You **MUST** always run `npm run fmt` from the top-level directory before committing any changes.
- **Linting**:
  - Run `npm run lint` from the top-level directory to run ESLint across the codebase.

## Deployment

The entire project is deployed to Firebase. The project uses configuration swapping to point to the correct environment (live, test, or emulator).

- **Deployment Commands**:
  - `npm run deploy-prod`: Deploys the frontend to the production environment using the `live` configuration.
  - `npm run deploy-prod-api`: Builds the backend and deploys API functions to the production environment.
  - `npm run deploy-prod-all`: Builds frontend with `live` configuration and deploys everything to production.
  - `npm run deploy-prod-test`: Deploys the frontend to a preview channel (`test`) in the production project.
  - `npm run deploy-staging`: Deploys the frontend to staging using the `staging` configuration.
  - `npm run deploy-staging-api`: Builds the backend and deploys API functions to staging.
  - `npm run deploy-staging-all`: Deploys everything to staging.
- **Backend**: Deployed as Firebase Functions.
- **Frontend**: Deployed to Firebase Hosting.

## Local Development

To run the application locally with Firebase emulators:

1. Ensure you are running **Node 22**.
   - Verify your current Node version with: `node -v`
   - If using **nvm** (Node Version Manager), switch to the correct version by running `nvm use` in the root directory (which reads `.nvmrc`). If Node 22 is not yet installed on your system, run `nvm install` first.
2. If you are starting in a new clone or a separate worktree, run `npm ci` first to install dependencies and automatically initialize configuration files.
3. Run `npm run dev` in the root directory. This will:
   - Run an initial build of both packages.
   - Start `tsc:watch` and `rollup:watch` for both frontend and backend to auto-rebuild on file changes.
   - Start the Firebase emulators with imported test data and the `emulator` configuration injected via rollup.
4. Access the application at `http://localhost:5002/test`.
5. Access the Emulator UI at `http://localhost:4000`.

### Login Flow

The local environment uses the Firebase Auth Emulator.

1. When you first load the app, you will see a "Välkommen" login dialog.
2. Click **"Logga in med Google"**.
   - **Note:** This button opens the "Auth Emulator IDP Login Widget" (usually at `http://localhost:9099/...`).
   - If nothing happens, ensure popups are allowed or check if the widget opened in a background tab/window.
3. In the emulator widget:
   - Click **"Add new account"**.
   - Click **"Auto-generate user information"**.
   - Click **"Sign in with Google.com"**.
4. You should be redirected back to the app and logged in.

### Known Quirks & Notes

- **Login Dialog:** The login dialog is modal and cannot be dismissed by clicking outside it. You _must_ log in to use the app.
- **"Logga ut" Visibility:** The "Logga ut" (Log out) option in the avatar menu is **always visible**, even if you are not logged in.
- **Verifying Login:** The best way to verify you are logged in is if the "Välkommen" login dialog is **not** visible.
