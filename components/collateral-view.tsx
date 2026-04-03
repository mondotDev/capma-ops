"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ActionItemNotesPanel } from "@/components/action-item-notes-panel";
import { useCollateralWorkspaceReadModel } from "@/components/app-read-models";
import {
  CollateralProfileCard,
  type CollateralProfileDeadlineFilter
} from "@/components/collateral-profile-card";
import {
  CollateralSummaryStrip,
  type CollateralSummaryFilter
} from "@/components/collateral-summary-strip";
import {
  useAppActions,
  useAppStateValues,
  type CreateEventInstanceInput
} from "@/components/app-state";
import {
  COLLATERAL_STATUS_OPTIONS,
  COLLATERAL_UPDATE_TYPE_OPTIONS,
  isCollateralArchived,
  isCollateralBlocked,
  isCollateralDueSoon,
  isCollateralOverdue,
  normalizeCollateralWorkflowStatus,
  type CollateralItem,
} from "@/lib/collateral-data";
import {
  getCollateralCreateTraceId,
  setCollateralCreateTraceId,
  traceCollateralCreate
} from "@/lib/collateral-create-trace";
import { getDefaultTemplatePackForEventType, supportsCollateralEventType } from "@/lib/collateral-templates";
import {
  createSuggestedEventInstanceName,
  deriveEventDateRange,
  type EventDateMode
} from "@/lib/event-instances";
import {
  createActionNoteEntry,
  formatShortDate,
  getOwnerOptions,
  LOCAL_FALLBACK_NOTE_AUTHOR
} from "@/lib/ops-utils";

type CreateInstanceFormState = {
  eventTypeId: string;
  instanceName: string;
  dateMode: EventDateMode;
  dates: string[];
  location: string;
  notes: string;
};

type PendingDraftDiscardIntent =
  | { type: "switch"; nextEventInstanceId: string }
  | { type: "createInstance" }
  | null;

type PendingCollateralOpenIntent = {
  collateralId: string;
  eventInstanceId: string;
};

const INITIAL_INSTANCE_FORM: CreateInstanceFormState = {
  eventTypeId: "legislative-day",
  instanceName: "Legislative Day 2027",
  dateMode: "range",
  dates: ["", ""],
  location: "",
  notes: ""
};

const DRAFT_COLLATERAL_ID = "__draft-collateral__";

export function CollateralView({
  initialEventInstanceId,
  initialSelectedCollateralId
}: {
  initialEventInstanceId?: string;
  initialSelectedCollateralId?: string;
}) {
  const { defaultOwnerForNewItems } = useAppStateValues();
  const {
    addCollateralItem,
    applyDefaultTemplateToInstance,
    createEventInstance,
    deleteCollateralItem,
    ensureEventInstanceUnassignedSubEvent,
    setActiveEventInstanceId,
    setCollateralProfile,
    updateCollateralItem
  } = useAppActions();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreateInstanceOpen, setIsCreateInstanceOpen] = useState(false);
  const [pendingTemplateInstanceId, setPendingTemplateInstanceId] = useState<string | null>(null);
  const [instanceFormState, setInstanceFormState] = useState<CreateInstanceFormState>(INITIAL_INSTANCE_FORM);
  const [hasEditedInstanceName, setHasEditedInstanceName] = useState(false);
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
  const [pendingOpenIntent, setPendingOpenIntent] = useState<PendingCollateralOpenIntent>(() => ({
    collateralId: initialSelectedCollateralId ?? searchParams.get("collateralId") ?? "",
    eventInstanceId: initialEventInstanceId ?? searchParams.get("eventInstanceId") ?? ""
  }));
  const {
    workspaceBundle,
    collateralListView,
    selectedWorkspace,
    eventPrograms,
    eventInstances
  } = useCollateralWorkspaceReadModel({
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
  const supportedCreateEventPrograms = workspaceBundle.supportedCreateEventPrograms;
  const isSelectedCreateEventProgramSupported = supportsCollateralEventType(instanceFormState.eventTypeId);
  const isSelectedEventProgramSupported = workspaceBundle.isSelectedEventProgramSupported;
  const activeProfile = workspaceBundle.activeProfile;

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
    if (!pendingOpenIntent.eventInstanceId) {
      return;
    }

    if (draftCollateralItem) {
      return;
    }

    if (pendingOpenIntent.eventInstanceId !== resolvedActiveEventInstanceId) {
      setActiveEventInstanceId(pendingOpenIntent.eventInstanceId);
      return;
    }

    setPendingOpenIntent((current) => ({ ...current, eventInstanceId: "" }));
  }, [
    draftCollateralItem,
    pendingOpenIntent.eventInstanceId,
    resolvedActiveEventInstanceId,
    setActiveEventInstanceId
  ]);

  useEffect(() => {
    if (hasEditedInstanceName) {
      return;
    }

    const selectedEventProgram =
      eventPrograms.find((eventProgram) => eventProgram.id === instanceFormState.eventTypeId) ??
      supportedCreateEventPrograms[0] ??
      eventPrograms[0] ??
      null;

    if (!selectedEventProgram) {
      return;
    }

    setInstanceFormState((current) => ({
        ...current,
        instanceName: createSuggestedEventInstanceName(
          selectedEventProgram.name,
          current.dateMode,
          current.dates,
          current.location
        )
      }));
  }, [
    eventPrograms,
    hasEditedInstanceName,
    instanceFormState.dateMode,
    instanceFormState.dates,
    instanceFormState.eventTypeId,
    instanceFormState.location,
    supportedCreateEventPrograms
  ]);

  useEffect(() => {
    if (instanceFormState.eventTypeId && supportsCollateralEventType(instanceFormState.eventTypeId)) {
      return;
    }

    const fallbackEventProgram = supportedCreateEventPrograms[0];
    if (!fallbackEventProgram || fallbackEventProgram.id === instanceFormState.eventTypeId) {
      return;
    }

    setInstanceFormState((current) => ({
      ...current,
      eventTypeId: fallbackEventProgram.id
    }));
  }, [instanceFormState.eventTypeId, supportedCreateEventPrograms]);

  const instanceSubEvents = workspaceBundle.instanceSubEvents;
  const instanceItems = collateralListView.instanceItems;
  const visibleInstanceItems = collateralListView.visibleInstanceItems;
  const groupedItems = collateralListView.groupedItems;
  const summary = collateralListView.summary;
  const selectedItem = selectedWorkspace.selectedItem;
  const subEventNameById = selectedWorkspace.subEventNameById;
  const selectedSubEventOptions = selectedWorkspace.subEventOptions;
  const emptySubEventId = selectedWorkspace.emptySubEventId;
  const selectedEventDateRange = workspaceBundle.selectedEventDateRange;

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
    const traceId = getCollateralCreateTraceId();

    if (!traceId) {
      return;
    }

    const renderedItem = groupedItems.flatMap(([, items]) => items).find((item) => item.id === traceId) ?? null;

    traceCollateralCreate("collateral-view-render", {
      traceId,
      activeEventInstanceId: resolvedActiveEventInstanceId,
      activeSummaryFilter,
      activeProfileDeadlineFilter,
      showArchived,
      selectedId,
      instanceItemIds: instanceItems.map((item) => item.id),
      visibleItemIds: visibleInstanceItems.map((item) => item.id),
      groupedSections: groupedItems.map(([subEvent, items]) => ({
        subEvent,
        itemIds: items.map((item) => item.id)
      })),
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
    groupedItems,
    instanceItems,
    resolvedActiveEventInstanceId,
    selectedId,
    showArchived,
    visibleInstanceItems
  ]);

  const eventInstancesByProgram = workspaceBundle.eventInstancesByProgram;
  const pendingTemplateInstance =
    pendingTemplateInstanceId
      ? eventInstances.find((instance) => instance.id === pendingTemplateInstanceId) ?? null
      : null;
  const hasAppliedTemplateItems = workspaceBundle.hasAppliedTemplateItems;
  const hasActiveCollateralFilters =
    activeSummaryFilter !== "all" || activeProfileDeadlineFilter !== "none" || showArchived;
  const hasUnsavedDraftCollateral = Boolean(draftCollateralItem);
  const activeFilterLabel = getCollateralSummaryFilterLabel(activeSummaryFilter);
  const activeProfileFilterLabel = getCollateralProfileDeadlineFilterLabel(activeProfileDeadlineFilter);

  function handleAddCollateralItem() {
    if (draftCollateralItem && draftCollateralItem.eventInstanceId === resolvedActiveEventInstanceId) {
      setSelectedId(draftCollateralItem.id);
      traceCollateralCreate("draft-reselected", {
        id: draftCollateralItem.id,
        eventInstanceId: draftCollateralItem.eventInstanceId,
        subEventId: draftCollateralItem.subEventId,
        status: draftCollateralItem.status,
        archivedAt: draftCollateralItem.archivedAt,
        activeEventInstanceId: resolvedActiveEventInstanceId
      });
      return;
    }

    const fallbackSubEventId = ensureEventInstanceUnassignedSubEvent(resolvedActiveEventInstanceId);
    const nextDraft = {
      id: DRAFT_COLLATERAL_ID,
      eventInstanceId: resolvedActiveEventInstanceId,
      subEventId: fallbackSubEventId,
      itemName: "New collateral item",
      status: "Backlog",
      owner: defaultOwnerForNewItems,
      blockedBy: "",
      dueDate: "",
      printer: "",
      quantity: "",
      updateType: "",
      noteEntries: [],
      lastUpdated: new Date().toISOString().slice(0, 10)
    } satisfies CollateralItem;
    setDraftCollateralItem(nextDraft);
    setSelectedId(DRAFT_COLLATERAL_ID);
    setCollateralCreateTraceId(null);
    traceCollateralCreate("draft-created", {
      id: nextDraft.id,
      eventInstanceId: nextDraft.eventInstanceId,
      subEventId: nextDraft.subEventId,
      status: nextDraft.status,
      archivedAt: undefined,
      activeEventInstanceId: resolvedActiveEventInstanceId,
      activeSummaryFilter,
      activeProfileDeadlineFilter,
      showArchived
    });
  }

  function toggleSummaryFilter(nextFilter: CollateralSummaryFilter) {
    setActiveSummaryFilter((current) => (current === nextFilter ? "all" : nextFilter));
  }

  function toggleProfileDeadlineFilter(nextFilter: CollateralProfileDeadlineFilter) {
    setActiveProfileDeadlineFilter((current) => (current === nextFilter ? "none" : nextFilter));
  }

  function openCreateInstanceModal() {
    setHasEditedInstanceName(false);
    setInstanceFormState(INITIAL_INSTANCE_FORM);
    setSetupFeedback("");
    setIsCreateInstanceOpen(true);
  }

  function closeCreateInstanceModal() {
    setIsCreateInstanceOpen(false);
    setHasEditedInstanceName(false);
  }

  function completeCreateInstance() {
    const normalizedDates = instanceFormState.dates.filter((date) => date.length > 0);

    if (
      !instanceFormState.eventTypeId ||
      !isSelectedCreateEventProgramSupported ||
      !instanceFormState.instanceName.trim() ||
      normalizedDates.length === 0
    ) {
      return;
    }

    const nextId = createEventInstance({
      eventTypeId: instanceFormState.eventTypeId,
      instanceName: instanceFormState.instanceName.trim(),
      dateMode: instanceFormState.dateMode,
      dates: normalizedDates,
      location: instanceFormState.location.trim(),
      notes: instanceFormState.notes.trim()
    } satisfies CreateEventInstanceInput);

    setSelectedId(null);
    closeCreateInstanceModal();
    setSetupFeedback(`${instanceFormState.instanceName.trim()} created. Choose whether to start with the default template or an empty instance.`);

    if (getDefaultTemplatePackForEventType(instanceFormState.eventTypeId)) {
      setPendingTemplateInstanceId(nextId);
    } else {
      setSetupFeedback(`${instanceFormState.instanceName.trim()} created and set as the active event instance.`);
    }
  }

  function handleCreateInstance() {
    if (hasUnsavedDraftCollateral) {
      setPendingDraftDiscardIntent({ type: "createInstance" });
      return;
    }

    completeCreateInstance();
  }

  function handleConfirmTemplateApply() {
    if (!pendingTemplateInstanceId) {
      return;
    }

    applyDefaultTemplateToInstance(pendingTemplateInstanceId);
    setSetupFeedback(`${pendingTemplateInstance?.name ?? "Event instance"} is ready with its default template applied.`);
    setPendingTemplateInstanceId(null);
  }

  function handleSkipTemplateApply() {
    setSetupFeedback(`${pendingTemplateInstance?.name ?? "Event instance"} is active and ready to start empty.`);
    setPendingTemplateInstanceId(null);
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

  function requestEventInstanceSwitch(nextEventInstanceId: string) {
    if (nextEventInstanceId === resolvedActiveEventInstanceId) {
      return;
    }

    if (hasUnsavedDraftCollateral) {
      setPendingDraftDiscardIntent({ type: "switch", nextEventInstanceId });
      return;
    }

    setActiveEventInstanceId(nextEventInstanceId);
    setSelectedId(null);
  }

  function handleCancelDraftDiscardIntent() {
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
      setActiveEventInstanceId(intent.nextEventInstanceId);
      return;
    }

    completeCreateInstance();
  }

  return (
    <section className="collateral-page">
      <div className="collateral-page__header">
        <div>
          <h1 className="collateral-page__title">{selectedEventInstance?.name ?? "Collateral"}</h1>
          <p className="collateral-page__subtitle">
            {selectedEventDateRange
              ? `${selectedEventDateRange} - production tracking for signage, print pieces, decks, and event materials.`
              : "Production tracking for signage, print pieces, decks, and event materials."}
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
              {eventInstancesByProgram.map(({ eventProgram, instances }) => (
                <optgroup key={eventProgram.id} label={eventProgram.name}>
                  {instances.map((instance) => (
                    <option key={instance.id} value={instance.id}>
                      {supportsCollateralEventType(instance.eventTypeId) ? instance.name : `${instance.name} (Limited)`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <button className="button-link button-link--inline-secondary" onClick={openCreateInstanceModal} type="button">
            New Event Instance
          </button>
          <button
            className="topbar__button"
            disabled={!isSelectedEventProgramSupported}
            onClick={handleAddCollateralItem}
            type="button"
          >
            + Add Collateral
          </button>
        </div>
      </div>

      {selectedEventInstance ? (
        <div className="collateral-context card card--secondary">
          <div className="collateral-context__primary">
            <div className="collateral-context__label">Current Event Context</div>
            <div className="collateral-context__title-row">
              <strong className="collateral-context__title">{selectedEventInstance.name}</strong>
              {currentEventProgram ? <span className="collateral-context__chip">{currentEventProgram.name}</span> : null}
            </div>
          </div>
          <div className="collateral-context__meta">
            {selectedEventDateRange ? <span>{selectedEventDateRange}</span> : null}
            {selectedEventInstance.location ? <span>{selectedEventInstance.location}</span> : null}
            {defaultTemplatePack ? (
              <span>{hasAppliedTemplateItems ? "Default template applied" : "Default template available"}</span>
            ) : (
              <span>Collateral workflow not configured for this event program yet</span>
            )}
          </div>
        </div>
      ) : null}

      {selectedEventInstance && !isSelectedEventProgramSupported ? (
        <div className="collateral-setup-banner collateral-setup-banner--warning" role="status">
          <span>
            This event instance is visible for context, but collateral workflows are not configured for this event program yet.
          </span>
        </div>
      ) : null}

      {setupFeedback ? (
        <div className="collateral-setup-banner" role="status">
          <span>{setupFeedback}</span>
          <button className="button-link button-link--inline-secondary" onClick={() => setSetupFeedback("")} type="button">
            Dismiss
          </button>
        </div>
      ) : null}

      <CollateralSummaryStrip
        activeSummaryFilter={activeSummaryFilter}
        onToggleSummaryFilter={toggleSummaryFilter}
        summary={summary}
      />

      <div className="collateral-layout">
        <div className="collateral-main">
          {selectedEventInstance?.eventTypeId === "legislative-day" && activeProfile ? (
            <CollateralProfileCard
              activeProfileDeadlineFilter={activeProfileDeadlineFilter}
              onProfileChange={(updates) =>
                setCollateralProfile(resolvedActiveEventInstanceId, {
                  ...activeProfile,
                  ...updates
                })
              }
              onToggleProfileDeadlineFilter={toggleProfileDeadlineFilter}
              profile={activeProfile}
            />
          ) : null}

          <div className="card card--secondary collateral-groups">
            <div className="card__title">
              COLLATERAL ITEMS
              {currentEventProgram ? <span className="collateral-card-context"> - {currentEventProgram.name}</span> : null}
            </div>
            <div className="collateral-group-toolbar">
              <label className="toggle">
                <input
                  checked={showArchived}
                  onChange={(event) => setShowArchived(event.target.checked)}
                  type="checkbox"
                />
                <span>Show Completed/Cut</span>
              </label>
            </div>
            {hasActiveCollateralFilters ? (
              <div className="collateral-filter-context">
                <span>
                  Showing:{" "}
                  {[
                    activeSummaryFilter !== "all" ? activeFilterLabel : null,
                    showArchived ? "Including completed/cut history" : null,
                    activeProfileDeadlineFilter !== "none"
                      ? `Due by ${activeProfileFilterLabel}`
                      : null
                  ]
                    .filter(Boolean)
                    .join(" • ")}
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
            {groupedItems.length === 0 ? (
              <div className="empty-state empty-state--actionable">
                <div className="empty-state__title">
                  {hasActiveCollateralFilters ? "No items match this view." : "This event instance is empty."}
                </div>
                <div className="empty-state__copy">
                  {!hasActiveCollateralFilters
                    ? !isSelectedEventProgramSupported
                      ? "Collateral tracking is not enabled for this event program yet."
                      : defaultTemplatePack
                        ? `Apply the default template pack for ${currentEventProgram?.name ?? "this event"} or add your first collateral item manually.`
                        : "Add your first collateral item manually to start tracking production work for this event instance."
                    : "Try a different summary view, show completed/cut items, or clear the filter to return to the active collateral list."}
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
                  {!hasActiveCollateralFilters && isSelectedEventProgramSupported ? (
                    <button className="button-link button-link--inline-secondary" onClick={handleAddCollateralItem} type="button">
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
              groupedItems.map(([subEvent, items]) => (
                <section className="collateral-group" key={subEvent}>
                  <div className="collateral-group__header">
                    <h2 className="collateral-group__title">{subEvent}</h2>
                    <span className="collateral-group__count">{items.length}</span>
                  </div>
                  <div className="collateral-list">
                    {items.map((item) => {
                      const isSelected = item.id === selectedId;

                      return (
                        <button
                          className={getCollateralRowClassName(item, isSelected)}
                          key={item.id}
                          onClick={() => setSelectedId(item.id)}
                          type="button"
                        >
                          <div className="collateral-row__main">
                            <div className="collateral-row__title">{item.itemName}</div>
                            <div className="collateral-row__meta">
                              {item.owner ? (
                                <span>{item.owner}</span>
                              ) : (
                                <span className="collateral-row__meta-flag collateral-row__meta-flag--unassigned">
                                  No owner assigned
                                </span>
                              )}
                              <span>{item.dueDate ? formatShortDate(item.dueDate) : "No due date"}</span>
                              {item.blockedBy ? (
                                <span className="collateral-row__meta-flag collateral-row__meta-flag--blocked">
                                  Blocked by {item.blockedBy}
                                </span>
                              ) : null}
                              <span>{item.printer || "No printer assigned"}</span>
                              {item.quantity ? <span>Qty {item.quantity}</span> : null}
                            </div>
                          </div>
                          <div className="collateral-row__signals">
                            <span className={getCollateralStatusClassName(item)}>{item.status}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>

        {selectedItem ? (
          <aside className="drawer drawer--collateral" aria-label="Collateral details">
            <div className="drawer__sticky">
            <div className="drawer__header">
              <div className="drawer__header-text">
                <div className="collateral-drawer__eyebrow">Collateral item</div>
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
                    {subEventNameById.get(selectedItem.subEventId) ?? "Unassigned sub-event"}
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
                <button className="button-link" onClick={() => setSelectedId(null)} type="button">
                  Close
                </button>
              </div>
            </div>
            </div>

            <div className="drawer__sections">
              <section className="drawer-section drawer-section--form collateral-drawer">
                <div className="collateral-drawer__group">
                  <div className="drawer__panel-title">Identity</div>
                  <div className="drawer__grid drawer__grid--form collateral-drawer__grid">
                    <div className="field field--secondary">
                      <label htmlFor="collateral-sub-event">Sub-Event</label>
                      <select
                        id="collateral-sub-event"
                        onChange={(event) => patchCollateralItem(selectedItem.id, { subEventId: event.target.value })}
                        value={selectedItem.subEventId}
                      >
                        {selectedSubEventOptions.length === 0 ? (
                          <option value={emptySubEventId}>Unassigned</option>
                        ) : null}
                        {selectedSubEventOptions.map((subEvent) => (
                          <option key={subEvent.id} value={subEvent.id}>
                            {subEvent.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field field--priority">
                      <label htmlFor="collateral-status">Status</label>
                      <select
                        id="collateral-status"
                        onChange={(event) =>
                          patchCollateralItem(selectedItem.id, {
                            status: event.target.value as CollateralItem["status"]
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
                  </div>
                </div>

                <div className="collateral-drawer__group">
                  <div className="drawer__panel-title">Execution</div>
                  <div className="drawer__grid drawer__grid--form">
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
                    <div className="field field--wide collateral-drawer__blocked-field">
                      <label htmlFor="collateral-blocked-by">Blocked By</label>
                      <input
                        id="collateral-blocked-by"
                        onChange={(event) => patchCollateralItem(selectedItem.id, { blockedBy: event.target.value })}
                        placeholder="Optional blocker"
                        value={selectedItem.blockedBy}
                      />
                    </div>
                  </div>
                </div>

                <div className="collateral-drawer__group">
                  <div className="drawer__panel-title">Production</div>
                  <div className="drawer__grid drawer__grid--form">
                    <div className="field">
                      <label htmlFor="collateral-printer">Printer</label>
                      <input
                        id="collateral-printer"
                        onChange={(event) => patchCollateralItem(selectedItem.id, { printer: event.target.value })}
                        value={selectedItem.printer}
                      />
                    </div>
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
                  </div>
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
          </aside>
        ) : null}
      </div>

      {isCreateInstanceOpen ? (
        <div className="modal-layer" role="presentation">
          <button aria-label="Close create event instance" className="modal-backdrop" onClick={closeCreateInstanceModal} type="button" />
          <section aria-labelledby="create-instance-title" aria-modal="true" className="quick-add-modal" role="dialog">
            <div className="quick-add-modal__header">
              <div>
                <h2 className="quick-add-modal__title" id="create-instance-title">
                  New Event Instance
                </h2>
                <p className="quick-add-modal__subtitle">Step 1 of setup: create the event instance. If a default template exists, you can apply it immediately after this step.</p>
              </div>
              <button className="button-link" onClick={closeCreateInstanceModal} type="button">
                Close
              </button>
            </div>

            <div className="quick-add-form">
              <div className="quick-add-grid">
                <div className="field">
                  <label htmlFor="instance-event-type">Event Program</label>
                    <select
                      className="field-control"
                      id="instance-event-type"
                    onChange={(event) =>
                      setInstanceFormState((current) => ({
                        ...current,
                        eventTypeId: event.target.value
                      }))
                      }
                      value={instanceFormState.eventTypeId}
                    >
                      {eventPrograms.map((eventProgram) => (
                        <option
                          disabled={!supportsCollateralEventType(eventProgram.id)}
                          key={eventProgram.id}
                          value={eventProgram.id}
                        >
                          {supportsCollateralEventType(eventProgram.id) ? eventProgram.name : `${eventProgram.name} (Coming Soon)`}
                        </option>
                      ))}
                    </select>
                    <div className="field__hint">
                      Only event programs with a default collateral template can be created here right now.
                    </div>
                  </div>
                <div className="field">
                  <label htmlFor="instance-name">Instance Name</label>
                  <input
                    className="field-control"
                    id="instance-name"
                    onChange={(event) => {
                      setHasEditedInstanceName(true);
                      setInstanceFormState((current) => ({ ...current, instanceName: event.target.value }));
                    }}
                    value={instanceFormState.instanceName}
                  />
                </div>
                <div className="field">
                  <label htmlFor="instance-date-mode">Date Mode</label>
                  <select
                    className="field-control"
                    id="instance-date-mode"
                    onChange={(event) =>
                      setInstanceFormState((current) => ({
                        ...current,
                        dateMode: event.target.value as EventDateMode,
                        dates:
                          event.target.value === "multiple"
                            ? current.dates.length > 0
                              ? current.dates
                              : [""]
                            : current.dates.length >= 2
                              ? [current.dates[0] ?? "", current.dates[1] ?? ""]
                              : current.dates.length === 1
                                ? [current.dates[0], current.dates[0]]
                                : ["", ""]
                      }))
                    }
                    value={instanceFormState.dateMode}
                  >
                    <option value="single">Single day</option>
                    <option value="range">Date range</option>
                    <option value="multiple">Multiple dates</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="instance-location">Location</label>
                  <input
                    className="field-control"
                    id="instance-location"
                    onChange={(event) =>
                      setInstanceFormState((current) => ({ ...current, location: event.target.value }))
                    }
                    placeholder="Optional"
                    value={instanceFormState.location}
                  />
                </div>
                {instanceFormState.dateMode === "single" ? (
                  <div className="field">
                    <label htmlFor="instance-single-date">Date</label>
                    <input
                      className="field-control"
                      id="instance-single-date"
                      onChange={(event) =>
                        setInstanceFormState((current) => ({ ...current, dates: [event.target.value] }))
                      }
                      type="date"
                      value={instanceFormState.dates[0] ?? ""}
                    />
                  </div>
                ) : null}
                {instanceFormState.dateMode === "range" ? (
                  <div className="field field--wide collateral-instance-range">
                    <div className="field">
                      <label htmlFor="instance-range-start">Start Date</label>
                      <input
                        className="field-control"
                        id="instance-range-start"
                        onChange={(event) =>
                          setInstanceFormState((current) => ({
                            ...current,
                            dates: [event.target.value, current.dates[1] ?? ""]
                          }))
                        }
                        type="date"
                        value={instanceFormState.dates[0] ?? ""}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="instance-range-end">End Date</label>
                      <input
                        className="field-control"
                        id="instance-range-end"
                        onChange={(event) =>
                          setInstanceFormState((current) => ({
                            ...current,
                            dates: [current.dates[0] ?? "", event.target.value]
                          }))
                        }
                        type="date"
                        value={instanceFormState.dates[1] ?? ""}
                      />
                    </div>
                  </div>
                ) : null}
                {instanceFormState.dateMode === "multiple" ? (
                  <div className="field field--wide">
                    <label>Dates</label>
                    <div className="collateral-instance-multiple">
                      {instanceFormState.dates.map((date, index) => (
                        <div className="collateral-instance-multiple__row" key={`instance-date-${index}`}>
                          <input
                            className="field-control"
                            onChange={(event) =>
                              setInstanceFormState((current) => ({
                                ...current,
                                dates: current.dates.map((entry, entryIndex) =>
                                  entryIndex === index ? event.target.value : entry
                                )
                              }))
                            }
                            type="date"
                            value={date}
                          />
                          <button
                            className="button-link button-link--inline-secondary"
                            onClick={() =>
                              setInstanceFormState((current) => ({
                                ...current,
                                dates:
                                  current.dates.length > 1
                                    ? current.dates.filter((_, entryIndex) => entryIndex !== index)
                                    : [""]
                              }))
                            }
                            type="button"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        className="button-link button-link--inline-secondary"
                        onClick={() =>
                          setInstanceFormState((current) => ({
                            ...current,
                            dates: [...current.dates, ""]
                          }))
                        }
                        type="button"
                      >
                        Add Date
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="field field--wide">
                  <label htmlFor="instance-notes">Notes</label>
                  <textarea
                    className="field-control"
                    id="instance-notes"
                    onChange={(event) =>
                      setInstanceFormState((current) => ({ ...current, notes: event.target.value }))
                    }
                    rows={3}
                    value={instanceFormState.notes}
                  />
                </div>
              </div>
              <div className="quick-add-actions">
                <button className="button-link button-link--inline-secondary" onClick={closeCreateInstanceModal} type="button">
                  Cancel
                </button>
                  <button
                    className="topbar__button"
                    disabled={!isInstanceFormValid(instanceFormState) || !isSelectedCreateEventProgramSupported}
                    onClick={handleCreateInstance}
                    type="button"
                  >
                  Create and Continue
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

        {pendingTemplateInstance ? (
          <div className="modal-layer" role="presentation">
          <button aria-label="Close template prompt" className="modal-backdrop" onClick={handleSkipTemplateApply} type="button" />
          <section aria-labelledby="apply-template-title" aria-modal="true" className="quick-add-modal" role="dialog">
            <div className="quick-add-modal__header">
              <div>
                <h2 className="quick-add-modal__title" id="apply-template-title">
                  Apply template?
                </h2>
                <p className="quick-add-modal__subtitle">
                  Step 2 of setup: {pendingTemplateInstance.name} is ready. Apply its default collateral template now, or start from an empty instance.
                </p>
              </div>
            </div>
            <div className="confirm-delete">
              <div className="confirm-delete__actions">
                <button className="button-link button-link--inline-secondary" onClick={handleSkipTemplateApply} type="button">
                  Start Empty
                </button>
                <button className="topbar__button" onClick={handleConfirmTemplateApply} type="button">
                  Apply Default Template
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
                      : "Creating a new event instance will switch context and discard the new collateral item you have not saved yet."}
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

function isInstanceFormValid(formState: CreateInstanceFormState) {
  const { startDate, endDate } = deriveEventDateRange(formState.dateMode, formState.dates);

  return (
    formState.eventTypeId.length > 0 &&
    formState.instanceName.trim().length > 0 &&
    startDate.length > 0 &&
    endDate.length > 0
  );
}

function getCollateralRowClassName(item: CollateralItem, isSelected: boolean) {
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

function getCollateralSummaryFilterLabel(filter: CollateralSummaryFilter) {
  if (filter === "active") {
    return "Active";
  }

  if (filter === "needsAttention") {
    return "Needs Attention";
  }

  if (filter === "atPrinter") {
    return "At Printer";
  }

  if (filter === "readyForPrint") {
    return "Ready for Print";
  }

  return "All";
}

function getCollateralProfileDeadlineFilterLabel(filter: CollateralProfileDeadlineFilter) {
  if (filter === "logoDeadline") {
    return "Logo Deadline";
  }

  if (filter === "externalPrintingDue") {
    return "External Printing Due";
  }

  if (filter === "internalPrintingStart") {
    return "Start Internal Printing";
  }

  return "";
}
