"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { UpdateEventInstanceInput, UpsertEventSubEventInput } from "@/components/app-state";
import { type EventOnboardingSelectedInstance } from "@/lib/events/event-onboarding";
import { getDefaultDatesForEventDateMode, validateEventInstanceCreationInput } from "@/lib/event-type-definitions";
import { formatShortDate } from "@/lib/ops-utils";
import {
  createSponsorPlacementDraft,
  getSponsorFulfillmentTaskTitle,
  getSponsorPlacementDeliverables,
  getSponsorPlacementLabel,
  getSponsorPlacementOptions,
  type SponsorPlacement
} from "@/lib/sponsor-fulfillment";
import type { EventDateMode } from "@/lib/event-instances";

type EventInstanceDetailPanelProps = {
  selectedInstance: EventOnboardingSelectedInstance | null;
  isActive: boolean;
  onClose: () => void;
  onOpenInCollateral: (instanceId: string) => void;
  onSetActive: (instanceId: string) => void;
  onUpdateInstance: (instanceId: string, updates: UpdateEventInstanceInput) => boolean;
  onUpsertSubEvent: (instanceId: string, input: UpsertEventSubEventInput) => string | null;
  onRemoveSubEvent: (instanceId: string, subEventId: string) => boolean;
  sponsorPlacements: SponsorPlacement[];
  onUpsertSponsorPlacement: (instanceId: string, placement: SponsorPlacement) => void;
  onRemoveSponsorPlacement: (instanceId: string, placementId: string) => void;
  onGenerateSponsorFulfillment: (instanceId: string) => {
    createdActions: number;
    updatedActions: number;
    matchedCollateral: number;
    createdCollateral: number;
    skipped: number;
  };
};

type DetailFormState = {
  instanceName: string;
  dateMode: EventDateMode;
  dates: string[];
  location: string;
  notes: string;
};

export function EventInstanceDetailPanel({
  selectedInstance,
  isActive,
  onClose,
  onOpenInCollateral,
  onSetActive,
  onUpdateInstance,
  onUpsertSubEvent,
  onRemoveSubEvent,
  sponsorPlacements,
  onUpsertSponsorPlacement,
  onRemoveSponsorPlacement,
  onGenerateSponsorFulfillment
}: EventInstanceDetailPanelProps) {
  const [formState, setFormState] = useState<DetailFormState | null>(null);
  const [subEventDrafts, setSubEventDrafts] = useState<Record<string, string>>({});
  const [subEventDateDrafts, setSubEventDateDrafts] = useState<Record<string, string>>({});
  const [subEventStartTimeDrafts, setSubEventStartTimeDrafts] = useState<Record<string, string>>({});
  const [subEventEndTimeDrafts, setSubEventEndTimeDrafts] = useState<Record<string, string>>({});
  const [newSubEventName, setNewSubEventName] = useState("");
  const [newSubEventDate, setNewSubEventDate] = useState("");
  const [newSubEventStartTime, setNewSubEventStartTime] = useState("");
  const [newSubEventEndTime, setNewSubEventEndTime] = useState("");
  const [feedback, setFeedback] = useState("");
  const newSubEventNameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!selectedInstance) {
      setFormState(null);
      setSubEventDrafts({});
      setSubEventDateDrafts({});
      setSubEventStartTimeDrafts({});
      setSubEventEndTimeDrafts({});
      setFeedback("");
      setNewSubEventName("");
      setNewSubEventDate("");
      setNewSubEventStartTime("");
      setNewSubEventEndTime("");
      return;
    }

    setFormState({
      instanceName: selectedInstance.instance.name,
      dateMode: selectedInstance.instance.dateMode,
      dates: normalizeEditableDates(selectedInstance.instance.dateMode, selectedInstance.instance.dates),
      location: selectedInstance.instance.location ?? "",
      notes: selectedInstance.instance.notes ?? ""
    });
    const editableSubEvents = selectedInstance.fallbackLane
      ? [...selectedInstance.scheduledSubEvents, selectedInstance.fallbackLane]
      : selectedInstance.scheduledSubEvents;
    setSubEventDrafts(
      Object.fromEntries(editableSubEvents.map((subEvent) => [subEvent.id, subEvent.name]))
    );
    setSubEventDateDrafts(
      Object.fromEntries(
        editableSubEvents.map((subEvent) => [subEvent.id, "date" in subEvent ? subEvent.date : ""])
      )
    );
    setSubEventStartTimeDrafts(
      Object.fromEntries(
        editableSubEvents.map((subEvent) => [subEvent.id, "startTime" in subEvent ? subEvent.startTime : ""])
      )
    );
    setSubEventEndTimeDrafts(
      Object.fromEntries(
        editableSubEvents.map((subEvent) => [subEvent.id, "endTime" in subEvent ? subEvent.endTime : ""])
      )
    );
    setFeedback("");
    setNewSubEventName("");
    setNewSubEventDate(getDefaultNewSubEventDate(selectedInstance.instance));
    setNewSubEventStartTime("");
    setNewSubEventEndTime("");
  }, [selectedInstance]);

  const validation = useMemo(() => {
    if (!selectedInstance || !formState) {
      return false;
    }

    return validateEventInstanceCreationInput({
      eventTypeId: selectedInstance.instance.eventTypeId,
      instanceName: formState.instanceName,
      dateMode: formState.dateMode,
      dates: formState.dates
    });
  }, [formState, selectedInstance]);

  if (!selectedInstance || !formState) {
    return null;
  }

  const { instance, definition, eventFamilyName, scheduleStatus } = selectedInstance;
  const supportsSponsorSetup = definition?.supportsSponsorSetup ?? false;
  const sponsorPlacementOptions = supportsSponsorSetup
    ? getSponsorPlacementOptions(instance.eventTypeId)
    : [];
  const {
    fallbackLane,
    isCollateralReady,
    nextStepGuidance,
    scheduledSubEvents,
    setupSteps
  } = selectedInstance;

  function handleSaveDetails() {
    const didUpdate = onUpdateInstance(instance.id, {
      instanceName: formState.instanceName,
      dateMode: formState.dateMode,
      dates: formState.dates,
      location: formState.location,
      notes: formState.notes
    });

    setFeedback(
      didUpdate
        ? `${formState.instanceName.trim()} updated.`
        : "Event details could not be saved. Check the name and dates, then try again."
    );
  }

  function handleSaveSubEventName(subEventId: string) {
    const nextName = subEventDrafts[subEventId] ?? "";
    const didSave = onUpsertSubEvent(instance.id, {
      id: subEventId,
      name: nextName,
      date: subEventDateDrafts[subEventId] ?? "",
      startTime: subEventStartTimeDrafts[subEventId] ?? "",
      endTime: subEventEndTimeDrafts[subEventId] ?? ""
    });
    setFeedback(
      didSave
        ? "Sub-event updated."
        : "That sub-event name could not be saved. Use a unique non-empty name."
    );
  }

  function handleAddSubEvent() {
    const addedId = onUpsertSubEvent(instance.id, {
      name: newSubEventName,
      date: newSubEventDate,
      startTime: newSubEventStartTime,
      endTime: newSubEventEndTime
    });
    setFeedback(
      addedId
        ? `Added ${newSubEventName.trim()}.`
        : "That sub-event could not be added. Use a unique non-empty name."
    );
    if (addedId) {
      setNewSubEventName("");
      setNewSubEventDate(getDefaultNewSubEventDate(instance));
      setNewSubEventStartTime("");
      setNewSubEventEndTime("");
      setTimeout(() => newSubEventNameRef.current?.focus(), 0);
    }
  }

  function handleRemoveSubEvent(subEventId: string) {
    const didRemove = onRemoveSubEvent(instance.id, subEventId);
    setFeedback(
      didRemove
        ? "Sub-event removed."
        : "This sub-event could not be removed because it is scaffolded or already in use."
    );
  }

  function handleAddSponsorPlacement() {
    onUpsertSponsorPlacement(instance.id, createSponsorPlacementDraft(instance.id, instance.eventTypeId));
    setFeedback("Sponsor placement added.");
  }

  function handleSponsorPlacementChange(
    placementId: string,
    field: keyof Pick<SponsorPlacement, "sponsorName" | "placement" | "linkedSubEventId" | "logoReceived" | "notes" | "isActive">,
    value: string | boolean | undefined
  ) {
    const placement = sponsorPlacements.find((entry) => entry.id === placementId);

    if (!placement) {
      return;
    }

    onUpsertSponsorPlacement(instance.id, {
      ...placement,
      [field]: value
    });
  }

  function handleGenerateSponsorWork() {
    const result = onGenerateSponsorFulfillment(instance.id);

    if (
      result.createdActions === 0 &&
      result.updatedActions === 0 &&
      result.createdCollateral === 0 &&
      result.matchedCollateral === 0 &&
      result.skipped === 0
    ) {
      setFeedback("No sponsor work was generated yet. Add at least one active sponsor placement first.");
      return;
    }

    const parts = [];

    if (result.createdActions > 0) {
      parts.push(
        `${result.createdActions} sponsor action item${result.createdActions === 1 ? "" : "s"} created in Action View`
      );
    }

    if (result.updatedActions > 0) {
      parts.push(
        `${result.updatedActions} existing sponsor action item${result.updatedActions === 1 ? "" : "s"} linked to collateral`
      );
    }

    if (result.matchedCollateral > 0) {
      parts.push(
        `${result.matchedCollateral} deliverable${result.matchedCollateral === 1 ? "" : "s"} matched existing collateral`
      );
    }

    if (result.createdCollateral > 0) {
      parts.push(
        `${result.createdCollateral} fallback collateral item${result.createdCollateral === 1 ? "" : "s"} created`
      );
    }

    if (result.skipped > 0) {
      parts.push(
        `${result.skipped} deliverable${result.skipped === 1 ? "" : "s"} skipped because matching action work already exists or setup is incomplete`
      );
    }

    setFeedback(parts.join(". ") + ".");
  }

  return (
    <aside aria-label="Event setup details" className="drawer drawer--events">
      <div className="drawer__sticky events-drawer__sticky">
        <div className="events-drawer__eyebrow">Event Setup</div>
        <div className="events-drawer__header">
          <div className="events-drawer__header-text">
            <div className="events-drawer__title-row">
              <h2 className="drawer__title events-drawer__title">{instance.name}</h2>
              <button
                aria-label="Close event setup"
                className="drawer-close"
                onClick={onClose}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="events-detail-card__meta">
              <span>{definition?.label ?? instance.eventTypeId}</span>
              <span>{eventFamilyName}</span>
              <span>{formatEventDateRange(instance.startDate, instance.endDate)}</span>
              <span>{formatScheduleStatus(scheduleStatus)}</span>
            </div>
          </div>
          <div className="events-detail-card__actions">
            {!isActive ? (
              <button
                className="button-link button-link--inline-secondary"
                onClick={() => onSetActive(instance.id)}
                type="button"
              >
                Make Active
              </button>
            ) : (
              <span className="events-chip events-chip--active">Active Instance</span>
            )}
            <button
              className="topbar__button"
              onClick={() => onOpenInCollateral(instance.id)}
              type="button"
            >
              {isCollateralReady ? "Open in Collateral" : "Open in Collateral Anyway"}
            </button>
          </div>
        </div>
        <div className="events-drawer__subtitle">
          {nextStepGuidance}
        </div>
      </div>

      <div className="events-drawer__body">
        <section className="card card--secondary events-detail-card events-detail-card--drawer">
          <div className="events-detail-card__header">
            <div>
              <div className="card__title">Instance Details</div>
            </div>
          </div>

      {definition?.description ? (
        <div className="events-detail-card__description">{definition.description}</div>
      ) : null}

      {feedback ? (
        <div className="collateral-setup-banner" role="status">
          <span>{feedback}</span>
          <button className="button-link button-link--inline-secondary" onClick={() => setFeedback("")} type="button">
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="events-detail-card__section events-detail-card__section--progress">
        <div className="events-detail-card__section-title">Setup Progress</div>
        <div className="events-setup-progress">
          {setupSteps.map((step) => (
            <div className={`events-setup-progress__step events-setup-progress__step--${step.status}`} key={step.key}>
              <div className="events-setup-progress__step-top">
                <span className="events-setup-progress__label">{step.label}</span>
                <span className={`events-setup-progress__status events-setup-progress__status--${step.status}`}>
                  {formatSetupStepStatus(step.status)}
                </span>
              </div>
              <div className="field__hint">{step.guidance}</div>
            </div>
          ))}
        </div>
        <div className="collateral-setup-banner" role="status">
          <span>{nextStepGuidance}</span>
        </div>
      </div>

      <div className="events-detail-card__section">
        <div className="events-detail-card__section-title">Instance Setup</div>
        <div className="quick-add-grid">
          <div className="field">
            <label htmlFor="events-detail-name">Instance Name</label>
            <input
              className="field-control"
              id="events-detail-name"
              onChange={(event) => setFormState((current) => current ? { ...current, instanceName: event.target.value } : current)}
              value={formState.instanceName}
            />
          </div>
          <div className="field">
            <label htmlFor="events-detail-mode">Date Mode</label>
            <select
              className="field-control"
              id="events-detail-mode"
              onChange={(event) =>
                setFormState((current) =>
                  current
                    ? {
                        ...current,
                        dateMode: event.target.value as EventDateMode,
                        dates: normalizeEditableDates(event.target.value as EventDateMode, current.dates)
                      }
                    : current
                )
              }
              value={formState.dateMode}
            >
              <option value="single">Single day</option>
              <option value="range">Date range</option>
              <option value="multiple">Multiple dates</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="events-detail-location">Location</label>
            <input
              className="field-control"
              id="events-detail-location"
              onChange={(event) => setFormState((current) => current ? { ...current, location: event.target.value } : current)}
              placeholder="Optional"
              value={formState.location}
            />
          </div>
          {formState.dateMode === "single" ? (
            <div className="field">
              <label htmlFor="events-detail-single-date">Date</label>
              <input
                className="field-control"
                id="events-detail-single-date"
                onChange={(event) => setFormState((current) => current ? { ...current, dates: [event.target.value] } : current)}
                type="date"
                value={formState.dates[0] ?? ""}
              />
            </div>
          ) : null}
          {formState.dateMode === "range" ? (
            <div className="field field--wide collateral-instance-range">
              <div className="field">
                <label htmlFor="events-detail-start-date">Start Date</label>
                <input
                  className="field-control"
                  id="events-detail-start-date"
                  onChange={(event) =>
                    setFormState((current) =>
                      current ? { ...current, dates: [event.target.value, current.dates[1] ?? ""] } : current
                    )
                  }
                  type="date"
                  value={formState.dates[0] ?? ""}
                />
              </div>
              <div className="field">
                <label htmlFor="events-detail-end-date">End Date</label>
                <input
                  className="field-control"
                  id="events-detail-end-date"
                  onChange={(event) =>
                    setFormState((current) =>
                      current ? { ...current, dates: [current.dates[0] ?? "", event.target.value] } : current
                    )
                  }
                  type="date"
                  value={formState.dates[1] ?? ""}
                />
              </div>
            </div>
          ) : null}
          {formState.dateMode === "multiple" ? (
            <div className="field field--wide">
              <label>Dates</label>
              <div className="quick-add-array-field">
                {formState.dates.map((date, index) => (
                  <div className="quick-add-array-field__row" key={`events-detail-date-${index}`}>
                    <input
                      className="field-control"
                      onChange={(event) =>
                        setFormState((current) =>
                          current
                            ? {
                                ...current,
                                dates: current.dates.map((entry, entryIndex) =>
                                  entryIndex === index ? event.target.value : entry
                                )
                              }
                            : current
                        )
                      }
                      type="date"
                      value={date}
                    />
                    <button
                      className="button-link button-link--inline-secondary"
                      onClick={() =>
                        setFormState((current) =>
                          current
                            ? {
                                ...current,
                                dates:
                                  current.dates.length > 1
                                    ? current.dates.filter((_, entryIndex) => entryIndex !== index)
                                    : [""]
                              }
                            : current
                        )
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
                    setFormState((current) =>
                      current
                        ? {
                            ...current,
                            dates: [...current.dates, ""]
                          }
                        : current
                    )
                  }
                  type="button"
                >
                  Add Date
                </button>
              </div>
            </div>
          ) : null}
          <div className="field field--wide">
            <label htmlFor="events-detail-notes">Notes</label>
            <textarea
              className="field-control field-control--textarea"
              id="events-detail-notes"
              onChange={(event) => setFormState((current) => current ? { ...current, notes: event.target.value } : current)}
              rows={4}
              value={formState.notes}
            />
          </div>
        </div>
        <div className="quick-add-actions">
          <button className="topbar__button" disabled={!validation} onClick={handleSaveDetails} type="button">
            Save Details
          </button>
        </div>
      </div>

      <div className="events-detail-card__section">
        <div className="events-detail-card__section-title">Sub-Events</div>
        <div className="field__hint">
          These are the sub-events for this instance. Default rows came from the event type, and you can add more rows here for this specific event as needed.
        </div>
        <div className="events-sub-events">
          {scheduledSubEvents.map((subEvent) => (
            <div className="events-sub-events__row" key={subEvent.id}>
              <div className="events-sub-events__main">
                <div className="events-sub-events__top">
                  <input
                    className="field-control"
                    disabled={subEvent.isUnassigned}
                    onChange={(event) =>
                      setSubEventDrafts((current) => ({
                        ...current,
                        [subEvent.id]: event.target.value
                      }))
                    }
                    value={subEventDrafts[subEvent.id] ?? subEvent.name}
                  />
                  <div className="events-sub-events__actions">
                    {!subEvent.isUnassigned ? (
                      <button
                        className="button-link button-link--inline-secondary"
                        onClick={() => handleSaveSubEventName(subEvent.id)}
                        type="button"
                      >
                        Save
                      </button>
                    ) : null}
                    <button
                      className="button-link button-link--inline-secondary"
                      disabled={!subEvent.canRemove}
                      onClick={() => handleRemoveSubEvent(subEvent.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="events-sub-events__schedule events-sub-events__schedule--compact">
                  <div className="field">
                    <label htmlFor={`sub-event-date-${subEvent.id}`}>Date</label>
                    <input
                      className="field-control"
                      id={`sub-event-date-${subEvent.id}`}
                      onChange={(event) =>
                        setSubEventDateDrafts((current) => ({
                          ...current,
                          [subEvent.id]: event.target.value
                        }))
                      }
                      type="date"
                      value={subEventDateDrafts[subEvent.id] ?? subEvent.date}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`sub-event-start-${subEvent.id}`}>Start</label>
                    <input
                      className="field-control"
                      id={`sub-event-start-${subEvent.id}`}
                      onChange={(event) =>
                        setSubEventStartTimeDrafts((current) => ({
                          ...current,
                          [subEvent.id]: event.target.value
                        }))
                      }
                      type="time"
                      value={subEventStartTimeDrafts[subEvent.id] ?? subEvent.startTime}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`sub-event-end-${subEvent.id}`}>End</label>
                    <input
                      className="field-control"
                      id={`sub-event-end-${subEvent.id}`}
                      onChange={(event) =>
                        setSubEventEndTimeDrafts((current) => ({
                          ...current,
                          [subEvent.id]: event.target.value
                        }))
                      }
                      type="time"
                      value={subEventEndTimeDrafts[subEvent.id] ?? subEvent.endTime}
                    />
                  </div>
                </div>
                <div className="events-sub-events__meta">
                  {subEvent.isDefault ? <span className="events-chip">Included by event type</span> : null}
                  {subEvent.actionUsageCount > 0 ? (
                    <span className="events-chip">{subEvent.actionUsageCount} action item{subEvent.actionUsageCount === 1 ? "" : "s"}</span>
                  ) : null}
                  {subEvent.collateralUsageCount > 0 ? (
                    <span className="events-chip">{subEvent.collateralUsageCount} collateral item{subEvent.collateralUsageCount === 1 ? "" : "s"}</span>
                  ) : null}
                </div>
                {subEvent.removeBlockReason ? (
                  <div className="field__hint">{subEvent.removeBlockReason}</div>
                ) : null}
              </div>
            </div>
          ))}

          <div className="events-sub-events__row events-sub-events__row--draft">
            <div className="events-sub-events__main">
              <div className="events-sub-events__top">
                <input
                  ref={newSubEventNameRef}
                  className="field-control"
                  onChange={(event) => setNewSubEventName(event.target.value)}
                  placeholder="Add another sub-event"
                  value={newSubEventName}
                />
                <div className="events-sub-events__actions">
                  <button
                    className="button-link button-link--inline-secondary"
                    disabled={!newSubEventName.trim()}
                    onClick={handleAddSubEvent}
                    type="button"
                  >
                    Save
                  </button>
                  <button
                    className="button-link button-link--inline-secondary"
                    disabled={
                      !newSubEventName.trim() &&
                      !newSubEventDate &&
                      !newSubEventStartTime &&
                      !newSubEventEndTime
                    }
                    onClick={() => {
                      setNewSubEventName("");
                      setNewSubEventDate(getDefaultNewSubEventDate(instance));
                      setNewSubEventStartTime("");
                      setNewSubEventEndTime("");
                      newSubEventNameRef.current?.focus();
                    }}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="events-sub-events__schedule events-sub-events__schedule--compact">
                <div className="field">
                  <label htmlFor="events-new-sub-event-date">Date</label>
                  <input
                    className="field-control"
                    id="events-new-sub-event-date"
                    onChange={(event) => setNewSubEventDate(event.target.value)}
                    type="date"
                    value={newSubEventDate}
                  />
                </div>
                <div className="field">
                  <label htmlFor="events-new-sub-event-start">Start</label>
                  <input
                    className="field-control"
                    id="events-new-sub-event-start"
                    onChange={(event) => setNewSubEventStartTime(event.target.value)}
                    type="time"
                    value={newSubEventStartTime}
                  />
                </div>
                <div className="field">
                  <label htmlFor="events-new-sub-event-end">End</label>
                  <input
                    className="field-control"
                    id="events-new-sub-event-end"
                    onChange={(event) => setNewSubEventEndTime(event.target.value)}
                    type="time"
                    value={newSubEventEndTime}
                  />
                </div>
              </div>
              <div className="events-sub-events__meta">
                <span className="events-chip">New for this instance</span>
              </div>
              <div className="field__hint">
                Save a new row here, then keep going. After each save, a fresh blank row stays ready for the next sub-event.
              </div>
            </div>
          </div>
        </div>

        {fallbackLane ? (
          <div className="events-fallback-lane">
            <div className="events-fallback-lane__header">
              <div>
                <div className="events-detail-card__section-title">Catch-All Lane</div>
                <div className="field__hint">
                  Keep this fallback lane in place so new work has a temporary place to land before you assign it to a planned or one-off sub-event.
                </div>
              </div>
              <span className="events-chip">Fallback lane</span>
            </div>
            <div className="events-sub-events__meta">
              <span className="events-chip">{fallbackLane.name}</span>
              {fallbackLane.actionUsageCount > 0 ? (
                <span className="events-chip">{fallbackLane.actionUsageCount} action item{fallbackLane.actionUsageCount === 1 ? "" : "s"}</span>
              ) : null}
              {fallbackLane.collateralUsageCount > 0 ? (
                <span className="events-chip">{fallbackLane.collateralUsageCount} collateral item{fallbackLane.collateralUsageCount === 1 ? "" : "s"}</span>
              ) : null}
            </div>
            {fallbackLane.removeBlockReason ? (
              <div className="field__hint">{fallbackLane.removeBlockReason}</div>
            ) : null}
          </div>
        ) : null}
      </div>

      {supportsSponsorSetup ? (
        <div className="events-detail-card__section">
          <div className="events-detail-card__section-title">Sponsor Placements</div>
          <div className="field__hint">
            Add sponsor placements for this event instance, then generate sponsor execution work into Action View. Physical deliverables will reuse matching collateral when it already exists.
          </div>
          <div className="sponsor-setup__rows sponsor-setup__rows--events">
            {sponsorPlacements.length > 0 ? (
              sponsorPlacements.map((placement) => {
                const deliverables = getSponsorPlacementDeliverables(placement.placement, instance.eventTypeId);
                return (
                  <div className="sponsor-setup__row sponsor-setup__row--events" key={placement.id}>
                    <div className="field">
                      <label htmlFor={`events-sponsor-name-${placement.id}`}>Sponsor</label>
                      <input
                        className="field-control"
                        id={`events-sponsor-name-${placement.id}`}
                        onChange={(event) => handleSponsorPlacementChange(placement.id, "sponsorName", event.target.value)}
                        placeholder="Sponsor name"
                        value={placement.sponsorName}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`events-sponsor-placement-${placement.id}`}>Placement</label>
                      <select
                        className="field-control"
                        id={`events-sponsor-placement-${placement.id}`}
                        onChange={(event) => handleSponsorPlacementChange(placement.id, "placement", event.target.value)}
                        value={placement.placement}
                      >
                        {sponsorPlacementOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`events-sponsor-linked-sub-event-${placement.id}`}>Linked Sub-Event</label>
                      <select
                        className="field-control"
                        id={`events-sponsor-linked-sub-event-${placement.id}`}
                        onChange={(event) =>
                          handleSponsorPlacementChange(
                            placement.id,
                            "linkedSubEventId",
                            event.target.value || undefined
                          )
                        }
                        value={placement.linkedSubEventId ?? ""}
                      >
                        <option value="">Event-wide / no linked sub-event</option>
                        {scheduledSubEvents.map((subEvent) => (
                          <option key={subEvent.id} value={subEvent.id}>
                            {subEvent.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field field--wide">
                      <label className="checkbox-field" htmlFor={`events-sponsor-logo-${placement.id}`}>
                        <input
                          checked={placement.logoReceived}
                          id={`events-sponsor-logo-${placement.id}`}
                          onChange={(event) => handleSponsorPlacementChange(placement.id, "logoReceived", event.target.checked)}
                          type="checkbox"
                        />
                        <span>{placement.logoReceived ? "Logo received" : "Still waiting on sponsor logo"}</span>
                      </label>
                      <label className="checkbox-field" htmlFor={`events-sponsor-active-${placement.id}`}>
                        <input
                          checked={placement.isActive}
                          id={`events-sponsor-active-${placement.id}`}
                          onChange={(event) => handleSponsorPlacementChange(placement.id, "isActive", event.target.checked)}
                          type="checkbox"
                        />
                        <span>{placement.isActive ? "Active placement" : "Inactive placement"}</span>
                      </label>
                    </div>
                    <div className="field field--wide">
                      <label htmlFor={`events-sponsor-notes-${placement.id}`}>Notes</label>
                      <textarea
                        className="field-control"
                        id={`events-sponsor-notes-${placement.id}`}
                        onChange={(event) => handleSponsorPlacementChange(placement.id, "notes", event.target.value)}
                        placeholder={`Optional context for ${getSponsorPlacementLabel(placement.placement, instance.eventTypeId).toLowerCase()}`}
                        rows={2}
                        value={placement.notes ?? ""}
                      />
                      {placement.sponsorName.trim() ? (
                        <div className="field__hint">
                          Generates {deliverables.length} sponsor item{deliverables.length === 1 ? "" : "s"}, including{" "}
                          {deliverables
                            .slice(0, 2)
                            .map((deliverable) =>
                              getSponsorFulfillmentTaskTitle({
                                sponsorName: placement.sponsorName.trim(),
                                deliverableName: deliverable.deliverableName
                              })
                            )
                            .join(" • ")}
                          {deliverables.length > 2 ? ` + ${deliverables.length - 2} more` : ""}
                        </div>
                      ) : null}
                    </div>
                    <div className="sponsor-setup__actions">
                      <button
                        className="button-link button-link--inline-secondary"
                        onClick={() => onRemoveSponsorPlacement(instance.id, placement.id)}
                        type="button"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="sponsor-setup__empty">No sponsor placements set up yet for this event instance.</div>
            )}
          </div>
          <div className="events-detail-card__section-actions sponsor-setup__footer sponsor-setup__footer--events">
            <button className="button-link button-link--inline-secondary" onClick={handleAddSponsorPlacement} type="button">
              Add Placement
            </button>
            <button className="topbar__button" onClick={handleGenerateSponsorWork} type="button">
              Generate Sponsor Work
            </button>
          </div>
        </div>
      ) : null}
        </section>
      </div>
    </aside>
  );
}

function normalizeEditableDates(dateMode: EventDateMode, dates: string[]) {
  if (dateMode === "multiple") {
    return dates.length > 0 ? [...dates] : [""];
  }

  if (dateMode === "range") {
    return dates.length >= 2
      ? [dates[0] ?? "", dates[1] ?? ""]
      : dates.length === 1
        ? [dates[0] ?? "", dates[0] ?? ""]
        : getDefaultDatesForEventDateMode("range");
  }

  return [dates[0] ?? ""];
}

function formatEventDateRange(startDate: string, endDate: string) {
  if (!startDate) {
    return "";
  }

  if (!endDate || startDate === endDate) {
    return formatShortDate(startDate);
  }

  return `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`;
}

function formatScheduleStatus(status: "none" | "partial" | "scheduled") {
  if (status === "scheduled") {
    return "Sub-events scheduled";
  }

  if (status === "partial") {
    return "Sub-events partially scheduled";
  }

  return "Sub-event schedule still needed";
}

function formatSetupStepStatus(status: "needs_attention" | "ready_next" | "done") {
  if (status === "done") {
    return "Done";
  }

  if (status === "ready_next") {
    return "Ready next";
  }

  return "Needs attention";
}

function getDefaultNewSubEventDate(instance: { dates: string[]; startDate: string }) {
  return instance.dates.find((date) => Boolean(date)) ?? instance.startDate ?? "";
}
