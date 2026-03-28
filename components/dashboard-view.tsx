"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app-state";
import {
  formatDashboardItem,
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
  const dailyLoad = getDailyLoad(items);
  const workstreamSummary = getWorkstreamSummary(items);
  const highestLoadCount = Math.max(...dailyLoad.map((entry) => entry.count), 0);
  const highlightedLoadDates = new Set(
    [...dailyLoad]
      .sort((a, b) => b.count - a.count || a.date.localeCompare(b.date))
      .filter((entry) => entry.count > 0)
      .slice(0, 3)
      .map((entry) => entry.date)
  );
  const visiblePublicationIssues = reorderVisibleIssues(
    getVisiblePublicationIssues(issues),
    activePublicationIssue
  );

  return (
    <section className="dashboard-grid">
      <button
        className="card card--clickable card--priority"
        onClick={() =>
          router.push(dashboardMetrics.overdue > 0 ? "/action?filter=overdue" : "/action?filter=dueSoon")
        }
        type="button"
      >
        <div className="card__title">WHAT WILL BURN ME FIRST</div>
        <div className="metric-list">
          <div className="metric-row">
            <span>Overdue</span>
            <strong>{dashboardMetrics.overdue}</strong>
          </div>
          <div className="metric-row">
            <span>Due Soon (3 days)</span>
            <strong>{dashboardMetrics.dueSoon}</strong>
          </div>
          <div className="metric-row">
            <span>Total Active</span>
            <strong>{dashboardMetrics.totalActive}</strong>
          </div>
        </div>
        <div className="card__subhead">Top urgent items</div>
        <div className="detail-list">
          {dashboardMetrics.urgentItems.length > 0 ? (
            dashboardMetrics.urgentItems.map((item) => (
              <div className="detail-row" key={item.id}>
                {formatDashboardItem(item)}
              </div>
            ))
          ) : (
            <div className="muted">No urgent items right now</div>
          )}
        </div>
      </button>

      <button
        className="card card--clickable"
        onClick={() => router.push("/action?filter=waiting")}
        type="button"
      >
        <div className="card__title">WHERE THINGS ARE STUCK</div>
        <div className="simple-list">
          <div className="metric-row">
            <span>Blocked</span>
            <span>
              <strong>{dashboardMetrics.blockedCount}</strong>{" "}
              <button
                className="button-link button-link--inline"
                onClick={(event) => {
                  event.stopPropagation();
                  router.push("/action?filter=blocked");
                }}
                type="button"
              >
                View
              </button>
            </span>
          </div>
          <div className="metric-row">
            <span>Waiting</span>
            <strong>{dashboardMetrics.waiting}</strong>
          </div>
          {dashboardMetrics.waitingGroups.length > 0 ? (
            dashboardMetrics.waitingGroups.map(([label, itemLabels]) => (
              <div className="group-block" key={label}>
                <div className="group-title">{`Waiting on ${label} (${itemLabels.length})`}</div>
                {itemLabels.map((itemLabel) => (
                  <div className="detail-row detail-row--indented" key={itemLabel}>
                    {itemLabel}
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="muted">No waiting items</div>
          )}
        </div>
      </button>

      <div className="card">
        <div className="card__title">PUBLICATIONS</div>
        <div className="simple-list">
          {visiblePublicationIssues.map((issue) => (
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
                <div className="simple-row simple-row--stacked">
                  {issue.label} — {issue.status} — {dashboardMetrics.issueProgress[issue.label]?.complete ?? 0}/
                  {dashboardMetrics.issueProgress[issue.label]?.total ?? 0} complete
                </div>
                {issue.status === "Planned" && (dashboardMetrics.issueProgress[issue.label]?.total ?? 0) === 0 ? (
                  <div className="publication-row__meta">0 deliverables</div>
                ) : null}
                {!issue.dueDate ? <div className="publication-row__warning">missing due date</div> : null}
              </div>
              <div className="publication-row__actions" onClick={(event) => event.stopPropagation()}>
                {issue.status === "Planned" ? (
                  <button
                    className="button-link button-link--inline-secondary"
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
                    className="button-link button-link--inline-secondary"
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
                    className="button-link button-link--inline-secondary"
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
                <select
                  aria-label={`Issue status for ${issue.label}`}
                  className="cell-select"
                  onChange={(event) =>
                    {
                      const nextStatus = event.target.value as "Planned" | "Open" | "Complete";
                      setIssueStatus(issue.label, nextStatus);
                      setActivePublicationIssue(nextStatus === "Open" ? issue.label : null);
                    }
                  }
                  value={issue.status}
                >
                  <option value="Planned">Planned</option>
                  <option value="Open">Open</option>
                  <option value="Complete">Complete</option>
                </select>
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
                          completeIssue(issue.label);
                          setIssuePendingCompletion(null);
                          setActivePublicationIssue(null);
                          setPublicationFeedback(`${issue.label} marked complete.`);
                        }}
                        type="button"
                      >
                        Complete Issue
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="button-link button-link--inline-secondary"
                    onClick={() => setIssuePendingCompletion(issue.label)}
                    type="button"
                  >
                    Complete Issue
                  </button>
                )
              ) : null}
            </div>
          ))}
          {publicationFeedback ? <div className="card__subhead">{publicationFeedback}</div> : null}
        </div>
      </div>

      <div className="card">
        <div className="card__title">WORKSTREAM SUMMARY</div>
        <div className="simple-list">
          {workstreamSummary.length > 0 ? (
            workstreamSummary.map((entry) => (
              <div className="detail-row" key={entry.workstream}>
                {entry.workstream}: {entry.total} total, {entry.overdue} overdue, {entry.dueSoon} due soon,{" "}
                {entry.inProgress} in progress
              </div>
            ))
          ) : (
            <div className="muted">No active workstreams</div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card__title">UPCOMING LOAD</div>
        <div className="load-list">
          {dailyLoad.map((entry) => (
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
      </div>

      <button
        className="card card--clickable"
        onClick={() =>
          router.push(
            dashboardMetrics.sponsorRiskItems.length > 0 ? "/action?focus=sponsor" : "/action?filter=waiting"
          )
        }
        type="button"
      >
        <div className="card__title">SPONSOR RISK</div>
        <div className="detail-list">
          {dashboardMetrics.sponsorRiskItems.length > 0 ? (
            dashboardMetrics.sponsorRiskItems.map((item) => (
              <div className="detail-row" key={item.id}>
                {formatDashboardItem(item)}
              </div>
            ))
          ) : (
            <div className="muted">No sponsor risks flagged</div>
          )}
        </div>
      </button>

      <button
        className="card card--clickable"
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
        <div className="detail-list">
          {dashboardMetrics.productionRiskItems.length > 0 ? (
            dashboardMetrics.productionRiskItems.map((item) => (
              <div className="detail-row" key={item.id}>
                {formatDashboardItem(item)}
              </div>
            ))
          ) : (
            <div className="muted">No production risks flagged</div>
          )}
        </div>
      </button>
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
