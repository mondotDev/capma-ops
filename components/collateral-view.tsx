"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionItemNotesPanel } from "@/components/action-item-notes-panel";
import {
  CollateralProfileCard,
  type CollateralProfileDeadlineFilter
} from "@/components/collateral-profile-card";
import {
  CollateralSummaryStrip,
  type CollateralSummaryFilter
} from "@/components/collateral-summary-strip";
import { useAppState, type CreateEventInstanceInput } from "@/components/app-state";
import {
  COLLATERAL_STATUS_OPTIONS,
  COLLATERAL_UPDATE_TYPE_OPTIONS,
  isCollateralDueSoon,
  isCollateralOverdue,
  isCollateralTerminalStatus,
  normalizeCollateralWorkflowStatus,
  type CollateralItem,
  type LegDayCollateralProfile
} from "@/lib/collateral-data";
import { getDefaultTemplatePackForEventType } from "@/lib/collateral-templates";
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

const INITIAL_INSTANCE_FORM: CreateInstanceFormState = {
  eventTypeId: "legislative-day",
  instanceName: "Legislative Day 2027",
  dateMode: "range",
  dates: ["", ""],
  location: "",
  notes: ""
};

const DRAFT_COLLATERAL_ID = "__draft-collateral__";

export function CollateralView() {
  const {
    activeEventInstanceId,
    addCollateralItem,
    applyDefaultTemplateToInstance,
    collateralItems,
    collateralProfiles,
    createEventInstance,
    defaultOwnerForNewItems,
    deleteCollateralItem,
    eventInstances,
    eventSubEvents,
    eventTypes,
    setActiveEventInstanceId,
    setCollateralProfile,
    updateCollateralItem
  } = useAppState();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreateInstanceOpen, setIsCreateInstanceOpen] = useState(false);
  const [pendingTemplateInstanceId, setPendingTemplateInstanceId] = useState<string | null>(null);
  const [instanceFormState, setInstanceFormState] = useState<CreateInstanceFormState>(INITIAL_INSTANCE_FORM);
  const [hasEditedInstanceName, setHasEditedInstanceName] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [draftCollateralItem, setDraftCollateralItem] = useState<CollateralItem | null>(null);
  const [setupFeedback, setSetupFeedback] = useState<string>("");
  const [noteDraft, setNoteDraft] = useState("");
  const [activeSummaryFilter, setActiveSummaryFilter] = useState<CollateralSummaryFilter>("all");
  const [activeProfileDeadlineFilter, setActiveProfileDeadlineFilter] =
    useState<CollateralProfileDeadlineFilter>("none");
  const selectedEventInstance =
    eventInstances.find((instance) => instance.id === activeEventInstanceId) ?? eventInstances[0] ?? null;
  const currentEventType =
    eventTypes.find((eventType) => eventType.id === selectedEventInstance?.eventTypeId) ?? null;
  const defaultTemplatePack = selectedEventInstance
    ? getDefaultTemplatePackForEventType(selectedEventInstance.eventTypeId)
    : null;
  const activeProfile =
    collateralProfiles[activeEventInstanceId] ??
    (selectedEventInstance?.eventTypeId === "legislative-day" ? getDefaultLegDayProfile(selectedEventInstance) : null);

  useEffect(() => {
    if (!selectedEventInstance && eventInstances[0]) {
      setActiveEventInstanceId(eventInstances[0].id);
    }
  }, [eventInstances, selectedEventInstance, setActiveEventInstanceId]);

  useEffect(() => {
    setIsActionsMenuOpen(false);
    setIsDeleteConfirmOpen(false);
  }, [selectedId, activeEventInstanceId]);

  useEffect(() => {
    setActiveSummaryFilter("all");
    setActiveProfileDeadlineFilter("none");
  }, [activeEventInstanceId]);

  useEffect(() => {
    setNoteDraft("");
  }, [selectedId]);

  useEffect(() => {
    setDraftCollateralItem((current) =>
      current && current.eventInstanceId !== activeEventInstanceId ? null : current
    );
  }, [activeEventInstanceId]);

  useEffect(() => {
    if (hasEditedInstanceName) {
      return;
    }

    const selectedEventType =
      eventTypes.find((eventType) => eventType.id === instanceFormState.eventTypeId) ?? eventTypes[0] ?? null;

    if (!selectedEventType) {
      return;
    }

    setInstanceFormState((current) => ({
      ...current,
      instanceName: createSuggestedEventInstanceName(
        selectedEventType.name,
        current.dateMode,
        current.dates,
        current.location
      )
    }));
  }, [eventTypes, hasEditedInstanceName, instanceFormState.dateMode, instanceFormState.dates, instanceFormState.eventTypeId, instanceFormState.location]);

  const instanceSubEvents = useMemo(
    () => eventSubEvents.filter((subEvent) => subEvent.eventInstanceId === activeEventInstanceId),
    [activeEventInstanceId, eventSubEvents]
  );
  const instanceItems = useMemo(
    () => collateralItems.filter((item) => item.eventInstanceId === activeEventInstanceId),
    [activeEventInstanceId, collateralItems]
  );
  const visibleInstanceItems = useMemo(() => {
    if (!draftCollateralItem || draftCollateralItem.eventInstanceId !== activeEventInstanceId) {
      return instanceItems;
    }

    return [draftCollateralItem, ...instanceItems];
  }, [activeEventInstanceId, draftCollateralItem, instanceItems]);
  const subEventNameById = useMemo(
    () => new Map(instanceSubEvents.map((subEvent) => [subEvent.id, subEvent.name])),
    [instanceSubEvents]
  );
  const activeItems = useMemo(
    () => instanceItems.filter((item) => !isCollateralTerminalStatus(item.status)),
    [instanceItems]
  );
  const filteredVisibleItems = useMemo(
    () =>
      visibleInstanceItems.filter((item) =>
        matchesCollateralSummaryFilter(item, activeSummaryFilter) &&
        matchesCollateralProfileDeadlineFilter(item, activeProfile, activeProfileDeadlineFilter)
      ),
    [activeProfile, activeProfileDeadlineFilter, activeSummaryFilter, visibleInstanceItems]
  );
  const groupedItems = useMemo(
    () => groupCollateralItems(filteredVisibleItems, instanceSubEvents, subEventNameById),
    [filteredVisibleItems, instanceSubEvents, subEventNameById]
  );
  const selectedItem = visibleInstanceItems.find((item) => item.id === selectedId) ?? null;
  const selectedEventDateRange =
    selectedEventInstance && selectedEventInstance.startDate && selectedEventInstance.endDate
      ? selectedEventInstance.startDate === selectedEventInstance.endDate
        ? formatShortDate(selectedEventInstance.startDate)
        : `${formatShortDate(selectedEventInstance.startDate)} - ${formatShortDate(selectedEventInstance.endDate)}`
      : "";
  const summary = useMemo(
    () => ({
      active: activeItems.length,
      needsAttention: activeItems.filter(
        (item) => item.status === "Blocked" || (isCollateralOverdue(item) && item.status !== "Sent to Printer")
      ).length,
      atPrinter: activeItems.filter((item) => item.status === "Sent to Printer").length,
      atPrinterQuantity: activeItems.reduce((total, item) => {
        if (item.status !== "Sent to Printer") {
          return total;
        }

        const parsedQuantity = Number.parseInt(item.quantity, 10);
        return Number.isFinite(parsedQuantity) ? total + parsedQuantity : total;
      }, 0),
      readyForPrint: activeItems.filter((item) => item.status === "Ready for Print").length
    }),
    [activeItems]
  );
  const eventInstancesByType = useMemo(() => {
    const instancesByType = new Map<string, typeof eventInstances>();

    for (const instance of [...eventInstances].sort((a, b) => a.startDate.localeCompare(b.startDate))) {
      if (!instancesByType.has(instance.eventTypeId)) {
        instancesByType.set(instance.eventTypeId, []);
      }

      instancesByType.get(instance.eventTypeId)!.push(instance);
    }

    return eventTypes
      .map((eventType) => ({
        eventType,
        instances: instancesByType.get(eventType.id) ?? []
      }))
      .filter((group) => group.instances.length > 0);
  }, [eventInstances, eventTypes]);
  const pendingTemplateInstance =
    pendingTemplateInstanceId
      ? eventInstances.find((instance) => instance.id === pendingTemplateInstanceId) ?? null
      : null;
  const hasAppliedTemplateItems = instanceItems.some((item) => Boolean(item.templateOriginId));
  const activeFilterLabel = getCollateralSummaryFilterLabel(activeSummaryFilter);
  const activeProfileFilterLabel = getCollateralProfileDeadlineFilterLabel(activeProfileDeadlineFilter);

  function handleAddCollateralItem() {
    if (draftCollateralItem && draftCollateralItem.eventInstanceId === activeEventInstanceId) {
      setSelectedId(draftCollateralItem.id);
      return;
    }

    const fallbackSubEventId = instanceSubEvents[0]?.id ?? "__unassigned__";
    setDraftCollateralItem({
      id: DRAFT_COLLATERAL_ID,
      eventInstanceId: activeEventInstanceId,
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
    });
    setSelectedId(DRAFT_COLLATERAL_ID);
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

  function handleCreateInstance() {
    const normalizedDates = instanceFormState.dates.filter((date) => date.length > 0);

    if (!instanceFormState.eventTypeId || !instanceFormState.instanceName.trim() || normalizedDates.length === 0) {
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
    setSelectedId(nextId);
  }

  function clearCollateralFilters() {
    setActiveSummaryFilter("all");
    setActiveProfileDeadlineFilter("none");
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
              onChange={(event) => {
                setActiveEventInstanceId(event.target.value);
                setSelectedId(null);
              }}
              value={activeEventInstanceId}
            >
              {eventInstancesByType.map(({ eventType, instances }) => (
                <optgroup key={eventType.id} label={eventType.name}>
                  {instances.map((instance) => (
                    <option key={instance.id} value={instance.id}>
                      {instance.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <button className="button-link button-link--inline-secondary" onClick={openCreateInstanceModal} type="button">
            New Event Instance
          </button>
          <button className="topbar__button" onClick={handleAddCollateralItem} type="button">
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
              {currentEventType ? <span className="collateral-context__chip">{currentEventType.name}</span> : null}
            </div>
          </div>
          <div className="collateral-context__meta">
            {selectedEventDateRange ? <span>{selectedEventDateRange}</span> : null}
            {selectedEventInstance.location ? <span>{selectedEventInstance.location}</span> : null}
            {defaultTemplatePack ? (
              <span>{hasAppliedTemplateItems ? "Default template applied" : "Default template available"}</span>
            ) : (
              <span>No default template configured</span>
            )}
          </div>
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
                setCollateralProfile(activeEventInstanceId, {
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
              {currentEventType ? <span className="collateral-card-context"> - {currentEventType.name}</span> : null}
            </div>
            {activeSummaryFilter !== "all" || activeProfileDeadlineFilter !== "none" ? (
              <div className="collateral-filter-context">
                <span>
                  Showing:{" "}
                  {[
                    activeSummaryFilter !== "all" ? activeFilterLabel : null,
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
                  {activeSummaryFilter === "all" ? "This event instance is empty." : "No items match this view."}
                </div>
                <div className="empty-state__copy">
                  {activeSummaryFilter === "all"
                    ? defaultTemplatePack
                      ? `Apply the default template pack for ${currentEventType?.name ?? "this event"} or add your first collateral item manually.`
                      : "Add your first collateral item manually to start tracking production work for this event instance."
                    : "Try a different summary view or clear the filter to return to the full collateral list."}
                </div>
                <div className="empty-state__actions">
                  {activeSummaryFilter === "all" && defaultTemplatePack ? (
                    <button
                      className="topbar__button"
                      onClick={() => applyDefaultTemplateToInstance(activeEventInstanceId)}
                      type="button"
                    >
                      Apply Default Template
                    </button>
                  ) : null}
                  {activeSummaryFilter === "all" && activeProfileDeadlineFilter === "none" ? (
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
          <aside className="drawer" aria-label="Collateral details">
            <div className="drawer__header">
              <div className="drawer__header-text">
                <h2 className="drawer__title">{selectedItem.itemName}</h2>
                <div className="drawer__header-meta">
                  <span className="drawer__workstream">
                    {subEventNameById.get(selectedItem.subEventId) ?? "Unassigned sub-event"}
                  </span>
                  <span className={getCollateralStatusClassName(selectedItem)}>{selectedItem.status}</span>
                  {draftCollateralItem?.id === selectedItem.id ? (
                    <span className="drawer__status-chip drawer__status-chip--new">New item</span>
                  ) : null}
                </div>
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

            <div className="drawer__sections">
              <section className="drawer-section drawer-section--form collateral-drawer">
                <div className="collateral-drawer__group">
                  <div className="drawer__panel-title">Identity</div>
                  <div className="drawer__grid drawer__grid--form">
                    <div className="field field--priority">
                      <label htmlFor="collateral-item-name">Collateral Item</label>
                      <input
                        id="collateral-item-name"
                        onChange={(event) => updateCollateralItem(selectedItem.id, { itemName: event.target.value })}
                        value={selectedItem.itemName}
                      />
                    </div>
                    <div className="field field--secondary">
                      <label htmlFor="collateral-sub-event">Sub-Event</label>
                      <select
                        id="collateral-sub-event"
                        onChange={(event) => patchCollateralItem(selectedItem.id, { subEventId: event.target.value })}
                        value={selectedItem.subEventId}
                      >
                        {instanceSubEvents.length === 0 ? (
                          <option value="__unassigned__">Unassigned</option>
                        ) : null}
                        {instanceSubEvents.map((subEvent) => (
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
                    <div className="field field--wide">
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
                  <label htmlFor="instance-event-type">Event Type</label>
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
                    {eventTypes.map((eventType) => (
                      <option key={eventType.id} value={eventType.id}>
                        {eventType.name}
                      </option>
                    ))}
                  </select>
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
                  disabled={!isInstanceFormValid(instanceFormState)}
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
    </section>
  );
}

function groupCollateralItems(
  items: CollateralItem[],
  subEvents: { id: string; name: string; sortOrder: number }[],
  subEventNameById: Map<string, string>
) {
  const grouped = new Map<string, CollateralItem[]>();

  for (const subEvent of subEvents) {
    grouped.set(subEvent.name, []);
  }

  for (const item of items) {
    const subEventName = subEventNameById.get(item.subEventId) ?? "Unassigned";

    if (!grouped.has(subEventName)) {
      grouped.set(subEventName, []);
    }

    grouped.get(subEventName)!.push(item);
  }

  return Array.from(grouped.entries())
    .map(([subEvent, groupedItems]) => [
      subEvent,
      [...groupedItems].sort((a, b) => {
        const aHasDeadline = a.dueDate.length > 0;
        const bHasDeadline = b.dueDate.length > 0;

        if (aHasDeadline !== bHasDeadline) {
          return aHasDeadline ? -1 : 1;
        }

        if (aHasDeadline && bHasDeadline) {
          const dateCompare = a.dueDate.localeCompare(b.dueDate);

          if (dateCompare !== 0) {
            return dateCompare;
          }
        }

        return a.itemName.localeCompare(b.itemName);
      })
    ] as const)
    .filter(([, groupedItems]) => groupedItems.length > 0);
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

function getDefaultLegDayProfile(instance: { startDate: string; endDate: string } | null): LegDayCollateralProfile {
  return {
    eventStartDate: instance?.startDate ?? "",
    eventEndDate: instance?.endDate ?? "",
    roomBlockDeadline: "",
    roomBlockNote: "",
    logoDeadline: "",
    logoDeadlineNote: "",
    externalPrintingDue: "",
    internalPrintingStart: ""
  };
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

  if (item.blockedBy.trim()) {
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

  if (item.blockedBy.trim()) {
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

function matchesCollateralSummaryFilter(item: CollateralItem, filter: CollateralSummaryFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "active") {
    return !isCollateralTerminalStatus(item.status);
  }

  if (filter === "needsAttention") {
    return item.status === "Blocked" || (isCollateralOverdue(item) && item.status !== "Sent to Printer");
  }

  if (filter === "atPrinter") {
    return item.status === "Sent to Printer";
  }

  if (filter === "readyForPrint") {
    return item.status === "Ready for Print";
  }

  return true;
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

function matchesCollateralProfileDeadlineFilter(
  item: CollateralItem,
  profile: LegDayCollateralProfile | null,
  filter: CollateralProfileDeadlineFilter
) {
  if (filter === "none") {
    return true;
  }

  if (isCollateralTerminalStatus(item.status) || item.dueDate.length === 0 || !profile) {
    return false;
  }

  const targetDate = getProfileDeadlineDate(profile, filter);

  if (!targetDate) {
    return false;
  }

  return item.dueDate <= targetDate;
}

function getProfileDeadlineDate(
  profile: LegDayCollateralProfile,
  filter: CollateralProfileDeadlineFilter
) {
  if (filter === "logoDeadline") {
    return profile.logoDeadline;
  }

  if (filter === "externalPrintingDue") {
    return profile.externalPrintingDue;
  }

  if (filter === "internalPrintingStart") {
    return profile.internalPrintingStart;
  }

  return "";
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
