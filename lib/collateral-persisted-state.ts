import type { CollateralItem, LegDayCollateralProfile } from "@/lib/collateral-data";
import { localCollateralStore } from "@/lib/collateral-store";
import {
  createUnassignedSubEvent,
  normalizeEventInstance,
  normalizeEventSubEvents,
  type EventInstance,
  type EventSubEvent,
  type EventType
} from "@/lib/event-instances";

export type PersistedCollateralState = {
  collateralItems: CollateralItem[];
  collateralProfiles: Record<string, LegDayCollateralProfile>;
  eventInstances: EventInstance[];
  eventSubEvents: EventSubEvent[];
};

export type CollateralPersistenceContext = {
  defaultOwner: string;
  eventTypes: EventType[];
};

export function normalizePersistedCollateralState(
  state: PersistedCollateralState,
  context: CollateralPersistenceContext
): PersistedCollateralState {
  const validEventTypeIds = new Set(context.eventTypes.map((eventType) => eventType.id));
  const normalizedEventInstances = state.eventInstances.reduce<EventInstance[]>((accumulator, rawInstance) => {
    const normalizedInstance = normalizeEventInstance(rawInstance);

    if (normalizedInstance && validEventTypeIds.has(normalizedInstance.eventTypeId)) {
      accumulator.push(normalizedInstance);
    }

    return accumulator;
  }, []);
  const validEventInstanceIds = new Set(normalizedEventInstances.map((instance) => instance.id));
  const normalizedSubEventState = normalizeEventSubEvents(
    state.eventSubEvents
      .filter((subEvent) => validEventInstanceIds.has(subEvent.eventInstanceId))
      .map((subEvent) => ({ ...subEvent }))
  );
  const normalizedEventSubEvents = normalizedSubEventState.subEvents;
  const ensuredUnassignedSubEvents = normalizedEventInstances
    .filter((instance) => !normalizedEventSubEvents.some((subEvent) => subEvent.id === createUnassignedSubEvent(instance.id).id))
    .map((instance) => createUnassignedSubEvent(instance.id));
  const eventSubEvents = [...normalizedEventSubEvents, ...ensuredUnassignedSubEvents];
  const remappedCollateralItems = state.collateralItems.map((item) => ({
    ...item,
    subEventId: normalizedSubEventState.canonicalIdByOriginalId.get(item.subEventId) ?? item.subEventId
  }));
  const collateralItems = localCollateralStore.normalizeLoaded(remappedCollateralItems, {
    defaultOwner: context.defaultOwner,
    eventInstances: normalizedEventInstances,
    eventSubEvents
  });
  const collateralProfiles = Object.fromEntries(
    Object.entries(state.collateralProfiles)
      .filter(([instanceId]) => validEventInstanceIds.has(instanceId))
      .map(([instanceId, profile]) => [instanceId, { ...profile }])
  );

  return {
    collateralItems,
    collateralProfiles,
    eventInstances: normalizedEventInstances,
    eventSubEvents
  };
}
