# CAPMA Ops Hub

CAPMA Ops Hub is a local-first Next.js operations workspace for CAPMA planning, execution, publication issue tracking, and event collateral coordination.

## Current model

`ActionItem` in [`lib/sample-data.ts`](C:/Users/melis/Documents/git-repos/capma-ops/lib/sample-data.ts) is the core native work record. Important fields:

- `workstream`: primary operational lane
- `eventGroup`: legacy transitional grouping field
- `operationalBucket`: non-event operational classification
- `eventInstanceId`: concrete event occurrence linkage for event-based work
- `issue`: optional publication issue linkage for `News Brief` and `The Voice`
- `blockedBy`, `owner`, `status`, `dueDate`, `waitingOn`: core execution fields
- `lastUpdated`: last meaningful in-app mutation timestamp

## Source of truth

Native action items now have an explicit persistence mode:

- `NEXT_PUBLIC_NATIVE_ACTION_ITEM_STORE_MODE=firebase`
  Firestore is the source of truth for native action items in the flat `actionItems` collection.
- `NEXT_PUBLIC_NATIVE_ACTION_ITEM_STORE_MODE=local`
  Native action items stay on the legacy local path for explicit local-only development.

There is no silent fallback. If Firestore mode is selected and Firebase is unavailable or misconfigured, the app fails clearly instead of quietly writing native action items back to local storage.

Other app data remains local-first for now:

- publication issue statuses
- `activeEventInstanceId`
- workstream schedules

Collateral now has its own explicit persistence mode for the narrow persisted bundle:

- `NEXT_PUBLIC_COLLATERAL_STORE_MODE=firebase`
  Firestore is the source of truth for:
  - `collateralItems`
  - `eventInstances`
  - `eventSubEvents`
  - `collateralProfiles`
- `NEXT_PUBLIC_COLLATERAL_STORE_MODE=local`
  The persisted collateral bundle stays on the local path.

There is no silent fallback. If Firestore collateral mode is selected and the remote collateral bundle is missing, the app fails clearly and requires explicit bootstrap.

## Local app state and backup format

- Local storage key: `capma-ops-state`
- Provider: [`components/app-state.tsx`](C:/Users/melis/Documents/git-repos/capma-ops/components/app-state.tsx)
- Settings export/import still uses the full local snapshot for non-Firestore-backed app state

Settings export produces a JSON snapshot with:

- `version`
- `exportedAt`
- `items`
- `issueStatuses`

The import flow accepts both:

- current structured snapshots
- legacy item-array exports, which restore items and reset issue statuses

## Firebase setup

Create [`C:\Users\melis\Documents\git-repos\capma-ops\.env.local`](C:/Users/melis/Documents/git-repos/capma-ops/.env.local) from [`.env.example`](C:/Users/melis/Documents/git-repos/capma-ops/.env.example).

Required Firebase config:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_NATIVE_ACTION_ITEM_STORE_MODE`
- `NEXT_PUBLIC_COLLATERAL_STORE_MODE`

Optional dashboard flag:

- `NEXT_PUBLIC_FIREBASE_DASHBOARD_READS_ENABLED`

If the dashboard flag is missing or `false`, the dashboard stays on the existing local-first read path.

## Native action-item bootstrap import

The real CSV bootstrap path is documented in [`docs/native-action-item-bootstrap.md`](C:/Users/melis/Documents/git-repos/capma-ops/docs/native-action-item-bootstrap.md).

Use the admin script when you need to seed or rerun native action-item imports into Firestore:

- dry run:
  `npm run import:native-action-items -- --file "C:\Users\melis\Downloads\2026 CAPMA Planning - Kanban_Input.csv" --dry-run`
- write:
  `npm run import:native-action-items -- --file "C:\Users\melis\Downloads\2026 CAPMA Planning - Kanban_Input.csv" --write`

The script is idempotent by `Row_Link`-derived document id and updates only changed Firestore documents.

## Collateral Firestore bootstrap

Use the admin bootstrap path when you need to initialize the Firestore-backed collateral bundle from the current local app snapshot:

- dry run:
  `npm run bootstrap:collateral-state -- --dry-run`
- write:
  `npm run bootstrap:collateral-state -- --write`

This path writes only:

- `collateralItems`
- `eventInstances`
- `eventSubEvents`
- `collateralProfiles`

It does not write:

- `activeEventInstanceId`
- Action View collateral execution rows
- dashboard/read-model summaries
- publication issue state
- schedules/templates/reference config

Bootstrap is initialize-only:

- if the remote collateral bundle already exists, the script fails instead of overwriting it
- if Firestore collateral mode is selected and the bundle is missing, run this bootstrap first

## Commands

- `npm run dev`
- `npm run build`
- `npm run test`
- `npm run import:native-action-items -- --file "<path-to-csv>" --dry-run`
- `npm run bootstrap:collateral-state -- --dry-run`

## Architecture guardrails

- Read/write coherence policy: [`docs/read-write-coherence.md`](C:/Users/melis/Documents/git-repos/capma-ops/docs/read-write-coherence.md)
- Persistence readiness notes: [`docs/persistence-readiness.md`](C:/Users/melis/Documents/git-repos/capma-ops/docs/persistence-readiness.md)

