"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ActionItemNotesPanel } from "@/components/action-item-notes-panel";
import { useCollateralWorkspaceReadModel } from "@/components/app-read-models";
import { type CollateralProfileDeadlineFilter } from "@/components/collateral-profile-card";
import { type CollateralSummaryFilter } from "@/components/collateral-summary-strip";
import { useAppActions, useAppStateValues } from "@/components/app-state";
import {
  COLLATERAL_STATUS_OPTIONS,
  COLLATERAL_PRINTER_OPTIONS,
  COLLATERAL_UPDATE_TYPE_OPTIONS,
  isCollateralArchived,
  isCollateralBlocked,
  isCollateralDueSoon,
  isCollateralOverdue,
  normalizeCollateralWorkflowStatus,
  type CollateralStatus,
  type CollateralItem,
} from "@/lib/collateral-data";
import {
  getCollateralCreateTraceId,
  setCollateralCreateTraceId,
  traceCollateralCreate
} from "@/lib/collateral-create-trace";
import {
  createActionNoteEntry,
  formatShortDate,
  getOwnerOptions,
  LOCAL_FALLBACK_NOTE_AUTHOR
} from "@/lib/ops-utils";
import {
  buildSponsorFulfillmentGenerationResult,
  ensureSponsorshipSetupForEventInstance,
  getSponsorCollateralPromotionDefaults,
  getSponsorPlacementLabel
} from "@/lib/sponsor-fulfillment";
import { resolveActiveEventInstanceId } from "@/lib/event-instances";

type PendingDraftDiscardIntent =
  | { type: "switch"; nextEventInstanceId: string }
  | { type: "sponsorPromotion"; actionItemId: string; eventInstanceId: string }
  | null;

type PendingCollateralOpenIntent = {
  collateralId: string;
  eventInstanceId: string;
};

type PendingSponsorPromotionIntent = {
  actionItemId: string;
  eventInstanceId: string;
};

const DRAFT_COLLATERAL_ID = "__draft-collateral__";

type CollateralQuickAddScope = "event-wide" | "linked";

type CollateralEditorTab = "details" | "production" | "notes";
type CollateralEditorFocusTarget = "blockedBy" | null;

export function CollateralView({
  initialEventInstanceId,
  initialSelectedCollateralId
}: {
  initialEventInstanceId?: string;
  initialSelectedCollateralId?: string;
}) {
  const {
    activeEventInstanceId,
    defaultOwnerForNewItems,
    items,
    sponsorshipSetupByInstance
  } = useAppStateValues();
  const {
    addCollateralItem,
    applyDefaultTemplateToInstance,
    deleteCollateralItem,
    ensureEventInstanceUnassignedSubEvent,
    updateCollateralItem
  } = useAppActions();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [draftCollateralItem, setDraftCollateralItem] = useState<CollateralItem | null>(null);
  const [pendingDraftDiscardIntent, setPendingDraftDiscardIntent] = useState<PendingDraftDiscardIntent>(null);
  const [setupFeedback, setSetupFeedback] = useState<string>("");
  const [noteDraft, setNoteDraft] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [activeSummaryFilter, setActiveSummaryFilter] = useState<CollateralSummaryFilter>("all");
  const [activeProfileDeadlineFilter, setActiveProfileDeadlineFilter] =
    useState<CollateralProfileDeadlineFilter>("none");
  const [showArchived, setShowArchived] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddScope, setQuickAddScope] = useState<CollateralQuickAddScope>("event-wide");
  const [quickAddSubEventId, setQuickAddSubEventId] = useState("");
  const [activeEditorTab, setActiveEditorTab] = useState<CollateralEditorTab>("details");
  const [pendingEditorFocusTarget, setPendingEditorFocusTarget] = useState<CollateralEditorFocusTarget>(null);
  const [selectedEventInstanceId, setSelectedEventInstanceId] = useState(
    () => searchParams.get("eventInstanceId") ?? initialEventInstanceId ?? activeEventInstanceId
  );
  const blockedByInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingOpenIntent, setPendingOpenIntent] = useState<PendingCollateralOpenIntent>(() => ({
    collateralId: searchParams.get("collateralId") ?? initialSelectedCollateralId ?? "",
    eventInstanceId: searchParams.get("eventInstanceId") ?? initialEventInstanceId ?? ""
  }));
  const [pendingSponsorPromotionIntent, setPendingSponsorPromotionIntent] =
    useState<PendingSponsorPromotionIntent | null>(() => {
      const actionItemId = searchParams.get("promoteActionItemId") ?? "";
      const eventInstanceId = searchParams.get("eventInstanceId") ?? initialEventInstanceId ?? "";

      if (!actionItemId || !eventInstanceId) {
        return null;
      }

      return {
        actionItemId,
        eventInstanceId
      };
    });

  const {
    workspaceBundle,
    collateralListView,
    selectedWorkspace,
    eventPrograms,
    eventInstances
  } = useCollateralWorkspaceReadModel({
    selectedEventInstanceId,
    activeSummaryFilter,
    activeProfileDeadlineFilter,
    selectedId,
    draftCollateralItem,
    showArchived
  });
  const resolvedActiveEventInstanceId = workspaceBundle.resolvedActiveEventInstanceId;
  const selectedEventInstance = workspaceBundle.selectedEventInstance;
  const currentEventProgram = workspaceBundle.currentEventProgram;
  const defaultTemplatePack = workspaceBundle.defaultTemplatePack;
  const isSelectedEventProgramSupported = workspaceBundle.isSelectedEventProgramSupported;
  const sponsorshipSetup =
    selectedEventInstance
      ? ensureSponsorshipSetupForEventInstance(
          resolvedActiveEventInstanceId,
          selectedEventInstance.eventTypeId,
          sponsorshipSetupByInstance[resolvedActiveEventInstanceId]
        )
      : null;
  const eventTypeNameById = useMemo(
    () => new Map(eventPrograms.map((eventProgram) => [eventProgram.id, eventProgram.name])),
    [eventPrograms]
  );
  const selectableEventInstances = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const sortedInstances = [...eventInstances].sort((left, right) => left.startDate.localeCompare(right.startDate));
    const futureInstances = sortedInstances.filter((instance) => (instance.endDate || instance.startDate) >= today);

    return futureInstances.length > 0 ? futureInstances : sortedInstances;
  }, [eventInstances]);

  useEffect(() => {
    setSelectedEventInstanceId((current) => resolveActiveEventInstanceId(current, eventInstances));
  }, [eventInstances]);
  useEffect(() => {
    setIsActionsMenuOpen(false);
    setIsDeleteConfirmOpen(false);
  }, [selectedId, resolvedActiveEventInstanceId]);

  useEffect(() => {
    setActiveSummaryFilter("all");
    setActiveProfileDeadlineFilter("none");
  }, [resolvedActiveEventInstanceId]);

  useEffect(() => {
    setNoteDraft("");
  }, [selectedId]);

  useEffect(() => {
    setDraftCollateralItem((current) =>
      current && current.eventInstanceId !== resolvedActiveEventInstanceId ? null : current
    );
  }, [resolvedActiveEventInstanceId]);

  useEffect(() => {
    if (!searchParams.get("promoteActionItemId")) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("promoteActionItemId");
    const nextQuery = params.toString();
    router.replace(nextQuery ? `/collateral?${nextQuery}` : "/collateral");
  }, [router, searchParams]);

  useEffect(() => {
    if (!pendingOpenIntent.eventInstanceId) {
      return;
    }

    if (draftCollateralItem) {
      return;
    }

    if (pendingOpenIntent.eventInstanceId !== resolvedActiveEventInstanceId) {
      setSelectedEventInstanceId(pendingOpenIntent.eventInstanceId);
      return;
    }

    setPendingOpenIntent((current) => ({ ...current, eventInstanceId: "" }));
  }, [
    draftCollateralItem,
    pendingOpenIntent.eventInstanceId,
    resolvedActiveEventInstanceId
  ]);

  useEffect(() => {
    if (!pendingSponsorPromotionIntent) {
      return;
    }

    if (draftCollateralItem) {
      setPendingDraftDiscardIntent((current) =>
        current ?? {
          type: "sponsorPromotion",
          actionItemId: pendingSponsorPromotionIntent.actionItemId,
          eventInstanceId: pendingSponsorPromotionIntent.eventInstanceId
        }
      );
      return;
    }

    if (pendingSponsorPromotionIntent.eventInstanceId !== resolvedActiveEventInstanceId) {
      setSelectedEventInstanceId(pendingSponsorPromotionIntent.eventInstanceId);
      return;
    }

    const sourceItem = items.find((item) => item.id === pendingSponsorPromotionIntent.actionItemId);
    if (!sourceItem) {
      setSetupFeedback("The sponsor action item could not be found, so no collateral draft was created.");
      setPendingSponsorPromotionIntent(null);
      return;
    }

    const promotionDefaults = getSponsorCollateralPromotionDefaults({
      item: sourceItem,
      eventSubEvents: workspaceBundle.instanceSubEvents
    });

    if (!promotionDefaults) {
      setSetupFeedback("This sponsor action item does not map to a collateral draft yet.");
      setPendingSponsorPromotionIntent(null);
      return;
    }

    const promotionNoteEntry = createActionNoteEntry(
      `Created from sponsor action item "${sourceItem.title}". Placement: ${getSponsorPlacementLabel(
        promotionDefaults.placement,
        selectedEventInstance?.eventTypeId ?? "legislative-day"
      )}.`,
      { author: LOCAL_FALLBACK_NOTE_AUTHOR }
    );

    const nextDraft = {
      id: DRAFT_COLLATERAL_ID,
      eventInstanceId: promotionDefaults.eventInstanceId,
      subEventId: promotionDefaults.subEventId,
      itemName: promotionDefaults.collateralItemName,
      notes: "",
      requiresLogo: false,
      requiresCopy: false,
      requiresApproval: false,
      status: "Backlog",
      owner: defaultOwnerForNewItems,
      blockedBy: "",
      dueDate: "",
      printer: "",
      quantity: "",
      updateType: "",
      noteEntries: promotionNoteEntry ? [promotionNoteEntry] : [],
      lastUpdated: new Date().toISOString().slice(0, 10)
    } satisfies CollateralItem;

    setDraftCollateralItem(nextDraft);
    setSelectedId(DRAFT_COLLATERAL_ID);
    setActiveSummaryFilter("all");
    setActiveProfileDeadlineFilter("none");
    setSetupFeedback(
      `Opened a prefilled collateral draft for ${promotionDefaults.collateralItemName}. Review and save it when you're ready.`
    );
    setPendingSponsorPromotionIntent(null);
  }, [
    defaultOwnerForNewItems,
    draftCollateralItem,
    items,
    pendingSponsorPromotionIntent,
    resolvedActiveEventInstanceId,
    workspaceBundle.instanceSubEvents
  ]);

  const instanceItems = collateralListView.instanceItems;
  const visibleInstanceItems = collateralListView.visibleInstanceItems;
  const closedHistoryItems = collateralListView.closedHistoryItems;
  const selectedItem = selectedWorkspace.selectedItem;
  const subEventNameById = selectedWorkspace.subEventNameById;
  const selectedSubEventOptions = selectedWorkspace.subEventOptions;
  const emptySubEventId = selectedWorkspace.emptySubEventId;
  const selectedEventDateRange = workspaceBundle.selectedEventDateRange;
  const selectedItemScope = selectedItem ? getCollateralScope(selectedItem.subEventId, emptySubEventId) : "event-wide";
  const linkedSubEventOptions = useMemo(
    () => selectedSubEventOptions.filter((subEvent) => subEvent.id !== emptySubEventId),
    [emptySubEventId, selectedSubEventOptions]
  );
  const listItems = useMemo(
    () =>
      [...visibleInstanceItems].sort((left, right) => {
        const leftHasDueDate = left.dueDate.length > 0;
        const rightHasDueDate = right.dueDate.length > 0;

        if (leftHasDueDate !== rightHasDueDate) {
          return leftHasDueDate ? -1 : 1;
        }

        if (leftHasDueDate && rightHasDueDate) {
          const dueDateCompare = left.dueDate.localeCompare(right.dueDate);
          if (dueDateCompare !== 0) {
            return dueDateCompare;
          }
        }

        return left.itemName.localeCompare(right.itemName);
    }),
    [visibleInstanceItems]
  );
  const closedHistoryListItems = useMemo(
    () => [...closedHistoryItems],
    [closedHistoryItems]
  );

  useEffect(() => {
    if (!pendingOpenIntent.collateralId) {
      return;
    }

    if (pendingOpenIntent.eventInstanceId && pendingOpenIntent.eventInstanceId !== resolvedActiveEventInstanceId) {
      return;
    }

    if (instanceItems.some((item) => item.id === pendingOpenIntent.collateralId)) {
      setSelectedId((current) => (current === pendingOpenIntent.collateralId ? current : pendingOpenIntent.collateralId));
    }

    setPendingOpenIntent((current) => ({ ...current, collateralId: "" }));
  }, [
    instanceItems,
    pendingOpenIntent.collateralId,
    pendingOpenIntent.eventInstanceId,
    resolvedActiveEventInstanceId
  ]);

  useEffect(() => {
    setIsEditingTitle(false);
    setTitleDraft(selectedItem?.itemName ?? "");
  }, [selectedItem?.id, selectedItem?.itemName]);

  useEffect(() => {
    setActiveEditorTab("details");
  }, [selectedItem?.id]);

  useEffect(() => {
    if (pendingEditorFocusTarget !== "blockedBy" || activeEditorTab !== "details" || !selectedItem) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      blockedByInputRef.current?.focus();
      blockedByInputRef.current?.select();
      setPendingEditorFocusTarget(null);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [activeEditorTab, pendingEditorFocusTarget, selectedItem]);

  useEffect(() => {
    if (!selectedItem) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItem]);

  useEffect(() => {
    const traceId = getCollateralCreateTraceId();

    if (!traceId) {
      return;
    }

    const renderedItem = listItems.find((item) => item.id === traceId) ?? null;

    traceCollateralCreate("collateral-view-render", {
      traceId,
      activeEventInstanceId: resolvedActiveEventInstanceId,
      activeSummaryFilter,
      activeProfileDeadlineFilter,
      showArchived,
      selectedId,
      instanceItemIds: instanceItems.map((item) => item.id),
      visibleItemIds: visibleInstanceItems.map((item) => item.id),
      groupedSections: [{ subEvent: "flat-list", itemIds: listItems.map((item) => item.id) }],
      renderedItem: renderedItem
        ? {
            id: renderedItem.id,
            eventInstanceId: renderedItem.eventInstanceId,
            subEventId: renderedItem.subEventId,
            status: renderedItem.status,
            archivedAt: renderedItem.archivedAt
          }
        : null
    });
  }, [
    activeProfileDeadlineFilter,
    activeSummaryFilter,
    instanceItems,
    listItems,
    resolvedActiveEventInstanceId,
    selectedId,
    showArchived,
    visibleInstanceItems
  ]);

  const hasAppliedTemplateItems = workspaceBundle.hasAppliedTemplateItems;
  const hasActiveCollateralFilters = showArchived;
  const hasUnsavedDraftCollateral = Boolean(draftCollateralItem);
  function openQuickAddModal() {
    const fallbackSubEventId = ensureEventInstanceUnassignedSubEvent(resolvedActiveEventInstanceId);
    const preferredLinkedSubEventId = linkedSubEventOptions[0]?.id ?? fallbackSubEventId;
    setQuickAddName("");
    setQuickAddScope("event-wide");
    setQuickAddSubEventId(preferredLinkedSubEventId);
    setIsQuickAddOpen(true);
  }

  function closeQuickAddModal() {
    setIsQuickAddOpen(false);
  }

  function handleQuickAddCollateral() {
    const nextName = quickAddName.trim();

    if (!nextName) {
      return;
    }

    const fallbackSubEventId = ensureEventInstanceUnassignedSubEvent(resolvedActiveEventInstanceId);
    const nextSubEventId =
      quickAddScope === "event-wide"
        ? fallbackSubEventId
        : quickAddSubEventId || linkedSubEventOptions[0]?.id || fallbackSubEventId;
    const nextId = addCollateralItem({
      eventInstanceId: resolvedActiveEventInstanceId,
      subEventId: nextSubEventId,
      itemName: nextName,
      notes: "",
      requiresLogo: false,
      requiresCopy: false,
      requiresApproval: false,
      status: "Backlog",
      owner: defaultOwnerForNewItems,
      blockedBy: "",
      dueDate: "",
      printer: "",
      quantity: "",
      updateType: "",
      noteEntries: [],
      fileLink: undefined
    });

    setSelectedId(nextId);
    setCollateralCreateTraceId(nextId);
    closeQuickAddModal();
  }

  function addNote(item: CollateralItem) {
    const nextEntry = createActionNoteEntry(noteDraft, { author: LOCAL_FALLBACK_NOTE_AUTHOR });

    if (!nextEntry) {
      return;
    }

    patchCollateralItem(item.id, { noteEntries: [nextEntry, ...item.noteEntries] });
    setNoteDraft("");
  }

  function commitTitleDraft(item: CollateralItem, value: string) {
    const nextTitle = value.trim();

    if (!nextTitle || nextTitle === item.itemName) {
      setTitleDraft(item.itemName);
      return;
    }

    patchCollateralItem(item.id, { itemName: nextTitle });
  }

  function finishTitleEdit(item: CollateralItem) {
    commitTitleDraft(item, titleDraft);
    setIsEditingTitle(false);
  }

  function cancelTitleEdit(item: CollateralItem) {
    setTitleDraft(item.itemName);
    setIsEditingTitle(false);
  }

  function patchCollateralItem(id: string, updates: Partial<CollateralItem>) {
    if (draftCollateralItem && id === draftCollateralItem.id) {
      setDraftCollateralItem((current) =>
        current
          ? {
              ...current,
              ...updates,
              lastUpdated: new Date().toISOString().slice(0, 10)
            }
          : current
      );
      return;
    }

    updateCollateralItem(id, updates);
  }

  function discardDraftCollateralItem() {
    setDraftCollateralItem(null);
    setSelectedId(null);
    setNoteDraft("");
  }

  function saveDraftCollateralItem() {
    if (!draftCollateralItem) {
      return;
    }

    traceCollateralCreate("save-requested", {
      id: draftCollateralItem.id,
      eventInstanceId: draftCollateralItem.eventInstanceId,
      subEventId: draftCollateralItem.subEventId,
      status: draftCollateralItem.status,
      archivedAt: draftCollateralItem.archivedAt,
      activeEventInstanceId: resolvedActiveEventInstanceId,
      activeSummaryFilter,
      activeProfileDeadlineFilter,
      showArchived
    });

    const nextId = addCollateralItem({
      eventInstanceId: draftCollateralItem.eventInstanceId,
      subEventId: draftCollateralItem.subEventId,
      templateOriginId: draftCollateralItem.templateOriginId,
      itemName: draftCollateralItem.itemName,
      status: draftCollateralItem.status,
      owner: draftCollateralItem.owner,
      blockedBy: draftCollateralItem.blockedBy,
      dueDate: draftCollateralItem.dueDate,
      printer: draftCollateralItem.printer,
      quantity: draftCollateralItem.quantity,
      updateType: draftCollateralItem.updateType,
      noteEntries: draftCollateralItem.noteEntries,
      notes: draftCollateralItem.notes,
      fileLink: draftCollateralItem.fileLink
    });

    setDraftCollateralItem(null);
    setActiveSummaryFilter("all");
    setActiveProfileDeadlineFilter("none");
    setSelectedId(nextId);
    setCollateralCreateTraceId(nextId);
    traceCollateralCreate("save-returned", {
      id: nextId,
      eventInstanceId: draftCollateralItem.eventInstanceId,
      subEventId: draftCollateralItem.subEventId,
      status: draftCollateralItem.status,
      archivedAt: draftCollateralItem.archivedAt,
      activeEventInstanceId: resolvedActiveEventInstanceId,
      filtersCleared: true
    });
  }

  function clearCollateralFilters() {
    setActiveSummaryFilter("all");
    setActiveProfileDeadlineFilter("none");
    setShowArchived(false);
  }

  function updateCollateralStatus(item: CollateralItem, status: CollateralStatus) {
    patchCollateralItem(item.id, {
      status
    });

    if (status !== "Waiting") {
      return;
    }

    setActiveEditorTab("details");
    setPendingEditorFocusTarget("blockedBy");
    setSelectedId((current) => (current === item.id ? current : item.id));
  }

  function requestEventInstanceSwitch(nextEventInstanceId: string) {
    if (nextEventInstanceId === resolvedActiveEventInstanceId) {
      return;
    }

    if (hasUnsavedDraftCollateral) {
      setPendingDraftDiscardIntent({ type: "switch", nextEventInstanceId });
      return;
    }

    setSelectedEventInstanceId(nextEventInstanceId);
    setSelectedId(null);
  }

  function handleCancelDraftDiscardIntent() {
    if (pendingDraftDiscardIntent?.type === "sponsorPromotion") {
      setPendingSponsorPromotionIntent(null);
    }
    setPendingDraftDiscardIntent(null);
  }

  function handleConfirmDraftDiscardIntent() {
    if (!pendingDraftDiscardIntent) {
      return;
    }

    const intent = pendingDraftDiscardIntent;
    discardDraftCollateralItem();
    setPendingDraftDiscardIntent(null);

    if (intent.type === "switch") {
      setSelectedEventInstanceId(intent.nextEventInstanceId);
      return;
    }

    if (intent.type === "sponsorPromotion") {
      setPendingSponsorPromotionIntent({
        actionItemId: intent.actionItemId,
        eventInstanceId: intent.eventInstanceId
      });

      if (intent.eventInstanceId !== resolvedActiveEventInstanceId) {
        setSelectedEventInstanceId(intent.eventInstanceId);
      }
      return;
    }

  }

  return (
    <section className="collateral-page">
      <div className="card card--secondary collateral-workspace-header">
        <div className="collateral-workspace-header__main">
          <div>
            <h1 className="collateral-page__title">{selectedEventInstance?.name ?? "Collateral"}</h1>
            <div className="collateral-workspace-header__meta">
              {selectedEventDateRange ? <span>{selectedEventDateRange}</span> : null}
              {selectedEventInstance?.location ? <span>{selectedEventInstance.location}</span> : null}
              {currentEventProgram ? (
                <span>{eventTypeNameById.get(selectedEventInstance?.eventTypeId ?? "") ?? currentEventProgram.name}</span>
              ) : null}
            </div>
            <p className="collateral-page__subtitle">
              Event-owned production items for this event. Sponsor-specific deliverables stay in Events and Fulfillment Preview.
            </p>
          </div>
          <div className="collateral-page__actions">
            <div className="field">
              <label htmlFor="collateral-event-instance">Event Instance</label>
              <select
                className="field-control"
                id="collateral-event-instance"
                onChange={(event) => requestEventInstanceSwitch(event.target.value)}
                value={resolvedActiveEventInstanceId}
              >
                {selectableEventInstances.map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    {instance.name}
                  </option>
                ))}
              </select>
            </div>
            <button className="topbar__button" onClick={openQuickAddModal} type="button">
              + Add Collateral
            </button>
          </div>
        </div>
        {setupFeedback ? (
          <div className="collateral-inline-feedback" role="status">
            <span>{setupFeedback}</span>
            <button className="button-link button-link--inline-secondary" onClick={() => setSetupFeedback("")} type="button">
              Dismiss
            </button>
          </div>
        ) : null}
      </div>

      <div className="collateral-layout collateral-layout--flat">
        <div className="collateral-main">
          <div className="card card--secondary collateral-working-list">
            <div className="collateral-working-list__header">
              <div>
                <div className="card__title">COLLATERAL ITEMS</div>
                <div className="collateral-working-list__copy">
                  Scannable event-owned materials list for signage, decks, print pieces, boards, and similar production work.
                </div>
              </div>
              <div className="collateral-working-list__actions">
                {defaultTemplatePack && !hasAppliedTemplateItems && isSelectedEventProgramSupported ? (
                  <button
                    className="button-link button-link--inline-secondary"
                    onClick={() => applyDefaultTemplateToInstance(resolvedActiveEventInstanceId)}
                    type="button"
                  >
                    Apply Default Template
                  </button>
                ) : null}
              </div>
            </div>
            <div className="collateral-list-toolbar">
              <label className="toggle">
                <input
                  checked={showArchived}
                  onChange={(event) => setShowArchived(event.target.checked)}
                  type="checkbox"
                />
                <span>Show Hidden History</span>
              </label>
            {hasActiveCollateralFilters ? (
              <div className="collateral-filter-context collateral-filter-context--inline">
                <span>
                  Showing closed and other hidden collateral history alongside the active lane.
                </span>
                <button
                  className="button-link button-link--inline-secondary"
                  onClick={clearCollateralFilters}
                  type="button"
                >
                  Clear
                </button>
              </div>
            ) : null}
            </div>
            {listItems.length === 0 ? (
              <div className="empty-state empty-state--actionable">
                <div className="empty-state__title">
                  {hasActiveCollateralFilters ? "No items match this view." : "No collateral items yet."}
                </div>
                <div className="empty-state__copy">
                  {!hasActiveCollateralFilters
                    ? defaultTemplatePack && isSelectedEventProgramSupported
                        ? `Apply the default template for ${currentEventProgram?.name ?? "this event"} or add your first collateral item manually.`
                        : "Add your first collateral item to start tracking event-wide or sub-event production work."
                    : "Try a different summary view or clear cut history to return to the active collateral list."}
                </div>
                <div className="empty-state__actions">
                  {!hasActiveCollateralFilters && defaultTemplatePack && isSelectedEventProgramSupported ? (
                    <button
                      className="topbar__button"
                      onClick={() => applyDefaultTemplateToInstance(resolvedActiveEventInstanceId)}
                      type="button"
                    >
                      Apply Default Template
                    </button>
                  ) : null}
                  {!hasActiveCollateralFilters ? (
                    <button className="button-link button-link--inline-secondary" onClick={openQuickAddModal} type="button">
                      Add First Collateral Item
                    </button>
                  ) : (
                    <button
                      className="button-link button-link--inline-secondary"
                      onClick={clearCollateralFilters}
                      type="button"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="collateral-list collateral-list--flat">
                {listItems.map((item) => {
                  const isSelected = item.id === selectedId;
                  const scopeLabel =
                    getCollateralScope(item.subEventId, emptySubEventId) === "event-wide"
                      ? "Event-wide"
                      : subEventNameById.get(item.subEventId) ?? "Linked sub-event";

                    return (
                      <div
                        className={getCollateralRowClassName(item, isSelected)}
                        key={item.id}
                      >
                        <button
                          className="collateral-row__body"
                          onClick={() => setSelectedId(item.id)}
                          type="button"
                        >
                          <div className="collateral-row__main">
                            <div className="collateral-row__title">{item.itemName}</div>
                            <div className="collateral-row__meta">
                              <span>{scopeLabel}</span>
                              {item.owner ? (
                                <span>Owner: {item.owner}</span>
                              ) : (
                                <span className="collateral-row__meta-flag collateral-row__meta-flag--unassigned">
                                  No owner assigned
                                </span>
                              )}
                              {item.printer.trim() ? <span>Printer: {item.printer.trim()}</span> : null}
                              <span>{item.dueDate ? `Due ${formatShortDate(item.dueDate)}` : "No due date"}</span>
                            </div>
                            {item.notes?.trim() ? (
                              <div className="collateral-row__supporting">{item.notes.trim()}</div>
                            ) : item.fileLink?.trim() ? (
                              <div className="collateral-row__supporting">{item.fileLink.trim()}</div>
                            ) : null}
                          </div>
                        </button>
                        <div className="collateral-row__signals">
                          <label className="collateral-row__status-control">
                            <span className="sr-only">Update status for {item.itemName}</span>
                            <select
                              aria-label={`Status for ${item.itemName}`}
                              className={getCollateralStatusClassName(item)}
                              onChange={(event) => updateCollateralStatus(item, event.target.value as CollateralStatus)}
                              value={item.status}
                            >
                              {COLLATERAL_STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
            )}
            {closedHistoryListItems.length > 0 ? (
              <section className="collateral-completed-section" aria-labelledby="collateral-completed-title">
                <div className="collateral-completed-section__header">
                  <div>
                    <div className="card__title" id="collateral-completed-title">CLOSED & HIDDEN</div>
                    <div className="collateral-working-list__copy">
                      Completed, cut, and other hidden collateral stays visible here for reference without crowding the active working lane.
                    </div>
                  </div>
                  <div className="collateral-completed-section__count">
                    {closedHistoryListItems.length} item{closedHistoryListItems.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div className="collateral-list collateral-list--flat collateral-list--completed">
                  {closedHistoryListItems.map((item) => {
                    const isSelected = item.id === selectedId;
                    const scopeLabel =
                      getCollateralScope(item.subEventId, emptySubEventId) === "event-wide"
                        ? "Event-wide"
                        : subEventNameById.get(item.subEventId) ?? "Linked sub-event";

                    return (
                      <div
                        className={getCollateralRowClassName(item, isSelected, "completed")}
                        key={item.id}
                      >
                        <button
                          className="collateral-row__body"
                          onClick={() => setSelectedId(item.id)}
                          type="button"
                        >
                          <div className="collateral-row__main">
                            <div className="collateral-row__title">{item.itemName}</div>
                            <div className="collateral-row__meta">
                              <span>{scopeLabel}</span>
                              {item.owner ? <span>Owner: {item.owner}</span> : null}
                              {item.printer.trim() ? <span>Printer: {item.printer.trim()}</span> : null}
                              <span>{item.status}</span>
                            </div>
                            {item.notes?.trim() ? (
                              <div className="collateral-row__supporting">{item.notes.trim()}</div>
                            ) : null}
                          </div>
                        </button>
                        <div className="collateral-row__signals">
                          <label className="collateral-row__status-control">
                            <span className="sr-only">Update status for {item.itemName}</span>
                            <select
                              aria-label={`Status for ${item.itemName}`}
                              className={getCollateralStatusClassName(item)}
                              onChange={(event) => updateCollateralStatus(item, event.target.value as CollateralStatus)}
                              value={item.status}
                            >
                              {COLLATERAL_STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        </div>

        {selectedItem ? (
          <div className="modal-layer collateral-editor-layer" role="presentation">
            <button
              aria-label="Close collateral editor"
              className="modal-backdrop collateral-editor-backdrop"
              onClick={() => setSelectedId(null)}
              type="button"
            />
            <section
              aria-label="Collateral details"
              aria-modal="true"
              className="drawer drawer--collateral collateral-editor-modal"
              role="dialog"
            >
            <div className="drawer__sticky collateral-editor-modal__sticky">
            <div className="drawer__header collateral-editor-modal__header">
              <div className="drawer__header-text">
                {isEditingTitle ? (
                  <input
                    aria-label="Edit collateral item title"
                    autoFocus
                    className="drawer__title-input collateral-drawer__title-input"
                    id="collateral-title"
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
                    value={titleDraft}
                  />
                ) : (
                  <h2 className="drawer__title collateral-drawer__title">
                    <button className="drawer__title-button" onClick={() => setIsEditingTitle(true)} type="button">
                      {selectedItem.itemName}
                    </button>
                  </h2>
                )}
                <div className="drawer__header-meta">
                  <span className="drawer__workstream">
                    {selectedItemScope === "event-wide"
                      ? "Event-wide"
                      : subEventNameById.get(selectedItem.subEventId) ?? "Linked sub-event"}
                  </span>
                  <span className={getCollateralStatusClassName(selectedItem)}>{selectedItem.status}</span>
                  {isCollateralArchived(selectedItem) ? (
                    <span className="drawer__status-chip">Hidden from active lane</span>
                  ) : null}
                  {draftCollateralItem?.id === selectedItem.id ? (
                    <span className="drawer__status-chip drawer__status-chip--new">New item</span>
                  ) : null}
                </div>
                <div className="collateral-drawer__meta-row">
                  {selectedItem.dueDate ? (
                    <span className="drawer__due-text">{getCollateralDrawerDueText(selectedItem)}</span>
                  ) : (
                    <span className="drawer__due-text">No due date set</span>
                  )}
                  {selectedItem.owner ? (
                    <span className="collateral-drawer__meta-pill">Owner: {selectedItem.owner}</span>
                  ) : null}
                  {selectedItem.printer.trim() ? (
                    <span className="collateral-drawer__meta-pill">Printer: {selectedItem.printer.trim()}</span>
                  ) : null}
                  {selectedItem.quantity.trim() ? (
                    <span className="collateral-drawer__meta-pill">Qty: {selectedItem.quantity.trim()}</span>
                  ) : null}
                </div>
                {selectedItem.blockedBy.trim() ? (
                  <div className="drawer__warning drawer__warning--blocked">
                    Blocked by {selectedItem.blockedBy.trim()}
                  </div>
                ) : null}
              </div>
              <div className="drawer__header-actions">
                <button
                  aria-label="Close collateral editor"
                  className="drawer__actions-trigger drawer__actions-trigger--close"
                  onClick={() => setSelectedId(null)}
                  type="button"
                >
                  <span aria-hidden="true">×</span>
                </button>
                <div className="drawer__actions-menu">
                  <button
                    aria-expanded={isActionsMenuOpen}
                    aria-haspopup="menu"
                    className="drawer__actions-trigger"
                    onClick={() => setIsActionsMenuOpen((current) => !current)}
                    type="button"
                  >
                    <span aria-hidden="true">⚙</span>
                    <span className="sr-only">Open collateral item actions</span>
                  </button>
                  {isActionsMenuOpen ? (
                    <div className="drawer__actions-popover" role="menu">
                      <button
                        className="drawer__actions-item drawer__actions-item--danger"
                        onClick={() => {
                          setIsActionsMenuOpen(false);
                          setIsDeleteConfirmOpen(true);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            </div>

            <div className="drawer__sections collateral-editor-modal__body">
              <section className="drawer-section drawer-section--form collateral-drawer collateral-editor-tabs">
                <div className="collateral-editor-tabs__nav" aria-label="Collateral editor sections" role="tablist">
                  <button
                    aria-selected={activeEditorTab === "details"}
                    className={activeEditorTab === "details" ? "collateral-editor-tabs__tab collateral-editor-tabs__tab--active" : "collateral-editor-tabs__tab"}
                    id="collateral-editor-tab-details"
                    onClick={() => setActiveEditorTab("details")}
                    role="tab"
                    type="button"
                  >
                    Details
                  </button>
                  <button
                    aria-selected={activeEditorTab === "production"}
                    className={activeEditorTab === "production" ? "collateral-editor-tabs__tab collateral-editor-tabs__tab--active" : "collateral-editor-tabs__tab"}
                    id="collateral-editor-tab-production"
                    onClick={() => setActiveEditorTab("production")}
                    role="tab"
                    type="button"
                  >
                    Production
                  </button>
                  <button
                    aria-selected={activeEditorTab === "notes"}
                    className={activeEditorTab === "notes" ? "collateral-editor-tabs__tab collateral-editor-tabs__tab--active" : "collateral-editor-tabs__tab"}
                    id="collateral-editor-tab-notes"
                    onClick={() => setActiveEditorTab("notes")}
                    role="tab"
                    type="button"
                  >
                    Notes
                  </button>
                </div>

                {activeEditorTab === "details" ? (
                  <div
                    aria-labelledby="collateral-editor-tab-details"
                    className="collateral-editor-tabs__panel"
                    role="tabpanel"
                  >
                    <div className="collateral-drawer__group">
                      <div className="drawer__panel-title">Details</div>
                      <div className="drawer__grid drawer__grid--form collateral-drawer__grid collateral-drawer__grid--dense">
                        <div className="field field--wide">
                          <label htmlFor="collateral-item-name">Item Name</label>
                          <input
                            id="collateral-item-name"
                            onChange={(event) => patchCollateralItem(selectedItem.id, { itemName: event.target.value })}
                            value={selectedItem.itemName}
                          />
                        </div>
                        <div className="field field--secondary">
                          <label htmlFor="collateral-scope">Scope</label>
                          <select
                            id="collateral-scope"
                            onChange={(event) =>
                              patchCollateralItem(selectedItem.id, {
                                subEventId:
                                  event.target.value === "event-wide"
                                    ? emptySubEventId
                                    : selectedSubEventOptions.find((subEvent) => subEvent.id !== emptySubEventId)?.id ?? emptySubEventId
                              })
                            }
                            value={selectedItemScope}
                          >
                            <option value="event-wide">Event-wide</option>
                            <option value="linked">Linked to sub-event</option>
                          </select>
                        </div>
                        {selectedItemScope === "linked" ? (
                          <div className="field field--secondary">
                            <label htmlFor="collateral-sub-event">Linked Sub-Event</label>
                            <select
                              id="collateral-sub-event"
                              onChange={(event) => patchCollateralItem(selectedItem.id, { subEventId: event.target.value })}
                              value={selectedItem.subEventId}
                            >
                              {selectedSubEventOptions
                                .filter((subEvent) => subEvent.id !== emptySubEventId)
                                .map((subEvent) => (
                                  <option key={subEvent.id} value={subEvent.id}>
                                    {subEvent.name}
                                  </option>
                                ))}
                            </select>
                          </div>
                        ) : null}
                        <div className="field field--priority">
                          <label htmlFor="collateral-status">Status</label>
                          <select
                            id="collateral-status"
                            onChange={(event) =>
                              patchCollateralItem(selectedItem.id, {
                                status: event.target.value as CollateralStatus
                              })
                            }
                            value={selectedItem.status}
                          >
                            {COLLATERAL_STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor="collateral-owner">Owner</label>
                          <select
                            id="collateral-owner"
                            onChange={(event) => patchCollateralItem(selectedItem.id, { owner: event.target.value })}
                            value={selectedItem.owner}
                          >
                            <option value="">No owner assigned</option>
                            {getOwnerOptions(selectedItem.owner || defaultOwnerForNewItems).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field field--priority">
                          <label htmlFor="collateral-due-date">Due Date</label>
                          <input
                            id="collateral-due-date"
                            onChange={(event) => patchCollateralItem(selectedItem.id, { dueDate: event.target.value })}
                            type="date"
                            value={selectedItem.dueDate}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor="collateral-printer">Printer</label>
                          <select
                            id="collateral-printer"
                            onChange={(event) => patchCollateralItem(selectedItem.id, { printer: event.target.value })}
                            value={selectedItem.printer}
                          >
                            <option value="">Select printer</option>
                            {COLLATERAL_PRINTER_OPTIONS.filter((option) => option.length > 0).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field field--wide collateral-drawer__blocked-field">
                          <label htmlFor="collateral-blocked-by">Blocked By</label>
                          <input
                            id="collateral-blocked-by"
                            ref={blockedByInputRef}
                            onChange={(event) => patchCollateralItem(selectedItem.id, { blockedBy: event.target.value })}
                            placeholder="Optional blocker"
                            value={selectedItem.blockedBy}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeEditorTab === "production" ? (
                  <div
                    aria-labelledby="collateral-editor-tab-production"
                    className="collateral-editor-tabs__panel"
                    role="tabpanel"
                  >
                    <div className="collateral-drawer__group">
                      <div className="drawer__panel-title">Production</div>
                      <div className="drawer__grid drawer__grid--form collateral-drawer__grid collateral-drawer__grid--dense">
                        <div className="field">
                          <label htmlFor="collateral-quantity">Qty</label>
                          <input
                            id="collateral-quantity"
                            onChange={(event) => patchCollateralItem(selectedItem.id, { quantity: event.target.value })}
                            value={selectedItem.quantity}
                          />
                        </div>
                        <div className="field field--wide">
                          <label htmlFor="collateral-update-type">Update Type</label>
                          <select
                            id="collateral-update-type"
                            onChange={(event) => patchCollateralItem(selectedItem.id, { updateType: event.target.value })}
                            value={selectedItem.updateType}
                          >
                            <option value="">Select update type</option>
                            {COLLATERAL_UPDATE_TYPE_OPTIONS.filter((option) => option.length > 0).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                        <label className="toggle collateral-drawer__toggle">
                          <input
                            checked={selectedItem.requiresLogo === true}
                            onChange={(event) => patchCollateralItem(selectedItem.id, { requiresLogo: event.target.checked })}
                            type="checkbox"
                          />
                          <span>Requires Logo</span>
                        </label>
                        <label className="toggle collateral-drawer__toggle">
                          <input
                            checked={selectedItem.requiresCopy === true}
                            onChange={(event) => patchCollateralItem(selectedItem.id, { requiresCopy: event.target.checked })}
                            type="checkbox"
                          />
                          <span>Requires Copy</span>
                        </label>
                        <label className="toggle collateral-drawer__toggle">
                          <input
                            checked={selectedItem.requiresApproval === true}
                            onChange={(event) => patchCollateralItem(selectedItem.id, { requiresApproval: event.target.checked })}
                            type="checkbox"
                          />
                          <span>Requires Approval</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeEditorTab === "notes" ? (
                  <div
                    aria-labelledby="collateral-editor-tab-notes"
                    className="collateral-editor-tabs__panel collateral-editor-tabs__panel--notes"
                    role="tabpanel"
                  >
                    <div className="collateral-drawer__group collateral-drawer__group--notes">
                      <div className="drawer__panel-title">Notes</div>
                      <div className="drawer__grid drawer__grid--form collateral-drawer__grid">
                        <div className="field field--wide">
                          <label htmlFor="collateral-notes">Notes</label>
                          <textarea
                            id="collateral-notes"
                            onChange={(event) => patchCollateralItem(selectedItem.id, { notes: event.target.value })}
                            placeholder="Add production context, specs, or handoff notes."
                            rows={6}
                            value={selectedItem.notes ?? ""}
                          />
                        </div>
                      </div>
                    </div>
                    <ActionItemNotesPanel
                      noteDraft={noteDraft}
                      noteEntries={selectedItem.noteEntries}
                      onAddNote={() => addNote(selectedItem)}
                      onNoteDraftChange={setNoteDraft}
                      title="Note History"
                      subtitle="Timestamped update log for this collateral item."
                    />
                  </div>
                ) : null}
              </section>
            </div>
            {isDeleteConfirmOpen ? (
              <div className="drawer__confirm-bar">
                <div className="confirm-delete">
                  <div className="confirm-delete__title">Delete this collateral item?</div>
                  <div className="confirm-delete__copy">
                    This will permanently remove it from the current event instance.
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
                        if (draftCollateralItem?.id === selectedItem.id) {
                          discardDraftCollateralItem();
                          setIsDeleteConfirmOpen(false);
                          return;
                        }

                        deleteCollateralItem(selectedItem.id);
                        setIsDeleteConfirmOpen(false);
                        setSelectedId(null);
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {draftCollateralItem?.id === selectedItem.id ? (
              <div className="drawer__confirm-bar">
                <div className="confirm-delete confirm-delete--neutral">
                  <div className="confirm-delete__title">Save this new collateral item?</div>
                  <div className="confirm-delete__copy">
                    Save keeps this new item in the current event instance. Cancel removes it.
                  </div>
                  <div className="confirm-delete__actions">
                    <button
                      className="button-link button-link--inline-secondary"
                      onClick={discardDraftCollateralItem}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="topbar__button"
                      onClick={saveDraftCollateralItem}
                      type="button"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            </section>
          </div>
        ) : null}
      </div>

      {isQuickAddOpen ? (
        <div className="modal-layer" role="presentation">
          <button
            aria-label="Close add collateral modal"
            className="modal-backdrop"
            onClick={closeQuickAddModal}
            type="button"
          />
          <section aria-labelledby="quick-add-collateral-title" aria-modal="true" className="quick-add-modal" role="dialog">
            <div className="quick-add-modal__header">
              <div>
                <h2 className="quick-add-modal__title" id="quick-add-collateral-title">
                  Add Collateral
                </h2>
                <p className="quick-add-modal__subtitle">
                  Start with the minimum. Everything else can be edited after creation.
                </p>
              </div>
            </div>
            <div className="drawer__grid drawer__grid--form">
              <div className="field field--wide">
                <label htmlFor="quick-add-collateral-name">Name</label>
                <input
                  autoFocus
                  id="quick-add-collateral-name"
                  onChange={(event) => setQuickAddName(event.target.value)}
                  placeholder="Welcome sign, master deck, table tents..."
                  value={quickAddName}
                />
              </div>
              <div className="field">
                <label htmlFor="quick-add-collateral-scope">Scope</label>
                <select
                  id="quick-add-collateral-scope"
                  onChange={(event) => setQuickAddScope(event.target.value as CollateralQuickAddScope)}
                  value={quickAddScope}
                >
                  <option value="event-wide">Event-wide</option>
                  <option value="linked">Linked to sub-event</option>
                </select>
              </div>
              {quickAddScope === "linked" ? (
                <div className="field">
                  <label htmlFor="quick-add-collateral-sub-event">Sub-Event</label>
                  <select
                    id="quick-add-collateral-sub-event"
                    onChange={(event) => setQuickAddSubEventId(event.target.value)}
                    value={quickAddSubEventId}
                  >
                    {linkedSubEventOptions.map((subEvent) => (
                      <option key={subEvent.id} value={subEvent.id}>
                        {subEvent.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </div>
            <div className="confirm-delete confirm-delete--neutral">
              <div className="confirm-delete__actions">
                <button className="button-link button-link--inline-secondary" onClick={closeQuickAddModal} type="button">
                  Cancel
                </button>
                <button
                  className="topbar__button"
                  disabled={quickAddName.trim().length === 0}
                  onClick={handleQuickAddCollateral}
                  type="button"
                >
                  Create Item
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

        {pendingDraftDiscardIntent ? (
          <div className="modal-layer" role="presentation">
            <button
              aria-label="Close draft discard prompt"
              className="modal-backdrop"
              onClick={handleCancelDraftDiscardIntent}
              type="button"
            />
            <section aria-labelledby="discard-draft-title" aria-modal="true" className="quick-add-modal" role="dialog">
              <div className="quick-add-modal__header">
                <div>
                  <h2 className="quick-add-modal__title" id="discard-draft-title">
                    Discard unsaved collateral?
                  </h2>
                  <p className="quick-add-modal__subtitle">
                    {pendingDraftDiscardIntent.type === "switch"
                      ? "Switching event context will discard the new collateral item you have not saved yet."
                      : pendingDraftDiscardIntent.type === "sponsorPromotion"
                        ? "Creating a collateral draft from sponsor work will discard the new collateral item you have not saved yet."
                        : ""}
                  </p>
                </div>
              </div>
              <div className="confirm-delete confirm-delete--neutral">
                <div className="confirm-delete__copy">
                  Save the draft first if you want to keep it in the current event instance.
                </div>
                <div className="confirm-delete__actions">
                  <button
                    className="button-link button-link--inline-secondary"
                    onClick={handleCancelDraftDiscardIntent}
                    type="button"
                  >
                    Stay Here
                  </button>
                  <button className="button-danger" onClick={handleConfirmDraftDiscardIntent} type="button">
                    Discard and Continue
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    );
}

function getCollateralRowClassName(
  item: CollateralItem,
  isSelected: boolean,
  variant: "default" | "completed" = "default"
) {
  const classNames = ["collateral-row"];

  if (isSelected) {
    classNames.push("collateral-row--selected");
  }

  if (isCollateralOverdue(item)) {
    classNames.push("collateral-row--overdue");
  } else if (isCollateralDueSoon(item)) {
    classNames.push("collateral-row--due-soon");
  }

  if (isCollateralBlocked(item)) {
    classNames.push("collateral-row--blocked");
  }

  if (normalizeCollateralWorkflowStatus(item.status) === "ready") {
    classNames.push("collateral-row--ready");
  }

  if (!item.owner.trim()) {
    classNames.push("collateral-row--unassigned");
  }

  if (variant === "completed") {
    classNames.push("collateral-row--completed");
  }

  return classNames.join(" ");
}

function getCollateralStatusClassName(item: CollateralItem) {
  const normalizedStatus = normalizeCollateralWorkflowStatus(item.status);

  if (isCollateralBlocked(item)) {
    return "collateral-status collateral-status--blocked";
  }

  if (normalizedStatus === "waiting") {
    return "collateral-status collateral-status--waiting";
  }

  if (normalizedStatus === "ready") {
    return "collateral-status collateral-status--ready";
  }

  if (item.status === "In Design" || item.status === "Sent to Printer") {
    return "collateral-status collateral-status--progress";
  }

  if (normalizedStatus === "complete" || normalizedStatus === "cut") {
    return "collateral-status collateral-status--terminal";
  }

  return "collateral-status";
}

function getCollateralDrawerDueText(item: CollateralItem) {
  if (!item.dueDate) {
    return "No due date set";
  }

  if (isCollateralOverdue(item)) {
    return `Overdue - ${formatShortDate(item.dueDate)}`;
  }

  if (isCollateralDueSoon(item)) {
    return `Due soon - ${formatShortDate(item.dueDate)}`;
  }

  return `Due ${formatShortDate(item.dueDate)}`;
}

function getCollateralScope(subEventId: string, emptySubEventId: string) {
  return subEventId === emptySubEventId ? "event-wide" : "linked";
}


