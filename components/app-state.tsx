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
  normalizeCollateralUpdateType,
  type CollateralItem,
  type LegDayCollateralProfile
} from "@/lib/collateral-data";
import {
  getDefaultTemplatePackForEventType,
  getTemplateItemsForPack,
  getTemplateSubEventsForPack
} from "@/lib/collateral-templates";
import {
  deriveEventDateRange,
  initialEventFamilies,
  initialEventInstances,
  initialEventSubEvents,
  initialEventTypes,
  resolveActiveEventInstanceId,
  type EventDateMode,
  type EventFamily,
  type EventInstance,
  type EventSubEvent,
  type EventType
} from "@/lib/event-instances";
import { initialActionItems, LEGACY_SAMPLE_ITEM_IDS, type ActionItem } from "@/lib/sample-data";
import {
  type IssueRecord,
  type IssueStatus,
  type WorkstreamSchedule,
  DEFAULT_OWNER,
  getDefaultWorkstreamSchedules,
  getGeneratedIssues,
  normalizeNoteEntries,
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

export type CollateralProfilesByInstance = Record<string, LegDayCollateralProfile>;

export type CreateEventInstanceInput = {
  eventTypeId: string;
  instanceName: string;
  dateMode: EventDateMode;
  dates: string[];
  location?: string;
  notes?: string;
};

type AppStateContextValue = {
  items: ActionItem[];
  issues: IssueRecord[];
  collateralItems: CollateralItem[];
  collateralProfiles: CollateralProfilesByInstance;
  activeEventInstanceId: string;
  defaultOwnerForNewItems: string;
  eventFamilies: EventFamily[];
  eventTypes: EventType[];
  eventInstances: EventInstance[];
  eventSubEvents: EventSubEvent[];
  workstreamSchedules: WorkstreamSchedule[];
  addItem: (item: NewActionItem) => void;
  addCollateralItem: (item: Omit<CollateralItem, "id" | "lastUpdated">) => string;
  applyDefaultTemplateToInstance: (instanceId: string) => boolean;
  bulkUpdateItems: (ids: string[], updates: Partial<ActionItem>) => void;
  createEventInstance: (input: CreateEventInstanceInput) => string;
  deleteItem: (id: string) => void;
  deleteCollateralItem: (id: string) => void;
  completeIssue: (issue: string) => CompletePublicationIssueResult;
  exportAppStateSnapshot: () => AppStateSnapshot;
  generateMissingDeliverablesForIssue: (issue: string) => GenerateDeliverablesResult;
  generateIssueDeliverables: (issue: string) => GenerateDeliverablesResult;
  importAppStateSnapshot: (value: unknown) => ImportAppStateResult;
  openIssue: (issue: string) => GenerateDeliverablesResult;
  resetAppState: () => void;
  setActiveEventInstanceId: (instanceId: string) => void;
  setCollateralProfile: (instanceId: string, profile: LegDayCollateralProfile) => void;
  setDefaultOwnerForNewItems: (owner: string) => void;
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
  const [collateralProfiles, setCollateralProfiles] = useState<CollateralProfilesByInstance>(getDefaultCollateralProfiles);
  const [activeEventInstanceId, setActiveEventInstanceIdState] = useState<string>(getDefaultActiveEventInstanceId);
  const [defaultOwnerForNewItems, setDefaultOwnerForNewItemsState] = useState<string>(getDefaultOwnerForNewItems);
  const [eventFamilies, setEventFamilies] = useState<EventFamily[]>(getDefaultEventFamilies);
  const [eventTypes, setEventTypes] = useState<EventType[]>(getDefaultEventTypes);
  const [eventInstances, setEventInstances] = useState<EventInstance[]>(getDefaultEventInstances);
  const [eventSubEvents, setEventSubEvents] = useState<EventSubEvent[]>(getDefaultEventSubEvents);
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
      setCollateralProfiles(loadResult.state.collateralProfiles);
      setActiveEventInstanceIdState(loadResult.state.activeEventInstanceId);
      setDefaultOwnerForNewItemsState(loadResult.state.defaultOwnerForNewItems);
      setEventFamilies(loadResult.state.eventFamilies);
      setEventTypes(loadResult.state.eventTypes);
      setEventInstances(loadResult.state.eventInstances);
      setEventSubEvents(loadResult.state.eventSubEvents);
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
      collateralProfiles,
      activeEventInstanceId,
      defaultOwnerForNewItems,
      eventFamilies,
      eventTypes,
      eventInstances,
      eventSubEvents,
      workstreamSchedules
    });
  }, [activeEventInstanceId, collateralItems, collateralProfiles, defaultOwnerForNewItems, eventFamilies, eventInstances, eventSubEvents, eventTypes, hasHydrated, issueStatuses, items, shouldPersist, workstreamSchedules]);

  useEffect(() => {
    const resolvedInstanceId = resolveActiveEventInstanceId(activeEventInstanceId, eventInstances);

    if (resolvedInstanceId !== activeEventInstanceId) {
      setActiveEventInstanceIdState(resolvedInstanceId);
    }
  }, [activeEventInstanceId, eventInstances]);

  function enablePersistence() {
    setShouldPersist(true);
  }

  function setActiveEventInstanceId(instanceId: string) {
    enablePersistence();
    setActiveEventInstanceIdState(instanceId);
  }

  function setDefaultOwnerForNewItems(owner: string) {
    enablePersistence();
    setDefaultOwnerForNewItemsState(owner);
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

  function createEventInstance(input: CreateEventInstanceInput) {
    enablePersistence();
    const { dates, startDate, endDate } = deriveEventDateRange(input.dateMode, input.dates);
    const nextId = `${slugify(input.instanceName)}-${crypto.randomUUID().slice(0, 8)}`;

    setEventInstances((current) =>
      [...current, {
        id: nextId,
        eventTypeId: input.eventTypeId,
        name: input.instanceName,
        dateMode: input.dateMode,
        dates,
        startDate,
        endDate,
        location: input.location?.trim() ? input.location.trim() : undefined,
        notes: input.notes?.trim() ? input.notes.trim() : undefined
      }].sort((a, b) => a.startDate.localeCompare(b.startDate))
    );

    if (input.eventTypeId === "legislative-day") {
      setCollateralProfiles((current) => ({
        ...current,
        [nextId]: {
          ...initialLegDayCollateralProfile,
          eventStartDate: startDate,
          eventEndDate: endDate
        }
      }));
    }

    setActiveEventInstanceIdState(nextId);
    return nextId;
  }

  function applyDefaultTemplateToInstance(instanceId: string) {
    const instance = eventInstances.find((entry) => entry.id === instanceId);

    if (!instance) {
      return false;
    }

    const pack = getDefaultTemplatePackForEventType(instance.eventTypeId);

    if (!pack) {
      return false;
    }

    const templateSubEvents = getTemplateSubEventsForPack(pack.id);
    const templateItems = getTemplateItemsForPack(pack.id);
    const existingItemOrigins = new Set(
      collateralItems
        .filter((item) => item.eventInstanceId === instanceId && item.templateOriginId)
        .map((item) => item.templateOriginId as string)
    );
    const existingByName = new Map(
      eventSubEvents
        .filter((subEvent) => subEvent.eventInstanceId === instanceId)
        .map((subEvent) => [subEvent.name, subEvent.id])
    );
    const nextSubEventIdsByTemplateId = new Map<string, string>();
    const subEventAdditions = templateSubEvents
      .filter((templateSubEvent) => !existingByName.has(templateSubEvent.name))
      .map((templateSubEvent) => {
        const nextId = `${instanceId}-${slugify(templateSubEvent.name)}`;
        nextSubEventIdsByTemplateId.set(templateSubEvent.id, nextId);
        return {
          id: nextId,
          eventInstanceId: instanceId,
          name: templateSubEvent.name,
          sortOrder: templateSubEvent.sortOrder
        };
      });

    for (const templateSubEvent of templateSubEvents) {
      const existingId = existingByName.get(templateSubEvent.name);
      if (existingId) {
        nextSubEventIdsByTemplateId.set(templateSubEvent.id, existingId);
      }
    }

    if (subEventAdditions.length > 0) {
      setEventSubEvents((current) => [...current, ...subEventAdditions]);
    }

    setCollateralItems((current) => {
      const additions = templateItems
        .filter((templateItem) => !existingItemOrigins.has(templateItem.id))
        .map((templateItem) => ({
          id: `collateral-${crypto.randomUUID()}`,
          eventInstanceId: instanceId,
          subEventId: nextSubEventIdsByTemplateId.get(templateItem.templateSubEventId) ?? `${instanceId}-unassigned`,
          templateOriginId: templateItem.id,
          itemName: templateItem.name,
          status: templateItem.defaultStatus as CollateralItem["status"],
          owner: defaultOwnerForNewItems,
          blockedBy: "",
          dueDate: "",
          printer: templateItem.defaultPrinter,
          quantity: templateItem.defaultQuantity,
          updateType: normalizeCollateralUpdateType(templateItem.defaultUpdateType),
          noteEntries: normalizeNoteEntries(undefined, templateItem.defaultNotes, new Date().toISOString()),
          lastUpdated: new Date().toISOString().slice(0, 10)
        }));

      return [...additions, ...current];
    });

    return true;
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
    setCollateralProfiles(getDefaultCollateralProfiles());
    setActiveEventInstanceIdState(getDefaultActiveEventInstanceId());
    setDefaultOwnerForNewItemsState(getDefaultOwnerForNewItems());
    setEventFamilies(getDefaultEventFamilies());
    setEventTypes(getDefaultEventTypes());
    setEventInstances(getDefaultEventInstances());
    setEventSubEvents(getDefaultEventSubEvents());
    setWorkstreamSchedulesState(getDefaultWorkstreamSchedules());
  }

  const value = useMemo(
    () => ({
    items,
    issues: getGeneratedIssues(issueStatuses),
    collateralItems,
    collateralProfiles,
    activeEventInstanceId,
    defaultOwnerForNewItems,
    eventFamilies,
    eventTypes,
    eventInstances,
    eventSubEvents,
    workstreamSchedules,
    addItem,
    addCollateralItem,
    applyDefaultTemplateToInstance,
    bulkUpdateItems: (ids: string[], updates: Partial<ActionItem>) => {
      enablePersistence();
      setItems((current) => applyBulkActionItemUpdates(current, ids, updates));
    },
    createEventInstance,
    deleteItem,
    deleteCollateralItem,
    completeIssue,
    exportAppStateSnapshot: () =>
      createAppStateSnapshot(
        items,
        issueStatuses,
        collateralItems,
        collateralProfiles,
        activeEventInstanceId,
        defaultOwnerForNewItems,
        eventFamilies,
        eventTypes,
        eventInstances,
        eventSubEvents,
        workstreamSchedules
      ),
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
      setCollateralProfiles(parsedState.collateralProfiles);
      setActiveEventInstanceIdState(parsedState.activeEventInstanceId);
      setDefaultOwnerForNewItemsState(parsedState.defaultOwnerForNewItems);
      setEventFamilies(parsedState.eventFamilies);
      setEventTypes(parsedState.eventTypes);
      setEventInstances(parsedState.eventInstances);
      setEventSubEvents(parsedState.eventSubEvents);
      setWorkstreamSchedulesState(parsedState.workstreamSchedules);

      return {
        itemCount: parsedState.items.length,
        usedLegacyFormat: parsedState.usedLegacyFormat
      };
    },
    openIssue,
    resetAppState,
    setActiveEventInstanceId,
    setCollateralProfile: (instanceId: string, profile: LegDayCollateralProfile) => {
      enablePersistence();
      setCollateralProfiles((current) => ({
        ...current,
        [instanceId]: profile
      }));
    },
    setDefaultOwnerForNewItems: (owner: string) => {
      setDefaultOwnerForNewItems(owner);
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
    [activeEventInstanceId, collateralItems, collateralProfiles, defaultOwnerForNewItems, eventFamilies, eventInstances, eventSubEvents, eventTypes, issueStatuses, items, workstreamSchedules]
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

function getDefaultCollateralProfiles() {
  return {
    [initialEventInstances[0].id]: { ...initialLegDayCollateralProfile }
  };
}

function getDefaultActiveEventInstanceId() {
  return initialEventInstances[0]?.id ?? "";
}

function getDefaultOwnerForNewItems() {
  return DEFAULT_OWNER;
}

function getDefaultEventFamilies() {
  return initialEventFamilies.map((family) => ({ ...family }));
}

function getDefaultEventTypes() {
  return initialEventTypes.map((eventType) => ({ ...eventType }));
}

function getDefaultEventInstances() {
  return initialEventInstances.map((instance) => ({ ...instance }));
}

function getDefaultEventSubEvents() {
  return initialEventSubEvents.map((subEvent) => ({ ...subEvent }));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
