import test from "node:test";
import assert from "node:assert/strict";
import {
  applyActionItemUpdates,
  applyBulkActionItemUpdates,
  createActionItem,
  normalizeActionItems
} from "../lib/action-item-mutations";
import {
  isCollateralDueSoon,
  isCollateralOverdue,
  normalizeCollateralItem,
  normalizeCollateralWorkflowStatus,
  type CollateralItem
} from "../lib/collateral-data";
import {
  completePublicationIssue,
  openPublicationIssue,
  setPublicationIssueStatus
} from "../lib/publication-issue-actions";
import { parseImportedAppState } from "../lib/app-transfer";
import type { ActionItem } from "../lib/sample-data";
import {
  getVisibleActionItems,
} from "../lib/action-view-utils";
import {
  matchesActionLens,
  matchesActionFilter,
  createActionNoteEntry,
  getImmediateRiskPreview,
  getDashboardMetrics,
  getDefaultWorkstreamSchedules,
  getOwnerOptions,
  getDailyLoad,
  getGeneratedIssues,
  getSuggestedEventGroupForWorkstream,
  getWorkstreamDateContext,
  getWorkstreamSummary,
  isBlockedItem,
  isItemDueSoon,
  isTerminalStatus,
  matchesEventGroup,
  daysSince,
  matchesSearchQuery,
  normalizeOwnerValue,
  normalizeWorkstreamSchedules,
  normalizeActionItemFields,
  syncActionItemIssue,
  syncActionItemStatus,
  syncActionItemWorkstream,
  syncEventGroupWithWorkstream,
  validateActionItemInput
} from "../lib/ops-utils";
import { normalizeActionWorkflowStatus } from "../lib/workflow-status";

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
    noteEntries: [],
    ...overrides
  };
}

function createCollateralItem(overrides: Partial<CollateralItem> = {}): CollateralItem {
  return {
    id: "collateral-1",
    eventInstanceId: "legislative-day-2026",
    subEventId: "leg-day-legislative-visits",
    itemName: "Leave-behind",
    status: "Backlog",
    owner: "Melissa",
    blockedBy: "",
    dueDate: "2026-03-30",
    printer: "CAPMA",
    quantity: "100",
    updateType: "Full Redesign",
    notes: "",
    lastUpdated: "2026-03-28",
    ...overrides
  };
}

test("isItemDueSoon excludes blocked terminal dates and includes next three days", () => {
  withMockedToday("2026-03-28T00:00:00.000Z", () => {
    assert.equal(isItemDueSoon(createItem({ dueDate: "2026-03-30" })), true);
    assert.equal(isItemDueSoon(createItem({ dueDate: "2026-04-02" })), false);
    assert.equal(isItemDueSoon(createItem({ dueDate: "2026-03-27" })), false);
    assert.equal(isItemDueSoon(createItem({ dueDate: "2026-03-30", status: "Complete" })), false);
    assert.equal(isItemDueSoon(createItem({ dueDate: "2026-03-30", status: "Canceled" })), false);
  });
});

test("isBlockedItem accepts either blocked flag or blockedBy text", () => {
  assert.equal(isBlockedItem(createItem({ isBlocked: true })), true);
  assert.equal(isBlockedItem(createItem({ blockedBy: "Vendor approval" })), true);
  assert.equal(isBlockedItem(createItem({ isBlocked: true, status: "Complete" })), false);
  assert.equal(isBlockedItem(createItem({ isBlocked: true, status: "Canceled" })), false);
  assert.equal(isBlockedItem({ ...createItem(), blocked: true }), true);
});

test("getDailyLoad groups only active due-dated items within the requested window", () => {
  withMockedToday("2026-03-28T00:00:00.000Z", () => {
    const load = getDailyLoad(
      [
        createItem({ id: "a", dueDate: "2026-03-28" }),
        createItem({ id: "b", dueDate: "2026-03-28", status: "Complete" }),
        createItem({ id: "b2", dueDate: "2026-03-28", status: "Canceled" }),
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

test("workflow status normalization keeps module-specific statuses mappable", () => {
  assert.equal(normalizeActionWorkflowStatus("Waiting"), "waiting");
  assert.equal(normalizeActionWorkflowStatus("Canceled"), "canceled");
  assert.equal(normalizeCollateralWorkflowStatus("Ready for Print"), "ready");
  assert.equal(normalizeCollateralWorkflowStatus("Cut"), "cut");
});

test("collateral deadline helpers ignore terminal records and respect printer deadlines", () => {
  withMockedToday("2026-03-28T00:00:00.000Z", () => {
    assert.equal(isCollateralDueSoon(createCollateralItem({ dueDate: "2026-03-30" })), true);
    assert.equal(isCollateralOverdue(createCollateralItem({ dueDate: "2026-03-27" })), true);
    assert.equal(isCollateralDueSoon(createCollateralItem({ dueDate: "2026-03-30", status: "Complete" })), false);
    assert.equal(isCollateralOverdue(createCollateralItem({ dueDate: "2026-03-27", status: "Cut" })), false);
  });
});

test("legacy imports restore action items without silently seeding collateral records", () => {
  const parsed = parseImportedAppState([createItem()]);

  assert.ok(parsed);
  assert.equal(parsed.usedLegacyFormat, true);
  assert.equal(parsed.items.length, 1);
  assert.deepEqual(parsed.collateralItems, []);
});

test("normalizeCollateralItem preserves template origin metadata", () => {
  const normalized = normalizeCollateralItem({
    ...createCollateralItem(),
    templateOriginId: "legislative-template-item"
  });

  assert.ok(normalized);
  assert.equal(normalized?.templateOriginId, "legislative-template-item");
});

test("normalizeWorkstreamSchedules preserves defaults and sorts multiple dates", () => {
  const schedules = normalizeWorkstreamSchedules([
    {
      workstream: "Pest Ed",
      mode: "multiple",
      dates: ["2026-08-12", "2026-05-02", "2026-05-02"]
    }
  ]);

  const pestEd = schedules.find((entry) => entry.workstream === "Pest Ed");
  const firstFriday = schedules.find((entry) => entry.workstream === "First Friday");

  assert.deepEqual(pestEd, {
    workstream: "Pest Ed",
    mode: "multiple",
    dates: ["2026-05-02", "2026-08-12"]
  });
  assert.equal(firstFriday?.mode, "multiple");
});

test("getWorkstreamDateContext uses schedules for event workstreams and issues for publications", () => {
  withMockedToday("2026-03-28T00:00:00.000Z", () => {
    const schedules = normalizeWorkstreamSchedules([
      {
        workstream: "Legislative Day",
        mode: "range",
        startDate: "2026-04-21",
        endDate: "2026-04-23"
      }
    ]);
    const issues = getGeneratedIssues({});

    assert.deepEqual(getWorkstreamDateContext("Legislative Day", schedules, issues), {
      dateText: "Apr 21 - Apr 23",
      countdownText: "24 days out"
    });

    assert.deepEqual(getWorkstreamDateContext("First Friday", getDefaultWorkstreamSchedules(), issues), {
      dateText: "Next: May 1",
      countdownText: "34 days out"
    });

    assert.deepEqual(getWorkstreamDateContext("Newsbrief", schedules, issues), {
      dateText: "Apr 30",
      countdownText: "33 days out"
    });

    assert.equal(getWorkstreamDateContext("General Operations", schedules, issues), null);
  });
});

test("getWorkstreamDateContext keeps range schedules visible while the event is in progress", () => {
  withMockedToday("2026-04-22T00:00:00.000Z", () => {
    const schedules = normalizeWorkstreamSchedules([
      {
        workstream: "Legislative Day",
        mode: "range",
        startDate: "2026-04-21",
        endDate: "2026-04-23"
      }
    ]);

    assert.deepEqual(getWorkstreamDateContext("Legislative Day", schedules, getGeneratedIssues({})), {
      dateText: "Apr 21 - Apr 23",
      countdownText: "today"
    });
  });

  withMockedToday("2026-04-24T00:00:00.000Z", () => {
    const schedules = normalizeWorkstreamSchedules([
      {
        workstream: "Legislative Day",
        mode: "range",
        startDate: "2026-04-21",
        endDate: "2026-04-23"
      }
    ]);

    assert.equal(getWorkstreamDateContext("Legislative Day", schedules, getGeneratedIssues({})), null);
  });
});

test("getDashboardMetrics separates immediate risk from unblocking counts", () => {
  withMockedToday("2026-03-28T00:00:00.000Z", () => {
    const metrics = getDashboardMetrics([
      createItem({
        id: "blocked-overdue",
        dueDate: "2026-03-27",
        status: "Not Started",
        isBlocked: true,
        blockedBy: "Internal"
      }),
      createItem({
        id: "waiting-due-soon",
        dueDate: "2026-03-29",
        status: "Waiting",
        waitingOn: "External"
      }),
      createItem({
        id: "mixed-unspecified",
        dueDate: "2026-03-30",
        status: "Waiting",
        waitingOn: "",
        isBlocked: true,
        blockedBy: ""
      }),
      createItem({
        id: "mixed-shared-reason",
        dueDate: "2026-04-08",
        status: "Waiting",
        waitingOn: "Internal",
        isBlocked: true,
        blockedBy: "Internal"
      }),
      createItem({
        id: "terminal-stuck",
        dueDate: "2026-03-28",
        status: "Canceled",
        waitingOn: "External",
        isBlocked: true,
        blockedBy: "External"
      })
    ]);

    assert.equal(metrics.blockedCount, 3);
    assert.equal(metrics.waiting, 1);
    assert.equal(metrics.peakUpcomingLoadCount, 2);
    assert.equal(metrics.peakUpcomingLoadDate, "2026-03-30");
    assert.deepEqual(metrics.stuckReasonCounts, [
      { label: "Internal", count: 2, source: "mixed" },
      { label: "External", count: 1, source: "waiting" },
      { label: "Unspecified", count: 1, source: "mixed" }
    ]);
  });
});

test("getImmediateRiskPreview separates title from time-risk meta", () => {
  withMockedToday("2026-03-28T00:00:00.000Z", () => {
    assert.deepEqual(
      getImmediateRiskPreview(
        createItem({
          title: "Door Prize",
          workstream: "Legislative Day",
          dueDate: "2026-03-26",
          status: "Waiting",
          waitingOn: "External"
        })
      ),
      {
        title: "Door Prize",
        meta: "Overdue 2d - due Mar 26 - Legislative Day"
      }
    );

    assert.deepEqual(
      getImmediateRiskPreview(
        createItem({
          title: "County Ag offices list",
          workstream: "General Operations",
          dueDate: "2026-03-29",
          status: "Waiting",
          waitingOn: "External"
        })
      ),
      {
        title: "County Ag offices list",
        meta: "Due in 1d - due Mar 29 - General Operations"
      }
    );

    assert.deepEqual(
      getImmediateRiskPreview(
        createItem({
          title: "Board packet",
          workstream: "General Operations",
          dueDate: "2026-03-28"
        })
      ),
      {
        title: "Board packet",
        meta: "Due today - due Mar 28 - General Operations"
      }
    );
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

test("normalizeActionItemFields standardizes obvious waiting and blocked reason drift", () => {
  const normalized = normalizeActionItemFields(
    createItem({
      status: "Waiting",
      waitingOn: " external ",
      isBlocked: true,
      blockedBy: " internal "
    })
  );

  assert.equal(normalized.waitingOn, "External");
  assert.equal(normalized.blockedBy, "Internal");

  const customReason = normalizeActionItemFields(
    createItem({
      isBlocked: true,
      blockedBy: "No response from sponsor"
    })
  );

  assert.equal(customReason.blockedBy, "No response from sponsor");

  const blankReason = normalizeActionItemFields(
    createItem({
      status: "Waiting",
      waitingOn: "   ",
      blockedBy: "   "
    })
  );

  assert.equal(blankReason.waitingOn, "");
  assert.equal(blankReason.blockedBy, undefined);
});

test("matchesEventGroup and matchesSearchQuery support grouped filtered views", () => {
  const item = createItem({
    eventGroup: "Monday Mingle",
    blockedBy: "Venue confirmation",
    noteEntries: [createActionNoteEntry("Need final room layout")!]
  });

  assert.equal(matchesEventGroup(item, "Monday Mingle"), true);
  assert.equal(matchesEventGroup(item, "Legislative Day"), false);
  assert.equal(matchesSearchQuery(item, "venue"), true);
  assert.equal(matchesSearchQuery(item, "room layout"), true);
  assert.equal(matchesSearchQuery(item, "crystelle"), false);
});

test("action lenses split active work into execution now and planned later", () => {
  assert.equal(matchesActionLens(createItem({ status: "In Progress" }), "executionNow"), true);
  assert.equal(matchesActionLens(createItem({ status: "Waiting", waitingOn: "Internal" }), "executionNow"), true);
  assert.equal(matchesActionLens(createItem({ isBlocked: true }), "executionNow"), true);
  assert.equal(matchesActionLens(createItem({ status: "Not Started", dueDate: "2026-04-30" }), "executionNow"), false);
  assert.equal(matchesActionLens(createItem({ status: "Not Started", dueDate: "2026-04-30" }), "plannedLater"), true);
  assert.equal(matchesActionLens(createItem({ status: "In Progress" }), "plannedLater"), false);
  assert.equal(matchesActionLens(createItem({ status: "Complete" }), "executionNow"), false);
  assert.equal(matchesActionLens(createItem({ status: "Complete" }), "plannedLater"), false);
  assert.equal(matchesActionLens(createItem({ status: "Canceled" }), "executionNow"), false);
  assert.equal(matchesActionLens(createItem({ status: "Canceled" }), "plannedLater"), false);
});

test("review lenses surface high-signal cleanup cases", () => {
  withMockedToday("2026-03-28T00:00:00.000Z", () => {
    assert.equal(matchesActionLens(createItem({ dueDate: "" }), "reviewMissingDueDate"), true);
    assert.equal(
      matchesActionLens(createItem({ status: "Waiting", lastUpdated: "2026-03-20" }), "reviewWaitingTooLong"),
      true
    );
    assert.equal(
      matchesActionLens(createItem({ status: "In Progress", lastUpdated: "2026-03-10" }), "reviewStale"),
      true
    );
    assert.equal(
      matchesActionLens(createItem({ status: "Waiting", lastUpdated: "2026-03-10" }), "reviewStale"),
      false
    );
    assert.equal(
      matchesActionLens(createItem({ status: "Complete", dueDate: "" }), "reviewMissingDueDate"),
      false
    );
    assert.equal(
      matchesActionLens(createItem({ status: "Canceled", dueDate: "" }), "reviewMissingDueDate"),
      false
    );
    assert.equal(daysSince("2026-03-14"), 14);
  });
});

test("waiting filter excludes blocked items while keeping true waiting items", () => {
  assert.equal(
    matchesActionFilter(createItem({ status: "Waiting", waitingOn: "External" }), "waiting"),
    true
  );
  assert.equal(
    matchesActionFilter(createItem({ status: "Waiting", waitingOn: "External", isBlocked: true }), "waiting"),
    false
  );
  assert.equal(matchesActionFilter(createItem({ isBlocked: true }), "waiting"), false);
});

test("terminal helpers and action visibility treat canceled like complete and cut", () => {
  assert.equal(isTerminalStatus("Complete"), true);
  assert.equal(isTerminalStatus("Cut"), true);
  assert.equal(isTerminalStatus("Canceled"), true);

  const items = [
    createItem({ id: "active-item" }),
    createItem({ id: "canceled-item", status: "Canceled" })
  ];

  const hiddenTerminalItems = getVisibleActionItems(items, {
    activeDueDate: "",
    activeEventGroup: "all",
    activeFilter: "all",
    activeFocus: "all",
    activeIssue: "",
    activeLens: "all",
    activeQuery: "",
    showCompleted: false
  });
  const shownTerminalItems = getVisibleActionItems(items, {
    activeDueDate: "",
    activeEventGroup: "all",
    activeFilter: "all",
    activeFocus: "all",
    activeIssue: "",
    activeLens: "all",
    activeQuery: "",
    showCompleted: true
  });

  assert.deepEqual(hiddenTerminalItems.map((item) => item.id), ["active-item"]);
  assert.deepEqual(shownTerminalItems.map((item) => item.id), ["active-item", "canceled-item"]);
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
    isBlocked: true,
    blockedBy: "  Vendor approval  ",
    issue: undefined,
    dueDate: "2026-03-30",
    status: "Not Started",
    owner: "Unknown Owner",
    waitingOn: "",
    noteEntries: []
  });

  assert.match(created.id, /^custom-owner-follow-up-/);
  assert.equal(created.workstream, "First Friday");
  assert.equal(created.eventGroup, "First Friday");
  assert.equal(created.owner, "Unknown Owner");
  assert.equal(created.isBlocked, true);
  assert.equal(created.blockedBy, "Vendor approval");

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
    createItem({ workstream: "First Fridays", owner: "External Sponsor Rep" }),
    {
      ...createItem({ id: "legacy-item" }),
      blocked: true,
      blockedBy: "  Sponsor art  ",
      notes: "  Sponsor art is waiting on approval  "
    } as ActionItem & { blocked: boolean }
  ]);
  assert.equal(normalized[0].workstream, "First Friday");
  assert.equal(normalized[0].owner, "External Sponsor Rep");
  assert.equal(normalized[1].isBlocked, true);
  assert.equal(normalized[1].blockedBy, "Sponsor art");
  assert.equal(normalized[1].noteEntries.length, 1);
  assert.equal(normalized[1].noteEntries[0].author.initials, "LEG");
  assert.equal(normalized[1].noteEntries[0].text, "Sponsor art is waiting on approval");
});

test("opening a publication issue keeps only one open issue per publication workstream", () => {
  const nextStatuses = setPublicationIssueStatus(
    {
      "February 2026 Newsbrief": "Open",
      "March 2026 Newsbrief": "Planned",
      "Spring 2026 The Voice": "Open"
    },
    "March 2026 Newsbrief",
    "Open"
  );

  assert.equal(nextStatuses["February 2026 Newsbrief"], "Planned");
  assert.equal(nextStatuses["March 2026 Newsbrief"], "Open");
  assert.equal(nextStatuses["Spring 2026 The Voice"], "Open");
});

test("completing a publication issue is blocked while active deliverables remain", () => {
  const result = completePublicationIssue(
    [
      createItem({
        id: "deliverable-1",
        issue: "March 2026 Newsbrief",
        workstream: "Newsbrief",
        type: "Deliverable",
        status: "In Progress",
        title: "Draft CEO message"
      }),
      createItem({
        id: "deliverable-2",
        issue: "March 2026 Newsbrief",
        workstream: "Newsbrief",
        type: "Deliverable",
        status: "Cut",
        title: "Optional sidebar"
      })
    ],
    { "March 2026 Newsbrief": "Open" },
    "March 2026 Newsbrief"
  );

  assert.equal(result.completed, false);
  assert.deepEqual(result.blockedDeliverables, ["Draft CEO message"]);
  assert.equal(result.issueStatuses["March 2026 Newsbrief"], "Open");
});

test("opening a publication issue still generates missing deliverables", () => {
  const result = openPublicationIssue([], { "February 2026 Newsbrief": "Open" }, "March 2026 Newsbrief");

  assert.equal(result.issueStatuses["February 2026 Newsbrief"], "Planned");
  assert.equal(result.issueStatuses["March 2026 Newsbrief"], "Open");
  assert.equal(result.result.created > 0, true);
});
