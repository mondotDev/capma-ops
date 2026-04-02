import test from "node:test";
import assert from "node:assert/strict";
import {
  applyActionItemUpdates,
  applyBulkActionItemUpdates,
  createActionItem,
  normalizeActionEventLinks,
  normalizeActionItems
} from "../lib/action-item-mutations";
import {
  ACTION_VIEW_COLLATERAL_STATUS_OPTIONS,
  isActionViewCollateralStatus,
  isCollateralBlocked,
  isCollateralDueSoon,
  isCollateralOverdue,
  normalizeCollateralItem,
  normalizeCollateralWorkflowStatus,
  type CollateralItem
} from "../lib/collateral-data";
import { buildDashboardExecutionItems } from "../lib/dashboard-execution-items";
import {
  getVisibleActionViewRows,
  isSelectableActionViewRow
} from "../lib/action-view-rows";
import {
  getActionMeaningUiState,
  getQuickAddMeaningUiState,
  getSoonestUpcomingEventInstanceIdForWorkstream,
  reconcileQuickAddEventSelectionOnWorkstreamChange,
  shouldClearEventLinkOnWorkstreamChange
} from "../lib/action/action-item-ux";
import { getVisibleCollateralExecutionRows } from "../lib/collateral-execution-view";
import {
  completePublicationIssue,
  openPublicationIssue,
  setPublicationIssueStatus
} from "../lib/publication-issue-actions";
import { openNativeDateInputPicker } from "../lib/date-input";
import { parseImportedAppState } from "../lib/app-transfer";
import {
  APP_STATE_BACKUP_STORAGE_KEY,
  APP_STATE_STORAGE_KEY,
  savePersistedAppState
} from "../lib/app-persistence";
import {
  getActionItemEventGroupLabel,
  getActionItemSubEventLabel
} from "../lib/events/event-labels";
import {
  getDashboardLiveSummary,
  getDashboardUrgentPreview,
  getPublicationIssueSummary
} from "../lib/queries/dashboard/dashboard-queries";
import {
  getDashboardSessionReadSelection,
  loadFirebaseDashboardSourceWithDependencies,
  parseDashboardProjectionDocument,
  resetDashboardSessionReadSelectionForTests,
  type DashboardSessionReadSelection
} from "../lib/firebase-dashboard-source";
import {
  getActionListViewData,
  getPublicationIssueWorkspaceSummary,
  getSelectedActionItemWorkspace
} from "../lib/queries/action/action-view-queries";
import {
  getCollateralEventInstanceWorkspaceBundle,
  getCollateralInstanceListView,
  getSelectedCollateralItemWorkspace
} from "../lib/queries/collateral/collateral-workspace-queries";
import { createLocalAppReadSource } from "../lib/read-source/local-app-read-source";
import type { ActionItem } from "../lib/sample-data";
import { localAppStateRepository } from "../lib/state/local-app-state-repository";
import {
  getAppStateRepository,
  setAppStateRepository
} from "../lib/state/app-state-repository-provider";
import type { AppStateRepository } from "../lib/state/app-state-repository";
import { createDefaultAppStateData } from "../lib/state/app-state-defaults";
import {
  getCollisionReviewHref,
  getItemEventGroupLabel,
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
  validateActionItemInput,
  type IssueRecord
} from "../lib/ops-utils";
import { normalizeActionWorkflowStatus } from "../lib/workflow-status";

function withMockedToday<T>(isoDateTime: string, callback: () => T) {
  const RealDate = Date;
  const localDateKey = isoDateTime.slice(0, 10);
  const mockedNow = `${localDateKey}T12:00:00`;

  class MockDate extends Date {
    constructor(value?: string | number | Date) {
      super(value ?? mockedNow);
    }

    static now() {
      return new RealDate(mockedNow).getTime();
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

function withMockedWindowStorage<T>(callback: () => T) {
  const originalWindow = globalThis.window;
  const storage = new Map<string, string>();
  const localStorage = {
    getItem(key: string) {
      return storage.has(key) ? storage.get(key)! : null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
    removeItem(key: string) {
      storage.delete(key);
    }
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage }
  });

  try {
    return callback();
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow
    });
  }
}

function withInspectableWindowStorage<T>(callback: (storage: {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  counts: Map<string, number>;
}) => T) {
  const originalWindow = globalThis.window;
  const storage = new Map<string, string>();
  const counts = new Map<string, number>();
  const localStorage = {
    getItem(key: string) {
      return storage.has(key) ? storage.get(key)! : null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    },
    removeItem(key: string) {
      storage.delete(key);
    }
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage }
  });

  try {
    return callback({ ...localStorage, counts });
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow
    });
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
    updateType: "Net New",
    noteEntries: [],
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

test("collateral deadline helpers ignore terminal and printer-sent records for urgency", () => {
  withMockedToday("2026-03-28T00:00:00.000Z", () => {
    assert.equal(isCollateralDueSoon(createCollateralItem({ dueDate: "2026-03-30" })), true);
    assert.equal(isCollateralOverdue(createCollateralItem({ dueDate: "2026-03-27" })), true);
    assert.equal(
      isCollateralDueSoon(createCollateralItem({ dueDate: "2026-03-30", status: "Sent to Printer" })),
      false
    );
    assert.equal(
      isCollateralOverdue(createCollateralItem({ dueDate: "2026-03-27", status: "Sent to Printer" })),
      false
    );
    assert.equal(isCollateralDueSoon(createCollateralItem({ dueDate: "2026-03-30", status: "Complete" })), false);
    assert.equal(isCollateralOverdue(createCollateralItem({ dueDate: "2026-03-27", status: "Cut" })), false);
  });
});

test("collateral blocked helper treats status and blockedBy as the same blocked signal", () => {
  assert.equal(isCollateralBlocked(createCollateralItem({ status: "Blocked", blockedBy: "" })), true);
  assert.equal(isCollateralBlocked(createCollateralItem({ status: "Backlog", blockedBy: "Vendor proof" })), true);
  assert.equal(isCollateralBlocked(createCollateralItem({ status: "Backlog", blockedBy: "" })), false);
});

test("action view collateral status contract stays explicit and narrow", () => {
  assert.deepEqual(ACTION_VIEW_COLLATERAL_STATUS_OPTIONS, [
    "In Design",
    "Waiting",
    "Blocked",
    "Ready for Print"
  ]);
  assert.equal(isActionViewCollateralStatus("In Design"), true);
  assert.equal(isActionViewCollateralStatus("Backlog"), false);
  assert.equal(isActionViewCollateralStatus("Sent to Printer"), false);
});

test("legacy imports restore action items without silently seeding collateral records", () => {
  const parsed = parseImportedAppState([createItem()]);

  assert.ok(parsed);
  assert.equal(parsed.usedLegacyFormat, true);
  assert.equal(parsed.items.length, 1);
  assert.deepEqual(parsed.collateralItems, []);
});

test("imports keep valid collateral rows even when one collateral row is malformed", () => {
  const parsed = parseImportedAppState({
    items: [createItem()],
    issueStatuses: {},
    collateralItems: [
      createCollateralItem({ id: "good-collateral" }),
      { id: "bad-collateral", itemName: 42 }
    ]
  });

  assert.ok(parsed);
  assert.equal(parsed?.items.length, 1);
  assert.equal(parsed?.collateralItems.length, 1);
  assert.equal(parsed?.collateralItems[0]?.id, "good-collateral");
});

test("current-format imports do not silently seed legislative day collateral when collateralItems are missing", () => {
  const parsed = parseImportedAppState({
    version: 1,
    exportedAt: "2026-03-29T12:00:00.000Z",
    items: [createItem()],
    issueStatuses: {}
  });

  assert.ok(parsed);
  assert.equal(parsed?.usedLegacyFormat, false);
  assert.deepEqual(parsed?.collateralItems, []);
});

test("imports map legacy __unassigned__ collateral into a real per-instance sub-event", () => {
  const parsed = parseImportedAppState({
    version: 1,
    exportedAt: "2026-03-29T12:00:00.000Z",
    items: [createItem()],
    issueStatuses: {},
    collateralItems: [
      {
        ...createCollateralItem({
          id: "custom-collateral",
          eventInstanceId: "custom-instance",
          subEventId: "__unassigned__"
        })
      }
    ],
    eventTypes: [{ id: "legislative-day", name: "Legislative Day", familyId: "legislative-advocacy" }],
    eventInstances: [
      {
        id: "custom-instance",
        eventTypeId: "legislative-day",
        name: "Legislative Day 2027",
        dateMode: "single",
        dates: ["2027-04-20"],
        startDate: "2027-04-20",
        endDate: "2027-04-20"
      }
    ],
    eventSubEvents: []
  });

  assert.ok(parsed);
  assert.equal(parsed?.collateralItems.length, 1);
  assert.equal(parsed?.collateralItems[0]?.subEventId, "custom-instance-unassigned");
  assert.equal(
    parsed?.eventSubEvents.some((subEvent) => subEvent.id === "custom-instance-unassigned" && subEvent.name === "Unassigned"),
    true
  );
});

test("imports fall back to the seeded default event graph when all event instances are invalid", () => {
  const parsed = parseImportedAppState({
    version: 1,
    exportedAt: "2026-03-29T12:00:00.000Z",
    items: [createItem()],
    issueStatuses: {},
    collateralItems: [createCollateralItem()],
    eventTypes: [],
    eventInstances: [
      {
        id: "broken-instance",
        eventTypeId: "missing-type",
        name: "Broken Event",
        dateMode: "single",
        dates: ["2026-05-01"],
        startDate: "2026-05-01",
        endDate: "2026-05-01"
      }
    ],
    eventSubEvents: []
  });

  assert.ok(parsed);
  assert.equal(parsed?.eventInstances.length, 1);
  assert.equal(parsed?.eventInstances[0]?.id, "legislative-day-2026");
  assert.equal(parsed?.activeEventInstanceId, "legislative-day-2026");
  assert.deepEqual(parsed?.collateralItems, []);
});

test("collateral execution rows surface only qualifying statuses for the active event instance", () => {
  const rows = getVisibleCollateralExecutionRows({
    activeDueDate: "",
    activeEventGroup: "all",
    activeEventInstanceId: "legislative-day-2026",
    activeFilter: "all",
    activeFocus: "all",
    activeIssue: "",
    activeLens: "all",
    activeQuery: "",
    collateralItems: [
      createCollateralItem({ id: "a", status: "In Design" }),
      createCollateralItem({ id: "b", status: "Blocked" }),
      createCollateralItem({ id: "c", status: "Backlog" }),
      createCollateralItem({ id: "d", status: "Sent to Printer" }),
      createCollateralItem({ id: "e", status: "Ready for Print", eventInstanceId: "other-event" })
    ],
    eventInstances: [
      {
        id: "legislative-day-2026",
        eventTypeId: "legislative-day",
        name: "Legislative Day 2026",
        dateMode: "range",
        dates: ["2026-04-21", "2026-04-23"],
        startDate: "2026-04-21",
        endDate: "2026-04-23"
      },
      {
        id: "other-event",
        eventTypeId: "legislative-day",
        name: "Legislative Day 2027",
        dateMode: "single",
        dates: ["2027-04-20"],
        startDate: "2027-04-20",
        endDate: "2027-04-20"
      }
    ],
    eventSubEvents: [
      { id: "leg-day-legislative-visits", eventInstanceId: "legislative-day-2026", name: "Legislative Visits", sortOrder: 10 },
      { id: "leg-day-other", eventInstanceId: "other-event", name: "Other", sortOrder: 10 }
    ],
    eventTypes: [{ id: "legislative-day", name: "Legislative Day", familyId: "legislative-advocacy" }]
  });

  assert.deepEqual(rows.map((row) => row.collateralId).sort(), ["a", "b"]);
});

test("non-surfaced collateral statuses remain collateral-only in action view", () => {
  const rows = getVisibleCollateralExecutionRows({
    activeDueDate: "",
    activeEventGroup: "all",
    activeEventInstanceId: "legislative-day-2026",
    activeFilter: "all",
    activeFocus: "all",
    activeIssue: "",
    activeLens: "all",
    activeQuery: "",
    collateralItems: [
      createCollateralItem({ id: "backlog", status: "Backlog" }),
      createCollateralItem({ id: "sent", status: "Sent to Printer" }),
      createCollateralItem({ id: "complete", status: "Complete" }),
      createCollateralItem({ id: "cut", status: "Cut" })
    ],
    eventInstances: [
      {
        id: "legislative-day-2026",
        eventTypeId: "legislative-day",
        name: "Legislative Day 2026",
        dateMode: "range",
        dates: ["2026-04-21", "2026-04-23"],
        startDate: "2026-04-21",
        endDate: "2026-04-23"
      }
    ],
    eventSubEvents: [
      { id: "leg-day-legislative-visits", eventInstanceId: "legislative-day-2026", name: "Legislative Visits", sortOrder: 10 }
    ],
    eventTypes: [{ id: "legislative-day", name: "Legislative Day", familyId: "legislative-advocacy" }]
  });

  assert.deepEqual(rows, []);
});

test("collateral execution rows participate in action filters without becoming native action items", () => {
  withMockedToday("2026-03-28T00:00:00.000Z", () => {
    const rows = getVisibleCollateralExecutionRows({
      activeDueDate: "",
      activeEventGroup: "all",
      activeEventInstanceId: "legislative-day-2026",
      activeFilter: "blocked",
      activeFocus: "all",
      activeIssue: "",
      activeLens: "executionNow",
      activeQuery: "",
      collateralItems: [
        createCollateralItem({ id: "blocked-status", status: "Blocked" }),
        createCollateralItem({ id: "waiting", status: "Waiting" }),
        createCollateralItem({ id: "ready", status: "Ready for Print" })
      ],
      eventInstances: [
        {
          id: "legislative-day-2026",
          eventTypeId: "legislative-day",
          name: "Legislative Day 2026",
          dateMode: "range",
          dates: ["2026-04-21", "2026-04-23"],
          startDate: "2026-04-21",
          endDate: "2026-04-23"
        }
      ],
      eventSubEvents: [
        { id: "leg-day-legislative-visits", eventInstanceId: "legislative-day-2026", name: "Legislative Visits", sortOrder: 10 }
      ],
      eventTypes: [{ id: "legislative-day", name: "Legislative Day", familyId: "legislative-advocacy" }]
    });

    assert.deepEqual(rows.map((row) => row.collateralId), ["blocked-status"]);
  });
});

test("collateral execution rows do not surface for unsupported event types", () => {
  const rows = getVisibleCollateralExecutionRows({
    activeDueDate: "",
    activeEventGroup: "all",
    activeEventInstanceId: "first-friday-april-2027",
    activeFilter: "all",
    activeFocus: "all",
    activeIssue: "",
    activeLens: "all",
    activeQuery: "",
    collateralItems: [
      createCollateralItem({
        id: "unsupported-collateral",
        eventInstanceId: "first-friday-april-2027",
        subEventId: "first-friday-main",
        status: "In Design"
      })
    ],
    eventInstances: [
      {
        id: "first-friday-april-2027",
        eventTypeId: "first-friday",
        name: "April 2027 First Friday",
        dateMode: "single",
        dates: ["2027-04-02"],
        startDate: "2027-04-02",
        endDate: "2027-04-02"
      }
    ],
    eventSubEvents: [
      { id: "first-friday-main", eventInstanceId: "first-friday-april-2027", name: "Main Event", sortOrder: 10 }
    ],
    eventTypes: [{ id: "first-friday", name: "First Friday", familyId: "recurring-monthly-program" }]
  });

  assert.deepEqual(rows, []);
});

test("action view rows merge native and collateral execution work into one urgency-sorted list", () => {
  withMockedToday("2026-03-28T00:00:00.000Z", () => {
    const rows = getVisibleActionViewRows({
      actionItems: [
        createItem({ id: "native-due-soon", title: "Native due soon", dueDate: "2026-03-29" }),
        createItem({ id: "native-blocked", title: "Native blocked", isBlocked: true, blockedBy: "Approval" })
      ],
      eventInstances: [],
      eventSubEvents: [],
      collateralRows: [
        {
          kind: "collateral",
          id: "collateral-execution-ready",
          collateralId: "collateral-ready",
          eventInstanceId: "legislative-day-2026",
          eventInstanceName: "Legislative Day 2026",
          eventTypeName: "Legislative Day",
          subEventId: "leg-day-legislative-visits",
          subEventName: "Legislative Visits",
          title: "Collateral ready",
          status: "Ready for Print",
          dueDate: "2026-03-30",
          owner: "Melissa",
          blockedBy: "",
          printer: "CAPMA",
          lastUpdated: "2026-03-28",
          typeLabel: "Collateral",
          workstreamLabel: "Collateral",
          eventGroupLabel: "Legislative Day 2026"
        }
      ]
    });

    assert.deepEqual(rows.map((row) => row.id), [
      "native-blocked",
      "native-due-soon",
      "collateral-execution-ready"
    ]);
  });
});

test("only native mixed action view rows are selectable", () => {
  const rows = getVisibleActionViewRows({
    actionItems: [createItem({ id: "native-1" })],
    eventInstances: [],
    eventSubEvents: [],
    collateralRows: [
      {
        kind: "collateral",
        id: "collateral-execution-1",
        collateralId: "collateral-1",
        eventInstanceId: "legislative-day-2026",
        eventInstanceName: "Legislative Day 2026",
        eventTypeName: "Legislative Day",
        subEventId: "leg-day-legislative-visits",
        subEventName: "Legislative Visits",
        title: "Collateral item",
        status: "Waiting",
        dueDate: "2026-03-30",
        owner: "Melissa",
        blockedBy: "",
        printer: "",
        lastUpdated: "2026-03-28",
        typeLabel: "Collateral",
        workstreamLabel: "Collateral",
        eventGroupLabel: "Legislative Day 2026"
      }
    ]
  });

  assert.deepEqual(rows.filter(isSelectableActionViewRow).map((row) => row.actionItemId), ["native-1"]);
});

test("normalizeActionItemFields migrates obvious legislative day items to the seeded event instance", () => {
  const normalized = normalizeActionItemFields(
    createItem({
      eventGroup: "Legislative Day",
      legacyEventGroupMigrated: undefined,
      eventInstanceId: undefined,
      subEventId: undefined
    })
  );

  assert.equal(normalized.eventInstanceId, "legislative-day-2026");
  assert.equal(normalized.legacyEventGroupMigrated, true);
});

test("normalizeActionItemFields does not reattach legislative day event instance after explicit clear", () => {
  const normalized = normalizeActionItemFields(
    createItem({
      eventGroup: "Legislative Day",
      legacyEventGroupMigrated: true,
      eventInstanceId: undefined,
      subEventId: undefined
    })
  );

  assert.equal(normalized.eventInstanceId, undefined);
  assert.equal(normalized.legacyEventGroupMigrated, true);
});

test("normalizeActionEventLinks clears invalid event-instance and sub-event references without dropping the action item", () => {
  const normalized = normalizeActionEventLinks(
    createItem({
      eventInstanceId: "missing-instance",
      subEventId: "missing-sub-event"
    }),
    [
      {
        id: "legislative-day-2026",
        eventTypeId: "legislative-day",
        name: "Legislative Day 2026",
        dateMode: "range",
        dates: ["2026-04-21", "2026-04-23"],
        startDate: "2026-04-21",
        endDate: "2026-04-23"
      }
    ],
    [{ id: "leg-day-legislative-visits", eventInstanceId: "legislative-day-2026", name: "Legislative Visits", sortOrder: 10 }]
  );

  assert.equal(normalized.eventInstanceId, undefined);
  assert.equal(normalized.subEventId, undefined);
  assert.equal(normalized.title, "Follow up with sponsor");
});

test("event-linked action items normalize to their event workstream and clear operational bucket drift", () => {
  const state = createDefaultAppStateData();

  const [normalized] = normalizeActionItems(
    [
      createItem({
        id: "drifted-event-item",
        workstream: "General Operations",
        operationalBucket: "General Operations",
        eventInstanceId: "legislative-day-2026",
        subEventId: "leg-day-legislative-visits"
      })
    ],
    {
      eventPrograms: state.eventTypes,
      eventInstances: state.eventInstances,
      eventSubEvents: state.eventSubEvents
    }
  );

  assert.equal(normalized?.workstream, "Legislative Day");
  assert.equal(normalized?.operationalBucket, undefined);
  assert.equal(normalized?.eventInstanceId, "legislative-day-2026");
  assert.equal(normalized?.subEventId, "leg-day-legislative-visits");
});

test("assigning an event instance reconciles workstream meaning and clears operational bucket", () => {
  const state = createDefaultAppStateData();

  const updated = applyActionItemUpdates(
    createItem({
      id: "assign-event-instance",
      workstream: "General Operations",
      operationalBucket: "General Operations"
    }),
    {
      eventInstanceId: "legislative-day-2026",
      subEventId: "leg-day-legislative-visits",
      operationalBucket: undefined,
      legacyEventGroupMigrated: true
    },
    {
      eventPrograms: state.eventTypes,
      eventInstances: state.eventInstances,
      eventSubEvents: state.eventSubEvents
    }
  );

  assert.equal(updated.workstream, "Legislative Day");
  assert.equal(updated.operationalBucket, undefined);
  assert.equal(updated.eventInstanceId, "legislative-day-2026");
  assert.equal(updated.subEventId, "leg-day-legislative-visits");
});

test("changing workstream away from an event program clears event linkage", () => {
  const state = createDefaultAppStateData();

  const updated = applyActionItemUpdates(
    createItem({
      id: "clear-event-link",
      workstream: "Legislative Day",
      eventInstanceId: "legislative-day-2026",
      subEventId: "leg-day-legislative-visits"
    }),
    {
      workstream: "General Operations"
    },
    {
      eventPrograms: state.eventTypes,
      eventInstances: state.eventInstances,
      eventSubEvents: state.eventSubEvents
    }
  );

  assert.equal(updated.workstream, "General Operations");
  assert.equal(updated.eventInstanceId, undefined);
  assert.equal(updated.subEventId, undefined);
  assert.equal(updated.operationalBucket, "General Operations");
});

test("assigning an operational bucket clears conflicting event-linked meaning", () => {
  const state = createDefaultAppStateData();

  const updated = applyActionItemUpdates(
    createItem({
      id: "bucket-wins",
      workstream: "Legislative Day",
      eventInstanceId: "legislative-day-2026",
      subEventId: "leg-day-legislative-visits"
    }),
    {
      operationalBucket: "Membership Campaigns"
    },
    {
      eventPrograms: state.eventTypes,
      eventInstances: state.eventInstances,
      eventSubEvents: state.eventSubEvents
    }
  );

  assert.equal(updated.workstream, "Membership Campaigns");
  assert.equal(updated.operationalBucket, "Membership Campaigns");
  assert.equal(updated.eventInstanceId, undefined);
  assert.equal(updated.subEventId, undefined);
});

test("normalized action items stay consistent between action view scope labels and dashboard workstream summaries", () => {
  const state = createDefaultAppStateData();
  const [normalized] = normalizeActionItems(
    [
      createItem({
        id: "cross-screen-consistency",
        workstream: "General Operations",
        operationalBucket: "General Operations",
        eventInstanceId: "legislative-day-2026"
      })
    ],
    {
      eventPrograms: state.eventTypes,
      eventInstances: state.eventInstances,
      eventSubEvents: state.eventSubEvents
    }
  );
  const executionItems = buildDashboardExecutionItems({
    items: [normalized!],
    collateralItems: [],
    activeEventInstanceId: "legislative-day-2026",
    eventInstances: state.eventInstances,
    eventSubEvents: state.eventSubEvents,
    eventPrograms: state.eventTypes
  });
  const dashboardSummary = withMockedToday("2026-03-30T12:00:00", () =>
    getDashboardLiveSummary({
      executionItems,
      items: [normalized!],
      issues: [],
      workstreamSchedules: getDefaultWorkstreamSchedules()
    })
  );

  assert.equal(getItemEventGroupLabel(normalized!, state.eventInstances, state.eventTypes), "Legislative Day 2026");
  assert.equal(dashboardSummary.workstreamSummaryRows[0]?.workstream, "Legislative Day");
});

test("getItemEventGroupLabel prefers linked event instance name over legacy event group", () => {
  const label = getItemEventGroupLabel(
    createItem({
      eventGroup: "Legislative Day",
      eventInstanceId: "legislative-day-2026"
    }),
    [
      {
        id: "legislative-day-2026",
        eventTypeId: "legislative-day",
        name: "Legislative Day 2026",
        dateMode: "range",
        dates: ["2026-04-21", "2026-04-23"],
        startDate: "2026-04-21",
        endDate: "2026-04-23"
      }
    ]
  );

  assert.equal(label, "Legislative Day 2026");
});

test("mixed action view search matches derived event instance and sub-event labels for native actions", () => {
  const rows = getVisibleActionViewRows({
    actionItems: [
      createItem({
        id: "native-leg-day",
        eventGroup: "Legislative Day",
        eventInstanceId: "legislative-day-2026",
        subEventId: "leg-day-legislative-visits"
      })
    ],
    collateralRows: [],
    eventInstances: [
      {
        id: "legislative-day-2026",
        eventTypeId: "legislative-day",
        name: "Legislative Day 2026",
        dateMode: "range",
        dates: ["2026-04-21", "2026-04-23"],
        startDate: "2026-04-21",
        endDate: "2026-04-23"
      }
    ],
    eventSubEvents: [
      { id: "leg-day-legislative-visits", eventInstanceId: "legislative-day-2026", name: "Legislative Visits", sortOrder: 10 }
    ],
    activeQuery: "2026"
  });

  assert.deepEqual(rows.map((row) => row.id), ["native-leg-day"]);

  const subEventRows = getVisibleActionViewRows({
    actionItems: [
      createItem({
        id: "native-leg-day",
        eventGroup: "Legislative Day",
        eventInstanceId: "legislative-day-2026",
        subEventId: "leg-day-legislative-visits"
      })
    ],
    collateralRows: [],
    eventInstances: [
      {
        id: "legislative-day-2026",
        eventTypeId: "legislative-day",
        name: "Legislative Day 2026",
        dateMode: "range",
        dates: ["2026-04-21", "2026-04-23"],
        startDate: "2026-04-21",
        endDate: "2026-04-23"
      }
    ],
    eventSubEvents: [
      { id: "leg-day-legislative-visits", eventInstanceId: "legislative-day-2026", name: "Legislative Visits", sortOrder: 10 }
    ],
    activeQuery: "legislative visits"
  });

  assert.deepEqual(subEventRows.map((row) => row.id), ["native-leg-day"]);
});

test("workstream conflict helper flags event-linked items that move away from the event program", () => {
  const state = createDefaultAppStateData();

  assert.equal(
    shouldClearEventLinkOnWorkstreamChange({
      eventInstanceId: "legislative-day-2026",
      nextWorkstream: "First Friday",
      eventInstances: state.eventInstances,
      eventPrograms: state.eventTypes
    }),
    true
  );

  assert.equal(
    shouldClearEventLinkOnWorkstreamChange({
      eventInstanceId: "legislative-day-2026",
      nextWorkstream: "Legislative Day",
      eventInstances: state.eventInstances,
      eventPrograms: state.eventTypes
    }),
    false
  );
});

test("drawer-style workstream updates clear event linkage immediately in UI state", () => {
  const state = createDefaultAppStateData();
  const currentItem = createItem({
    id: "action-ux-1",
    title: "Event-linked item",
    workstream: "Legislative Day",
    eventInstanceId: "legislative-day-2026",
    subEventId: "leg-day-legislative-visits"
  });
  const nextWorkstream = "First Friday";
  const syncedItem = syncActionItemWorkstream(currentItem, nextWorkstream);
  const shouldClearEventLink = shouldClearEventLinkOnWorkstreamChange({
    eventInstanceId: currentItem.eventInstanceId,
    nextWorkstream,
    eventInstances: state.eventInstances,
    eventPrograms: state.eventTypes
  });

  const nextUiState = {
    ...syncedItem,
    eventInstanceId: shouldClearEventLink ? undefined : currentItem.eventInstanceId,
    subEventId: shouldClearEventLink ? undefined : currentItem.subEventId
  };

  assert.equal(nextUiState.workstream, "First Friday");
  assert.equal(nextUiState.eventInstanceId, undefined);
  assert.equal(nextUiState.subEventId, undefined);
});

test("quick add workstream updates clear event linkage immediately and keep disable rules aligned", () => {
  const state = createDefaultAppStateData();
  const currentFormState = {
    type: "Task",
    title: "Quick add event-linked item",
    workstream: "Legislative Day",
    operationalBucket: "",
    eventInstanceId: "legislative-day-2026",
    subEventId: "leg-day-legislative-visits",
    issue: "",
    dueDate: "2026-04-10",
    owner: "Melissa",
    status: "Not Started",
    waitingOn: "",
    isBlocked: false,
    blockedBy: "",
    notes: ""
  };
  const nextWorkstream = "General Ops";
  const syncedState = syncActionItemWorkstream(currentFormState, nextWorkstream);
  const shouldClearEventLink = shouldClearEventLinkOnWorkstreamChange({
    eventInstanceId: currentFormState.eventInstanceId,
    nextWorkstream,
    eventInstances: state.eventInstances,
    eventPrograms: state.eventTypes
  });

  const nextUiState = {
    ...syncedState,
    eventInstanceId: shouldClearEventLink ? "" : currentFormState.eventInstanceId,
    subEventId: shouldClearEventLink ? "" : currentFormState.subEventId
  };

  assert.equal(nextUiState.eventInstanceId, "");
  assert.equal(nextUiState.subEventId, "");

  const eventLinkedUi = getActionMeaningUiState("legislative-day-2026");
  const nonEventUi = getActionMeaningUiState("");

  assert.equal(eventLinkedUi.subEventDisabled, false);
  assert.equal(eventLinkedUi.operationalBucketDisabled, true);
  assert.equal(nonEventUi.subEventDisabled, true);
  assert.equal(nonEventUi.operationalBucketDisabled, false);
});

test("quick add auto-selects the soonest upcoming event instance for an event workstream", () => {
  const eventPrograms = createDefaultAppStateData().eventTypes;
  const eventInstances = [
    {
      id: "legislative-day-2025",
      eventTypeId: "legislative-day",
      name: "Legislative Day 2025",
      dateMode: "single" as const,
      dates: ["2025-04-20"],
      startDate: "2025-04-20",
      endDate: "2025-04-20"
    },
    {
      id: "legislative-day-2026",
      eventTypeId: "legislative-day",
      name: "Legislative Day 2026",
      dateMode: "single" as const,
      dates: ["2026-04-21"],
      startDate: "2026-04-21",
      endDate: "2026-04-21"
    },
    {
      id: "legislative-day-2027",
      eventTypeId: "legislative-day",
      name: "Legislative Day 2027",
      dateMode: "single" as const,
      dates: ["2027-04-20"],
      startDate: "2027-04-20",
      endDate: "2027-04-20"
    }
  ];

  assert.equal(
    getSoonestUpcomingEventInstanceIdForWorkstream({
      workstream: "Legislative Day",
      eventInstances,
      eventPrograms,
      today: "2026-02-01"
    }),
    "legislative-day-2026"
  );
});

test("quick add preserves a manual event-instance override within the same event program", () => {
  const eventPrograms = createDefaultAppStateData().eventTypes;
  const eventInstances = [
    {
      id: "first-friday-march-2026",
      eventTypeId: "first-friday",
      name: "March 2026 First Friday",
      dateMode: "single" as const,
      dates: ["2026-03-06"],
      startDate: "2026-03-06",
      endDate: "2026-03-06"
    },
    {
      id: "first-friday-april-2026",
      eventTypeId: "first-friday",
      name: "April 2026 First Friday",
      dateMode: "single" as const,
      dates: ["2026-04-03"],
      startDate: "2026-04-03",
      endDate: "2026-04-03"
    }
  ];

  const nextSelection = reconcileQuickAddEventSelectionOnWorkstreamChange({
    currentEventInstanceId: "first-friday-april-2026",
    currentSubEventId: "first-friday-main",
    nextWorkstream: "First Friday",
    manualSelection: {
      eventProgramId: "first-friday",
      eventInstanceId: "first-friday-april-2026"
    },
    eventInstances,
    eventPrograms,
    today: "2026-02-01"
  });

  assert.equal(nextSelection.eventInstanceId, "first-friday-april-2026");
  assert.equal(nextSelection.subEventId, "first-friday-main");
});

test("quick add switches to the soonest relevant instance when the workstream changes to a different event program", () => {
  const eventPrograms = createDefaultAppStateData().eventTypes;
  const eventInstances = [
    {
      id: "legislative-day-2026",
      eventTypeId: "legislative-day",
      name: "Legislative Day 2026",
      dateMode: "single" as const,
      dates: ["2026-04-21"],
      startDate: "2026-04-21",
      endDate: "2026-04-21"
    },
    {
      id: "first-friday-march-2026",
      eventTypeId: "first-friday",
      name: "March 2026 First Friday",
      dateMode: "single" as const,
      dates: ["2026-03-06"],
      startDate: "2026-03-06",
      endDate: "2026-03-06"
    }
  ];

  const nextSelection = reconcileQuickAddEventSelectionOnWorkstreamChange({
    currentEventInstanceId: "legislative-day-2026",
    currentSubEventId: "leg-day-legislative-visits",
    nextWorkstream: "First Friday",
    manualSelection: {
      eventProgramId: null,
      eventInstanceId: ""
    },
    eventInstances,
    eventPrograms,
    today: "2026-02-01"
  });

  assert.equal(nextSelection.eventInstanceId, "first-friday-march-2026");
  assert.equal(nextSelection.subEventId, "");
});

test("quick add clears event linkage when switching to a non-event workstream", () => {
  const state = createDefaultAppStateData();

  const nextSelection = reconcileQuickAddEventSelectionOnWorkstreamChange({
    currentEventInstanceId: "legislative-day-2026",
    currentSubEventId: "leg-day-legislative-visits",
    nextWorkstream: "General Ops",
    manualSelection: {
      eventProgramId: null,
      eventInstanceId: ""
    },
    eventInstances: state.eventInstances,
    eventPrograms: state.eventTypes,
    today: "2026-02-01"
  });

  assert.equal(nextSelection.eventInstanceId, "");
  assert.equal(nextSelection.subEventId, "");
});

test("quick add leaves the event instance empty when no upcoming instance exists for the selected event workstream", () => {
  const eventPrograms = createDefaultAppStateData().eventTypes;
  const eventInstances = [
    {
      id: "legislative-day-2025",
      eventTypeId: "legislative-day",
      name: "Legislative Day 2025",
      dateMode: "single" as const,
      dates: ["2025-04-20"],
      startDate: "2025-04-20",
      endDate: "2025-04-20"
    }
  ];

  const nextSelection = reconcileQuickAddEventSelectionOnWorkstreamChange({
    currentEventInstanceId: "",
    currentSubEventId: "",
    nextWorkstream: "Legislative Day",
    manualSelection: {
      eventProgramId: null,
      eventInstanceId: ""
    },
    eventInstances,
    eventPrograms,
    today: "2026-02-01"
  });

  assert.equal(nextSelection.eventInstanceId, "");
  assert.equal(nextSelection.subEventId, "");
});

test("quick add meaning ui treats event and non-event paths differently after workstream selection", () => {
  const eventPrograms = createDefaultAppStateData().eventTypes;

  const beforeSelection = getQuickAddMeaningUiState({
    workstream: "",
    eventInstanceId: "",
    eventPrograms
  });
  const eventPath = getQuickAddMeaningUiState({
    workstream: "Legislative Day",
    eventInstanceId: "legislative-day-2026",
    eventPrograms
  });
  const nonEventPath = getQuickAddMeaningUiState({
    workstream: "General Operations",
    eventInstanceId: "",
    eventPrograms
  });

  assert.equal(beforeSelection.eventPathMuted, true);
  assert.equal(beforeSelection.operationalPathMuted, true);
  assert.equal(beforeSelection.contextualHint, "Choose a workstream first to guide the event vs non-event fields.");

  assert.equal(eventPath.eventPathActive, true);
  assert.equal(eventPath.operationalPathMuted, true);
  assert.equal(eventPath.operationalBucketDisabled, true);

  assert.equal(nonEventPath.operationalPathActive, true);
  assert.equal(nonEventPath.eventPathMuted, true);
  assert.equal(nonEventPath.operationalBucketDisabled, false);
});

test("native date picker helper focuses the input and opens the picker when available", () => {
  let focused = false;
  let pickerOpened = false;

  openNativeDateInputPicker({
    focus() {
      focused = true;
    },
    showPicker() {
      pickerOpened = true;
    }
  } as HTMLInputElement);

  assert.equal(focused, true);
  assert.equal(pickerOpened, true);
});

test("native date picker helper still focuses when showPicker is unavailable", () => {
  let focused = false;

  openNativeDateInputPicker({
    focus() {
      focused = true;
    }
  } as HTMLInputElement);

  assert.equal(focused, true);
});

test("normalizeCollateralItem preserves template origin metadata", () => {
  const normalized = normalizeCollateralItem({
    ...createCollateralItem(),
    templateOriginId: "legislative-template-item"
  });

  assert.ok(normalized);
  assert.equal(normalized?.templateOriginId, "legislative-template-item");
});

test("normalizeCollateralItem migrates legacy note text into timestamped note entries", () => {
  const normalized = normalizeCollateralItem({
    ...createCollateralItem(),
    noteEntries: undefined,
    notes: "Vendor asked for final logo by Friday."
  });

  assert.ok(normalized);
  assert.equal(normalized?.noteEntries.length, 1);
  assert.equal(normalized?.noteEntries[0]?.text, "Vendor asked for final logo by Friday.");
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
      dateText: "Apr 20",
      countdownText: "23 days out"
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
    assert.equal(metrics.peakUpcomingLoadCount, 1);
    assert.equal(metrics.peakUpcomingLoadDate, "2026-03-29");
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

test("savePersistedAppState skips duplicate writes when snapshot content is unchanged", () => {
  withInspectableWindowStorage(({ counts }) => {
    const state = createDefaultAppStateData();

    const firstSave = savePersistedAppState(state);
    const secondSave = savePersistedAppState(state);

    assert.deepEqual(firstSave, { ok: true, status: "written" });
    assert.deepEqual(secondSave, { ok: true, status: "unchanged" });
    assert.equal(counts.get(APP_STATE_STORAGE_KEY), 1);
    assert.equal(counts.get(APP_STATE_BACKUP_STORAGE_KEY), 1);
  });
});

test("savePersistedAppState returns quota-exceeded without throwing", () => {
  const originalWindow = globalThis.window;
  const localStorage = {
    getItem() {
      return null;
    },
    setItem() {
      throw new DOMException("Storage full", "QuotaExceededError");
    },
    removeItem() {}
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage }
  });

  try {
    const result = savePersistedAppState(createDefaultAppStateData());
    assert.deepEqual(result, { ok: false, status: "quota-exceeded" });
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow
    });
  }
});

test("normalizeActionItemFields folds recognized legacy details values into waitingOn and drops ambiguous leftovers", () => {
  const migratedDetails = normalizeActionItemFields(
    createItem({
      status: "Waiting",
      waitingOn: "",
      blockedBy: ""
    }) as ActionItem & { details: string }
  );

  const migratedFromLegacyDetails = normalizeActionItemFields({
    ...createItem({
      status: "Waiting",
      waitingOn: "",
      blockedBy: ""
    }),
    details: " vendor "
  });

  const preservedWaitingOn = normalizeActionItemFields({
    ...createItem({
      status: "Waiting",
      waitingOn: "Internal",
      blockedBy: ""
    }),
    details: "Vendor"
  });

  const droppedAmbiguousDetails = normalizeActionItemFields({
    ...createItem({
      status: "Waiting",
      waitingOn: "",
      blockedBy: ""
    }),
    details: "Follow up soon"
  });

  assert.equal(migratedDetails.waitingOn, "");
  assert.equal(migratedFromLegacyDetails.waitingOn, "Vendor");
  assert.equal(preservedWaitingOn.waitingOn, "Internal");
  assert.equal(droppedAmbiguousDetails.waitingOn, "");
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
  assert.equal(syncedIssue.eventGroup, "");
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
  assert.equal(validation.dueDate, true);
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

test("default app state factory returns a normalized local-first state shape", () => {
  const state = createDefaultAppStateData();

  assert.equal(state.activeEventInstanceId, "legislative-day-2026");
  assert.equal(state.items.length > 0, true);
  assert.equal(state.eventInstances.length > 0, true);
  assert.equal(state.eventSubEvents.length > 0, true);
  assert.deepEqual(state.issueStatuses, {});
});

test("local app state repository saves and reloads the same normalized state", () => {
  withMockedWindowStorage(() => {
    const state = createDefaultAppStateData();
    state.items = [createItem({ eventGroup: "Legislative Day" })];

    localAppStateRepository.save(state);
    const loaded = localAppStateRepository.load();

    assert.equal(loaded.source, "primary");
    assert.ok(loaded.state);
    assert.equal(loaded.state?.items.length, 1);
    assert.equal(loaded.state?.items[0]?.eventInstanceId, "legislative-day-2026");
    assert.equal(loaded.state?.activeEventInstanceId, state.activeEventInstanceId);
  });
});

test("app state repository provider can swap implementations without changing callers", () => {
  const originalRepository = getAppStateRepository();
  const fakeRepository: AppStateRepository = {
    clear() {},
    export(state: ReturnType<typeof createDefaultAppStateData>) {
      return {
        version: 1,
        schemaVersion: 2,
        exportedAt: "2026-03-29T12:00:00.000Z",
        items: state.items,
        issueStatuses: state.issueStatuses,
        collateralItems: state.collateralItems,
        collateralProfiles: state.collateralProfiles,
        activeEventInstanceId: state.activeEventInstanceId,
        defaultOwnerForNewItems: state.defaultOwnerForNewItems,
        eventFamilies: state.eventFamilies,
        eventTypes: state.eventTypes,
        eventInstances: state.eventInstances,
        eventSubEvents: state.eventSubEvents,
        workstreamSchedules: state.workstreamSchedules
      };
    },
    import() {
      return {
        ...createDefaultAppStateData(),
        itemCount: 0,
        usedLegacyFormat: false
      };
    },
    load() {
      return {
        backupStateStatus: "valid" as const,
        primaryStateStatus: "valid" as const,
        source: "primary" as const,
        shouldPersist: true,
        state: createDefaultAppStateData()
      };
    },
    save() {}
  };

  setAppStateRepository(fakeRepository);
  assert.equal(getAppStateRepository(), fakeRepository);
  setAppStateRepository(originalRepository);
  assert.equal(getAppStateRepository(), originalRepository);
});

test("event label helpers resolve linked event instance and sub-event names", () => {
  const item = createItem({
    eventInstanceId: "legislative-day-2026",
    subEventId: "leg-day-legislative-visits",
    eventGroup: "Legislative Day"
  });
  const state = createDefaultAppStateData();

  assert.equal(getActionItemEventGroupLabel(item, state.eventInstances), "Legislative Day 2026");
  assert.equal(getActionItemSubEventLabel(item, state.eventSubEvents), "Legislative Visits");
  assert.equal(getItemEventGroupLabel(item, state.eventInstances), "Legislative Day 2026");
});

test("dashboard read-side summary returns live counts and preview-ready aggregates", () => {
  const productionNoteEntry = createActionNoteEntry("Missing printer confirmation");
  const state = createDefaultAppStateData();
  const items = [
    createItem({
      title: "Overdue sponsor follow-up",
      workstream: "Membership Campaigns",
      dueDate: "2026-03-28",
      waitingOn: "Sponsor"
    }),
    createItem({
      title: "Production proof review",
      workstream: "Legislative Day",
      dueDate: "2026-03-31",
      blockedBy: "Printer proof",
      noteEntries: productionNoteEntry ? [productionNoteEntry] : []
    }),
    createItem({
      title: "Newsbrief draft",
      workstream: "Newsbrief",
      issue: "March 2026 Newsbrief",
      dueDate: "2026-04-01",
      status: "In Progress"
    })
  ];
  const issues: IssueRecord[] = [
    { label: "March 2026 Newsbrief", status: "Open", dueDate: "2026-04-01", workstream: "Newsbrief", year: 2026 },
    { label: "Spring 2026 The Voice", status: "Planned", dueDate: "2026-04-30", workstream: "The Voice", year: 2026 }
  ];
  const workstreamSchedules = getDefaultWorkstreamSchedules();
  const collateralItems = [
    createCollateralItem({
      id: "collateral-ready-proof",
      status: "Ready for Print",
      dueDate: "2026-03-31"
    }),
    createCollateralItem({
      id: "collateral-backlog-hidden",
      status: "Backlog",
      dueDate: "2026-03-31"
    })
  ];
  const executionItems = withMockedToday("2026-03-30T12:00:00", () =>
    buildDashboardExecutionItems({
      items,
      collateralItems,
      activeEventInstanceId: "legislative-day-2026",
      eventInstances: state.eventInstances,
      eventSubEvents: state.eventSubEvents,
      eventPrograms: state.eventTypes
    })
  );

  const summary = withMockedToday("2026-03-30T12:00:00", () =>
    getDashboardLiveSummary({ executionItems, items, issues, workstreamSchedules })
  );

  assert.equal(summary.overdue, 1);
  assert.equal(summary.dueSoon, 3);
  assert.equal(summary.blockedCount, 1);
  assert.equal(summary.overviewLoadRows.length, 2);
  assert.equal(summary.workstreamSummaryRows.length > 0, true);
  assert.deepEqual(Object.keys(summary).includes("sponsorRisk"), false);
  assert.deepEqual(Object.keys(summary).includes("productionRisk"), false);
});

test("dashboard urgent preview query returns preview-ready urgent rows", () => {
  const state = createDefaultAppStateData();
  const items = [
    createItem({
      id: "urgent-1",
      title: "Urgent overdue item",
      workstream: "Legislative Day",
      dueDate: "2026-03-28"
    }),
    createItem({
      id: "urgent-2",
      title: "Urgent due soon item",
      workstream: "Best Pest Expo",
      dueDate: "2026-03-31"
    })
  ];
  const executionItems = withMockedToday("2026-03-30T12:00:00", () =>
    buildDashboardExecutionItems({
      items,
      collateralItems: [
        createCollateralItem({
          id: "urgent-collateral",
          status: "Ready for Print",
          dueDate: "2026-03-31"
        }),
        createCollateralItem({
          id: "hidden-backlog-collateral",
          status: "Backlog",
          dueDate: "2026-03-31"
        })
      ],
      activeEventInstanceId: "legislative-day-2026",
      eventInstances: state.eventInstances,
      eventSubEvents: state.eventSubEvents,
      eventPrograms: state.eventTypes
    })
  );

  const preview = withMockedToday("2026-03-30T12:00:00", () =>
    getDashboardUrgentPreview(
      { executionItems, items, issues: [], workstreamSchedules: getDefaultWorkstreamSchedules() },
      3
    )
  );

  assert.deepEqual(preview.map((item) => item.id), [
    "urgent-1",
    "collateral-execution-urgent-collateral",
    "urgent-2"
  ]);
  assert.equal(preview.some((item) => item.id === "collateral-execution-hidden-backlog-collateral"), false);
  assert.equal(preview[0]?.title, "Urgent overdue item");
  assert.match(preview[0]?.meta ?? "", /Overdue/);
});

test("publication issue summary query returns progress-ready rows for visible publication issues", () => {
  const items = [
    createItem({
      title: "Draft CEO message",
      workstream: "Newsbrief",
      issue: "March 2026 Newsbrief",
      type: "Deliverable",
      status: "Complete"
    }),
    createItem({
      title: "Layout proof",
      workstream: "Newsbrief",
      issue: "March 2026 Newsbrief",
      type: "Deliverable",
      status: "In Progress"
    })
  ];
  const issues: IssueRecord[] = [
    { label: "March 2026 Newsbrief", status: "Open", dueDate: "2026-04-01", workstream: "Newsbrief", year: 2026 },
    { label: "Spring 2026 The Voice", status: "Planned", dueDate: "2026-04-30", workstream: "The Voice", year: 2026 }
  ];

  const publicationRows = withMockedToday("2026-03-30T12:00:00", () =>
    getPublicationIssueSummary({
      executionItems: [],
      items,
      issues,
      workstreamSchedules: getDefaultWorkstreamSchedules()
    })
  );

  assert.equal(publicationRows.length, 2);
  assert.equal(publicationRows[0]?.label, "March 2026 Newsbrief");
  assert.equal(publicationRows[0]?.completeCount, 1);
  assert.equal(publicationRows[0]?.totalCount, 2);
  assert.equal(publicationRows[0]?.progressPercent, 50);
  assert.equal(publicationRows[0]?.canCompleteIssue, false);
});

test("publication issue workspace summary derives progress and actions for open publication issues", () => {
  const items = [
    createItem({
      id: "deliverable-complete",
      title: "Draft CEO message",
      workstream: "Newsbrief",
      issue: "March 2026 Newsbrief",
      type: "Deliverable",
      status: "Complete"
    }),
    createItem({
      id: "deliverable-open",
      title: "Layout proof",
      workstream: "Newsbrief",
      issue: "March 2026 Newsbrief",
      type: "Deliverable",
      status: "In Progress"
    })
  ];
  const issues: IssueRecord[] = [
    { label: "February 2026 Newsbrief", status: "Planned", dueDate: "2026-03-01", workstream: "Newsbrief", year: 2026 },
    { label: "March 2026 Newsbrief", status: "Open", dueDate: "2026-04-01", workstream: "Newsbrief", year: 2026 },
    { label: "Spring 2026 The Voice", status: "Planned", dueDate: "2026-04-30", workstream: "The Voice", year: 2026 }
  ];

  const workspace = getPublicationIssueWorkspaceSummary({
    activeIssue: "March 2026 Newsbrief",
    items,
    issues
  });

  assert.ok(workspace);
  assert.equal(workspace?.issue.label, "March 2026 Newsbrief");
  assert.equal(workspace?.workstream, "Newsbrief");
  assert.equal(workspace?.completeCount, 1);
  assert.equal(workspace?.totalCount, 2);
  assert.equal(workspace?.remainingCount, 1);
  assert.equal(workspace?.progressCopy, "1 of 2 complete");
  assert.equal(workspace?.canOpenIssue, false);
  assert.equal(workspace?.canGenerateMissing, true);
  assert.equal(workspace?.canCompleteIssue, false);
  assert.deepEqual(
    workspace?.visiblePublicationIssues.map((issue) => issue.label),
    ["March 2026 Newsbrief", "Spring 2026 The Voice"]
  );
});

test("publication issue workspace summary flags missing due dates and supports planned issue opening", () => {
  const workspace = getPublicationIssueWorkspaceSummary({
    activeIssue: "Spring 2026 The Voice",
    items: [],
    issues: [
      { label: "March 2026 Newsbrief", status: "Open", dueDate: "2026-04-01", workstream: "Newsbrief", year: 2026 },
      { label: "Spring 2026 The Voice", status: "Planned", dueDate: "", workstream: "The Voice", year: 2026 }
    ]
  });

  assert.ok(workspace);
  assert.equal(workspace?.isMissingDueDate, true);
  assert.equal(workspace?.dueDate, "");
  assert.equal(workspace?.canOpenIssue, true);
  assert.equal(workspace?.canGenerateMissing, false);
  assert.equal(workspace?.canCompleteIssue, false);
  assert.equal(workspace?.progressCopy, "No deliverables yet");
});

test("publication issue workspace summary ignores unknown issue filters", () => {
  const workspace = getPublicationIssueWorkspaceSummary({
    activeIssue: "Sponsor Follow Up",
    items: [createItem({ issue: "March 2026 Newsbrief" })],
    issues: [
      { label: "March 2026 Newsbrief", status: "Open", dueDate: "2026-04-01", workstream: "Newsbrief", year: 2026 }
    ]
  });

  assert.equal(workspace, null);
});

test("dashboard firebase read slice falls back cleanly when the feature flag is off", async () => {
  let projectionReadAttempted = false;

  const source = await loadFirebaseDashboardSourceWithDependencies({
    dashboardReadsEnabled: false,
    firebaseConfigured: true,
    getDb: () => ({}) as never,
    getProjectionDocument: async () => {
      projectionReadAttempted = true;
      return null;
    }
  });

  assert.equal(source, null);
  assert.equal(projectionReadAttempted, false);
});

test("dashboard firebase read slice falls back cleanly when config is missing", async () => {
  let projectionReadAttempted = false;

  const source = await loadFirebaseDashboardSourceWithDependencies({
    dashboardReadsEnabled: true,
    firebaseConfigured: false,
    getDb: () => ({}) as never,
    getProjectionDocument: async () => {
      projectionReadAttempted = true;
      return null;
    }
  });

  assert.equal(source, null);
  assert.equal(projectionReadAttempted, false);
});

test("dashboard firebase read slice falls back cleanly when the projection document is missing", async () => {
  const source = await loadFirebaseDashboardSourceWithDependencies({
    dashboardReadsEnabled: true,
    firebaseConfigured: true,
    getDb: () => ({}) as never,
    getProjectionDocument: async () => null
  });

  assert.equal(source, null);
});

test("dashboard firebase read slice rejects malformed payloads and falls back to local", async () => {
  const source = await loadFirebaseDashboardSourceWithDependencies({
    dashboardReadsEnabled: true,
    firebaseConfigured: true,
    getDb: () => ({}) as never,
    getProjectionDocument: async () => ({
      items: [{ id: "broken-item", title: "Broken" }],
      issues: [],
      workstreamSchedules: []
    })
  });

  assert.equal(source, null);
});

test("dashboard firebase projection parser accepts the minimal valid payload", () => {
  const parsed = parseDashboardProjectionDocument({
    schemaVersion: 1,
    updatedAt: "2026-04-01T12:00:00.000Z",
    executionItems: [
      {
        id: "execution-remote-1",
        kind: "action",
        title: "Remote execution item",
        workstream: "General Operations",
        dueDate: "2026-04-02",
        status: "Waiting",
        blockedBy: "Vendor",
        waitingOn: "Vendor",
        lastUpdated: "2026-04-01",
        isBlocked: true,
        isWaiting: true,
        isOverdue: false,
        isDueSoon: true,
        isTerminal: false,
        isMissingDueDate: false,
        isProductionRisk: false
      }
    ],
    items: [
      {
        id: "remote-1",
        title: "Remote item",
        type: "Task",
        workstream: "General Operations",
        dueDate: "2026-04-02",
        status: "Waiting",
        owner: "Melissa",
        waitingOn: "Vendor",
        isBlocked: true,
        blockedBy: "Vendor",
        lastUpdated: "2026-04-01"
      }
    ],
    issues: [
      {
        label: "April 2026 Newsbrief",
        status: "Open",
        dueDate: "2026-04-18",
        workstream: "Newsbrief",
        year: 2026
      }
    ],
    workstreamSchedules: getDefaultWorkstreamSchedules()
  });

  assert.ok(parsed);
  assert.equal(parsed?.executionItems.length, 1);
  assert.equal(parsed?.items.length, 1);
  assert.equal(parsed?.issues.length, 1);
  assert.equal(parsed?.workstreamSchedules.length > 0, true);
});

test("dashboard firebase read slice maps a valid remote payload into dashboard source data", async () => {
  const source = await loadFirebaseDashboardSourceWithDependencies({
    dashboardReadsEnabled: true,
    firebaseConfigured: true,
    getDb: () => ({}) as never,
    getProjectionDocument: async () => ({
      executionItems: [
        {
          id: "execution-remote-1",
          kind: "action",
          title: "Remote blocked task",
          workstream: "General Operations",
          dueDate: "2026-04-02",
          status: "Waiting",
          blockedBy: "Vendor",
          waitingOn: "Vendor",
          lastUpdated: "2026-04-01",
          isBlocked: true,
          isWaiting: true,
          isOverdue: false,
          isDueSoon: true,
          isTerminal: false,
          isMissingDueDate: false,
          isProductionRisk: false
        }
      ],
      items: [
        {
          id: "remote-1",
          title: "Remote blocked task",
          type: "Task",
          workstream: "General Operations",
          dueDate: "2026-04-02",
          status: "Waiting",
          owner: "Melissa",
          waitingOn: "Vendor",
          isBlocked: true,
          blockedBy: "Vendor",
          lastUpdated: "2026-04-01"
        }
      ],
      issues: [
        {
          label: "April 2026 Newsbrief",
          status: "Open",
          dueDate: "2026-04-18",
          workstream: "Newsbrief",
          year: 2026
        }
      ],
      workstreamSchedules: getDefaultWorkstreamSchedules()
    })
  });

  assert.ok(source);
  assert.equal(source?.executionItems.length, 1);
  assert.equal(source?.executionItems[0]?.id, "execution-remote-1");
  assert.equal(source?.items.length, 1);
  assert.equal(source?.items[0]?.id, "remote-1");
  assert.equal(source?.items[0]?.noteEntries.length, 0);
  assert.equal(source?.items[0]?.isBlocked, true);
  assert.equal(source?.issues[0]?.label, "April 2026 Newsbrief");
});

test("dashboard session source selection stays fixed after startup", async () => {
  resetDashboardSessionReadSelectionForTests();
  let resolverCalls = 0;

  const initialSelection = await getDashboardSessionReadSelection(async () => {
    resolverCalls += 1;
    return {
      source: "remote",
      dashboardSource: {
        executionItems: [],
        items: [createItem({ id: "remote-session-item" })],
        issues: [],
        workstreamSchedules: getDefaultWorkstreamSchedules()
      }
    } satisfies DashboardSessionReadSelection;
  });

  const laterSelection = await getDashboardSessionReadSelection(async () => {
    resolverCalls += 1;
    return { source: "local" } satisfies DashboardSessionReadSelection;
  });

  assert.equal(resolverCalls, 1);
  assert.equal(initialSelection.source, "remote");
  assert.equal(laterSelection.source, "remote");
  if (laterSelection.source === "remote") {
    assert.equal(laterSelection.dashboardSource.items[0]?.id, "remote-session-item");
  }
  resetDashboardSessionReadSelectionForTests();
});

test("action view list query returns grouped mixed rows and event options without loading drawer detail", () => {
  const items = [
    createItem({
      id: "action-1",
      title: "Leg Day action",
      eventInstanceId: "legislative-day-2026",
      dueDate: "2026-03-31",
      owner: "Melissa"
    }),
    createItem({
      id: "action-2",
      title: "General ops action",
      workstream: "General Operations",
      eventGroup: "General Operations"
    })
  ];
  const collateralItems: CollateralItem[] = [
    {
      id: "collateral-1",
      eventInstanceId: "legislative-day-2026",
      subEventId: "leg-day-legislative-visits",
      itemName: "Visit folder",
      status: "Ready for Print",
      owner: "Melissa",
      blockedBy: "",
      dueDate: "2026-03-31",
      printer: "",
      quantity: "",
      updateType: "Reuse",
      noteEntries: [],
      lastUpdated: "2026-03-29"
    }
  ];
  const state = createDefaultAppStateData();

  const listView = withMockedToday("2026-03-30T12:00:00", () =>
    getActionListViewData({
      items,
      collateralItems,
      eventInstances: state.eventInstances,
      eventSubEvents: state.eventSubEvents,
      eventTypes: state.eventTypes,
      activeEventInstanceId: "legislative-day-2026",
      filters: {
        activeDueDate: "",
        activeEventGroup: "all",
        activeFilter: "all",
        activeFocus: "all",
        activeLens: "all",
        activeIssue: "",
        activeQuery: "",
        showCompleted: false
      }
    })
  );

  assert.equal(listView.visibleActionItemCount, 2);
  assert.equal(listView.visibleExecutionCount, 3);
  assert.equal(listView.visibleRows.length, 3);
  assert.deepEqual(listView.summaryCounts, {
    overdue: 0,
    dueSoon: 3,
    blocked: 0,
    waiting: 0,
    totalActive: 3
  });
  assert.equal(listView.groupedRows.some((group) => group.label === "Legislative Day 2026"), true);
  assert.equal(listView.eventGroupOptions.some((option) => option.value === "Legislative Day 2026"), true);
  assert.equal(listView.eventGroupOptions.some((option) => option.value === "Legislative Day"), false);
});

test("action scope options use execution scope only for event-linked and non-event work", () => {
  const state = createDefaultAppStateData();

  const listView = getActionListViewData({
    items: [
      createItem({
        id: "event-linked-item",
        title: "Leg Day action",
        workstream: "Legislative Day",
        eventInstanceId: "legislative-day-2026",
        operationalBucket: undefined
      }),
      createItem({
        id: "bucket-item",
        title: "Ops action",
        workstream: "General Operations",
        operationalBucket: "General Operations"
      }),
      createItem({
        id: "unassigned-item",
        title: "Loose action",
        workstream: "",
        operationalBucket: undefined,
        eventInstanceId: undefined,
        eventGroup: ""
      })
    ],
    collateralItems: [],
    eventInstances: state.eventInstances,
    eventSubEvents: state.eventSubEvents,
    eventTypes: state.eventTypes,
    activeEventInstanceId: "legislative-day-2026",
    filters: {
      activeDueDate: "",
      activeEventGroup: "all",
      activeFilter: "all",
      activeFocus: "all",
      activeLens: "all",
      activeIssue: "",
      activeQuery: "",
      showCompleted: false
    }
  });

  assert.deepEqual(
    listView.eventGroupOptions.map((option) => option.value),
    ["all", "Unassigned", "General Operations", "Legislative Day 2026"]
  );
  assert.equal(listView.groupedRows.some((group) => group.label === "Legislative Day"), false);
  assert.equal(listView.groupedRows.some((group) => group.label === "Legislative Day 2026"), true);
  assert.equal(listView.groupedRows.some((group) => group.label === "General Operations"), true);
  assert.equal(listView.groupedRows.some((group) => group.label === "Unassigned"), true);
});

test("action view list summary counts follow the visible mixed operational lane", () => {
  const state = createDefaultAppStateData();

  const listView = withMockedToday("2026-03-30T12:00:00", () =>
    getActionListViewData({
      items: [
        createItem({
          id: "blocked-native",
          title: "Blocked native action",
          isBlocked: true,
          blockedBy: "Approval",
          dueDate: "2026-03-31"
        }),
        createItem({
          id: "completed-native",
          title: "Completed native action",
          status: "Complete",
          dueDate: "2026-03-31"
        })
      ],
      collateralItems: [
        createCollateralItem({
          id: "waiting-collateral",
          status: "Waiting",
          dueDate: "2026-03-31"
        })
      ],
      eventInstances: state.eventInstances,
      eventSubEvents: state.eventSubEvents,
      eventTypes: state.eventTypes,
      activeEventInstanceId: "legislative-day-2026",
      filters: {
        activeDueDate: "",
        activeEventGroup: "all",
        activeFilter: "all",
        activeFocus: "all",
        activeLens: "all",
        activeIssue: "",
        activeQuery: "",
        showCompleted: true
      }
    })
  );

  assert.equal(listView.visibleRows.length, 3);
  assert.deepEqual(listView.summaryCounts, {
    overdue: 0,
    dueSoon: 2,
    blocked: 1,
    waiting: 1,
    totalActive: 2
  });
});

test("review collisions lens keeps only active upcoming due-dated work", () => {
  withMockedToday("2026-03-30T12:00:00", () => {
    assert.equal(matchesActionLens(createItem({ dueDate: "2026-04-02" }), "reviewCollisions"), true);
    assert.equal(matchesActionLens(createItem({ dueDate: "2026-04-14" }), "reviewCollisions"), false);
    assert.equal(matchesActionLens(createItem({ dueDate: "2026-03-29" }), "reviewCollisions"), false);
    assert.equal(matchesActionLens(createItem({ dueDate: "" }), "reviewCollisions"), false);
    assert.equal(matchesActionLens(createItem({ dueDate: "2026-04-02", status: "Complete" }), "reviewCollisions"), false);
  });
});

test("collision review href keeps action view in review mode and preserves date drill-ins", () => {
  assert.equal(getCollisionReviewHref(), "/action?lens=reviewCollisions");
  assert.equal(
    getCollisionReviewHref("2026-04-02"),
    "/action?lens=reviewCollisions&dueDate=2026-04-02"
  );
});

test("action view collision review summarizes overloaded dates and groups rows by due date", () => {
  const state = createDefaultAppStateData();

  const listView = withMockedToday("2026-03-30T12:00:00", () =>
    getActionListViewData({
      items: [
        createItem({
          id: "collision-action-1",
          title: "Owner one first task",
          dueDate: "2026-04-02",
          owner: "Melissa"
        }),
        createItem({
          id: "collision-action-2",
          title: "Owner one second task",
          dueDate: "2026-04-02",
          owner: "Melissa"
        }),
        createItem({
          id: "collision-action-3",
          title: "Another day task",
          dueDate: "2026-04-03",
          owner: "Brandon"
        }),
        createItem({
          id: "not-in-review-window",
          title: "Far future task",
          dueDate: "2026-04-20",
          owner: "Melissa"
        })
      ],
      collateralItems: [
        createCollateralItem({
          id: "collision-collateral",
          status: "Ready for Print",
          dueDate: "2026-04-02",
          owner: "Melissa"
        })
      ],
      eventInstances: state.eventInstances,
      eventSubEvents: state.eventSubEvents,
      eventTypes: state.eventTypes,
      activeEventInstanceId: "legislative-day-2026",
      filters: {
        activeDueDate: "",
        activeEventGroup: "all",
        activeFilter: "all",
        activeFocus: "all",
        activeLens: "reviewCollisions",
        activeIssue: "",
        activeQuery: "",
        showCompleted: false
      }
    })
  );

  assert.equal(listView.visibleRows.length, 4);
  assert.deepEqual(
    listView.groupedRows.map((group) => group.label),
    ["2026-04-02", "2026-04-03"]
  );
  assert.ok(listView.collisionReview);
  assert.equal(listView.collisionReview?.totalDueSoonRows, 4);
  assert.equal(listView.collisionReview?.overloadedDateCount, 1);
  assert.equal(listView.collisionReview?.ownerCollisionCount, 1);
  assert.deepEqual(listView.collisionReview?.overloadedDates[0], {
    date: "2026-04-02",
    totalCount: 3,
    ownerCollisionCount: 1,
    owners: [{ owner: "Melissa", count: 3 }]
  });
});

test("action item workspace query returns selected item detail and scoped edit options", () => {
  const items = [
    createItem({
      id: "action-1",
      title: "Linked event action",
      workstream: "Newsbrief",
      issue: "March 2026 Newsbrief",
      eventInstanceId: "legislative-day-2026",
      subEventId: "leg-day-legislative-visits"
    })
  ];
  const issues: IssueRecord[] = [
    { label: "March 2026 Newsbrief", status: "Open", dueDate: "2026-04-01", workstream: "Newsbrief", year: 2026 }
  ];
  const state = createDefaultAppStateData();

  const workspace = getSelectedActionItemWorkspace({
    selectedItem: items[0],
    issues,
    selectedItemSubEvents: state.eventSubEvents.filter(
      (subEvent) => subEvent.eventInstanceId === "legislative-day-2026"
    )
  });

  assert.equal(workspace.selectedItem?.id, "action-1");
  assert.equal(workspace.selectedIssueRecord?.label, "March 2026 Newsbrief");
  assert.equal(workspace.selectedItemIssueOptions.includes("March 2026 Newsbrief"), true);
  assert.equal(
    workspace.selectedItemSubEvents.some((subEvent) => subEvent.id === "leg-day-legislative-visits"),
    true
  );
});

test("local read source returns dashboard-only data without exposing unrelated snapshot fields", () => {
  const state = createDefaultAppStateData();
  const readSource = createLocalAppReadSource({
    items: state.items,
    issues: getGeneratedIssues(state.issueStatuses),
    collateralItems: state.collateralItems,
    collateralProfiles: state.collateralProfiles,
    activeEventInstanceId: state.activeEventInstanceId,
    eventTypes: state.eventTypes,
    eventInstances: state.eventInstances,
    eventSubEvents: state.eventSubEvents,
    workstreamSchedules: state.workstreamSchedules
  });

  const dashboardSource = readSource.getDashboardSource();

  assert.deepEqual(Object.keys(dashboardSource).sort(), ["executionItems", "issues", "items", "workstreamSchedules"]);
  assert.equal(Array.isArray(dashboardSource.executionItems), true);
  assert.equal(Array.isArray(dashboardSource.items), true);
  assert.equal(Array.isArray(dashboardSource.issues), true);
  assert.equal(Array.isArray(dashboardSource.workstreamSchedules), true);
});

test("local read source separates action list data from selected action detail data", () => {
  const state = createDefaultAppStateData();
  const readSource = createLocalAppReadSource({
    items: state.items,
    issues: getGeneratedIssues(state.issueStatuses),
    collateralItems: state.collateralItems,
    collateralProfiles: state.collateralProfiles,
    activeEventInstanceId: state.activeEventInstanceId,
    eventTypes: state.eventTypes,
    eventInstances: state.eventInstances,
    eventSubEvents: state.eventSubEvents,
    workstreamSchedules: state.workstreamSchedules
  });

  const listSource = readSource.getActionListSource({
    activeEventInstanceId: state.activeEventInstanceId
  });
  const detailSource = readSource.getActionDetailSource({
    selectedId: state.items[0]?.id ?? null
  });

  assert.equal(Array.isArray(listSource.items), true);
  assert.equal(Array.isArray(listSource.collateralItems), true);
  assert.equal(detailSource.selectedItem?.id, state.items[0]?.id ?? null);
  assert.equal(Array.isArray(detailSource.selectedItemSubEvents), true);
});

test("local read source scopes collateral workspace data to the active instance and separates detail data", () => {
  const state = createDefaultAppStateData();
  const readSource = createLocalAppReadSource({
    items: state.items,
    issues: getGeneratedIssues(state.issueStatuses),
    collateralItems: state.collateralItems,
    collateralProfiles: state.collateralProfiles,
    activeEventInstanceId: "legislative-day-2026",
    eventTypes: state.eventTypes,
    eventInstances: state.eventInstances,
    eventSubEvents: state.eventSubEvents,
    workstreamSchedules: state.workstreamSchedules
  });

  const workspaceSource = readSource.getCollateralWorkspaceSource({
    activeEventInstanceId: "legislative-day-2026"
  });
  const detailSource = readSource.getCollateralDetailSource({
    activeEventInstanceId: "legislative-day-2026",
    selectedId: workspaceSource.collateralItems[0]?.id ?? null,
    draftCollateralItem: null
  });

  assert.equal(
    workspaceSource.collateralItems.every((item) => item.eventInstanceId === "legislative-day-2026"),
    true
  );
  assert.equal(
    workspaceSource.eventSubEvents.every((subEvent) => subEvent.eventInstanceId === "legislative-day-2026"),
    true
  );
  assert.equal(detailSource.resolvedActiveEventInstanceId, "legislative-day-2026");
  assert.equal(
    detailSource.visibleInstanceItems.every((item) => item.eventInstanceId === "legislative-day-2026"),
    true
  );
});

test("collateral workspace bundle resolves the active instance and scoped metadata", () => {
  const state = createDefaultAppStateData();

  const workspace = getCollateralEventInstanceWorkspaceBundle({
    activeEventInstanceId: "legislative-day-2026",
    collateralItems: state.collateralItems,
    collateralProfiles: state.collateralProfiles,
    eventInstances: state.eventInstances,
    eventSubEvents: state.eventSubEvents,
    eventTypes: state.eventTypes
  });

  assert.equal(workspace.resolvedActiveEventInstanceId, "legislative-day-2026");
  assert.equal(workspace.selectedEventInstance?.name, "Legislative Day 2026");
  assert.equal(workspace.currentEventType?.name, "Legislative Day");
  assert.equal(workspace.isSelectedEventTypeSupported, true);
  assert.equal(workspace.instanceSubEvents.length > 0, true);
  assert.equal(workspace.eventInstancesByType.length > 0, true);
});

test("collateral instance list query stays scoped to the active event instance", () => {
  const state = createDefaultAppStateData();
  const workspace = getCollateralEventInstanceWorkspaceBundle({
    activeEventInstanceId: "legislative-day-2026",
    collateralItems: state.collateralItems,
    collateralProfiles: state.collateralProfiles,
    eventInstances: state.eventInstances,
    eventSubEvents: state.eventSubEvents,
    eventTypes: state.eventTypes
  });
  const listView = getCollateralInstanceListView({
    collateralItems: [
      ...state.collateralItems,
      {
        id: "other-instance-item",
        eventInstanceId: "different-instance",
        subEventId: "different-instance-unassigned",
        itemName: "Should not appear",
        status: "Backlog",
        owner: "Melissa",
        blockedBy: "",
        dueDate: "",
        printer: "",
        quantity: "",
        updateType: "Reuse",
        noteEntries: [],
        lastUpdated: "2026-03-30"
      }
    ],
    resolvedActiveEventInstanceId: workspace.resolvedActiveEventInstanceId,
    instanceSubEvents: workspace.instanceSubEvents,
    activeProfile: workspace.activeProfile,
    activeSummaryFilter: "all",
    activeProfileDeadlineFilter: "none",
    draftCollateralItem: null
  });

  assert.equal(
    listView.instanceItems.every((item) => item.eventInstanceId === "legislative-day-2026"),
    true
  );
  assert.equal(listView.groupedItems.length > 0, true);
  assert.equal(typeof listView.summary.active, "number");
});

test("selected collateral workspace query returns selected item and sub-event options only for the active instance", () => {
  const state = createDefaultAppStateData();
  const workspace = getCollateralEventInstanceWorkspaceBundle({
    activeEventInstanceId: "legislative-day-2026",
    collateralItems: state.collateralItems,
    collateralProfiles: state.collateralProfiles,
    eventInstances: state.eventInstances,
    eventSubEvents: state.eventSubEvents,
    eventTypes: state.eventTypes
  });
  const listView = getCollateralInstanceListView({
    collateralItems: state.collateralItems,
    resolvedActiveEventInstanceId: workspace.resolvedActiveEventInstanceId,
    instanceSubEvents: workspace.instanceSubEvents,
    activeProfile: workspace.activeProfile,
    activeSummaryFilter: "all",
    activeProfileDeadlineFilter: "none",
    draftCollateralItem: null
  });
  const selectedWorkspace = getSelectedCollateralItemWorkspace({
    selectedId: listView.visibleInstanceItems[0]?.id ?? null,
    visibleInstanceItems: listView.visibleInstanceItems,
    instanceSubEvents: workspace.instanceSubEvents,
    resolvedActiveEventInstanceId: workspace.resolvedActiveEventInstanceId
  });

  assert.ok(selectedWorkspace.selectedItem);
  assert.equal(selectedWorkspace.subEventOptions.length, workspace.instanceSubEvents.length);
  assert.equal(selectedWorkspace.emptySubEventId, "legislative-day-2026-unassigned");
});
