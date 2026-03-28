import type { ActionItem } from "@/lib/sample-data";
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

export function normalizeActionItems(items: ActionItem[]): ActionItem[] {
  return items.map((item) => normalizeActionItemFields({ ...item }));
}

function getCurrentDateKey() {
  return new Date().toISOString().slice(0, 10);
}
