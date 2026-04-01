# CAPMA Ops Hub

CAPMA Ops Hub is a local-first Next.js dashboard for managing CAPMA operational work and publication issue workflows.

## Current Model

`ActionItem` lives in [lib/sample-data.ts](/C:/dev/capma-ops/lib/sample-data.ts) and is the core app record. Important fields:

- `workstream`: primary operational lane
- `eventGroup`: legacy transitional grouping field
- `operationalBucket`: non-event operational classification for ongoing work
- `eventInstanceId`: concrete event occurrence linkage for event-based work
- `issue`: optional publication issue link for `Newsbrief` and `The Voice`
- `blockedBy`, `owner`, `status`, `dueDate`, `waitingOn`: core operational state fields

## Persistence

- Local storage key: `capma-ops-state`
- Provider: [components/app-state.tsx](/C:/dev/capma-ops/components/app-state.tsx)
- Local state persists items, publication issue statuses, collateral state, event state, and schedules

## Backup Format

Settings export produces a JSON snapshot with:

- `version`
- `exportedAt`
- `items`
- `issueStatuses`

The import flow accepts both:

- current structured snapshots
- legacy item-array exports, which restore items and reset issue statuses

## Commands

- `npm run dev`
- `npm run build`
- `npm run test`

## Firebase dashboard reads

Create a local `C:\dev\capma-ops\.env.local` with the `NEXT_PUBLIC_FIREBASE_*` values from [`.env.example`](C:\dev\capma-ops\.env.example).

Required for the current narrow Firebase slice:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_DASHBOARD_READS_ENABLED`

If the config is missing or `NEXT_PUBLIC_FIREBASE_DASHBOARD_READS_ENABLED=false`, the app stays on the existing local-first dashboard path.

## Firebase boundary

Dashboard is intentionally the only Firebase-backed read slice right now. Action View, Collateral, Settings, and all writes stay local-first until the app has an explicit read/write coherence policy for mutation-heavy screens. See [docs/firebase-read-slices.md](/C:/dev/capma-ops/docs/firebase-read-slices.md).


## Architecture Guardrails

- Read/write coherence policy for work surfaces: [docs/read-write-coherence.md](/C:/dev/capma-ops/docs/read-write-coherence.md)

