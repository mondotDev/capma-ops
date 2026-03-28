"use client";

import type { StuckReasonCount } from "@/lib/ops-utils";

type DashboardStuckCardProps = {
  blockedCount: number;
  waitingCount: number;
  stuckOverdueCount: number;
  stuckDueSoonCount: number;
  stuckReasonCounts: StuckReasonCount[];
  onOpenExecutionNow: () => void;
  onOpenBlocked: () => void;
  onOpenWaiting: () => void;
  onOpenOverdue: () => void;
  onOpenDueSoon: () => void;
};

export function DashboardStuckCard({
  blockedCount,
  waitingCount,
  stuckOverdueCount,
  stuckDueSoonCount,
  stuckReasonCounts,
  onOpenExecutionNow,
  onOpenBlocked,
  onOpenWaiting,
  onOpenOverdue,
  onOpenDueSoon
}: DashboardStuckCardProps) {
  return (
    <div
      className="card card--clickable card--secondary"
      onClick={onOpenExecutionNow}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenExecutionNow();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="card__title">WHERE THINGS ARE STUCK</div>
      <div className="stuck-card">
        <div className="stuck-card__primary">
          <button
            className="stuck-metric"
            onClick={(event) => {
              event.stopPropagation();
              onOpenBlocked();
            }}
            type="button"
          >
            <span className="stuck-metric__label">Blocked</span>
            <strong className="stuck-metric__value">{blockedCount}</strong>
          </button>
          <button
            className="stuck-metric"
            onClick={(event) => {
              event.stopPropagation();
              onOpenWaiting();
            }}
            type="button"
          >
            <span className="stuck-metric__label">Waiting</span>
            <strong className="stuck-metric__value">{waitingCount}</strong>
          </button>
        </div>
        <div className="stuck-card__secondary">
          <button
            className="stuck-secondary"
            onClick={(event) => {
              event.stopPropagation();
              onOpenOverdue();
            }}
            type="button"
          >
            <span className="stuck-secondary__label">Stuck + Overdue</span>
            <strong className="stuck-secondary__value">{stuckOverdueCount}</strong>
          </button>
          <button
            className="stuck-secondary"
            onClick={(event) => {
              event.stopPropagation();
              onOpenDueSoon();
            }}
            type="button"
          >
            <span className="stuck-secondary__label">Stuck + Due Soon</span>
            <strong className="stuck-secondary__value">{stuckDueSoonCount}</strong>
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
