"use client";

import type { StuckReasonCount } from "@/lib/ops-utils";

type DashboardStuckCardProps = {
  blockedCount: number;
  waitingCount: number;
  stuckReasonCounts: StuckReasonCount[];
  onOpenBlocked: () => void;
  onOpenWaiting: () => void;
};

export function DashboardStuckCard({
  blockedCount,
  waitingCount,
  stuckReasonCounts,
  onOpenBlocked,
  onOpenWaiting
}: DashboardStuckCardProps) {
  return (
    <div className="card card--secondary">
      <div className="card__title">NEEDS UNBLOCKING</div>
      <div className="stuck-card">
        <div className="stuck-card__primary">
          <button
            aria-label="Blocked: active items marked blocked or with a blocker reason"
            className="stuck-metric"
            onClick={(event) => {
              event.stopPropagation();
              onOpenBlocked();
            }}
            title="Active items marked blocked or with a blocker reason"
            type="button"
          >
            <span className="stuck-metric__label">Blocked</span>
            <strong className="stuck-metric__value">{blockedCount}</strong>
          </button>
          <button
            aria-label="Waiting: active items in Waiting status that are not also blocked"
            className="stuck-metric"
            onClick={(event) => {
              event.stopPropagation();
              onOpenWaiting();
            }}
            title="Active items in Waiting status that are not also blocked"
            type="button"
          >
            <span className="stuck-metric__label">Waiting</span>
            <strong className="stuck-metric__value">{waitingCount}</strong>
          </button>
        </div>
        <div className="stuck-card__reasons">
          {stuckReasonCounts.length > 0 ? (
            stuckReasonCounts.map((reason) => (
              <div className="stuck-reason" key={reason.label}>
                <span className="stuck-reason__label">{reason.label}</span>
                <span className="stuck-reason__meta">
                  {formatStuckReasonSource(reason.source)} {reason.count}
                </span>
              </div>
            ))
          ) : (
            <div className="muted">No blocked or waiting items</div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatStuckReasonSource(source: StuckReasonCount["source"]) {
  if (source === "mixed") {
    return "mixed";
  }

  return source;
}
