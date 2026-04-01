import type { ActionItem } from "@/lib/sample-data";
import type { IssueRecord, WorkstreamSchedule } from "@/lib/ops-utils";
import {
  formatDashboardItem,
  getDailyLoad,
  getDashboardMetrics,
  getImmediateRiskPreview,
  getVisiblePublicationIssues,
  getWorkstreamDateContext,
  getWorkstreamSummary,
  isBlockedItem,
  isItemDueSoon,
  isOverdue,
  isWaitingIssue
} from "@/lib/ops-utils";

export type DashboardQueryInput = {
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

export type DashboardRiskSummary = {
  total: number;
  overdue: number;
  dueSoon: number;
  waiting: number;
  blocked?: number;
  example: string | null;
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
  sponsorRisk: DashboardRiskSummary;
  productionRisk: DashboardRiskSummary;
};

function getDashboardMetricsSource(items: ActionItem[]) {
  return getDashboardMetrics(items);
}

export function getDashboardLiveSummary(input: DashboardQueryInput): DashboardLiveSummary {
  const dashboardMetrics = getDashboardMetricsSource(input.items);
  const extendedDailyLoad = getDailyLoad(input.items, 14);
  const highestLoadCount = Math.max(...extendedDailyLoad.map((entry) => entry.count), 0);
  const overviewLoadRows = [extendedDailyLoad.slice(0, 7), extendedDailyLoad.slice(7, 14)];
  const workstreamSummaryRows = getWorkstreamSummary(input.items).map((entry) => ({
    ...entry,
    dateContext: getWorkstreamDateContext(entry.workstream, input.workstreamSchedules, input.issues)
  }));

  return {
    overdue: dashboardMetrics.overdue,
    dueSoon: dashboardMetrics.dueSoon,
    blocked: dashboardMetrics.blocked,
    waiting: dashboardMetrics.waiting,
    blockedCount: dashboardMetrics.blockedCount,
    stuckReasonCounts: dashboardMetrics.stuckReasonCounts,
    peakUpcomingLoadCount: dashboardMetrics.peakUpcomingLoadCount,
    peakUpcomingLoadDate: dashboardMetrics.peakUpcomingLoadDate,
    extendedDailyLoad,
    highestLoadCount,
    overviewLoadRows,
    workstreamSummaryRows,
    sponsorRisk: {
      total: dashboardMetrics.sponsorRiskItems.length,
      overdue: dashboardMetrics.sponsorRiskItems.filter((item) => isOverdue(item.dueDate)).length,
      dueSoon: dashboardMetrics.sponsorRiskItems.filter((item) => isItemDueSoon(item)).length,
      waiting: dashboardMetrics.sponsorRiskItems.filter((item) => isWaitingIssue(item)).length,
      example: dashboardMetrics.sponsorRiskItems[0] ? formatDashboardItem(dashboardMetrics.sponsorRiskItems[0]) : null
    },
    productionRisk: {
      total: dashboardMetrics.productionRiskItems.length,
      blocked: dashboardMetrics.productionRiskItems.filter((item) => isBlockedItem(item)).length,
      dueSoon: dashboardMetrics.productionRiskItems.filter((item) => isItemDueSoon(item)).length,
      waiting: dashboardMetrics.productionRiskItems.filter((item) => isWaitingIssue(item) && !isBlockedItem(item)).length,
      overdue: 0,
      example: dashboardMetrics.productionRiskItems[0]
        ? formatDashboardItem(dashboardMetrics.productionRiskItems[0])
        : null
    }
  };
}

export function getDashboardUrgentPreview(input: DashboardQueryInput, limit: number): DashboardUrgentPreviewItem[] {
  return getDashboardMetricsSource(input.items).urgentItems.slice(0, limit).map((item) => {
    const preview = getImmediateRiskPreview(item);

    return {
      id: item.id,
      title: preview.title,
      meta: preview.meta
    };
  });
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
      isMissingDueDate: !issue.dueDate
    };
  });
}
