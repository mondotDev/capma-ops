import type { CollateralItem, LegDayCollateralProfile } from "@/lib/collateral-data";
import {
  initialLegDayCollateralItems,
  initialLegDayCollateralProfile,
  normalizeCollateralItem
} from "@/lib/collateral-data";
import {
  createUnassignedSubEvent,
  resolveActiveEventInstanceId,
  normalizeEventInstance,
  initialEventFamilies,
  initialEventInstances,
  initialEventSubEvents,
  initialEventTypes,
  type EventFamily,
  type EventInstance,
  type EventSubEvent,
  type EventType
} from "@/lib/event-instances";
import type { ActionItem } from "@/lib/sample-data";
import { getDefaultWorkstreamSchedules, normalizeWorkstreamSchedules, type IssueStatus, type WorkstreamSchedule } from "@/lib/ops-utils";
import type { AppStateSnapshot } from "@/lib/app-transfer";

export type PersistedAppState = {
  items: ActionItem[];
  issueStatuses: Partial<Record<string, IssueStatus>>;
  collateralItems: CollateralItem[];
  collateralProfiles: Record<string, LegDayCollateralProfile>;
  activeEventInstanceId: string;
  defaultOwnerForNewItems: string;
  eventFamilies: EventFamily[];
  eventTypes: EventType[];
  eventInstances: EventInstance[];
  eventSubEvents: EventSubEvent[];
  workstreamSchedules: WorkstreamSchedule[];
};

export type LoadPersistedAppStateResult = {
  state: PersistedAppState | null;
  source: "primary" | "backup" | "none";
  primaryStateStatus: "valid" | "invalid" | "missing";
  backupStateStatus: "valid" | "invalid" | "missing";
  shouldPersist: boolean;
};

export const APP_STATE_STORAGE_KEY = "capma-ops-state";
export const APP_STATE_BACKUP_STORAGE_KEY = "capma-ops-state-backup";

export function loadPersistedAppState(
  normalizeItem: (item: ActionItem) => ActionItem
): LoadPersistedAppStateResult {
  if (typeof window === "undefined") {
    return {
      state: null,
      source: "none",
      primaryStateStatus: "missing",
      backupStateStatus: "missing",
      shouldPersist: true
    };
  }

  const primaryState = parseStoredAppState(
    window.localStorage.getItem(APP_STATE_STORAGE_KEY),
    normalizeItem
  );

  if (primaryState.status === "valid") {
    return {
      state: primaryState.state,
      source: "primary",
      primaryStateStatus: "valid",
      backupStateStatus: "missing",
      shouldPersist: true
    };
  }

  const backupState = parseStoredAppState(
    window.localStorage.getItem(APP_STATE_BACKUP_STORAGE_KEY),
    normalizeItem
  );

  if (backupState.status === "valid") {
    return {
      state: backupState.state,
      source: "backup",
      primaryStateStatus: primaryState.status,
      backupStateStatus: "valid",
      shouldPersist: true
    };
  }

  const noStoredState = primaryState.status === "missing" && backupState.status === "missing";

  return {
    state: null,
    source: "none",
    primaryStateStatus: primaryState.status,
    backupStateStatus: backupState.status,
    shouldPersist: noStoredState
  };
}

export function savePersistedAppState(state: PersistedAppState) {
  if (typeof window === "undefined") {
    return;
  }

  const serializedState = JSON.stringify({
    ...state,
    collateralItems: state.collateralItems.map((item) => ({ ...item })),
    collateralProfiles: Object.fromEntries(
      Object.entries(state.collateralProfiles).map(([instanceId, profile]) => [instanceId, { ...profile }])
    ),
    activeEventInstanceId: state.activeEventInstanceId,
    defaultOwnerForNewItems: state.defaultOwnerForNewItems,
    eventFamilies: state.eventFamilies.map((family) => ({ ...family })),
    eventTypes: state.eventTypes.map((eventType) => ({ ...eventType })),
    eventInstances: state.eventInstances.map((instance) => ({ ...instance })),
    eventSubEvents: state.eventSubEvents.map((subEvent) => ({ ...subEvent })),
    workstreamSchedules: normalizeWorkstreamSchedules(state.workstreamSchedules)
  });

  const currentPrimaryState = window.localStorage.getItem(APP_STATE_STORAGE_KEY);
  const currentBackupState = window.localStorage.getItem(APP_STATE_BACKUP_STORAGE_KEY);

  if (currentPrimaryState) {
    window.localStorage.setItem(APP_STATE_BACKUP_STORAGE_KEY, currentPrimaryState);
  }

  window.localStorage.setItem(APP_STATE_STORAGE_KEY, serializedState);

  if (!currentPrimaryState && !currentBackupState) {
    window.localStorage.setItem(APP_STATE_BACKUP_STORAGE_KEY, serializedState);
  }
}

export function clearPersistedAppState() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(APP_STATE_STORAGE_KEY);
  window.localStorage.removeItem(APP_STATE_BACKUP_STORAGE_KEY);
}

export function migratePersistedItems(
  items: ActionItem[],
  options: {
    legacySampleItemIds: readonly string[];
    getDefaultItems: () => ActionItem[];
    normalizeItem: (item: ActionItem) => ActionItem;
  }
) {
  const legacySampleIds = new Set<string>(options.legacySampleItemIds);

  if (items.length > 0 && items.every((item) => legacySampleIds.has(item.id))) {
    return options.getDefaultItems();
  }

  return items.map((item) => options.normalizeItem(item));
}

function isActionItemRecord(value: unknown): value is ActionItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<ActionItem> & { blocked?: unknown; notes?: unknown };

  return [
    item.id,
    item.title,
    item.type,
    item.workstream,
    item.dueDate,
    item.status,
    item.owner,
    item.waitingOn,
    item.lastUpdated
  ].every((field) => typeof field === "string") &&
    (item.noteEntries === undefined || isNoteEntryList(item.noteEntries)) &&
    (item.notes === undefined || typeof item.notes === "string") &&
    (item.isBlocked === undefined || typeof item.isBlocked === "boolean") &&
    (item.blocked === undefined || typeof item.blocked === "boolean") &&
    (item.blockedBy === undefined || typeof item.blockedBy === "string") &&
    (item.issue === undefined || typeof item.issue === "string") &&
    (item.operationalBucket === undefined || typeof item.operationalBucket === "string") &&
    (item.eventGroup === undefined || typeof item.eventGroup === "string") &&
    (item.legacyEventGroupMigrated === undefined || typeof item.legacyEventGroupMigrated === "boolean") &&
    (item.eventInstanceId === undefined || typeof item.eventInstanceId === "string") &&
    (item.subEventId === undefined || typeof item.subEventId === "string");
}

function isCollateralProfileRecord(value: unknown): value is LegDayCollateralProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const profile = value as Partial<LegDayCollateralProfile>;

  return [
    profile.eventStartDate,
    profile.eventEndDate,
    profile.roomBlockDeadline,
    profile.roomBlockNote,
    profile.logoDeadline,
    profile.logoDeadlineNote,
    profile.externalPrintingDue,
    profile.internalPrintingStart
  ].every((field) => typeof field === "string");
}

function isCollateralProfileMap(
  value: Record<string, LegDayCollateralProfile> | undefined
): value is Record<string, LegDayCollateralProfile> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((profile) => isCollateralProfileRecord(profile));
}

function isEventFamilyRecord(value: unknown): value is EventFamily {
  if (!value || typeof value !== "object") {
    return false;
  }

  const family = value as Partial<EventFamily>;
  return typeof family.id === "string" && typeof family.name === "string";
}

function isEventTypeRecord(value: unknown): value is EventType {
  if (!value || typeof value !== "object") {
    return false;
  }

  const eventType = value as Partial<EventType>;
  return (
    typeof eventType.id === "string" &&
    typeof eventType.name === "string" &&
    typeof eventType.familyId === "string"
  );
}

function isEventInstanceRecord(value: unknown): value is EventInstance {
  return !!value && typeof value === "object" && normalizeEventInstance(value as Partial<EventInstance>) !== null;
}

function isEventSubEventRecord(value: unknown): value is EventSubEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const subEvent = value as Partial<EventSubEvent>;
  return (
    typeof subEvent.id === "string" &&
    typeof subEvent.eventInstanceId === "string" &&
    typeof subEvent.name === "string" &&
    typeof subEvent.sortOrder === "number"
  );
}

function isNoteEntryList(value: unknown) {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      if (!entry || typeof entry !== "object") {
        return false;
      }

      const noteEntry = entry as {
        id?: unknown;
        text?: unknown;
        createdAt?: unknown;
        author?: { userId?: unknown; initials?: unknown; displayName?: unknown };
      };

      return (
        typeof noteEntry.id === "string" &&
        typeof noteEntry.text === "string" &&
        typeof noteEntry.createdAt === "string" &&
        Boolean(noteEntry.author) &&
        (noteEntry.author?.userId === null || typeof noteEntry.author?.userId === "string") &&
        typeof noteEntry.author?.initials === "string" &&
        (noteEntry.author?.displayName === undefined ||
          noteEntry.author?.displayName === null ||
          typeof noteEntry.author?.displayName === "string")
      );
    })
  );
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

function parseStoredAppState(
  rawState: string | null,
  normalizeItem: (item: ActionItem) => ActionItem
): { status: "valid"; state: PersistedAppState } | { status: "invalid" | "missing" } {
  if (!rawState) {
    return { status: "missing" };
  }

  try {
    const parsedState = JSON.parse(rawState) as Partial<PersistedAppState> & { collateralProfile?: unknown };

    if (!Array.isArray(parsedState.items) || !isIssueStatusMap(parsedState.issueStatuses)) {
      return { status: "invalid" };
    }

    const items = parsedState.items.filter(isActionItemRecord);
    const collateralItems = Array.isArray(parsedState.collateralItems)
      ? parsedState.collateralItems
          .map((item) => (item && typeof item === "object" ? normalizeCollateralItem(item as Partial<CollateralItem> & { subEvent?: unknown }) : null))
          .filter((item): item is CollateralItem => item !== null)
      : [];

    if (items.length !== parsedState.items.length) {
      return { status: "invalid" };
    }

    return {
      status: "valid",
      state: {
        items: items.map((item) => normalizeItem(item)),
        issueStatuses: parsedState.issueStatuses,
        ...normalizeEventScopedState({
          activeEventInstanceId:
            typeof parsedState.activeEventInstanceId === "string" && parsedState.activeEventInstanceId.length > 0
              ? parsedState.activeEventInstanceId
              : initialEventInstances[0].id,
          collateralItems,
          collateralProfiles: isCollateralProfileMap(parsedState.collateralProfiles)
            ? Object.fromEntries(
                Object.entries(parsedState.collateralProfiles).map(([instanceId, profile]) => [instanceId, { ...profile }])
              )
            : parsedState.collateralProfile && isCollateralProfileRecord(parsedState.collateralProfile)
              ? { [initialEventInstances[0].id]: { ...parsedState.collateralProfile } }
              : {},
          eventInstances: Array.isArray(parsedState.eventInstances)
            ? parsedState.eventInstances.reduce<EventInstance[]>((accumulator, instance) => {
                if (isEventInstanceRecord(instance)) {
                  const normalizedInstance = normalizeEventInstance(instance as Partial<EventInstance>);

                  if (normalizedInstance) {
                    accumulator.push(normalizedInstance);
                  }
                }

                return accumulator;
              }, [])
            : initialEventInstances.map((instance) => ({ ...instance })),
          eventSubEvents: Array.isArray(parsedState.eventSubEvents)
            ? parsedState.eventSubEvents.filter(isEventSubEventRecord).map((subEvent) => ({ ...subEvent }))
            : initialEventSubEvents.map((subEvent) => ({ ...subEvent })),
          eventTypes: Array.isArray(parsedState.eventTypes)
            ? parsedState.eventTypes.filter(isEventTypeRecord).map((eventType) => ({ ...eventType }))
            : initialEventTypes.map((eventType) => ({ ...eventType }))
        }),
        defaultOwnerForNewItems:
          typeof parsedState.defaultOwnerForNewItems === "string"
            ? parsedState.defaultOwnerForNewItems
            : "Melissa",
        eventFamilies: Array.isArray(parsedState.eventFamilies)
          ? parsedState.eventFamilies.filter(isEventFamilyRecord).map((family) => ({ ...family }))
          : initialEventFamilies.map((family) => ({ ...family })),
        workstreamSchedules: Array.isArray(parsedState.workstreamSchedules)
          ? normalizeWorkstreamSchedules(parsedState.workstreamSchedules)
          : getDefaultWorkstreamSchedules()
      }
    };
  } catch {
    return { status: "invalid" };
  }
}

function normalizeEventScopedState(input: {
  activeEventInstanceId: string;
  collateralItems: CollateralItem[];
  collateralProfiles: Record<string, LegDayCollateralProfile>;
  eventInstances: EventInstance[];
  eventSubEvents: EventSubEvent[];
  eventTypes: EventType[];
}) {
  const validEventTypeIds = new Set(input.eventTypes.map((eventType) => eventType.id));
  const normalizedEventInstances = input.eventInstances.filter((instance) => validEventTypeIds.has(instance.eventTypeId));
  const validEventInstanceIds = new Set(normalizedEventInstances.map((instance) => instance.id));
  const normalizedEventSubEvents = input.eventSubEvents.filter((subEvent) => validEventInstanceIds.has(subEvent.eventInstanceId));
  const unassignedSubEventIds = new Set(input.collateralItems.map((item) => item.subEventId).filter((subEventId) => subEventId.endsWith("-unassigned")));
  const ensuredUnassignedSubEvents = normalizedEventInstances
    .filter((instance) => unassignedSubEventIds.has(createUnassignedSubEvent(instance.id).id))
    .filter((instance) => !normalizedEventSubEvents.some((subEvent) => subEvent.id === createUnassignedSubEvent(instance.id).id))
    .map((instance) => createUnassignedSubEvent(instance.id));
  const eventSubEvents = [...normalizedEventSubEvents, ...ensuredUnassignedSubEvents];
  const subEventById = new Map(eventSubEvents.map((subEvent) => [subEvent.id, subEvent]));
  const collateralItems = input.collateralItems.filter((item) => {
    if (!validEventInstanceIds.has(item.eventInstanceId)) {
      return false;
    }

    const subEvent = subEventById.get(item.subEventId);
    return Boolean(subEvent && subEvent.eventInstanceId === item.eventInstanceId);
  });
  const collateralProfiles = Object.fromEntries(
    Object.entries(input.collateralProfiles).filter(([instanceId]) => validEventInstanceIds.has(instanceId))
  );
  const eventInstances =
    normalizedEventInstances.length > 0
      ? normalizedEventInstances
      : initialEventInstances.map((instance) => ({ ...instance }));
  const fallbackInstanceIds = new Set(eventInstances.map((instance) => instance.id));
  const resolvedEventSubEvents =
    normalizedEventInstances.length > 0
      ? eventSubEvents
      : initialEventSubEvents.map((subEvent) => ({ ...subEvent }));
  const resolvedCollateralProfiles =
    normalizedEventInstances.length > 0
      ? collateralProfiles
      : Object.fromEntries(
          Object.entries(collateralProfiles).filter(([instanceId]) => fallbackInstanceIds.has(instanceId))
        );
  const resolvedCollateralItems = normalizedEventInstances.length > 0 ? collateralItems : [];

  return {
    activeEventInstanceId: resolveActiveEventInstanceId(input.activeEventInstanceId, eventInstances),
    collateralItems: resolvedCollateralItems,
    collateralProfiles: resolvedCollateralProfiles,
    eventTypes: input.eventTypes,
    eventInstances,
    eventSubEvents: resolvedEventSubEvents
  };
}
