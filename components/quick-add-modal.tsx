"use client";

import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import type { EventInstance, EventProgram, EventSubEvent } from "@/lib/event-instances";
import { ACTION_ITEM_MEANING_HINT, getQuickAddMeaningUiState } from "@/lib/action/action-item-ux";
import { openNativeDateInputPicker } from "@/lib/date-input";
import type { ActionItemValidation, IssueRecord } from "@/lib/ops-utils";
import {
  getContextualDueDateLabel,
  getOwnerOptions,
  OPERATIONAL_BUCKET_OPTIONS,
  shouldRequireIssue,
  STATUS_OPTIONS,
  WAITING_ON_SUGGESTIONS,
  WORKSTREAM_OPTIONS
} from "@/lib/ops-utils";

export const QUICK_ADD_ITEM_TYPE_OPTIONS = ["Task", "Deliverable"] as const;

export type QuickAddFormState = {
  type: string;
  title: string;
  workstream: string;
  operationalBucket: string;
  eventInstanceId: string;
  subEventId: string;
  issue: string;
  dueDate: string;
  owner: string;
  status: string;
  waitingOn: string;
  isBlocked: boolean;
  blockedBy: string;
  notes: string;
};

type QuickAddModalProps = {
  isOpen: boolean;
  formState: QuickAddFormState;
  validation: ActionItemValidation;
  availableIssues: string[];
  availableEventInstances: EventInstance[];
  availableEventPrograms: EventProgram[];
  availableSubEvents: EventSubEvent[];
  selectedIssueRecord: IssueRecord | null;
  canGenerateDeliverables: boolean;
  generationFeedback: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFieldChange: <Key extends keyof QuickAddFormState>(field: Key, value: QuickAddFormState[Key]) => void;
  onGenerateDeliverables: () => void;
};

export function QuickAddModal({
  isOpen,
  formState,
  validation,
  availableIssues,
  availableEventInstances,
  availableEventPrograms,
  availableSubEvents,
  selectedIssueRecord,
  canGenerateDeliverables,
  generationFeedback,
  onClose,
  onSubmit,
  onFieldChange,
  onGenerateDeliverables
}: QuickAddModalProps) {
  const blockedByInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      titleInputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const meaningUi = getQuickAddMeaningUiState({
    workstream: formState.workstream,
    eventInstanceId: formState.eventInstanceId,
    eventPrograms: availableEventPrograms
  });
  const selectedEventInstanceName =
    availableEventInstances.find((instance) => instance.id === formState.eventInstanceId)?.name ?? "";

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (event.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (!validation.isValid) {
      return;
    }

    event.preventDefault();
    formRef.current?.requestSubmit();
  }

  return (
    <div className="modal-layer" role="presentation">
      <button
        aria-label="Close quick add"
        className="modal-backdrop"
        onClick={onClose}
        type="button"
      />
      <section
        aria-labelledby="quick-add-title"
        aria-modal="true"
        className="quick-add-modal quick-add-modal--compact"
        role="dialog"
      >
        <div className="quick-add-modal__header quick-add-modal__header--compact">
          <div>
            <h2 className="quick-add-modal__title" id="quick-add-title">
              Add Item
            </h2>
          </div>
          <button className="button-link" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form className="quick-add-form quick-add-form--compact" onKeyDown={handleKeyDown} onSubmit={onSubmit} ref={formRef}>
          <div className="quick-add-title-row">
            <div className="field quick-add-field--title">
              <label htmlFor="quick-add-title-input">Title</label>
              <input
                className="field-control"
                id="quick-add-title-input"
                onChange={(event) => onFieldChange("title", event.target.value)}
                ref={titleInputRef}
                value={formState.title}
              />
            </div>
          </div>

          <div className="quick-add-primary-row">
            <div className="field">
              <label htmlFor="quick-add-status">Status</label>
              <select
                className="field-control"
                id="quick-add-status"
                onChange={(event) => onFieldChange("status", event.target.value)}
                value={formState.status}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="field quick-add-field--date">
              <label htmlFor="quick-add-due-date">
                {getContextualDueDateLabel(formState.status, formState.isBlocked)}
              </label>
              <input
                className="field-control"
                id="quick-add-due-date"
                onClick={(event) => openNativeDateInputPicker(event.currentTarget)}
                onChange={(event) => onFieldChange("dueDate", event.target.value)}
                type="date"
                value={formState.dueDate}
              />
            </div>
          </div>

          <div className="quick-add-meta-row">
            <div className="field">
              <label htmlFor="quick-add-owner">Owner</label>
              <select
                className="field-control"
                id="quick-add-owner"
                onChange={(event) => onFieldChange("owner", event.target.value)}
                value={formState.owner}
              >
                {getOwnerOptions(formState.owner).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className={meaningUi.eventPathActive ? "field field--active" : "field"}>
              <label htmlFor="quick-add-event-instance">Scope</label>
              <select
                className={meaningUi.eventPathMuted ? "field-control field-control--muted" : "field-control"}
                id="quick-add-event-instance"
                onChange={(event) => {
                  const nextEventInstanceId = event.target.value;
                  onFieldChange("eventInstanceId", nextEventInstanceId);
                  onFieldChange("subEventId", "");
                  onFieldChange("operationalBucket", "");
                }}
                value={formState.eventInstanceId}
              >
                <option value="">No event scope</option>
                {availableEventInstances.map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    {instance.name}
                  </option>
                ))}
              </select>
              {selectedEventInstanceName ? <div className="field-hint">Current: {selectedEventInstanceName}</div> : null}
            </div>

            <div className="field">
              <label htmlFor="quick-add-type">Type</label>
              <select
                className="field-control"
                id="quick-add-type"
                onChange={(event) => onFieldChange("type", event.target.value)}
                value={formState.type}
              >
                {QUICK_ADD_ITEM_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <details className="quick-add-details">
            <summary>Add details</summary>
            <div className="quick-add-details__body">
              <div className="quick-add-grid quick-add-grid--compact">
                <div className="field">
                  <label htmlFor="quick-add-workstream">Workstream</label>
                  <select
                    className="field-control"
                    id="quick-add-workstream"
                    onChange={(event) => onFieldChange("workstream", event.target.value)}
                    value={formState.workstream}
                  >
                    <option value="">Select workstream</option>
                    {WORKSTREAM_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={meaningUi.eventPathActive ? "field field--active" : "field field--secondary"}>
                  <label htmlFor="quick-add-sub-event">Sub-Event</label>
                  <select
                    className={meaningUi.subEventDisabled ? "field-control field-control--muted" : "field-control"}
                    disabled={meaningUi.subEventDisabled}
                    id="quick-add-sub-event"
                    onChange={(event) => onFieldChange("subEventId", event.target.value)}
                    value={formState.subEventId}
                  >
                    <option value="">None</option>
                    {availableSubEvents.map((subEvent) => (
                      <option key={subEvent.id} value={subEvent.id}>
                        {subEvent.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  className={
                    meaningUi.operationalPathActive
                      ? "field field--active"
                      : meaningUi.operationalPathMuted
                        ? "field field--secondary"
                        : "field"
                  }
                >
                  <label htmlFor="quick-add-operational-bucket">Operational Bucket</label>
                  <select
                    className={
                      !meaningUi.operationalBucketDisabled && !meaningUi.operationalPathMuted
                        ? "field-control"
                        : "field-control field-control--muted"
                    }
                    disabled={meaningUi.operationalBucketDisabled}
                    id="quick-add-operational-bucket"
                    onChange={(event) => onFieldChange("operationalBucket", event.target.value)}
                    value={formState.operationalBucket}
                  >
                    <option value="">None</option>
                    {OPERATIONAL_BUCKET_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                {availableIssues.length > 0 ? (
                  <div className="field">
                    <label htmlFor="quick-add-issue">Issue</label>
                    <select
                      className={validation.issue ? "field-control field-control--invalid" : "field-control"}
                      id="quick-add-issue"
                      onChange={(event) => onFieldChange("issue", event.target.value)}
                      value={formState.issue}
                    >
                      <option value="">{shouldRequireIssue(formState.type, formState.workstream) ? "Select issue" : "None"}</option>
                      {availableIssues.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    {selectedIssueRecord ? (
                      <div className="field-hint">
                        Status: <strong>{selectedIssueRecord.status}</strong>
                        {!selectedIssueRecord.dueDate ? " - missing due date" : ""}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="field">
                  <label htmlFor="quick-add-waiting-on">Waiting On</label>
                  <select
                    className={
                      validation.waitingOn
                        ? "field-control field-control--invalid"
                        : formState.status !== "Waiting"
                          ? "field-control field-control--muted"
                          : "field-control"
                    }
                    id="quick-add-waiting-on"
                    onChange={(event) => onFieldChange("waitingOn", event.target.value)}
                    value={formState.waitingOn}
                  >
                    <option value="">{formState.status === "Waiting" ? "Required" : "None"}</option>
                    {WAITING_ON_SUGGESTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  className={`quick-add-blocked-group field--wide${formState.isBlocked ? " quick-add-blocked-group--active" : ""}`}
                >
                  <div className="field field--secondary quick-add-field--compact">
                    <label className="toggle" htmlFor="quick-add-blocked">
                      <input
                        checked={formState.isBlocked}
                        id="quick-add-blocked"
                        onChange={(event) => {
                          const nextChecked = event.target.checked;
                          onFieldChange("isBlocked", nextChecked);

                          if (!nextChecked) {
                            onFieldChange("blockedBy", "");
                            return;
                          }

                          requestAnimationFrame(() => {
                            blockedByInputRef.current?.focus();
                            blockedByInputRef.current?.select();
                          });
                        }}
                        type="checkbox"
                      />
                      <span>Blocked</span>
                    </label>
                  </div>

                  {formState.isBlocked ? (
                    <div className="field field--secondary quick-add-blocked-group__detail">
                      <label htmlFor="quick-add-blocked-by">Blocked By</label>
                      <input
                        className="field-control"
                        id="quick-add-blocked-by"
                        onChange={(event) => onFieldChange("blockedBy", event.target.value)}
                        ref={blockedByInputRef}
                        value={formState.blockedBy}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="field field--wide field--secondary">
                  <label htmlFor="quick-add-notes">Initial Note</label>
                  <textarea
                    className="field-control"
                    id="quick-add-notes"
                    onChange={(event) => onFieldChange("notes", event.target.value)}
                    rows={3}
                    value={formState.notes}
                  />
                </div>

                <div className="field field--wide">
                  <div className="field-hint quick-add-context-hint">{ACTION_ITEM_MEANING_HINT}</div>
                </div>
              </div>
            </div>
          </details>

          <div className="quick-add-validation">
            {validation.isValid ? (
              <span className="muted">Press Enter to save, or add details first.</span>
            ) : (
              <span className="muted">Add a title and due date to save.</span>
            )}
            {generationFeedback ? (
              <span className="quick-add-feedback">{generationFeedback}</span>
            ) : null}
          </div>

          <div className="quick-add-actions quick-add-actions--sticky">
            {canGenerateDeliverables ? (
              <button className="button-link button-link--inline-secondary" onClick={onGenerateDeliverables} type="button">
                Generate Issue Deliverables
              </button>
            ) : null}
            <button className="button-link button-link--inline-secondary" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="topbar__button" disabled={!validation.isValid} type="submit">
              Save Item
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
