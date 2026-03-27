"use client";

import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app-state";
import {
  formatDashboardItem,
  getDashboardMetrics
} from "@/lib/ops-utils";

const PUBLICATION_PROGRESS = [
  { title: "April News Brief", workstream: "News Brief", percentComplete: 60 },
  { title: "Summer Voice", workstream: "The Voice", percentComplete: 25 }
];

export function DashboardView() {
  const router = useRouter();
  const { items } = useAppState();
  const dashboardMetrics = getDashboardMetrics(items);

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
          {PUBLICATION_PROGRESS.map((publication) => (
            <div className="simple-row simple-row--stacked" key={publication.title}>
              {publication.title} — {publication.percentComplete}% complete —{" "}
              {dashboardMetrics.workstreamOpenCounts[publication.workstream] ?? 0} open
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card__title">EVENT SNAPSHOT</div>
        <div className="simple-list">
          <div className="simple-row">Legislative Day - 24 days - 3 overdue</div>
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
