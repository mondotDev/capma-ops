# CAPMA Ops Hub

CAPMA Ops Hub is a local-first Next.js dashboard for managing CAPMA operational work and publication issue workflows.

## Current Model

`ActionItem` lives in [lib/sample-data.ts](/C:/Users/melis/Documents/git-repos/capma-ops/lib/sample-data.ts) and is the core app record. Important fields:

- `workstream`: primary operational lane
- `eventGroup`: lightweight grouping bucket used by Action View grouping and filters
- `issue`: optional publication issue link for `Newsbrief` and `The Voice`
- `blocked` / `blockedBy`: optional bottleneck tracking fields
- `owner`, `status`, `dueDate`, `waitingOn`, `notes`: operational state fields

## Persistence

- Local storage key: `capma-ops-state`
- Provider: [components/app-state.tsx](/C:/Users/melis/Documents/git-repos/capma-ops/components/app-state.tsx)
- Local state persists `items` plus publication `issueStatuses`

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
