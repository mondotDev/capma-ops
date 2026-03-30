import type { AppStateSnapshot } from "@/lib/app-transfer";
import type { AppStateData, ImportedAppState } from "@/lib/state/app-state-types";

export type LoadAppStateResult = {
  state: AppStateData | null;
  source: "primary" | "backup" | "none";
  primaryStateStatus: "valid" | "invalid" | "missing";
  backupStateStatus: "valid" | "invalid" | "missing";
  shouldPersist: boolean;
};

export interface AppStateRepository {
  // Keep the contract adapter-friendly so a future async Firebase repository can slot in
  // without changing the higher-level app-state workflow again.
  clear(): void;
  export(state: AppStateData): AppStateSnapshot;
  import(value: unknown): ImportedAppState;
  load(): LoadAppStateResult;
  save(state: AppStateData): void;
}
