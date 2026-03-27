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

const NEWS_BRIEF_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;

const VOICE_ISSUE_CONFIG = {
  2026: {
    Spring: "2026-01-22",
    Summer: "2026-04-30",
    Fall: "2026-07-23",
    Winter: "2026-10-22"
  },
  2027: {
    Spring: undefined,
    Summer: undefined,
    Fall: undefined,
    Winter: undefined
  }
} as const;

export type ActionFilter = "all" | "overdue" | "dueSoon" | "waiting" | "mine";
export type ActionFocus = "all" | "sponsor" | "production";
export type IssueDefinition = {
  label: string;
  workstream: "News Brief" | "The Voice";
  dueDate?: string;
};

export type ActionSummaryCounts = {
  overdue: number;
  dueSoon: number;
  waiting: number;
  totalActive: number;
};

const NEWS_BRIEF_ISSUES = buildNewsBriefIssues([2026, 2027]);
const VOICE_ISSUES = buildVoiceIssues();
export const ISSUE_DEFINITIONS = [...NEWS_BRIEF_ISSUES, ...VOICE_ISSUES];
export const ISSUE_OPTIONS = ISSUE_DEFINITIONS.map((issue) => issue.label);

export function parseDate(dateValue: string) {
  if (!dateValue) {
    return null;
  }

  return new Date(`${dateValue}T00:00:00`);
}

export function isComplete(item: ActionItem) {
  return item.status === "Complete";
}

export function getActiveItems(items: ActionItem[]) {
  return items.filter((item) => !isComplete(item));
}

export function hasDueDate(item: Pick<ActionItem, "dueDate"> | string) {
  const dueDate = typeof item === "string" ? item : item.dueDate;
  return dueDate.trim().length > 0;
}

export function daysUntil(dateValue: string) {
  const parsedDate = parseDate(dateValue);

  if (!parsedDate) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.ceil((parsedDate.getTime() - TODAY.getTime()) / (24 * 60 * 60 * 1000));
}

export function isOverdue(dueDate: string) {
  const parsedDate = parseDate(dueDate);
  return Boolean(parsedDate && parsedDate.getTime() < TODAY.getTime());
}

export function isDueSoon(dueDate: string) {
  if (!hasDueDate(dueDate)) {
    return false;
  }

  const days = daysUntil(dueDate);
  return days >= 0 && days <= 3;
}

export function isWaitingIssue(item: ActionItem) {
  return item.status === "Waiting";
}

export function isWaitingMissingReason(item: ActionItem) {
  return isWaitingIssue(item) && item.waitingOn.trim().length === 0;
}

export function isPublicationWorkstream(workstream: string) {
  return workstream === "News Brief" || workstream === "The Voice";
}

export function getIssueDefinition(issue: string) {
  return ISSUE_DEFINITIONS.find((definition) => definition.label === issue);
}

export function getIssuesForWorkstream(workstream: string) {
  return ISSUE_DEFINITIONS.filter((issue) => issue.workstream === workstream).map((issue) => issue.label);
}

export function getIssueDueDate(issue?: string) {
  if (!issue) {
    return undefined;
  }

  return getIssueDefinition(issue)?.dueDate;
}

export function getWorkstreamForIssue(issue: string) {
  return getIssueDefinition(issue)?.workstream;
}

export function isIssueMissingDueDate(issue?: string) {
  if (!issue) {
    return false;
  }

  return getIssueDefinition(issue) !== undefined && !getIssueDueDate(issue);
}

export function isItemMissingDueDate(item: ActionItem) {
  return Boolean(item.issue && isIssueMissingDueDate(item.issue) && !hasDueDate(item.dueDate));
}

export function shouldRequireIssue(itemType: string, workstream: string) {
  return itemType === "Deliverable" && isPublicationWorkstream(workstream);
}

export function getOpenCountForIssue(items: ActionItem[], issue: string) {
  return getActiveItems(items).filter((item) => item.issue === issue).length;
}

export function formatShortDate(dateValue: string) {
  const parsedDate = parseDate(dateValue);

  if (!parsedDate) {
    return "No due date set";
  }

  return parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

export function formatRelativeDueLabel(item: ActionItem) {
  if (isItemMissingDueDate(item)) {
    return "missing issue setup";
  }

  if (!hasDueDate(item.dueDate)) {
    return "no due date set";
  }

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
  return `${item.title} — ${item.issue ?? item.workstream} — ${formatRelativeDueLabel(item)}`;
}

export function formatItemWithWorkstream(item: ActionItem) {
  return `${item.title} — ${item.workstream}`;
}

export function formatDueLabel(item: ActionItem) {
  if (isItemMissingDueDate(item) || !hasDueDate(item.dueDate)) {
    return "No due date set";
  }

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
  const aMissingIssueDueDate = isItemMissingDueDate(a);
  const bMissingIssueDueDate = isItemMissingDueDate(b);

  if (aMissingIssueDueDate !== bMissingIssueDueDate) {
    return aMissingIssueDueDate ? -1 : 1;
  }

  const aOverdue = isOverdue(a.dueDate);
  const bOverdue = isOverdue(b.dueDate);

  if (aOverdue !== bOverdue) {
    return aOverdue ? -1 : 1;
  }

  const aHasDueDate = hasDueDate(a.dueDate);
  const bHasDueDate = hasDueDate(b.dueDate);

  if (aHasDueDate !== bHasDueDate) {
    return aHasDueDate ? -1 : 1;
  }

  const dueDiff = daysUntil(a.dueDate) - daysUntil(b.dueDate);

  if (Number.isFinite(dueDiff) && dueDiff !== 0) {
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
    isItemMissingDueDate(item) ||
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
    .filter((item) => isItemMissingDueDate(item) || isOverdue(item.dueDate) || isDueSoon(item.dueDate))
    .sort(sortByPriority)
    .slice(0, 3);

  const sponsorRiskItems = activeItems.filter(isSponsorRelated).sort(sortByPriority).slice(0, 3);
  const productionRiskItems = activeItems.filter(isProductionRisk).sort(sortByPriority).slice(0, 3);

  const workstreamOpenCounts = activeItems.reduce<Record<string, number>>((counts, item) => {
    counts[item.workstream] = (counts[item.workstream] ?? 0) + 1;
    return counts;
  }, {});

  const issueOpenCounts = ISSUE_OPTIONS.reduce<Record<string, number>>((counts, issue) => {
    counts[issue] = getOpenCountForIssue(items, issue);
    return counts;
  }, {});

  const issueSetupRisks = ISSUE_OPTIONS.map((issue) => ({
    issue,
    count: activeItems.filter((item) => item.issue === issue && isItemMissingDueDate(item)).length
  })).filter((entry) => entry.count > 0);

  return {
    ...summary,
    urgentItems,
    waitingGroups: Object.entries(waitingGroups),
    sponsorRiskItems,
    productionRiskItems,
    workstreamOpenCounts,
    issueOpenCounts,
    issueSetupRisks
  };
}

function buildNewsBriefIssues(years: number[]) {
  return years.flatMap((year) =>
    NEWS_BRIEF_MONTHS.map((month, monthIndex) => ({
      label: `${month} ${year} News Brief`,
      workstream: "News Brief" as const,
      dueDate: getNewsBriefDueDate(year, monthIndex)
    }))
  );
}

function buildVoiceIssues() {
  return Object.entries(VOICE_ISSUE_CONFIG).flatMap(([year, seasons]) =>
    Object.entries(seasons).map(([season, dueDate]) => ({
      label: `${season} ${year} The Voice`,
      workstream: "The Voice" as const,
      dueDate
    }))
  );
}

function getNewsBriefDueDate(year: number, monthIndex: number) {
  const candidate = new Date(Date.UTC(year, monthIndex, 20));
  const day = candidate.getUTCDay();

  if (day === 6) {
    candidate.setUTCDate(candidate.getUTCDate() - 1);
  } else if (day === 0) {
    candidate.setUTCDate(candidate.getUTCDate() - 2);
  }

  return candidate.toISOString().slice(0, 10);
}
