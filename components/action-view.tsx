"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ActionItemDrawerHeader } from "@/components/action-item-drawer-header";
import { ActionItemNotesPanel } from "@/components/action-item-notes-panel";
import { useAppState } from "@/components/app-state";
import {
  getCollateralExecutionDueLabel,
  getCollateralExecutionRowClassName,
  getVisibleCollateralExecutionRows
} from "@/lib/collateral-execution-view";
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
  createActionNoteEntry,
  type ActionFilter,
  type ActionFocus,
  type ActionLens,
  DEFAULT_OWNER,
  daysSince,
  EVENT_GROUP_OPTIONS,
  formatDueLabel,
  formatShortDate,
  getActionSummaryCounts,
  getContextualDueDateLabel,
  getIssuesForWorkstream,
  getOwnerOptions,
  LOCAL_FALLBACK_NOTE_AUTHOR,
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
  (option) =>
    option.value === "overdue" ||
    option.value === "dueSoon" ||
    option.value === "waiting" ||
    option.value === "blocked" ||
    option.value === "mine"
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
  const {
    activeEventInstanceId,
    bulkUpdateItems,
    collateralItems,
    deleteItem,
    eventInstances,
    eventSubEvents,
    eventTypes,
    items,
    issues,
    updateItem
  } = useAppState();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [bulkOwner, setBulkOwner] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [blockedByDraft, setBlockedByDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const activeFilter = getActionFilterValue(initialFilter);
  const activeFocus = getActionFocusValue(initialFocus);
  const activeLens = getActionLensValue(initialLens);
  const activeDueDate = getActionDueDateValue(initialDueDate);
  const activeEventGroup = getActionEventGroupValue(initialEventGroup);
  const activeQuery = getActionQueryValue(initialQuery);
  const summaryCounts = useMemo(() => getActionSummaryCounts(items), [items]);
  const activeIssue = initialIssue?.trim() || "";

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
  const visibleCollateralExecutionItems = useMemo(
    () =>
      getVisibleCollateralExecutionRows({
        activeDueDate,
        activeEventGroup,
        activeEventInstanceId,
        activeFilter,
        activeFocus,
        activeIssue,
        activeLens,
        activeQuery,
        collateralItems,
        eventInstances,
        eventSubEvents,
        eventTypes
      }),
    [
      activeDueDate,
      activeEventGroup,
      activeEventInstanceId,
      activeFilter,
      activeFocus,
      activeIssue,
      activeLens,
      activeQuery,
      collateralItems,
      eventInstances,
      eventSubEvents,
      eventTypes
    ]
  );
  const eventGroupOptions = useMemo(() => {
    const optionValues = new Set<string>(["all"]);

    items
      .map((item) => item.eventGroup?.trim())
      .filter((value): value is string => Boolean(value))
      .forEach((value) => optionValues.add(value));

    visibleCollateralExecutionItems
      .map((item) => item.eventGroupLabel.trim())
      .filter((value) => Boolean(value))
      .forEach((value) => optionValues.add(value));

    return [...optionValues].map((value) => ({
      label: value === "all" ? "All Events" : value,
      value
    }));
  }, [items, visibleCollateralExecutionItems]);
  const visibleExecutionCount = visibleItems.length + visibleCollateralExecutionItems.length;

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
    setIsActionsMenuOpen(false);
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
    setNoteDraft("");
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

  function addNote(item: ActionItem) {
    const nextEntry = createActionNoteEntry(noteDraft, { author: LOCAL_FALLBACK_NOTE_AUTHOR });

    if (!nextEntry) {
      return;
    }

    updateItem(item.id, { noteEntries: [nextEntry, ...item.noteEntries] });
    setNoteDraft("");
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

  function openCollateralExecutionItem(eventInstanceId: string, collateralId: string) {
    const params = new URLSearchParams();
    params.set("eventInstanceId", eventInstanceId);
    params.set("collateralId", collateralId);
    router.push(`/collateral?${params.toString()}`);
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
          <div className="filter-bar__main">
            <div className="filter-group">
              <span className="filter-group__label">Execution</span>
              <div className="filter-group__pills">
                {EXECUTION_LENS_OPTIONS.map((option) => (
                  <button
                    aria-pressed={activeLens === option.value}
                    className={
                      activeLens === option.value
                        ? option.value === "all"
                          ? "filter-pill filter-pill--default-selected"
                          : "filter-pill active"
                        : "filter-pill"
                    }
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
          </div>
          <label className="filter-field">
            <span className="filter-field__label">Event</span>
            <select
              aria-label="Filter by event"
              className="cell-select filter-field__select"
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
          <span className="summary-chip summary-chip--overdue">
            <span className="summary-chip__label">Overdue</span>
            <strong className="summary-chip__value">{summaryCounts.overdue}</strong>
          </span>
          <span className="summary-chip summary-chip--due-soon">
            <span className="summary-chip__label">Due Soon</span>
            <strong className="summary-chip__value">{summaryCounts.dueSoon}</strong>
          </span>
          <span className="summary-chip summary-chip--blocked">
            <span className="summary-chip__label">Blocked</span>
            <strong className="summary-chip__value">{summaryCounts.blocked}</strong>
          </span>
          <span className="summary-chip summary-chip--waiting">
            <span className="summary-chip__label">Waiting</span>
            <strong className="summary-chip__value">{summaryCounts.waiting}</strong>
          </span>
          <span className="summary-chip">
            <span className="summary-chip__label">Total Active</span>
            <strong className="summary-chip__value">{summaryCounts.totalActive}</strong>
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
                {visibleExecutionCount} {visibleExecutionCount === 1 ? "item" : "items"}
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
                {visibleExecutionCount} {visibleExecutionCount === 1 ? "item" : "items"}
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
            <span className="muted action-toolbar__hint">Select rows to bulk-assign owner.</span>
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
            {visibleCollateralExecutionItems.length > 0 ? (
              <section className="card card--secondary collateral-execution-section">
                <div className="card__title">COLLATERAL IN EXECUTION</div>
                <p className="collateral-execution-section__copy">
                  Production work surfaced from Collateral. Click a row to open the source item.
                </p>
                <div className="table-scroll">
                  <table>
                    <thead className="table-head">
                      <tr>
                        <th className="table-head__cell table-head__cell--title">
                          <span className="table-head__label">Title</span>
                        </th>
                        <th className="table-head__cell table-head__cell--due-date">
                          <span className="table-head__label">Due Date</span>
                        </th>
                        <th className="table-head__cell table-head__cell--status">
                          <span className="table-head__label">Status</span>
                        </th>
                        <th className="table-head__cell table-head__cell--owner">
                          <span className="table-head__label">Owner</span>
                        </th>
                        <th className="table-head__cell table-head__cell--workstream">
                          <span className="table-head__label">Sub-Event</span>
                        </th>
                        <th className="table-head__cell table-head__cell--type">
                          <span className="table-head__label">Type</span>
                        </th>
                        <th className="table-head__cell table-head__cell--updated">
                          <span className="table-head__label">Last Updated</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCollateralExecutionItems.map((item) => (
                        <tr className={getCollateralExecutionRowClassName(item)} key={item.id}>
                          <td className="cell-primary">
                            <button
                              className="collateral-execution-row__open"
                              onClick={() => openCollateralExecutionItem(item.eventInstanceId, item.collateralId)}
                              type="button"
                            >
                              <div className="cell-title">
                                {item.title}
                                <span className="collateral-origin-badge">{item.typeLabel}</span>
                              </div>
                              <div className="cell-subtext">{item.eventInstanceName}</div>
                              {item.blockedBy?.trim() ? (
                                <div className="cell-subtext cell-subtext--blocked">Blocked by: {item.blockedBy.trim()}</div>
                              ) : item.printer ? (
                                <div className="cell-subtext">Printer: {item.printer}</div>
                              ) : null}
                            </button>
                          </td>
                          <td className="cell-due-date">
                            <div>{formatShortDate(item.dueDate)}</div>
                            {item.dueDate && getCollateralExecutionDueLabel(item) ? (
                              <div className="cell-hint">{getCollateralExecutionDueLabel(item)}</div>
                            ) : null}
                          </td>
                          <td className="cell-status">
                            <span className="cell-status__text">{item.status}</span>
                          </td>
                          <td className="cell-muted cell-owner">{item.owner || "Unassigned"}</td>
                          <td className="cell-muted cell-workstream">{item.subEventName}</td>
                          <td className="cell-muted cell-type">{item.typeLabel}</td>
                          <td className="cell-muted cell-updated">{formatShortDate(item.lastUpdated)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
            <div className="table-scroll">
              <table>
                <thead className="table-head">
                  <tr>
                    <th className="table-head__select">
                      <input
                        aria-label="Select all visible items"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAllVisible}
                        type="checkbox"
                      />
                    </th>
                    <th className="table-head__cell table-head__cell--title">
                      <span className="table-head__label">Title</span>
                    </th>
                    <th className="table-head__cell table-head__cell--due-date">
                      <span className="table-head__label">Due Date</span>
                      <span className="sort-indicator">↑ urgency</span>
                    </th>
                    <th className="table-head__cell table-head__cell--status">
                      <span className="table-head__label">Status</span>
                    </th>
                    <th className="table-head__cell table-head__cell--waiting">
                      <span className="table-head__label">Waiting On</span>
                    </th>
                    <th className="table-head__cell table-head__cell--owner">
                      <span className="table-head__label">Owner</span>
                    </th>
                    <th className="table-head__cell table-head__cell--workstream">
                      <span className="table-head__label">Workstream</span>
                    </th>
                    <th className="table-head__cell table-head__cell--type">
                      <span className="table-head__label">Type</span>
                    </th>
                    <th className="table-head__cell table-head__cell--updated">
                      <span className="table-head__label">Last Updated</span>
                    </th>
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
                              <td className="cell-due-date">
                                <div>{formatShortDate(item.dueDate)}</div>
                                {!isTerminalStatus(item.status) && formatDueLabel(item) ? (
                                  <div className="cell-hint">{formatDueLabel(item)}</div>
                                ) : null}
                              </td>
                              <td className="cell-status" onClick={(event) => event.stopPropagation()}>
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
                              <td className="cell-waiting" onClick={(event) => event.stopPropagation()}>
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
                              <td className="cell-owner" onClick={(event) => event.stopPropagation()}>
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
                              <td className="cell-muted cell-workstream">{item.workstream}</td>
                              <td className="cell-muted cell-type">{item.type}</td>
                              <td className="cell-muted cell-updated">{formatShortDate(item.lastUpdated)}</td>
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
          <aside className={isBlockedItem(selectedItem) ? "drawer drawer--blocked" : "drawer"} aria-label="Item details">
            <ActionItemDrawerHeader
              isActionsMenuOpen={isActionsMenuOpen}
              isEditingTitle={isEditingTitle}
              item={selectedItem}
              onCancelTitleEdit={() => cancelTitleEdit(selectedItem)}
              onClose={() => setSelectedId(null)}
              onDeleteRequest={() => {
                setIsDeleteConfirmOpen(true);
                setIsActionsMenuOpen(false);
              }}
              onFinishTitleEdit={() => finishTitleEdit(selectedItem)}
              onStartTitleEdit={() => setIsEditingTitle(true)}
              onTitleDraftChange={setTitleDraft}
              onToggleActionsMenu={() => setIsActionsMenuOpen((current) => !current)}
              titleDraft={titleDraft}
            />
            <div className="drawer__sections">
              <section className="drawer-section drawer-section--form">
                <div className="drawer__grid drawer__grid--form">
                  <div className="field field--priority">
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
                  <div className="field field--priority">
                    <label htmlFor="drawer-due-date">
                      {getContextualDueDateLabel(selectedItem.status, isBlockedItem(selectedItem))}
                    </label>
                    <input
                      id="drawer-due-date"
                      onChange={(event) => updateItem(selectedItem.id, { dueDate: event.target.value })}
                      type="date"
                      value={selectedItem.dueDate}
                    />
                    {selectedItem.status === "Waiting" ? (
                      <div className="field-hint">Use this date for the next check-in while the item is waiting.</div>
                    ) : isBlockedItem(selectedItem) ? (
                      <div className="field-hint">Use this date for the next step needed to unblock the work.</div>
                    ) : null}
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
                    <div className="field-hint">Who or what you are waiting on. Use a shared category when one fits.</div>
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
                  <div className="field field--secondary">
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
                  <div className="field field--secondary">
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
                  <div className="field field--secondary">
                    <label htmlFor="drawer-type">Type</label>
                    <input
                      id="drawer-type"
                      onChange={(event) => updateItem(selectedItem.id, { type: event.target.value })}
                      value={selectedItem.type}
                    />
                  </div>
                  <div className="field drawer__blocked-control">
                    <div className="drawer__blocked-stack">
                      <label className="toggle drawer__blocked-toggle" htmlFor="drawer-blocked">
                        <input
                          checked={selectedItem.isBlocked ?? false}
                          id="drawer-blocked"
                          onChange={(event) => updateItem(selectedItem.id, { isBlocked: event.target.checked })}
                          type="checkbox"
                        />
                        <span>Blocked</span>
                      </label>
                    </div>
                  </div>
                  {selectedItem.isBlocked ? (
                    <div className="field field--wide drawer__blocked-details">
                      <label htmlFor="drawer-blocked-by">Blocked By</label>
                      <input
                        id="drawer-blocked-by"
                        onBlur={() => commitBlockedByDraft(selectedItem, blockedByDraft)}
                        onChange={(event) => setBlockedByDraft(event.target.value)}
                        placeholder="Short reason the work cannot move, like logo approval or internal decision"
                        value={blockedByDraft}
                      />
                      <div className="field-hint">Use a short blocker reason. Shared categories will stay standardized; custom reasons are preserved.</div>
                    </div>
                  ) : null}
                  {selectedItemIssueOptions.length > 0 || selectedItem.issue ? (
                    <div className="field field--wide">
                      <label htmlFor="drawer-issue">Issue</label>
                      <select
                        id="drawer-issue"
                        onChange={(event) => {
                          const nextItem = syncActionItemIssue(selectedItem, event.target.value);

                          updateItem(selectedItem.id, {
                            issue: nextItem.issue || undefined,
                            workstream: nextItem.workstream,
                            eventGroup: nextItem.eventGroup,
                            dueDate: nextItem.dueDate
                          });
                        }}
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
                    <div className="field field--wide">
                      <div className="field-static">
                        Issue status: {selectedIssueRecord.status}
                        {!selectedIssueRecord.dueDate ? " • missing due date" : ""}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>

              <ActionItemNotesPanel
                noteDraft={noteDraft}
                noteEntries={selectedItem.noteEntries}
                onAddNote={() => addNote(selectedItem)}
                onNoteDraftChange={setNoteDraft}
              />
            </div>
            {isDeleteConfirmOpen ? (
              <div className="drawer__confirm-bar">
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
              </div>
            ) : null}
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

function formatDrawerDueText(item: ActionItem) {
  const dueLabel = formatDueLabel(item);

  if (!item.dueDate) {
    return dueLabel || "No due date set";
  }

  if (!dueLabel || dueLabel === `Due ${formatShortDate(item.dueDate)}`) {
    return `Due ${formatShortDate(item.dueDate)}`;
  }

  if (dueLabel === "No due date set") {
    return dueLabel;
  }

  return `${formatShortDate(item.dueDate)} · ${dueLabel}`;
}

function getDrawerPrimaryBadgeLabel(item: ActionItem) {
  if (isBlockedItem(item)) {
    return "Blocked";
  }

  if (formatDueLabel(item) === "Overdue") {
    return "Overdue";
  }

  if (isWaitingIssue(item)) {
    return "Waiting";
  }

  if (isTerminalStatus(item.status)) {
    return item.status;
  }

  return item.status === "In Progress" ? "Active" : "Normal";
}

function getDrawerPrimaryBadgeClassName(item: ActionItem) {
  if (isBlockedItem(item)) {
    return "drawer__status-chip drawer__status-chip--blocked";
  }

  if (formatDueLabel(item) === "Overdue") {
    return "drawer__status-chip drawer__status-chip--overdue";
  }

  if (isWaitingIssue(item)) {
    return "drawer__status-chip drawer__status-chip--waiting";
  }

  return "drawer__status-chip";
}

function getDrawerSecondaryMeta(item: ActionItem) {
  const parts: string[] = [];
  const dueText = formatDrawerDueText(item);

  if (dueText && dueText !== getDrawerPrimaryBadgeLabel(item)) {
    parts.push(dueText);
  }

  if (item.status === "Waiting" && item.waitingOn.trim()) {
    parts.push(`Waiting on ${item.waitingOn.trim()}`);
  }

  return parts.join(" • ");
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
