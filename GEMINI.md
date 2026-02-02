# Gemini Project Analysis

This document provides an overview of the project structure, technologies used, and conventions to follow.

## Project Structure

This is a monorepo using npm workspaces. The project is divided into two main packages:

-   `packages/frontend`: A web application.
-   `packages/backend`: A set of Firebase Functions.

## Backend

The backend is a set of Firebase Functions written in TypeScript.

-   **Framework**: Firebase Functions
-   **Runtime**: Node.js 20
-   **Language**: TypeScript
-   **Dependencies**: `firebase-admin`, `firebase-functions`
-   **Building**: The backend is built using `tsc`. The build command is `npm run build` in the `packages/backend` directory.
-   **Testing**: The backend uses `eslint` for linting.
-   **Deployment**: The backend is deployed as Firebase Functions. The deployment command is `firebase deploy --only functions`.

## Frontend

The frontend is a web application.

-   **Framework**: Lit
-   **UI Components**: Custom App Components (`app-*`)
-   **Project Structure**: Source code is in `src`. Web components are located in `src/components`.
-   **Key Dependencies**: `marked` (Markdown rendering), `dompurify` (HTML sanitization)
-   **Language**: TypeScript
-   **Building**: The frontend is built using `rollup` and `tsc`. The build command is `npm run build` in the `packages/frontend` directory.
-   **Testing**: The frontend uses `eslint` for linting and `prettier` for formatting.

## Testing

The project has a dedicated test suite in the `test` directory for testing Firestore security rules.

-   **Framework**: `mocha`
-   **Library**: `@firebase/rules-unit-testing`
-   **Execution**: The tests are run using the `npm test` command in the `test` directory.

## Deployment

The entire project is deployed to Firebase. The project uses configuration swapping to point to the correct environment (live, test, or emulator).

-   **Deployment Commands**:
    -   `npm run deploy-live`: Deploys to partial hosting (Live environment) with `config-live.ts`.
    -   `npm run deploy-test`: Deploys to a preview channel (Test environment) with `config-test.ts`.
    -   `npm run deploy-all`: Deploys everything (including functions) with `config-live.ts`.
    -   `npm run deploy-staging`: Deploys everything (including functions) with `config-staging.ts`.
-   **Backend**: Deployed as Firebase Functions.
-   **Frontend**: Deployed to Firebase Hosting.


## Local Development

To run the application locally with Firebase emulators:

1.  Run `npm run dev` in the root directory. This will:
    -   Symlink `packages/frontend/src/config-emulator.ts` to `config.ts`.
    -   Build both packages.
    -   Start the Firebase emulators with imported test data.
2.  Access the application at `http://localhost:5002/beatles`.
3.  Access the Emulator UI at `http://localhost:4000`.

### Login Flow

The local environment uses the Firebase Auth Emulator.

1.  When you first load the app, you will see a "Välkommen" login dialog.
2.  Click **"Logga in med Google"**.
    *   **Note:** This button opens the "Auth Emulator IDP Login Widget" (usually at `http://localhost:9099/...`).
    *   If nothing happens, ensure popups are allowed or check if the widget opened in a background tab/window.
3.  In the emulator widget:
    *   Click **"Add new account"**.
    *   Click **"Auto-generate user information"**.
    *   Click **"Sign in with Google.com"**.
4.  You should be redirected back to the app and logged in.

### Known Quirks & Notes

*   **Login Dialog:** The login dialog is modal and cannot be dismissed by clicking outside it. You *must* log in to use the app.
*   **"Logga ut" Visibility:** The "Logga ut" (Log out) option in the avatar menu is **always visible**, even if you are not logged in.
*   **Verifying Login:** The best way to verify you are logged in is if the "Välkommen" login dialog is **not** visible.
