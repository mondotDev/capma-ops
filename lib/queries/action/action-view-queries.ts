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
  getItemEventGroupLabel,
  getVisibleActionItems,
  type ActionViewFilters
} from "@/lib/action-view-utils";
import type { EventInstance, EventSubEvent, EventType } from "@/lib/event-instances";
import type { ActionItem } from "@/lib/sample-data";
import { getIssuesForWorkstream, type IssueRecord } from "@/lib/ops-utils";

export type ActionListQueryInput = {
  items: ActionItem[];
  collateralItems: CollateralExecutionQueryInput["collateralItems"];
  eventInstances: EventInstance[];
  eventSubEvents: EventSubEvent[];
  eventTypes: EventType[];
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
  collateralItems: Parameters<typeof getVisibleCollateralExecutionRows>[0]["collateralItems"];
  eventInstances: EventInstance[];
  eventSubEvents: EventSubEvent[];
  eventTypes: EventType[];
};

export type ActionListViewData = {
  eventGroupOptions: { label: string; value: string }[];
  groupedRows: { label: string; items: ActionViewRow[] }[];
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
  return getVisibleCollateralExecutionRows({
    activeDueDate: input.activeDueDate,
    activeEventGroup: input.activeEventGroup,
    activeEventInstanceId: input.activeEventInstanceId,
    activeFilter: input.activeFilter,
    activeFocus: input.activeFocus,
    activeIssue: input.activeIssue,
    activeLens: input.activeLens,
    activeQuery: input.activeQuery,
    collateralItems: input.collateralItems,
    eventInstances: input.eventInstances,
    eventSubEvents: input.eventSubEvents,
    eventTypes: input.eventTypes
  });
}

export function getActionListViewData(input: ActionListQueryInput): ActionListViewData {
  const visibleItems = getVisibleActionItems(input.items, input.filters, input.eventInstances);
  const collateralRows = getActionCollateralExecutionRows({
    activeDueDate: input.filters.activeDueDate,
    activeEventGroup: input.filters.activeEventGroup,
    activeEventInstanceId: input.activeEventInstanceId,
    activeFilter: input.filters.activeFilter,
    activeFocus: input.filters.activeFocus,
    activeIssue: input.filters.activeIssue,
    activeLens: input.filters.activeLens,
    activeQuery: input.filters.activeQuery,
    collateralItems: input.collateralItems,
    eventInstances: input.eventInstances,
    eventSubEvents: input.eventSubEvents,
    eventTypes: input.eventTypes
  });
  const visibleRows = getVisibleActionViewRows({
    actionItems: visibleItems,
    collateralRows,
    eventInstances: input.eventInstances,
    eventSubEvents: input.eventSubEvents,
    activeQuery: input.filters.activeQuery
  });
  const visibleSelectableRows = visibleRows.filter(isSelectableActionViewRow);
  const optionValues = new Set<string>(["all"]);

  input.items
    .map((item) => getItemEventGroupLabel(item, input.eventInstances).trim())
    .filter((value): value is string => Boolean(value))
    .forEach((value) => optionValues.add(value));

  collateralRows
    .map((item) => item.eventGroupLabel.trim())
    .filter((value) => Boolean(value))
    .forEach((value) => optionValues.add(value));

  return {
    eventGroupOptions: [...optionValues].map((value) => ({
      label: value === "all" ? "All Events" : value,
      value
    })),
    groupedRows: groupActionViewRowsByEventGroup(visibleRows),
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
