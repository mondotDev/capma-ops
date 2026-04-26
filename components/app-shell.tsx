"use client";

import { Suspense, startTransition, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type GenerateDeliverablesResult,
  type NewActionItem,
  useAppActions,
  useAppStateValues
} from "@/components/app-state";
import { QuickAddModal, type QuickAddFormState } from "@/components/quick-add-modal";
import {
  getEventProgramForWorkstream,
  reconcileQuickAddEventSelectionOnWorkstreamChange,
  type QuickAddManualEventSelection
} from "@/lib/action/action-item-ux";
import {
  createActionNoteEntry,
  DEFAULT_OWNER,
  getIssuesForWorkstream,
  getOwnerOptions,
  LOCAL_FALLBACK_NOTE_AUTHOR,
  syncActionItemIssue,
  syncActionItemStatus,
  syncActionItemWorkstream,
  validateActionItemInput
} from "@/lib/ops-utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    activeEventInstanceId,
    defaultOwnerForNewItems,
    eventInstances,
    eventSubEvents,
    eventTypes,
    issues
  } = useAppStateValues();
  const {
    addItem,
    clearLocalAppState,
    exportAppStateSnapshot,
    generateIssueDeliverables,
    importAppStateSnapshot,
    resetAppState,
    setDefaultOwnerForNewItems
  } = useAppActions();
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pendingResetMode, setPendingResetMode] = useState<"seeded" | "blank" | null>(null);
  const [isImportPending, setIsImportPending] = useState(false);
  const [pendingImportPayload, setPendingImportPayload] = useState<unknown>(null);
  const [pendingImportFileName, setPendingImportFileName] = useState("");
  const [settingsFeedback, setSettingsFeedback] = useState("");
  const [formState, setFormState] = useState<QuickAddFormState>(() =>
    createInitialFormState({
      activeEventInstanceId,
      defaultOwner: defaultOwnerForNewItems,
      eventInstances,
      eventTypes
    })
  );
  const [generationFeedback, setGenerationFeedback] = useState<string>("");
  const quickAddManualEventSelectionRef = useRef<QuickAddManualEventSelection>({
    eventProgramId: null,
    eventInstanceId: ""
  });
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const validation = useMemo(() => validateActionItemInput(formState), [formState]);
  const availableIssues = useMemo(() => getIssuesForWorkstream(formState.workstream), [formState.workstream]);
  const selectedIssueRecord = useMemo(
    () => issues.find((issue) => issue.label === formState.issue) ?? null,
    [formState.issue, issues]
  );
  const availableQuickAddSubEvents = useMemo(
    () =>
      formState.eventInstanceId
        ? eventSubEvents.filter((subEvent) => subEvent.eventInstanceId === formState.eventInstanceId)
        : [],
    [eventSubEvents, formState.eventInstanceId]
  );
  const canGenerateDeliverables =
    formState.issue.length > 0 && (formState.workstream === "News Brief" || formState.workstream === "The Voice");
  const showActionViewControls = pathname === "/action";

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
    setFormState(createInitialFormState({
      activeEventInstanceId,
      defaultOwner: defaultOwnerForNewItems,
      eventInstances,
      eventTypes
    }));
    quickAddManualEventSelectionRef.current = { eventProgramId: null, eventInstanceId: "" };
    setGenerationFeedback("");
    setIsQuickAddOpen(true);
  }

  function closeQuickAdd() {
    setIsQuickAddOpen(false);
    quickAddManualEventSelectionRef.current = { eventProgramId: null, eventInstanceId: "" };
    setGenerationFeedback("");
  }

  function openSettings() {
    setPendingResetMode(null);
    setIsImportPending(false);
    setPendingImportPayload(null);
    setPendingImportFileName("");
    setSettingsFeedback("");
    setIsSettingsOpen(true);
  }

  function closeSettings() {
    setIsSettingsOpen(false);
    setPendingResetMode(null);
    setIsImportPending(false);
    setPendingImportPayload(null);
    setPendingImportFileName("");
    setSettingsFeedback("");
  }

  function handleResetToSeededDemoState() {
    resetAppState();
    closeSettings();
  }

  function handleClearAllLocalData() {
    clearLocalAppState();
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
          ? `Imported ${result.itemCount} items from a legacy export. Issue statuses were reset, and collateral/settings used defaults.`
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
        const nextWorkstream = value as string;
        const nextState = syncActionItemWorkstream(current, nextWorkstream);
        const nextEventSelection = reconcileQuickAddEventSelectionOnWorkstreamChange({
          currentEventInstanceId: current.eventInstanceId,
          currentSubEventId: current.subEventId,
          nextWorkstream,
          manualSelection: quickAddManualEventSelectionRef.current,
          eventInstances,
          eventPrograms: eventTypes
        });
        quickAddManualEventSelectionRef.current = nextEventSelection.manualSelection;

        return {
          ...nextState,
          eventInstanceId: nextEventSelection.eventInstanceId,
          subEventId: nextEventSelection.subEventId
        };
      }

      if (field === "issue") {
        return syncActionItemIssue(current, value as string);
      }

      if (field === "eventInstanceId") {
        const currentEventProgram = getEventProgramForWorkstream(current.workstream, eventTypes);
        quickAddManualEventSelectionRef.current = {
          eventProgramId: currentEventProgram?.id ?? null,
          eventInstanceId: value as string
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

    const initialNoteEntry = createActionNoteEntry(formState.notes, { author: LOCAL_FALLBACK_NOTE_AUTHOR });

    addItem({
      type: formState.type,
      title: formState.title.trim(),
      workstream: formState.workstream.trim(),
      operationalBucket: formState.operationalBucket || undefined,
      eventInstanceId: formState.eventInstanceId || undefined,
      subEventId: formState.subEventId || undefined,
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
          <Link
            className={pathname === "/collateral" ? "sidebar__link active" : "sidebar__link"}
            href="/collateral"
          >
            Collateral
          </Link>
        </nav>
        <div className="sidebar__footer">
          <button aria-label="Open settings" className="sidebar__settings" onClick={openSettings} type="button">
            <span aria-hidden="true">Ã¢Å¡â„¢</span>
          </button>
        </div>
      </aside>
      <div className="content">
        <header className="topbar">
          {showActionViewControls ? (
            <button className="topbar__button" onClick={openQuickAdd} type="button">
              + Add Item
            </button>
          ) : null}
          {showActionViewControls ? (
            <Suspense fallback={<TopbarSearchFallback pathname={pathname} />}>
              <TopbarSearch pathname={pathname} />
            </Suspense>
          ) : null}
        </header>
        <main className="page">{children}</main>
      </div>

        <QuickAddModal
          availableIssues={availableIssues}
          availableEventInstances={eventInstances}
          availableEventPrograms={eventTypes}
          availableSubEvents={availableQuickAddSubEvents}
          canGenerateDeliverables={canGenerateDeliverables}
          formState={formState}
          generationFeedback={generationFeedback}
        isOpen={isQuickAddOpen}
        onClose={closeQuickAdd}
        onFieldChange={updateField}
        onGenerateDeliverables={handleGenerateDeliverables}
        onSubmit={handleSubmit}
        selectedIssueRecord={selectedIssueRecord}
        validation={validation}
      />
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
                <h3 className="drawer-section__title">Defaults</h3>
                <p className="field-hint">Set lightweight defaults used for newly created or template-applied collateral items.</p>
              </div>

              <div className="field">
                <label htmlFor="default-owner-for-new-items">Default Owner for New Items</label>
                <select
                  className="field-control"
                  id="default-owner-for-new-items"
                  onChange={(event) => setDefaultOwnerForNewItems(event.target.value)}
                  value={defaultOwnerForNewItems}
                >
                  <option value="">No default owner</option>
                  {getOwnerOptions(defaultOwnerForNewItems || DEFAULT_OWNER).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="settings-section">
              <div className="settings-section__header">
                <h3 className="drawer-section__title">Local Data</h3>
                <p className="field-hint">
                  Choose whether to restore the seeded demo data or clear local app state to a true blank slate.
                </p>
              </div>

              {pendingResetMode === "seeded" ? (
                <div className="confirm-delete">
                  <div className="confirm-delete__title">Reset to seeded demo state?</div>
                  <div className="confirm-delete__copy">
                    This will clear saved changes and restore the default sample state.
                  </div>
                  <div className="confirm-delete__actions">
                    <button
                      className="button-link button-link--inline-secondary"
                      onClick={() => setPendingResetMode(null)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button className="button-danger" onClick={handleResetToSeededDemoState} type="button">
                      Reset
                    </button>
                  </div>
                </div>
              ) : null}

              {pendingResetMode === "blank" ? (
                <div className="confirm-delete">
                  <div className="confirm-delete__title">Clear all local data?</div>
                  <div className="confirm-delete__copy">
                    This will remove all local events, placements, sponsors, collateral setup, and action items so you can test from a blank slate.
                  </div>
                  <div className="confirm-delete__actions">
                    <button
                      className="button-link button-link--inline-secondary"
                      onClick={() => setPendingResetMode(null)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button className="button-danger" onClick={handleClearAllLocalData} type="button">
                      Clear All Local Data
                    </button>
                  </div>
                </div>
              ) : null}

              {pendingResetMode === null ? (
                <div className="settings-actions">
                  <button
                    className="button-link button-link--inline-secondary"
                    onClick={() => setPendingResetMode("seeded")}
                    type="button"
                  >
                    Reset to Seeded Demo State
                  </button>
                  <button className="button-danger" onClick={() => setPendingResetMode("blank")} type="button">
                    Clear All Local Data
                  </button>
                </div>
              ) : null}
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

function createInitialFormState(input?: {
  activeEventInstanceId?: string;
  defaultOwner?: string;
  eventInstances?: Array<{ id: string; eventTypeId: string }>;
  eventTypes?: Array<{ id: string; name: string }>;
}): QuickAddFormState {
  const activeEventInstance = input?.eventInstances?.find((instance) => instance.id === input.activeEventInstanceId);
  const activeEventWorkstream =
    activeEventInstance
      ? input?.eventTypes?.find((eventType) => eventType.id === activeEventInstance.eventTypeId)?.name ?? ""
      : "";

  return {
    type: "Task",
    title: "",
    workstream: activeEventWorkstream,
    operationalBucket: "",
    eventInstanceId: activeEventInstance?.id ?? "",
    subEventId: "",
    issue: "",
    dueDate: "",
    owner: input?.defaultOwner?.trim() || DEFAULT_OWNER,
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

