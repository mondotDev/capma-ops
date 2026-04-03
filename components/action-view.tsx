"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ActionItemDrawerHeader } from "@/components/action-item-drawer-header";
import { useActionViewReadModel } from "@/components/app-read-models";
import { ActionItemNotesPanel } from "@/components/action-item-notes-panel";
import { useAppActions, useAppStateValues } from "@/components/app-state";
import {
  ACTION_ITEM_MEANING_HINT,
  getActionMeaningUiState,
  shouldClearEventLinkOnWorkstreamChange
} from "@/lib/action/action-item-ux";
import { matchesActionScope } from "@/lib/action-scopes";
import { getActionScopeLabelByValue } from "@/lib/action-scopes";
import type { EventInstance, EventProgram } from "@/lib/event-instances";
import type { ActionItem } from "@/lib/sample-data";
import {
  getCollisionReviewHref,
  getActionDueDateValue,
  getActionEventGroupValue,
  getActionFilterValue,
  getActionFocusValue,
  getActionLensValue,
  getActionQueryValue
} from "@/lib/action-view-utils";
import {
  createActionNoteEntry,
  type ActionFilter,
  type ActionFocus,
  type ActionLens,
  DEFAULT_OWNER,
  daysSince,
  formatDueLabel,
  formatShortDate,
  getContextualDueDateLabel,
  getOwnerOptions,
  isArchivedItem,
  LOCAL_FALLBACK_NOTE_AUTHOR,
  OPERATIONAL_BUCKET_OPTIONS,
  isBlockedItem,
  isPublicationWorkstream,
  type PublicationIssueReadinessSignal,
  isTerminalStatus,
  isWaitingIssue,
  isWaitingMissingReason,
  matchesActionFilter,
  matchesActionFocus,
  matchesActionLens,
  matchesSearchQuery,
  OWNER_OPTIONS,
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
  { label: "Review: Collisions", value: "reviewCollisions" },
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
    archiveItem,
    bulkUpdateItems,
    completeIssue,
    deleteItem,
    generateMissingDeliverablesForIssue,
    importNativeActionItemsFromLocalRecovery,
    openIssue,
    restoreItem,
    setIssueStatus,
    updateItem
  } = useAppActions();
  const { nativeActionItemRecovery, nativeActionItemStoreMode } = useAppStateValues();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [bulkOwner, setBulkOwner] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState("");
  const [nativeItemRecoveryFeedback, setNativeItemRecoveryFeedback] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [publicationFeedback, setPublicationFeedback] = useState("");
  const [itemExitNotice, setItemExitNotice] = useState<ActionExitNotice | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [blockedByDraft, setBlockedByDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const blockedByInputRef = useRef<HTMLInputElement | null>(null);
  const deleteConfirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const activeFilter = getActionFilterValue(initialFilter);
  const activeFocus = getActionFocusValue(initialFocus);
  const activeLens = getActionLensValue(initialLens);
  const activeDueDate = getActionDueDateValue(initialDueDate);
  const activeEventGroup = getActionEventGroupValue(initialEventGroup);
  const activeQuery = getActionQueryValue(initialQuery);
  const activeIssue = initialIssue?.trim() || "";
  const actionListFilters = useMemo(
    () => ({
      activeDueDate,
      activeEventGroup,
      activeFilter,
      activeFocus,
      activeLens,
      activeIssue,
      activeQuery,
      showArchived,
      showCompleted
    }),
    [
      activeDueDate,
      activeEventGroup,
      activeFilter,
      activeFocus,
      activeIssue,
      activeLens,
      activeQuery,
      showArchived,
      showCompleted
    ]
  );
  const {
    actionListView,
    publicationIssueWorkspace,
    selectedWorkspace,
    summaryCounts,
    eventInstances,
    eventPrograms
  } = useActionViewReadModel({
    filters: actionListFilters,
    selectedId
  });
  const eventGroupOptions = actionListView.eventGroupOptions;
  const activeScopeLabel = useMemo(
    () => eventGroupOptions.find((option) => option.value === activeEventGroup)?.label ?? activeEventGroup,
    [activeEventGroup, eventGroupOptions]
  );
  const visibleExecutionCount = actionListView.visibleExecutionCount;
  const totalExecutionCount = actionListView.totalExecutionCount;
  const visibleRows = actionListView.visibleRows;
  const groupedRows = actionListView.groupedRows;
  const visibleSelectableRows = actionListView.visibleSelectableRows;
  const collisionReview = actionListView.collisionReview;
  const reviewLensSummary = actionListView.reviewLensSummary;
  const selectedItem = selectedWorkspace.selectedItem;
  const selectedIssueRecord = selectedWorkspace.selectedIssueRecord;
  const selectedItemIssueOptions = selectedWorkspace.selectedItemIssueOptions;
  const selectedItemSubEvents = selectedWorkspace.selectedItemSubEvents;
  const selectedItemMeaningUi = selectedItem ? getActionMeaningUiState(selectedItem.eventInstanceId) : null;
  const selectedItemAgingHint = selectedItem ? getSelectedItemAgingHint(selectedItem, activeLens) : null;
  const selectedEventInstanceName = useMemo(
    () =>
      selectedItem?.eventInstanceId
        ? eventInstances.find((instance) => instance.id === selectedItem.eventInstanceId)?.name ?? null
        : null,
    [eventInstances, selectedItem?.eventInstanceId]
  );
  const selectedSubEventName = useMemo(
    () =>
      selectedItem?.subEventId
        ? selectedItemSubEvents.find((subEvent) => subEvent.id === selectedItem.subEventId)?.name ?? null
        : null,
    [selectedItem?.subEventId, selectedItemSubEvents]
  );
  const focusLabel = activeFocus !== "all" ? FOCUS_LABELS[activeFocus] : null;
  const selectedVisibleIds = useMemo(
    () => selectedItemIds.filter((id) => visibleSelectableRows.some((row) => row.actionItemId === id)),
    [selectedItemIds, visibleSelectableRows]
  );
  const allVisibleSelected =
    visibleSelectableRows.length > 0 && selectedVisibleIds.length === visibleSelectableRows.length;
  const hasActiveExecutionContext = Boolean(
    activeFilter !== "all" ||
      activeFocus !== "all" ||
      activeLens !== "all" ||
      activeEventGroup !== "all" ||
      activeDueDate ||
      activeIssue ||
      activeQuery ||
      !showCompleted ||
      !showArchived
  );
  const closedVisibilitySummary = useMemo(
    () => ({
      hidesArchived: !showArchived,
      hidesCompleted: !showCompleted
    }),
    [showArchived, showCompleted]
  );
  const contextChips = useMemo(
    () =>
      buildActionContextChips({
        activeDueDate,
        activeFilter,
        activeFocus,
        activeIssue,
        activeLens,
        activeQuery,
        activeScopeLabel,
        hidesArchived: closedVisibilitySummary.hidesArchived,
        hidesCompleted: closedVisibilitySummary.hidesCompleted,
        hasPublicationIssueWorkspace: Boolean(publicationIssueWorkspace),
        hasScopedEventGroup: activeEventGroup !== "all"
      }),
    [
      activeDueDate,
      activeEventGroup,
      activeFilter,
      activeFocus,
      activeIssue,
      activeLens,
      activeQuery,
      activeScopeLabel,
      closedVisibilitySummary.hidesArchived,
      closedVisibilitySummary.hidesCompleted,
      publicationIssueWorkspace
    ]
  );

  useEffect(() => {
    if (selectedId) {
      setItemExitNotice(null);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    if (!visibleSelectableRows.some((row) => row.actionItemId === selectedId)) {
      if (selectedItem) {
        setItemExitNotice(
          getActionItemExitNotice(selectedItem, {
            activeDueDate,
            activeEventGroup,
            activeFilter,
            activeFocus,
            activeIssue,
            activeLens,
            activeQuery,
            eventInstances,
            eventPrograms,
            showArchived,
            showCompleted
          })
        );
      }
      setSelectedId(null);
    }
  }, [
    activeDueDate,
    activeEventGroup,
    activeFilter,
    activeFocus,
    activeIssue,
    activeLens,
    activeQuery,
    eventInstances,
    eventPrograms,
    selectedId,
    selectedItem,
    showArchived,
    showCompleted,
    visibleSelectableRows
  ]);

  useEffect(() => {
    setIsArchiveConfirmOpen(false);
    setIsDeleteConfirmOpen(false);
    setIsActionsMenuOpen(false);
  }, [selectedId]);

  useEffect(() => {
    if (!isDeleteConfirmOpen) {
      return;
    }
    deleteConfirmButtonRef.current?.focus();
  }, [isDeleteConfirmOpen, selectedItem?.id]);

  useEffect(() => {
    setSelectedItemIds((current) => current.filter((id) => visibleSelectableRows.some((row) => row.actionItemId === id)));
  }, [visibleSelectableRows]);

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

  useEffect(() => {
    setPublicationFeedback("");
  }, [activeIssue]);

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

  function handleIssueChange(nextIssue: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (!nextIssue) {
      params.delete("issue");
    } else {
      params.set("issue", nextIssue);
    }

    const query = params.toString();
    router.replace(query ? `/action?${query}` : "/action");
  }

  function clearDueDateFilter() {
    updateQuery(activeFilter, activeFocus, activeLens, activeEventGroup, "", activeQuery);
  }

  function clearCollisionReview() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("lens");
    params.delete("dueDate");
    const query = params.toString();
    router.replace(query ? `/action?${query}` : "/action");
  }

  function clearSearchQuery() {
    updateQuery(activeFilter, activeFocus, activeLens, activeEventGroup, activeDueDate, "");
  }

  function clearAllContext() {
    const params = new URLSearchParams(searchParams.toString());
    ["filter", "focus", "lens", "eventGroup", "dueDate", "issue", "q"].forEach((key) => params.delete(key));
    setShowArchived(false);
    setShowCompleted(false);
    const query = params.toString();
    router.replace(query ? `/action?${query}` : "/action");
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
      allVisibleSelected
        ? current.filter((id) => !visibleSelectableRows.some((row) => row.actionItemId === id))
        : visibleSelectableRows.map((row) => row.actionItemId)
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

  async function handleImportNativeActionItemsRecovery() {
    try {
      const importedCount = await importNativeActionItemsFromLocalRecovery();
      setNativeItemRecoveryFeedback(
        importedCount > 0
          ? `Imported ${importedCount} native action ${importedCount === 1 ? "item" : "items"} into Firestore.`
          : "No local native action items were available to import."
      );
    } catch (error) {
      setNativeItemRecoveryFeedback(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "CAPMA Ops Hub could not import local native action items into Firestore."
      );
    }
  }

  return (
    <section className="action-view">
      <div className="action-controls">
        {nativeActionItemStoreMode === "firebase" && nativeActionItemRecovery.firestoreEmpty ? (
          <div className="card card--secondary action-recovery-card">
            <div className="action-recovery-card__title">NATIVE ACTION ITEMS ARE CURRENTLY EMPTY IN FIRESTORE</div>
            <p className="action-recovery-card__copy">
              Firestore is the active native action-item source, and the `actionItems` collection is currently empty.
            </p>
            {nativeActionItemRecovery.canImportFromLocal ? (
              <>
                <p className="action-recovery-card__copy">
                  CAPMA Ops found {nativeActionItemRecovery.localRecoveryItemCount} native action{" "}
                  {nativeActionItemRecovery.localRecoveryItemCount === 1 ? "item" : "items"} in prior local browser
                  state. Import them into Firestore to restore Action View.
                </p>
                <div className="action-recovery-card__actions">
                  <button
                    className="topbar__button"
                    disabled={nativeActionItemRecovery.isImporting}
                    onClick={() => void handleImportNativeActionItemsRecovery()}
                    type="button"
                  >
                    {nativeActionItemRecovery.isImporting ? "Importing..." : "Import Local Native Items to Firestore"}
                  </button>
                </div>
              </>
            ) : (
              <p className="action-recovery-card__copy">
                CAPMA Ops did not find any recoverable local native action items in browser storage. Action View is
                empty because Firestore is the current source of truth and it has no native action-item documents yet.
              </p>
            )}
            {nativeActionItemRecovery.importError || nativeItemRecoveryFeedback ? (
              <div className="action-recovery-card__feedback">
                {nativeActionItemRecovery.importError ?? nativeItemRecoveryFeedback}
              </div>
            ) : null}
          </div>
        ) : null}
        {publicationIssueWorkspace ? (
          <div className="card card--secondary publication-workspace">
            <div className="publication-workspace__header">
              <div>
                <div className="card__title">PUBLICATION ISSUE WORKSPACE</div>
                <div className="publication-workspace__title">{publicationIssueWorkspace.issue.label}</div>
                <div className="publication-workspace__meta">
                  <span>{publicationIssueWorkspace.workstream}</span>
                  <span>{publicationIssueWorkspace.issue.status}</span>
                  <span>
                    {publicationIssueWorkspace.isMissingDueDate
                      ? "Missing due date"
                      : `Due ${formatShortDate(publicationIssueWorkspace.dueDate)}`}
                  </span>
                  <span>{publicationIssueWorkspace.progressCopy}</span>
                  <span>{publicationIssueWorkspace.remainingCount} open deliverables</span>
                </div>
              </div>
              <button className="button-link button-link--inline-secondary" onClick={clearIssueFilter} type="button">
                Back to all active items
              </button>
            </div>

            <div className="publication-workspace__controls">
              <label className="filter-field publication-workspace__switcher">
                <span className="filter-field__label">Issue</span>
                <select
                  className="cell-select filter-field__select"
                  onChange={(event) => handleIssueChange(event.target.value)}
                  value={publicationIssueWorkspace.issue.label}
                >
                  {publicationIssueWorkspace.visiblePublicationIssues.map((issue) => (
                    <option key={issue.label} value={issue.label}>
                      {issue.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="filter-field publication-workspace__switcher">
                <span className="filter-field__label">Status</span>
                <select
                  className="cell-select filter-field__select"
                  onChange={(event) => {
                    const nextStatus = event.target.value as "Planned" | "Open" | "Complete";
                    const result = setIssueStatus(publicationIssueWorkspace.issue.label, nextStatus);

                    if (nextStatus === "Complete" && !result.completed) {
                      setPublicationFeedback(
                        formatCompletionBlockedFeedback(
                          publicationIssueWorkspace.issue.label,
                          result.blockedDeliverables
                        )
                      );
                      return;
                    }

                    setPublicationFeedback(
                      nextStatus === "Complete"
                        ? `${publicationIssueWorkspace.issue.label} marked complete.`
                        : `${publicationIssueWorkspace.issue.label} marked ${nextStatus.toLowerCase()}.`
                    );
                  }}
                  value={publicationIssueWorkspace.issue.status}
                >
                  <option value="Planned">Planned</option>
                  <option value="Open">Open</option>
                  <option value="Complete">Complete</option>
                </select>
              </label>

              <div className="publication-workspace__actions">
                {publicationIssueWorkspace.canOpenIssue ? (
                  <button
                    className="topbar__button"
                    onClick={() => {
                      const result = openIssue(publicationIssueWorkspace.issue.label);
                      setPublicationFeedback(
                        formatPublicationFeedback(
                          publicationIssueWorkspace.issue.label,
                          result.created,
                          result.skipped
                        )
                      );
                    }}
                    type="button"
                  >
                    Open Issue
                  </button>
                ) : null}
                {publicationIssueWorkspace.canGenerateMissing ? (
                  <button
                    className="button-link button-link--inline-secondary"
                    onClick={() => {
                      const result = generateMissingDeliverablesForIssue(publicationIssueWorkspace.issue.label);
                      setPublicationFeedback(
                        formatGenerateMissingFeedback(
                          publicationIssueWorkspace.issue.label,
                          result.created,
                          result.skipped
                        )
                      );
                    }}
                    type="button"
                  >
                    Generate Missing
                  </button>
                ) : null}
                {publicationIssueWorkspace.issue.status === "Open" ? (
                  <button
                    className={
                      publicationIssueWorkspace.canCompleteIssue
                        ? "button-link button-link--inline-secondary publication-workspace__complete publication-workspace__complete--ready"
                        : "button-link button-link--inline-secondary publication-workspace__complete"
                    }
                    onClick={() => {
                      const result = completeIssue(publicationIssueWorkspace.issue.label);

                      if (!result.completed) {
                        setPublicationFeedback(
                          formatCompletionBlockedFeedback(
                            publicationIssueWorkspace.issue.label,
                            result.blockedDeliverables
                          )
                        );
                        return;
                      }

                      setPublicationFeedback(`${publicationIssueWorkspace.issue.label} marked complete.`);
                    }}
                    type="button"
                  >
                    Complete Issue
                  </button>
                ) : null}
              </div>
            </div>

            <div className="publication-workspace__signals">
              <span className="summary-chip">
                <span className="summary-chip__label">Progress</span>
                <strong className="summary-chip__value">{publicationIssueWorkspace.progressCopy}</strong>
              </span>
              <span className="summary-chip">
                <span className="summary-chip__label">Open Deliverables</span>
                <strong className="summary-chip__value">{publicationIssueWorkspace.remainingCount}</strong>
              </span>
              <span className="summary-chip">
                <span className="summary-chip__label">Visible Issue Rows</span>
                <strong className="summary-chip__value">{actionListView.visibleActionItemCount}</strong>
              </span>
              {publicationIssueWorkspace.isMissingDueDate ? (
                <span className="summary-chip summary-chip--overdue">
                  <span className="summary-chip__label">Due Date</span>
                  <strong className="summary-chip__value">Missing</strong>
                </span>
              ) : null}
            </div>

            <div className="publication-workspace__readiness">
              {publicationIssueWorkspace.readinessSignals.length > 0 ? (
                publicationIssueWorkspace.readinessSignals.map((signal) => (
                  <span
                    className={getPublicationReadinessClassName("workspace", signal)}
                    key={`${publicationIssueWorkspace.issue.label}-${signal.kind}`}
                    title={signal.copy}
                  >
                    {signal.shortLabel}
                  </span>
                ))
              ) : (
                <span className="publication-workspace__readiness-empty">No setup gaps detected for this issue.</span>
              )}
            </div>

            <div className="card__subhead">
              {publicationFeedback ||
                "This workspace shows only items linked to the selected publication issue. Progress and open counts refer to deliverables for this issue."}
            </div>
          </div>
        ) : activeIssue ? (
          <div className="issue-context">
            <div>
              <div className="issue-context__title">{activeIssue}</div>
              <div className="issue-context__meta">
                {actionListView.visibleActionItemCount} {actionListView.visibleActionItemCount === 1 ? "item" : "items"}
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
            <span className="filter-field__label">Scope</span>
            <select
              aria-label="Filter by scope"
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

        <div className="card card--secondary action-context-strip" aria-label="Current action view context">
          <div className="action-context-strip__header">
            <div>
              <div className="card__title">CURRENT VIEW</div>
              <div className="action-context-strip__count">
                Showing {visibleExecutionCount} {visibleExecutionCount === 1 ? "item" : "items"}
                {totalExecutionCount !== visibleExecutionCount ? ` of ${totalExecutionCount}` : ""}
              </div>
              <div className="action-context-strip__meta">
                {getActionContextMetaCopy(activeLens, hasActiveExecutionContext)}
              </div>
            </div>
            {hasActiveExecutionContext ? (
              <button className="button-link button-link--inline-secondary" onClick={clearAllContext} type="button">
                Clear all constraints
              </button>
            ) : null}
          </div>

          {contextChips.length > 0 ? (
            <div className="action-context-strip__chips">
              {contextChips.map((chip) => {
                const clearHandler = getContextChipClearHandler(chip.kind, {
                  clearDueDateFilter,
                  clearFocus,
                  clearIssueFilter,
                  clearSearchQuery,
                  handleEventGroupChange,
                  handleFilterChange,
                  handleLensChange
                });

                return (
                  <span className="action-context-chip" key={`${chip.kind}-${chip.label}`}>
                    <span className="action-context-chip__label">{chip.label}</span>
                    {clearHandler ? (
                      <button
                        aria-label={`Clear ${chip.label}`}
                        className="action-context-chip__clear"
                        onClick={clearHandler}
                        type="button"
                      >
                        Clear
                      </button>
                    ) : null}
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="muted">All active execution work is visible.</div>
          )}
        </div>

        {itemExitNotice ? (
          <div
            aria-live="polite"
            className="card card--secondary action-exit-notice"
          >
            <div className="action-exit-notice__body">
              <div className="action-exit-notice__title">{itemExitNotice.title}</div>
              <div className="action-exit-notice__copy">{itemExitNotice.copy}</div>
            </div>
            <div className="action-exit-notice__actions">
              {itemExitNotice.action && itemExitNotice.actionLabel ? (
                <button
                  className="button-link button-link--inline-secondary"
                  onClick={() => {
                    runActionExitNoticeAction(itemExitNotice.action!, {
                      clearAllContext,
                      clearDueDateFilter,
                      clearFocus,
                      clearIssueFilter,
                      clearSearchQuery,
                      handleEventGroupChange,
                      handleFilterChange,
                      handleLensChange,
                      setShowArchived,
                      setShowCompleted
                    });
                    setItemExitNotice(null);
                  }}
                  type="button"
                >
                  {itemExitNotice.actionLabel}
                </button>
              ) : null}
              <button
                className="button-link button-link--inline"
                onClick={() => setItemExitNotice(null)}
                type="button"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        {collisionReview ? (
          <div className="card card--secondary collision-review">
            <div className="collision-review__header">
              <div>
                <div className="card__title">DEADLINE COLLISION REVIEW</div>
                <div className="collision-review__title">
                  {collisionReview.selectedDate
                    ? `Reviewing ${getCollisionDateLabel(collisionReview.selectedDate.date)}`
                    : `Next ${collisionReview.reviewWindowDays} days`}
                </div>
                <div className="collision-review__meta">
                  {collisionReview.selectedDate
                    ? `${collisionReview.selectedDate.totalCount} ${collisionReview.selectedDate.totalCount === 1 ? "visible item is" : "visible items are"} due on this date. The table below is grouped by due date so you can review the full cluster together.`
                    : `${collisionReview.totalDueSoonRows} due-dated execution items are in the current review window. Dates below count as collisions when more than one visible item lands on the same day.`}
                </div>
              </div>
              {(activeDueDate || activeLens === "reviewCollisions") ? (
                <button className="button-link button-link--inline-secondary" onClick={clearCollisionReview} type="button">
                  {collisionReview.selectedDate ? "Back to collision review" : "Back to all work"}
                </button>
              ) : null}
            </div>
            <div className="collision-review__signals">
              <span className="summary-chip summary-chip--due-soon">
                <span className="summary-chip__label">Dates With Collisions</span>
                <strong className="summary-chip__value">{collisionReview.overloadedDateCount}</strong>
              </span>
              <span className="summary-chip summary-chip--blocked">
                <span className="summary-chip__label">Owners Double-Booked</span>
                <strong className="summary-chip__value">{collisionReview.ownerCollisionCount}</strong>
              </span>
              {collisionReview.selectedDate ? (
                <span className="summary-chip">
                  <span className="summary-chip__label">Selected Date</span>
                  <strong className="summary-chip__value">{collisionReview.selectedDate.totalCount} due</strong>
                </span>
              ) : null}
            </div>
            <div className="collision-review__list">
              {(collisionReview.selectedDate ? [collisionReview.selectedDate] : collisionReview.overloadedDates).length > 0 ? (
                (collisionReview.selectedDate ? [collisionReview.selectedDate] : collisionReview.overloadedDates).map((entry) => (
                  <button
                    className={
                      entry.date === activeDueDate
                        ? "collision-review__date collision-review__date--active"
                        : "collision-review__date"
                    }
                    key={entry.date}
                    onClick={() => router.replace(getCollisionReviewHref(entry.date))}
                    type="button"
                  >
                    <div className="collision-review__date-top">
                      <strong>{getCollisionDateLabel(entry.date)}</strong>
                      <span>{entry.totalCount} due</span>
                    </div>
                    <div className="collision-review__date-meta">
                      {entry.ownerCollisionCount > 0
                        ? `${entry.ownerCollisionCount} ${entry.ownerCollisionCount === 1 ? "owner has" : "owners have"} multiple items due on this date`
                        : "No owner collisions yet"}
                    </div>
                    <div className="collision-review__owners">
                      {entry.owners.slice(0, 3).map((owner) => (
                        <span className="collision-review__owner-pill" key={`${entry.date}-${owner.owner}`}>
                          {owner.owner} · {owner.count}
                        </span>
                      ))}
                    </div>
                  </button>
                ))
              ) : (
                <div className="muted">
                  No due-date clusters in the current view. Visible work is either spread across dates or lands one item per day.
                </div>
              )}
            </div>
          </div>
        ) : null}

        {reviewLensSummary ? (
          <div className="card card--secondary review-lens-card">
            <div className="review-lens-card__header">
              <div>
                <div className="card__title">{reviewLensSummary.title}</div>
                <div className="review-lens-card__title">
                  {reviewLensSummary.kind === "waitingTooLong"
                    ? `Waiting items untouched for ${reviewLensSummary.thresholdDays}+ days`
                    : `Open items untouched for ${reviewLensSummary.thresholdDays}+ days`}
                </div>
                <div className="review-lens-card__meta">
                  {reviewLensSummary.description} {reviewLensSummary.totalCount}{" "}
                  {reviewLensSummary.totalCount === 1 ? "item matches" : "items match"} in the current view.
                </div>
              </div>
              <button
                className="button-link button-link--inline-secondary"
                onClick={() => handleLensChange("all")}
                type="button"
              >
                Back to all work
              </button>
            </div>
            <div className="review-lens-card__signals">
              <span className="summary-chip">
                <span className="summary-chip__label">Aged Items</span>
                <strong className="summary-chip__value">{reviewLensSummary.totalCount}</strong>
              </span>
              <span className="summary-chip summary-chip--blocked">
                <span className="summary-chip__label">Still Blocked</span>
                <strong className="summary-chip__value">{reviewLensSummary.blockedCount}</strong>
              </span>
              <span className="summary-chip summary-chip--overdue">
                <span className="summary-chip__label">Already Overdue</span>
                <strong className="summary-chip__value">{reviewLensSummary.overdueCount}</strong>
              </span>
            </div>
          </div>
        ) : null}

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
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
                type="checkbox"
              />
              <span>Show Archived</span>
            </label>
            <label className="toggle">
              <input
                checked={showCompleted}
                onChange={(event) => setShowCompleted(event.target.checked)}
                type="checkbox"
              />
              <span>Show Closed</span>
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
                Scope: {activeScopeLabel}.{" "}
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
              aria-label="Close action drawer"
              className="drawer-backdrop"
              onClick={() => setSelectedId(null)}
              type="button"
            />
          ) : null}

          <div className="table-wrap">
            <div className="table-scroll">
              <table>
                <thead className="table-head">
                  <tr>
                    <th className="table-head__select">
                      <input
                        aria-label="Select all visible items"
                        checked={allVisibleSelected}
                        disabled={visibleSelectableRows.length === 0}
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
                {groupedRows.map((group) => {
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
                            <strong>{activeLens === "reviewCollisions" ? getCollisionDateLabel(group.label) : group.label}</strong>
                            {activeLens === "reviewCollisions" ? (
                              <span className="group-header-button__context">Due date group</span>
                            ) : null}
                            <span>{group.items.length} {group.items.length === 1 ? "item" : "items"}</span>
                          </button>
                        </td>
                      </tr>
                      {!isCollapsed
                        ? group.items.map((row) =>
                            row.kind === "action" ? (
                              <tr
                                className={row.rowClassName}
                                data-clickable="true"
                                key={row.id}
                                onClick={() => setSelectedId(row.actionItemId)}
                              >
                                <td onClick={(event) => event.stopPropagation()}>
                                  <input
                                    aria-label={`Select ${row.title}`}
                                    checked={selectedItemIds.includes(row.actionItemId)}
                                    onChange={() => toggleItemSelection(row.actionItemId)}
                                    type="checkbox"
                                  />
                                </td>
                                <td className="cell-primary">
                                  <div
                                    className={[
                                      row.isTerminal ? "cell-title cell-title--cut" : "cell-title",
                                      !row.isTerminal && row.isOverdue ? "cell-title--overdue" : "",
                                      !row.isTerminal && row.statusLabel === "Waiting" && daysSince(row.lastUpdated) >= 7
                                        ? "cell-title--waiting-aged"
                                        : ""
                                    ]
                                      .filter(Boolean)
                                      .join(" ")}
                                  >
                                    {row.title}
                                    {getPublicationRowBadgeLabel(row) ? (
                                      <span className="publication-origin-badge">{getPublicationRowBadgeLabel(row)}</span>
                                    ) : null}
                                  </div>
                                  {getPublicationIssueRowLabel(row) ? (
                                    <div className="cell-subtext cell-subtext--publication">
                                      {getPublicationIssueRowLabel(row)}
                                    </div>
                                  ) : null}
                                  {row.blockedBy?.trim() ? (
                                    <div className="cell-subtext cell-subtext--blocked">Blocked by: {row.blockedBy.trim()}</div>
                                  ) : null}
                                  {row.subEventLabel ? <div className="cell-subtext">{row.subEventLabel}</div> : null}
                                  {!getPublicationIssueRowLabel(row) && row.issueLabel ? (
                                    <div className="cell-subtext">{row.issueLabel}</div>
                                  ) : null}
                                </td>
                                <td className="cell-due-date">
                                  <div>{formatShortDate(row.dueDate)}</div>
                                  {!row.isTerminal && row.dueLabel ? <div className="cell-hint">{row.dueLabel}</div> : null}
                                </td>
                                <td className="cell-status" onClick={(event) => event.stopPropagation()}>
                                  <select
                                    aria-label={`Status for ${row.title}`}
                                    className="cell-select"
                                    onChange={(event) => updateItem(row.actionItemId, { status: event.target.value })}
                                    value={row.statusLabel}
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
                                    aria-label={`Waiting on for ${row.title}`}
                                    className={
                                      isWaitingMissingReason(
                                        { status: row.statusLabel, waitingOn: row.waitingLabel } as ActionItem
                                      )
                                        ? "cell-select cell-select--required"
                                        : row.statusLabel !== "Waiting"
                                          ? "cell-select cell-select--muted"
                                          : "cell-select"
                                    }
                                    onChange={(event) => updateItem(row.actionItemId, { waitingOn: event.target.value })}
                                    value={row.waitingLabel}
                                  >
                                    <option value="">
                                      {isWaitingMissingReason(
                                        { status: row.statusLabel, waitingOn: row.waitingLabel } as ActionItem
                                      )
                                        ? "Required"
                                        : "None"}
                                    </option>
                                    {WAITING_ON_SUGGESTIONS.map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="cell-owner" onClick={(event) => event.stopPropagation()}>
                                  <select
                                    aria-label={`Owner for ${row.title}`}
                                    className="cell-select"
                                    onChange={(event) => updateItem(row.actionItemId, { owner: event.target.value })}
                                    value={row.owner}
                                  >
                                    {getOwnerOptions(row.owner).map((option) => (
                                      <option key={option} value={option}>
                                        {option}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="cell-muted cell-workstream">{row.workstreamLabel}</td>
                                <td className="cell-muted cell-type">{row.typeLabel}</td>
                                <td className="cell-muted cell-updated">
                                  <div className="cell-updated__date">{formatShortDate(row.lastUpdated)}</div>
                                  <div className="cell-updated__age">{getLastUpdatedAgeLabel(row.lastUpdated)}</div>
                                </td>
                              </tr>
                            ) : (
                              <tr className={row.rowClassName} key={row.id}>
                                <td />
                                <td className="cell-primary">
                                  <button
                                    className="collateral-execution-row__open"
                                    onClick={() => openCollateralExecutionItem(row.eventInstanceId, row.collateralId)}
                                    type="button"
                                  >
                                    <div className="cell-title">
                                      {row.title}
                                      <span className="collateral-origin-badge">{row.badgeLabel}</span>
                                    </div>
                                    <div className="cell-subtext">{row.eventInstanceName}</div>
                                    {row.blockedBy?.trim() ? (
                                      <div className="cell-subtext cell-subtext--blocked">Blocked by: {row.blockedBy.trim()}</div>
                                    ) : row.printer ? (
                                      <div className="cell-subtext">Printer: {row.printer}</div>
                                    ) : null}
                                  </button>
                                </td>
                                <td className="cell-due-date">
                                  <div>{formatShortDate(row.dueDate)}</div>
                                  {row.dueLabel ? <div className="cell-hint">{row.dueLabel}</div> : null}
                                </td>
                                <td className="cell-status">
                                  <span className="cell-status__text">{row.statusLabel}</span>
                                </td>
                                <td className="cell-muted cell-waiting">
                                  {row.blockedBy?.trim() ? `Blocked: ${row.blockedBy.trim()}` : row.printer || "—"}
                                </td>
                                <td className="cell-muted cell-owner">{row.owner || "Unassigned"}</td>
                                <td className="cell-muted cell-workstream">{row.subEventName}</td>
                                <td className="cell-muted cell-type">{row.typeLabel}</td>
                                <td className="cell-muted cell-updated">
                                  <div className="cell-updated__date">{formatShortDate(row.lastUpdated)}</div>
                                  <div className="cell-updated__age">{getLastUpdatedAgeLabel(row.lastUpdated)}</div>
                                </td>
                              </tr>
                            )
                          )
                        : null}
                    </tbody>
                  );
                })}
              </table>

              {visibleRows.length === 0 ? (
                <div className="empty-state empty-state--actionable">
                  <div className="empty-state__title">No items match this view.</div>
                  <div className="empty-state__copy">
                    {getActionEmptyStateCopy(contextChips, activeLens, publicationIssueWorkspace
                      ? {
                          canGenerateMissing: publicationIssueWorkspace.canGenerateMissing,
                          canOpenIssue: publicationIssueWorkspace.canOpenIssue,
                          issueLabel: publicationIssueWorkspace.issue.label
                        }
                      : null)}
                  </div>
                  {hasActiveExecutionContext ? (
                    <div className="empty-state__actions">
                      <button className="topbar__button" onClick={clearAllContext} type="button">
                        Clear all constraints
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {selectedItem ? (
          <aside
            className={isBlockedItem(selectedItem) ? "drawer drawer--action drawer--blocked" : "drawer drawer--action"}
            aria-label="Action item workspace"
          >
            <ActionItemDrawerHeader
              eventInstanceName={selectedEventInstanceName}
              isActionsMenuOpen={isActionsMenuOpen}
              isEditingTitle={isEditingTitle}
              item={selectedItem}
              onArchiveRequest={() => {
                setIsArchiveConfirmOpen(true);
                setIsDeleteConfirmOpen(false);
                setIsActionsMenuOpen(false);
              }}
              onDeleteRequest={() => {
                setIsDeleteConfirmOpen(true);
                setIsArchiveConfirmOpen(false);
                setIsActionsMenuOpen(false);
              }}
              onCancelTitleEdit={() => cancelTitleEdit(selectedItem)}
              onClose={() => setSelectedId(null)}
              onFinishTitleEdit={() => finishTitleEdit(selectedItem)}
              onStartTitleEdit={() => setIsEditingTitle(true)}
              onTitleDraftChange={setTitleDraft}
              onToggleActionsMenu={() => setIsActionsMenuOpen((current) => !current)}
              subEventName={selectedSubEventName}
              titleDraft={titleDraft}
            />
            <div className="drawer__sections">
              <section className="drawer-section drawer-section--form action-drawer">
                <div className="action-drawer__group">
                  <div className="drawer__panel-heading">
                    <div className="drawer__panel-title">Execution</div>
                    <div className="drawer__panel-copy">Status, timing, follow-up, and blockers for moving the item forward.</div>
                  </div>
                  <div className="drawer__grid action-drawer__group-grid action-drawer__group-grid--execution">
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
                  <div className="field field--wide action-drawer__last-updated-field">
                    <label>Last Updated in CAPMA Ops</label>
                    <div className="field-static action-drawer__last-updated-value">
                      {getLastUpdatedSummary(selectedItem.lastUpdated)}
                    </div>
                    <div className="field-hint">
                      Based on the last in-app edit to this item, not external progress happening elsewhere.
                    </div>
                    {selectedItemAgingHint ? (
                      <div className="field-hint action-drawer__aging-hint">{selectedItemAgingHint}</div>
                    ) : null}
                  </div>
                  <div
                    className={`field action-drawer__blocked-control action-drawer__blocked-toggle-field${selectedItem.isBlocked ? " action-drawer__blocked-toggle-field--active" : ""}`}
                  >
                    <div className="drawer__blocked-stack">
                      <label className="toggle drawer__blocked-toggle" htmlFor="drawer-blocked">
                        <input
                          checked={selectedItem.isBlocked ?? false}
                          id="drawer-blocked"
                          onChange={(event) => {
                            const nextChecked = event.target.checked;
                            updateItem(selectedItem.id, { isBlocked: nextChecked });

                            if (nextChecked) {
                              requestAnimationFrame(() => {
                                blockedByInputRef.current?.focus();
                                blockedByInputRef.current?.select();
                              });
                            }
                          }}
                          type="checkbox"
                        />
                        <span>Blocked</span>
                      </label>
                    </div>
                  </div>
                  {selectedItem.isBlocked ? (
                    <div className="field field--wide action-drawer__blocked-field">
                      <label htmlFor="drawer-blocked-by">Blocked By</label>
                      <input
                        id="drawer-blocked-by"
                        ref={blockedByInputRef}
                        onBlur={() => commitBlockedByDraft(selectedItem, blockedByDraft)}
                        onChange={(event) => setBlockedByDraft(event.target.value)}
                        placeholder="Short reason the work cannot move, like logo approval or internal decision"
                        value={blockedByDraft}
                      />
                      <div className="field-hint">Use a short blocker reason. Shared categories will stay standardized; custom reasons are preserved.</div>
                    </div>
                  ) : null}
                  </div>
                </div>
                <div className="action-drawer__group">
                  <div className="drawer__panel-heading">
                    <div className="drawer__panel-title">Scope & Routing</div>
                    <div className="drawer__panel-copy">Where this work lives, what it is linked to, and how it should be interpreted.</div>
                  </div>
                  <div className="drawer__grid action-drawer__group-grid action-drawer__group-grid--context">
                    <div className="field field--secondary">
                      <label htmlFor="drawer-workstream">Workstream</label>
                      <select
                        id="drawer-workstream"
                        onChange={(event) => {
                          const nextWorkstream = event.target.value;
                          const nextItem = syncActionItemWorkstream(selectedItem, nextWorkstream);
                          const shouldClearEventLink = shouldClearEventLinkOnWorkstreamChange({
                            eventInstanceId: selectedItem.eventInstanceId,
                            nextWorkstream,
                            eventInstances,
                            eventPrograms
                          });

                          updateItem(selectedItem.id, {
                            workstream: nextItem.workstream,
                            operationalBucket: nextItem.operationalBucket || undefined,
                            issue: nextItem.issue,
                            eventInstanceId: shouldClearEventLink ? undefined : selectedItem.eventInstanceId,
                            subEventId: shouldClearEventLink ? undefined : selectedItem.subEventId
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
                      <label htmlFor="drawer-event-instance">Event Instance</label>
                      <select
                        id="drawer-event-instance"
                        onChange={(event) =>
                          updateItem(selectedItem.id, {
                            eventInstanceId: event.target.value || undefined,
                            subEventId: undefined,
                            operationalBucket: undefined,
                            legacyEventGroupMigrated: true
                          })
                        }
                        value={selectedItem.eventInstanceId ?? ""}
                      >
                        <option value="">None</option>
                        {eventInstances.map((instance) => (
                          <option key={instance.id} value={instance.id}>
                            {instance.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field field--secondary">
                    <label htmlFor="drawer-sub-event">Sub-Event</label>
                    <select
                      disabled={selectedItemMeaningUi?.subEventDisabled}
                      id="drawer-sub-event"
                      onChange={(event) =>
                        updateItem(selectedItem.id, {
                          subEventId: event.target.value || undefined
                        })
                      }
                      value={selectedItem.subEventId ?? ""}
                    >
                      <option value="">None</option>
                      {selectedItemSubEvents.map((subEvent) => (
                        <option key={subEvent.id} value={subEvent.id}>
                          {subEvent.name}
                        </option>
                      ))}
                    </select>
                  </div>
                    <div className="field field--secondary">
                    <label htmlFor="drawer-operational-bucket">Operational Bucket</label>
                    <select
                      disabled={selectedItemMeaningUi?.operationalBucketDisabled}
                      id="drawer-operational-bucket"
                      onChange={(event) =>
                        updateItem(selectedItem.id, {
                          operationalBucket: event.target.value || undefined
                        })
                      }
                      value={selectedItem.operationalBucket ?? ""}
                    >
                      <option value="">None</option>
                      {OPERATIONAL_BUCKET_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <div className="field-hint">
                      {selectedItemMeaningUi?.operationalBucketHint}
                    </div>
                  </div>
                  <div className="field field--wide">
                    <div className="field-hint">{ACTION_ITEM_MEANING_HINT}</div>
                  </div>
                  {selectedItemIssueOptions.length > 0 || selectedItem.issue ? (
                    <div className="field field--wide action-drawer__issue-field">
                      <label htmlFor="drawer-issue">Issue</label>
                      <select
                        id="drawer-issue"
                        onChange={(event) => {
                          const nextItem = syncActionItemIssue(selectedItem, event.target.value);

                          updateItem(selectedItem.id, {
                            issue: nextItem.issue || undefined,
                            workstream: nextItem.workstream,
                            operationalBucket: nextItem.operationalBucket || undefined,
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
                    <div className="field field--wide action-drawer__issue-status">
                      <label>Issue Status</label>
                      <div className="field-static">
                        {selectedIssueRecord.status}
                        {!selectedIssueRecord?.dueDate ? " — missing due date" : ""}
                      </div>
                    </div>
                  ) : null}
                  <div className="field field--secondary action-drawer__type-field">
                    <label htmlFor="drawer-type">Type</label>
                    <input
                      id="drawer-type"
                      onChange={(event) => updateItem(selectedItem.id, { type: event.target.value })}
                      value={selectedItem.type}
                    />
                    <div className="field-hint">Use a concise work type so the item reads clearly in the execution lane.</div>
                  </div>
                  </div>
                </div>
              </section>

              <ActionItemNotesPanel
                noteDraft={noteDraft}
                noteEntries={selectedItem.noteEntries}
                onAddNote={() => addNote(selectedItem)}
                onNoteDraftChange={setNoteDraft}
                subtitle="Capture operational decisions, follow-ups, and unblock updates in one place."
                title="Operational Notes"
              />
            </div>
            {isArchiveConfirmOpen ? (
              <div className="drawer__confirm-bar">
                <div className="confirm-delete">
                  <div className="confirm-delete__title">
                    {selectedItem.archivedAt ? "Restore this item to the active lane?" : "Archive this item?"}
                  </div>
                  <div className="confirm-delete__copy">
                    {selectedItem.archivedAt
                      ? "This will make the item visible in active execution views again."
                      : "This keeps the item recoverable but removes it from active execution views by default."}
                  </div>
                  <div className="confirm-delete__actions">
                    <button
                      className="button-link button-link--inline-secondary"
                      onClick={() => setIsArchiveConfirmOpen(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className={selectedItem.archivedAt ? "topbar__button" : "button-danger"}
                      onClick={() => {
                        if (selectedItem.archivedAt) {
                          restoreItem(selectedItem.id);
                        } else {
                          if (!showArchived) {
                            setItemExitNotice(getActionItemExitNotice(selectedItem, {
                              activeDueDate,
                              activeEventGroup,
                              activeFilter,
                              activeFocus,
                              activeIssue,
                              activeLens,
                              activeQuery,
                              eventInstances,
                              eventPrograms,
                              showArchived,
                              showCompleted
                            }));
                          }
                          archiveItem(selectedItem.id);
                        }
                        setSelectedId(null);
                        setIsArchiveConfirmOpen(false);
                      }}
                      type="button"
                    >
                      {selectedItem.archivedAt ? "Restore" : "Archive"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {isDeleteConfirmOpen ? (
              <div className="drawer__confirm-bar">
                <div className="confirm-delete">
                  <div className="confirm-delete__title">Delete this action item?</div>
                  <div className="confirm-delete__copy">
                    This permanently removes the item. Use archive instead if you want it hidden but recoverable.
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
                      ref={deleteConfirmButtonRef}
                      onClick={() => {
                        deleteItem(selectedItem.id);
                        setSelectedId(null);
                        setIsDeleteConfirmOpen(false);
                      }}
                      type="button"
                    >
                      Delete permanently
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

type ActionContextChip = {
  kind:
    | "filter"
    | "focus"
    | "lens"
    | "scope"
    | "dueDate"
    | "issue"
    | "search"
    | "workspace"
    | "completed"
    | "archived";
  label: string;
};

type ActionExitNoticeAction =
  | "showArchived"
  | "showCompleted"
  | "clearIssue"
  | "clearDueDate"
  | "clearScope"
  | "clearFilter"
  | "clearLens"
  | "clearFocus"
  | "clearSearch"
  | "clearAll";

type ActionExitNotice = {
  title: string;
  copy: string;
  action?: ActionExitNoticeAction;
  actionLabel?: string;
};

function buildActionContextChips(input: {
  activeDueDate: string;
  activeFilter: ActionFilter;
  activeFocus: ActionFocus;
  activeIssue: string;
  activeLens: ActionLens;
  activeQuery: string;
  activeScopeLabel: string;
  hidesArchived: boolean;
  hidesCompleted: boolean;
  hasPublicationIssueWorkspace: boolean;
  hasScopedEventGroup: boolean;
}): ActionContextChip[] {
  const chips: ActionContextChip[] = [];

  if (input.hidesCompleted) {
    chips.push({ kind: "completed", label: "Closed hidden" });
  }

  if (input.hidesArchived) {
    chips.push({ kind: "archived", label: "Archived hidden" });
  }

  if (input.hasPublicationIssueWorkspace) {
    chips.push({ kind: "workspace", label: "Publication workspace" });
  }

  if (input.activeIssue) {
    chips.push({ kind: "issue", label: `Issue: ${input.activeIssue}` });
  }

  if (input.activeLens !== "all") {
    chips.push({ kind: "lens", label: `Lens: ${getLensLabel(input.activeLens)}` });
  }

  if (input.activeFilter !== "all") {
    chips.push({ kind: "filter", label: `Filter: ${getFilterLabel(input.activeFilter)}` });
  }

  if (input.activeFocus !== "all") {
    chips.push({ kind: "focus", label: `Focus: ${FOCUS_LABELS[input.activeFocus]}` });
  }

  if (input.hasScopedEventGroup) {
    chips.push({ kind: "scope", label: `Scope: ${input.activeScopeLabel}` });
  }

  if (input.activeDueDate) {
    chips.push({ kind: "dueDate", label: `Due: ${formatShortDate(input.activeDueDate)}` });
  }

  if (input.activeQuery) {
    chips.push({ kind: "search", label: `Search: ${input.activeQuery}` });
  }

  return chips;
}

function getContextChipClearHandler(
  kind: ActionContextChip["kind"],
  handlers: {
    clearDueDateFilter: () => void;
    clearFocus: () => void;
    clearIssueFilter: () => void;
    clearSearchQuery: () => void;
    handleEventGroupChange: (nextEventGroup: string) => void;
    handleFilterChange: (nextFilter: ActionFilter) => void;
    handleLensChange: (nextLens: ActionLens) => void;
  }
) {
  if (kind === "filter") {
    return () => handlers.handleFilterChange("all");
  }

  if (kind === "focus") {
    return handlers.clearFocus;
  }

  if (kind === "lens") {
    return () => handlers.handleLensChange("all");
  }

  if (kind === "scope") {
    return () => handlers.handleEventGroupChange("all");
  }

  if (kind === "dueDate") {
    return handlers.clearDueDateFilter;
  }

  if (kind === "issue") {
    return handlers.clearIssueFilter;
  }

  if (kind === "search") {
    return handlers.clearSearchQuery;
  }

  if (kind === "completed" || kind === "archived" || kind === "workspace") {
    return null;
  }

  return null;
}

function getActionEmptyStateCopy(
  chips: ActionContextChip[],
  activeLens: ActionLens,
  publicationIssueWorkspace?: {
    canGenerateMissing: boolean;
    canOpenIssue: boolean;
    issueLabel: string;
  } | null
) {
  if (chips.length === 0) {
    return "There are no visible execution items yet. Add work or broaden the current review window.";
  }

  const contextPreview = chips
    .map((chip) => chip.label)
    .join(" • ");

  if (activeLens === "reviewWaitingTooLong") {
    return `No waiting items in the current view have gone 7+ days without an update. Current context: ${contextPreview}.`;
  }

  if (activeLens === "reviewStale") {
    return `No non-waiting active items in the current view have gone 14+ days without an update. Current context: ${contextPreview}.`;
  }

  if (publicationIssueWorkspace) {
    if (publicationIssueWorkspace.canOpenIssue) {
      return `${publicationIssueWorkspace.issueLabel} is still planned. Open the issue to generate its deliverables, or clear one or more constraints if you expected linked rows here. Current context: ${contextPreview}.`;
    }

    if (publicationIssueWorkspace.canGenerateMissing) {
      return `No rows are currently visible for ${publicationIssueWorkspace.issueLabel}. This workspace only shows items linked to the selected issue. Generate missing deliverables or clear one or more constraints to broaden the lane. Current context: ${contextPreview}.`;
    }

    return `No rows are currently visible for ${publicationIssueWorkspace.issueLabel}. This workspace only shows items linked to the selected issue. Completed, archived, or filtered rows may be hidden. Current context: ${contextPreview}.`;
  }

  return `No execution items match the current view: ${contextPreview}. Clear one or more constraints to broaden the lane.`;
}

function getActionItemExitNotice(
  item: ActionItem,
  input: {
    activeDueDate: string;
    activeEventGroup: string;
    activeFilter: ActionFilter;
    activeFocus: ActionFocus;
    activeIssue: string;
    activeLens: ActionLens;
    activeQuery: string;
    eventInstances: EventInstance[];
    eventPrograms: EventProgram[];
    showArchived: boolean;
    showCompleted: boolean;
  }
): ActionExitNotice {
  const itemLabel = `"${item.title}"`;

  if (!input.showArchived && isArchivedItem(item)) {
    return {
      title: `${itemLabel} left the current lane`,
      copy: "It was archived, and archived items are hidden from active execution views by default.",
      action: "showArchived",
      actionLabel: "Show archived"
    };
  }

  if (!input.showCompleted && isTerminalStatus(item.status)) {
    return {
      title: `${itemLabel} left the current lane`,
      copy: `It is now marked ${item.status.toLowerCase()}, and closed work is hidden from active execution views by default.`,
      action: "showCompleted",
      actionLabel: "Show closed"
    };
  }

  if (input.activeIssue && item.issue !== input.activeIssue) {
    return {
      title: `${itemLabel} no longer matches this issue workspace`,
      copy: `This workspace only shows rows linked to ${input.activeIssue}.`,
      action: "clearIssue",
      actionLabel: "Clear issue filter"
    };
  }

  if (input.activeDueDate && item.dueDate !== input.activeDueDate) {
    return {
      title: `${itemLabel} no longer matches this due-date view`,
      copy: `The current lane is narrowed to rows due on ${formatShortDate(input.activeDueDate)}.`,
      action: "clearDueDate",
      actionLabel: "Clear due date"
    };
  }

  if (
    input.activeEventGroup !== "all" &&
    !matchesActionScope(item, input.activeEventGroup, input.eventPrograms, input.eventInstances)
  ) {
    return {
      title: `${itemLabel} moved out of the current scope`,
      copy: "The item no longer matches the current execution scope.",
      action: "clearScope",
      actionLabel: "Clear scope"
    };
  }

  if (input.activeFilter !== "all" && !matchesActionFilter(item, input.activeFilter)) {
    return {
      title: `${itemLabel} no longer matches ${getFilterLabel(input.activeFilter).toLowerCase()}`,
      copy: "The current status filter is hiding it from this lane.",
      action: "clearFilter",
      actionLabel: "Clear filter"
    };
  }

  if (input.activeFocus !== "all" && !matchesActionFocus(item, input.activeFocus)) {
    return {
      title: `${itemLabel} moved out of the current focus`,
      copy: `This lane is focused on ${FOCUS_LABELS[input.activeFocus].toLowerCase()}.`,
      action: "clearFocus",
      actionLabel: "Clear focus"
    };
  }

  if (input.activeLens !== "all" && !matchesActionLens(item, input.activeLens)) {
    return {
      title: `${itemLabel} no longer matches ${getLensLabel(input.activeLens)}`,
      copy: "The current review lens is now filtering it out of the visible lane.",
      action: "clearLens",
      actionLabel: "Return to all work"
    };
  }

  if (input.activeQuery && !matchesSearchQuery(item, input.activeQuery)) {
    return {
      title: `${itemLabel} no longer matches the current search`,
      copy: `The lane is still narrowed by “${input.activeQuery}”.`,
      action: "clearSearch",
      actionLabel: "Clear search"
    };
  }

  return {
    title: `${itemLabel} left the current lane`,
    copy: "One or more current constraints are hiding it from this view.",
    action: "clearAll",
    actionLabel: "Return to all work"
  };
}

function runActionExitNoticeAction(
  action: ActionExitNoticeAction,
  handlers: {
    clearAllContext: () => void;
    clearDueDateFilter: () => void;
    clearFocus: () => void;
    clearIssueFilter: () => void;
    clearSearchQuery: () => void;
    handleEventGroupChange: (nextEventGroup: string) => void;
    handleFilterChange: (nextFilter: ActionFilter) => void;
    handleLensChange: (nextLens: ActionLens) => void;
    setShowArchived: (value: boolean) => void;
    setShowCompleted: (value: boolean) => void;
  }
) {
  if (action === "showArchived") {
    handlers.setShowArchived(true);
    return;
  }

  if (action === "showCompleted") {
    handlers.setShowCompleted(true);
    return;
  }

  if (action === "clearIssue") {
    handlers.clearIssueFilter();
    return;
  }

  if (action === "clearDueDate") {
    handlers.clearDueDateFilter();
    return;
  }

  if (action === "clearScope") {
    handlers.handleEventGroupChange("all");
    return;
  }

  if (action === "clearFilter") {
    handlers.handleFilterChange("all");
    return;
  }

  if (action === "clearLens") {
    handlers.handleLensChange("all");
    return;
  }

  if (action === "clearFocus") {
    handlers.clearFocus();
    return;
  }

  if (action === "clearSearch") {
    handlers.clearSearchQuery();
    return;
  }

  handlers.clearAllContext();
}

function getLensLabel(lens: ActionLens) {
  return LENS_OPTIONS.find((option) => option.value === lens)?.label ?? "All Work";
}

function getCollisionDateLabel(dateValue: string) {
  if (!dateValue) {
    return "No Due Date";
  }

  const targetDate = new Date(`${dateValue}T12:00:00`);

  if (Number.isNaN(targetDate.getTime())) {
    return formatShortDate(dateValue);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetStart = new Date(targetDate);
  targetStart.setHours(0, 0, 0, 0);
  const dayDelta = Math.round((targetStart.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (dayDelta < 0) {
    return `Overdue · ${formatShortDate(dateValue)}`;
  }

  if (dayDelta === 0) {
    return `Today · ${formatShortDate(dateValue)}`;
  }

  if (dayDelta === 1) {
    return `Tomorrow · ${formatShortDate(dateValue)}`;
  }

  if (dayDelta <= 7) {
    return `This Week · ${formatShortDate(dateValue)}`;
  }

  return formatShortDate(dateValue);
}

function getActionContextMetaCopy(activeLens: ActionLens, hasActiveExecutionContext: boolean) {
  if (activeLens === "reviewWaitingTooLong") {
    return "Reviewing waiting items with no update in 7+ days.";
  }

  if (activeLens === "reviewStale") {
    return "Reviewing open non-waiting items with no update in 14+ days.";
  }

  if (hasActiveExecutionContext) {
    return "Rows are narrowed by the active execution context below.";
  }

  return "No extra constraints are hiding rows right now.";
}

function getPublicationRowBadgeLabel(row: {
  kind: "action" | "collateral";
  issueLabel?: string;
  workstreamLabel?: string;
}) {
  if (row.kind !== "action" || !row.issueLabel || !row.workstreamLabel) {
    return "";
  }

  return isPublicationWorkstream(row.workstreamLabel) ? row.workstreamLabel : "";
}

function getPublicationIssueRowLabel(row: {
  kind: "action" | "collateral";
  issueLabel?: string;
  workstreamLabel?: string;
}) {
  if (!getPublicationRowBadgeLabel(row) || !row.issueLabel) {
    return "";
  }

  return `Issue: ${row.issueLabel}`;
}

function getPublicationReadinessClassName(
  surface: "workspace" | "row",
  signal: PublicationIssueReadinessSignal
) {
  const prefix = surface === "workspace" ? "publication-workspace__readiness-pill" : "publication-row__readiness-pill";

  if (signal.tone === "warning") {
    return `${prefix} ${prefix}--warning`;
  }

  if (signal.tone === "positive") {
    return `${prefix} ${prefix}--positive`;
  }

  return `${prefix} ${prefix}--attention`;
}

function getLastUpdatedAgeLabel(lastUpdated: string) {
  if (!lastUpdated) {
    return "Unknown";
  }

  const ageInDays = daysSince(lastUpdated);

  if (ageInDays <= 0) {
    return "Updated today";
  }

  if (ageInDays === 1) {
    return "1d ago";
  }

  return `${ageInDays}d ago`;
}

function getLastUpdatedSummary(lastUpdated: string) {
  if (!lastUpdated) {
    return "Unknown";
  }

  const ageInDays = daysSince(lastUpdated);

  if (ageInDays <= 0) {
    return `${formatShortDate(lastUpdated)} - updated today`;
  }

  if (ageInDays === 1) {
    return `${formatShortDate(lastUpdated)} - updated 1 day ago`;
  }

  return `${formatShortDate(lastUpdated)} - updated ${ageInDays} days ago`;
}

function getSelectedItemAgingHint(item: ActionItem, activeLens: ActionLens) {
  const ageInDays = daysSince(item.lastUpdated);

  if (item.status === "Waiting" && ageInDays >= 7) {
    if (activeLens === "reviewWaitingTooLong") {
      return `This item appears in Waiting Too Long because it has been waiting without an in-app update for ${ageInDays} days.`;
    }

    return `This waiting item has not been updated in CAPMA Ops for ${ageInDays} days.`;
  }

  if (!isTerminalStatus(item.status) && item.status !== "Waiting" && ageInDays >= 14) {
    if (activeLens === "reviewStale") {
      return `This item appears in Stale because it has no in-app update for ${ageInDays} days.`;
    }

    return `This active item has no in-app update for ${ageInDays} days.`;
  }

  return null;
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


