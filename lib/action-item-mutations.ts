import type { ActionItem } from "@/lib/sample-data";
import type { EventInstance, EventSubEvent } from "@/lib/event-instances";
import {
  getSuggestedEventGroupForWorkstream,
  normalizeActionItemFields,
  resolveInitialOwner
} from "@/lib/ops-utils";

export type NewActionItemInput = Omit<ActionItem, "id" | "lastUpdated">;

export function createActionItem(item: NewActionItemInput): ActionItem {
  const normalizedItem = normalizeActionItemFields({
    ...item,
    eventGroup: item.eventGroup ?? getSuggestedEventGroupForWorkstream(item.workstream),
    legacyEventGroupMigrated: item.legacyEventGroupMigrated,
    owner: resolveInitialOwner(item.owner, item.workstream)
  });
  const slug = item.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const timestamp = Date.now().toString(36);

  return {
    ...normalizedItem,
    id: `${slug || "item"}-${timestamp}`,
    lastUpdated: getCurrentDateKey()
  };
}

export function applyActionItemUpdates(item: ActionItem, updates: Partial<ActionItem>): ActionItem {
  return {
    ...item,
    ...normalizeActionItemFields({ ...item, ...updates }),
    lastUpdated: updates.lastUpdated ?? getCurrentDateKey()
  };
}

export function applyBulkActionItemUpdates(
  items: ActionItem[],
  ids: string[],
  updates: Partial<ActionItem>
): ActionItem[] {
  const idSet = new Set(ids);

  return items.map((item) => (idSet.has(item.id) ? applyActionItemUpdates(item, updates) : item));
}

export function updateActionItemById(
  items: ActionItem[],
  id: string,
  updates: Partial<ActionItem>
): ActionItem[] {
  return items.map((item) => (item.id === id ? applyActionItemUpdates(item, updates) : item));
}

export function deleteActionItemById(items: ActionItem[], id: string): ActionItem[] {
  return items.filter((item) => item.id !== id);
}

export function prependActionItem(items: ActionItem[], item: NewActionItemInput): ActionItem[] {
  return [createActionItem(item), ...items];
}

export function normalizeActionItems(
  items: ActionItem[],
  options?: {
    eventInstances?: EventInstance[];
    eventSubEvents?: EventSubEvent[];
  }
): ActionItem[] {
  const normalizedItems = items.map((item) => normalizeActionItemFields({ ...item }));

  if (!options?.eventInstances || !options?.eventSubEvents) {
    return normalizedItems;
  }

  return normalizedItems.map((item) => normalizeActionEventLinks(item, options.eventInstances!, options.eventSubEvents!));
}

export function normalizeActionEventLinks(
  item: ActionItem,
  eventInstances: EventInstance[],
  eventSubEvents: EventSubEvent[]
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
    return item;
  }

  return {
    ...item,
    eventInstanceId: normalizedEventInstanceId,
    subEventId: normalizedSubEventId
  };
}

function getCurrentDateKey() {
  return new Date().toISOString().slice(0, 10);
}
