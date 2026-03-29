"use client";

import type { FormEvent } from "react";
import type { ActionItemValidation, IssueRecord } from "@/lib/ops-utils";
import {
  EVENT_GROUP_OPTIONS,
  getContextualDueDateLabel,
  getOwnerOptions,
  shouldRequireIssue,
  STATUS_OPTIONS,
  WAITING_ON_SUGGESTIONS,
  WORKSTREAM_OPTIONS
} from "@/lib/ops-utils";

const ITEM_TYPE_OPTIONS = ["Task", "Deliverable", "Collateral"] as const;

export type QuickAddFormState = {
  type: string;
  title: string;
  workstream: string;
  eventGroup: string;
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
  selectedIssueRecord,
  canGenerateDeliverables,
  generationFeedback,
  onClose,
  onSubmit,
  onFieldChange,
  onGenerateDeliverables
}: QuickAddModalProps) {
  if (!isOpen) {
    return null;
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
        className="quick-add-modal"
        role="dialog"
      >
        <div className="quick-add-modal__header">
          <div>
            <h2 className="quick-add-modal__title" id="quick-add-title">
              Quick Add
            </h2>
            <p className="quick-add-modal__subtitle">Create a new task, deliverable, or collateral item.</p>
          </div>
          <button className="button-link" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <form className="quick-add-form" onSubmit={onSubmit}>
          <div className="quick-add-grid">
            <div className="field">
              <label htmlFor="quick-add-type">Item Type</label>
              <select
                className={validation.type ? "field-control field-control--invalid" : "field-control"}
                id="quick-add-type"
                onChange={(event) => onFieldChange("type", event.target.value)}
                value={formState.type}
              >
                <option value="">Select type</option>
                {ITEM_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="field field--wide">
              <label htmlFor="quick-add-title-input">Title</label>
              <input
                className={validation.title ? "field-control field-control--invalid" : "field-control"}
                id="quick-add-title-input"
                onChange={(event) => onFieldChange("title", event.target.value)}
                value={formState.title}
              />
            </div>

            <div className="field">
              <label htmlFor="quick-add-workstream">Workstream</label>
              <select
                className={validation.workstream ? "field-control field-control--invalid" : "field-control"}
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

            <div className="field">
              <label htmlFor="quick-add-event-group">Event Group</label>
              <select
                className="field-control"
                id="quick-add-event-group"
                onChange={(event) => onFieldChange("eventGroup", event.target.value)}
                value={formState.eventGroup}
              >
                <option value="">None</option>
                {EVENT_GROUP_OPTIONS.map((option) => (
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
                    {!selectedIssueRecord.dueDate ? " — missing due date" : ""}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="field">
              <label htmlFor="quick-add-due-date">
                {getContextualDueDateLabel(formState.status, formState.isBlocked)}
              </label>
              <input
                className={validation.dueDate ? "field-control field-control--invalid" : "field-control"}
                id="quick-add-due-date"
                onChange={(event) => onFieldChange("dueDate", event.target.value)}
                type="date"
                value={formState.dueDate}
              />
              {formState.status === "Waiting" ? (
                <div className="field-hint">Use this date for the next check-in while the item is waiting.</div>
              ) : formState.isBlocked ? (
                <div className="field-hint">Use this date for the next step needed to unblock the work.</div>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="quick-add-owner">Owner</label>
              <select
                className={validation.owner ? "field-control field-control--invalid" : "field-control"}
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

            <div className="field">
              <label htmlFor="quick-add-status">Status</label>
              <select
                className={validation.status ? "field-control field-control--invalid" : "field-control"}
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

            <div className="field">
              <label className="toggle" htmlFor="quick-add-blocked">
                <input
                  checked={formState.isBlocked}
                  id="quick-add-blocked"
                  onChange={(event) => onFieldChange("isBlocked", event.target.checked)}
                  type="checkbox"
                />
                <span>Blocked</span>
              </label>
            </div>

            <div className="field">
              <label htmlFor="quick-add-blocked-by">Blocked By</label>
              <input
                className="field-control"
                id="quick-add-blocked-by"
                onChange={(event) => onFieldChange("blockedBy", event.target.value)}
                value={formState.blockedBy}
              />
            </div>

            <div className="field field--wide">
              <label htmlFor="quick-add-notes">Initial Note</label>
              <textarea
                className="field-control"
                id="quick-add-notes"
                onChange={(event) => onFieldChange("notes", event.target.value)}
                rows={5}
                value={formState.notes}
              />
            </div>
          </div>

          <div className="quick-add-validation">
            {validation.isValid ? (
              <span className="muted">Required fields: type, title, workstream, due date, owner, status.</span>
            ) : (
              <span className="quick-add-validation__message">
                Fill the highlighted fields to save this item.
              </span>
            )}
            {generationFeedback ? (
              <span className="quick-add-feedback">{generationFeedback}</span>
            ) : null}
          </div>

          <div className="quick-add-actions">
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
