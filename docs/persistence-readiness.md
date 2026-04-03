## Persistence Readiness Map

This repo is local-first today, but the next persistence refactor should not treat every code-backed value the same way.

### Native persisted entity data

These are real operational records and should be treated as first-class persisted entities:

- `ActionItem` records seeded from [`lib/planning-seed.json`](C:/Users/melis/Documents/git-repos/capma-ops/lib/planning-seed.json)
- `CollateralItem` records
- publication issue status state (`issueStatuses`)
- event instance records (`eventInstances`)
- event-instance sub-event records (`eventSubEvents`)
- collateral profile records keyed by event instance (`collateralProfiles`)
- small app session/preferences that already persist locally:
  - `activeEventInstanceId`
  - `defaultOwnerForNewItems`

For native action items specifically, the stable mutation semantics are now:

- `lastUpdated` changes only on a meaningful in-app mutation to the persisted record
- no-op UI commits should not change `lastUpdated`
- archive/restore are meaningful lifecycle mutations and do change `lastUpdated`
- view-only navigation, filtering, lens changes, and drawer open/close are not record mutations

### Real reference/config/schedule data

These are also real app data, but they are better understood as reference/config inputs than primary transactional records for the next persistence seam:

- event families and event programs/types in [`lib/event-instances.ts`](C:/Users/melis/Documents/git-repos/capma-ops/lib/event-instances.ts)
- collateral template packs/items/sub-events in [`lib/collateral-templates.ts`](C:/Users/melis/Documents/git-repos/capma-ops/lib/collateral-templates.ts)
- workstream schedule defaults in [`lib/ops-utils.ts`](C:/Users/melis/Documents/git-repos/capma-ops/lib/ops-utils.ts)
- publication templates in [`lib/publication-templates.ts`](C:/Users/melis/Documents/git-repos/capma-ops/lib/publication-templates.ts)

These may remain code-backed longer without blocking the next persistence abstraction, as long as the app treats them as reference inputs rather than mutable user-generated records.

### Transitional compatibility data

These still exist to keep imports and older records stable, but should not drive new persistence contracts:

- `ActionItem.eventGroup`
- `ActionItem.legacyEventGroupMigrated`
- `ActionItem.notes`
- `LEGACY_SAMPLE_ITEM_IDS`

They should remain supported during normalization/import, but new write paths should prefer:

- `eventInstanceId` for event-linked meaning
- `operationalBucket` for non-event meaning
- `noteEntries` for notes

### Demo-only helpers

No current seeded action-item data should be treated as disposable demo content.

The one thing that is demo/compatibility-oriented is the legacy-seed detection fallback (`LEGACY_SAMPLE_ITEM_IDS`), which exists only to recognize and replace outdated sample payloads during import normalization.
