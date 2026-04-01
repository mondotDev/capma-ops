import type { ActionItem } from "@/lib/sample-data";
import type { EventInstance, EventProgram, EventSubEvent } from "@/lib/event-instances";
import {
  getSuggestedEventGroupForWorkstream,
  getSuggestedOperationalBucketForWorkstream,
  normalizeActionItemFields,
  normalizeIdentifierValue,
  normalizeOperationalBucketValue,
  normalizeWorkstreamValue,
  resolveInitialOwner
} from "@/lib/ops-utils";

export type NewActionItemInput = Omit<ActionItem, "id" | "lastUpdated">;
export type ActionItemMutationContext = {
  eventInstances?: EventInstance[];
  eventPrograms?: EventProgram[];
  eventTypes?: EventProgram[];
  eventSubEvents?: EventSubEvent[];
};

export function createActionItem(item: NewActionItemInput, context?: ActionItemMutationContext): ActionItem {
  const slug = item.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const timestamp = Date.now().toString(36);
  const baseItem = {
    ...normalizeActionItemFields({
      ...item,
      eventGroup: item.eventGroup ?? getSuggestedEventGroupForWorkstream(item.workstream),
      operationalBucket: item.operationalBucket ?? getSuggestedOperationalBucketForWorkstream(item.workstream),
      legacyEventGroupMigrated: item.legacyEventGroupMigrated,
      owner: resolveInitialOwner(item.owner, item.workstream)
    }),
    id: `${slug || "item"}-${timestamp}`,
    lastUpdated: getCurrentDateKey()
  } satisfies ActionItem;
  const normalizedItem = reconcileActionItemFields(baseItem, item, context);

  return {
    ...normalizedItem,
  };
}

export function applyActionItemUpdates(
  item: ActionItem,
  updates: Partial<ActionItem>,
  context?: ActionItemMutationContext
): ActionItem {
  return {
    ...item,
    ...reconcileActionItemFields(
      normalizeActionItemFields({ ...item, ...updates }),
      updates,
      context,
      item
    ),
    lastUpdated: updates.lastUpdated ?? getCurrentDateKey()
  };
}

export function applyBulkActionItemUpdates(
  items: ActionItem[],
  ids: string[],
  updates: Partial<ActionItem>,
  context?: ActionItemMutationContext
): ActionItem[] {
  const idSet = new Set(ids);

  return items.map((item) => (idSet.has(item.id) ? applyActionItemUpdates(item, updates, context) : item));
}

export function updateActionItemById(
  items: ActionItem[],
  id: string,
  updates: Partial<ActionItem>,
  context?: ActionItemMutationContext
): ActionItem[] {
  return items.map((item) => (item.id === id ? applyActionItemUpdates(item, updates, context) : item));
}

export function deleteActionItemById(items: ActionItem[], id: string): ActionItem[] {
  return items.filter((item) => item.id !== id);
}

export function prependActionItem(
  items: ActionItem[],
  item: NewActionItemInput,
  context?: ActionItemMutationContext
): ActionItem[] {
  return [createActionItem(item, context), ...items];
}

export function normalizeActionItems(
  items: ActionItem[],
  options?: {
    eventInstances?: EventInstance[];
    eventPrograms?: EventProgram[];
    eventTypes?: EventProgram[];
    eventSubEvents?: EventSubEvent[];
  }
): ActionItem[] {
  const normalizedItems = items.map((item) =>
    reconcileActionItemFields(normalizeActionItemFields({ ...item }), {}, options)
  );

  if (!options?.eventInstances || !options?.eventSubEvents) {
    return normalizedItems;
  }

  return normalizedItems.map((item) =>
    normalizeActionEventLinks(
      item,
      options.eventInstances!,
      options.eventSubEvents!,
      options.eventPrograms ?? options.eventTypes
    )
  );
}

export function normalizeActionEventLinks(
  item: ActionItem,
  eventInstances: EventInstance[],
  eventSubEvents: EventSubEvent[],
  eventPrograms?: EventProgram[]
): ActionItem {
  const normalizedEventInstanceId = eventInstances.some((instance) => instance.id === item.eventInstanceId)
    ? item.eventInstanceId
    : undefined;
  const normalizedSubEventId =
    normalizedEventInstanceId &&
    eventSubEvents.some(
      (subEvent) => subEvent.id === item.subEventId && subEvent.eventInstanceId === normalizedEventInstanceId
    )
      ? item.subEventId
      : undefined;

  if (normalizedEventInstanceId === item.eventInstanceId && normalizedSubEventId === item.subEventId) {
    return reconcileActionItemFields(item, {}, { eventInstances, eventPrograms, eventSubEvents });
  }

  return reconcileActionItemFields(
    {
      ...item,
      eventInstanceId: normalizedEventInstanceId,
      subEventId: normalizedSubEventId
    },
    {},
    { eventInstances, eventPrograms, eventSubEvents }
  );
}

function reconcileActionItemFields(
  item: ActionItem,
  updates: Partial<ActionItem>,
  context?: ActionItemMutationContext,
  previousItem?: ActionItem
): ActionItem {
  const eventPrograms = context?.eventPrograms ?? context?.eventTypes ?? [];
  const eventInstances = context?.eventInstances ?? [];
  const eventSubEvents = context?.eventSubEvents ?? [];
  const hasExplicitEventInstance = hasOwnField(updates, "eventInstanceId");
  const hasExplicitOperationalBucket = hasOwnField(updates, "operationalBucket");
  const hasExplicitWorkstream = hasOwnField(updates, "workstream");
  const explicitOperationalBucket = normalizeOperationalBucketValue(updates.operationalBucket);
  const previousEventWorkstream = previousItem
    ? resolveEventWorkstream(previousItem.eventInstanceId, eventInstances, eventPrograms)
    : undefined;
  const nextEventWorkstream = resolveEventWorkstream(item.eventInstanceId, eventInstances, eventPrograms);

  if (hasExplicitOperationalBucket && explicitOperationalBucket && !hasExplicitEventInstance) {
    return normalizeActionItemFields({
      ...item,
      workstream: explicitOperationalBucket,
      eventGroup: explicitOperationalBucket,
      operationalBucket: explicitOperationalBucket,
      eventInstanceId: undefined,
      subEventId: undefined,
      legacyEventGroupMigrated: true
    });
  }

  if (
    hasExplicitWorkstream &&
    previousItem?.eventInstanceId &&
    previousEventWorkstream &&
    normalizeWorkstreamValue(updates.workstream) !== previousEventWorkstream &&
    !hasExplicitEventInstance
  ) {
    return normalizeActionItemFields({
      ...item,
      eventInstanceId: undefined,
      subEventId: undefined
    });
  }

  if (item.eventInstanceId && nextEventWorkstream) {
    const reconciled = normalizeActionItemFields({
      ...item,
      workstream: nextEventWorkstream,
      eventGroup: nextEventWorkstream,
      operationalBucket: undefined,
      legacyEventGroupMigrated: true
    });

    return {
      ...reconciled,
      subEventId: normalizeSubEventId(reconciled.subEventId, reconciled.eventInstanceId, eventSubEvents)
    };
  }

  const normalizedOperationalBucket = normalizeOperationalBucketValue(item.operationalBucket);

  if (normalizedOperationalBucket) {
    return normalizeActionItemFields({
      ...item,
      workstream: normalizedOperationalBucket,
      eventGroup: normalizedOperationalBucket,
      operationalBucket: normalizedOperationalBucket,
      eventInstanceId: undefined,
      subEventId: undefined,
      legacyEventGroupMigrated: true
    });
  }

  return {
    ...item,
    subEventId: normalizeSubEventId(item.subEventId, item.eventInstanceId, eventSubEvents)
  };
}

function resolveEventWorkstream(
  eventInstanceId: string | undefined,
  eventInstances: EventInstance[],
  eventPrograms: EventProgram[]
) {
  const normalizedEventInstanceId = normalizeIdentifierValue(eventInstanceId);

  if (!normalizedEventInstanceId) {
    return undefined;
  }

  const eventInstance = eventInstances.find((instance) => instance.id === normalizedEventInstanceId);

  if (!eventInstance) {
    return undefined;
  }

  return eventPrograms.find((eventProgram) => eventProgram.id === eventInstance.eventTypeId)?.name;
}

function normalizeSubEventId(
  subEventId: string | undefined,
  eventInstanceId: string | undefined,
  eventSubEvents: EventSubEvent[]
) {
  const normalizedEventInstanceId = normalizeIdentifierValue(eventInstanceId);
  const normalizedSubEventId = normalizeIdentifierValue(subEventId);

  if (!normalizedEventInstanceId || !normalizedSubEventId) {
    return undefined;
  }

  return eventSubEvents.some(
    (subEvent) => subEvent.id === normalizedSubEventId && subEvent.eventInstanceId === normalizedEventInstanceId
  )
    ? normalizedSubEventId
    : undefined;
}

function hasOwnField<T extends object>(value: T, key: keyof ActionItem) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function getCurrentDateKey() {
  return new Date().toISOString().slice(0, 10);
}
