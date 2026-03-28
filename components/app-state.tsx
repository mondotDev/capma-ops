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
import {
  generatePublicationIssueDeliverables,
  openPublicationIssue,
  setPublicationIssueStatus,
  type GenerateDeliverablesResult
} from "@/lib/publication-issue-actions";
import {
  applyBulkActionItemUpdates,
  applyActionItemUpdates,
  createActionItem,
  normalizeActionItems,
  type NewActionItemInput
} from "@/lib/action-item-mutations";
import { initialActionItems, LEGACY_SAMPLE_ITEM_IDS, type ActionItem } from "@/lib/sample-data";
import {
  type IssueRecord,
  type IssueStatus,
  getGeneratedIssues,
  normalizeActionItemFields
} from "@/lib/ops-utils";

export { clearPersistedAppState };
export type { AppStateSnapshot };

export type NewActionItem = NewActionItemInput;
export type { GenerateDeliverablesResult };
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
    enablePersistence();
    let result: GenerateDeliverablesResult = { created: 0, skipped: 0 };
    setItems((current) => {
      const nextState = generatePublicationIssueDeliverables(current, issue);
      result = nextState.result;
      return nextState.items;
    });

    return result;
  }

  function generateMissingDeliverablesForIssue(issue: string): GenerateDeliverablesResult {
    return generateIssueDeliverables(issue);
  }

  function openIssue(issue: string): GenerateDeliverablesResult {
    enablePersistence();
    let result: GenerateDeliverablesResult = { created: 0, skipped: 0 };

    setItems((currentItems) => {
      let nextItems = currentItems;

      setIssueStatuses((currentIssueStatuses) => {
        const nextState = openPublicationIssue(currentItems, currentIssueStatuses, issue);
        nextItems = nextState.items;
        result = nextState.result;
        return nextState.issueStatuses;
      });

      return nextItems;
    });

    return result;
  }

  function setIssueStatus(issue: string, status: IssueStatus) {
    enablePersistence();
    setIssueStatuses((current) => setPublicationIssueStatus(current, issue, status));
  }

  function completeIssue(issue: string) {
    enablePersistence();
    setIssueStatuses((current) => setPublicationIssueStatus(current, issue, "Complete"));
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
      setItems((current) => applyBulkActionItemUpdates(current, ids, updates));
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
      setItems(normalizeActionItems(parsedState.items));
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
      setItems((current) => current.map((item) => (item.id === id ? applyActionItemUpdates(item, updates) : item)));
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

function getDefaultItems() {
  return normalizeActionItems(initialActionItems);
}
