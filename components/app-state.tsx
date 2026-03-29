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
  completePublicationIssue,
  generatePublicationIssueDeliverables,
  openPublicationIssue,
  setPublicationIssueStatus,
  type CompletePublicationIssueResult,
  type GenerateDeliverablesResult
} from "@/lib/publication-issue-actions";
import {
  applyBulkActionItemUpdates,
  deleteActionItemById,
  normalizeActionItems,
  prependActionItem,
  updateActionItemById,
  type NewActionItemInput
} from "@/lib/action-item-mutations";
import {
  initialLegDayCollateralItems,
  initialLegDayCollateralProfile,
  type CollateralItem,
  type LegDayCollateralProfile
} from "@/lib/collateral-data";
import { initialActionItems, LEGACY_SAMPLE_ITEM_IDS, type ActionItem } from "@/lib/sample-data";
import {
  type IssueRecord,
  type IssueStatus,
  type WorkstreamSchedule,
  getDefaultWorkstreamSchedules,
  getGeneratedIssues,
  normalizeActionItemFields
} from "@/lib/ops-utils";

export { clearPersistedAppState };
export type { AppStateSnapshot };

export type NewActionItem = NewActionItemInput;
export type { GenerateDeliverablesResult };
export type { CompletePublicationIssueResult };
export type ImportAppStateResult = {
  itemCount: number;
  usedLegacyFormat: boolean;
};

type AppStateContextValue = {
  items: ActionItem[];
  issues: IssueRecord[];
  collateralItems: CollateralItem[];
  collateralProfile: LegDayCollateralProfile;
  workstreamSchedules: WorkstreamSchedule[];
  addItem: (item: NewActionItem) => void;
  addCollateralItem: (item: Omit<CollateralItem, "id" | "lastUpdated">) => string;
  bulkUpdateItems: (ids: string[], updates: Partial<ActionItem>) => void;
  deleteItem: (id: string) => void;
  deleteCollateralItem: (id: string) => void;
  completeIssue: (issue: string) => CompletePublicationIssueResult;
  exportAppStateSnapshot: () => AppStateSnapshot;
  generateMissingDeliverablesForIssue: (issue: string) => GenerateDeliverablesResult;
  generateIssueDeliverables: (issue: string) => GenerateDeliverablesResult;
  importAppStateSnapshot: (value: unknown) => ImportAppStateResult;
  openIssue: (issue: string) => GenerateDeliverablesResult;
  resetAppState: () => void;
  setCollateralProfile: (profile: LegDayCollateralProfile) => void;
  setWorkstreamSchedules: (schedules: WorkstreamSchedule[]) => void;
  setIssueStatus: (issue: string, status: IssueStatus) => CompletePublicationIssueResult;
  updateCollateralItem: (id: string, updates: Partial<CollateralItem>) => void;
  updateItem: (id: string, updates: Partial<ActionItem>) => void;
};

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ActionItem[]>(getDefaultItems);
  const [issueStatuses, setIssueStatuses] = useState<Partial<Record<string, IssueStatus>>>({});
  const [collateralItems, setCollateralItems] = useState<CollateralItem[]>(getDefaultCollateralItems);
  const [collateralProfile, setCollateralProfileState] = useState<LegDayCollateralProfile>(getDefaultCollateralProfile);
  const [workstreamSchedules, setWorkstreamSchedulesState] = useState<WorkstreamSchedule[]>(getDefaultWorkstreamSchedules);
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
      setCollateralItems(loadResult.state.collateralItems);
      setCollateralProfileState(loadResult.state.collateralProfile);
      setWorkstreamSchedulesState(loadResult.state.workstreamSchedules);
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
      issueStatuses,
      collateralItems,
      collateralProfile,
      workstreamSchedules
    });
  }, [collateralItems, collateralProfile, hasHydrated, issueStatuses, items, shouldPersist, workstreamSchedules]);

  function enablePersistence() {
    setShouldPersist(true);
  }

  function addItem(item: NewActionItem) {
    enablePersistence();
    setItems((current) => prependActionItem(current, item));
  }

  function deleteItem(id: string) {
    enablePersistence();
    setItems((current) => deleteActionItemById(current, id));
  }

  function addCollateralItem(item: Omit<CollateralItem, "id" | "lastUpdated">) {
    enablePersistence();
    const nextId = `collateral-${crypto.randomUUID()}`;
    setCollateralItems((current) => [
      {
        ...item,
        id: nextId,
        lastUpdated: new Date().toISOString().slice(0, 10)
      },
      ...current
    ]);

    return nextId;
  }

  function updateCollateralItem(id: string, updates: Partial<CollateralItem>) {
    enablePersistence();
    setCollateralItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              ...updates,
              lastUpdated: new Date().toISOString().slice(0, 10)
            }
          : item
      )
    );
  }

  function deleteCollateralItem(id: string) {
    enablePersistence();
    setCollateralItems((current) => current.filter((item) => item.id !== id));
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
    if (status === "Complete") {
      return completeIssue(issue);
    }

    setIssueStatuses((current) => setPublicationIssueStatus(current, issue, status));

    return {
      issueStatuses,
      blockedDeliverables: [],
      completed: true
    };
  }

  function completeIssue(issue: string) {
    enablePersistence();
    let result: CompletePublicationIssueResult = {
      issueStatuses,
      blockedDeliverables: [],
      completed: false
    };

    setIssueStatuses((current) => {
      result = completePublicationIssue(items, current, issue);
      return result.issueStatuses;
    });

    return result;
  }

  function resetAppState() {
    clearPersistedAppState();
    enablePersistence();
    setItems(getDefaultItems());
    setIssueStatuses({});
    setCollateralItems(getDefaultCollateralItems());
    setCollateralProfileState(getDefaultCollateralProfile());
    setWorkstreamSchedulesState(getDefaultWorkstreamSchedules());
  }

  const value = useMemo(
    () => ({
    items,
    issues: getGeneratedIssues(issueStatuses),
    collateralItems,
    collateralProfile,
    workstreamSchedules,
    addItem,
    addCollateralItem,
    bulkUpdateItems: (ids: string[], updates: Partial<ActionItem>) => {
      enablePersistence();
      setItems((current) => applyBulkActionItemUpdates(current, ids, updates));
    },
    deleteItem,
    deleteCollateralItem,
    completeIssue,
    exportAppStateSnapshot: () =>
      createAppStateSnapshot(items, issueStatuses, collateralItems, collateralProfile, workstreamSchedules),
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
      setCollateralItems(parsedState.collateralItems);
      setCollateralProfileState(parsedState.collateralProfile);
      setWorkstreamSchedulesState(parsedState.workstreamSchedules);

      return {
        itemCount: parsedState.items.length,
        usedLegacyFormat: parsedState.usedLegacyFormat
      };
    },
    openIssue,
    resetAppState,
    setCollateralProfile: (profile: LegDayCollateralProfile) => {
      enablePersistence();
      setCollateralProfileState(profile);
    },
    setWorkstreamSchedules: (schedules: WorkstreamSchedule[]) => {
      enablePersistence();
      setWorkstreamSchedulesState(schedules);
    },
    setIssueStatus,
    updateCollateralItem,
    updateItem: (id: string, updates: Partial<ActionItem>) => {
      enablePersistence();
      setItems((current) => updateActionItemById(current, id, updates));
    }
    }),
    [collateralItems, collateralProfile, issueStatuses, items, workstreamSchedules]
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

function getDefaultCollateralItems() {
  return initialLegDayCollateralItems.map((item) => ({ ...item }));
}

function getDefaultCollateralProfile() {
  return { ...initialLegDayCollateralProfile };
}
