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
  type CollateralItem,
  type LegDayCollateralProfile
} from "@/lib/collateral-data";
import { traceCollateralCreate } from "@/lib/collateral-create-trace";
import type { PersistedCollateralState } from "@/lib/collateral-persisted-state";
import {
  getCollateralPersistenceBootErrorMessage,
  getCollateralPersistenceStoreMode,
  getSelectedCollateralPersistenceStore,
  selectPersistableCollateralState
} from "@/lib/collateral-persistence-store";
import { localCollateralStore } from "@/lib/collateral-store";
import {
  getDefaultTemplatePackForEventType,
  getTemplateItemsForPack,
  getTemplateSubEventsForPack
} from "@/lib/collateral-templates";
import {
  createUnassignedSubEvent,
  getUnassignedSubEventId,
  normalizeEventSubEvents,
  resolveActiveEventInstanceId,
  type EventFamily,
  type EventInstance,
  type EventSubEvent,
  type EventType
} from "@/lib/event-instances";
import { buildCreatedEventInstanceState } from "@/lib/event-type-definitions";
import { nativeActionItemMutator } from "@/lib/native-action-item-mutator";
import {
  buildSponsorFulfillmentGenerationResult,
  type SponsorPlacement,
  type SponsorPlacementsByInstance
} from "@/lib/sponsor-fulfillment";
import type { ActionItem } from "@/lib/sample-data";
import {
  type IssueRecord,
  type IssueStatus,
  type WorkstreamSchedule,
  getDefaultWorkstreamSchedules,
  getGeneratedIssues
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
  sponsorPlacementsByInstance: SponsorPlacementsByInstance;
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
  addCollateralItem: (item: Omit<CollateralItem, "archivedAt" | "id" | "lastUpdated">) => string;
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
  upsertSponsorPlacement: (instanceId: string, placement: SponsorPlacement) => void;
  removeSponsorPlacement: (instanceId: string, placementId: string) => void;
  generateSponsorFulfillmentItems: (instanceId: string) => { created: number; skipped: number };
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
  | "sponsorPlacementsByInstance"
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
  const [sponsorPlacementsByInstance, setSponsorPlacementsByInstance] = useState<SponsorPlacementsByInstance>({});
  const [activeEventInstanceId, setActiveEventInstanceIdState] = useState<string>(getDefaultActiveEventInstanceId);
  const [defaultOwnerForNewItems, setDefaultOwnerForNewItemsState] = useState<string>(getDefaultOwnerForNewItems);
  const [eventFamilies, setEventFamilies] = useState<EventFamily[]>(createDefaultEventFamilies);
  const [eventTypes, setEventTypes] = useState<EventType[]>(createDefaultEventTypes);
  const [eventInstances, setEventInstances] = useState<EventInstance[]>(createDefaultEventInstances);
  const [eventSubEvents, setEventSubEvents] = useState<EventSubEvent[]>(createDefaultEventSubEvents);
  const [workstreamSchedules, setWorkstreamSchedulesState] = useState<WorkstreamSchedule[]>(getDefaultWorkstreamSchedules);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [collateralPersistenceStoreBootError, setCollateralPersistenceStoreBootError] = useState<string | null>(null);
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
  const collateralPersistenceStore = useMemo(() => getSelectedCollateralPersistenceStore(), []);
  const collateralPersistenceStoreMode = useMemo(() => getCollateralPersistenceStoreMode(), []);
  const nativeActionItemStore = useMemo(() => getSelectedNativeActionItemStore(), []);
  const nativeActionItemStoreMode = useMemo(() => getNativeActionItemStoreMode(), []);
  const pendingPersistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPersistStateRef = useRef<AppStateData | null>(null);
  const collateralPersistenceWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const collateralBootstrapSourceRef = useRef<PersistedCollateralState | null>(null);
  const nativeActionItemWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const nativeActionItemRecoveryItemsRef = useRef<ActionItem[]>([]);
  const itemsRef = useRef(items);
  const issueStatusesRef = useRef(issueStatuses);
  const collateralItemsRef = useRef(collateralItems);
  const collateralProfilesRef = useRef(collateralProfiles);
  const sponsorPlacementsByInstanceRef = useRef(sponsorPlacementsByInstance);
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
  sponsorPlacementsByInstanceRef.current = sponsorPlacementsByInstance;
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
  const getCollateralContext = useCallback(
    (
      overrides?: Partial<Pick<AppStateData, "defaultOwnerForNewItems" | "eventInstances" | "eventSubEvents">>
    ) => ({
      defaultOwner: overrides?.defaultOwnerForNewItems ?? defaultOwnerForNewItemsRef.current,
      eventInstances: overrides?.eventInstances ?? eventInstancesRef.current,
      eventSubEvents: overrides?.eventSubEvents ?? eventSubEventsRef.current
    }),
    []
  );
  const getCollateralPersistenceContext = useCallback(
    (
      overrides?: Partial<Pick<AppStateData, "defaultOwnerForNewItems" | "eventTypes">>
    ) => ({
      defaultOwner: overrides?.defaultOwnerForNewItems ?? defaultOwnerForNewItemsRef.current,
      eventTypes: overrides?.eventTypes ?? eventTypesRef.current
    }),
    []
  );
  const getPersistedCollateralState = useCallback(
    (
      overrides?: Partial<
        Pick<
          AppStateData,
          "collateralItems" | "collateralProfiles" | "sponsorPlacementsByInstance" | "eventInstances" | "eventSubEvents"
        >
      >
    ): PersistedCollateralState => ({
      collateralItems: overrides?.collateralItems ?? collateralItemsRef.current,
      collateralProfiles: overrides?.collateralProfiles ?? collateralProfilesRef.current,
      sponsorPlacementsByInstance:
        overrides?.sponsorPlacementsByInstance ?? sponsorPlacementsByInstanceRef.current,
      eventInstances: overrides?.eventInstances ?? eventInstancesRef.current,
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
  const enqueueCollateralPersistenceWrite = useCallback((task: () => Promise<void>) => {
    collateralPersistenceWriteQueueRef.current = collateralPersistenceWriteQueueRef.current
      .catch(() => undefined)
      .then(task)
      .catch((error) => {
        if (typeof console !== "undefined") {
          console.error("CAPMA Ops Hub could not persist collateral state.", error);
        }
      });
  }, []);

  const enablePersistence = useCallback(() => {
    setShouldPersist(true);
  }, []);

  const hydrateAppState = useCallback((state: AppStateData) => {
    const normalizedEventSubEvents = normalizeEventSubEvents(state.eventSubEvents).subEvents;

    setItems(state.items);
    setIssueStatuses(state.issueStatuses);
    setCollateralItems(
      localCollateralStore.normalizeLoaded(state.collateralItems, {
        defaultOwner: state.defaultOwnerForNewItems,
        eventInstances: state.eventInstances,
        eventSubEvents: normalizedEventSubEvents
      })
    );
    setCollateralProfiles(state.collateralProfiles);
    setSponsorPlacementsByInstance(state.sponsorPlacementsByInstance);
    setActiveEventInstanceIdState(state.activeEventInstanceId);
    setDefaultOwnerForNewItemsState(state.defaultOwnerForNewItems);
    setEventFamilies(state.eventFamilies);
    setEventTypes(state.eventTypes);
    setEventInstances(state.eventInstances);
    setEventSubEvents(normalizedEventSubEvents);
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
      collateralBootstrapSourceRef.current = {
        collateralItems: baseState.collateralItems,
        collateralProfiles: baseState.collateralProfiles,
        sponsorPlacementsByInstance: baseState.sponsorPlacementsByInstance,
        eventInstances: baseState.eventInstances,
        eventSubEvents: baseState.eventSubEvents
      };
      setShouldPersist(loadResult.shouldPersist);

      try {
        const loadedCollateralState = await collateralPersistenceStore.load(
          getPersistedCollateralState({
            collateralItems: baseState.collateralItems,
            collateralProfiles: baseState.collateralProfiles,
            sponsorPlacementsByInstance: baseState.sponsorPlacementsByInstance,
            eventInstances: baseState.eventInstances,
            eventSubEvents: baseState.eventSubEvents
          }),
          getCollateralPersistenceContext({
            defaultOwnerForNewItems: baseState.defaultOwnerForNewItems,
            eventTypes: baseState.eventTypes
          })
        );
        const context = getNativeActionItemContext({
          eventInstances: loadedCollateralState.eventInstances,
          eventSubEvents: loadedCollateralState.eventSubEvents,
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
          ...loadedCollateralState,
          items: loadedItems
        });
        setCollateralPersistenceStoreBootError(null);
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

        const message = error instanceof Error && error.message.trim().length > 0
          ? error.message
          : collateralPersistenceStoreMode === "firebase"
            ? "Collateral persistence mode is set to Firestore, but Firestore is not configured or unavailable."
            : nativeActionItemStoreMode === "firebase"
              ? "Action-item persistence mode is set to Firestore, but Firestore is not configured or unavailable."
              : "CAPMA Ops persistence could not be initialized.";
        setCollateralPersistenceStoreBootError(
          getCollateralPersistenceBootErrorMessage({
            mode: collateralPersistenceStoreMode,
            message
          })
        );
        setNativeActionItemStoreBootError(
          collateralPersistenceStoreMode === "firebase" ? null : message
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
  }, [
    appStateRepository,
    collateralPersistenceStore,
    collateralPersistenceStoreMode,
    getCollateralPersistenceContext,
    getNativeActionItemContext,
    getPersistedCollateralState,
    hydrateAppState,
    nativeActionItemStore,
    nativeActionItemStoreMode
  ]);

  const persistableState = useMemo<AppStateData>(
    () => {
      const persistableCollateralState = selectPersistableCollateralState({
        mode: collateralPersistenceStoreMode,
        currentState: {
          collateralItems,
          collateralProfiles,
          sponsorPlacementsByInstance,
          eventInstances,
          eventSubEvents
        },
        bootstrapSourceState: collateralBootstrapSourceRef.current
      });

      return {
      items:
        nativeActionItemStoreMode === "local"
          ? items
          : nativeActionItemRecovery.canImportFromLocal
            ? nativeActionItemRecoveryItemsRef.current
            : [],
      issueStatuses,
      collateralItems: persistableCollateralState.collateralItems,
      collateralProfiles: persistableCollateralState.collateralProfiles,
      sponsorPlacementsByInstance: persistableCollateralState.sponsorPlacementsByInstance ?? {},
      activeEventInstanceId,
      defaultOwnerForNewItems,
      eventFamilies,
      eventTypes,
      eventInstances: persistableCollateralState.eventInstances,
      eventSubEvents: persistableCollateralState.eventSubEvents,
      workstreamSchedules
    };
    },
    [
      activeEventInstanceId,
      collateralItems,
      collateralProfiles,
      sponsorPlacementsByInstance,
      collateralPersistenceStoreMode,
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

  const addCollateralItem = useCallback((item: Omit<CollateralItem, "archivedAt" | "id" | "lastUpdated">) => {
    enablePersistence();
    let nextItemId = "";

    setCollateralItems((current) => {
      const nextItems = localCollateralStore.create(current, item, getCollateralContext());
      const createdItem = nextItems[0] ?? null;
      nextItemId = createdItem?.id ?? "";

      traceCollateralCreate("app-state-create", {
        requested: {
          eventInstanceId: item.eventInstanceId,
          subEventId: item.subEventId,
          status: item.status
        },
        created: createdItem
          ? {
              id: createdItem.id,
              eventInstanceId: createdItem.eventInstanceId,
              subEventId: createdItem.subEventId,
              status: createdItem.status,
              archivedAt: createdItem.archivedAt
            }
          : null,
        activeEventInstanceId: activeEventInstanceIdRef.current,
        canonicalIdsForActiveInstance: nextItems
          .filter((entry) => entry.eventInstanceId === activeEventInstanceIdRef.current)
          .map((entry) => entry.id),
        createdVisibleInActiveInstance:
          createdItem !== null &&
          nextItems.some(
            (entry) => entry.id === createdItem.id && entry.eventInstanceId === activeEventInstanceIdRef.current
          )
      });
      enqueueCollateralPersistenceWrite(() =>
        collateralPersistenceStore
          .replaceAll(getPersistedCollateralState({ collateralItems: nextItems }), getCollateralPersistenceContext())
          .then(() => undefined)
      );

      return nextItems;
    });

    return nextItemId;
  }, [
    collateralPersistenceStore,
    enablePersistence,
    enqueueCollateralPersistenceWrite,
    getCollateralContext,
    getCollateralPersistenceContext,
    getPersistedCollateralState
  ]);

  const ensureEventInstanceUnassignedSubEvent = useCallback((instanceId: string) => {
    enablePersistence();
    const nextId = getUnassignedSubEventId(instanceId);
    setEventSubEvents((current) => {
      if (current.some((subEvent) => subEvent.id === nextId)) {
        return current;
      }

      const nextSubEvents = normalizeEventSubEvents([...current, createUnassignedSubEvent(instanceId)]).subEvents;
      enqueueCollateralPersistenceWrite(() =>
        collateralPersistenceStore
          .replaceAll(getPersistedCollateralState({ eventSubEvents: nextSubEvents }), getCollateralPersistenceContext())
          .then(() => undefined)
      );
      return nextSubEvents;
    });

    return nextId;
  }, [
    collateralPersistenceStore,
    enablePersistence,
    enqueueCollateralPersistenceWrite,
    getCollateralPersistenceContext,
    getPersistedCollateralState
  ]);

  const updateCollateralItem = useCallback((id: string, updates: Partial<CollateralItem>) => {
    enablePersistence();
    setCollateralItems((current) => {
      const nextItems = localCollateralStore.update(current, id, updates, getCollateralContext());
      enqueueCollateralPersistenceWrite(() =>
        collateralPersistenceStore
          .replaceAll(getPersistedCollateralState({ collateralItems: nextItems }), getCollateralPersistenceContext())
          .then(() => undefined)
      );
      return nextItems;
    });
  }, [
    collateralPersistenceStore,
    enablePersistence,
    enqueueCollateralPersistenceWrite,
    getCollateralContext,
    getCollateralPersistenceContext,
    getPersistedCollateralState
  ]);

  const deleteCollateralItem = useCallback((id: string) => {
    enablePersistence();
    setCollateralItems((current) => {
      const nextItems = localCollateralStore.delete(current, id);
      enqueueCollateralPersistenceWrite(() =>
        collateralPersistenceStore
          .replaceAll(getPersistedCollateralState({ collateralItems: nextItems }), getCollateralPersistenceContext())
          .then(() => undefined)
      );
      return nextItems;
    });
  }, [
    collateralPersistenceStore,
    enablePersistence,
    enqueueCollateralPersistenceWrite,
    getCollateralPersistenceContext,
    getPersistedCollateralState
  ]);

  const createEventInstance = useCallback((input: CreateEventInstanceInput) => {
    enablePersistence();
    const nextId = `${slugify(input.instanceName)}-${crypto.randomUUID().slice(0, 8)}`;
    const nextEventState = buildCreatedEventInstanceState({
      currentEventInstances: eventInstancesRef.current,
      currentEventSubEvents: eventSubEventsRef.current,
      creation: {
        instanceId: nextId,
        eventTypeId: input.eventTypeId,
        instanceName: input.instanceName,
        dateMode: input.dateMode,
        dates: input.dates,
        location: input.location,
        notes: input.notes
      }
    });
    const nextCollateralProfiles =
      input.eventTypeId === "legislative-day"
        ? {
            ...collateralProfilesRef.current,
            [nextId]: {
              ...initialLegDayCollateralProfile,
              eventStartDate: nextEventState.eventInstance.startDate,
              eventEndDate: nextEventState.eventInstance.endDate
            }
          }
        : collateralProfilesRef.current;

    setEventInstances(nextEventState.nextEventInstances);
    setEventSubEvents((current) =>
      normalizeEventSubEvents([
        ...current,
        ...nextEventState.nextEventSubEvents.filter(
          (subEvent) => !current.some((existing) => existing.id === subEvent.id)
        )
      ]).subEvents
    );

    if (input.eventTypeId === "legislative-day") {
      setCollateralProfiles(nextCollateralProfiles);
    }

    enqueueCollateralPersistenceWrite(() =>
      collateralPersistenceStore
        .replaceAll(
          getPersistedCollateralState({
            collateralProfiles: nextCollateralProfiles,
            eventInstances: nextEventState.nextEventInstances,
            eventSubEvents: normalizeEventSubEvents(nextEventState.nextEventSubEvents).subEvents
          }),
          getCollateralPersistenceContext()
        )
        .then(() => undefined)
    );

    setActiveEventInstanceIdState(nextEventState.activeEventInstanceId);
    return nextId;
  }, [
    collateralPersistenceStore,
    enablePersistence,
    enqueueCollateralPersistenceWrite,
    getCollateralPersistenceContext,
    getPersistedCollateralState
  ]);

  const applyDefaultTemplateToInstance = useCallback((instanceId: string) => {
    enablePersistence();
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
    const templateResult = localCollateralStore.applyTemplate({
      currentItems: collateralItemsRef.current,
      currentSubEvents: eventSubEventsRef.current,
      defaultOwner: defaultOwnerForNewItemsRef.current,
      eventInstanceId: instanceId,
      templateItems,
      templateSubEvents
    });

    if (templateResult.subEventAdditions.length > 0) {
      setEventSubEvents((current) => normalizeEventSubEvents([...current, ...templateResult.subEventAdditions]).subEvents);
    }

    setCollateralItems(templateResult.items);
    enqueueCollateralPersistenceWrite(() =>
      collateralPersistenceStore
        .replaceAll(
          getPersistedCollateralState({
            collateralItems: templateResult.items,
            eventSubEvents:
              templateResult.subEventAdditions.length > 0
                ? normalizeEventSubEvents([...eventSubEventsRef.current, ...templateResult.subEventAdditions]).subEvents
                : eventSubEventsRef.current
          }),
          getCollateralPersistenceContext()
        )
        .then(() => undefined)
    );

    return true;
  }, [
    collateralPersistenceStore,
    enablePersistence,
    enqueueCollateralPersistenceWrite,
    getCollateralPersistenceContext,
    getPersistedCollateralState
  ]);

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
    collateralBootstrapSourceRef.current = {
      collateralItems: nextState.collateralItems,
      collateralProfiles: nextState.collateralProfiles,
      sponsorPlacementsByInstance: nextState.sponsorPlacementsByInstance,
      eventInstances: nextState.eventInstances,
      eventSubEvents: nextState.eventSubEvents
    };
    hydrateAppState(nextState);
    enqueueCollateralPersistenceWrite(() =>
      collateralPersistenceStore
        .replaceAll(getPersistedCollateralState({
          collateralItems: nextState.collateralItems,
          collateralProfiles: nextState.collateralProfiles,
          sponsorPlacementsByInstance: nextState.sponsorPlacementsByInstance,
          eventInstances: nextState.eventInstances,
          eventSubEvents: nextState.eventSubEvents
        }), getCollateralPersistenceContext({
          defaultOwnerForNewItems: nextState.defaultOwnerForNewItems,
          eventTypes: nextState.eventTypes
        }))
        .then(() => undefined)
    );
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
    collateralPersistenceStore,
    enablePersistence,
    enqueueCollateralPersistenceWrite,
    enqueueNativeActionItemStoreWrite,
    getCollateralPersistenceContext,
    getNativeActionItemContext,
    getPersistedCollateralState,
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
        sponsorPlacementsByInstance: sponsorPlacementsByInstanceRef.current,
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
    collateralBootstrapSourceRef.current = {
      collateralItems: importedState.collateralItems,
      collateralProfiles: importedState.collateralProfiles,
      sponsorPlacementsByInstance: importedState.sponsorPlacementsByInstance,
      eventInstances: importedState.eventInstances,
      eventSubEvents: importedState.eventSubEvents
    };
    hydrateAppState(importedState);
    enqueueCollateralPersistenceWrite(() =>
      collateralPersistenceStore
        .replaceAll(
          getPersistedCollateralState({
            collateralItems: importedState.collateralItems,
            collateralProfiles: importedState.collateralProfiles,
            sponsorPlacementsByInstance: importedState.sponsorPlacementsByInstance,
            eventInstances: importedState.eventInstances,
            eventSubEvents: importedState.eventSubEvents
          }),
          getCollateralPersistenceContext({
            defaultOwnerForNewItems: importedState.defaultOwnerForNewItems,
            eventTypes: importedState.eventTypes
          })
        )
        .then(() => undefined)
    );
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
    collateralPersistenceStore,
    enablePersistence,
    enqueueCollateralPersistenceWrite,
    enqueueNativeActionItemStoreWrite,
    getCollateralPersistenceContext,
    getNativeActionItemContext,
    getPersistedCollateralState,
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
    setCollateralProfiles((current) => {
      const nextProfiles = {
        ...current,
        [instanceId]: profile
      };
      enqueueCollateralPersistenceWrite(() =>
        collateralPersistenceStore
          .replaceAll(
            getPersistedCollateralState({ collateralProfiles: nextProfiles }),
            getCollateralPersistenceContext()
          )
          .then(() => undefined)
      );
      return nextProfiles;
    });
  }, [
    collateralPersistenceStore,
    enablePersistence,
    enqueueCollateralPersistenceWrite,
    getCollateralPersistenceContext,
    getPersistedCollateralState
  ]);

  const upsertSponsorPlacement = useCallback((instanceId: string, placement: SponsorPlacement) => {
    enablePersistence();
    setSponsorPlacementsByInstance((current) => {
      const nextForInstance = (current[instanceId] ?? []).some((entry) => entry.id === placement.id)
        ? (current[instanceId] ?? []).map((entry) => (entry.id === placement.id ? { ...placement } : entry))
        : [...(current[instanceId] ?? []), { ...placement }];
      const nextState = {
        ...current,
        [instanceId]: nextForInstance
      };

      sponsorPlacementsByInstanceRef.current = nextState;
      enqueueCollateralPersistenceWrite(() =>
        collateralPersistenceStore
          .replaceAll(
            getPersistedCollateralState({ sponsorPlacementsByInstance: nextState }),
            getCollateralPersistenceContext()
          )
          .then(() => undefined)
      );

      return nextState;
    });
  }, [
    collateralPersistenceStore,
    enablePersistence,
    enqueueCollateralPersistenceWrite,
    getCollateralPersistenceContext,
    getPersistedCollateralState
  ]);

  const removeSponsorPlacement = useCallback((instanceId: string, placementId: string) => {
    enablePersistence();
    setSponsorPlacementsByInstance((current) => {
      const nextForInstance = (current[instanceId] ?? []).filter((placement) => placement.id !== placementId);
      const nextState =
        nextForInstance.length > 0
          ? {
              ...current,
              [instanceId]: nextForInstance
            }
          : Object.fromEntries(
              Object.entries(current).filter(([currentInstanceId]) => currentInstanceId !== instanceId)
            );

      sponsorPlacementsByInstanceRef.current = nextState;
      enqueueCollateralPersistenceWrite(() =>
        collateralPersistenceStore
          .replaceAll(
            getPersistedCollateralState({ sponsorPlacementsByInstance: nextState }),
            getCollateralPersistenceContext()
          )
          .then(() => undefined)
      );

      return nextState;
    });
  }, [
    collateralPersistenceStore,
    enablePersistence,
    enqueueCollateralPersistenceWrite,
    getCollateralPersistenceContext,
    getPersistedCollateralState
  ]);

  const generateSponsorFulfillmentItems = useCallback((instanceId: string) => {
    const eventInstance = eventInstancesRef.current.find((entry) => entry.id === instanceId) ?? null;

    if (!eventInstance) {
      return { created: 0, skipped: 0 };
    }

    const result = buildSponsorFulfillmentGenerationResult({
      placements: sponsorPlacementsByInstanceRef.current[instanceId] ?? [],
      eventInstance,
      existingItems: itemsRef.current,
      defaultOwner: defaultOwnerForNewItemsRef.current
    });

    if (result.created.length === 0) {
      return { created: 0, skipped: result.skipped };
    }

    enablePersistence();
    if (nativeActionItemStoreMode === "firebase") {
      clearNativeActionItemRecovery();
    }

    setItems((current) => {
      const context = getNativeActionItemContext();
      const nextItems = result.created.reduce(
        (accumulator, item) => nativeActionItemMutator.create(accumulator, item, context),
        current
      );
      enqueueNativeActionItemStoreWrite(() =>
        nativeActionItemStore.replaceAll(nextItems, context).then(() => undefined)
      );
      return nextItems;
    });

    return {
      created: result.created.length,
      skipped: result.skipped
    };
  }, [
    clearNativeActionItemRecovery,
    enablePersistence,
    enqueueNativeActionItemStoreWrite,
    getNativeActionItemContext,
    nativeActionItemStore,
    nativeActionItemStoreMode
  ]);

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
    sponsorPlacementsByInstance,
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
      sponsorPlacementsByInstance,
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
    generateSponsorFulfillmentItems,
    removeSponsorPlacement,
    setActiveEventInstanceId,
    setCollateralProfile,
    setDefaultOwnerForNewItems,
    setWorkstreamSchedules,
    setIssueStatus,
    upsertSponsorPlacement,
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
      generateSponsorFulfillmentItems,
      removeSponsorPlacement,
      setActiveEventInstanceId,
      setCollateralProfile,
      setDefaultOwnerForNewItems,
      setIssueStatus,
      setWorkstreamSchedules,
      upsertSponsorPlacement,
      updateCollateralItem,
      updateItem
    ]
  );

  if (!hasHydrated) {
    return <div className="app-loading-state">Loading CAPMA Ops...</div>;
  }

  if (collateralPersistenceStoreBootError) {
    return (
      <div className="app-loading-state">
        <div className="app-loading-title">Collateral Store Unavailable</div>
        <p>{collateralPersistenceStoreBootError}</p>
      </div>
    );
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
