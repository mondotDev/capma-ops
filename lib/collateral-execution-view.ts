import {
  isCollateralBlocked,
  isCollateralDueSoon,
  isCollateralOverdue,
  type CollateralItem
} from "@/lib/collateral-data";
import { supportsCollateralEventType } from "@/lib/collateral-templates";
import {
  resolveActiveEventInstanceId,
  type EventInstance,
  type EventSubEvent,
  type EventType
} from "@/lib/event-instances";
import {
  DEFAULT_OWNER,
  type ActionFilter,
  type ActionFocus,
  type ActionLens,
  normalizeOwnerValue
} from "@/lib/ops-utils";

export type CollateralExecutionRow = {
  kind: "collateral";
  id: string;
  collateralId: string;
  eventInstanceId: string;
  eventInstanceName: string;
  eventTypeName: string;
  subEventId: string;
  subEventName: string;
  title: string;
  status: CollateralItem["status"];
  dueDate: string;
  owner: string;
  blockedBy: string;
  printer: string;
  lastUpdated: string;
  typeLabel: "Collateral";
  workstreamLabel: string;
  eventGroupLabel: string;
};

const SURFACED_COLLATERAL_STATUSES = new Set<CollateralItem["status"]>([
  "In Design",
  "Waiting",
  "Blocked",
  "Ready for Print"
]);

export function getVisibleCollateralExecutionRows(input: {
  activeDueDate: string;
  activeEventGroup: string;
  activeEventInstanceId: string;
  activeFilter: ActionFilter;
  activeFocus: ActionFocus;
  activeIssue: string;
  activeLens: ActionLens;
  activeQuery: string;
  collateralItems: CollateralItem[];
  eventInstances: EventInstance[];
  eventSubEvents: EventSubEvent[];
  eventTypes: EventType[];
}) {
  const resolvedActiveEventInstanceId = resolveActiveEventInstanceId(
    input.activeEventInstanceId,
    input.eventInstances
  );
  const activeEventInstance =
    input.eventInstances.find((instance) => instance.id === resolvedActiveEventInstanceId) ?? null;

  if (!activeEventInstance || input.activeIssue) {
    return [];
  }

  const activeEventType =
    input.eventTypes.find((eventType) => eventType.id === activeEventInstance.eventTypeId) ?? null;

  if (!activeEventType || !supportsCollateralEventType(activeEventType.id)) {
    return [];
  }

  const subEventNameById = new Map(
    input.eventSubEvents
      .filter((subEvent) => subEvent.eventInstanceId === resolvedActiveEventInstanceId)
      .map((subEvent) => [subEvent.id, subEvent.name])
  );

  return input.collateralItems
    .filter(
      (item) =>
        item.eventInstanceId === resolvedActiveEventInstanceId &&
        SURFACED_COLLATERAL_STATUSES.has(item.status)
    )
    .map<CollateralExecutionRow>((item) => ({
      kind: "collateral",
      id: `collateral-execution-${item.id}`,
      collateralId: item.id,
      eventInstanceId: item.eventInstanceId,
      eventInstanceName: activeEventInstance.name,
      eventTypeName: activeEventType?.name ?? "Event",
      subEventId: item.subEventId,
      subEventName: subEventNameById.get(item.subEventId) ?? "Unassigned",
      title: item.itemName,
      status: item.status,
      dueDate: item.dueDate,
      owner: item.owner,
      blockedBy: item.blockedBy,
      printer: item.printer,
      lastUpdated: item.lastUpdated,
      typeLabel: "Collateral",
      workstreamLabel: activeEventType?.name ?? "Collateral",
      eventGroupLabel: activeEventInstance.name
    }))
    .filter(
      (row) =>
        matchesCollateralExecutionDueDate(row, input.activeDueDate) &&
        matchesCollateralExecutionFocus(row, input.activeFocus) &&
        matchesCollateralExecutionLens(row, input.activeLens) &&
        matchesCollateralExecutionFilter(row, input.activeFilter) &&
        matchesCollateralExecutionEventGroup(row, input.activeEventGroup) &&
        matchesCollateralExecutionSearch(row, input.activeQuery)
    )
    .sort(sortCollateralExecutionRows);
}

export function getCollateralExecutionRowClassName(row: CollateralExecutionRow) {
  if (isCollateralBlocked(row)) {
    return "blocked-row";
  }

  if (isCollateralOverdue(row)) {
    return "overdue-row";
  }

  if (row.status === "Waiting") {
    return "waiting-row";
  }

  if (isCollateralDueSoon(row)) {
    return "due-soon-row";
  }

  return undefined;
}

export function getCollateralExecutionDueLabel(row: CollateralExecutionRow) {
  if (isCollateralOverdue(row)) {
    return "Overdue";
  }

  if (isCollateralDueSoon(row)) {
    return "Due Soon";
  }

  return "";
}

function matchesCollateralExecutionFilter(row: CollateralExecutionRow, filter: ActionFilter) {
  if (filter === "overdue") {
    return isCollateralOverdue(row);
  }

  if (filter === "dueSoon") {
    return isCollateralDueSoon(row);
  }

  if (filter === "waiting") {
    return row.status === "Waiting" && !isCollateralBlocked(row);
  }

  if (filter === "blocked") {
    return isCollateralBlocked(row);
  }

  if (filter === "mine") {
    return normalizeOwnerValue(row.owner) === DEFAULT_OWNER;
  }

  return true;
}

function matchesCollateralExecutionFocus(row: CollateralExecutionRow, focus: ActionFocus) {
  if (focus === "sponsor") {
    return false;
  }

  if (focus === "production") {
    return true;
  }

  return true;
}

function matchesCollateralExecutionLens(row: CollateralExecutionRow, lens: ActionLens) {
  if (lens === "all" || lens === "executionNow") {
    return true;
  }

  return false;
}

function matchesCollateralExecutionEventGroup(row: CollateralExecutionRow, activeEventGroup: string) {
  if (!activeEventGroup || activeEventGroup === "all") {
    return true;
  }

  return row.eventGroupLabel === activeEventGroup;
}

function matchesCollateralExecutionDueDate(row: CollateralExecutionRow, activeDueDate: string) {
  if (!activeDueDate) {
    return true;
  }

  return row.dueDate === activeDueDate;
}

function matchesCollateralExecutionSearch(row: CollateralExecutionRow, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return [
    row.title,
    row.status,
    row.owner,
    row.subEventName,
    row.eventInstanceName,
    row.eventTypeName,
    row.printer,
    row.blockedBy,
    row.typeLabel
  ]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}

function sortCollateralExecutionRows(a: CollateralExecutionRow, b: CollateralExecutionRow) {
  const priorityDelta =
    getCollateralExecutionPriority(b) - getCollateralExecutionPriority(a);

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
    return a.dueDate.localeCompare(b.dueDate);
  }

  if (a.dueDate && !b.dueDate) {
    return -1;
  }

  if (!a.dueDate && b.dueDate) {
    return 1;
  }

  return a.title.localeCompare(b.title);
}

function getCollateralExecutionPriority(row: CollateralExecutionRow) {
  if (isCollateralBlocked(row)) {
    return 4;
  }

  if (isCollateralOverdue(row)) {
    return 3;
  }

  if (isCollateralDueSoon(row)) {
    return 2;
  }

  if (row.status === "Ready for Print") {
    return 1;
  }

  return 0;
}
