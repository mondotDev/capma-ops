import type { ActionItem } from "@/lib/sample-data";
import type { IssueStatus } from "@/lib/ops-utils";

export type PersistedAppState = {
  items: ActionItem[];
  issueStatuses: Partial<Record<string, IssueStatus>>;
};

export type LoadPersistedAppStateResult = {
  state: PersistedAppState | null;
  source: "primary" | "backup" | "none";
  primaryStateStatus: "valid" | "invalid" | "missing";
  backupStateStatus: "valid" | "invalid" | "missing";
  shouldPersist: boolean;
};

export type AppStateSnapshot = {
  version: 1;
  exportedAt: string;
  items: ActionItem[];
  issueStatuses: Partial<Record<string, IssueStatus>>;
};

export const APP_STATE_STORAGE_KEY = "capma-ops-state";
export const APP_STATE_BACKUP_STORAGE_KEY = "capma-ops-state-backup";

export function loadPersistedAppState(
  normalizeItem: (item: ActionItem) => ActionItem
): LoadPersistedAppStateResult {
  if (typeof window === "undefined") {
    return {
      state: null,
      source: "none",
      primaryStateStatus: "missing",
      backupStateStatus: "missing",
      shouldPersist: true
    };
  }

  const primaryState = parseStoredAppState(
    window.localStorage.getItem(APP_STATE_STORAGE_KEY),
    normalizeItem
  );

  if (primaryState.status === "valid") {
    return {
      state: primaryState.state,
      source: "primary",
      primaryStateStatus: "valid",
      backupStateStatus: "missing",
      shouldPersist: true
    };
  }

  const backupState = parseStoredAppState(
    window.localStorage.getItem(APP_STATE_BACKUP_STORAGE_KEY),
    normalizeItem
  );

  if (backupState.status === "valid") {
    return {
      state: backupState.state,
      source: "backup",
      primaryStateStatus: primaryState.status,
      backupStateStatus: "valid",
      shouldPersist: true
    };
  }

  const noStoredState = primaryState.status === "missing" && backupState.status === "missing";

  return {
    state: null,
    source: "none",
    primaryStateStatus: primaryState.status,
    backupStateStatus: backupState.status,
    shouldPersist: noStoredState
  };
}

export function savePersistedAppState(state: PersistedAppState) {
  if (typeof window === "undefined") {
    return;
  }

  const serializedState = JSON.stringify(state);

  window.localStorage.setItem(APP_STATE_STORAGE_KEY, serializedState);
  window.localStorage.setItem(APP_STATE_BACKUP_STORAGE_KEY, serializedState);
}

export function clearPersistedAppState() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(APP_STATE_STORAGE_KEY);
  window.localStorage.removeItem(APP_STATE_BACKUP_STORAGE_KEY);
}

export function createAppStateSnapshot(
  items: ActionItem[],
  issueStatuses: Partial<Record<string, IssueStatus>>
): AppStateSnapshot {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    items: items.map((item) => ({ ...item })),
    issueStatuses: { ...issueStatuses }
  };
}

export function parseImportedAppState(
  value: unknown
): (PersistedAppState & { usedLegacyFormat: boolean }) | null {
  if (Array.isArray(value)) {
    const items = value.filter(isActionItemRecord);

    if (items.length !== value.length) {
      return null;
    }

    return {
      items,
      issueStatuses: {},
      usedLegacyFormat: true
    };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const snapshot = value as Partial<AppStateSnapshot>;

  if (!Array.isArray(snapshot.items) || !isIssueStatusMap(snapshot.issueStatuses)) {
    return null;
  }

  const items = snapshot.items.filter(isActionItemRecord);

  if (items.length !== snapshot.items.length) {
    return null;
  }

  return {
    items,
    issueStatuses: snapshot.issueStatuses,
    usedLegacyFormat: false
  };
}

export function migratePersistedItems(
  items: ActionItem[],
  options: {
    legacySampleItemIds: readonly string[];
    getDefaultItems: () => ActionItem[];
    normalizeItem: (item: ActionItem) => ActionItem;
  }
) {
  const legacySampleIds = new Set<string>(options.legacySampleItemIds);

  if (items.length > 0 && items.every((item) => legacySampleIds.has(item.id))) {
    return options.getDefaultItems();
  }

  return items.map((item) => options.normalizeItem(item));
}

function isActionItemRecord(value: unknown): value is ActionItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<ActionItem>;

  return [
    item.id,
    item.title,
    item.type,
    item.workstream,
    item.dueDate,
    item.status,
    item.owner,
    item.waitingOn,
    item.lastUpdated,
    item.notes
  ].every((field) => typeof field === "string") &&
    (item.blocked === undefined || typeof item.blocked === "boolean") &&
    (item.blockedBy === undefined || typeof item.blockedBy === "string") &&
    (item.issue === undefined || typeof item.issue === "string") &&
    (item.eventGroup === undefined || typeof item.eventGroup === "string");
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

function parseStoredAppState(
  rawState: string | null,
  normalizeItem: (item: ActionItem) => ActionItem
): { status: "valid"; state: PersistedAppState } | { status: "invalid" | "missing" } {
  if (!rawState) {
    return { status: "missing" };
  }

  try {
    const parsedState = JSON.parse(rawState) as Partial<PersistedAppState>;

    if (!Array.isArray(parsedState.items) || !isIssueStatusMap(parsedState.issueStatuses)) {
      return { status: "invalid" };
    }

    const items = parsedState.items.filter(isActionItemRecord);

    if (items.length !== parsedState.items.length) {
      return { status: "invalid" };
    }

    return {
      status: "valid",
      state: {
        items: items.map((item) => normalizeItem(item)),
        issueStatuses: parsedState.issueStatuses
      }
    };
  } catch {
    return { status: "invalid" };
  }
}
