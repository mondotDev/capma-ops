import {
  DEMO_FOUNDATION_DATA,
  createDefaultBucketsForClient,
  ensureProgramSeriesForBuckets,
  ensureDefaultBucketsForClients,
  normalizeWorkBucketsForProgramSeries,
  updateCollateralItem,
  updateSponsorFulfillmentRecord,
  type ActionItem,
  type AmcOrganization,
  type ClientAssociation,
  type CollateralItem,
  type CollateralItemUpdateInput,
  type CurrentUser,
  type EducationApplication,
  type FoundationData,
  type ProgramSeries,
  type SpeakerEngagement,
  type SponsorFulfillmentRecord,
  type SponsorFulfillmentUpdateInput,
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
  programSeries: ProgramSeries[];
  buckets: WorkBucket[];
  actionItems: ActionItem[];
  collateralItems: CollateralItem[];
  educationApplications: EducationApplication[];
  speakerEngagements: SpeakerEngagement[];
  sponsorFulfillmentRecords: SponsorFulfillmentRecord[];
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
  const organization = normalizeOrganization(candidate.organization, defaults.organization);
  const clients = normalizeArray(candidate.clients, defaults.clients);
  const rawBuckets = ensureDefaultBucketsForClients(clients, normalizeArray(candidate.buckets, defaults.buckets), organization.id);
  const programSeries = ensureProgramSeriesForBuckets(
    normalizeArray(candidate.programSeries, defaults.programSeries),
    rawBuckets
  );
  const buckets = normalizeWorkBucketsForProgramSeries(rawBuckets, programSeries);

  return {
    version: AMC_LOCAL_STATE_VERSION,
    organization,
    clients,
    staff: normalizeArray(candidate.staff, defaults.staff),
    currentUser: normalizeCurrentUser(candidate.currentUser, defaults.currentUser),
    programSeries,
    buckets,
    actionItems: normalizeArray(candidate.actionItems, defaults.actionItems),
    collateralItems: normalizeArray(candidate.collateralItems, defaults.collateralItems),
    educationApplications: normalizeArray(candidate.educationApplications, defaults.educationApplications),
    speakerEngagements: normalizeArray(candidate.speakerEngagements, defaults.speakerEngagements),
    sponsorFulfillmentRecords: normalizeArray(candidate.sponsorFulfillmentRecords, defaults.sponsorFulfillmentRecords)
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

export function addCollateralItemToAmcLocalState(
  snapshot: AmcLocalStateSnapshot,
  collateralItem: CollateralItem
): AmcLocalStateSnapshot {
  return {
    ...snapshot,
    collateralItems: [collateralItem, ...snapshot.collateralItems]
  };
}

export function updateCollateralItemInAmcLocalState(
  snapshot: AmcLocalStateSnapshot,
  collateralItemId: string,
  updates: CollateralItemUpdateInput
): AmcLocalStateSnapshot {
  return {
    ...snapshot,
    collateralItems: snapshot.collateralItems.map((item) =>
      item.id === collateralItemId ? updateCollateralItem(item, updates) : item
    )
  };
}

export function addCollateralActionItemToAmcLocalState(input: {
  snapshot: AmcLocalStateSnapshot;
  collateralItemId: string;
  actionItem: ActionItem;
}): AmcLocalStateSnapshot {
  return {
    ...input.snapshot,
    actionItems: [input.actionItem, ...input.snapshot.actionItems],
    collateralItems: input.snapshot.collateralItems.map((item) =>
      item.id === input.collateralItemId && !item.relatedActionItemIds.includes(input.actionItem.id)
        ? { ...item, relatedActionItemIds: [...item.relatedActionItemIds, input.actionItem.id] }
        : item
    )
  };
}

export function addSponsorFulfillmentRecordToAmcLocalState(
  snapshot: AmcLocalStateSnapshot,
  sponsorFulfillment: SponsorFulfillmentRecord
): AmcLocalStateSnapshot {
  return {
    ...snapshot,
    sponsorFulfillmentRecords: [sponsorFulfillment, ...snapshot.sponsorFulfillmentRecords]
  };
}

export function updateSponsorFulfillmentRecordInAmcLocalState(
  snapshot: AmcLocalStateSnapshot,
  sponsorFulfillmentId: string,
  updates: SponsorFulfillmentUpdateInput
): AmcLocalStateSnapshot {
  return {
    ...snapshot,
    sponsorFulfillmentRecords: snapshot.sponsorFulfillmentRecords.map((item) =>
      item.id === sponsorFulfillmentId ? updateSponsorFulfillmentRecord(item, updates) : item
    )
  };
}

export function addSponsorFulfillmentActionItemToAmcLocalState(input: {
  snapshot: AmcLocalStateSnapshot;
  sponsorFulfillmentId: string;
  actionItem: ActionItem;
}): AmcLocalStateSnapshot {
  return {
    ...input.snapshot,
    actionItems: [input.actionItem, ...input.snapshot.actionItems],
    sponsorFulfillmentRecords: input.snapshot.sponsorFulfillmentRecords.map((item) =>
      item.id === input.sponsorFulfillmentId && !item.relatedActionItemIds.includes(input.actionItem.id)
        ? { ...item, relatedActionItemIds: [...item.relatedActionItemIds, input.actionItem.id] }
        : item
    )
  };
}

export function addSponsorFulfillmentCollateralItemToAmcLocalState(input: {
  snapshot: AmcLocalStateSnapshot;
  sponsorFulfillmentId: string;
  collateralItem: CollateralItem;
}): AmcLocalStateSnapshot {
  return {
    ...input.snapshot,
    collateralItems: [input.collateralItem, ...input.snapshot.collateralItems],
    sponsorFulfillmentRecords: input.snapshot.sponsorFulfillmentRecords.map((item) =>
      item.id === input.sponsorFulfillmentId && !item.relatedCollateralIds.includes(input.collateralItem.id)
        ? { ...item, relatedCollateralIds: [...item.relatedCollateralIds, input.collateralItem.id] }
        : item
    )
  };
}

export function addClientAssociationToAmcLocalState(
  snapshot: AmcLocalStateSnapshot,
  client: ClientAssociation
): AmcLocalStateSnapshot {
  const defaultBuckets = createDefaultBucketsForClient({
    clientAssociationId: client.id,
    organizationId: snapshot.organization.id,
    existingBuckets: snapshot.buckets
  });
  const programSeries = ensureProgramSeriesForBuckets(snapshot.programSeries, defaultBuckets);

  return {
    ...snapshot,
    clients: [...snapshot.clients, client],
    programSeries,
    buckets: normalizeWorkBucketsForProgramSeries([...snapshot.buckets, ...defaultBuckets], programSeries)
  };
}

export function addProgramSeriesToAmcLocalState(
  snapshot: AmcLocalStateSnapshot,
  programSeries: ProgramSeries
): AmcLocalStateSnapshot {
  return {
    ...snapshot,
    programSeries: [...snapshot.programSeries, programSeries]
  };
}

export function addWorkBucketToAmcLocalState(
  snapshot: AmcLocalStateSnapshot,
  bucket: WorkBucket
): AmcLocalStateSnapshot {
  const programSeries = ensureProgramSeriesForBuckets(snapshot.programSeries, [bucket]);

  return {
    ...snapshot,
    programSeries,
    buckets: normalizeWorkBucketsForProgramSeries([...snapshot.buckets, bucket], programSeries)
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
