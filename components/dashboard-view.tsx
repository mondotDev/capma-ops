"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppState } from "@/components/app-state";

const TODAY = new Date("2026-03-27T00:00:00");
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function daysUntil(dateValue: string) {
  const target = new Date(`${dateValue}T00:00:00`);
  return Math.ceil((target.getTime() - TODAY.getTime()) / (24 * 60 * 60 * 1000));
}

export function DashboardView() {
  const router = useRouter();
  const { items } = useAppState();

  const dashboardMetrics = useMemo(() => {
    const overdue = items.filter((item) => daysUntil(item.dueDate) < 0).length;
    const dueSoon = items.filter((item) => {
      const days = daysUntil(item.dueDate);
      return days >= 0 && days <= 3;
    }).length;
    const notStartedDueSoon = items.filter((item) => {
      const days = daysUntil(item.dueDate);
      return item.status === "Not Started" && days >= 0 && days <= 3;
    }).length;

    const waitingGroups = items.reduce<Record<string, number>>((groups, item) => {
      if (!item.waitingOn) {
        return groups;
      }

      groups[item.waitingOn] = (groups[item.waitingOn] ?? 0) + 1;
      return groups;
    }, {});

    return {
      overdue,
      dueSoon,
      notStartedDueSoon,
      waitingGroups: Object.entries(waitingGroups)
    };
  }, [items]);

  return (
    <section className="dashboard-grid">
      <button className="card card--clickable" onClick={() => router.push("/action")} type="button">
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
            <span>Not Started + Due Soon</span>
            <strong>{dashboardMetrics.notStartedDueSoon}</strong>
          </div>
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
            dashboardMetrics.waitingGroups.map(([label, count]) => (
              <div className="simple-row" key={label}>
                <span>{`Waiting on ${label} (${count})`}</span>
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
          <div className="simple-row">April News Brief - 60% complete</div>
          <div className="simple-row">Summer Voice - 25% complete</div>
        </div>
      </div>

      <div className="card">
        <div className="card__title">EVENT SNAPSHOT</div>
        <div className="simple-list">
          <div className="simple-row">Legislative Day - 24 days - 3 overdue</div>
        </div>
      </div>

      <div className="card">
        <div className="card__title">SPONSOR RISK</div>
        <div className="simple-list">
          <div className="simple-row">4 incomplete deliverables</div>
          <div className="simple-row">2 overdue</div>
        </div>
      </div>

      <div className="card">
        <div className="card__title">PRODUCTION RISK</div>
        <div className="simple-list">
          <div className="simple-row">3 missing files</div>
          <div className="simple-row">1 missing printer</div>
        </div>
      </div>
    </section>
  );
}
