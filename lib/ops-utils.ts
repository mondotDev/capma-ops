import type { ActionItem } from "@/lib/sample-data";

export const STATUS_OPTIONS = ["Not Started", "In Progress", "Waiting", "Complete"] as const;
export const WAITING_ON_SUGGESTIONS = ["Sponsor", "Vendor", "Assets", "Internal", "Crystelle"] as const;
export const WORKSTREAM_OPTIONS = [
  "Legislative Day",
  "Best Pest Expo",
  "Pest Ed",
  "Termite Academy",
  "First Fridays",
  "Hands-On Workshops",
  "Development Summit",
  "News Brief",
  "The Voice",
  "Membership Campaigns",
  "General Operations"
] as const;
export const TODAY = new Date("2026-03-27T00:00:00");
export const DEFAULT_OWNER = "Melissa";

export type ActionFilter = "all" | "overdue" | "dueSoon" | "waiting" | "mine";
export type ActionFocus = "all" | "sponsor" | "production";

export type ActionSummaryCounts = {
  overdue: number;
  dueSoon: number;
  waiting: number;
  totalActive: number;
};

export function parseDate(dateValue: string) {
  return new Date(`${dateValue}T00:00:00`);
}

export function isComplete(item: ActionItem) {
  return item.status === "Complete";
}

export function getActiveItems(items: ActionItem[]) {
  return items.filter((item) => !isComplete(item));
}

export function daysUntil(dateValue: string) {
  return Math.ceil((parseDate(dateValue).getTime() - TODAY.getTime()) / (24 * 60 * 60 * 1000));
}

export function isOverdue(dueDate: string) {
  return parseDate(dueDate).getTime() < TODAY.getTime();
}

export function isDueSoon(dueDate: string) {
  const days = daysUntil(dueDate);
  return days >= 0 && days <= 3;
}

export function isWaitingIssue(item: ActionItem) {
  return item.status === "Waiting";
}

export function isWaitingMissingReason(item: ActionItem) {
  return isWaitingIssue(item) && item.waitingOn.trim().length === 0;
}

export function formatShortDate(dateValue: string) {
  return parseDate(dateValue).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

export function formatRelativeDueLabel(item: ActionItem) {
  if (isWaitingIssue(item)) {
    return item.waitingOn ? `waiting on ${item.waitingOn}` : "waiting on required input";
  }

  const days = daysUntil(item.dueDate);

  if (days < 0) {
    return "overdue";
  }

  if (days === 0) {
    return "due today";
  }

  if (days <= 3) {
    return `due in ${days} day${days === 1 ? "" : "s"}`;
  }

  return `due ${formatShortDate(item.dueDate)}`;
}

export function formatDashboardItem(item: ActionItem) {
  return `${item.title} — ${item.workstream} — ${formatRelativeDueLabel(item)}`;
}

export function formatItemWithWorkstream(item: ActionItem) {
  return `${item.title} — ${item.workstream}`;
}

export function formatDueLabel(item: ActionItem) {
  const days = daysUntil(item.dueDate);

  if (days < 0) {
    return "Overdue";
  }

  if (days === 0) {
    return "Due today";
  }

  if (days <= 3) {
    return `Due in ${days} day${days === 1 ? "" : "s"}`;
  }

  return "";
}

export function sortByPriority(a: ActionItem, b: ActionItem) {
  const aOverdue = isOverdue(a.dueDate);
  const bOverdue = isOverdue(b.dueDate);

  if (aOverdue !== bOverdue) {
    return aOverdue ? -1 : 1;
  }

  const dueDiff = parseDate(a.dueDate).getTime() - parseDate(b.dueDate).getTime();

  if (dueDiff !== 0) {
    return dueDiff;
  }

  return a.title.localeCompare(b.title);
}

export function isSponsorRelated(item: ActionItem) {
  const haystack = `${item.title} ${item.workstream} ${item.waitingOn} ${item.type}`.toLowerCase();
  return haystack.includes("sponsor");
}

export function isProductionRisk(item: ActionItem) {
  const haystack = `${item.title} ${item.notes} ${item.waitingOn} ${item.type}`.toLowerCase();
  return (
    haystack.includes("missing file") ||
    haystack.includes("missing printer") ||
    haystack.includes("not ready") ||
    haystack.includes("printer") ||
    haystack.includes("production")
  );
}

export function matchesActionFilter(item: ActionItem, filter: ActionFilter) {
  if (filter === "overdue") {
    return !isComplete(item) && isOverdue(item.dueDate);
  }

  if (filter === "dueSoon") {
    return !isComplete(item) && isDueSoon(item.dueDate);
  }

  if (filter === "waiting") {
    return isWaitingIssue(item);
  }

  if (filter === "mine") {
    return item.owner === DEFAULT_OWNER;
  }

  return true;
}

export function matchesActionFocus(item: ActionItem, focus: ActionFocus) {
  if (focus === "sponsor") {
    return isSponsorRelated(item);
  }

  if (focus === "production") {
    return isProductionRisk(item);
  }

  return true;
}

export function getActionSummaryCounts(items: ActionItem[]): ActionSummaryCounts {
  const activeItems = getActiveItems(items);

  return {
    overdue: activeItems.filter((item) => isOverdue(item.dueDate)).length,
    dueSoon: activeItems.filter((item) => isDueSoon(item.dueDate)).length,
    waiting: activeItems.filter((item) => isWaitingIssue(item)).length,
    totalActive: activeItems.length
  };
}

export function getDashboardMetrics(items: ActionItem[]) {
  const activeItems = getActiveItems(items);
  const summary = getActionSummaryCounts(items);
  const waitingGroups = activeItems.reduce<Record<string, string[]>>((groups, item) => {
    if (!item.waitingOn || !isWaitingIssue(item)) {
      return groups;
    }

    groups[item.waitingOn] = [...(groups[item.waitingOn] ?? []), formatDashboardItem(item)];
    return groups;
  }, {});

  const urgentItems = activeItems
    .filter((item) => isOverdue(item.dueDate) || isDueSoon(item.dueDate))
    .sort(sortByPriority)
    .slice(0, 3);

  const sponsorRiskItems = activeItems.filter(isSponsorRelated).sort(sortByPriority).slice(0, 3);
  const productionRiskItems = activeItems.filter(isProductionRisk).sort(sortByPriority).slice(0, 3);

  const workstreamOpenCounts = activeItems.reduce<Record<string, number>>((counts, item) => {
    counts[item.workstream] = (counts[item.workstream] ?? 0) + 1;
    return counts;
  }, {});

  return {
    ...summary,
    urgentItems,
    waitingGroups: Object.entries(waitingGroups),
    sponsorRiskItems,
    productionRiskItems,
    workstreamOpenCounts
  };
}
