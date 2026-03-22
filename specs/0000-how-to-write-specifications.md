# Specification 0000: How to Write Specifications

## Overview

This document defines the standard format and process for creating new feature specifications in this repository. The goal of a specification is to clearly define what a feature should do, how users will interact with it, and functionally how it operates from a high level.

**Crucial Note:** A specification must be written as a description of the feature in its final, completed state. Do not formulate it as a list of action items or a work order. For example, write "The rules allow admins to edit...", not "The rules must be updated to allow...".

## User Interaction

Specifications should always start by focusing on the user. Describe the feature from the user's perspective.

- Step-by-step description of how the user will interact with the feature.
- What do they see?
- What actions can they take?
- What are the outcomes of those actions?

## Functional Requirements

Clear, testable requirements defining what the feature must do. This shouldn't be too implementation-specific, but rather what the system as a whole must guarantee. Use bullet points for easy reading.

## Technical Design (Optional)

This section is optional but recommended for more complex features. It can include:

- High-level technical approach.
- Proposed data models (e.g., Firestore schema).
- API endpoints or Firebase Functions required.
- Any architectural diagrams or specific constraints.

## Naming Convention

Specifications should be placed in the `specs/` directory at the project root.
They should be named with a 4-digit zero-padded number followed by a hyphen-separated description:
e.g., `0001-user-login-flow.md`

## Review Process

All specifications must be reviewed and approved before implementation begins.
