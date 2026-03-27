"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type NewActionItem, useAppState } from "@/components/app-state";
import {
  DEFAULT_OWNER,
  getIssueDueDate,
  getIssuesForWorkstream,
  getWorkstreamForIssue,
  isIssueMissingDueDate,
  STATUS_OPTIONS,
  shouldRequireIssue,
  WAITING_ON_SUGGESTIONS,
  WORKSTREAM_OPTIONS
} from "@/lib/ops-utils";

const ITEM_TYPE_OPTIONS = ["Task", "Deliverable", "Collateral"] as const;

type QuickAddFormState = {
  type: string;
  title: string;
  workstream: string;
  issue: string;
  dueDate: string;
  owner: string;
  status: string;
  waitingOn: string;
  notes: string;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { addItem } = useAppState();
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [formState, setFormState] = useState<QuickAddFormState>(createInitialFormState());
  const validation = useMemo(() => getValidation(formState), [formState]);
  const availableIssues = useMemo(() => getIssuesForWorkstream(formState.workstream), [formState.workstream]);

  useEffect(() => {
    if (!isQuickAddOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsQuickAddOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isQuickAddOpen]);

  function openQuickAdd() {
    setFormState(createInitialFormState());
    setIsQuickAddOpen(true);
  }

  function closeQuickAdd() {
    setIsQuickAddOpen(false);
  }

  function updateField<Key extends keyof QuickAddFormState>(field: Key, value: QuickAddFormState[Key]) {
    setFormState((current) => {
      if (field === "status") {
        return {
          ...current,
          status: value as string,
          waitingOn: value === "Waiting" ? current.waitingOn : ""
        };
      }

      if (field === "workstream") {
        const nextWorkstream = value as string;
        const nextIssues = getIssuesForWorkstream(nextWorkstream);
        const nextIssue =
          current.issue && nextIssues.includes(current.issue as (typeof nextIssues)[number])
            ? current.issue
            : "";

        return {
          ...current,
          workstream: nextWorkstream,
          issue: nextIssue,
          dueDate: nextIssue ? (getIssueDueDate(nextIssue) ?? current.dueDate) : current.dueDate
        };
      }

      if (field === "issue") {
        const nextIssue = value as string;

        return {
          ...current,
          issue: nextIssue,
          workstream: nextIssue ? (getWorkstreamForIssue(nextIssue) ?? current.workstream) : current.workstream,
          dueDate: nextIssue ? (getIssueDueDate(nextIssue) ?? "") : current.dueDate
        };
      }

      return {
        ...current,
        [field]: value
      };
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validation.isValid) {
      return;
    }

    addItem({
      type: formState.type,
      title: formState.title.trim(),
      workstream: formState.workstream.trim(),
      issue: formState.issue || undefined,
      dueDate: formState.dueDate,
      owner: formState.owner.trim(),
      status: formState.status,
      waitingOn: formState.waitingOn,
      notes: formState.notes.trim()
    } satisfies NewActionItem);

    closeQuickAdd();
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__brand">CAPMA Ops Hub</div>
        <nav className="sidebar__nav" aria-label="Primary">
          <Link className={pathname === "/" ? "sidebar__link active" : "sidebar__link"} href="/">
            Dashboard
          </Link>
          <Link
            className={pathname === "/action" ? "sidebar__link active" : "sidebar__link"}
            href="/action"
          >
            Action View
          </Link>
        </nav>
      </aside>
      <div className="content">
        <header className="topbar">
          <button className="topbar__button" onClick={openQuickAdd} type="button">
            + Add Item
          </button>
          <input
            aria-label="Search"
            className="topbar__search"
            placeholder="Search"
            type="search"
          />
        </header>
        <main className="page">{children}</main>
      </div>

      {isQuickAddOpen ? (
        <div className="modal-layer" role="presentation">
          <button
            aria-label="Close quick add"
            className="modal-backdrop"
            onClick={closeQuickAdd}
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
              <button className="button-link" onClick={closeQuickAdd} type="button">
                Close
              </button>
            </div>

            <form className="quick-add-form" onSubmit={handleSubmit}>
              <div className="quick-add-grid">
                <div className="field">
                  <label htmlFor="quick-add-type">Item Type</label>
                  <select
                    className={validation.type ? "field-control field-control--invalid" : "field-control"}
                    id="quick-add-type"
                    onChange={(event) => updateField("type", event.target.value)}
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
                    onChange={(event) => updateField("title", event.target.value)}
                    value={formState.title}
                  />
                </div>

                <div className="field">
                  <label htmlFor="quick-add-workstream">Workstream</label>
                  <select
                    className={validation.workstream ? "field-control field-control--invalid" : "field-control"}
                    id="quick-add-workstream"
                    onChange={(event) => updateField("workstream", event.target.value)}
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

                {availableIssues.length > 0 ? (
                  <div className="field">
                    <label htmlFor="quick-add-issue">Issue</label>
                    <select
                      className={validation.issue ? "field-control field-control--invalid" : "field-control"}
                      id="quick-add-issue"
                      onChange={(event) => updateField("issue", event.target.value)}
                      value={formState.issue}
                    >
                      <option value="">{shouldRequireIssue(formState.type, formState.workstream) ? "Select issue" : "None"}</option>
                      {availableIssues.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className="field">
                  <label htmlFor="quick-add-due-date">Due Date</label>
                  <input
                    className={validation.dueDate ? "field-control field-control--invalid" : "field-control"}
                    id="quick-add-due-date"
                    onChange={(event) => updateField("dueDate", event.target.value)}
                    type="date"
                    value={formState.dueDate}
                  />
                </div>

                <div className="field">
                  <label htmlFor="quick-add-owner">Owner</label>
                  <input
                    className={validation.owner ? "field-control field-control--invalid" : "field-control"}
                    id="quick-add-owner"
                    onChange={(event) => updateField("owner", event.target.value)}
                    value={formState.owner}
                  />
                </div>

                <div className="field">
                  <label htmlFor="quick-add-status">Status</label>
                  <select
                    className={validation.status ? "field-control field-control--invalid" : "field-control"}
                    id="quick-add-status"
                    onChange={(event) => updateField("status", event.target.value)}
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
                    onChange={(event) => updateField("waitingOn", event.target.value)}
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

                <div className="field field--wide">
                  <label htmlFor="quick-add-notes">Notes</label>
                  <textarea
                    className="field-control"
                    id="quick-add-notes"
                    onChange={(event) => updateField("notes", event.target.value)}
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
              </div>

              <div className="quick-add-actions">
                <button className="button-link button-link--inline-secondary" onClick={closeQuickAdd} type="button">
                  Cancel
                </button>
                <button className="topbar__button" disabled={!validation.isValid} type="submit">
                  Save Item
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function createInitialFormState(): QuickAddFormState {
  return {
    type: "",
    title: "",
    workstream: "",
    issue: "",
    dueDate: "",
    owner: DEFAULT_OWNER,
    status: "Not Started",
    waitingOn: "",
    notes: ""
  };
}

function getValidation(formState: QuickAddFormState) {
  const validation = {
    type: formState.type.trim().length === 0,
    title: formState.title.trim().length === 0,
    workstream: formState.workstream.trim().length === 0,
    issue: shouldRequireIssue(formState.type, formState.workstream) && formState.issue.length === 0,
    dueDate: formState.dueDate.length === 0 && !isIssueMissingDueDate(formState.issue),
    owner: formState.owner.trim().length === 0,
    status: formState.status.trim().length === 0,
    waitingOn: formState.status === "Waiting" && formState.waitingOn.length === 0
  };

  return {
    ...validation,
    isValid: Object.values(validation).every((value) => !value)
  };
}
