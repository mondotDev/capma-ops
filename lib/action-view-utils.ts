import type { ActionItem } from "@/lib/sample-data";
import type { EventInstance, EventProgram, EventSubEvent } from "@/lib/event-instances";
import { matchesActionScope } from "@/lib/action-scopes";
import {
  getActionItemEventGroupLabel,
  getActionItemSubEventLabel
} from "@/lib/events/event-labels";
import {
  type ActionFilter,
  type ActionFocus,
  type ActionLens,
  formatDueLabel,
  isArchivedItem,
  isBlockedItem,
  isItemMissingDueDate,
  isTerminalStatus,
  isWaitingIssue,
  matchesActionFilter,
  matchesActionFocus,
  matchesActionLens,
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
  showArchived?: boolean;
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
    lens === "reviewCollisions" ||
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

export function getCollisionReviewHref(dueDate?: string) {
  const params = new URLSearchParams();
  params.set("lens", "reviewCollisions");

  if (dueDate?.trim()) {
    params.set("dueDate", dueDate.trim());
  }

  return `/action?${params.toString()}`;
}

export function getItemEventGroupLabel(
  item: ActionItem,
  eventInstances: EventInstance[] = [],
  eventPrograms: EventProgram[] = []
) {
  return getActionItemEventGroupLabel(item, eventInstances, eventPrograms);
}

export function getItemSubEventLabel(item: ActionItem, eventSubEvents: EventSubEvent[] = []) {
  return getActionItemSubEventLabel(item, eventSubEvents);
}

export function getVisibleActionItems(
  items: ActionItem[],
  filters: ActionViewFilters,
  eventInstances: EventInstance[] = [],
  eventPrograms: EventProgram[] = [],
  options: { includeSearch?: boolean } = {}
) {
  const includeSearch = options.includeSearch ?? true;

  return items.filter((item) => {
    if (!(filters.showArchived ?? false) && isArchivedItem(item)) {
      return false;
    }

    if (!filters.showCompleted && isTerminalStatus(item.status)) {
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
      matchesActionScope(item, filters.activeEventGroup, eventPrograms, eventInstances) &&
      (!includeSearch || matchesSearchQuery(item, filters.activeQuery))
    );
  });
}

export function groupItemsByEventGroup(
  items: ActionItem[],
  eventInstances: EventInstance[] = [],
  eventPrograms: EventProgram[] = []
) {
  const groups: { label: string; items: ActionItem[] }[] = [];

  for (const item of items) {
    const groupLabel = getActionItemEventGroupLabel(item, eventInstances, eventPrograms);
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
  if (isArchivedItem(item)) {
    return "archived-row";
  }

  if (isTerminalStatus(item.status)) {
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
