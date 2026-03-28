import type { ActionItem } from "@/lib/sample-data";
import {
  type ActionFilter,
  type ActionFocus,
  type ActionLens,
  formatDueLabel,
  isBlockedItem,
  isItemMissingDueDate,
  isWaitingIssue,
  matchesActionFilter,
  matchesActionFocus,
  matchesActionLens,
  matchesEventGroup,
  matchesSearchQuery
} from "@/lib/ops-utils";

export type ActionViewFilters = {
  activeDueDate: string;
  activeEventGroup: string;
  activeFilter: ActionFilter;
  activeFocus: ActionFocus;
  activeLens: ActionLens;
  activeIssue: string;
  activeQuery: string;
  showCompleted: boolean;
};

export function getActionFilterValue(filter?: string): ActionFilter {
  if (filter === "overdue" || filter === "dueSoon" || filter === "waiting" || filter === "blocked" || filter === "mine") {
    return filter;
  }

  return "all";
}

export function getActionFocusValue(focus?: string): ActionFocus {
  if (focus === "sponsor" || focus === "production") {
    return focus;
  }

  return "all";
}

export function getActionLensValue(lens?: string): ActionLens {
  if (
    lens === "executionNow" ||
    lens === "plannedLater" ||
    lens === "reviewMissingDueDate" ||
    lens === "reviewWaitingTooLong" ||
    lens === "reviewStale"
  ) {
    return lens;
  }

  return "all";
}

export function getActionEventGroupValue(eventGroup?: string) {
  return eventGroup?.trim() || "all";
}

export function getActionDueDateValue(dueDate?: string) {
  return dueDate?.trim() || "";
}

export function getActionQueryValue(query?: string) {
  return query?.trim() || "";
}

export function getItemEventGroupLabel(item: ActionItem) {
  return item.eventGroup?.trim() || "Unassigned";
}

export function getVisibleActionItems(items: ActionItem[], filters: ActionViewFilters) {
  return items.filter((item) => {
    if (!filters.showCompleted && item.status === "Complete") {
      return false;
    }

    if (filters.activeIssue && item.issue !== filters.activeIssue) {
      return false;
    }

    if (filters.activeDueDate && item.dueDate !== filters.activeDueDate) {
      return false;
    }

    return (
      matchesActionFilter(item, filters.activeFilter) &&
      matchesActionFocus(item, filters.activeFocus) &&
      matchesActionLens(item, filters.activeLens) &&
      matchesEventGroup(item, filters.activeEventGroup) &&
      matchesSearchQuery(item, filters.activeQuery)
    );
  });
}

export function groupItemsByEventGroup(items: ActionItem[]) {
  const groups: { label: string; items: ActionItem[] }[] = [];

  for (const item of items) {
    const groupLabel = getItemEventGroupLabel(item);
    const existingGroup = groups.find((group) => group.label === groupLabel);

    if (existingGroup) {
      existingGroup.items.push(item);
      continue;
    }

    groups.push({
      label: groupLabel,
      items: [item]
    });
  }

  return groups;
}

export function getActionRowClassName(item: ActionItem) {
  if (item.status === "Cut") {
    return "cut-row";
  }

  if (isBlockedItem(item)) {
    return "blocked-row";
  }

  if (isItemMissingDueDate(item)) {
    return "risk-row";
  }

  if (isWaitingIssue(item)) {
    return "waiting-row";
  }

  if (formatDueLabel(item) === "Overdue") {
    return "overdue-row";
  }

  if (formatDueLabel(item)) {
    return "due-soon-row";
  }

  return undefined;
}
