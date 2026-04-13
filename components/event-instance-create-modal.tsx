"use client";

import { useEffect, useMemo, useState } from "react";
import type { CreateEventInstanceInput } from "@/lib/state/app-state-types";
import { type EventDateMode } from "@/lib/event-instances";
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
  const [formState, setFormState] = useState<CreateInstanceFormState>(() => createInitialFormState());
  const eventTypeSuggestions = useMemo(
    () => availableEventTypeDefinitions.map((definition) => definition.label),
    [availableEventTypeDefinitions]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormState(createInitialFormState());
  }, [isOpen]);

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
      eventTypeId: formState.eventTypeId.trim(),
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
              Create a clean event record and define the structure manually once the event page opens.
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
              <input
                className="field-control"
                list="instance-event-type-suggestions"
                id="instance-event-type"
                onChange={(event) => setFormState((current) => ({ ...current, eventTypeId: event.target.value }))}
                placeholder="Expo"
                value={formState.eventTypeId}
              />
              <datalist id="instance-event-type-suggestions">
                {eventTypeSuggestions.map((eventTypeLabel) => (
                  <option key={eventTypeLabel} value={eventTypeLabel} />
                ))}
              </datalist>
              <div className="field__hint">
                Enter any event label. Existing event labels are available as suggestions, but they are optional.
              </div>
            </div>
            <div className="field">
              <label htmlFor="instance-name">Instance Name</label>
              <input
                className="field-control"
                id="instance-name"
                onChange={(event) => setFormState((current) => ({ ...current, instanceName: event.target.value }))}
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

function createInitialFormState(): CreateInstanceFormState {
  return {
    eventTypeId: "",
    instanceName: "",
    dateMode: "range",
    dates: getDefaultDatesForEventDateMode("range"),
    location: "",
    notes: ""
  };
}
