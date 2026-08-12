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


## V5 UX pass
- Reduced dashboard density on mobile.
- Kept Today near the top as the main action surface.
- Removed the duplicate long Today block from Home.
- Quick Access now exposes the core 8 modules and progressively reveals the rest through More life areas.
- Increased glass transparency so the forest reference remains a visible part of the design.
- Refined mobile spacing, card proportions, touch targets and visual hierarchy.


## V6 — Data Foundation
The implementation phase has started.

- Versioned canonical Life Hub schema.
- IndexedDB as the primary local-first data store.
- Automatic migration from the V5 localStorage prototype.
- Stable IDs and timestamps for stored records.
- Relationship/link store for cross-module connections.
- Full-database JSON backup export.
- Settings now exposes database/model status.

Next implementation: connect real relationships between Goals, Projects, Tasks, Money, People, Wishlist and Calendar, then move Universal Search from the module index to canonical records.


## V7 — Relationships + Universal Search
- Universal Search now searches canonical IndexedDB records, not just module names.
- Search covers people, money, goals, projects, tasks, events, habits, wishlist, notes, journal, documents, assets, subscriptions, life plans and reminders.
- Search results route into the relevant Life Hub module.
- Added a relationship API for connecting any two canonical records.
- The link store is now ready for real UI relationship flows.

Next: build the actual core record workflows and relationship UI for Goals ↔ Projects ↔ Tasks, Wishlist ↔ Savings Goals ↔ Transactions, and People ↔ Events ↔ Notes.


## V8 — Core workflows + placeholder cleanup
- Removed demo-heavy module content from Goals, Tasks, Calendar, Notes, Wishlist, Money and People.
- Goals now have real records and an open/detail path.
- Added real Project creation connected to a Goal.
- Added real Task creation and completion persistence.
- Added real Event creation.
- Notes, Wishlist, Finance and People now present actual empty states instead of fabricated sample content.
- Universal Search continues to search canonical records.
- Relationship API is now used by the Goal → Project workflow.

Next: finish the relationship UI and add project → task → event chaining, then connect wishlist → savings goal → finance.


## V9 — Clean state + Reset All
- Removed hard-coded dashboard/sample values from the Home screen.
- Today, Coming Up and Life Pulse are now data-driven and remain empty until real records exist.
- Counts for money/goals/wishlist/people now start at zero.
- Added a prominent **Reset all Life Hub data** action in the More drawer and kept it in Settings.
- Reset clears IndexedDB + local browser state and reloads a clean Life Hub.


## V10 — Clean install enforcement
- Added one-time cleanup of known prototype/demo records.
- Preserves records that are not recognized as demo data.
- Service worker now removes previous Life Hub caches before serving V10.
- Script URLs are cache-busted to ensure the current Home markup and logic load.


## V11 — Batch core loop implementation
Implemented the next two connected workflows together:

### Goal → Project → Task → Event
- Create a Goal.
- Open the Goal.
- Create Projects inside the Goal.
- Create Tasks linked to the Goal/Project.
- Create Events linked to the Goal/Project/person.
- Complete/reopen tasks.
- Home Today and Coming Up pull from real tasks/events.

### Wishlist → Savings Goal → Purchase → Finance
- Create a Wishlist item.
- `Fund it` creates a Savings Goal and links it to the Wishlist item.
- `Purchase` records a real finance transaction and links it back to the Wishlist item.

Also batched:
- Real People creation + person detail + event linking.
- Real notes/journal creation.
- Real IndexedDB persistence for people/events/habits/projects.
- Search continues to use canonical records.
- Removed remaining sample values from the implemented core workflow screens.

Next milestone: richer project detail + relationship views, recurring money/subscriptions, and a proper Today command center.


## V12 — Save fix
- Removed the user-facing "Could not save data" toast on normal save paths.
- Direct record writes remain the authoritative save operation.
- Bulk persistence is now defensive and skips problematic legacy records instead of failing the whole operation.
- Exposed the generic IndexedDB `all()` helper for safe project hydration.
- Cache-busted scripts/service worker updated to V12.


## V13 — Full logic audit + fixes
Audited the data layer and core workflow controller before moving forward.

Fixed:
- `LifeDB.create()` was missing even though the UI called it.
- `search` was referenced before it was defined, which could abort the entire data layer.
- Project state hydration was inconsistent.
- Persistence was swallowing write errors; it now propagates real failures.
- Goal detail now remains open after creating a project/task/event.
- Back from a goal/person detail returns to its parent module instead of closing the entire page.
- Wishlist funding now prevents duplicate savings goals.
- Schema metadata bumped to application version 2.
- Script/service-worker cache-busting bumped to V13.


## V14 — Firebase Cloud Firestore
The custom IndexedDB application database has been removed from the active data layer.

### Backend
- Firebase project: `life-hub-50fa9`
- Cloud Firestore is authoritative.
- Firebase Anonymous Authentication is used for a per-browser/device identity.
- Firestore persistent local cache is enabled for offline work and sync when online.
- Data is scoped as `users/{uid}/{collection}/{documentId}`.

### Collections
people, accounts, transactions, goals, projects, tasks, events, habits, wishlist, notes, journal, documents, assets, subscriptions, routines, lifePlans, tags, reminders, links, meta.

### Important Firebase Console setup
Enable **Authentication → Sign-in method → Anonymous** for this project. The client config can be present in frontend code, but Firestore Security Rules must protect the `users/{uid}` hierarchy. Do not use an open `allow read, write: if true` rule for a real personal Life Hub.

Firebase's current web SDK recommends the modular API; this build uses the current browser-module CDN approach and Firestore's persistent local cache. citeturn324681search1turn324681search2turn852366search2


## V15 — Firebase diagnostics + secure rules

### Required Firebase Console setup
1. Firebase Console → Authentication → Sign-in method → **Anonymous** → Enable.
2. Firestore Database → create/enable the Firestore database.
3. Deploy `firestore.rules` from this project, or paste the rules into the Firestore Rules editor.
4. Reload the app.

### What the app now reports
Instead of the generic "Could not save", Firebase/Auth failures are surfaced as:
- Anonymous Authentication is disabled
- Firestore Rules denied this write
- Firebase authentication is not active
- Firebase temporarily unavailable
- Firebase config/network errors

### Data isolation
All data is stored below:
`users/{firebase-auth-uid}/{collection}/{document}`

The included rules only permit an authenticated user to read/write their own subtree.

Firebase's current documentation states that anonymous authentication must be enabled before `signInAnonymously` can succeed, and recommends rules that protect non-public user data. citeturn532007search0turn532007search11


## V16 — Firebase module-scope fix
- Fixed the `LifeDB is not defined` runtime error caused by `type="module"` script scope.
- All controller references now use `window.LifeDB`.
- Added an explicit data-layer load diagnostic.
- Bumped script/cache versions to V16.


## V17 — Full logic audit + Firebase module architecture fix

The save crash was traced to module/global scope plus Firebase bootstrap fragility.

### Fixed
- `data.js` now **exports** `LifeDB` and `LifeFirebase` as real ES module bindings.
- `script.js` now **imports** them instead of relying on `window` globals.
- The Firestore initialization path uses the standard Firestore client directly, avoiding a boot-time persistent-cache configuration failure as a dependency for saving.
- `LifeDB.create()` is verified before any save operation.
- Added `window.runLifeHubDiagnostics()` for browser-side diagnostics.
- Cache-busted all app modules to V17.
- Ran JavaScript syntax checks for both modules.
- Audited remaining `window.LifeDB` / `window.LifeFirebase` references and core API wiring.

### Browser diagnostic
Open DevTools Console and run:
`runLifeHubDiagnostics().then(console.table)`

This will show Firebase app/Auth/Firestore/Search/Backup/Reset readiness and authentication status.


## V18 — Batch Life OS implementation
Implemented the major connected Life Hub systems together:

### Home / attention
- Today pulls real open tasks and upcoming events.
- Attention summarizes current tasks, upcoming events and goal progress.
- Life Pulse is derived from actual records.

### Goals → Projects → Tasks → Events
- Goal detail shows project/task/event rollup.
- Project detail shows its parent goal, open/completed tasks and events.
- Tasks can link to goals/projects and be completed/reopened.
- Events can link to goals/projects/people.

### Wishlist → Savings Goal → Purchase → Finance
- Wishlist items can generate a savings goal.
- Wishlist purchases create real Firestore finance transactions.
- Purchase is linked back to the wishlist record.

### People
- Person records.
- Person detail.
- Person-linked events.

### Money
- Income/expense records.
- Recurring subscriptions.
- Assets and subscriptions module.

### Life memory
- Notes.
- Journal.
- Life Plan direction notes.

### Backend
- Firebase Cloud Firestore remains authoritative.
- Firebase Anonymous Authentication remains the identity layer.
- The app now uses real ES module imports/exports between the Firebase data layer and controller.

Next phase after V18: live Firestore listeners, proper user sign-in/linking, granular edit/delete flows, recurrence engine, notifications/reminders, and production-grade security review.
