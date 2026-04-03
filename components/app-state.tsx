"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AppStateSnapshot } from "@/lib/app-transfer";
import {
  completePublicationIssue,
  generatePublicationIssueDeliverables,
  openPublicationIssue,
  setPublicationIssueStatus,
  type CompletePublicationIssueResult,
  type GenerateDeliverablesResult
} from "@/lib/publication-issue-actions";
import {
  type ActionItemMutationContext,
  type NewActionItemInput
} from "@/lib/action-item-mutations";
import {
  getNativeActionItemRecoveryInfo,
  getSelectedNativeActionItemStore,
  getNativeActionItemStoreMode
} from "@/lib/action-item-store";
import {
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
  createUnassignedSubEvent,
  deriveEventDateRange,
  getUnassignedSubEventId,
  resolveActiveEventInstanceId,
  type EventFamily,
  type EventInstance,
  type EventSubEvent,
  type EventType
} from "@/lib/event-instances";
import { nativeActionItemMutator } from "@/lib/native-action-item-mutator";
import type { ActionItem } from "@/lib/sample-data";
import {
  type IssueRecord,
  type IssueStatus,
  type WorkstreamSchedule,
  getDefaultWorkstreamSchedules,
  getGeneratedIssues,
  normalizeNoteEntries
} from "@/lib/ops-utils";
import {
  createDefaultActionItems,
  createDefaultAppStateData,
  createDefaultCollateralItems,
  createDefaultCollateralProfiles,
  createDefaultEventFamilies,
  createDefaultEventInstances,
  createDefaultEventSubEvents,
  createDefaultEventTypes,
  getDefaultActiveEventInstanceId,
  getDefaultOwnerForNewItems
} from "@/lib/state/app-state-defaults";
import { getAppStateRepository } from "@/lib/state/app-state-repository-provider";
import type {
  AppStateData,
  CollateralProfilesByInstance,
  CreateEventInstanceInput,
  ImportAppStateResult
} from "@/lib/state/app-state-types";

const APP_STATE_PERSIST_DEBOUNCE_MS = 250;

export function clearPersistedAppState() {
  getAppStateRepository().clear();
}
export type { AppStateSnapshot };
export type { CreateEventInstanceInput, ImportAppStateResult };

export type NewActionItem = NewActionItemInput;
export type { GenerateDeliverablesResult };
export type { CompletePublicationIssueResult };

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
  nativeActionItemStoreMode: "firebase" | "local";
  nativeActionItemRecovery: {
    firestoreEmpty: boolean;
    localRecoveryItemCount: number;
    canImportFromLocal: boolean;
    importError: string | null;
    isImporting: boolean;
  };
  workstreamSchedules: WorkstreamSchedule[];
  addItem: (item: NewActionItem) => void;
  addCollateralItem: (item: Omit<CollateralItem, "id" | "lastUpdated">) => string;
  applyDefaultTemplateToInstance: (instanceId: string) => boolean;
  archiveItem: (id: string) => void;
  bulkUpdateItems: (ids: string[], updates: Partial<ActionItem>) => void;
  createEventInstance: (input: CreateEventInstanceInput) => string;
  deleteItem: (id: string) => void;
  deleteCollateralItem: (id: string) => void;
  completeIssue: (issue: string) => CompletePublicationIssueResult;
  exportAppStateSnapshot: () => AppStateSnapshot;
  generateMissingDeliverablesForIssue: (issue: string) => GenerateDeliverablesResult;
  generateIssueDeliverables: (issue: string) => GenerateDeliverablesResult;
  importAppStateSnapshot: (value: unknown) => ImportAppStateResult;
  importNativeActionItemsFromLocalRecovery: () => Promise<number>;
  openIssue: (issue: string) => GenerateDeliverablesResult;
  ensureEventInstanceUnassignedSubEvent: (instanceId: string) => string;
  resetAppState: () => void;
  restoreItem: (id: string) => void;
  setActiveEventInstanceId: (instanceId: string) => void;
  setCollateralProfile: (instanceId: string, profile: LegDayCollateralProfile) => void;
  setDefaultOwnerForNewItems: (owner: string) => void;
  setWorkstreamSchedules: (schedules: WorkstreamSchedule[]) => void;
  setIssueStatus: (issue: string, status: IssueStatus) => CompletePublicationIssueResult;
  updateCollateralItem: (id: string, updates: Partial<CollateralItem>) => void;
  updateItem: (id: string, updates: Partial<ActionItem>) => void;
};

type AppStateValuesContextValue = Pick<
  AppStateContextValue,
  | "activeEventInstanceId"
  | "collateralItems"
  | "collateralProfiles"
  | "defaultOwnerForNewItems"
  | "eventFamilies"
  | "eventInstances"
  | "eventSubEvents"
  | "eventTypes"
  | "issues"
  | "items"
  | "nativeActionItemRecovery"
  | "nativeActionItemStoreMode"
  | "workstreamSchedules"
>;

type AppStateActionsContextValue = Omit<AppStateContextValue, keyof AppStateValuesContextValue>;

const AppStateValuesContext = createContext<AppStateValuesContextValue | undefined>(undefined);
const AppStateActionsContext = createContext<AppStateActionsContextValue | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ActionItem[]>(createDefaultActionItems);
  const [issueStatuses, setIssueStatuses] = useState<Partial<Record<string, IssueStatus>>>({});
  const [collateralItems, setCollateralItems] = useState<CollateralItem[]>(createDefaultCollateralItems);
  const [collateralProfiles, setCollateralProfiles] = useState<CollateralProfilesByInstance>(createDefaultCollateralProfiles);
  const [activeEventInstanceId, setActiveEventInstanceIdState] = useState<string>(getDefaultActiveEventInstanceId);
  const [defaultOwnerForNewItems, setDefaultOwnerForNewItemsState] = useState<string>(getDefaultOwnerForNewItems);
  const [eventFamilies, setEventFamilies] = useState<EventFamily[]>(createDefaultEventFamilies);
  const [eventTypes, setEventTypes] = useState<EventType[]>(createDefaultEventTypes);
  const [eventInstances, setEventInstances] = useState<EventInstance[]>(createDefaultEventInstances);
  const [eventSubEvents, setEventSubEvents] = useState<EventSubEvent[]>(createDefaultEventSubEvents);
  const [workstreamSchedules, setWorkstreamSchedulesState] = useState<WorkstreamSchedule[]>(getDefaultWorkstreamSchedules);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [nativeActionItemStoreBootError, setNativeActionItemStoreBootError] = useState<string | null>(null);
  const [nativeActionItemRecovery, setNativeActionItemRecovery] = useState<AppStateContextValue["nativeActionItemRecovery"]>({
    firestoreEmpty: false,
    localRecoveryItemCount: 0,
    canImportFromLocal: false,
    importError: null,
    isImporting: false
  });
  const [shouldPersist, setShouldPersist] = useState(true);
  const appStateRepository = useMemo(() => getAppStateRepository(), []);
  const nativeActionItemStore = useMemo(() => getSelectedNativeActionItemStore(), []);
  const nativeActionItemStoreMode = useMemo(() => getNativeActionItemStoreMode(), []);
  const pendingPersistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPersistStateRef = useRef<AppStateData | null>(null);
  const nativeActionItemWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const nativeActionItemRecoveryItemsRef = useRef<ActionItem[]>([]);
  const itemsRef = useRef(items);
  const issueStatusesRef = useRef(issueStatuses);
  const collateralItemsRef = useRef(collateralItems);
  const collateralProfilesRef = useRef(collateralProfiles);
  const activeEventInstanceIdRef = useRef(activeEventInstanceId);
  const defaultOwnerForNewItemsRef = useRef(defaultOwnerForNewItems);
  const eventFamiliesRef = useRef(eventFamilies);
  const eventTypesRef = useRef(eventTypes);
  const eventInstancesRef = useRef(eventInstances);
  const eventSubEventsRef = useRef(eventSubEvents);
  const workstreamSchedulesRef = useRef(workstreamSchedules);

  itemsRef.current = items;
  issueStatusesRef.current = issueStatuses;
  collateralItemsRef.current = collateralItems;
  collateralProfilesRef.current = collateralProfiles;
  activeEventInstanceIdRef.current = activeEventInstanceId;
  defaultOwnerForNewItemsRef.current = defaultOwnerForNewItems;
  eventFamiliesRef.current = eventFamilies;
  eventTypesRef.current = eventTypes;
  eventInstancesRef.current = eventInstances;
  eventSubEventsRef.current = eventSubEvents;
  workstreamSchedulesRef.current = workstreamSchedules;

  const getNativeActionItemContext = useCallback(
    (overrides?: Partial<Pick<AppStateData, "eventInstances" | "eventSubEvents" | "eventTypes">>): ActionItemMutationContext => ({
      eventInstances: overrides?.eventInstances ?? eventInstancesRef.current,
      eventPrograms: overrides?.eventTypes ?? eventTypesRef.current,
      eventSubEvents: overrides?.eventSubEvents ?? eventSubEventsRef.current
    }),
    []
  );

  const enqueueNativeActionItemStoreWrite = useCallback((task: () => Promise<void>) => {
    nativeActionItemWriteQueueRef.current = nativeActionItemWriteQueueRef.current
      .catch(() => undefined)
      .then(task)
      .catch((error) => {
        if (typeof console !== "undefined") {
          console.error("CAPMA Ops Hub could not persist native action items.", error);
        }
      });
  }, []);

  const enablePersistence = useCallback(() => {
    setShouldPersist(true);
  }, []);

  const hydrateAppState = useCallback((state: AppStateData) => {
    setItems(state.items);
    setIssueStatuses(state.issueStatuses);
    setCollateralItems(state.collateralItems);
    setCollateralProfiles(state.collateralProfiles);
    setActiveEventInstanceIdState(state.activeEventInstanceId);
    setDefaultOwnerForNewItemsState(state.defaultOwnerForNewItems);
    setEventFamilies(state.eventFamilies);
    setEventTypes(state.eventTypes);
    setEventInstances(state.eventInstances);
    setEventSubEvents(state.eventSubEvents);
    setWorkstreamSchedulesState(state.workstreamSchedules);
  }, []);

  const clearNativeActionItemRecovery = useCallback(() => {
    nativeActionItemRecoveryItemsRef.current = [];
    setNativeActionItemRecovery({
      firestoreEmpty: false,
      localRecoveryItemCount: 0,
      canImportFromLocal: false,
      importError: null,
      isImporting: false
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromSelectedNativeActionItemStore() {
      const loadResult = appStateRepository.load();
      const baseState = loadResult.state ?? createDefaultAppStateData();
      setShouldPersist(loadResult.shouldPersist);

      try {
        const context = getNativeActionItemContext({
          eventInstances: baseState.eventInstances,
          eventSubEvents: baseState.eventSubEvents,
          eventTypes: baseState.eventTypes
        });
        const localRecoveryItems = nativeActionItemMutator.normalizeLoaded(baseState.items, context);
        const loadedItems = await nativeActionItemStore.load(
          baseState.items,
          context
        );

        if (cancelled) {
          return;
        }

        hydrateAppState({
          ...baseState,
          items: loadedItems
        });
        setNativeActionItemStoreBootError(null);
        nativeActionItemRecoveryItemsRef.current = localRecoveryItems;
        setNativeActionItemRecovery({
          ...getNativeActionItemRecoveryInfo({
            mode: nativeActionItemStoreMode,
            firestoreItemCount: loadedItems.length,
            localRecoveryItemCount: localRecoveryItems.length
          }),
          importError: null,
          isImporting: false
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const defaultMessage =
          nativeActionItemStoreMode === "firebase"
            ? "Action-item persistence mode is set to Firestore, but Firestore is not configured or unavailable."
            : "Action-item persistence could not be initialized.";

        setNativeActionItemStoreBootError(
          error instanceof Error && error.message.trim().length > 0 ? error.message : defaultMessage
        );
      } finally {
        if (!cancelled) {
          setHasHydrated(true);
        }
      }
    }

    void hydrateFromSelectedNativeActionItemStore();

    return () => {
      cancelled = true;
    };
  }, [appStateRepository, getNativeActionItemContext, hydrateAppState, nativeActionItemStore, nativeActionItemStoreMode]);

  const persistableState = useMemo<AppStateData>(
    () => ({
      items:
        nativeActionItemStoreMode === "local"
          ? items
          : nativeActionItemRecovery.canImportFromLocal
            ? nativeActionItemRecoveryItemsRef.current
            : [],
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
    }),
    [
      activeEventInstanceId,
      collateralItems,
      collateralProfiles,
      defaultOwnerForNewItems,
      eventFamilies,
      eventInstances,
      eventSubEvents,
      eventTypes,
      issueStatuses,
      items,
      nativeActionItemStoreMode,
      nativeActionItemRecovery.canImportFromLocal,
      workstreamSchedules
    ]
  );

  useEffect(() => {
    if (!hasHydrated || !shouldPersist) {
      return;
    }

    pendingPersistStateRef.current = persistableState;

    if (pendingPersistTimeoutRef.current !== null) {
      clearTimeout(pendingPersistTimeoutRef.current);
    }

    pendingPersistTimeoutRef.current = setTimeout(() => {
      if (pendingPersistStateRef.current) {
        appStateRepository.save(pendingPersistStateRef.current);
      }

      pendingPersistTimeoutRef.current = null;
    }, APP_STATE_PERSIST_DEBOUNCE_MS);

    return () => {
      if (pendingPersistTimeoutRef.current !== null) {
        clearTimeout(pendingPersistTimeoutRef.current);
        pendingPersistTimeoutRef.current = null;
      }
    };
  }, [appStateRepository, hasHydrated, persistableState, shouldPersist]);

  useEffect(() => {
    if (!hasHydrated || !shouldPersist) {
      return;
    }

    const flushPendingPersistence = () => {
      if (!pendingPersistStateRef.current) {
        return;
      }

      if (pendingPersistTimeoutRef.current !== null) {
        clearTimeout(pendingPersistTimeoutRef.current);
        pendingPersistTimeoutRef.current = null;
      }

      appStateRepository.save(pendingPersistStateRef.current);
    };

    window.addEventListener("pagehide", flushPendingPersistence);
    window.addEventListener("beforeunload", flushPendingPersistence);

    return () => {
      window.removeEventListener("pagehide", flushPendingPersistence);
      window.removeEventListener("beforeunload", flushPendingPersistence);
    };
  }, [appStateRepository, hasHydrated, shouldPersist]);

  useEffect(() => {
    const resolvedInstanceId = resolveActiveEventInstanceId(activeEventInstanceId, eventInstances);

    if (resolvedInstanceId !== activeEventInstanceId) {
      setActiveEventInstanceIdState(resolvedInstanceId);
    }
  }, [activeEventInstanceId, eventInstances]);

  const issues = useMemo(() => getGeneratedIssues(issueStatuses), [issueStatuses]);

  const setActiveEventInstanceId = useCallback((instanceId: string) => {
    enablePersistence();
    setActiveEventInstanceIdState(instanceId);
  }, [enablePersistence]);

  const setDefaultOwnerForNewItems = useCallback((owner: string) => {
    enablePersistence();
    setDefaultOwnerForNewItemsState(owner);
  }, [enablePersistence]);

  const addItem = useCallback((item: NewActionItem) => {
    enablePersistence();
    if (nativeActionItemStoreMode === "firebase") {
      clearNativeActionItemRecovery();
    }
    setItems((current) => {
      const context = getNativeActionItemContext();
      const nextItems = nativeActionItemMutator.create(current, item, context);
      enqueueNativeActionItemStoreWrite(() => nativeActionItemStore.create(current, item, context).then(() => undefined));
      return nextItems;
    });
  }, [
    clearNativeActionItemRecovery,
    enablePersistence,
    enqueueNativeActionItemStoreWrite,
    getNativeActionItemContext,
    nativeActionItemStore,
    nativeActionItemStoreMode
  ]);

  const archiveItem = useCallback((id: string) => {
    enablePersistence();
    setItems((current) => {
      const context = getNativeActionItemContext();
      const nextItems = nativeActionItemMutator.archive(current, id, context);
      enqueueNativeActionItemStoreWrite(() => nativeActionItemStore.archive(current, id, context).then(() => undefined));
      return nextItems;
    });
  }, [enablePersistence, enqueueNativeActionItemStoreWrite, getNativeActionItemContext, nativeActionItemStore]);

  const deleteItem = useCallback((id: string) => {
    enablePersistence();
    setItems((current) => {
      const nextItems = nativeActionItemMutator.delete(current, id);
      enqueueNativeActionItemStoreWrite(() => nativeActionItemStore.delete(current, id).then(() => undefined));
      return nextItems;
    });
  }, [enablePersistence, enqueueNativeActionItemStoreWrite, nativeActionItemStore]);

  const addCollateralItem = useCallback((item: Omit<CollateralItem, "id" | "lastUpdated">) => {
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
  }, [enablePersistence]);

  const ensureEventInstanceUnassignedSubEvent = useCallback((instanceId: string) => {
    enablePersistence();
    const nextId = getUnassignedSubEventId(instanceId);
    setEventSubEvents((current) => {
      if (current.some((subEvent) => subEvent.id === nextId)) {
        return current;
      }

      return [...current, createUnassignedSubEvent(instanceId)];
    });

    return nextId;
  }, [enablePersistence]);

  const updateCollateralItem = useCallback((id: string, updates: Partial<CollateralItem>) => {
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
  }, [enablePersistence]);

  const deleteCollateralItem = useCallback((id: string) => {
    enablePersistence();
    setCollateralItems((current) => current.filter((item) => item.id !== id));
  }, [enablePersistence]);

  const createEventInstance = useCallback((input: CreateEventInstanceInput) => {
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
  }, [enablePersistence]);

  const applyDefaultTemplateToInstance = useCallback((instanceId: string) => {
    const instance = eventInstancesRef.current.find((entry) => entry.id === instanceId);

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
      collateralItemsRef.current
        .filter((item) => item.eventInstanceId === instanceId && item.templateOriginId)
        .map((item) => item.templateOriginId as string)
    );
    const existingByName = new Map(
      eventSubEventsRef.current
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
          owner: defaultOwnerForNewItemsRef.current,
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
  }, []);

  const generateIssueDeliverables = useCallback((issue: string): GenerateDeliverablesResult => {
    enablePersistence();
    if (nativeActionItemStoreMode === "firebase") {
      clearNativeActionItemRecovery();
    }
    let result: GenerateDeliverablesResult = { created: 0, skipped: 0 };
    setItems((current) => {
      const nextState = generatePublicationIssueDeliverables(current, issue);
      result = nextState.result;
      enqueueNativeActionItemStoreWrite(() =>
        nativeActionItemStore.replaceAll(nextState.items, getNativeActionItemContext()).then(() => undefined)
      );
      return nextState.items;
    });

    return result;
  }, [
    clearNativeActionItemRecovery,
    enablePersistence,
    enqueueNativeActionItemStoreWrite,
    getNativeActionItemContext,
    nativeActionItemStore,
    nativeActionItemStoreMode
  ]);

  const generateMissingDeliverablesForIssue = useCallback((issue: string): GenerateDeliverablesResult => {
    return generateIssueDeliverables(issue);
  }, [generateIssueDeliverables]);

  const openIssue = useCallback((issue: string): GenerateDeliverablesResult => {
    enablePersistence();
    if (nativeActionItemStoreMode === "firebase") {
      clearNativeActionItemRecovery();
    }
    let result: GenerateDeliverablesResult = { created: 0, skipped: 0 };

    setItems((currentItems) => {
      let nextItems = currentItems;

      setIssueStatuses((currentIssueStatuses) => {
        const nextState = openPublicationIssue(currentItems, currentIssueStatuses, issue);
        nextItems = nextState.items;
        result = nextState.result;
        return nextState.issueStatuses;
      });

      enqueueNativeActionItemStoreWrite(() =>
        nativeActionItemStore.replaceAll(nextItems, getNativeActionItemContext()).then(() => undefined)
      );

      return nextItems;
    });

    return result;
  }, [
    clearNativeActionItemRecovery,
    enablePersistence,
    enqueueNativeActionItemStoreWrite,
    getNativeActionItemContext,
    nativeActionItemStore,
    nativeActionItemStoreMode
  ]);

  const completeIssue = useCallback((issue: string) => {
    enablePersistence();
    let result: CompletePublicationIssueResult = {
      issueStatuses: issueStatusesRef.current,
      blockedDeliverables: [],
      completed: false
    };

    setIssueStatuses((current) => {
      result = completePublicationIssue(itemsRef.current, current, issue);
      return result.issueStatuses;
    });

    return result;
  }, [enablePersistence]);

  const setIssueStatus = useCallback((issue: string, status: IssueStatus) => {
    enablePersistence();
    if (status === "Complete") {
      return completeIssue(issue);
    }

    setIssueStatuses((current) => setPublicationIssueStatus(current, issue, status));

    return {
      issueStatuses: issueStatusesRef.current,
      blockedDeliverables: [],
      completed: true
    };
  }, [completeIssue, enablePersistence]);

  const resetAppState = useCallback(() => {
    appStateRepository.clear();
    enablePersistence();
    clearNativeActionItemRecovery();
    const nextState = createDefaultAppStateData();
    hydrateAppState(nextState);
    enqueueNativeActionItemStoreWrite(() =>
      nativeActionItemStore
        .replaceAll(
          nextState.items,
          getNativeActionItemContext({
            eventInstances: nextState.eventInstances,
            eventSubEvents: nextState.eventSubEvents,
            eventTypes: nextState.eventTypes
          })
        )
        .then(() => undefined)
    );
  }, [
    appStateRepository,
    clearNativeActionItemRecovery,
    enablePersistence,
    enqueueNativeActionItemStoreWrite,
    getNativeActionItemContext,
    hydrateAppState,
    nativeActionItemStore
  ]);

  const restoreItem = useCallback((id: string) => {
    enablePersistence();
    setItems((current) => {
      const context = getNativeActionItemContext();
      const nextItems = nativeActionItemMutator.restore(current, id, context);
      enqueueNativeActionItemStoreWrite(() => nativeActionItemStore.restore(current, id, context).then(() => undefined));
      return nextItems;
    });
  }, [enablePersistence, enqueueNativeActionItemStoreWrite, getNativeActionItemContext, nativeActionItemStore]);

  const bulkUpdateItems = useCallback((ids: string[], updates: Partial<ActionItem>) => {
    enablePersistence();
    setItems((current) => {
      const context = getNativeActionItemContext();
      const nextItems = nativeActionItemMutator.bulkUpdate(current, ids, updates, context);
      enqueueNativeActionItemStoreWrite(() =>
        nativeActionItemStore.bulkUpdate(current, ids, updates, context).then(() => undefined)
      );
      return nextItems;
    });
  }, [enablePersistence, enqueueNativeActionItemStoreWrite, getNativeActionItemContext, nativeActionItemStore]);

  const exportAppStateSnapshot = useCallback(
    () =>
      appStateRepository.export({
        items: itemsRef.current,
        issueStatuses: issueStatusesRef.current,
        collateralItems: collateralItemsRef.current,
        collateralProfiles: collateralProfilesRef.current,
        activeEventInstanceId: activeEventInstanceIdRef.current,
        defaultOwnerForNewItems: defaultOwnerForNewItemsRef.current,
        eventFamilies: eventFamiliesRef.current,
        eventTypes: eventTypesRef.current,
        eventInstances: eventInstancesRef.current,
        eventSubEvents: eventSubEventsRef.current,
        workstreamSchedules: workstreamSchedulesRef.current
      }),
    [appStateRepository]
  );

  const importAppStateSnapshot = useCallback((value: unknown) => {
    const importedState = appStateRepository.import(value);
    enablePersistence();
    clearNativeActionItemRecovery();
    hydrateAppState(importedState);
    enqueueNativeActionItemStoreWrite(() =>
      nativeActionItemStore
        .replaceAll(
          importedState.items,
          getNativeActionItemContext({
            eventInstances: importedState.eventInstances,
            eventSubEvents: importedState.eventSubEvents,
            eventTypes: importedState.eventTypes
          })
        )
        .then(() => undefined)
    );

    return {
      itemCount: importedState.itemCount,
      usedLegacyFormat: importedState.usedLegacyFormat
    };
  }, [
    appStateRepository,
    clearNativeActionItemRecovery,
    enablePersistence,
    enqueueNativeActionItemStoreWrite,
    getNativeActionItemContext,
    hydrateAppState,
    nativeActionItemStore
  ]);

  const importNativeActionItemsFromLocalRecovery = useCallback(async () => {
    const recoveryItems = nativeActionItemRecoveryItemsRef.current;

    if (!nativeActionItemRecovery.canImportFromLocal || recoveryItems.length === 0) {
      return 0;
    }

    setNativeActionItemRecovery((current) => ({
      ...current,
      importError: null,
      isImporting: true
    }));

    try {
      const importedItems = await nativeActionItemStore.replaceAll(recoveryItems, getNativeActionItemContext());
      setItems(importedItems);
      clearNativeActionItemRecovery();
      return importedItems.length;
    } catch (error) {
      setNativeActionItemRecovery((current) => ({
        ...current,
        importError:
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : "CAPMA Ops Hub could not import local native action items into Firestore.",
        isImporting: false
      }));
      throw error;
    }
  }, [
    clearNativeActionItemRecovery,
    getNativeActionItemContext,
    nativeActionItemRecovery.canImportFromLocal,
    nativeActionItemStore
  ]);

  const setCollateralProfile = useCallback((instanceId: string, profile: LegDayCollateralProfile) => {
    enablePersistence();
    setCollateralProfiles((current) => ({
      ...current,
      [instanceId]: profile
    }));
  }, [enablePersistence]);

  const setWorkstreamSchedules = useCallback((schedules: WorkstreamSchedule[]) => {
    enablePersistence();
    setWorkstreamSchedulesState(schedules);
  }, [enablePersistence]);

  const updateItem = useCallback((id: string, updates: Partial<ActionItem>) => {
    enablePersistence();
    setItems((current) => {
      const context = getNativeActionItemContext();
      const nextItems = nativeActionItemMutator.update(current, id, updates, context);
      enqueueNativeActionItemStoreWrite(() =>
        nativeActionItemStore.update(current, id, updates, context).then(() => undefined)
      );
      return nextItems;
    });
  }, [enablePersistence, enqueueNativeActionItemStoreWrite, getNativeActionItemContext, nativeActionItemStore]);

  const values = useMemo<AppStateValuesContextValue>(
    () => ({
    items,
    issues,
    collateralItems,
    collateralProfiles,
    activeEventInstanceId,
    defaultOwnerForNewItems,
    eventFamilies,
    eventTypes,
    eventInstances,
    eventSubEvents,
    nativeActionItemRecovery,
    nativeActionItemStoreMode,
    workstreamSchedules
    }),
    [
      activeEventInstanceId,
      collateralItems,
      collateralProfiles,
      defaultOwnerForNewItems,
      eventFamilies,
      eventInstances,
      eventSubEvents,
      eventTypes,
      issues,
      items,
      nativeActionItemRecovery,
      nativeActionItemStoreMode,
      workstreamSchedules
    ]
  );

  const actions = useMemo<AppStateActionsContextValue>(
    () => ({
    archiveItem,
    addItem,
    addCollateralItem,
    applyDefaultTemplateToInstance,
    bulkUpdateItems,
    createEventInstance,
    deleteItem,
    deleteCollateralItem,
    completeIssue,
    exportAppStateSnapshot,
    generateMissingDeliverablesForIssue,
    generateIssueDeliverables,
    importAppStateSnapshot,
    importNativeActionItemsFromLocalRecovery,
    openIssue,
    ensureEventInstanceUnassignedSubEvent,
    resetAppState,
    restoreItem,
    setActiveEventInstanceId,
    setCollateralProfile,
    setDefaultOwnerForNewItems,
    setWorkstreamSchedules,
    setIssueStatus,
    updateCollateralItem,
    updateItem
    }),
    [
      addCollateralItem,
      addItem,
      applyDefaultTemplateToInstance,
      archiveItem,
      bulkUpdateItems,
      completeIssue,
      createEventInstance,
      deleteCollateralItem,
      deleteItem,
      ensureEventInstanceUnassignedSubEvent,
      exportAppStateSnapshot,
      generateIssueDeliverables,
      generateMissingDeliverablesForIssue,
      importAppStateSnapshot,
      importNativeActionItemsFromLocalRecovery,
      openIssue,
      resetAppState,
      restoreItem,
      setActiveEventInstanceId,
      setCollateralProfile,
      setDefaultOwnerForNewItems,
      setIssueStatus,
      setWorkstreamSchedules,
      updateCollateralItem,
      updateItem
    ]
  );

  if (!hasHydrated) {
    return <div className="app-loading-state">Loading CAPMA Ops...</div>;
  }

  if (nativeActionItemStoreBootError) {
    return (
      <div className="app-loading-state">
        <div className="app-loading-title">Native Action Item Store Unavailable</div>
        <p>{nativeActionItemStoreBootError}</p>
      </div>
    );
  }

  return (
    <AppStateActionsContext.Provider value={actions}>
      <AppStateValuesContext.Provider value={values}>{children}</AppStateValuesContext.Provider>
    </AppStateActionsContext.Provider>
  );
}

export function useAppStateValues() {
  const context = useContext(AppStateValuesContext);

  if (!context) {
    throw new Error("useAppStateValues must be used within AppStateProvider");
  }

  return context;
}

export function useAppActions() {
  const context = useContext(AppStateActionsContext);

  if (!context) {
    throw new Error("useAppActions must be used within AppStateProvider");
  }

  return context;
}

export function useAppState() {
  return {
    ...useAppStateValues(),
    ...useAppActions()
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
