"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDashboardReadModel } from "@/components/app-read-models";
import { useAppActions } from "@/components/app-state";
import { DashboardStuckCard } from "@/components/dashboard-stuck-card";
import type { PublicationIssueSummaryRow } from "@/lib/queries/dashboard/dashboard-queries";
import { formatShortDate } from "@/lib/ops-utils";

export function DashboardView() {
  const router = useRouter();
  const { completeIssue, generateMissingDeliverablesForIssue, openIssue, setIssueStatus } = useAppActions();
  const { dashboardSummary, urgentPreviewItems, publicationIssueSummaryRows, isLoading } = useDashboardReadModel();
  const [publicationFeedback, setPublicationFeedback] = useState("");
  const [activePublicationIssue, setActivePublicationIssue] = useState<string | null>(null);
  const [issuePendingCompletion, setIssuePendingCompletion] = useState<string | null>(null);
  const visiblePublicationIssues = useMemo(
    () => reorderVisibleIssues(publicationIssueSummaryRows, activePublicationIssue),
    [activePublicationIssue, publicationIssueSummaryRows]
  );

  if (isLoading) {
    return (
      <section className="dashboard-grid">
        <div className="card card--secondary">
          <div className="card__title">DASHBOARD</div>
          <div className="muted">Loading dashboard...</div>
        </div>
      </section>
    );
  }

  return (
    <section className="dashboard-grid">
      <section className="command-zone">
        <div className="command-zone__band">
          <button
            className="command-zone__header"
            onClick={() =>
              router.push(dashboardSummary.overdue > 0 ? "/action?filter=overdue" : "/action?filter=dueSoon")
            }
            type="button"
          >
            <div className="card__title">IMMEDIATE RISK</div>
          </button>
          <div className="command-metrics">
            <button
              aria-label="Overdue: active items with due dates before today"
              className="command-metric command-metric--overdue"
              onClick={() => router.push("/action?filter=overdue")}
              title="Active items with due dates before today"
              type="button"
            >
              <span className="command-metric__label">Overdue</span>
              <strong className="command-metric__value">{dashboardSummary.overdue}</strong>
            </button>
            <button
              aria-label="Due Soon: active items due in the next three days"
              className="command-metric command-metric--due-soon"
              onClick={() => router.push("/action?filter=dueSoon")}
              title="Active items due in the next three days"
              type="button"
            >
              <span className="command-metric__label">Due Soon</span>
              <strong className="command-metric__value">{dashboardSummary.dueSoon}</strong>
            </button>
            <button
              aria-label="Peak Day: highest number of active items due on a single day in the next seven days"
              className="command-metric command-metric--peak"
              disabled={!dashboardSummary.peakUpcomingLoadDate}
              onClick={() => {
                if (!dashboardSummary.peakUpcomingLoadDate) {
                  return;
                }

                router.push(`/action?dueDate=${encodeURIComponent(dashboardSummary.peakUpcomingLoadDate)}`);
              }}
              title="Highest number of active items due on a single day in the next seven days"
              type="button"
            >
              <span className="command-metric__label">Peak Day</span>
              <strong className="command-metric__value">{dashboardSummary.peakUpcomingLoadCount}</strong>
            </button>
          </div>
          <div className="command-zone__list">
            {urgentPreviewItems.length > 0 ? (
              urgentPreviewItems.map((item) => (
                <div className="risk-preview" key={item.id} title={`${item.title} - ${item.meta}`}>
                  <div className="risk-preview__title">{item.title}</div>
                  <div className="risk-preview__meta">{item.meta}</div>
                </div>
              ))
            ) : (
              <div className="muted">No urgent items right now</div>
            )}
          </div>
        </div>
      </section>

      <section className="dashboard-main-grid">
        <div className="dashboard-main-column dashboard-main-column--left">
          <DashboardStuckCard
            blockedCount={dashboardSummary.blockedCount}
            onOpenBlocked={() => router.push("/action?filter=blocked")}
            onOpenWaiting={() => router.push("/action?filter=waiting")}
            stuckReasonCounts={dashboardSummary.stuckReasonCounts}
            waitingCount={dashboardSummary.waiting}
          />

          <div className="card card--secondary card--muted">
            <div className="card__title">WORKSTREAM SUMMARY</div>
            <div className="workstream-summary">
              {dashboardSummary.workstreamSummaryRows.length > 0 ? (
                dashboardSummary.workstreamSummaryRows.slice(0, 5).map((entry) => {
                    const dateContext = entry.dateContext;

                    return (
                      <div
                        className="workstream-row"
                        key={entry.workstream}
                        title={`${entry.workstream}: ${entry.total} total, ${entry.overdue} overdue, ${entry.dueSoon} due soon, ${entry.inProgress} in progress`}
                      >
                        <div className="workstream-row__top">
                          <span className="workstream-row__name">{entry.workstream}</span>
                          <strong className="workstream-row__total">{entry.total}</strong>
                        </div>
                        {dateContext ? (
                          <div className="workstream-row__date">
                            {dateContext.dateText} • {dateContext.countdownText}
                          </div>
                        ) : null}
                        <div className="workstream-row__signals">
                          <span className="workstream-signal workstream-signal--overdue">{entry.overdue} overdue</span>
                          <span className="workstream-signal workstream-signal--due-soon">{entry.dueSoon} due soon</span>
                          <span className="workstream-signal">{entry.inProgress} in progress</span>
                        </div>
                      </div>
                    );
                })
              ) : (
                <div className="muted">No active workstreams</div>
              )}
            </div>
          </div>
        </div>

        <div className="dashboard-card-slot dashboard-card-slot--publications">
          <div className="card card--secondary">
            <div className="card__title">PUBLICATIONS</div>
            <div className="simple-list simple-list--tight">
              {visiblePublicationIssues.map((issue) => {
                return (
                  <div
                    className={
                      issue.label === activePublicationIssue
                        ? "publication-row publication-row--active"
                        : issue.status === "Planned"
                          ? "publication-row publication-row--planned"
                          : "publication-row"
                    }
                    key={issue.label}
                  >
                    <div className="publication-row__body">
                      {issue.status === "Planned" ? (
                        <div className="publication-row__meta">Next up</div>
                      ) : issue.status === "Open" ? (
                        <div className="publication-row__meta">Current issue</div>
                      ) : null}
                      <div className="publication-row__summary">
                        <div className="publication-row__title" title={issue.label}>
                          {issue.label}
                        </div>
                        <div className="publication-row__status-line">
                          <span className="publication-row__status">{issue.status}</span>
                          <span className="publication-row__progress-copy">{issue.progressCopy}</span>
                        </div>
                      </div>
                      <div aria-hidden="true" className="publication-row__progress">
                        <span className="publication-row__progress-bar" style={{ width: `${issue.progressPercent}%` }} />
                      </div>
                      {issue.isMissingDueDate ? <div className="publication-row__warning">missing due date</div> : null}
                    </div>
                    <div className="publication-row__actions" onClick={(event) => event.stopPropagation()}>
                      {issue.status === "Planned" ? (
                        <button
                          className="button-link publication-row__button publication-row__button--primary"
                          onClick={() => {
                            const result = openIssue(issue.label);
                            setActivePublicationIssue(issue.label);
                            router.push(`/action?issue=${encodeURIComponent(issue.label)}`);
                            setPublicationFeedback(formatPublicationFeedback(issue.label, result.created, result.skipped));
                          }}
                          type="button"
                        >
                          Open Issue
                        </button>
                      ) : null}
                      {issue.status === "Open" ? (
                        <button
                          className="button-link publication-row__button publication-row__button--primary"
                          onClick={() => {
                            setActivePublicationIssue(issue.label);
                            router.push(`/action?issue=${encodeURIComponent(issue.label)}`);
                          }}
                          type="button"
                        >
                          Go to Issue
                        </button>
                      ) : null}
                      {issue.status === "Open" ? (
                        <button
                          className="button-link button-link--inline-secondary publication-row__button publication-row__button--secondary"
                          onClick={() => {
                            const result = generateMissingDeliverablesForIssue(issue.label);
                            setActivePublicationIssue(issue.label);
                            setPublicationFeedback(formatGenerateMissingFeedback(issue.label, result.created, result.skipped));
                          }}
                          type="button"
                        >
                          Generate Missing
                        </button>
                      ) : null}
                    </div>
                    <div className="publication-row__utility" onClick={(event) => event.stopPropagation()}>
                      <div className="publication-row__utility-label">Manage issue</div>
                      <div className="publication-row__utility-controls">
                        <select
                          aria-label={`Issue status for ${issue.label}`}
                          className="cell-select publication-row__status-select"
                          onChange={(event) => {
                            const nextStatus = event.target.value as "Planned" | "Open" | "Complete";
                            const result = setIssueStatus(issue.label, nextStatus);
                            setActivePublicationIssue(nextStatus === "Open" ? issue.label : null);
                            if (nextStatus === "Complete" && !result.completed) {
                              setPublicationFeedback(
                                formatCompletionBlockedFeedback(issue.label, result.blockedDeliverables)
                              );
                            }
                          }}
                          value={issue.status}
                        >
                          <option value="Planned">Planned</option>
                          <option value="Open">Open</option>
                          <option value="Complete">Complete</option>
                        </select>
                        {issue.status === "Open" && issuePendingCompletion !== issue.label ? (
                          <button
                            className={
                              issue.canCompleteIssue
                                ? "button-link button-link--inline-secondary publication-row__complete publication-row__complete--ready"
                                : "button-link button-link--inline-secondary publication-row__complete"
                            }
                            onClick={() => setIssuePendingCompletion(issue.label)}
                            type="button"
                          >
                            Complete Issue
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {issue.status === "Open" ? (
                      issuePendingCompletion === issue.label ? (
                        <div className="confirm-delete publication-confirm">
                          <div className="confirm-delete__title">Complete this issue?</div>
                          <div className="confirm-delete__copy">
                            This will mark the issue complete but keep all related items in local state.
                          </div>
                          <div className="confirm-delete__actions">
                            <button
                              className="button-link button-link--inline-secondary"
                              onClick={() => setIssuePendingCompletion(null)}
                              type="button"
                            >
                              Cancel
                            </button>
                            <button
                              className="button-danger"
                              onClick={() => {
                                const result = completeIssue(issue.label);
                                setIssuePendingCompletion(null);
                                if (!result.completed) {
                                  setPublicationFeedback(formatCompletionBlockedFeedback(issue.label, result.blockedDeliverables));
                                  return;
                                }

                                setActivePublicationIssue(null);
                                setPublicationFeedback(`${issue.label} marked complete.`);
                              }}
                              type="button"
                            >
                              Complete Issue
                            </button>
                          </div>
                        </div>
                      ) : null
                    ) : null}
                  </div>
                );
              })}
              {publicationFeedback ? <div className="card__subhead">{publicationFeedback}</div> : null}
            </div>
          </div>
        </div>

        <div className="dashboard-card-slot dashboard-card-slot--load">
          <div className="card card--secondary">
            <div className="card__title">UPCOMING LOAD</div>
            <div className="load-section-label">Next 14 Days</div>
            <div className="load-grid" aria-label="Load over the next 14 days">
              {dashboardSummary.overviewLoadRows.map((row, rowIndex) => (
                <div className="load-grid__row" key={`row-${rowIndex}`}>
                  <div className="load-grid__track">
                    {row.map((entry) => {
                      const loadLevel =
                        entry.count === 0
                          ? "load-grid__cell--zero"
                          : dashboardSummary.highestLoadCount > 0 && entry.count / dashboardSummary.highestLoadCount >= 0.75
                            ? "load-grid__cell--high"
                            : dashboardSummary.highestLoadCount > 0 && entry.count / dashboardSummary.highestLoadCount >= 0.4
                              ? "load-grid__cell--medium"
                              : "load-grid__cell--low";

                      return (
                        <button
                          aria-label={`${formatShortDate(entry.date)}: ${entry.count} ${entry.count === 1 ? "item" : "items"}`}
                          className={`load-grid__cell ${loadLevel}`}
                          disabled={entry.count === 0}
                          key={entry.date}
                          onClick={() => router.push(`/action?dueDate=${encodeURIComponent(entry.date)}`)}
                          type="button"
                        >
                          <span className="load-grid__swatch" />
                          {entry.count > 0 ? (
                            <span className="load-grid__tooltip" role="tooltip">
                              {formatShortDate(entry.date)} • {entry.count} {entry.count === 1 ? "task" : "tasks"}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                  <div className="load-grid__anchors" aria-hidden="true">
                    <span>{formatShortDate(row[0]?.date ?? "")}</span>
                    <span>{formatShortDate(row[row.length - 1]?.date ?? "")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-support-grid">
        <div className="dashboard-card-slot dashboard-card-slot--sponsor">
          <button
            className="card card--clickable card--secondary"
            onClick={() =>
              router.push(
                dashboardSummary.sponsorRisk.total > 0 ? "/action?focus=sponsor" : "/action?filter=waiting"
              )
            }
            type="button"
          >
            <div className="card__title">SPONSOR RISK</div>
            <div className="risk-summary">
              {dashboardSummary.sponsorRisk.total > 0 ? (
                <>
                  <div className="risk-summary__top">
                    <strong className="risk-summary__total">{dashboardSummary.sponsorRisk.total}</strong>
                    <span className="risk-summary__label">Sponsor items at risk</span>
                  </div>
                  <div className="risk-summary__signals">
                    <span className="risk-chip risk-chip--waiting">{dashboardSummary.sponsorRisk.waiting} waiting</span>
                    <span className="risk-chip risk-chip--due-soon">{dashboardSummary.sponsorRisk.dueSoon} due soon</span>
                    <span className="risk-chip risk-chip--overdue">{dashboardSummary.sponsorRisk.overdue} overdue</span>
                  </div>
                  {dashboardSummary.sponsorRisk.example ? (
                    <div
                      className="risk-summary__example detail-row--truncate"
                      title={dashboardSummary.sponsorRisk.example}
                    >
                      {dashboardSummary.sponsorRisk.example}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="muted">No sponsor risks flagged</div>
              )}
            </div>
          </button>
        </div>

        <div className="dashboard-card-slot dashboard-card-slot--production">
          <button
            className="card card--clickable card--secondary"
            onClick={() =>
              router.push(
                dashboardSummary.productionRisk.total > 0
                  ? "/action?focus=production"
                  : "/action?filter=dueSoon"
              )
            }
            type="button"
          >
            <div className="card__title">PRODUCTION RISK</div>
            <div className="risk-summary">
              {dashboardSummary.productionRisk.total > 0 ? (
                <>
                  <div className="risk-summary__top">
                    <strong className="risk-summary__total">{dashboardSummary.productionRisk.total}</strong>
                    <span className="risk-summary__label">Production items at risk</span>
                  </div>
                  <div className="risk-summary__signals">
                    <span className="risk-chip risk-chip--blocked">{dashboardSummary.productionRisk.blocked} blocked</span>
                    <span className="risk-chip risk-chip--waiting">{dashboardSummary.productionRisk.waiting} waiting</span>
                    <span className="risk-chip risk-chip--due-soon">{dashboardSummary.productionRisk.dueSoon} due soon</span>
                  </div>
                  {dashboardSummary.productionRisk.example ? (
                    <div
                      className="risk-summary__example detail-row--truncate"
                      title={dashboardSummary.productionRisk.example}
                    >
                      {dashboardSummary.productionRisk.example}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="muted">No production risks flagged</div>
              )}
            </div>
          </button>
        </div>

      </section>
    </section>
  );
}

function formatPublicationFeedback(issue: string, created: number, skipped: number) {
  if (created === 0 && skipped === 0) {
    return `${issue} opened.`;
  }

  if (skipped === 0) {
    return `${issue} opened - ${created} deliverables created.`;
  }

  if (created === 0) {
    return `${issue} opened - all deliverables already existed.`;
  }

  return `${issue} opened - ${created} created, ${skipped} skipped.`;
}

function formatGenerateMissingFeedback(issue: string, created: number, skipped: number) {
  if (created === 0 && skipped === 0) {
    return `${issue}: nothing to generate.`;
  }

  if (created === 0) {
    return `${issue}: all template deliverables already exist.`;
  }

  if (skipped === 0) {
    return `${issue}: ${created} missing deliverables created.`;
  }

  return `${issue}: ${created} created, ${skipped} already existed.`;
}

function formatCompletionBlockedFeedback(issue: string, blockedDeliverables: string[]) {
  if (blockedDeliverables.length === 0) {
    return `${issue} cannot be completed yet.`;
  }

  const preview = blockedDeliverables.slice(0, 2).join(", ");
  const remainder = blockedDeliverables.length - 2;

  if (remainder > 0) {
    return `${issue} cannot be completed. Open deliverables remain: ${preview}, plus ${remainder} more.`;
  }

  return `${issue} cannot be completed. Open deliverables remain: ${preview}.`;
}

function reorderVisibleIssues(
  issues: PublicationIssueSummaryRow[],
  activeIssue: string | null
) {
  if (!activeIssue) {
    return issues;
  }

  return [...issues].sort((a, b) => {
    if (a.label === activeIssue) {
      return -1;
    }

    if (b.label === activeIssue) {
      return 1;
    }

    if (a.status !== b.status) {
      return a.status === "Open" ? -1 : 1;
    }

    return a.label.localeCompare(b.label);
  });
}



