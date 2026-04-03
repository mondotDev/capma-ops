import {
  applyBulkActionItemUpdates,
  createActionItem,
  deleteActionItemById,
  normalizeActionItems,
  updateActionItemById,
  type ActionItemMutationContext,
  type NewActionItemInput
} from "@/lib/action-item-mutations";
import type { ActionItem } from "@/lib/sample-data";

export interface NativeActionItemMutator {
  archive(items: ActionItem[], id: string, context?: ActionItemMutationContext): ActionItem[];
  bulkUpdate(
    items: ActionItem[],
    ids: string[],
    updates: Partial<ActionItem>,
    context?: ActionItemMutationContext
  ): ActionItem[];
  create(items: ActionItem[], item: NewActionItemInput, context?: ActionItemMutationContext): ActionItem[];
  delete(items: ActionItem[], id: string): ActionItem[];
  normalizeLoaded(items: ActionItem[], context?: ActionItemMutationContext): ActionItem[];
  restore(items: ActionItem[], id: string, context?: ActionItemMutationContext): ActionItem[];
  update(
    items: ActionItem[],
    id: string,
    updates: Partial<ActionItem>,
    context?: ActionItemMutationContext
  ): ActionItem[];
}

class LocalNativeActionItemMutator implements NativeActionItemMutator {
  archive(items: ActionItem[], id: string, context?: ActionItemMutationContext) {
    return updateActionItemById(items, id, { archivedAt: getCurrentDateKey() }, context);
  }

  bulkUpdate(
    items: ActionItem[],
    ids: string[],
    updates: Partial<ActionItem>,
    context?: ActionItemMutationContext
  ) {
    return applyBulkActionItemUpdates(items, ids, updates, context);
  }

  create(items: ActionItem[], item: NewActionItemInput, context?: ActionItemMutationContext) {
    return [createActionItem(item, context), ...items];
  }

  delete(items: ActionItem[], id: string) {
    return deleteActionItemById(items, id);
  }

  normalizeLoaded(items: ActionItem[], context?: ActionItemMutationContext) {
    return normalizeActionItems(items, context);
  }

  restore(items: ActionItem[], id: string, context?: ActionItemMutationContext) {
    return updateActionItemById(items, id, { archivedAt: undefined }, context);
  }

  update(
    items: ActionItem[],
    id: string,
    updates: Partial<ActionItem>,
    context?: ActionItemMutationContext
  ) {
    return updateActionItemById(items, id, updates, context);
  }
}

export const nativeActionItemMutator: NativeActionItemMutator = new LocalNativeActionItemMutator();

function getCurrentDateKey() {
  return new Date().toISOString().slice(0, 10);
}
