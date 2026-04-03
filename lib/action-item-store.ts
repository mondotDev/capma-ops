import { createFirestoreNativeActionItemStore } from "@/lib/firestore-native-action-item-store";
import { nativeActionItemMutator } from "@/lib/native-action-item-mutator";
import type { ActionItemMutationContext, NewActionItemInput } from "@/lib/action-item-mutations";
import type { ActionItem } from "@/lib/sample-data";

export type NativeActionItemStoreMode = "firebase" | "local";

export type NativeActionItemRecoveryInfo = {
  firestoreEmpty: boolean;
  localRecoveryItemCount: number;
  canImportFromLocal: boolean;
};

export interface NativeActionItemStore {
  mode: NativeActionItemStoreMode;
  archive(items: ActionItem[], id: string, context?: ActionItemMutationContext): Promise<ActionItem[]>;
  bulkUpdate(
    items: ActionItem[],
    ids: string[],
    updates: Partial<ActionItem>,
    context?: ActionItemMutationContext
  ): Promise<ActionItem[]>;
  create(items: ActionItem[], item: NewActionItemInput, context?: ActionItemMutationContext): Promise<ActionItem[]>;
  delete(items: ActionItem[], id: string): Promise<ActionItem[]>;
  load(items: ActionItem[], context?: ActionItemMutationContext): Promise<ActionItem[]>;
  replaceAll(items: ActionItem[], context?: ActionItemMutationContext): Promise<ActionItem[]>;
  restore(items: ActionItem[], id: string, context?: ActionItemMutationContext): Promise<ActionItem[]>;
  update(
    items: ActionItem[],
    id: string,
    updates: Partial<ActionItem>,
    context?: ActionItemMutationContext
  ): Promise<ActionItem[]>;
}

class LocalNativeActionItemStore implements NativeActionItemStore {
  mode: NativeActionItemStoreMode = "local";

  archive(items: ActionItem[], id: string, context?: ActionItemMutationContext) {
    return Promise.resolve(nativeActionItemMutator.archive(items, id, context));
  }

  bulkUpdate(
    items: ActionItem[],
    ids: string[],
    updates: Partial<ActionItem>,
    context?: ActionItemMutationContext
  ) {
    return Promise.resolve(nativeActionItemMutator.bulkUpdate(items, ids, updates, context));
  }

  create(items: ActionItem[], item: NewActionItemInput, context?: ActionItemMutationContext) {
    return Promise.resolve(nativeActionItemMutator.create(items, item, context));
  }

  delete(items: ActionItem[], id: string) {
    return Promise.resolve(nativeActionItemMutator.delete(items, id));
  }

  load(items: ActionItem[], context?: ActionItemMutationContext) {
    return Promise.resolve(nativeActionItemMutator.normalizeLoaded(items, context));
  }

  replaceAll(items: ActionItem[], context?: ActionItemMutationContext) {
    return Promise.resolve(nativeActionItemMutator.normalizeLoaded(items, context));
  }

  restore(items: ActionItem[], id: string, context?: ActionItemMutationContext) {
    return Promise.resolve(nativeActionItemMutator.restore(items, id, context));
  }

  update(
    items: ActionItem[],
    id: string,
    updates: Partial<ActionItem>,
    context?: ActionItemMutationContext
  ) {
    return Promise.resolve(nativeActionItemMutator.update(items, id, updates, context));
  }
}

export const localNativeActionItemStore: NativeActionItemStore = new LocalNativeActionItemStore();
export const firestoreNativeActionItemStore: NativeActionItemStore = createFirestoreNativeActionItemStore();

export function getNativeActionItemStoreMode(
  envValue = process.env.NEXT_PUBLIC_NATIVE_ACTION_ITEM_STORE_MODE
): NativeActionItemStoreMode {
  return envValue?.trim().toLowerCase() === "local" ? "local" : "firebase";
}

export function getSelectedNativeActionItemStore(
  mode: NativeActionItemStoreMode = getNativeActionItemStoreMode()
): NativeActionItemStore {
  return mode === "local" ? localNativeActionItemStore : firestoreNativeActionItemStore;
}

export function getNativeActionItemRecoveryInfo(input: {
  mode: NativeActionItemStoreMode;
  firestoreItemCount: number;
  localRecoveryItemCount: number;
}): NativeActionItemRecoveryInfo {
  const firestoreEmpty = input.mode === "firebase" && input.firestoreItemCount === 0;

  return {
    firestoreEmpty,
    localRecoveryItemCount: input.localRecoveryItemCount,
    canImportFromLocal: firestoreEmpty && input.localRecoveryItemCount > 0
  };
}
