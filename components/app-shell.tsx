"use client";

import { Suspense, startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type GenerateDeliverablesResult, type NewActionItem, useAppState } from "@/components/app-state";
import {
  createActionNoteEntry,
  DEFAULT_OWNER,
  EVENT_GROUP_OPTIONS,
  getContextualDueDateLabel,
  getIssuesForWorkstream,
  LOCAL_FALLBACK_NOTE_AUTHOR,
  getOwnerOptions,
  STATUS_OPTIONS,
  syncActionItemIssue,
  syncActionItemStatus,
  syncActionItemWorkstream,
  shouldRequireIssue,
  validateActionItemInput,
  WAITING_ON_SUGGESTIONS,
  WORKSTREAM_OPTIONS
} from "@/lib/ops-utils";

const ITEM_TYPE_OPTIONS = ["Task", "Deliverable", "Collateral"] as const;

type QuickAddFormState = {
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    addItem,
    exportAppStateSnapshot,
    generateIssueDeliverables,
    importAppStateSnapshot,
    issues,
    resetAppState
  } = useAppState();
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isResetPending, setIsResetPending] = useState(false);
  const [isImportPending, setIsImportPending] = useState(false);
  const [pendingImportPayload, setPendingImportPayload] = useState<unknown>(null);
  const [pendingImportFileName, setPendingImportFileName] = useState("");
  const [settingsFeedback, setSettingsFeedback] = useState("");
  const [formState, setFormState] = useState<QuickAddFormState>(createInitialFormState());
  const [generationFeedback, setGenerationFeedback] = useState<string>("");
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const validation = useMemo(() => validateActionItemInput(formState), [formState]);
  const availableIssues = useMemo(() => getIssuesForWorkstream(formState.workstream), [formState.workstream]);
  const selectedIssueRecord = useMemo(
    () => issues.find((issue) => issue.label === formState.issue) ?? null,
    [formState.issue, issues]
  );
  const canGenerateDeliverables =
    formState.issue.length > 0 && (formState.workstream === "Newsbrief" || formState.workstream === "The Voice");

  useEffect(() => {
    if (!isQuickAddOpen && !isSettingsOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsQuickAddOpen(false);
        closeSettings();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isQuickAddOpen, isSettingsOpen]);

  function openQuickAdd() {
    setFormState(createInitialFormState());
    setGenerationFeedback("");
    setIsQuickAddOpen(true);
  }

  function closeQuickAdd() {
    setIsQuickAddOpen(false);
    setGenerationFeedback("");
  }

  function openSettings() {
    setIsResetPending(false);
    setIsImportPending(false);
    setPendingImportPayload(null);
    setPendingImportFileName("");
    setSettingsFeedback("");
    setIsSettingsOpen(true);
  }

  function closeSettings() {
    setIsSettingsOpen(false);
    setIsResetPending(false);
    setIsImportPending(false);
    setPendingImportPayload(null);
    setPendingImportFileName("");
    setSettingsFeedback("");
  }

  function handleResetLocalData() {
    resetAppState();
    closeSettings();
  }

  function handleExportData() {
    const exportDate = new Date().toISOString().slice(0, 10);
    const snapshot = exportAppStateSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = `capma-ops-export-${exportDate}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
    setSettingsFeedback(`Exported ${snapshot.items.length} item${snapshot.items.length === 1 ? "" : "s"}.`);
  }

  function handleImportButtonClick() {
    setSettingsFeedback("");
    importInputRef.current?.click();
  }

  async function handleImportFileChange(event: { target: HTMLInputElement }) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText);

      setPendingImportPayload(parsed);
      setPendingImportFileName(file.name);
      setIsImportPending(true);
      setSettingsFeedback("");
    } catch {
      setPendingImportPayload(null);
      setPendingImportFileName("");
      setIsImportPending(false);
      setSettingsFeedback("That file could not be imported. Use a valid CAPMA Ops Hub JSON export.");
    } finally {
      event.target.value = "";
    }
  }

  function handleConfirmImport() {
    if (!pendingImportPayload) {
      return;
    }

    try {
      const result = importAppStateSnapshot(pendingImportPayload);
      setSettingsFeedback(
        result.usedLegacyFormat
          ? `Imported ${result.itemCount} items from a legacy export. Issue statuses were reset.`
          : `Imported ${result.itemCount} items and restored issue statuses.`
      );
      setPendingImportPayload(null);
      setPendingImportFileName("");
      setIsImportPending(false);
    } catch (error) {
      setSettingsFeedback(error instanceof Error ? error.message : "Import failed.");
      setPendingImportPayload(null);
      setPendingImportFileName("");
      setIsImportPending(false);
    }
  }

  function updateField<Key extends keyof QuickAddFormState>(field: Key, value: QuickAddFormState[Key]) {
    setGenerationFeedback("");
    setFormState((current) => {
      if (field === "status") {
        return syncActionItemStatus(current, value as string);
      }

      if (field === "workstream") {
        return syncActionItemWorkstream(current, value as string);
      }

      if (field === "issue") {
        return syncActionItemIssue(current, value as string);
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

    const initialNoteEntry = createActionNoteEntry(formState.notes, { author: LOCAL_FALLBACK_NOTE_AUTHOR });

    addItem({
      type: formState.type,
      title: formState.title.trim(),
      workstream: formState.workstream.trim(),
      eventGroup: formState.eventGroup || undefined,
      issue: formState.issue || undefined,
      dueDate: formState.dueDate,
      owner: formState.owner,
      status: formState.status,
      waitingOn: formState.waitingOn,
      isBlocked: formState.isBlocked || undefined,
      blockedBy: formState.blockedBy,
      noteEntries: initialNoteEntry ? [initialNoteEntry] : []
    } satisfies NewActionItem);

    closeQuickAdd();
  }

  function handleGenerateDeliverables() {
    if (!canGenerateDeliverables) {
      return;
    }

    const result = generateIssueDeliverables(formState.issue);
    setGenerationFeedback(formatGenerationFeedback(result));
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
        <div className="sidebar__footer">
          <button aria-label="Open settings" className="sidebar__settings" onClick={openSettings} type="button">
            <span aria-hidden="true">⚙</span>
          </button>
        </div>
      </aside>
      <div className="content">
        <header className="topbar">
          <button className="topbar__button" onClick={openQuickAdd} type="button">
            + Add Item
          </button>
          <Suspense fallback={<TopbarSearchFallback pathname={pathname} />}>
            <TopbarSearch pathname={pathname} />
          </Suspense>
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

                <div className="field">
                  <label htmlFor="quick-add-event-group">Event Group</label>
                  <select
                    className="field-control"
                    id="quick-add-event-group"
                    onChange={(event) => updateField("eventGroup", event.target.value)}
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
                    onChange={(event) => updateField("dueDate", event.target.value)}
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
                    onChange={(event) => updateField("owner", event.target.value)}
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

                <div className="field">
                  <label className="toggle" htmlFor="quick-add-blocked">
                    <input
                      checked={formState.isBlocked}
                      id="quick-add-blocked"
                      onChange={(event) => updateField("isBlocked", event.target.checked)}
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
                    onChange={(event) => updateField("blockedBy", event.target.value)}
                    value={formState.blockedBy}
                  />
                </div>

                <div className="field field--wide">
                  <label htmlFor="quick-add-notes">Initial Note</label>
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
                {generationFeedback ? (
                  <span className="quick-add-feedback">{generationFeedback}</span>
                ) : null}
              </div>

              <div className="quick-add-actions">
                {canGenerateDeliverables ? (
                  <button className="button-link button-link--inline-secondary" onClick={handleGenerateDeliverables} type="button">
                    Generate Issue Deliverables
                  </button>
                ) : null}
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

      {isSettingsOpen ? (
        <div className="modal-layer" role="presentation">
          <button aria-label="Close settings" className="modal-backdrop" onClick={closeSettings} type="button" />
          <section aria-labelledby="settings-title" aria-modal="true" className="settings-modal" role="dialog">
            <div className="quick-add-modal__header">
              <div>
                <h2 className="quick-add-modal__title" id="settings-title">
                  Settings
                </h2>
                <p className="quick-add-modal__subtitle">Local app controls for testing and cleanup.</p>
              </div>
              <button className="button-link" onClick={closeSettings} type="button">
                Close
              </button>
            </div>

            <div className="settings-section">
              <div className="settings-section__header">
                <h3 className="drawer-section__title">Backup</h3>
                <p className="field-hint">Download or restore local app state as a JSON backup file.</p>
              </div>

              <div className="settings-actions">
                <button className="button-link button-link--inline-secondary" onClick={handleExportData} type="button">
                  Export Data
                </button>
                <button className="button-link button-link--inline-secondary" onClick={handleImportButtonClick} type="button">
                  Import Data
                </button>
              </div>

              <input
                accept=".json,application/json"
                className="visually-hidden"
                onChange={handleImportFileChange}
                ref={importInputRef}
                type="file"
              />

              {isImportPending ? (
                <div className="confirm-delete">
                  <div className="confirm-delete__title">Import backup data?</div>
                  <div className="confirm-delete__copy">
                    This will replace the current local app state with {pendingImportFileName || "the selected file"}.
                  </div>
                  <div className="confirm-delete__actions">
                    <button
                      className="button-link button-link--inline-secondary"
                      onClick={() => {
                        setIsImportPending(false);
                        setPendingImportPayload(null);
                        setPendingImportFileName("");
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button className="topbar__button" onClick={handleConfirmImport} type="button">
                      Import
                    </button>
                  </div>
                </div>
              ) : null}

              {settingsFeedback ? <div className="field-hint">{settingsFeedback}</div> : null}
            </div>

            <div className="settings-section">
              <div className="settings-section__header">
                <h3 className="drawer-section__title">Local Data</h3>
                <p className="field-hint">Reset saved app changes and return to the default seeded state.</p>
              </div>

              {isResetPending ? (
                <div className="confirm-delete">
                  <div className="confirm-delete__title">Reset local data?</div>
                  <div className="confirm-delete__copy">
                    This will clear saved changes and restore the default sample state.
                  </div>
                  <div className="confirm-delete__actions">
                    <button
                      className="button-link button-link--inline-secondary"
                      onClick={() => setIsResetPending(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button className="button-danger" onClick={handleResetLocalData} type="button">
                      Reset
                    </button>
                  </div>
                </div>
              ) : (
                <button className="button-danger" onClick={() => setIsResetPending(true)} type="button">
                  Reset Local Data
                </button>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function formatGenerationFeedback(result: GenerateDeliverablesResult) {
  if (result.created === 0 && result.skipped === 0) {
    return "No deliverables generated.";
  }

  if (result.skipped === 0) {
    return `${result.created} deliverable${result.created === 1 ? "" : "s"} created.`;
  }

  if (result.created === 0) {
    return `${result.skipped} skipped because they already exist.`;
  }

  return `${result.created} created, ${result.skipped} skipped because they already exist.`;
}

function createInitialFormState(): QuickAddFormState {
  return {
    type: "",
    title: "",
    workstream: "",
    eventGroup: "",
    issue: "",
    dueDate: "",
    owner: DEFAULT_OWNER,
    status: "Not Started",
    waitingOn: "",
    isBlocked: false,
    blockedBy: "",
    notes: ""
  };
}

function TopbarSearch({ pathname }: { pathname: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeQuery = pathname === "/action" ? searchParams.get("q")?.trim() ?? "" : "";
  const [searchValue, setSearchValue] = useState(activeQuery);

  useEffect(() => {
    setSearchValue(activeQuery);
  }, [activeQuery]);

  function handleSearchChange(value: string) {
    setSearchValue(value);

    if (pathname !== "/action") {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());

    if (!value.trim()) {
      params.delete("q");
    } else {
      params.set("q", value);
    }

    const query = params.toString();

    startTransition(() => {
      router.replace(query ? `/action?${query}` : "/action");
    });
  }

  return (
    <input
      aria-label="Search"
      className="topbar__search"
      disabled={pathname !== "/action"}
      onChange={(event) => handleSearchChange(event.target.value)}
      placeholder={pathname === "/action" ? "Search Action View" : "Search available in Action View"}
      type="search"
      value={searchValue}
    />
  );
}

function TopbarSearchFallback({ pathname }: { pathname: string }) {
  return (
    <input
      aria-label="Search"
      className="topbar__search"
      disabled
      placeholder={pathname === "/action" ? "Search Action View" : "Search available in Action View"}
      type="search"
      value=""
      readOnly
    />
  );
}
