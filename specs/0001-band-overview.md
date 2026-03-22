# Specification 0001: Band Overview

## Overview

The Band Overview page provides a central place to view basic information about the band and its members. Regular members are restricted to view-only access, while band admins have capabilities to edit the band's identity and correct member details.

## User Interaction

- **Navigation**:
  - The page is accessed via a link in the main navigation menu.
  - The default landing page of the application is the schedule.
- **Viewing**:
  - All users (admins and regular members) see the band's name, the band's logo, and a simple list of band members (displaying names only).
- **Editing (Admins Only)**:
  - Band admins can edit the band name, the band logo, and the names of the band members.
  - Editing happens in-place (inline) for a fluid user experience without navigating away or opening modal dialogs unless absolutely necessary.
  - Regular members do not see any edit controls.

## Functional Requirements

- A link to the Band Overview is available in the main navigation menu without changing the default route.
- The band name and band logo are displayed on the page.
- A list of band members is displayed, showing only their names.
- Inline editing UI controls for the band name, band logo, and member names are provided _only_ to users with the 'admin' role.
- Non-admin users are prevented from seeing editing user interface elements.
- Changes are persisted directly to Firestore when an admin finishes an inline edit.

## Technical Design

- **Firestore ACLs**: Security rules allow band admins to update the band document (for name and logo updates) as well as the member documents (specifically for updating member display names). Non-admin users have read-only access for these fields.
