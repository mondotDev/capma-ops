import { createFirestoreCollateralPersistenceStore } from "@/lib/firestore-collateral-persistence-store";
import {
  normalizePersistedCollateralState,
  type CollateralPersistenceContext,
  type PersistedCollateralState
} from "@/lib/collateral-persisted-state";

export type CollateralPersistenceStoreMode = "firebase" | "local";
export type { CollateralPersistenceContext, PersistedCollateralState } from "@/lib/collateral-persisted-state";

export interface CollateralPersistenceStore {
  mode: CollateralPersistenceStoreMode;
  load(state: PersistedCollateralState, context: CollateralPersistenceContext): Promise<PersistedCollateralState>;
  replaceAll(state: PersistedCollateralState, context: CollateralPersistenceContext): Promise<PersistedCollateralState>;
}

class LocalCollateralPersistenceStore implements CollateralPersistenceStore {
  mode: CollateralPersistenceStoreMode = "local";

  load(state: PersistedCollateralState, context: CollateralPersistenceContext) {
    return Promise.resolve(normalizePersistedCollateralState(state, context));
  }

  replaceAll(state: PersistedCollateralState, context: CollateralPersistenceContext) {
    return Promise.resolve(normalizePersistedCollateralState(state, context));
  }
}

export const localCollateralPersistenceStore: CollateralPersistenceStore = new LocalCollateralPersistenceStore();
export const firestoreCollateralPersistenceStore: CollateralPersistenceStore =
  createFirestoreCollateralPersistenceStore();

export function getCollateralPersistenceStoreMode(
  envValue = process.env.NEXT_PUBLIC_COLLATERAL_STORE_MODE
): CollateralPersistenceStoreMode {
  return envValue?.trim().toLowerCase() === "firebase" ? "firebase" : "local";
}

export function getSelectedCollateralPersistenceStore(
  mode: CollateralPersistenceStoreMode = getCollateralPersistenceStoreMode()
): CollateralPersistenceStore {
  return mode === "firebase" ? firestoreCollateralPersistenceStore : localCollateralPersistenceStore;
}
