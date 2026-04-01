import type { ActionItem } from "@/lib/sample-data";
import type { EventInstance, EventProgram, EventSubEvent } from "@/lib/event-instances";
import {
  getActionRowClassName,
  getItemEventGroupLabel,
  getItemSubEventLabel
} from "@/lib/action-view-utils";
import {
  getCollateralExecutionDueLabel,
  getCollateralExecutionRowClassName,
  type CollateralExecutionRow
} from "@/lib/collateral-execution-view";
import {
  formatDueLabel,
  isBlockedItem,
  isTerminalStatus,
  isWaitingIssue
} from "@/lib/ops-utils";

export type NativeActionViewRow = {
  id: string;
  kind: "action";
  actionItemId: string;
  opens: "actionDrawer";
  isSelectable: true;
  title: string;
  dueDate: string;
  owner: string;
  statusLabel: string;
  eventGroupLabel: string;
  lastUpdated: string;
  dueLabel: string;
  rowClassName?: string;
  isBlocked: boolean;
  isWaiting: boolean;
  isOverdue: boolean;
  isDueSoon: boolean;
  isTerminal: boolean;
  waitingLabel: string;
  blockedBy: string;
  issueLabel: string;
  subEventLabel: string;
  workstreamLabel: string;
  typeLabel: string;
  searchValues: string[];
};

export type CollateralActionViewRow = {
  id: string;
  kind: "collateral";
  collateralId: string;
  eventInstanceId: string;
  opens: "collateral";
  isSelectable: false;
  title: string;
  dueDate: string;
  owner: string;
  statusLabel: string;
  eventGroupLabel: string;
  lastUpdated: string;
  dueLabel: string;
  rowClassName?: string;
  isBlocked: boolean;
  isWaiting: boolean;
  isOverdue: boolean;
  isDueSoon: boolean;
  isTerminal: boolean;
  subEventName: string;
  printer: string;
  blockedBy: string;
  badgeLabel: "Collateral";
  typeLabel: "Collateral";
  eventInstanceName: string;
  searchValues: string[];
};

export type ActionViewRow = NativeActionViewRow | CollateralActionViewRow;

export function getVisibleActionViewRows(input: {
  actionItems: ActionItem[];
  collateralRows: CollateralExecutionRow[];
  eventInstances: EventInstance[];
  eventPrograms?: EventProgram[];
  eventSubEvents: EventSubEvent[];
  activeQuery?: string;
}) {
  const eventPrograms = input.eventPrograms ?? [];

  return [
    ...input.actionItems.map((item) =>
      mapActionItemToRow(item, input.eventInstances, eventPrograms, input.eventSubEvents)
    ),
    ...input.collateralRows.map(mapCollateralRow)
  ]
    .filter((row) => matchesActionViewRowSearch(row, input.activeQuery))
    .sort(sortActionViewRows);
}

export function groupActionViewRowsByEventGroup(rows: ActionViewRow[]) {
  const groups: { label: string; items: ActionViewRow[] }[] = [];

  for (const row of rows) {
    const existingGroup = groups.find((group) => group.label === row.eventGroupLabel);

    if (existingGroup) {
      existingGroup.items.push(row);
      continue;
    }

    groups.push({
      label: row.eventGroupLabel,
      items: [row]
    });
  }

  return groups;
}

export function isSelectableActionViewRow(row: ActionViewRow): row is NativeActionViewRow {
  return row.kind === "action";
}

function mapActionItemToRow(
  item: ActionItem,
  eventInstances: EventInstance[],
  eventPrograms: EventProgram[],
  eventSubEvents: EventSubEvent[]
): NativeActionViewRow {
  const dueLabel = !isTerminalStatus(item.status) ? formatDueLabel(item) : "";
  const linkedSubEventLabel = getItemSubEventLabel(item, eventSubEvents);

  return {
    id: item.id,
    kind: "action",
    actionItemId: item.id,
    opens: "actionDrawer",
    isSelectable: true,
    title: item.title,
    dueDate: item.dueDate,
    owner: item.owner,
    statusLabel: item.status,
    eventGroupLabel: getItemEventGroupLabel(item, eventInstances, eventPrograms),
    lastUpdated: item.lastUpdated,
    dueLabel,
    rowClassName: getActionRowClassName(item),
    isBlocked: isBlockedItem(item),
    isWaiting: isWaitingIssue(item),
    isOverdue: dueLabel === "Overdue",
    isDueSoon: Boolean(dueLabel) && dueLabel !== "Overdue",
    isTerminal: isTerminalStatus(item.status),
    waitingLabel: item.waitingOn,
    blockedBy: item.blockedBy ?? "",
    issueLabel: item.issue ?? "",
    subEventLabel: linkedSubEventLabel,
    workstreamLabel: item.workstream,
    typeLabel: item.type,
    searchValues: [
      item.title,
      item.status,
      item.owner,
      item.waitingOn,
      item.type,
      item.workstream,
      item.issue ?? "",
      item.operationalBucket ?? "",
      item.eventGroup ?? "",
      getItemEventGroupLabel(item, eventInstances, eventPrograms),
      linkedSubEventLabel
    ]
  };
}

function mapCollateralRow(row: CollateralExecutionRow): CollateralActionViewRow {
  const dueLabel = getCollateralExecutionDueLabel(row);

  return {
    id: row.id,
    kind: "collateral",
    collateralId: row.collateralId,
    eventInstanceId: row.eventInstanceId,
    opens: "collateral",
    isSelectable: false,
    title: row.title,
    dueDate: row.dueDate,
    owner: row.owner,
    statusLabel: row.status,
    eventGroupLabel: row.eventGroupLabel,
    lastUpdated: row.lastUpdated,
    dueLabel,
    rowClassName: getCollateralExecutionRowClassName(row),
    isBlocked: row.status === "Blocked" || Boolean(row.blockedBy?.trim()),
    isWaiting: row.status === "Waiting",
    isOverdue: dueLabel === "Overdue",
    isDueSoon: dueLabel === "Due Soon",
    isTerminal: false,
    subEventName: row.subEventName,
    printer: row.printer,
    blockedBy: row.blockedBy,
    badgeLabel: "Collateral",
    typeLabel: "Collateral",
    eventInstanceName: row.eventInstanceName,
    searchValues: [
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
  };
}

function sortActionViewRows(a: ActionViewRow, b: ActionViewRow) {
  const priorityDelta = getActionViewRowPriority(b) - getActionViewRowPriority(a);

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

function getActionViewRowPriority(row: ActionViewRow) {
  if (row.isBlocked) {
    return 4;
  }

  if (row.isOverdue) {
    return 3;
  }

  if (row.isWaiting) {
    return 2;
  }

  if (row.isDueSoon) {
    return 1;
  }

  return 0;
}

function matchesActionViewRowSearch(row: ActionViewRow, query?: string) {
  const normalizedQuery = query?.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  return row.searchValues
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(normalizedQuery));
}
