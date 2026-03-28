"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  clearPersistedAppState,
  loadPersistedAppState,
  migratePersistedItems,
  savePersistedAppState
} from "@/lib/app-persistence";
import {
  createAppStateSnapshot,
  parseImportedAppState,
  type AppStateSnapshot
} from "@/lib/app-transfer";
import { getPublicationTemplates } from "@/lib/publication-templates";
import { initialActionItems, LEGACY_SAMPLE_ITEM_IDS, type ActionItem } from "@/lib/sample-data";
import {
  DEFAULT_OWNER,
  getSuggestedEventGroupForWorkstream,
  type IssueRecord,
  type IssueStatus,
  getGeneratedIssues,
  getIssueDueDate,
  getWorkstreamForIssue,
  normalizeActionItemFields,
  resolveInitialOwner
} from "@/lib/ops-utils";

export { clearPersistedAppState };
export type { AppStateSnapshot };

export type NewActionItem = Omit<ActionItem, "id" | "lastUpdated">;
export type GenerateDeliverablesResult = {
  created: number;
  skipped: number;
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

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ActionItem[]>(getDefaultItems);
  const [issueStatuses, setIssueStatuses] = useState<Partial<Record<string, IssueStatus>>>({});
  const [hasHydrated, setHasHydrated] = useState(false);
  const [shouldPersist, setShouldPersist] = useState(true);

  useEffect(() => {
    const loadResult = loadPersistedAppState(normalizeActionItemFields);

    if (loadResult.state) {
      setItems(
        migratePersistedItems(loadResult.state.items, {
          legacySampleItemIds: LEGACY_SAMPLE_ITEM_IDS,
          getDefaultItems,
          normalizeItem: normalizeActionItemFields
        })
      );
      setIssueStatuses(loadResult.state.issueStatuses);
    }

    setShouldPersist(loadResult.shouldPersist);
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated || !shouldPersist) {
      return;
    }

    savePersistedAppState({
      items,
      issueStatuses
    });
  }, [hasHydrated, issueStatuses, items, shouldPersist]);

  function enablePersistence() {
    setShouldPersist(true);
  }

  function addItem(item: NewActionItem) {
    enablePersistence();
    setItems((current) => [createActionItem(item), ...current]);
  }

  function deleteItem(id: string) {
    enablePersistence();
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function generateIssueDeliverables(issue: string): GenerateDeliverablesResult {
    const workstream = getWorkstreamForIssue(issue);

    if (!workstream) {
      return { created: 0, skipped: 0 };
    }

    enablePersistence();
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
    enablePersistence();
    setIssueStatuses((current) => ({
      ...current,
      [issue]: "Open"
    }));

    return generateIssueDeliverables(issue);
  }

  function setIssueStatus(issue: string, status: IssueStatus) {
    enablePersistence();
    setIssueStatuses((current) => ({
      ...current,
      [issue]: status
    }));
  }

  function completeIssue(issue: string) {
    enablePersistence();
    setIssueStatuses((current) => ({
      ...current,
      [issue]: "Complete"
    }));
  }

  function resetAppState() {
    clearPersistedAppState();
    enablePersistence();
    setItems(getDefaultItems());
    setIssueStatuses({});
  }

  const value = useMemo(
    () => ({
    items,
    issues: getGeneratedIssues(issueStatuses),
    addItem,
    bulkUpdateItems: (ids: string[], updates: Partial<ActionItem>) => {
      enablePersistence();
      const idSet = new Set(ids);

      setItems((current) =>
        current.map((item) =>
          idSet.has(item.id)
            ? {
                ...item,
                ...normalizeActionItemFields({ ...item, ...updates }),
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

      enablePersistence();
      setItems(parsedState.items.map((item) => normalizeActionItemFields(item)));
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
      enablePersistence();
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                ...normalizeActionItemFields({ ...item, ...updates }),
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
  const normalizedItem = normalizeActionItemFields({
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
  return initialActionItems.map((item) => normalizeActionItemFields({ ...item }));
}
