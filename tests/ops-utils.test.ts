import test = require("node:test");
import assert = require("node:assert/strict");
import {
  applyActionItemUpdates,
  applyBulkActionItemUpdates,
  createActionItem,
  normalizeActionItems
} from "../lib/action-item-mutations";
import type { ActionItem } from "../lib/sample-data";
import {
  getOwnerOptions,
  getDailyLoad,
  getSuggestedEventGroupForWorkstream,
  getWorkstreamSummary,
  isBlockedItem,
  isItemDueSoon,
  matchesEventGroup,
  matchesSearchQuery,
  normalizeOwnerValue,
  syncActionItemIssue,
  syncActionItemStatus,
  syncActionItemWorkstream,
  syncEventGroupWithWorkstream,
  validateActionItemInput
} from "../lib/ops-utils";

function withMockedToday<T>(isoDateTime: string, callback: () => T) {
  const RealDate = Date;

  class MockDate extends Date {
    constructor(value?: string | number | Date) {
      super(value ?? isoDateTime);
    }

    static now() {
      return new RealDate(isoDateTime).getTime();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.Date = MockDate as any;

  try {
    return callback();
  } finally {
    globalThis.Date = RealDate;
  }
}

function createItem(overrides: Partial<ActionItem> = {}): ActionItem {
  return {
    id: "item-1",
    title: "Follow up with sponsor",
    type: "Task",
    workstream: "General Operations",
    dueDate: "2026-03-30",
    status: "Not Started",
    owner: "Melissa",
    waitingOn: "",
    lastUpdated: "2026-03-28",
    notes: "",
    ...overrides
  };
}

test("isItemDueSoon excludes blocked terminal dates and includes next three days", () => {
  withMockedToday("2026-03-28T00:00:00.000Z", () => {
    assert.equal(isItemDueSoon(createItem({ dueDate: "2026-03-30" })), true);
    assert.equal(isItemDueSoon(createItem({ dueDate: "2026-04-02" })), false);
    assert.equal(isItemDueSoon(createItem({ dueDate: "2026-03-27" })), false);
    assert.equal(isItemDueSoon(createItem({ dueDate: "2026-03-30", status: "Complete" })), false);
  });
});

test("isBlockedItem accepts either blocked flag or blockedBy text", () => {
  assert.equal(isBlockedItem(createItem({ blocked: true })), true);
  assert.equal(isBlockedItem(createItem({ blockedBy: "Vendor approval" })), true);
  assert.equal(isBlockedItem(createItem({ blocked: true, status: "Complete" })), false);
});

test("getDailyLoad groups only active due-dated items within the requested window", () => {
  withMockedToday("2026-03-28T00:00:00.000Z", () => {
    const load = getDailyLoad(
      [
        createItem({ id: "a", dueDate: "2026-03-28" }),
        createItem({ id: "b", dueDate: "2026-03-28", status: "Complete" }),
        createItem({ id: "c", dueDate: "2026-03-29" }),
        createItem({ id: "d", dueDate: "" }),
        createItem({ id: "e", dueDate: "2026-04-15" })
      ],
      3
    );

    assert.deepEqual(load, [
      { date: "2026-03-28", count: 1 },
      { date: "2026-03-29", count: 1 },
      { date: "2026-03-30", count: 0 }
    ]);
  });
});

test("getWorkstreamSummary returns workload rollups by workstream", () => {
  withMockedToday("2026-03-28T00:00:00.000Z", () => {
    const summary = getWorkstreamSummary([
      createItem({ id: "a", workstream: "Legislative Day", dueDate: "2026-03-27" }),
      createItem({ id: "b", workstream: "Legislative Day", dueDate: "2026-03-29", status: "In Progress" }),
      createItem({ id: "c", workstream: "General Operations", dueDate: "2026-04-10" }),
      createItem({ id: "d", workstream: "General Operations", status: "Complete" })
    ]);

    assert.deepEqual(summary[0], {
      workstream: "Legislative Day",
      total: 2,
      overdue: 1,
      dueSoon: 1,
      inProgress: 1
    });
  });
});

test("normalizeOwnerValue and event-group helpers keep canonical values stable", () => {
  assert.equal(normalizeOwnerValue("Jake"), "Governmental Affairs Chair");
  assert.equal(normalizeOwnerValue("External Sponsor Rep"), "External Sponsor Rep");
  assert.equal(normalizeOwnerValue("   External Sponsor Rep   "), "External Sponsor Rep");
  assert.deepEqual(getOwnerOptions("External Sponsor Rep"), [
    "External Sponsor Rep",
    "Melissa",
    "Crystelle",
    "Sitting President",
    "Governmental Affairs Chair",
    "External / TBD"
  ]);
  assert.equal(getSuggestedEventGroupForWorkstream("Best Pest Expo"), "Best Pest Expo");
  assert.equal(getSuggestedEventGroupForWorkstream("Unknown Bucket"), "General Operations");
  assert.equal(
    syncEventGroupWithWorkstream("Legislative Day", "Legislative Day", "Monday Mingle"),
    "Monday Mingle"
  );
  assert.equal(
    syncEventGroupWithWorkstream("Custom Group", "Legislative Day", "Monday Mingle"),
    "Custom Group"
  );
});

test("matchesEventGroup and matchesSearchQuery support grouped filtered views", () => {
  const item = createItem({
    eventGroup: "Monday Mingle",
    blockedBy: "Venue confirmation",
    notes: "Need final room layout"
  });

  assert.equal(matchesEventGroup(item, "Monday Mingle"), true);
  assert.equal(matchesEventGroup(item, "Legislative Day"), false);
  assert.equal(matchesSearchQuery(item, "venue"), true);
  assert.equal(matchesSearchQuery(item, "room layout"), true);
  assert.equal(matchesSearchQuery(item, "crystelle"), false);
});

test("shared item shaping and validation helpers align create and edit flows", () => {
  const base = createItem({
    type: "Deliverable",
    workstream: "Legislative Day",
    eventGroup: "Legislative Day",
    issue: "",
    dueDate: "2026-03-30",
    status: "Waiting",
    waitingOn: "Sponsor"
  });

  assert.equal(syncActionItemStatus(base, "In Progress").waitingOn, "");

  const syncedWorkstream = syncActionItemWorkstream(base, "Monday Mingle");
  assert.equal(syncedWorkstream.workstream, "Monday Mingle");
  assert.equal(syncedWorkstream.eventGroup, "Monday Mingle");

  const syncedIssue = syncActionItemIssue(
    {
      ...base,
      workstream: "General Operations",
      eventGroup: "General Operations",
      issue: "",
      dueDate: "2026-03-30"
    },
    "March 2026 Newsbrief"
  );
  assert.equal(syncedIssue.workstream, "Newsbrief");
  assert.equal(syncedIssue.eventGroup, undefined);
  assert.equal(syncedIssue.dueDate, "2026-03-20");

  const validation = validateActionItemInput({
    type: "Deliverable",
    title: "Monthly CEO Briefing",
    workstream: "Newsbrief",
    issue: "",
    dueDate: "",
    owner: "Melissa",
    status: "Not Started",
    waitingOn: ""
  });
  assert.equal(validation.issue, true);
  assert.equal(validation.dueDate, false);
  assert.equal(validation.isValid, false);
});

test("shared mutation helpers keep add update bulk and import shaping aligned", () => {
  const created = createActionItem({
    type: "Task",
    title: "Custom owner follow-up",
    workstream: "First Fridays",
    eventGroup: undefined,
    issue: undefined,
    dueDate: "2026-03-30",
    status: "Not Started",
    owner: "Unknown Owner",
    waitingOn: "",
    notes: ""
  });

  assert.match(created.id, /^custom-owner-follow-up-/);
  assert.equal(created.workstream, "First Friday");
  assert.equal(created.eventGroup, "First Friday");
  assert.equal(created.owner, "Unknown Owner");

  const updated = applyActionItemUpdates(created, {
    workstream: "First Fridays",
    owner: "Jake"
  });
  assert.equal(updated.workstream, "First Friday");
  assert.equal(updated.owner, "Governmental Affairs Chair");
  assert.match(updated.lastUpdated, /^\d{4}-\d{2}-\d{2}$/);

  const bulkUpdated = applyBulkActionItemUpdates(
    [created, createItem({ id: "item-2" })],
    [created.id],
    { owner: "president" }
  );
  assert.equal(bulkUpdated[0].owner, "Sitting President");
  assert.equal(bulkUpdated[1].owner, "Melissa");

  const normalized = normalizeActionItems([
    createItem({ workstream: "First Fridays", owner: "External Sponsor Rep" })
  ]);
  assert.equal(normalized[0].workstream, "First Friday");
  assert.equal(normalized[0].owner, "External Sponsor Rep");
});
