# Native Action-Item Bootstrap

This repo uses Firestore as the primary persistence mode for native action items when:

- `NEXT_PUBLIC_NATIVE_ACTION_ITEM_STORE_MODE=firebase`

The Firestore collection is:

- `actionItems`

## Source of truth

After bootstrap, Firestore is the source of truth for native action items.

The CSV import is an explicit admin/bootstrap tool:

- it is not part of runtime app behavior
- it does not create spreadsheet-backed runtime dependencies
- it does not silently fall back to local browser state

## Required local setup

Create [`C:\Users\melis\Documents\git-repos\capma-ops\.env.local`](C:/Users/melis/Documents/git-repos/capma-ops/.env.local) with:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_NATIVE_ACTION_ITEM_STORE_MODE=firebase`

## Import script

The bootstrap script lives at [`scripts/import-native-action-items.ts`](C:/Users/melis/Documents/git-repos/capma-ops/scripts/import-native-action-items.ts).

Run a dry run first:

```powershell
npm run import:native-action-items -- --file "C:\Users\melis\Downloads\2026 CAPMA Planning - Kanban_Input.csv" --dry-run
```

Then write to Firestore:

```powershell
npm run import:native-action-items -- --file "C:\Users\melis\Downloads\2026 CAPMA Planning - Kanban_Input.csv" --write
```

Git Bash form:

```bash
npm run import:native-action-items -- --file "/c/Users/melis/Downloads/2026 CAPMA Planning - Kanban_Input.csv" --dry-run
npm run import:native-action-items -- --file "/c/Users/melis/Downloads/2026 CAPMA Planning - Kanban_Input.csv" --write
```

## Mapping and repeat-run behavior

- rows import only when `Task` is present
- `Row_Link` is the stable bootstrap source identifier
- Firestore document ids are derived from `Row_Link`
- reruns are idempotent upserts
- unchanged documents are skipped
- only changed mapped documents are written

## Current CSV mapping assumptions

- `Task` -> `title`
- `Status (Auto)` -> canonical action-item `status`
- `Due Date` -> `dueDate`
- `Linked Event` -> mapped workstream and, where applicable, event linkage or operational bucket
- `Notes`, `Vendor Deadline`, and `Print_Deadline` -> imported note entries
- `lastUpdated` is set during import because the CSV does not contain a trustworthy in-app mutation timestamp

## What this does not migrate

- collateral items
- issue-status state
- event/reference/config/schedule data
- auth or permissions
- listeners or sync behavior
