# Life Hub — V2 Mobile Personal Life OS

This version follows the research direction more closely.

## What changed
- More visible forest/rain background with a readability overlay instead of almost blacking it out.
- Today is now a primary dashboard action, not something buried below many modules.
- Added a "Needs your attention" surface for pending actions and important things.
- Added global search across the Life Hub module universe.
- Kept the universal `+` quick-capture button for fast entry.
- Added connected-life visualization showing how Wishlist → Savings → Tasks → Calendar can relate.
- Added PWA manifest and a service worker for an installable/offline-capable shell.
- Preserved the mobile bottom navigation + drawer pattern so a large module set stays manageable.
- Kept localStorage for the prototype and JSON export.
- Added stronger separation between UI prototype and sensitive data storage.

## Run
Open the folder in VS Code and use Live Server. PWA/service-worker behavior works best from the Live Server URL.

## Important security boundary
This is still a frontend prototype. Do not store real passwords, banking credentials, recovery codes or other highly sensitive information. A production vault needs real encryption, authentication/WebAuthn, secure key handling, HTTPS, a server/data layer, backups and a tested threat model.

## Research-driven next architecture
1. IndexedDB as the offline source of truth.
2. Sync queue + conflict handling.
3. Authentication and encrypted server storage.
4. Search across every entity.
5. Real relationships between goals, tasks, finance, people, calendar and assets.
6. PWA install/offline support.
7. Calendar/cloud integrations.
8. AI insights only after privacy architecture is mature.
