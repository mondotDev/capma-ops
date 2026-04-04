"use client";

import { useEffect, useMemo, useState } from "react";
import type { CreateEventInstanceInput } from "@/lib/state/app-state-types";
import {
  createSuggestedEventInstanceName,
  type EventDateMode
} from "@/lib/event-instances";
import {
  getDefaultDatesForEventDateMode,
  type EventTypeDefinition,
  validateEventInstanceCreationInput
} from "@/lib/event-type-definitions";

type CreateInstanceFormState = {
  eventTypeId: string;
  instanceName: string;
  dateMode: EventDateMode;
  dates: string[];
  location: string;
  notes: string;
};

export function EventInstanceCreateModal({
  availableEventTypeDefinitions,
  isOpen,
  onClose,
  onCreate
}: {
  availableEventTypeDefinitions: EventTypeDefinition[];
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: CreateEventInstanceInput) => void;
}) {
  const [formState, setFormState] = useState<CreateInstanceFormState>(() =>
    createInitialFormState(availableEventTypeDefinitions[0] ?? null)
  );
  const [hasEditedInstanceName, setHasEditedInstanceName] = useState(false);
  const selectedDefinition = useMemo(
    () => availableEventTypeDefinitions.find((definition) => definition.key === formState.eventTypeId) ?? null,
    [availableEventTypeDefinitions, formState.eventTypeId]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormState(createInitialFormState(availableEventTypeDefinitions[0] ?? null));
    setHasEditedInstanceName(false);
  }, [availableEventTypeDefinitions, isOpen]);

  useEffect(() => {
    if (hasEditedInstanceName) {
      return;
    }

    if (!selectedDefinition) {
      return;
    }

    setFormState((current) => ({
      ...current,
      instanceName: createSuggestedEventInstanceName(
        selectedDefinition.label,
        current.dateMode,
        current.dates,
        current.location
      )
    }));
  }, [formState.dateMode, formState.dates, formState.location, hasEditedInstanceName, selectedDefinition]);

  useEffect(() => {
    if (formState.eventTypeId && selectedDefinition) {
      return;
    }

    const fallbackDefinition = availableEventTypeDefinitions[0] ?? null;
    if (!fallbackDefinition || fallbackDefinition.key === formState.eventTypeId) {
      return;
    }

    setFormState((current) => ({
      ...current,
      eventTypeId: fallbackDefinition.key,
      dateMode: fallbackDefinition.dateMode,
      dates: getDefaultDatesForEventDateMode(fallbackDefinition.dateMode)
    }));
  }, [availableEventTypeDefinitions, formState.eventTypeId, selectedDefinition]);

  if (!isOpen) {
    return null;
  }

  const isValid = validateEventInstanceCreationInput({
    eventTypeId: formState.eventTypeId,
    instanceName: formState.instanceName,
    dateMode: formState.dateMode,
    dates: formState.dates
  });

  function handleCreate() {
    if (!isValid) {
      return;
    }

    const normalizedDates = formState.dates.filter((date) => date.length > 0);

    onCreate({
      eventTypeId: formState.eventTypeId,
      instanceName: formState.instanceName.trim(),
      dateMode: formState.dateMode,
      dates: normalizedDates,
      location: formState.location.trim(),
      notes: formState.notes.trim()
    });
  }

  return (
    <div className="modal-layer" role="presentation">
      <button aria-label="Close create event instance" className="modal-backdrop" onClick={onClose} type="button" />
      <section aria-labelledby="create-instance-title" aria-modal="true" className="quick-add-modal" role="dialog">
        <div className="quick-add-modal__header">
          <div>
            <h2 className="quick-add-modal__title" id="create-instance-title">
              New Event Instance
            </h2>
            <p className="quick-add-modal__subtitle">
              Create the event instance, scaffold its default sub-events, and then choose whether to start with a collateral pack if one exists.
            </p>
          </div>
          <button className="button-link" onClick={onClose} type="button">
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
                onChange={(event) => {
                  const nextDefinition =
                    availableEventTypeDefinitions.find((definition) => definition.key === event.target.value) ?? null;

                  setFormState((current) => ({
                    ...current,
                    eventTypeId: event.target.value,
                    dateMode: nextDefinition?.dateMode ?? current.dateMode,
                    dates: nextDefinition
                      ? getDefaultDatesForEventDateMode(nextDefinition.dateMode)
                      : current.dates
                  }));
                }}
                value={formState.eventTypeId}
              >
                {availableEventTypeDefinitions.map((eventTypeDefinition) => (
                  <option key={eventTypeDefinition.key} value={eventTypeDefinition.key}>
                    {eventTypeDefinition.label}
                  </option>
                ))}
              </select>
              <div className="field__hint">
                Event types provide the default date mode and sub-event scaffolding. A collateral pack may or may not exist yet.
              </div>
            </div>
            <div className="field">
              <label htmlFor="instance-name">Instance Name</label>
              <input
                className="field-control"
                id="instance-name"
                onChange={(event) => {
                  setHasEditedInstanceName(true);
                  setFormState((current) => ({ ...current, instanceName: event.target.value }));
                }}
                value={formState.instanceName}
              />
            </div>
            <div className="field">
              <label htmlFor="instance-date-mode">Date Mode</label>
              <select
                className="field-control"
                id="instance-date-mode"
                onChange={(event) =>
                  setFormState((current) => ({
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
                value={formState.dateMode}
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
                onChange={(event) => setFormState((current) => ({ ...current, location: event.target.value }))}
                placeholder="Optional"
                value={formState.location}
              />
            </div>
            {formState.dateMode === "single" ? (
              <div className="field">
                <label htmlFor="instance-single-date">Date</label>
                <input
                  className="field-control"
                  id="instance-single-date"
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, dates: [event.target.value] }))
                  }
                  type="date"
                  value={formState.dates[0] ?? ""}
                />
              </div>
            ) : null}
            {formState.dateMode === "range" ? (
              <div className="field field--wide collateral-instance-range">
                <div className="field">
                  <label htmlFor="instance-range-start">Start Date</label>
                  <input
                    className="field-control"
                    id="instance-range-start"
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        dates: [event.target.value, current.dates[1] ?? ""]
                      }))
                    }
                    type="date"
                    value={formState.dates[0] ?? ""}
                  />
                </div>
                <div className="field">
                  <label htmlFor="instance-range-end">End Date</label>
                  <input
                    className="field-control"
                    id="instance-range-end"
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        dates: [current.dates[0] ?? "", event.target.value]
                      }))
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
                    <div className="quick-add-array-field__row" key={`instance-date-${index}`}>
                      <input
                        className="field-control"
                        onChange={(event) =>
                          setFormState((current) => ({
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
                          setFormState((current) => ({
                            ...current,
                            dates: current.dates.filter((_, entryIndex) => entryIndex !== index)
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
                      setFormState((current) => ({
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
                className="field-control field-control--textarea"
                id="instance-notes"
                onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Optional context for this occurrence"
                rows={4}
                value={formState.notes}
              />
            </div>
          </div>
        </div>

        <div className="quick-add-actions">
          <button className="button-link button-link--inline-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="topbar__button" disabled={!isValid} onClick={handleCreate} type="button">
            Create Event Instance
          </button>
        </div>
      </section>
    </div>
  );
}

function createInitialFormState(definition: EventTypeDefinition | null): CreateInstanceFormState {
  if (!definition) {
    return {
      eventTypeId: "",
      instanceName: "",
      dateMode: "range",
      dates: getDefaultDatesForEventDateMode("range"),
      location: "",
      notes: ""
    };
  }

  const dates = getDefaultDatesForEventDateMode(definition.dateMode);

  return {
    eventTypeId: definition.key,
    instanceName: createSuggestedEventInstanceName(definition.label, definition.dateMode, dates),
    dateMode: definition.dateMode,
    dates,
    location: "",
    notes: ""
  };
}
