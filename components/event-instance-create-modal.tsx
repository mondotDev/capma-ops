"use client";

import { useEffect, useMemo, useState } from "react";
import type { CreateEventInstanceInput } from "@/lib/state/app-state-types";
import { type EventDateMode } from "@/lib/event-instances";
import {
  getDefaultDatesForEventDateMode,
  type EventTypeDefinition,
  validateEventInstanceCreationInput
} from "@/lib/event-type-definitions";

type CuratedEventOption = {
  id: string;
  label: string;
  titleFormat: "month-year" | "year";
};

type CreateInstanceFormState = {
  eventTypeId: string;
  instanceName: string;
  dateMode: EventDateMode;
  dates: string[];
  location: string;
  notes: string;
};

const CURATED_EVENT_OPTIONS: CuratedEventOption[] = [
  { id: "first-friday", label: "First Friday", titleFormat: "month-year" },
  { id: "monday-mingle", label: "Monday Mingle", titleFormat: "month-year" },
  { id: "pest-ed", label: "Pest Ed", titleFormat: "year" },
  { id: "termite-academy", label: "Termite Academy", titleFormat: "year" },
  { id: "Hands-On", label: "Hands-On", titleFormat: "month-year" },
  { id: "best-pest-expo", label: "Best Pest Expo", titleFormat: "year" },
  { id: "development-summit", label: "Development Summit", titleFormat: "year" }
];

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
  const curatedEventOptions = useMemo(
    () =>
      CURATED_EVENT_OPTIONS.map((option) => {
        const matchingDefinition = availableEventTypeDefinitions.find((definition) => definition.key === option.id);

        return {
          ...option,
          dateMode: matchingDefinition?.dateMode ?? "range"
        };
      }),
    [availableEventTypeDefinitions]
  );
  const selectedEventOption = curatedEventOptions.find((option) => option.id === formState.eventTypeId) ?? null;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setFormState(createInitialFormState());
  }, [isOpen]);

  useEffect(() => {
    setFormState((current) => {
      const nextTitle = buildGeneratedEventTitle({
        eventTypeId: current.eventTypeId,
        dates: current.dates,
        options: curatedEventOptions
      });

      if (nextTitle === current.instanceName) {
        return current;
      }

      return {
        ...current,
        instanceName: nextTitle
      };
    });
  }, [curatedEventOptions, formState.dates, formState.eventTypeId]);

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
              <label htmlFor="instance-event-type">Event Family</label>
              <select
                className="field-control"
                id="instance-event-type"
                onChange={(event) =>
                  setFormState((current) => {
                    const nextOption = curatedEventOptions.find((option) => option.id === event.target.value) ?? null;
                    const nextDateMode = nextOption?.dateMode ?? current.dateMode;
                    const nextDates =
                      nextDateMode === current.dateMode
                        ? current.dates
                        : getDefaultDatesForEventDateMode(nextDateMode);

                    return {
                      ...current,
                      eventTypeId: event.target.value,
                      dateMode: nextDateMode,
                      dates: nextDates
                    };
                  })
                }
                value={formState.eventTypeId}
              >
                <option value="">Select an event family</option>
                {curatedEventOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="field__hint">
                Choose from the curated event families used for normal event setup.
              </div>
            </div>
            <div className="field">
              <label htmlFor="instance-name">Generated Event Title</label>
              <input
                className="field-control"
                id="instance-name"
                readOnly
                value={formState.instanceName}
              />
              <div className="field__hint">
                {selectedEventOption
                  ? "The event title is generated automatically from the selected event family and date."
                  : "Select an event family and date to generate the event title."}
              </div>
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

function buildGeneratedEventTitle(input: {
  eventTypeId: string;
  dates: string[];
  options: Array<CuratedEventOption & { dateMode: EventDateMode }>;
}) {
  const selectedOption = input.options.find((option) => option.id === input.eventTypeId);
  const primaryDate = input.dates.find((date) => date.trim().length > 0) ?? "";

  if (!selectedOption || !primaryDate) {
    return "";
  }

  const [year, month] = primaryDate.split("-");

  if (!year) {
    return "";
  }

  if (selectedOption.titleFormat === "year") {
    return `${selectedOption.label} - ${year}`;
  }

  const monthLabel = getMonthLabel(month);

  if (!monthLabel) {
    return "";
  }

  return `${selectedOption.label} - ${monthLabel} - ${year}`;
}

function getMonthLabel(month: string | undefined) {
  const monthIndex = Number(month) - 1;
  const monthLabels = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];

  return monthLabels[monthIndex] ?? "";
}
