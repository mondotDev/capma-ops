"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getPublicationTemplates } from "@/lib/publication-templates";
import { initialActionItems, LEGACY_SAMPLE_ITEM_IDS, type ActionItem } from "@/lib/sample-data";
import {
  DEFAULT_OWNER,
  getSuggestedEventGroupForWorkstream,
  getSuggestedOwnerForWorkstream,
  type IssueRecord,
  type IssueStatus,
  getGeneratedIssues,
  getIssueDueDate,
  getWorkstreamForIssue,
  normalizeEventGroupValue,
  normalizeOwnerValue,
  normalizeWorkstreamValue
} from "@/lib/ops-utils";

export type NewActionItem = Omit<ActionItem, "id" | "lastUpdated">;
export type GenerateDeliverablesResult = {
  created: number;
  skipped: number;
};
export type AppStateSnapshot = {
  version: 1;
  exportedAt: string;
  items: ActionItem[];
  issueStatuses: Partial<Record<string, IssueStatus>>;
};
export type ImportAppStateResult = {
  itemCount: number;
  usedLegacyFormat: boolean;
};

type AppStateContextValue = {
  items: ActionItem[];
  issues: IssueRecord[];
  addItem: (item: NewActionItem) => void;
  bulkUpdateItems: (ids: string[], updates: Partial<ActionItem>) => void;
  deleteItem: (id: string) => void;
  completeIssue: (issue: string) => void;
  exportAppStateSnapshot: () => AppStateSnapshot;
  generateMissingDeliverablesForIssue: (issue: string) => GenerateDeliverablesResult;
  generateIssueDeliverables: (issue: string) => GenerateDeliverablesResult;
  importAppStateSnapshot: (value: unknown) => ImportAppStateResult;
  openIssue: (issue: string) => GenerateDeliverablesResult;
  resetAppState: () => void;
  setIssueStatus: (issue: string, status: IssueStatus) => void;
  updateItem: (id: string, updates: Partial<ActionItem>) => void;
};

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);
const APP_STATE_STORAGE_KEY = "capma-ops-state";

type PersistedAppState = {
  items: ActionItem[];
  issueStatuses: Partial<Record<string, IssueStatus>>;
};

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ActionItem[]>(getDefaultItems);
  const [issueStatuses, setIssueStatuses] = useState<Partial<Record<string, IssueStatus>>>({});
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const savedState = loadPersistedAppState();

    if (savedState) {
      setItems(migratePersistedItems(savedState.items));
      setIssueStatuses(savedState.issueStatuses);
    }

    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    savePersistedAppState({
      items,
      issueStatuses
    });
  }, [hasHydrated, issueStatuses, items]);

  function addItem(item: NewActionItem) {
    setItems((current) => [createActionItem(item), ...current]);
  }

  function deleteItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function generateIssueDeliverables(issue: string): GenerateDeliverablesResult {
    const workstream = getWorkstreamForIssue(issue);

    if (!workstream) {
      return { created: 0, skipped: 0 };
    }

    const templates = getPublicationTemplates(workstream);
    let result: GenerateDeliverablesResult = { created: 0, skipped: 0 };

    setItems((current) => {
      const additions: ActionItem[] = [];
      const issueDueDate = getIssueDueDate(issue) ?? "";

      for (const template of templates) {
        const exists = current.some(
          (item) => item.issue === issue && item.workstream === workstream && item.title === template.title
        );

        if (exists) {
          result = { ...result, skipped: result.skipped + 1 };
          continue;
        }

        additions.push(
          createActionItem({
            type: "Deliverable",
            title: template.title,
            workstream,
            issue,
            dueDate: issueDueDate,
            status: "Not Started",
            owner: template.defaultOwner,
            waitingOn: "",
            notes: ""
          })
        );
      }

      result = { ...result, created: additions.length };
      return additions.length > 0 ? [...additions, ...current] : current;
    });

    return result;
  }

  function generateMissingDeliverablesForIssue(issue: string): GenerateDeliverablesResult {
    return generateIssueDeliverables(issue);
  }

  function openIssue(issue: string): GenerateDeliverablesResult {
    setIssueStatuses((current) => ({
      ...current,
      [issue]: "Open"
    }));

    return generateIssueDeliverables(issue);
  }

  function setIssueStatus(issue: string, status: IssueStatus) {
    setIssueStatuses((current) => ({
      ...current,
      [issue]: status
    }));
  }

  function completeIssue(issue: string) {
    setIssueStatuses((current) => ({
      ...current,
      [issue]: "Complete"
    }));
  }

  function resetAppState() {
    clearPersistedAppState();
    setItems(getDefaultItems());
    setIssueStatuses({});
  }

  const value = useMemo(
    () => ({
    items,
    issues: getGeneratedIssues(issueStatuses),
    addItem,
    bulkUpdateItems: (ids: string[], updates: Partial<ActionItem>) => {
      const idSet = new Set(ids);

      setItems((current) =>
        current.map((item) =>
          idSet.has(item.id)
            ? {
                ...item,
                ...normalizeActionItem({ ...item, ...updates }),
                lastUpdated: updates.lastUpdated ?? new Date().toISOString().slice(0, 10)
              }
            : item
        )
      );
    },
    deleteItem,
    completeIssue,
    exportAppStateSnapshot: () => createAppStateSnapshot(items, issueStatuses),
    generateMissingDeliverablesForIssue,
    generateIssueDeliverables,
    importAppStateSnapshot: (value: unknown) => {
      const parsedState = parseImportedAppState(value);

      if (!parsedState) {
        throw new Error("That file is not a valid CAPMA Ops Hub backup.");
      }

      setItems(parsedState.items.map((item) => normalizeActionItem(item)));
      setIssueStatuses(parsedState.issueStatuses);

      return {
        itemCount: parsedState.items.length,
        usedLegacyFormat: parsedState.usedLegacyFormat
      };
    },
    openIssue,
    resetAppState,
    setIssueStatus,
    updateItem: (id: string, updates: Partial<ActionItem>) => {
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                ...normalizeActionItem({ ...item, ...updates }),
                lastUpdated: updates.lastUpdated ?? new Date().toISOString().slice(0, 10)
              }
            : item
        )
      );
    }
    }),
    [issueStatuses, items]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }

  return context;
}

function createActionItem(item: NewActionItem): ActionItem {
  const normalizedItem = normalizeActionItem({
    ...item,
    eventGroup: item.eventGroup ?? getSuggestedEventGroupForWorkstream(item.workstream),
    owner: resolveInitialOwner(item.owner, item.workstream)
  });
  const slug = item.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const timestamp = Date.now().toString(36);

  return {
    ...normalizedItem,
    id: `${slug || "item"}-${timestamp}`,
    lastUpdated: new Date().toISOString().slice(0, 10)
  };
}

function getDefaultItems() {
  return initialActionItems.map((item) => normalizeActionItem({ ...item }));
}

function loadPersistedAppState(): PersistedAppState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawState = window.localStorage.getItem(APP_STATE_STORAGE_KEY);

    if (!rawState) {
      return null;
    }

    const parsedState = JSON.parse(rawState) as Partial<PersistedAppState>;

    if (!Array.isArray(parsedState.items) || !isIssueStatusMap(parsedState.issueStatuses)) {
      return null;
    }

    const items = parsedState.items.filter(isActionItemRecord);

    if (items.length !== parsedState.items.length) {
      return null;
    }

    return {
      items: items.map((item) => normalizeActionItem(item)),
      issueStatuses: parsedState.issueStatuses
    };
  } catch {
    return null;
  }
}

function savePersistedAppState(state: PersistedAppState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(state));
}

export function clearPersistedAppState() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(APP_STATE_STORAGE_KEY);
}

function isActionItemRecord(value: unknown): value is ActionItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<ActionItem>;

  return [
    item.id,
    item.title,
    item.type,
    item.workstream,
    item.dueDate,
    item.status,
    item.owner,
    item.waitingOn,
    item.lastUpdated,
    item.notes
  ].every((field) => typeof field === "string") &&
    (item.blocked === undefined || typeof item.blocked === "boolean") &&
    (item.blockedBy === undefined || typeof item.blockedBy === "string") &&
    (item.issue === undefined || typeof item.issue === "string") &&
    (item.eventGroup === undefined || typeof item.eventGroup === "string");
}

function createAppStateSnapshot(
  items: ActionItem[],
  issueStatuses: Partial<Record<string, IssueStatus>>
): AppStateSnapshot {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    items: items.map((item) => ({ ...item })),
    issueStatuses: { ...issueStatuses }
  };
}

function isIssueStatusMap(
  value: Partial<Record<string, IssueStatus>> | undefined
): value is Partial<Record<string, IssueStatus>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(
    (status) => status === "Planned" || status === "Open" || status === "Complete"
  );
}

function normalizeActionItem<T extends Pick<ActionItem, "owner" | "workstream"> & Partial<Pick<ActionItem, "eventGroup">>>(item: T): T {
  return {
    ...item,
    owner: normalizeOwnerValue(item.owner),
    workstream: normalizeWorkstreamValue(item.workstream),
    eventGroup: normalizeEventGroupValue(item.eventGroup)
  };
}

function migratePersistedItems(items: ActionItem[]) {
  const legacySampleIds = new Set<string>(LEGACY_SAMPLE_ITEM_IDS);

  if (items.length > 0 && items.every((item) => legacySampleIds.has(item.id))) {
    return getDefaultItems();
  }

  return items.map((item) => normalizeActionItem(item));
}

function parseImportedAppState(value: unknown): (PersistedAppState & { usedLegacyFormat: boolean }) | null {
  if (Array.isArray(value)) {
    const items = value.filter(isActionItemRecord);

    if (items.length !== value.length) {
      return null;
    }

    return {
      items,
      issueStatuses: {},
      usedLegacyFormat: true
    };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const snapshot = value as Partial<AppStateSnapshot>;

  if (!Array.isArray(snapshot.items) || !isIssueStatusMap(snapshot.issueStatuses)) {
    return null;
  }

  const items = snapshot.items.filter(isActionItemRecord);

  if (items.length !== snapshot.items.length) {
    return null;
  }

  return {
    items,
    issueStatuses: snapshot.issueStatuses,
    usedLegacyFormat: false
  };
}

function resolveInitialOwner(owner: string, workstream: string) {
  const trimmedOwner = owner.trim();

  if (trimmedOwner.length > 0 && trimmedOwner !== DEFAULT_OWNER) {
    return trimmedOwner;
  }

  return (getSuggestedOwnerForWorkstream(workstream) ?? trimmedOwner) || DEFAULT_OWNER;
}
