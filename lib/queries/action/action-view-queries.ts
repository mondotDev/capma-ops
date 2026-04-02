import { buildActionScopes } from "@/lib/action-scopes";
import {
  getVisibleCollateralExecutionRows,
  type CollateralExecutionRow
} from "@/lib/collateral-execution-view";
import {
  getVisibleActionViewRows,
  groupActionViewRowsByDueDate,
  groupActionViewRowsByEventGroup,
  isSelectableActionViewRow,
  type ActionViewRow,
  type ActionViewRowGroup,
  type NativeActionViewRow
} from "@/lib/action-view-rows";
import {
  getVisibleActionItems,
  type ActionViewFilters
} from "@/lib/action-view-utils";
import type { EventInstance, EventProgram, EventSubEvent } from "@/lib/event-instances";
import type { ActionItem } from "@/lib/sample-data";
import {
  getIssueProgress,
  getIssuesForWorkstream,
  getVisiblePublicationIssues,
  isPublicationWorkstream,
  isTerminalStatus,
  type ActionSummaryCounts,
  type IssueRecord
} from "@/lib/ops-utils";

export type ActionListQueryInput = {
  items: ActionItem[];
  collateralItems: CollateralExecutionQueryInput["collateralItems"];
  eventInstances: EventInstance[];
  eventSubEvents: EventSubEvent[];
  eventPrograms?: EventProgram[];
  eventTypes?: EventProgram[];
  activeEventInstanceId: string;
  filters: ActionViewFilters;
};

type CollateralExecutionQueryInput = {
  activeDueDate: string;
  activeEventGroup: string;
  activeEventInstanceId: string;
  activeFilter: ActionViewFilters["activeFilter"];
  activeFocus: ActionViewFilters["activeFocus"];
  activeIssue: string;
  activeLens: ActionViewFilters["activeLens"];
  activeQuery: string;
  applySearch?: boolean;
  collateralItems: Parameters<typeof getVisibleCollateralExecutionRows>[0]["collateralItems"];
  eventInstances: EventInstance[];
  eventSubEvents: EventSubEvent[];
  eventPrograms?: EventProgram[];
  eventTypes?: EventProgram[];
};

export type ActionListViewData = {
  eventGroupOptions: { label: string; value: string }[];
  groupedRows: ActionViewRowGroup[];
  summaryCounts: ActionSummaryCounts;
  visibleActionItemCount: number;
  visibleExecutionCount: number;
  totalExecutionCount: number;
  visibleRows: ActionViewRow[];
  visibleSelectableRows: NativeActionViewRow[];
  collisionReview: CollisionReviewSummary | null;
};

export type ActionDetailWorkspaceData = {
  selectedItem: ActionItem | null;
  selectedIssueRecord: IssueRecord | null;
  selectedItemIssueOptions: string[];
  selectedItemSubEvents: EventSubEvent[];
};

export type PublicationIssueWorkspaceSummary = {
  issue: IssueRecord;
  workstream: IssueRecord["workstream"];
  dueDate: string;
  isMissingDueDate: boolean;
  completeCount: number;
  totalCount: number;
  remainingCount: number;
  progressCopy: string;
  canOpenIssue: boolean;
  canGenerateMissing: boolean;
  canCompleteIssue: boolean;
  visiblePublicationIssues: IssueRecord[];
  isPublicationIssue: true;
};

export type CollisionReviewSummary = {
  reviewWindowDays: number;
  totalDueSoonRows: number;
  overloadedDateCount: number;
  ownerCollisionCount: number;
  overloadedDates: CollisionReviewDateSummary[];
  selectedDate: CollisionReviewDateSummary | null;
};

export type CollisionReviewDateSummary = {
  date: string;
  totalCount: number;
  ownerCollisionCount: number;
  owners: { owner: string; count: number }[];
};

export function getActionCollateralExecutionRows(input: Omit<CollateralExecutionQueryInput, "collateralItems"> & {
  collateralItems: Parameters<typeof getVisibleCollateralExecutionRows>[0]["collateralItems"];
}) {
  const eventPrograms = input.eventPrograms ?? input.eventTypes ?? [];

  return getVisibleCollateralExecutionRows({
    activeDueDate: input.activeDueDate,
    activeEventGroup: input.activeEventGroup,
    activeEventInstanceId: input.activeEventInstanceId,
    activeFilter: input.activeFilter,
    activeFocus: input.activeFocus,
    activeIssue: input.activeIssue,
    activeLens: input.activeLens,
    activeQuery: input.activeQuery,
    applySearch: input.applySearch,
    collateralItems: input.collateralItems,
    eventInstances: input.eventInstances,
    eventSubEvents: input.eventSubEvents,
    eventPrograms
  });
}

export function getActionListViewData(input: ActionListQueryInput): ActionListViewData {
  const eventPrograms = input.eventPrograms ?? input.eventTypes ?? [];
  const visibleItems = getVisibleActionItems(input.items, input.filters, input.eventInstances, eventPrograms, {
    includeSearch: false
  });
  const collateralRows = getActionCollateralExecutionRows({
    activeDueDate: input.filters.activeDueDate,
    activeEventGroup: input.filters.activeEventGroup,
    activeEventInstanceId: input.activeEventInstanceId,
    activeFilter: input.filters.activeFilter,
    activeFocus: input.filters.activeFocus,
    activeIssue: input.filters.activeIssue,
    activeLens: input.filters.activeLens,
    activeQuery: input.filters.activeQuery,
    applySearch: false,
    collateralItems: input.collateralItems,
    eventInstances: input.eventInstances,
    eventSubEvents: input.eventSubEvents,
    eventPrograms
  });
  const visibleRows = getVisibleActionViewRows({
    actionItems: visibleItems,
    collateralRows,
    eventInstances: input.eventInstances,
    eventPrograms,
    eventSubEvents: input.eventSubEvents,
    activeQuery: input.filters.activeQuery
  });
  const visibleSelectableRows = visibleRows.filter(isSelectableActionViewRow);
  const totalVisibleItems = getVisibleActionItems(
    input.items,
    {
      ...input.filters,
      activeDueDate: "",
      activeEventGroup: "all",
      activeFilter: "all",
      activeFocus: "all",
      activeIssue: "",
      activeLens: "all",
      activeQuery: ""
    },
    input.eventInstances,
    eventPrograms,
    {
      includeSearch: false
    }
  );
  const totalCollateralRows = getActionCollateralExecutionRows({
    activeDueDate: "",
    activeEventGroup: "all",
    activeEventInstanceId: input.activeEventInstanceId,
    activeFilter: "all",
    activeFocus: "all",
    activeIssue: "",
    activeLens: "all",
    activeQuery: "",
    applySearch: false,
    collateralItems: input.collateralItems,
    eventInstances: input.eventInstances,
    eventSubEvents: input.eventSubEvents,
    eventPrograms
  });
  const actionScopes = buildActionScopes({
    items: input.items,
    eventPrograms,
    eventInstances: input.eventInstances,
    collateralExecutionInstanceIds: collateralRows.map((row) => row.eventInstanceId)
  });
  const collisionReview = getCollisionReviewSummary(visibleRows, input.filters.activeDueDate);

  return {
    eventGroupOptions: actionScopes.map((scope) => ({
      label: scope.label,
      value: scope.value
    })),
    groupedRows:
      input.filters.activeLens === "reviewCollisions"
        ? groupActionViewRowsByDueDate(visibleRows)
        : groupActionViewRowsByEventGroup(visibleRows),
    summaryCounts: getVisibleActionSummaryCounts(visibleRows),
    visibleActionItemCount: visibleItems.length,
    visibleExecutionCount: visibleItems.length + collateralRows.length,
    totalExecutionCount: totalVisibleItems.length + totalCollateralRows.length,
    visibleRows,
    visibleSelectableRows,
    collisionReview: input.filters.activeLens === "reviewCollisions" ? collisionReview : null
  };
}

export function getSelectedActionItemWorkspace(input: {
  selectedItem: ActionItem | null;
  issues: IssueRecord[];
  selectedItemSubEvents: EventSubEvent[];
}): ActionDetailWorkspaceData {
  const selectedItem = input.selectedItem;
  const selectedIssueRecord = selectedItem?.issue
    ? input.issues.find((issue) => issue.label === selectedItem.issue) ?? null
    : null;
  const selectedItemIssueOptions = selectedItem ? getIssuesForWorkstream(selectedItem.workstream) : [];

  return {
    selectedItem,
    selectedIssueRecord,
    selectedItemIssueOptions,
    selectedItemSubEvents: input.selectedItemSubEvents
  };
}

export function getPublicationIssueWorkspaceSummary(input: {
  activeIssue: string;
  issues: IssueRecord[];
  items: ActionItem[];
}): PublicationIssueWorkspaceSummary | null {
  const activeIssue = input.activeIssue.trim();

  if (!activeIssue) {
    return null;
  }

  const issue = input.issues.find((entry) => entry.label === activeIssue) ?? null;

  if (!issue || !isPublicationWorkstream(issue.workstream)) {
    return null;
  }

  const progress = getIssueProgress(input.items, issue.label);
  const remainingCount = Math.max(progress.total - progress.complete, 0);
  const progressCopy =
    progress.total > 0 ? `${progress.complete} of ${progress.total} complete` : "No deliverables yet";
  const visiblePublicationIssues = getVisiblePublicationIssueOptions(input.issues, issue);

  return {
    issue,
    workstream: issue.workstream,
    dueDate: issue.dueDate ?? "",
    isMissingDueDate: !issue.dueDate,
    completeCount: progress.complete,
    totalCount: progress.total,
    remainingCount,
    progressCopy,
    canOpenIssue: issue.status === "Planned",
    canGenerateMissing: issue.status === "Open",
    canCompleteIssue:
      issue.status === "Open" &&
      progress.total > 0 &&
      remainingCount === 0 &&
      input.items
        .filter((item) => item.issue === issue.label && item.type === "Deliverable")
        .every((item) => isTerminalStatus(item.status)),
    visiblePublicationIssues,
    isPublicationIssue: true
  };
}

function getVisiblePublicationIssueOptions(issues: IssueRecord[], activeIssue: IssueRecord) {
  const visibleIssues = getVisiblePublicationIssues(issues);
  const issueByLabel = new Map(visibleIssues.map((issue) => [issue.label, issue]));

  if (!issueByLabel.has(activeIssue.label)) {
    issueByLabel.set(activeIssue.label, activeIssue);
  }

  return [...issueByLabel.values()].sort((left, right) => {
    if (left.label === activeIssue.label) {
      return -1;
    }

    if (right.label === activeIssue.label) {
      return 1;
    }

    if (left.status !== right.status) {
      return left.status === "Open" ? -1 : right.status === "Open" ? 1 : left.status.localeCompare(right.status);
    }

    return left.label.localeCompare(right.label);
  });
}

function getVisibleActionSummaryCounts(rows: ActionViewRow[]): ActionSummaryCounts {
  const activeRows = rows.filter((row) => !row.isTerminal);

  return {
    overdue: activeRows.filter((row) => row.isOverdue).length,
    dueSoon: activeRows.filter((row) => row.isDueSoon).length,
    blocked: activeRows.filter((row) => row.isBlocked).length,
    waiting: activeRows.filter((row) => row.isWaiting).length,
    totalActive: activeRows.length
  };
}

function getCollisionReviewSummary(rows: ActionViewRow[], activeDueDate: string): CollisionReviewSummary {
  const dueDatedRows = rows.filter((row) => Boolean(row.dueDate) && !row.isTerminal);
  const rowsByDate = new Map<string, ActionViewRow[]>();

  for (const row of dueDatedRows) {
    if (!rowsByDate.has(row.dueDate)) {
      rowsByDate.set(row.dueDate, []);
    }

    rowsByDate.get(row.dueDate)!.push(row);
  }

  const dateSummaries = Array.from(rowsByDate, ([date, dateRows]) => {
    const ownerCounts = new Map<string, number>();

    for (const row of dateRows) {
      const owner = row.owner.trim() || "Unassigned";
      ownerCounts.set(owner, (ownerCounts.get(owner) ?? 0) + 1);
    }

    const owners = Array.from(ownerCounts, ([owner, count]) => ({ owner, count }))
      .sort((left, right) => right.count - left.count || left.owner.localeCompare(right.owner));

    return {
      date,
      totalCount: dateRows.length,
      ownerCollisionCount: owners.filter((owner) => owner.count > 1).length,
      owners
    };
  }).sort((left, right) => right.totalCount - left.totalCount || left.date.localeCompare(right.date));

  return {
    reviewWindowDays: 14,
    totalDueSoonRows: dueDatedRows.length,
    overloadedDateCount: dateSummaries.filter((entry) => entry.totalCount > 1).length,
    ownerCollisionCount: dateSummaries.reduce((total, entry) => total + entry.ownerCollisionCount, 0),
    overloadedDates: dateSummaries.filter((entry) => entry.totalCount > 1).slice(0, 5),
    selectedDate: activeDueDate ? dateSummaries.find((entry) => entry.date === activeDueDate) ?? null : null
  };
}
