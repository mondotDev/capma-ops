"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getPublicationTemplateTitles } from "@/lib/publication-templates";
import { initialActionItems, type ActionItem } from "@/lib/sample-data";
import {
  DEFAULT_OWNER,
  type IssueRecord,
  type IssueStatus,
  getGeneratedIssues,
  getIssueDueDate,
  getWorkstreamForIssue
} from "@/lib/ops-utils";

export type NewActionItem = Omit<ActionItem, "id" | "lastUpdated">;
export type GenerateDeliverablesResult = {
  created: number;
  skipped: number;
};

type AppStateContextValue = {
  items: ActionItem[];
  issues: IssueRecord[];
  addItem: (item: NewActionItem) => void;
  deleteItem: (id: string) => void;
  completeIssue: (issue: string) => void;
  generateMissingDeliverablesForIssue: (issue: string) => GenerateDeliverablesResult;
  generateIssueDeliverables: (issue: string) => GenerateDeliverablesResult;
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
      setItems(savedState.items);
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

    const templateTitles = getPublicationTemplateTitles(workstream);
    let result: GenerateDeliverablesResult = { created: 0, skipped: 0 };

    setItems((current) => {
      const additions: ActionItem[] = [];
      const issueDueDate = getIssueDueDate(issue) ?? "";

      for (const title of templateTitles) {
        const exists = current.some(
          (item) => item.issue === issue && item.workstream === workstream && item.title === title
        );

        if (exists) {
          result = { ...result, skipped: result.skipped + 1 };
          continue;
        }

        additions.push(
          createActionItem({
            type: "Deliverable",
            title,
            workstream,
            issue,
            dueDate: issueDueDate,
            status: "Not Started",
            owner: DEFAULT_OWNER,
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
    deleteItem,
    completeIssue,
    generateMissingDeliverablesForIssue,
    generateIssueDeliverables,
    openIssue,
    resetAppState,
    setIssueStatus,
    updateItem: (id: string, updates: Partial<ActionItem>) => {
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                ...updates,
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
  const slug = item.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const timestamp = Date.now().toString(36);

  return {
    ...item,
    id: `${slug || "item"}-${timestamp}`,
    lastUpdated: new Date().toISOString().slice(0, 10)
  };
}

function getDefaultItems() {
  return initialActionItems.map((item) => ({ ...item }));
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
      items,
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
  ].every((field) => typeof field === "string") && (item.issue === undefined || typeof item.issue === "string");
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
