"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppState } from "@/components/app-state";
import type { ActionItem } from "@/lib/sample-data";
import {
  type ActionFilter,
  type ActionFocus,
  DEFAULT_OWNER,
  formatDueLabel,
  formatShortDate,
  getIssuesForWorkstream,
  getActionSummaryCounts,
  getIssueDueDate,
  isItemMissingDueDate,
  isWaitingIssue,
  isWaitingMissingReason,
  matchesActionFilter,
  matchesActionFocus,
  sortByPriority,
  STATUS_OPTIONS,
  WAITING_ON_SUGGESTIONS,
  WORKSTREAM_OPTIONS
} from "@/lib/ops-utils";

const FILTER_OPTIONS: { label: string; value: ActionFilter }[] = [
  { label: "All", value: "all" },
  { label: "Overdue", value: "overdue" },
  { label: "Due Soon", value: "dueSoon" },
  { label: "Waiting", value: "waiting" },
  { label: "Mine", value: "mine" }
];

const FOCUS_LABELS: Record<Exclude<ActionFocus, "all">, string> = {
  sponsor: "Sponsor items",
  production: "Production items"
};

export function ActionView({
  initialFilter,
  initialFocus,
  initialIssue
}: {
  initialFilter?: string;
  initialFocus?: string;
  initialIssue?: string;
}) {
  const { deleteItem, items, issues, updateItem } = useAppState();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const activeFilter = getFilterValue(initialFilter);
  const activeFocus = getFocusValue(initialFocus);
  const summaryCounts = useMemo(() => getActionSummaryCounts(items), [items]);
  const activeIssue = initialIssue?.trim() || "";

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (!showCompleted && item.status === "Complete") {
        return false;
      }

      if (activeIssue && item.issue !== activeIssue) {
        return false;
      }

      return matchesActionFilter(item, activeFilter) && matchesActionFocus(item, activeFocus);
    });
  }, [activeFilter, activeFocus, activeIssue, items, showCompleted]);

  const sortedItems = useMemo(() => [...visibleItems].sort(sortByPriority), [visibleItems]);
  const selectedItem = sortedItems.find((item) => item.id === selectedId) ?? null;
  const selectedIssueRecord = selectedItem?.issue
    ? issues.find((issue) => issue.label === selectedItem.issue) ?? null
    : null;
  const focusLabel = activeFocus !== "all" ? FOCUS_LABELS[activeFocus] : null;

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    if (!sortedItems.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, sortedItems]);

  useEffect(() => {
    setIsDeleteConfirmOpen(false);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId]);

  function updateQuery(nextFilter: ActionFilter, nextFocus: ActionFocus) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextFilter === "all") {
      params.delete("filter");
    } else {
      params.set("filter", nextFilter);
    }

    if (nextFocus === "all") {
      params.delete("focus");
    } else {
      params.set("focus", nextFocus);
    }

    const query = params.toString();
    router.replace(query ? `/action?${query}` : "/action");
  }

  function handleFilterChange(nextFilter: ActionFilter) {
    updateQuery(nextFilter, activeFocus);
  }

  function clearFocus() {
    updateQuery(activeFilter, "all");
  }

  function clearIssueFilter() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("issue");
    const query = params.toString();
    router.replace(query ? `/action?${query}` : "/action");
  }

  return (
    <section className="action-view">
      <div className="action-controls">
        {activeIssue ? (
          <div className="issue-context">
            <div>
              <div className="issue-context__title">{activeIssue}</div>
              <div className="issue-context__meta">
                {visibleItems.length} {visibleItems.length === 1 ? "item" : "items"}
              </div>
            </div>
            <button className="button-link button-link--inline-secondary" onClick={clearIssueFilter} type="button">
              Back to all active items
            </button>
          </div>
        ) : null}

        <div className="filter-bar" aria-label="Action filters">
          {FILTER_OPTIONS.map((option) => (
            <button
              aria-pressed={activeFilter === option.value}
              className={activeFilter === option.value ? "filter-pill active" : "filter-pill"}
              key={option.value}
              onClick={() => handleFilterChange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="summary-row" aria-label="Action summary">
          <span>
            Overdue: <strong>{summaryCounts.overdue}</strong>
          </span>
          <span>
            Due Soon: <strong>{summaryCounts.dueSoon}</strong>
          </span>
          <span>
            Waiting: <strong>{summaryCounts.waiting}</strong>
          </span>
          <span>
            Total Active: <strong>{summaryCounts.totalActive}</strong>
          </span>
        </div>

        <div className="action-toolbar">
          <label className="toggle">
            <input
              checked={showCompleted}
              onChange={(event) => setShowCompleted(event.target.checked)}
              type="checkbox"
            />
            <span>Show Completed</span>
          </label>

          <div className="action-toolbar__meta">
            {focusLabel ? (
              <p className="muted action-toolbar__filter">
                Focused on {focusLabel.toLowerCase()}.{" "}
                <button className="button-link button-link--inline" onClick={clearFocus} type="button">
                  Clear focus
                </button>
              </p>
            ) : null}
            {activeFilter !== "all" ? (
              <p className="muted action-toolbar__filter">
                Showing {getFilterLabel(activeFilter).toLowerCase()} items.{" "}
                <button className="button-link button-link--inline" onClick={() => handleFilterChange("all")} type="button">
                  Reset
                </button>
              </p>
            ) : null}
            {activeFilter === "mine" ? (
              <p className="muted action-toolbar__filter">Owner filter is set to {DEFAULT_OWNER}.</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className={selectedItem ? "action-layout action-layout--open" : "action-layout"}>
        <div className={selectedItem ? "table-panel table-panel--drawer-open" : "table-panel"}>
          {selectedItem ? (
            <button
              aria-label="Close details drawer"
              className="drawer-backdrop"
              onClick={() => setSelectedId(null)}
              type="button"
            />
          ) : null}

          <div className="table-wrap">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>
                      Due Date <span className="sort-indicator">↑ urgency</span>
                    </th>
                    <th>Status</th>
                    <th>Waiting On</th>
                    <th>Owner</th>
                    <th>Workstream</th>
                    <th>Type</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item) => (
                    <tr
                      className={
                        item.status === "Cut"
                          ? "cut-row"
                          : isItemMissingDueDate(item)
                          ? "risk-row"
                          : isWaitingIssue(item)
                          ? "waiting-row"
                          : formatDueLabel(item) === "Overdue"
                            ? "overdue-row"
                            : formatDueLabel(item)
                                ? "due-soon-row"
                                : undefined
                      }
                      data-clickable="true"
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <td>
                        <div className={item.status === "Cut" ? "cell-title cell-title--cut" : "cell-title"}>
                          {item.title}
                        </div>
                        {item.issue ? <div className="cell-subtext">{item.issue}</div> : null}
                      </td>
                      <td>
                        <div>{formatShortDate(item.dueDate)}</div>
                        {formatDueLabel(item) ? <div className="cell-hint">{formatDueLabel(item)}</div> : null}
                      </td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <select
                          aria-label={`Status for ${item.title}`}
                          className="cell-select"
                          onChange={(event) => updateItem(item.id, { status: event.target.value })}
                          value={item.status}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <select
                          aria-label={`Waiting on for ${item.title}`}
                          className={
                            isWaitingMissingReason(item)
                              ? "cell-select cell-select--required"
                              : item.status !== "Waiting"
                                ? "cell-select cell-select--muted"
                                : "cell-select"
                          }
                          onChange={(event) => updateItem(item.id, { waitingOn: event.target.value })}
                          value={item.waitingOn}
                        >
                          <option value="">{isWaitingMissingReason(item) ? "Required" : "None"}</option>
                          {WAITING_ON_SUGGESTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <input
                          aria-label={`Owner for ${item.title}`}
                          className="cell-input"
                          onChange={(event) => updateItem(item.id, { owner: event.target.value })}
                          value={item.owner}
                        />
                      </td>
                      <td>{item.workstream}</td>
                      <td>{item.type}</td>
                      <td>{formatShortDate(item.lastUpdated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {sortedItems.length === 0 ? <div className="empty-state">No items match this view.</div> : null}
            </div>
          </div>
        </div>

        {selectedItem ? (
          <aside className="drawer" aria-label="Item details">
            <div className="drawer__sticky">
              <div className="drawer__header">
                <div className="drawer__header-text">
                  <h2 className="drawer__title">{selectedItem.title}</h2>
                  <div className="drawer__workstream">{selectedItem.workstream}</div>
                </div>
                <button className="button-link" onClick={() => setSelectedId(null)} type="button">
                  Close
                </button>
              </div>

              <div className="drawer__badges">
                {selectedItem.status === "Cut" ? (
                  <span className="urgency-badge urgency-badge--cut">Cut</span>
                ) : (
                  <span className={getUrgencyBadgeClassName(selectedItem)}>
                    {formatUrgencyBadge(selectedItem)}
                  </span>
                )}
              </div>

              {selectedItem.issue ? <div className="drawer__issue">{selectedItem.issue}</div> : null}
              {isItemMissingDueDate(selectedItem) ? (
                <div className="drawer__warning">Due date not configured for this issue</div>
              ) : null}
            </div>

            <div className="drawer__sections">
              <section className="drawer-section">
                <h3 className="drawer-section__title">Operational</h3>
                <div className="drawer__grid">
                  <div className="field">
                    <label htmlFor="drawer-status">Status</label>
                    <select
                      id="drawer-status"
                      onChange={(event) => updateItem(selectedItem.id, { status: event.target.value })}
                      value={selectedItem.status}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="drawer-due-date">Due Date</label>
                    <input
                      id="drawer-due-date"
                      onChange={(event) => updateItem(selectedItem.id, { dueDate: event.target.value })}
                      type="date"
                      value={selectedItem.dueDate}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="drawer-waiting-on">Waiting On</label>
                    <select
                      className={
                        isWaitingMissingReason(selectedItem)
                          ? "cell-select cell-select--required"
                          : selectedItem.status !== "Waiting"
                            ? "cell-select cell-select--muted"
                            : "cell-select"
                      }
                      id="drawer-waiting-on"
                      onChange={(event) => updateItem(selectedItem.id, { waitingOn: event.target.value })}
                      value={selectedItem.waitingOn}
                    >
                      <option value="">
                        {isWaitingMissingReason(selectedItem) ? "Required" : "None"}
                      </option>
                      {WAITING_ON_SUGGESTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="drawer-owner">Owner</label>
                    <input
                      id="drawer-owner"
                      onChange={(event) => updateItem(selectedItem.id, { owner: event.target.value })}
                      value={selectedItem.owner}
                    />
                  </div>
                </div>
              </section>

              <section className="drawer-section">
                <h3 className="drawer-section__title">Context</h3>
                <div className="drawer__grid">
                  <div className="field">
                    <label htmlFor="drawer-workstream">Workstream</label>
                    <select
                      id="drawer-workstream"
                      onChange={(event) => {
                        const nextWorkstream = event.target.value;
                        const nextIssues = getIssuesForWorkstream(nextWorkstream);

                        updateItem(selectedItem.id, {
                          workstream: nextWorkstream,
                          issue:
                            selectedItem.issue && nextIssues.includes(selectedItem.issue as (typeof nextIssues)[number])
                              ? selectedItem.issue
                              : ""
                        });
                      }}
                      value={selectedItem.workstream}
                    >
                      {WORKSTREAM_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedItem.issue ? (
                    <div className="field">
                      <label htmlFor="drawer-issue">Issue</label>
                      <select
                        id="drawer-issue"
                        onChange={(event) =>
                          updateItem(selectedItem.id, {
                            issue: event.target.value || undefined,
                            dueDate: event.target.value ? (getIssueDueDate(event.target.value) ?? "") : selectedItem.dueDate
                          })
                        }
                        value={selectedItem.issue ?? ""}
                      >
                        <option value="">None</option>
                        {getIssuesForWorkstream(selectedItem.workstream).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {selectedIssueRecord ? (
                    <div className="field">
                      <label>Issue Status</label>
                      <div className="field-static">
                        {selectedIssueRecord.status}
                        {!selectedIssueRecord.dueDate ? " — missing due date" : ""}
                      </div>
                    </div>
                  ) : null}
                  <div className="field">
                    <label htmlFor="drawer-type">Type</label>
                    <input
                      id="drawer-type"
                      onChange={(event) => updateItem(selectedItem.id, { type: event.target.value })}
                      value={selectedItem.type}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="drawer-last-updated">Last Updated</label>
                    <input
                      id="drawer-last-updated"
                      onChange={(event) => updateItem(selectedItem.id, { lastUpdated: event.target.value })}
                      type="date"
                      value={selectedItem.lastUpdated}
                    />
                  </div>
                </div>
              </section>

              <section className="drawer-section">
                <h3 className="drawer-section__title">Notes</h3>
                <div className="field">
                  <label htmlFor="drawer-notes">Notes</label>
                  <textarea
                    id="drawer-notes"
                    onChange={(event) => updateItem(selectedItem.id, { notes: event.target.value })}
                    rows={10}
                    value={selectedItem.notes}
                  />
                </div>
              </section>

              <section className="drawer-section drawer-section--danger">
                <h3 className="drawer-section__title">Delete Item</h3>
                {!isDeleteConfirmOpen ? (
                  <button className="button-danger" onClick={() => setIsDeleteConfirmOpen(true)} type="button">
                    Delete
                  </button>
                ) : (
                  <div className="confirm-delete">
                    <div className="confirm-delete__title">Delete this item?</div>
                    <div className="confirm-delete__copy">
                      This will remove it from the current app state.
                    </div>
                    <div className="confirm-delete__actions">
                      <button
                        className="button-link button-link--inline-secondary"
                        onClick={() => setIsDeleteConfirmOpen(false)}
                        type="button"
                      >
                        Cancel
                      </button>
                      <button
                        className="button-danger"
                        onClick={() => {
                          deleteItem(selectedItem.id);
                          setSelectedId(null);
                          setIsDeleteConfirmOpen(false);
                        }}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function getFilterValue(filter?: string): ActionFilter {
  if (filter === "overdue" || filter === "dueSoon" || filter === "waiting" || filter === "mine") {
    return filter;
  }

  return "all";
}

function getFocusValue(focus?: string): ActionFocus {
  if (focus === "sponsor" || focus === "production") {
    return focus;
  }

  return "all";
}

function getFilterLabel(filter: ActionFilter) {
  return FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? "All";
}

function formatUrgencyBadge(item: ActionItem) {
  if (isWaitingIssue(item)) {
    return "Waiting";
  }

  const dueLabel = formatDueLabel(item);
  return dueLabel || `Due ${formatShortDate(item.dueDate)}`;
}

function getUrgencyBadgeClassName(item: ActionItem) {
  if (isWaitingIssue(item)) {
    return "urgency-badge urgency-badge--waiting";
  }

  if (formatDueLabel(item) === "Overdue") {
    return "urgency-badge urgency-badge--overdue";
  }

  return "urgency-badge urgency-badge--due-soon";
}
