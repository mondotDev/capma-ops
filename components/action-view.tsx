"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppState } from "@/components/app-state";
import type { ActionItem } from "@/lib/sample-data";
import {
  getActionDueDateValue,
  getActionEventGroupValue,
  getActionFilterValue,
  getActionFocusValue,
  getActionLensValue,
  getActionQueryValue,
  getActionRowClassName,
  getVisibleActionItems,
  groupItemsByEventGroup
} from "@/lib/action-view-utils";
import {
  type ActionFilter,
  type ActionFocus,
  type ActionLens,
  DEFAULT_OWNER,
  daysSince,
  EVENT_GROUP_OPTIONS,
  formatDueLabel,
  formatShortDate,
  getActionSummaryCounts,
  getIssuesForWorkstream,
  getOwnerOptions,
  isItemMissingDueDate,
  isBlockedItem,
  isTerminalStatus,
  isWaitingIssue,
  isWaitingMissingReason,
  OWNER_OPTIONS,
  sortByPriority,
  STATUS_OPTIONS,
  syncActionItemIssue,
  syncActionItemWorkstream,
  WAITING_ON_SUGGESTIONS,
  WORKSTREAM_OPTIONS
} from "@/lib/ops-utils";

const FILTER_OPTIONS: { label: string; value: ActionFilter }[] = [
  { label: "All", value: "all" },
  { label: "Overdue", value: "overdue" },
  { label: "Due Soon", value: "dueSoon" },
  { label: "Waiting", value: "waiting" },
  { label: "Blocked", value: "blocked" },
  { label: "Mine", value: "mine" }
];

const LENS_OPTIONS: { label: string; value: ActionLens }[] = [
  { label: "All Work", value: "all" },
  { label: "Execution Now", value: "executionNow" },
  { label: "Planned Later", value: "plannedLater" },
  { label: "Review: No Due Date", value: "reviewMissingDueDate" },
  { label: "Review: Waiting Too Long", value: "reviewWaitingTooLong" },
  { label: "Review: Stale", value: "reviewStale" }
];

const FOCUS_LABELS: Record<Exclude<ActionFocus, "all">, string> = {
  sponsor: "Sponsor items",
  production: "Production items"
};

const EXECUTION_LENS_OPTIONS = LENS_OPTIONS.slice(0, 3);
const REVIEW_LENS_OPTIONS = LENS_OPTIONS.slice(3);
const STATUS_FILTER_OPTIONS = FILTER_OPTIONS.filter(
  (option) => option.value === "waiting" || option.value === "blocked" || option.value === "mine"
);

export function ActionView({
  initialDueDate,
  initialEventGroup,
  initialFilter,
  initialFocus,
  initialLens,
  initialIssue,
  initialQuery
}: {
  initialDueDate?: string;
  initialEventGroup?: string;
  initialFilter?: string;
  initialFocus?: string;
  initialLens?: string;
  initialIssue?: string;
  initialQuery?: string;
}) {
  const { bulkUpdateItems, deleteItem, items, issues, updateItem } = useAppState();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [bulkOwner, setBulkOwner] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [blockedByDraft, setBlockedByDraft] = useState("");
  const activeFilter = getActionFilterValue(initialFilter);
  const activeFocus = getActionFocusValue(initialFocus);
  const activeLens = getActionLensValue(initialLens);
  const activeDueDate = getActionDueDateValue(initialDueDate);
  const activeEventGroup = getActionEventGroupValue(initialEventGroup);
  const activeQuery = getActionQueryValue(initialQuery);
  const summaryCounts = useMemo(() => getActionSummaryCounts(items), [items]);
  const activeIssue = initialIssue?.trim() || "";
  const eventGroupOptions = useMemo(
    () =>
      ["all", ...new Set(items.map((item) => item.eventGroup?.trim()).filter((value): value is string => Boolean(value)))]
        .map((value) => ({
          label: value === "all" ? "All Events" : value,
          value
        })),
    [items]
  );

  const visibleItems = useMemo(
    () =>
      getVisibleActionItems(items, {
        activeDueDate,
        activeEventGroup,
        activeFilter,
        activeFocus,
        activeLens,
        activeIssue,
        activeQuery,
        showCompleted
      }),
    [activeDueDate, activeEventGroup, activeFilter, activeFocus, activeIssue, activeLens, activeQuery, items, showCompleted]
  );

  const sortedItems = useMemo(() => [...visibleItems].sort(sortByPriority), [visibleItems]);
  const groupedItems = useMemo(() => groupItemsByEventGroup(sortedItems), [sortedItems]);
  const selectedItem = sortedItems.find((item) => item.id === selectedId) ?? null;
  const selectedIssueRecord = selectedItem?.issue
    ? issues.find((issue) => issue.label === selectedItem.issue) ?? null
    : null;
  const selectedItemIssueOptions = selectedItem ? getIssuesForWorkstream(selectedItem.workstream) : [];
  const focusLabel = activeFocus !== "all" ? FOCUS_LABELS[activeFocus] : null;
  const selectedVisibleIds = useMemo(
    () => selectedItemIds.filter((id) => sortedItems.some((item) => item.id === id)),
    [selectedItemIds, sortedItems]
  );
  const allVisibleSelected = sortedItems.length > 0 && selectedVisibleIds.length === sortedItems.length;

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
    setSelectedItemIds((current) => current.filter((id) => sortedItems.some((item) => item.id === id)));
  }, [sortedItems]);

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

  useEffect(() => {
    setIsEditingTitle(false);
    setTitleDraft(selectedItem?.title ?? "");
    setBlockedByDraft(selectedItem?.blockedBy ?? "");
  }, [selectedItem?.blockedBy, selectedItem?.id, selectedItem?.title]);

  function updateQuery(
    nextFilter: ActionFilter,
    nextFocus: ActionFocus,
    nextLens: ActionLens,
    nextEventGroup: string,
    nextDueDate: string,
    nextQuery: string
  ) {
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

    if (nextLens === "all") {
      params.delete("lens");
    } else {
      params.set("lens", nextLens);
    }

    if (nextEventGroup === "all") {
      params.delete("eventGroup");
    } else {
      params.set("eventGroup", nextEventGroup);
    }

    if (!nextDueDate) {
      params.delete("dueDate");
    } else {
      params.set("dueDate", nextDueDate);
    }

    if (!nextQuery.trim()) {
      params.delete("q");
    } else {
      params.set("q", nextQuery);
    }

    const query = params.toString();
    router.replace(query ? `/action?${query}` : "/action");
  }

  function handleFilterChange(nextFilter: ActionFilter) {
    updateQuery(nextFilter, activeFocus, activeLens, activeEventGroup, activeDueDate, activeQuery);
  }

  function commitBlockedByDraft(item: ActionItem, value: string) {
    if ((item.blockedBy ?? "") === value) {
      return;
    }

    updateItem(item.id, { blockedBy: value });
  }

  function commitTitleDraft(item: ActionItem, value: string) {
    if (item.title === value) {
      return;
    }

    updateItem(item.id, { title: value });
  }

  function finishTitleEdit(item: ActionItem) {
    commitTitleDraft(item, titleDraft);
    setIsEditingTitle(false);
  }

  function cancelTitleEdit(item: ActionItem) {
    setTitleDraft(item.title);
    setIsEditingTitle(false);
  }

  function clearFocus() {
    updateQuery(activeFilter, "all", activeLens, activeEventGroup, activeDueDate, activeQuery);
  }

  function handleLensChange(nextLens: ActionLens) {
    updateQuery(activeFilter, activeFocus, nextLens, activeEventGroup, activeDueDate, activeQuery);
  }

  function handleEventGroupChange(nextEventGroup: string) {
    updateQuery(activeFilter, activeFocus, activeLens, nextEventGroup, activeDueDate, activeQuery);
  }

  function clearIssueFilter() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("issue");
    const query = params.toString();
    router.replace(query ? `/action?${query}` : "/action");
  }

  function clearDueDateFilter() {
    updateQuery(activeFilter, activeFocus, activeLens, activeEventGroup, "", activeQuery);
  }

  function clearSearchQuery() {
    updateQuery(activeFilter, activeFocus, activeLens, activeEventGroup, activeDueDate, "");
  }

  function toggleGroup(groupLabel: string) {
    setCollapsedGroups((current) => ({
      ...current,
      [groupLabel]: !current[groupLabel]
    }));
  }

  function handleBulkOwnerApply() {
    if (!bulkOwner || selectedVisibleIds.length === 0) {
      return;
    }

    bulkUpdateItems(selectedVisibleIds, { owner: bulkOwner });
    setBulkFeedback(
      `Assigned ${bulkOwner} to ${selectedVisibleIds.length} ${selectedVisibleIds.length === 1 ? "item" : "items"}.`
    );
    setSelectedItemIds([]);
    setBulkOwner("");
  }

  function toggleItemSelection(itemId: string) {
    setBulkFeedback("");
    setSelectedItemIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]
    );
  }

  function toggleSelectAllVisible() {
    setBulkFeedback("");
    setSelectedItemIds((current) =>
      allVisibleSelected ? current.filter((id) => !sortedItems.some((item) => item.id === id)) : sortedItems.map((item) => item.id)
    );
  }

  function clearSelection() {
    setSelectedItemIds([]);
    setBulkFeedback("");
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
          <div className="filter-group">
            <span className="filter-group__label">Execution</span>
            <div className="filter-group__pills">
              {EXECUTION_LENS_OPTIONS.map((option) => (
                <button
                  aria-pressed={activeLens === option.value}
                  className={activeLens === option.value ? "filter-pill active" : "filter-pill"}
                  key={option.value}
                  onClick={() => handleLensChange(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <span className="filter-group__label">Review</span>
            <div className="filter-group__pills">
              {REVIEW_LENS_OPTIONS.map((option) => (
                <button
                  aria-pressed={activeLens === option.value}
                  className={activeLens === option.value ? "filter-pill active" : "filter-pill"}
                  key={option.value}
                  onClick={() => handleLensChange(option.value)}
                  type="button"
                >
                  {option.label.replace("Review: ", "")}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <span className="filter-group__label">Status</span>
            <div className="filter-group__pills">
              {STATUS_FILTER_OPTIONS.map((option) => (
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
          </div>
          <label className="field">
            <span className="muted">Event</span>
            <select
              aria-label="Filter by event"
              className="cell-select"
              onChange={(event) => handleEventGroupChange(event.target.value)}
              value={activeEventGroup}
            >
              {eventGroupOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="summary-row" aria-label="Action summary">
          <span>
            Overdue: <strong>{summaryCounts.overdue}</strong>
          </span>
          <span>
            Due Soon: <strong>{summaryCounts.dueSoon}</strong>
          </span>
          <span>
            Blocked: <strong>{summaryCounts.blocked}</strong>
          </span>
          <span>
            Waiting: <strong>{summaryCounts.waiting}</strong>
          </span>
          <span>
            Total Active: <strong>{summaryCounts.totalActive}</strong>
          </span>
        </div>

        {selectedVisibleIds.length > 0 ? (
          <div className="bulk-action-bar">
            <strong>{selectedVisibleIds.length} selected</strong>
            <select
              aria-label="Assign owner to selected items"
              className="cell-select bulk-action-bar__select"
              onChange={(event) => setBulkOwner(event.target.value)}
              value={bulkOwner}
            >
              <option value="">Select owner</option>
              {OWNER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              className="topbar__button"
              disabled={!bulkOwner}
              onClick={handleBulkOwnerApply}
              type="button"
            >
              Apply Owner
            </button>
            <button className="button-link button-link--inline-secondary" onClick={clearSelection} type="button">
              Clear
            </button>
            {bulkFeedback ? <span className="muted">{bulkFeedback}</span> : null}
          </div>
        ) : null}

        {activeDueDate ? (
          <div className="issue-context">
            <div>
              <div className="issue-context__title">Due on {formatShortDate(activeDueDate)}</div>
              <div className="issue-context__meta">
                {visibleItems.length} {visibleItems.length === 1 ? "item" : "items"}
              </div>
            </div>
            <button className="button-link button-link--inline-secondary" onClick={clearDueDateFilter} type="button">
              Back to all due dates
            </button>
          </div>
        ) : null}

        {activeQuery ? (
          <div className="issue-context">
            <div>
              <div className="issue-context__title">Search: {activeQuery}</div>
              <div className="issue-context__meta">
                {visibleItems.length} {visibleItems.length === 1 ? "item" : "items"}
              </div>
            </div>
            <button className="button-link button-link--inline-secondary" onClick={clearSearchQuery} type="button">
              Clear search
            </button>
          </div>
        ) : null}

        <div className="action-toolbar">
          <div className="action-toolbar__controls">
            <label className="toggle">
              <input
                checked={showCompleted}
                onChange={(event) => setShowCompleted(event.target.checked)}
                type="checkbox"
              />
              <span>Show Completed</span>
            </label>
            <span className="muted">Select rows to bulk-assign owner.</span>
          </div>

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
            {activeLens !== "all" ? (
              <p className="muted action-toolbar__filter">
                Lens: {getLensLabel(activeLens)}.{" "}
                <button className="button-link button-link--inline" onClick={() => handleLensChange("all")} type="button">
                  Clear
                </button>
              </p>
            ) : null}
            {activeEventGroup !== "all" ? (
              <p className="muted action-toolbar__filter">
                Event group: {activeEventGroup}.{" "}
                <button className="button-link button-link--inline" onClick={() => handleEventGroupChange("all")} type="button">
                  Clear
                </button>
              </p>
            ) : null}
            {activeQuery ? (
              <p className="muted action-toolbar__filter">
                Search is active.{" "}
                <button className="button-link button-link--inline" onClick={clearSearchQuery} type="button">
                  Clear
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
                    <th>
                      <input
                        aria-label="Select all visible items"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        type="checkbox"
                      />
                    </th>
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
                {groupedItems.map((group) => {
                  const isCollapsed = collapsedGroups[group.label] ?? false;

                  return (
                    <tbody key={group.label}>
                      <tr className="group-header-row">
                        <td colSpan={9}>
                          <button
                            aria-expanded={!isCollapsed}
                            className="group-header-button"
                            onClick={() => toggleGroup(group.label)}
                            type="button"
                          >
                            <span>{isCollapsed ? "Show" : "Hide"}</span>
                            <strong>{group.label}</strong>
                            <span>{group.items.length} {group.items.length === 1 ? "item" : "items"}</span>
                          </button>
                        </td>
                      </tr>
                      {!isCollapsed
                        ? group.items.map((item) => (
                            <tr
                              className={getActionRowClassName(item)}
                              data-clickable="true"
                              key={item.id}
                              onClick={() => setSelectedId(item.id)}
                            >
                              <td onClick={(event) => event.stopPropagation()}>
                                <input
                                  aria-label={`Select ${item.title}`}
                                  checked={selectedItemIds.includes(item.id)}
                                  onChange={() => toggleItemSelection(item.id)}
                                  type="checkbox"
                                />
                              </td>
                              <td className="cell-primary">
                                <div
                                  className={[
                                    isTerminalStatus(item.status) ? "cell-title cell-title--cut" : "cell-title",
                                    !isTerminalStatus(item.status) && formatDueLabel(item) === "Overdue"
                                      ? "cell-title--overdue"
                                      : "",
                                    !isTerminalStatus(item.status) && item.status === "Waiting" && daysSince(item.lastUpdated) >= 7
                                      ? "cell-title--waiting-aged"
                                      : ""
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                >
                                  {item.title}
                                </div>
                                {item.blockedBy?.trim() ? (
                                  <div className="cell-subtext cell-subtext--blocked">Blocked by: {item.blockedBy.trim()}</div>
                                ) : null}
                                {item.issue ? <div className="cell-subtext">{item.issue}</div> : null}
                              </td>
                              <td>
                                <div>{formatShortDate(item.dueDate)}</div>
                                {!isTerminalStatus(item.status) && formatDueLabel(item) ? (
                                  <div className="cell-hint">{formatDueLabel(item)}</div>
                                ) : null}
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
                                <select
                                  aria-label={`Owner for ${item.title}`}
                                  className="cell-select"
                                  onChange={(event) => updateItem(item.id, { owner: event.target.value })}
                                  value={item.owner}
                                >
                                  {getOwnerOptions(item.owner).map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="cell-muted">{item.workstream}</td>
                              <td className="cell-muted">{item.type}</td>
                              <td className="cell-muted">{formatShortDate(item.lastUpdated)}</td>
                            </tr>
                          ))
                        : null}
                    </tbody>
                  );
                })}
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
                  {isEditingTitle ? (
                    <input
                      aria-label="Edit title"
                      className="drawer__title-input"
                      id="drawer-title"
                      onBlur={() => finishTitleEdit(selectedItem)}
                      onChange={(event) => setTitleDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          cancelTitleEdit(selectedItem);
                        }

                        if (event.key === "Enter") {
                          event.preventDefault();
                          finishTitleEdit(selectedItem);
                        }
                      }}
                      autoFocus
                      value={titleDraft}
                    />
                  ) : (
                    <h2 className="drawer__title">
                      <button
                        className="drawer__title-button"
                        onClick={() => setIsEditingTitle(true)}
                        type="button"
                      >
                        {selectedItem.title}
                      </button>
                    </h2>
                  )}
                  <div className="drawer__workstream">{selectedItem.workstream}</div>
                </div>
                <button className="button-link" onClick={() => setSelectedId(null)} type="button">
                  Close
                </button>
              </div>

              <div className="drawer__badges">
                {isBlockedItem(selectedItem) ? (
                  <span className="urgency-badge urgency-badge--blocked">Blocked</span>
                ) : null}
                {isTerminalStatus(selectedItem.status) ? (
                  <span className="urgency-badge urgency-badge--cut">{selectedItem.status}</span>
                ) : (
                  <span className={getUrgencyBadgeClassName(selectedItem)}>
                    {formatUrgencyBadge(selectedItem)}
                  </span>
                )}
              </div>

              {selectedItem.issue ? <div className="drawer__issue">{selectedItem.issue}</div> : null}
              {selectedItem.blockedBy?.trim() ? (
                <div className="drawer__warning drawer__warning--blocked">Blocked by {selectedItem.blockedBy.trim()}</div>
              ) : null}
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
                    <select
                      id="drawer-owner"
                      onChange={(event) => updateItem(selectedItem.id, { owner: event.target.value })}
                      value={selectedItem.owner}
                    >
                      {getOwnerOptions(selectedItem.owner).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="toggle" htmlFor="drawer-blocked">
                      <input
                        checked={selectedItem.isBlocked ?? false}
                        id="drawer-blocked"
                        onChange={(event) => updateItem(selectedItem.id, { isBlocked: event.target.checked })}
                        type="checkbox"
                      />
                      <span>Blocked</span>
                    </label>
                  </div>
                  <div className="field">
                    <label htmlFor="drawer-blocked-by">Blocked By</label>
                    <input
                      id="drawer-blocked-by"
                      onBlur={() => commitBlockedByDraft(selectedItem, blockedByDraft)}
                      onChange={(event) => setBlockedByDraft(event.target.value)}
                      value={blockedByDraft}
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
                        const nextItem = syncActionItemWorkstream(selectedItem, nextWorkstream);

                        updateItem(selectedItem.id, {
                          workstream: nextItem.workstream,
                          eventGroup: nextItem.eventGroup,
                          issue: nextItem.issue
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
                  <div className="field">
                    <label htmlFor="drawer-event-group">Event Group</label>
                    <select
                      id="drawer-event-group"
                      onChange={(event) =>
                        updateItem(selectedItem.id, {
                          eventGroup: event.target.value || undefined
                        })
                      }
                      value={selectedItem.eventGroup ?? ""}
                    >
                      <option value="">None</option>
                      {EVENT_GROUP_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedItemIssueOptions.length > 0 || selectedItem.issue ? (
                    <div className="field">
                      <label htmlFor="drawer-issue">Issue</label>
                      <select
                        id="drawer-issue"
                        onChange={(event) =>
                          {
                            const nextItem = syncActionItemIssue(selectedItem, event.target.value);

                            updateItem(selectedItem.id, {
                              issue: nextItem.issue || undefined,
                              workstream: nextItem.workstream,
                              eventGroup: nextItem.eventGroup,
                              dueDate: nextItem.dueDate
                            });
                          }
                        }
                        value={selectedItem.issue ?? ""}
                      >
                        <option value="">None</option>
                        {selectedItemIssueOptions.map((option) => (
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

function getFilterLabel(filter: ActionFilter) {
  return FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? "All";
}

function getLensLabel(lens: ActionLens) {
  return LENS_OPTIONS.find((option) => option.value === lens)?.label ?? "All Work";
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
