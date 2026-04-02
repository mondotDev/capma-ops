import type { CollateralItem } from "@/lib/collateral-data";
import {
  getCollateralExecutionDueLabel,
  getVisibleCollateralExecutionRows
} from "@/lib/collateral-execution-view";
import type { EventInstance, EventProgram, EventSubEvent } from "@/lib/event-instances";
import {
  daysUntil,
  formatShortDate,
  isArchivedItem,
  isBlockedItem,
  isItemDueSoon,
  isItemMissingDueDate,
  isOverdue,
  isProductionRisk,
  isTerminalStatus,
  isWaitingIssue,
} from "@/lib/ops-utils";
import type { ActionItem } from "@/lib/sample-data";

export type DashboardExecutionItem = {
  id: string;
  kind: "action" | "collateral";
  title: string;
  workstream: string;
  dueDate: string;
  status: string;
  blockedBy: string;
  waitingOn: string;
  lastUpdated: string;
  isBlocked: boolean;
  isWaiting: boolean;
  isOverdue: boolean;
  isDueSoon: boolean;
  isTerminal: boolean;
  isMissingDueDate: boolean;
  isProductionRisk: boolean;
};

export function buildDashboardExecutionItems(input: {
  activeEventInstanceId: string;
  collateralItems: CollateralItem[];
  eventInstances: EventInstance[];
  eventPrograms?: EventProgram[];
  eventTypes?: EventProgram[];
  eventSubEvents: EventSubEvent[];
  items: ActionItem[];
}): DashboardExecutionItem[] {
  const eventPrograms = input.eventPrograms ?? input.eventTypes ?? [];
  const collateralRows = getVisibleCollateralExecutionRows({
    activeDueDate: "",
    activeEventGroup: "all",
    activeEventInstanceId: input.activeEventInstanceId,
    activeFilter: "all",
    activeFocus: "all",
    activeIssue: "",
    activeLens: "all",
    activeQuery: "",
    collateralItems: input.collateralItems,
    eventInstances: input.eventInstances,
    eventSubEvents: input.eventSubEvents,
    eventPrograms,
  });

  return [
    ...input.items
      .filter((item) => !isArchivedItem(item))
      .map((item) => ({
      id: item.id,
      kind: "action" as const,
      title: item.title,
      workstream: item.workstream,
      dueDate: item.dueDate,
      status: item.status,
      blockedBy: item.blockedBy ?? "",
      waitingOn: item.waitingOn,
      lastUpdated: item.lastUpdated,
      isBlocked: isBlockedItem(item),
      isWaiting: isWaitingIssue(item),
      isOverdue: isOverdue(item.dueDate) && !isTerminalStatus(item.status),
      isDueSoon: isItemDueSoon(item),
      isTerminal: isTerminalStatus(item.status),
      isMissingDueDate: isItemMissingDueDate(item),
      isProductionRisk: isProductionRisk(item),
    })),
    ...collateralRows.map((row) => {
      const dueLabel = getCollateralExecutionDueLabel(row);

      return {
        id: row.id,
        kind: "collateral" as const,
        title: row.title,
        workstream: row.workstreamLabel,
        dueDate: row.dueDate,
        status: row.status,
        blockedBy: row.blockedBy,
        waitingOn: "",
        lastUpdated: row.lastUpdated,
        isBlocked: row.status === "Blocked" || Boolean(row.blockedBy?.trim()),
        isWaiting: row.status === "Waiting",
        isOverdue: dueLabel === "Overdue",
        isDueSoon: dueLabel === "Due Soon",
        isTerminal: false,
        isMissingDueDate: false,
        isProductionRisk: true,
      };
    }),
  ];
}

export function formatDashboardExecutionItem(item: DashboardExecutionItem) {
  return `${item.title} - ${item.workstream} - ${formatDashboardExecutionDueLabel(item)}`;
}

export function getDashboardExecutionImmediateRiskPreview(item: DashboardExecutionItem) {
  if (item.isMissingDueDate || !item.dueDate.trim()) {
    return {
      title: item.title,
      meta: `Needs date - ${item.workstream}`,
    };
  }

  const dueLabel = formatDashboardExecutionDueLabel(item);

  if (item.isOverdue) {
    const overdueDays = Math.abs(daysFromToday(item.dueDate));
    return {
      title: item.title,
      meta: `Overdue ${overdueDays}d - due ${formatShortDate(item.dueDate)} - ${item.workstream}`,
    };
  }

  if (daysFromToday(item.dueDate) === 0) {
    return {
      title: item.title,
      meta: `Due today - due ${formatShortDate(item.dueDate)} - ${item.workstream}`,
    };
  }

  return {
    title: item.title,
    meta: `${dueLabel} - due ${formatShortDate(item.dueDate)} - ${item.workstream}`,
  };
}

function formatDashboardExecutionDueLabel(item: DashboardExecutionItem) {
  if (item.isMissingDueDate || !item.dueDate.trim()) {
    return "Needs date";
  }

  if (item.isOverdue) {
    return "Overdue";
  }

  const days = daysFromToday(item.dueDate);

  if (days === 0) {
    return "Due today";
  }

  if (days > 0) {
    return `Due in ${days}d`;
  }

  return "Overdue";
}

function daysFromToday(dateValue: string) {
  return daysUntil(dateValue);
}
