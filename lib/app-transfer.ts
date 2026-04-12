import {
  initialLegDayCollateralItems,
  initialLegDayCollateralProfile,
  normalizeCollateralItem,
  type CollateralItem,
  type LegDayCollateralProfile
} from "@/lib/collateral-data";
import { localCollateralStore } from "@/lib/collateral-store";
import {
  createUnassignedSubEvent,
  normalizeEventSubEvents,
  resolveActiveEventInstanceId,
  normalizeEventInstance,
  normalizeSubEventScheduleMode,
  initialEventFamilies,
  initialEventInstances,
  initialEventSubEvents,
  initialEventTypes,
  type EventFamily,
  type EventInstance,
  type EventSubEvent,
  type EventType
} from "@/lib/event-instances";
import {
  normalizeSponsorshipSetupByInstance,
  type SponsorshipSetupByInstance
} from "@/lib/sponsor-fulfillment";
import type { ActionItem } from "@/lib/sample-data";
import {
  getDefaultWorkstreamSchedules,
  normalizeWorkstreamSchedules,
  type IssueStatus,
  type WorkstreamSchedule
} from "@/lib/ops-utils";

export type AppStateSnapshot = {
  version: 1;
  exportedAt: string;
  items: ActionItem[];
  issueStatuses: Partial<Record<string, IssueStatus>>;
  collateralItems: CollateralItem[];
  collateralProfiles: Record<string, LegDayCollateralProfile>;
  sponsorshipSetupByInstance?: SponsorshipSetupByInstance;
  sponsorPlacementsByInstance?: Record<string, unknown[]>;
  activeEventInstanceId: string;
  defaultOwnerForNewItems: string;
  eventFamilies: EventFamily[];
  eventTypes: EventType[];
  eventInstances: EventInstance[];
  eventSubEvents: EventSubEvent[];
  workstreamSchedules: WorkstreamSchedule[];
};

export function createAppStateSnapshot(
  items: ActionItem[],
  issueStatuses: Partial<Record<string, IssueStatus>>,
  collateralItems: CollateralItem[],
  collateralProfiles: Record<string, LegDayCollateralProfile>,
  sponsorshipSetupByInstance: SponsorshipSetupByInstance,
  activeEventInstanceId: string,
  defaultOwnerForNewItems: string,
  eventFamilies: EventFamily[],
  eventTypes: EventType[],
  eventInstances: EventInstance[],
  eventSubEvents: EventSubEvent[],
  workstreamSchedules: WorkstreamSchedule[]
): AppStateSnapshot {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    items: items.map((item) => ({ ...item })),
    issueStatuses: { ...issueStatuses },
    collateralItems: collateralItems.map((item) => ({ ...item })),
    collateralProfiles: Object.fromEntries(
      Object.entries(collateralProfiles).map(([instanceId, profile]) => [instanceId, { ...profile }])
    ),
    sponsorshipSetupByInstance: Object.fromEntries(
      Object.entries(sponsorshipSetupByInstance).map(([instanceId, setup]) => [
        instanceId,
        {
          opportunities: setup.opportunities.map((opportunity) => ({ ...opportunity })),
          commitments: setup.commitments.map((commitment) => ({ ...commitment }))
        }
      ])
    ),
    activeEventInstanceId,
    defaultOwnerForNewItems,
    eventFamilies: eventFamilies.map((family) => ({ ...family })),
    eventTypes: eventTypes.map((eventType) => ({ ...eventType })),
    eventInstances: eventInstances.map((instance) => ({ ...instance })),
    eventSubEvents: eventSubEvents.map((subEvent) => ({ ...subEvent })),
    workstreamSchedules: normalizeWorkstreamSchedules(workstreamSchedules)
  };
}

export function parseImportedAppState(
  value: unknown
): ({
  items: ActionItem[];
  issueStatuses: Partial<Record<string, IssueStatus>>;
  collateralItems: CollateralItem[];
  collateralProfiles: Record<string, LegDayCollateralProfile>;
  sponsorshipSetupByInstance: SponsorshipSetupByInstance;
  activeEventInstanceId: string;
  defaultOwnerForNewItems: string;
  eventFamilies: EventFamily[];
  eventTypes: EventType[];
  eventInstances: EventInstance[];
  eventSubEvents: EventSubEvent[];
  workstreamSchedules: WorkstreamSchedule[];
} & { usedLegacyFormat: boolean }) | null {
  if (Array.isArray(value)) {
    const items = value.filter(isActionItemRecord);

    if (items.length !== value.length) {
      return null;
    }

    return {
      items,
      issueStatuses: {},
      collateralItems: [],
      collateralProfiles: { [initialEventInstances[0].id]: { ...initialLegDayCollateralProfile } },
      sponsorshipSetupByInstance: {},
      activeEventInstanceId: initialEventInstances[0].id,
      defaultOwnerForNewItems: "Melissa",
      eventFamilies: initialEventFamilies.map((family) => ({ ...family })),
      eventTypes: initialEventTypes.map((eventType) => ({ ...eventType })),
      eventInstances: initialEventInstances.map((instance) => ({ ...instance })),
      eventSubEvents: initialEventSubEvents.map((subEvent) => ({ ...subEvent })),
      workstreamSchedules: getDefaultWorkstreamSchedules(),
      usedLegacyFormat: true
    };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const snapshot = value as Partial<AppStateSnapshot> & { collateralProfile?: unknown };

  if (!Array.isArray(snapshot.items) || !isIssueStatusMap(snapshot.issueStatuses)) {
    return null;
  }

  const items = snapshot.items.filter(isActionItemRecord);
  const collateralItems = Array.isArray(snapshot.collateralItems)
    ? snapshot.collateralItems
        .map((item) => (item && typeof item === "object" ? normalizeCollateralItem(item as Partial<CollateralItem> & { subEvent?: unknown }) : null))
        .filter((item): item is CollateralItem => item !== null)
    : [];

  if (items.length !== snapshot.items.length) {
    return null;
  }

  const normalizedEventScopedState = normalizeEventScopedState({
    activeEventInstanceId:
      typeof snapshot.activeEventInstanceId === "string" && snapshot.activeEventInstanceId.length > 0
        ? snapshot.activeEventInstanceId
        : initialEventInstances[0].id,
    collateralItems,
    collateralProfiles: isCollateralProfileMap(snapshot.collateralProfiles)
      ? Object.fromEntries(
          Object.entries(snapshot.collateralProfiles).map(([instanceId, profile]) => [instanceId, { ...profile }])
        )
      : snapshot.collateralProfile && isCollateralProfileRecord(snapshot.collateralProfile)
        ? { [initialEventInstances[0].id]: { ...snapshot.collateralProfile } }
        : {},
    sponsorshipSetupByInstance:
      snapshot.sponsorshipSetupByInstance && typeof snapshot.sponsorshipSetupByInstance === "object"
        ? snapshot.sponsorshipSetupByInstance
        : {},
    sponsorPlacementsByInstance:
      snapshot.sponsorPlacementsByInstance && typeof snapshot.sponsorPlacementsByInstance === "object"
        ? snapshot.sponsorPlacementsByInstance
        : {},
    eventInstances: Array.isArray(snapshot.eventInstances)
      ? snapshot.eventInstances.reduce<EventInstance[]>((accumulator, instance) => {
          if (isEventInstanceRecord(instance)) {
            const normalizedInstance = normalizeEventInstance(instance as Partial<EventInstance>);

            if (normalizedInstance) {
              accumulator.push(normalizedInstance);
            }
          }

          return accumulator;
        }, [])
      : initialEventInstances.map((instance) => ({ ...instance })),
    eventSubEvents: Array.isArray(snapshot.eventSubEvents)
      ? snapshot.eventSubEvents.filter(isEventSubEventRecord).map((subEvent) => ({ ...subEvent }))
      : initialEventSubEvents.map((subEvent) => ({ ...subEvent })),
    eventTypes: Array.isArray(snapshot.eventTypes)
      ? snapshot.eventTypes.filter(isEventTypeRecord).map((eventType) => ({ ...eventType }))
      : initialEventTypes.map((eventType) => ({ ...eventType }))
  });

  return {
    items,
    issueStatuses: snapshot.issueStatuses,
    ...normalizedEventScopedState,
    collateralItems: localCollateralStore.normalizeLoaded(normalizedEventScopedState.collateralItems, {
      eventInstances: normalizedEventScopedState.eventInstances,
      eventSubEvents: normalizedEventScopedState.eventSubEvents
    }),
    defaultOwnerForNewItems:
      typeof snapshot.defaultOwnerForNewItems === "string" ? snapshot.defaultOwnerForNewItems : "Melissa",
    eventFamilies: Array.isArray(snapshot.eventFamilies)
      ? snapshot.eventFamilies.filter(isEventFamilyRecord).map((family) => ({ ...family }))
      : initialEventFamilies.map((family) => ({ ...family })),
    workstreamSchedules: Array.isArray(snapshot.workstreamSchedules)
      ? normalizeWorkstreamSchedules(snapshot.workstreamSchedules)
      : getDefaultWorkstreamSchedules(),
    usedLegacyFormat: false
  };
}

function normalizeEventScopedState(input: {
  activeEventInstanceId: string;
  collateralItems: CollateralItem[];
  collateralProfiles: Record<string, LegDayCollateralProfile>;
  sponsorshipSetupByInstance?: SponsorshipSetupByInstance;
  sponsorPlacementsByInstance?: Record<string, unknown[]>;
  eventInstances: EventInstance[];
  eventSubEvents: EventSubEvent[];
  eventTypes: EventType[];
}) {
  const validEventTypeIds = new Set(input.eventTypes.map((eventType) => eventType.id));
  const normalizedEventInstances = input.eventInstances.filter((instance) => validEventTypeIds.has(instance.eventTypeId));
  const validEventInstanceIds = new Set(normalizedEventInstances.map((instance) => instance.id));
  const normalizedSubEventState = normalizeEventSubEvents(
    input.eventSubEvents.filter((subEvent) => validEventInstanceIds.has(subEvent.eventInstanceId))
  );
  const normalizedEventSubEvents = normalizedSubEventState.subEvents;
  const unassignedSubEventIds = new Set(input.collateralItems.map((item) => item.subEventId).filter((subEventId) => subEventId.endsWith("-unassigned")));
  const ensuredUnassignedSubEvents = normalizedEventInstances
    .filter((instance) => unassignedSubEventIds.has(createUnassignedSubEvent(instance.id).id))
    .filter((instance) => !normalizedEventSubEvents.some((subEvent) => subEvent.id === createUnassignedSubEvent(instance.id).id))
    .map((instance) => createUnassignedSubEvent(instance.id));
  const eventSubEvents = [...normalizedEventSubEvents, ...ensuredUnassignedSubEvents];
  const subEventById = new Map(eventSubEvents.map((subEvent) => [subEvent.id, subEvent]));
  const collateralItems = input.collateralItems.filter((item) => {
    const normalizedSubEventId = normalizedSubEventState.canonicalIdByOriginalId.get(item.subEventId) ?? item.subEventId;

    if (!validEventInstanceIds.has(item.eventInstanceId)) {
      return false;
    }

    const subEvent = subEventById.get(normalizedSubEventId);
    return Boolean(subEvent && subEvent.eventInstanceId === item.eventInstanceId);
  }).map((item) => ({
    ...item,
    subEventId: normalizedSubEventState.canonicalIdByOriginalId.get(item.subEventId) ?? item.subEventId
  }));
  const collateralProfiles = Object.fromEntries(
    Object.entries(input.collateralProfiles).filter(([instanceId]) => validEventInstanceIds.has(instanceId))
  );
  const sponsorshipSetupByInstance = normalizeSponsorshipSetupByInstance(
    input.sponsorshipSetupByInstance,
    {
      eventInstances: normalizedEventInstances,
      eventSubEvents,
      legacyPlacementsByInstance: input.sponsorPlacementsByInstance
    }
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
    sponsorshipSetupByInstance,
    eventTypes: input.eventTypes,
    eventInstances,
    eventSubEvents: resolvedEventSubEvents
  };
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
    typeof subEvent.sortOrder === "number" &&
    (subEvent.scheduleMode === undefined || normalizeSubEventScheduleMode(subEvent.scheduleMode, subEvent.name) !== null) &&
    (subEvent.date === undefined || typeof subEvent.date === "string") &&
    (subEvent.endDate === undefined || typeof subEvent.endDate === "string") &&
    (subEvent.startTime === undefined || typeof subEvent.startTime === "string") &&
    (subEvent.endTime === undefined || typeof subEvent.endTime === "string")
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
