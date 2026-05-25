import {
  DEMO_FOUNDATION_DATA,
  type ActionItem,
  type AmcOrganization,
  type ClientAssociation,
  type CollateralItem,
  type CurrentUser,
  type FoundationData,
  type StaffProfile,
  type WorkBucket
} from "@/lib/amc-domain";

export const AMC_LOCAL_STATE_STORAGE_KEY = "amc-ops-hub-v2-state";
export const AMC_LOCAL_STATE_VERSION = 1;

export interface AmcLocalStateSnapshot {
  version: typeof AMC_LOCAL_STATE_VERSION;
  organization: AmcOrganization;
  clients: ClientAssociation[];
  staff: StaffProfile[];
  currentUser: CurrentUser;
  buckets: WorkBucket[];
  actionItems: ActionItem[];
  collateralItems: CollateralItem[];
}

export function createDefaultAmcLocalState(): AmcLocalStateSnapshot {
  return cloneSnapshot({
    version: AMC_LOCAL_STATE_VERSION,
    ...DEMO_FOUNDATION_DATA
  });
}

export function normalizeAmcLocalStateSnapshot(value: unknown): AmcLocalStateSnapshot {
  if (!value || typeof value !== "object") {
    return createDefaultAmcLocalState();
  }

  const candidate = value as Partial<AmcLocalStateSnapshot>;
  const defaults = createDefaultAmcLocalState();

  return {
    version: AMC_LOCAL_STATE_VERSION,
    organization: normalizeOrganization(candidate.organization, defaults.organization),
    clients: normalizeArray(candidate.clients, defaults.clients),
    staff: normalizeArray(candidate.staff, defaults.staff),
    currentUser: normalizeCurrentUser(candidate.currentUser, defaults.currentUser),
    buckets: normalizeArray(candidate.buckets, defaults.buckets),
    actionItems: normalizeArray(candidate.actionItems, defaults.actionItems),
    collateralItems: normalizeArray(candidate.collateralItems, defaults.collateralItems)
  };
}

export function loadAmcLocalState(storage: Pick<Storage, "getItem"> = window.localStorage): AmcLocalStateSnapshot {
  const raw = storage.getItem(AMC_LOCAL_STATE_STORAGE_KEY);

  if (!raw) {
    return createDefaultAmcLocalState();
  }

  try {
    return normalizeAmcLocalStateSnapshot(JSON.parse(raw));
  } catch {
    return createDefaultAmcLocalState();
  }
}

export function saveAmcLocalState(
  snapshot: AmcLocalStateSnapshot,
  storage: Pick<Storage, "setItem"> = window.localStorage
) {
  storage.setItem(AMC_LOCAL_STATE_STORAGE_KEY, JSON.stringify(normalizeAmcLocalStateSnapshot(snapshot)));
}

export function addActionItemToAmcLocalState(
  snapshot: AmcLocalStateSnapshot,
  actionItem: ActionItem
): AmcLocalStateSnapshot {
  return {
    ...snapshot,
    actionItems: [actionItem, ...snapshot.actionItems]
  };
}

function normalizeOrganization(value: unknown, fallback: AmcOrganization): AmcOrganization {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<AmcOrganization>;

  return {
    id: stringOrFallback(candidate.id, fallback.id),
    name: stringOrFallback(candidate.name, fallback.name)
  };
}

function normalizeCurrentUser(value: unknown, fallback: CurrentUser): CurrentUser {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<CurrentUser>;

  return {
    uid: stringOrFallback(candidate.uid, fallback.uid),
    role: candidate.role === "employee" || candidate.role === "admin" ? candidate.role : fallback.role,
    displayName: stringOrFallback(candidate.displayName, fallback.displayName),
    email: stringOrFallback(candidate.email, fallback.email),
    assigneeId: stringOrFallback(candidate.assigneeId, fallback.assigneeId),
    organizationId: stringOrFallback(candidate.organizationId, fallback.organizationId)
  };
}

function normalizeArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? cloneSnapshot(value as T[]) : fallback;
}

function stringOrFallback(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
