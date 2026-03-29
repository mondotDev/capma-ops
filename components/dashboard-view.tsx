"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app-state";
import { DashboardStuckCard } from "@/components/dashboard-stuck-card";
import {
  formatDashboardItem,
  getImmediateRiskPreview,
  formatShortDate,
  getDailyLoad,
  getDashboardMetrics,
  getWorkstreamSummary,
  getVisiblePublicationIssues
} from "@/lib/ops-utils";

export function DashboardView() {
  const router = useRouter();
  const { completeIssue, generateMissingDeliverablesForIssue, items, issues, openIssue, setIssueStatus } =
    useAppState();
  const [publicationFeedback, setPublicationFeedback] = useState("");
  const [activePublicationIssue, setActivePublicationIssue] = useState<string | null>(null);
  const [issuePendingCompletion, setIssuePendingCompletion] = useState<string | null>(null);
  const dashboardMetrics = getDashboardMetrics(items);
  const extendedDailyLoad = getDailyLoad(items, 30);
  const workstreamSummary = getWorkstreamSummary(items);
  const highestLoadCount = Math.max(...extendedDailyLoad.map((entry) => entry.count), 0);
  const highlightedLoadDates = new Set(
    [...extendedDailyLoad]
      .sort((a, b) => b.count - a.count || a.date.localeCompare(b.date))
      .filter((entry) => entry.count > 0)
      .slice(0, 3)
      .map((entry) => entry.date)
  );
  const nearTermLoad = extendedDailyLoad.slice(0, 7);
  const busiestUpcomingLoad = [...extendedDailyLoad]
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.date.localeCompare(b.date))
    .slice(0, 3);
  const visiblePublicationIssues = reorderVisibleIssues(
    getVisiblePublicationIssues(issues),
    activePublicationIssue
  );

  return (
    <section className="dashboard-grid">
      <section className="command-zone">
        <div className="command-zone__band">
          <button
            className="command-zone__header"
            onClick={() =>
              router.push(dashboardMetrics.overdue > 0 ? "/action?filter=overdue" : "/action?filter=dueSoon")
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
              <strong className="command-metric__value">{dashboardMetrics.overdue}</strong>
            </button>
            <button
              aria-label="Due Soon: active items due in the next three days"
              className="command-metric command-metric--due-soon"
              onClick={() => router.push("/action?filter=dueSoon")}
              title="Active items due in the next three days"
              type="button"
            >
              <span className="command-metric__label">Due Soon</span>
              <strong className="command-metric__value">{dashboardMetrics.dueSoon}</strong>
            </button>
            <button
              aria-label="Peak Day: highest number of active items due on a single day in the next seven days"
              className="command-metric command-metric--peak"
              disabled={!dashboardMetrics.peakUpcomingLoadDate}
              onClick={() => {
                if (!dashboardMetrics.peakUpcomingLoadDate) {
                  return;
                }

                router.push(`/action?dueDate=${encodeURIComponent(dashboardMetrics.peakUpcomingLoadDate)}`);
              }}
              title="Highest number of active items due on a single day in the next seven days"
              type="button"
            >
              <span className="command-metric__label">Peak Day</span>
              <strong className="command-metric__value">{dashboardMetrics.peakUpcomingLoadCount}</strong>
            </button>
          </div>
          <div className="command-zone__list">
            {dashboardMetrics.urgentItems.length > 0 ? (
              dashboardMetrics.urgentItems.slice(0, 2).map((item) => {
                const preview = getImmediateRiskPreview(item);

                return (
                  <div className="risk-preview" key={item.id} title={`${preview.title} — ${preview.meta}`}>
                    <div className="risk-preview__title">{preview.title}</div>
                    <div className="risk-preview__meta">{preview.meta}</div>
                  </div>
                );
              })
            ) : (
              <div className="muted">No urgent items right now</div>
            )}
          </div>
        </div>
      </section>

      <DashboardStuckCard
        blockedCount={dashboardMetrics.blockedCount}
        onOpenBlocked={() => router.push("/action?filter=blocked")}
        onOpenWaiting={() => router.push("/action?filter=waiting")}
        stuckReasonCounts={dashboardMetrics.stuckReasonCounts}
        waitingCount={dashboardMetrics.waiting}
      />

      <div className="card card--secondary">
        <div className="card__title">PUBLICATIONS</div>
        <div className="simple-list simple-list--tight">
          {visiblePublicationIssues.map((issue) => {
            const issueProgress = dashboardMetrics.issueProgress[issue.label] ?? { complete: 0, total: 0 };
            const progressPercent =
              issueProgress.total > 0 ? Math.round((issueProgress.complete / issueProgress.total) * 100) : 0;
            const canCompleteIssue = issueProgress.total > 0 && issueProgress.complete === issueProgress.total;

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
                      <span className="publication-row__progress-copy">
                        {issueProgress.complete}/{issueProgress.total} complete
                      </span>
                    </div>
                  </div>
                  <div aria-hidden="true" className="publication-row__progress">
                    <span className="publication-row__progress-bar" style={{ width: `${progressPercent}%` }} />
                  </div>
                  {issue.status === "Planned" && issueProgress.total === 0 ? (
                    <div className="publication-row__meta">0 deliverables</div>
                  ) : null}
                  {!issue.dueDate ? <div className="publication-row__warning">missing due date</div> : null}
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
                  <select
                    aria-label={`Issue status for ${issue.label}`}
                    className="cell-select publication-row__status-select"
                    onChange={(event) => {
                      const nextStatus = event.target.value as "Planned" | "Open" | "Complete";
                      const result = setIssueStatus(issue.label, nextStatus);
                      setActivePublicationIssue(nextStatus === "Open" ? issue.label : null);
                      if (nextStatus === "Complete" && !result.completed) {
                        setPublicationFeedback(formatCompletionBlockedFeedback(issue.label, result.blockedDeliverables));
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
                        canCompleteIssue
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

      <div className="card card--secondary">
        <div className="card__title">UPCOMING LOAD</div>
        <div className="load-section-label">Next 30 Days</div>
        <div className="load-strip" aria-label="Load over the next 30 days">
          {extendedDailyLoad.map((entry, index) => {
            const loadLevel =
              entry.count === 0
                ? "load-strip__cell--zero"
                : highestLoadCount > 0 && entry.count / highestLoadCount >= 0.75
                  ? "load-strip__cell--high"
                  : highestLoadCount > 0 && entry.count / highestLoadCount >= 0.4
                    ? "load-strip__cell--medium"
                    : "load-strip__cell--low";
            const showAnchorLabel =
              index === 0 ||
              index === 7 ||
              index === 14 ||
              index === 15 ||
              index === 22 ||
              index === extendedDailyLoad.length - 1;

            return (
              <button
                aria-label={`${formatShortDate(entry.date)}: ${entry.count} ${entry.count === 1 ? "item" : "items"}`}
                className={`load-strip__cell ${loadLevel}`}
                disabled={entry.count === 0}
                key={entry.date}
                onClick={() => router.push(`/action?dueDate=${encodeURIComponent(entry.date)}`)}
                type="button"
              >
                <span className="load-strip__swatch" />
                {showAnchorLabel ? <span className="load-strip__label">{formatShortDate(entry.date)}</span> : null}
              </button>
            );
          })}
        </div>
        <div className="load-section-label">Next 7 Days</div>
        <div className="load-list">
          {nearTermLoad.map((entry) => (
            <button
              className={
                entry.count === 0
                  ? "load-row load-row--disabled"
                  : highlightedLoadDates.has(entry.date)
                    ? "load-row load-row--highlight"
                    : "load-row"
              }
              disabled={entry.count === 0}
              key={entry.date}
              onClick={() => router.push(`/action?dueDate=${encodeURIComponent(entry.date)}`)}
              type="button"
            >
              <div className="load-row__meta">
                <span>{formatShortDate(entry.date)}</span>
                <strong>{entry.count}</strong>
              </div>
              <div className="load-bar-track" aria-hidden="true">
                <div
                  className="load-bar-fill"
                  style={{
                    width: highestLoadCount > 0 ? `${(entry.count / highestLoadCount) * 100}%` : "0%"
                  }}
                />
              </div>
            </button>
          ))}
        </div>
        {busiestUpcomingLoad.length > 0 ? (
          <div className="load-peaks">
            <div className="load-peaks__title">Busiest Upcoming</div>
            <div className="load-peaks__list">
              {busiestUpcomingLoad.map((entry, index) => (
                <button
                  className={index === 0 ? "load-peaks__row load-peaks__row--peak" : "load-peaks__row"}
                  key={entry.date}
                  onClick={() => router.push(`/action?dueDate=${encodeURIComponent(entry.date)}`)}
                  type="button"
                >
                  <span className="load-peaks__date">{formatShortDate(entry.date)}</span>
                  <span className="load-peaks__value">{entry.count}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <button
        className="card card--clickable card--secondary"
        onClick={() =>
          router.push(
            dashboardMetrics.sponsorRiskItems.length > 0 ? "/action?focus=sponsor" : "/action?filter=waiting"
          )
        }
        type="button"
      >
        <div className="card__title">SPONSOR RISK</div>
        <div className="detail-list detail-list--tight">
          {dashboardMetrics.sponsorRiskItems.length > 0 ? (
            dashboardMetrics.sponsorRiskItems.map((item) => (
              <div className="detail-row detail-row--truncate" key={item.id} title={formatDashboardItem(item)}>
                {formatDashboardItem(item)}
              </div>
            ))
          ) : (
            <div className="muted">No sponsor risks flagged</div>
          )}
        </div>
      </button>

      <button
        className="card card--clickable card--secondary"
        onClick={() =>
          router.push(
            dashboardMetrics.productionRiskItems.length > 0
              ? "/action?focus=production"
              : "/action?filter=dueSoon"
          )
        }
        type="button"
      >
        <div className="card__title">PRODUCTION RISK</div>
        <div className="detail-list detail-list--tight">
          {dashboardMetrics.productionRiskItems.length > 0 ? (
            dashboardMetrics.productionRiskItems.map((item) => (
              <div className="detail-row detail-row--truncate" key={item.id} title={formatDashboardItem(item)}>
                {formatDashboardItem(item)}
              </div>
            ))
          ) : (
            <div className="muted">No production risks flagged</div>
          )}
        </div>
      </button>

      <div className="card card--secondary card--muted">
        <div className="card__title">WORKSTREAM SUMMARY</div>
        <div className="simple-list simple-list--tight">
          {workstreamSummary.length > 0 ? (
            workstreamSummary.slice(0, 5).map((entry) => (
              <div
                className="detail-row detail-row--truncate"
                key={entry.workstream}
                title={`${entry.workstream}: ${entry.total} total, ${entry.overdue} overdue, ${entry.dueSoon} due soon, ${entry.inProgress} in progress`}
              >
                {entry.workstream}: {entry.total} total, {entry.overdue} overdue, {entry.dueSoon} due soon,{" "}
                {entry.inProgress} in progress
              </div>
            ))
          ) : (
            <div className="muted">No active workstreams</div>
          )}
        </div>
      </div>
    </section>
  );
}

function formatPublicationFeedback(issue: string, created: number, skipped: number) {
  if (created === 0 && skipped === 0) {
    return `${issue} opened.`;
  }

  if (skipped === 0) {
    return `${issue} opened — ${created} deliverables created.`;
  }

  if (created === 0) {
    return `${issue} opened — all deliverables already existed.`;
  }

  return `${issue} opened — ${created} created, ${skipped} skipped.`;
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
  issues: ReturnType<typeof getVisiblePublicationIssues>,
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
