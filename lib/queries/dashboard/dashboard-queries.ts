import {
  getDashboardExecutionImmediateRiskPreview,
  type DashboardExecutionItem
} from "@/lib/dashboard-execution-items";
import type { ActionItem } from "@/lib/sample-data";
import type { IssueRecord, PublicationIssueReadinessSignal, WorkstreamSchedule } from "@/lib/ops-utils";
import {
  getCurrentDate,
  getDashboardMetrics,
  getPublicationIssueReadiness,
  getVisiblePublicationIssues,
  getWorkstreamDateContext,
} from "@/lib/ops-utils";

export type DashboardQueryInput = {
  executionItems: DashboardExecutionItem[];
  items: ActionItem[];
  issues: IssueRecord[];
  workstreamSchedules: WorkstreamSchedule[];
};

export type DashboardUrgentPreviewItem = {
  id: string;
  title: string;
  meta: string;
};

export type DashboardWorkstreamSummaryRow = {
  workstream: string;
  total: number;
  overdue: number;
  dueSoon: number;
  inProgress: number;
  dateContext: ReturnType<typeof getWorkstreamDateContext>;
};

export type DashboardLoadEntry = {
  date: string;
  count: number;
};

export type PublicationIssueSummaryRow = {
  label: string;
  status: IssueRecord["status"];
  dueDate: string;
  completeCount: number;
  totalCount: number;
  progressPercent: number;
  progressCopy: string;
  canCompleteIssue: boolean;
  isMissingDueDate: boolean;
  readinessSignals: PublicationIssueReadinessSignal[];
};

export type DashboardLiveSummary = {
  overdue: number;
  dueSoon: number;
  blocked: number;
  waiting: number;
  blockedCount: number;
  stuckReasonCounts: ReturnType<typeof getDashboardMetrics>["stuckReasonCounts"];
  peakUpcomingLoadCount: number;
  peakUpcomingLoadDate: string | null;
  extendedDailyLoad: DashboardLoadEntry[];
  highestLoadCount: number;
  overviewLoadRows: DashboardLoadEntry[][];
  workstreamSummaryRows: DashboardWorkstreamSummaryRow[];
};

function getDashboardMetricsSource(items: ActionItem[]) {
  return getDashboardMetrics(items);
}

export function getDashboardLiveSummary(input: DashboardQueryInput): DashboardLiveSummary {
  const executionMetrics = getDashboardExecutionMetrics(input.executionItems);
  const extendedDailyLoad = getExecutionDailyLoad(input.executionItems, 14);
  const highestLoadCount = Math.max(...extendedDailyLoad.map((entry) => entry.count), 0);
  const overviewLoadRows = [extendedDailyLoad.slice(0, 7), extendedDailyLoad.slice(7, 14)];
  const workstreamSummaryRows = getExecutionWorkstreamSummary(input.executionItems).map((entry) => ({
    ...entry,
    dateContext: getWorkstreamDateContext(entry.workstream, input.workstreamSchedules, input.issues)
  }));

  return {
    overdue: executionMetrics.overdue,
    dueSoon: executionMetrics.dueSoon,
    blocked: executionMetrics.blocked,
    waiting: executionMetrics.waiting,
    blockedCount: executionMetrics.blockedCount,
    stuckReasonCounts: executionMetrics.stuckReasonCounts,
    peakUpcomingLoadCount: executionMetrics.peakUpcomingLoadCount,
    peakUpcomingLoadDate: executionMetrics.peakUpcomingLoadDate,
    extendedDailyLoad,
    highestLoadCount,
    overviewLoadRows,
    workstreamSummaryRows
  };
}

export function getDashboardUrgentPreview(input: DashboardQueryInput, limit: number): DashboardUrgentPreviewItem[] {
  return getDashboardExecutionMetrics(input.executionItems).urgentItems.slice(0, limit).map((item) => {
    const preview = getDashboardExecutionImmediateRiskPreview(item);

    return {
      id: item.id,
      title: preview.title,
      meta: preview.meta
    };
  });
}

function getDashboardExecutionMetrics(items: DashboardExecutionItem[]) {
  const activeItems = items.filter((item) => !item.isTerminal);
  const overdue = activeItems.filter((item) => item.isOverdue).length;
  const dueSoon = activeItems.filter((item) => item.isDueSoon).length;
  const blocked = activeItems.filter((item) => item.isBlocked).length;
  const waiting = activeItems.filter((item) => item.isWaiting && !item.isBlocked).length;
  const stuckItems = activeItems.filter((item) => item.isBlocked || item.isWaiting);
  const stuckReasonCounts = getExecutionStuckReasonCounts(stuckItems);
  const upcomingLoad = getExecutionDailyLoad(items, 7);
  const peakUpcomingLoadEntry = [...upcomingLoad].sort((a, b) => b.count - a.count || a.date.localeCompare(b.date))[0];
  const peakUpcomingLoadCount = peakUpcomingLoadEntry?.count ?? 0;
  const peakUpcomingLoadDate = peakUpcomingLoadEntry && peakUpcomingLoadEntry.count > 0 ? peakUpcomingLoadEntry.date : null;
  const urgentItems = activeItems
    .filter((item) => item.isMissingDueDate || item.isOverdue || item.isDueSoon)
    .sort(sortDashboardExecutionItemsByPriority)
    .slice(0, 3);
  return {
    overdue,
    dueSoon,
    blocked,
    waiting,
    blockedCount: blocked,
    stuckReasonCounts,
    peakUpcomingLoadCount,
    peakUpcomingLoadDate,
    urgentItems
  };
}

function getExecutionDailyLoad(items: DashboardExecutionItem[], days: number): DashboardLoadEntry[] {
  const startDate = getCurrentDate();
  const loadByDate = new Map<string, number>();

  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + offset);
    loadByDate.set(date.toISOString().slice(0, 10), 0);
  }

  for (const item of items) {
    if (item.isTerminal || !item.dueDate.trim()) {
      continue;
    }

    if (!loadByDate.has(item.dueDate)) {
      continue;
    }

    loadByDate.set(item.dueDate, (loadByDate.get(item.dueDate) ?? 0) + 1);
  }

  return Array.from(loadByDate, ([date, count]) => ({ date, count }));
}

function getExecutionWorkstreamSummary(items: DashboardExecutionItem[]) {
  const summaryByWorkstream = new Map<string, DashboardWorkstreamSummaryRow>();

  for (const item of items) {
    if (item.isTerminal) {
      continue;
    }

    const workstream = item.workstream.trim() || "Unassigned";
    const existingSummary = summaryByWorkstream.get(workstream) ?? {
      workstream,
      total: 0,
      overdue: 0,
      dueSoon: 0,
      inProgress: 0,
      dateContext: null
    };

    existingSummary.total += 1;

    if (item.isOverdue) {
      existingSummary.overdue += 1;
    }

    if (item.isDueSoon) {
      existingSummary.dueSoon += 1;
    }

    if (item.kind === "action" && item.status === "In Progress") {
      existingSummary.inProgress += 1;
    }

    summaryByWorkstream.set(workstream, existingSummary);
  }

  return [...summaryByWorkstream.values()].sort(
    (a, b) =>
      b.total - a.total ||
      b.overdue - a.overdue ||
      b.dueSoon - a.dueSoon ||
      a.workstream.localeCompare(b.workstream)
  );
}

function getExecutionStuckReasonCounts(items: DashboardExecutionItem[]) {
  const reasonCounts = items.reduce<Map<string, { count: number; hasWaiting: boolean; hasBlocked: boolean }>>(
    (counts, item) => {
      const reasons = new Map<string, { waiting: boolean; blocked: boolean }>();
      const waitingReason = normalizeExecutionReason(item.waitingOn);
      const blockedReason = normalizeExecutionReason(item.blockedBy);

      if (item.isWaiting) {
        reasons.set(waitingReason, {
          waiting: true,
          blocked: reasons.get(waitingReason)?.blocked ?? false
        });
      }

      if (item.isBlocked) {
        reasons.set(blockedReason, {
          waiting: reasons.get(blockedReason)?.waiting ?? false,
          blocked: true
        });
      }

      reasons.forEach((reasonState, label) => {
        const existing = counts.get(label);
        counts.set(label, {
          count: (existing?.count ?? 0) + 1,
          hasWaiting: (existing?.hasWaiting ?? false) || reasonState.waiting,
          hasBlocked: (existing?.hasBlocked ?? false) || reasonState.blocked
        });
      });

      return counts;
    },
    new Map()
  );

  return [...reasonCounts.entries()]
    .map(([label, counts]) => ({
      label,
      count: counts.count,
      source: (
        counts.hasWaiting && counts.hasBlocked ? "mixed" : counts.hasBlocked ? "blocked" : "waiting"
      ) as DashboardLiveSummary["stuckReasonCounts"][number]["source"]
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 3);
}

function normalizeExecutionReason(reason?: string) {
  const trimmedReason = reason?.trim();
  return trimmedReason ? trimmedReason : "Unspecified";
}

function sortDashboardExecutionItemsByPriority(a: DashboardExecutionItem, b: DashboardExecutionItem) {
  return getDashboardExecutionPriority(b) - getDashboardExecutionPriority(a) ||
    compareDueDates(a.dueDate, b.dueDate) ||
    a.title.localeCompare(b.title);
}

function getDashboardExecutionPriority(item: DashboardExecutionItem) {
  if (item.isMissingDueDate) {
    return 5;
  }

  if (item.isBlocked) {
    return 4;
  }

  if (item.isOverdue) {
    return 3;
  }

  if (item.isWaiting) {
    return 2;
  }

  if (item.isDueSoon) {
    return 1;
  }

  return 0;
}

function compareDueDates(a: string, b: string) {
  if (a && b && a !== b) {
    return a.localeCompare(b);
  }

  if (a && !b) {
    return -1;
  }

  if (!a && b) {
    return 1;
  }

  return 0;
}

export function getPublicationIssueSummary(input: DashboardQueryInput): PublicationIssueSummaryRow[] {
  const dashboardMetrics = getDashboardMetricsSource(input.items);

  return getVisiblePublicationIssues(input.issues).map((issue) => {
    const issueProgress = dashboardMetrics.issueProgress[issue.label] ?? { complete: 0, total: 0 };
    const progressPercent =
      issueProgress.total > 0 ? Math.round((issueProgress.complete / issueProgress.total) * 100) : 0;

    return {
      label: issue.label,
      status: issue.status,
      dueDate: issue.dueDate ?? "",
      completeCount: issueProgress.complete,
      totalCount: issueProgress.total,
      progressPercent,
      progressCopy:
        issueProgress.total > 0
          ? `${issueProgress.complete} of ${issueProgress.total} complete`
          : "No deliverables yet",
      canCompleteIssue: issueProgress.total > 0 && issueProgress.complete === issueProgress.total,
      isMissingDueDate: !issue.dueDate,
      readinessSignals: getPublicationIssueReadiness(issue, input.items)
    };
  });
}
