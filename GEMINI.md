# Gemini Project Analysis

This document provides an overview of the project structure, technologies used, and conventions to follow.

## Project Structure

This is a monorepo using npm workspaces. The project is divided into two main packages:

-   `packages/frontend`: A web application.
-   `packages/backend`: A set of Firebase Functions.

## Backend

The backend is a set of Firebase Functions written in TypeScript.

-   **Framework**: Firebase Functions
-   **Language**: TypeScript
-   **Dependencies**: `firebase-admin`, `firebase-functions`
-   **Building**: The backend is built using `tsc`. The build command is `npm run build` in the `packages/backend` directory.
-   **Testing**: The backend uses `eslint` for linting.
-   **Deployment**: The backend is deployed as Firebase Functions. The deployment command is `firebase deploy --only functions`.

## Frontend

The frontend is a web application.

-   **Framework**: Lit
--  **UI Components**: Material Web Components (`@material/mwc-*`)
-   **Language**: TypeScript
-   **Building**: The frontend is built using `rollup` and `tsc`. The build command is `npm run build` in the `packages/frontend` directory.
-   **Testing**: The frontend uses `eslint` for linting and `prettier` for formatting.

## Testing

The project has a dedicated test suite in the `test` directory for testing Firestore security rules.

-   **Framework**: `mocha`
-   **Library**: `@firebase/rules-unit-testing`
-   **Execution**: The tests are run using the `npm test` command in the `test` directory.

## Deployment

The entire project is deployed to Firebase.

-   **Deployment Command**: `firebase deploy` from the root directory.
-   **Backend**: Deployed as Firebase Functions.
-   **Frontend**: Deployed to Firebase Hosting.

