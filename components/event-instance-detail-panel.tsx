"use client";

import { useEffect, useMemo, useState } from "react";
import type { UpdateEventInstanceInput, UpsertEventSubEventInput } from "@/components/app-state";
import { type EventOnboardingSelectedInstance } from "@/lib/events/event-onboarding";
import { getDefaultDatesForEventDateMode, validateEventInstanceCreationInput } from "@/lib/event-type-definitions";
import { formatShortDate } from "@/lib/ops-utils";
import type { EventDateMode } from "@/lib/event-instances";

type EventInstanceDetailPanelProps = {
  selectedInstance: EventOnboardingSelectedInstance | null;
  isActive: boolean;
  onOpenInCollateral: (instanceId: string) => void;
  onSetActive: (instanceId: string) => void;
  onUpdateInstance: (instanceId: string, updates: UpdateEventInstanceInput) => boolean;
  onUpsertSubEvent: (instanceId: string, input: UpsertEventSubEventInput) => string | null;
  onRemoveSubEvent: (instanceId: string, subEventId: string) => boolean;
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
  onOpenInCollateral,
  onSetActive,
  onUpdateInstance,
  onUpsertSubEvent,
  onRemoveSubEvent
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
    setSubEventDrafts(
      Object.fromEntries(selectedInstance.subEvents.map((subEvent) => [subEvent.id, subEvent.name]))
    );
    setSubEventDateDrafts(
      Object.fromEntries(selectedInstance.subEvents.map((subEvent) => [subEvent.id, subEvent.date]))
    );
    setSubEventStartTimeDrafts(
      Object.fromEntries(selectedInstance.subEvents.map((subEvent) => [subEvent.id, subEvent.startTime]))
    );
    setSubEventEndTimeDrafts(
      Object.fromEntries(selectedInstance.subEvents.map((subEvent) => [subEvent.id, subEvent.endTime]))
    );
    setFeedback("");
    setNewSubEventName("");
    setNewSubEventDate("");
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
    return (
      <section className="card card--secondary events-detail-card">
        <div className="card__title">Instance Details</div>
        <div className="events-detail-card__empty">
          Select an event instance to edit its setup details and sub-events.
        </div>
      </section>
    );
  }

  const { instance, definition, eventFamilyName, scheduleStatus, subEvents } = selectedInstance;

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
      setNewSubEventDate("");
      setNewSubEventStartTime("");
      setNewSubEventEndTime("");
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

  return (
    <section className="card card--secondary events-detail-card">
      <div className="events-detail-card__header">
        <div>
          <div className="card__title">Instance Details</div>
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
            Open in Collateral
          </button>
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
        <div className="events-sub-events">
          {subEvents.map((subEvent) => (
            <div className="events-sub-events__row" key={subEvent.id}>
              <div className="events-sub-events__main">
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
                <div className="events-sub-events__schedule">
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
                  {subEvent.isDefault ? <span className="events-chip">Template scaffold</span> : null}
                  {subEvent.isUnassigned ? <span className="events-chip">Fallback lane</span> : null}
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
          ))}
        </div>

        <div className="events-sub-events__create">
          <div className="field field--wide">
            <label htmlFor="events-new-sub-event">Add Manual Sub-Event</label>
            <input
              className="field-control"
              id="events-new-sub-event"
              onChange={(event) => setNewSubEventName(event.target.value)}
              placeholder="Example: Friday Breakfast"
              value={newSubEventName}
            />
            <div className="field__hint">
              Manual sub-events are instance-specific. They can be removed later if no Action View or Collateral work uses them.
            </div>
          </div>
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
          <button
            className="button-link button-link--inline-secondary"
            disabled={!newSubEventName.trim()}
            onClick={handleAddSubEvent}
            type="button"
          >
            Add Sub-Event
          </button>
        </div>
      </div>
    </section>
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
