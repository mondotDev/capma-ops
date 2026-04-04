import type { CollateralProfilesByInstance } from "@/lib/state/app-state-types";
import type { CollateralItem } from "@/lib/collateral-data";
import {
  deriveEventDateRange,
  getUnassignedSubEventId,
  normalizeEventSubEvents,
  normalizeSubEventName,
  type EventInstance,
  type EventSubEvent
} from "@/lib/event-instances";
import { isDefaultSubEventNameForEventType } from "@/lib/event-type-definitions";
import type { ActionItem } from "@/lib/sample-data";
import type {
  UpdateEventInstanceInput,
  UpsertEventSubEventInput
} from "@/lib/state/app-state-types";

export function buildUpdatedEventInstanceState(input: {
  currentEventInstances: EventInstance[];
  currentCollateralProfiles: CollateralProfilesByInstance;
  instanceId: string;
  updates: UpdateEventInstanceInput;
}) {
  const instance = input.currentEventInstances.find((entry) => entry.id === input.instanceId) ?? null;

  if (!instance) {
    return null;
  }

  const nextDateMode = input.updates.dateMode ?? instance.dateMode;
  const nextDates = input.updates.dates ?? instance.dates;
  const { dates, startDate, endDate } = deriveEventDateRange(nextDateMode, nextDates);
  const nextName =
    input.updates.instanceName !== undefined
      ? input.updates.instanceName.trim()
      : instance.name;

  if (!nextName || !startDate || !endDate) {
    return null;
  }

  const nextInstance = {
    ...instance,
    name: nextName,
    dateMode: nextDateMode,
    dates,
    startDate,
    endDate,
    location:
      input.updates.location !== undefined
        ? input.updates.location.trim() || undefined
        : instance.location,
    notes:
      input.updates.notes !== undefined
        ? input.updates.notes.trim() || undefined
        : instance.notes
  } satisfies EventInstance;

  const nextEventInstances = input.currentEventInstances
    .map((entry) => (entry.id === input.instanceId ? nextInstance : entry))
    .sort((left, right) => left.startDate.localeCompare(right.startDate));

  const nextCollateralProfiles =
    instance.eventTypeId === "legislative-day" && input.currentCollateralProfiles[input.instanceId]
      ? {
          ...input.currentCollateralProfiles,
          [input.instanceId]: {
            ...input.currentCollateralProfiles[input.instanceId],
            eventStartDate: startDate,
            eventEndDate: endDate
          }
        }
      : input.currentCollateralProfiles;

  return {
    eventInstance: nextInstance,
    nextEventInstances,
    nextCollateralProfiles
  };
}

export function upsertEventSubEventState(input: {
  currentEventSubEvents: EventSubEvent[];
  instanceId: string;
  upsert: UpsertEventSubEventInput;
}) {
  const nextName = normalizeSubEventName(input.upsert.name);

  if (!nextName) {
    return null;
  }

  const currentInstanceSubEvents = input.currentEventSubEvents.filter(
    (subEvent) => subEvent.eventInstanceId === input.instanceId
  );
  const collidingSubEvent = currentInstanceSubEvents.find(
    (subEvent) =>
      subEvent.id !== input.upsert.id &&
      normalizeSubEventName(subEvent.name) === nextName
  );

  if (collidingSubEvent) {
    return null;
  }

  if (input.upsert.id) {
    const existing = currentInstanceSubEvents.find((subEvent) => subEvent.id === input.upsert.id);
    if (!existing || existing.id === getUnassignedSubEventId(input.instanceId)) {
      return null;
    }

    const nextEventSubEvents = normalizeEventSubEvents(
      input.currentEventSubEvents.map((subEvent) =>
        subEvent.id === input.upsert.id
          ? {
              ...subEvent,
              name: nextName,
              sortOrder: input.upsert.sortOrder ?? subEvent.sortOrder,
              date: input.upsert.date?.trim() || undefined,
              startTime: input.upsert.startTime?.trim() || undefined,
              endTime: input.upsert.endTime?.trim() || undefined
            }
          : subEvent
      )
    ).subEvents;

    return {
      nextEventSubEvents,
      upsertedSubEventId: existing.id
    };
  }

  const existingSortOrders = currentInstanceSubEvents
    .filter((subEvent) => subEvent.id !== getUnassignedSubEventId(input.instanceId))
    .map((subEvent) => subEvent.sortOrder);
  const nextSortOrder =
    input.upsert.sortOrder ??
    ((existingSortOrders.length > 0 ? Math.max(...existingSortOrders) : 0) + 10);
  const nextId = createUniqueEventSubEventId(
    input.instanceId,
    nextName,
    new Set(input.currentEventSubEvents.map((subEvent) => subEvent.id))
  );
  const nextEventSubEvents = normalizeEventSubEvents([
    ...input.currentEventSubEvents,
    {
      id: nextId,
      eventInstanceId: input.instanceId,
      name: nextName,
      sortOrder: nextSortOrder,
      date: input.upsert.date?.trim() || undefined,
      startTime: input.upsert.startTime?.trim() || undefined,
      endTime: input.upsert.endTime?.trim() || undefined
    }
  ]).subEvents;

  return {
    nextEventSubEvents,
    upsertedSubEventId: nextId
  };
}

export function removeEventSubEventState(input: {
  currentEventSubEvents: EventSubEvent[];
  currentEventInstances: EventInstance[];
  currentItems: ActionItem[];
  currentCollateralItems: CollateralItem[];
  instanceId: string;
  subEventId: string;
}) {
  const subEvent = input.currentEventSubEvents.find(
    (entry) => entry.id === input.subEventId && entry.eventInstanceId === input.instanceId
  );
  const instance = input.currentEventInstances.find((entry) => entry.id === input.instanceId) ?? null;

  if (!subEvent || !instance) {
    return { removed: false as const };
  }

  if (subEvent.id === getUnassignedSubEventId(input.instanceId)) {
    return { removed: false as const };
  }

  if (isDefaultSubEventNameForEventType(instance.eventTypeId, subEvent.name)) {
    return { removed: false as const };
  }

  const isInUse =
    input.currentItems.some((item) => item.eventInstanceId === input.instanceId && item.subEventId === subEvent.id) ||
    input.currentCollateralItems.some(
      (item) => item.eventInstanceId === input.instanceId && item.subEventId === subEvent.id
    );

  if (isInUse) {
    return { removed: false as const };
  }

  return {
    removed: true as const,
    nextEventSubEvents: normalizeEventSubEvents(
      input.currentEventSubEvents.filter((entry) => entry.id !== subEvent.id)
    ).subEvents
  };
}

function createUniqueEventSubEventId(instanceId: string, name: string, usedIds: Set<string>) {
  const baseId = `${instanceId}-${slugify(name)}`;
  if (!usedIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (usedIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
