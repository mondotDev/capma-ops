import { buildActionScopes } from "@/lib/action-scopes";
import {
  getVisibleCollateralExecutionRows,
  type CollateralExecutionRow
} from "@/lib/collateral-execution-view";
import {
  getVisibleActionViewRows,
  groupActionViewRowsByEventGroup,
  isSelectableActionViewRow,
  type ActionViewRow,
  type NativeActionViewRow
} from "@/lib/action-view-rows";
import {
  getVisibleActionItems,
  type ActionViewFilters
} from "@/lib/action-view-utils";
import type { EventInstance, EventProgram, EventSubEvent } from "@/lib/event-instances";
import type { ActionItem } from "@/lib/sample-data";
import {
  getIssuesForWorkstream,
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
  groupedRows: { label: string; items: ActionViewRow[] }[];
  summaryCounts: ActionSummaryCounts;
  visibleActionItemCount: number;
  visibleExecutionCount: number;
  visibleRows: ActionViewRow[];
  visibleSelectableRows: NativeActionViewRow[];
};

export type ActionDetailWorkspaceData = {
  selectedItem: ActionItem | null;
  selectedIssueRecord: IssueRecord | null;
  selectedItemIssueOptions: string[];
  selectedItemSubEvents: EventSubEvent[];
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
  const actionScopes = buildActionScopes({
    items: input.items,
    eventPrograms,
    eventInstances: input.eventInstances,
    collateralExecutionInstanceIds: collateralRows.map((row) => row.eventInstanceId)
  });

  return {
    eventGroupOptions: actionScopes.map((scope) => ({
      label: scope.label,
      value: scope.value
    })),
    groupedRows: groupActionViewRowsByEventGroup(visibleRows),
    summaryCounts: getVisibleActionSummaryCounts(visibleRows),
    visibleActionItemCount: visibleItems.length,
    visibleExecutionCount: visibleItems.length + collateralRows.length,
    visibleRows,
    visibleSelectableRows
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
