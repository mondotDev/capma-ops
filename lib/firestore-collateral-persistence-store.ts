import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore";
import { normalizeCollateralItem, type CollateralItem, type LegDayCollateralProfile } from "@/lib/collateral-data";
import {
  normalizeEventInstance,
  normalizeSubEventScheduleMode,
  type EventInstance,
  type EventSubEvent
} from "@/lib/event-instances";
import { getFirestoreDb, isFirebaseConfigured } from "@/lib/firebase";
import {
  normalizePersistedCollateralState,
  type CollateralPersistenceContext,
  type PersistedCollateralState
} from "@/lib/collateral-persisted-state";
import type { ActionNoteEntry } from "@/lib/sample-data";
import {
  normalizeSponsorCommitment,
  normalizeSponsorOpportunity,
  type SponsorCommitment,
  type SponsorOpportunity,
  type SponsorshipSetupByInstance
} from "@/lib/sponsor-fulfillment";

export const COLLATERAL_STATE_COLLECTION = "appStateSlices";
export const COLLATERAL_STATE_DOCUMENT = "collateralState";

type FirestoreActionNoteEntryDocument = {
  id: string;
  text: string;
  createdAt: string;
  author: {
    userId: string | null;
    initials: string;
    displayName?: string | null;
  };
};

type FirestoreCollateralItemDocument = {
  id: string;
  eventInstanceId: string;
  subEventId: string;
  templateOriginId?: string;
  itemName: string;
  status: string;
  owner: string;
  blockedBy: string;
  dueDate: string;
  printer: string;
  quantity: string;
  updateType: string;
  noteEntries?: FirestoreActionNoteEntryDocument[];
  fileLink?: string;
  lastUpdated: string;
  archivedAt?: string;
};

type FirestoreEventInstanceDocument = EventInstance;

type FirestoreEventSubEventDocument = {
  id: string;
  eventInstanceId: string;
  name: string;
  sortOrder: number;
  scheduleMode?: EventSubEvent["scheduleMode"];
  date?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
};

type FirestoreLegDayCollateralProfileDocument = LegDayCollateralProfile;

type FirestoreSponsorOpportunityDocument = SponsorOpportunity;
type FirestoreSponsorCommitmentDocument = SponsorCommitment;
type FirestoreSponsorshipSetupDocument = {
  opportunities: FirestoreSponsorOpportunityDocument[];
  commitments: FirestoreSponsorCommitmentDocument[];
};

type FirestoreCollateralStateDocument = {
  collateralItems: FirestoreCollateralItemDocument[];
  collateralProfiles: Record<string, FirestoreLegDayCollateralProfileDocument>;
  sponsorshipSetupByInstance?: Record<string, FirestoreSponsorshipSetupDocument>;
  sponsorPlacementsByInstance?: Record<string, FirestoreSponsorCommitmentDocument[]>;
  eventInstances: FirestoreEventInstanceDocument[];
  eventSubEvents: FirestoreEventSubEventDocument[];
  updatedAt?: string;
  schemaVersion?: number | string;
};

export function createFirestoreCollateralPersistenceStore(input?: {
  collectionName?: string;
  documentName?: string;
  getDb?: () => Firestore | null;
  isConfigured?: () => boolean;
  getDocument?: (firestore: Firestore, collectionName: string, documentName: string) => Promise<unknown | null>;
  setDocument?: (
    firestore: Firestore,
    collectionName: string,
    documentName: string,
    value: FirestoreCollateralStateDocument
  ) => Promise<void>;
}) {
  const collectionName = input?.collectionName ?? COLLATERAL_STATE_COLLECTION;
  const documentName = input?.documentName ?? COLLATERAL_STATE_DOCUMENT;
  const getDb = input?.getDb ?? getFirestoreDb;
  const isConfigured = input?.isConfigured ?? isFirebaseConfigured;
  const getDocument =
    input?.getDocument ??
    (async (firestore: Firestore, nextCollectionName: string, nextDocumentName: string) => {
      const snapshot = await getDoc(doc(firestore, nextCollectionName, nextDocumentName));
      return snapshot.exists() ? snapshot.data() : null;
    });
  const setDocument =
    input?.setDocument ??
    ((firestore: Firestore, nextCollectionName: string, nextDocumentName: string, value: FirestoreCollateralStateDocument) =>
      setDoc(doc(firestore, nextCollectionName, nextDocumentName), value));

  return {
    mode: "firebase" as const,
    async load(_state: PersistedCollateralState, context: CollateralPersistenceContext) {
      const firestore = getConfiguredDb(getDb, isConfigured);
      const rawDocument = await getDocument(firestore, collectionName, documentName);

      if (!rawDocument) {
        throw new Error(
          "Collateral persistence mode is set to Firestore, but persisted collateral state has not been bootstrapped."
        );
      }

      const parsedDocument = parseFirestoreCollateralStateDocument(rawDocument);

      if (!parsedDocument) {
        throw new Error("Firestore collateral state is not a valid CAPMA Ops collateral persistence document.");
      }

      return normalizePersistedCollateralState(mapPersistedCollateralStateDocument(parsedDocument), context);
    },
    async replaceAll(state: PersistedCollateralState, context: CollateralPersistenceContext) {
      const normalizedState = normalizePersistedCollateralState(state, context);
      await setDocument(
        getConfiguredDb(getDb, isConfigured),
        collectionName,
        documentName,
        mapPersistedCollateralStateToFirestoreDocument(normalizedState)
      );
      return normalizedState;
    }
  };
}

export async function loadExistingFirestoreCollateralStateDocument(input?: {
  collectionName?: string;
  documentName?: string;
  getDb?: () => Firestore | null;
  isConfigured?: () => boolean;
}) {
  const collectionName = input?.collectionName ?? COLLATERAL_STATE_COLLECTION;
  const documentName = input?.documentName ?? COLLATERAL_STATE_DOCUMENT;
  const getDb = input?.getDb ?? getFirestoreDb;
  const isConfigured = input?.isConfigured ?? isFirebaseConfigured;
  const firestore = getConfiguredDb(getDb, isConfigured);
  const snapshot = await getDoc(doc(firestore, collectionName, documentName));
  return snapshot.exists() ? snapshot.data() : null;
}

export function mapPersistedCollateralStateToFirestoreDocument(
  state: PersistedCollateralState
): FirestoreCollateralStateDocument {
  return {
    collateralItems: state.collateralItems.map(mapCollateralItemToFirestoreDocument),
    collateralProfiles: Object.fromEntries(
      Object.entries(state.collateralProfiles).map(([instanceId, profile]) => [instanceId, { ...profile }])
    ),
    sponsorshipSetupByInstance: Object.fromEntries(
      Object.entries(state.sponsorshipSetupByInstance ?? {}).map(([instanceId, setup]) => [
        instanceId,
        {
          opportunities: setup.opportunities.map((opportunity) => ({ ...opportunity })),
          commitments: setup.commitments.map((commitment) => ({ ...commitment }))
        }
      ])
    ),
    eventInstances: state.eventInstances.map((instance) => ({ ...instance })),
    eventSubEvents: state.eventSubEvents.map((subEvent) => ({ ...subEvent })),
    schemaVersion: 1,
    updatedAt: new Date().toISOString()
  };
}

export function parseFirestoreCollateralStateDocument(value: unknown): FirestoreCollateralStateDocument | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const document = value as Partial<FirestoreCollateralStateDocument>;

  if (
    !Array.isArray(document.collateralItems) ||
    !document.collateralItems.every((item) => parseFirestoreCollateralItemDocument(item) !== null) ||
    !Array.isArray(document.eventInstances) ||
    !document.eventInstances.every((instance) => normalizeEventInstance(instance) !== null) ||
    !Array.isArray(document.eventSubEvents) ||
    !document.eventSubEvents.every(isFirestoreEventSubEventDocument) ||
    !isCollateralProfileMap(document.collateralProfiles) ||
    !isSponsorshipSetupMap(
      document.sponsorshipSetupByInstance ?? {},
      document.eventInstances,
      document.eventSubEvents
    )
  ) {
    return null;
  }

  if (
    (document.updatedAt !== undefined && typeof document.updatedAt !== "string") ||
    (document.schemaVersion !== undefined &&
      typeof document.schemaVersion !== "number" &&
      typeof document.schemaVersion !== "string")
  ) {
    return null;
  }

  return {
    collateralItems: document.collateralItems.map((item) => parseFirestoreCollateralItemDocument(item) as FirestoreCollateralItemDocument),
    collateralProfiles: Object.fromEntries(
      Object.entries(document.collateralProfiles).map(([instanceId, profile]) => [instanceId, { ...profile }])
    ),
    sponsorshipSetupByInstance: Object.fromEntries(
      Object.entries(document.sponsorshipSetupByInstance ?? {}).map(([instanceId, setup]) => [
        instanceId,
        {
          opportunities: setup.opportunities.map((opportunity) => ({ ...opportunity })),
          commitments: setup.commitments.map((commitment) => ({ ...commitment }))
        }
      ])
    ),
    sponsorPlacementsByInstance: document.sponsorPlacementsByInstance,
    eventInstances: document.eventInstances.map((instance) => ({ ...instance })),
    eventSubEvents: document.eventSubEvents.map((subEvent) => ({ ...subEvent })),
    schemaVersion: document.schemaVersion,
    updatedAt: document.updatedAt
  };
}

function mapPersistedCollateralStateDocument(
  document: FirestoreCollateralStateDocument
): PersistedCollateralState {
  return {
    collateralItems: document.collateralItems.map(mapFirestoreDocumentToCollateralItem),
    collateralProfiles: Object.fromEntries(
      Object.entries(document.collateralProfiles).map(([instanceId, profile]) => [instanceId, { ...profile }])
    ),
    sponsorshipSetupByInstance: Object.fromEntries(
      Object.entries(document.sponsorshipSetupByInstance ?? {}).map(([instanceId, setup]) => [
        instanceId,
        {
          opportunities: setup.opportunities.map((opportunity) => ({ ...opportunity })),
          commitments: setup.commitments.map((commitment) => ({ ...commitment }))
        }
      ])
    ),
    sponsorPlacementsByInstance: document.sponsorPlacementsByInstance,
    eventInstances: document.eventInstances.map((instance) => ({ ...instance })),
    eventSubEvents: document.eventSubEvents.map((subEvent) => ({ ...subEvent }))
  };
}

function mapCollateralItemToFirestoreDocument(item: CollateralItem): FirestoreCollateralItemDocument {
  return removeUndefinedFields({
    archivedAt: item.archivedAt,
    blockedBy: item.blockedBy,
    dueDate: item.dueDate,
    eventInstanceId: item.eventInstanceId,
    fileLink: item.fileLink,
    id: item.id,
    itemName: item.itemName,
    lastUpdated: item.lastUpdated,
    noteEntries: item.noteEntries.map(mapActionNoteEntryToFirestoreDocument),
    owner: item.owner,
    printer: item.printer,
    quantity: item.quantity,
    status: item.status,
    subEventId: item.subEventId,
    templateOriginId: item.templateOriginId,
    updateType: item.updateType
  });
}

function mapFirestoreDocumentToCollateralItem(document: FirestoreCollateralItemDocument): CollateralItem {
  const normalized = normalizeCollateralItem({
    archivedAt: document.archivedAt,
    blockedBy: document.blockedBy,
    dueDate: document.dueDate,
    eventInstanceId: document.eventInstanceId,
    fileLink: document.fileLink,
    id: document.id,
    itemName: document.itemName,
    lastUpdated: document.lastUpdated,
    noteEntries: document.noteEntries?.map(mapFirestoreNoteEntryToActionNoteEntry) ?? [],
    owner: document.owner,
    printer: document.printer,
    quantity: document.quantity,
    status: document.status as CollateralItem["status"],
    subEventId: document.subEventId,
    templateOriginId: document.templateOriginId,
    updateType: document.updateType
  });

  if (!normalized) {
    throw new Error(`Firestore collateral item ${document.id} is not a valid CAPMA Ops collateral record.`);
  }

  return normalized;
}

function parseFirestoreCollateralItemDocument(value: unknown): FirestoreCollateralItemDocument | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<FirestoreCollateralItemDocument>;

  if (
    typeof item.id !== "string" ||
    typeof item.eventInstanceId !== "string" ||
    typeof item.subEventId !== "string" ||
    typeof item.itemName !== "string" ||
    typeof item.status !== "string" ||
    typeof item.owner !== "string" ||
    typeof item.blockedBy !== "string" ||
    typeof item.dueDate !== "string" ||
    typeof item.printer !== "string" ||
    typeof item.quantity !== "string" ||
    typeof item.updateType !== "string" ||
    typeof item.lastUpdated !== "string"
  ) {
    return null;
  }

  if (
    (item.archivedAt !== undefined && typeof item.archivedAt !== "string") ||
    (item.templateOriginId !== undefined && typeof item.templateOriginId !== "string") ||
    (item.fileLink !== undefined && typeof item.fileLink !== "string") ||
    (item.noteEntries !== undefined && !isFirestoreActionNoteEntryList(item.noteEntries))
  ) {
    return null;
  }

  return {
    archivedAt: item.archivedAt,
    blockedBy: item.blockedBy,
    dueDate: item.dueDate,
    eventInstanceId: item.eventInstanceId,
    fileLink: item.fileLink,
    id: item.id,
    itemName: item.itemName,
    lastUpdated: item.lastUpdated,
    noteEntries: item.noteEntries?.map((entry) => ({ ...entry, author: { ...entry.author } })),
    owner: item.owner,
    printer: item.printer,
    quantity: item.quantity,
    status: item.status,
    subEventId: item.subEventId,
    templateOriginId: item.templateOriginId,
    updateType: item.updateType
  };
}

function mapActionNoteEntryToFirestoreDocument(entry: ActionNoteEntry): FirestoreActionNoteEntryDocument {
  return {
    author: {
      displayName: entry.author.displayName ?? null,
      initials: entry.author.initials,
      userId: entry.author.userId ?? null
    },
    createdAt: entry.createdAt,
    id: entry.id,
    text: entry.text
  };
}

function mapFirestoreNoteEntryToActionNoteEntry(entry: FirestoreActionNoteEntryDocument): ActionNoteEntry {
  return {
    author: {
      displayName: entry.author.displayName ?? null,
      initials: entry.author.initials,
      userId: entry.author.userId ?? null
    },
    createdAt: entry.createdAt,
    id: entry.id,
    text: entry.text
  };
}

function isFirestoreActionNoteEntryList(value: unknown): value is FirestoreActionNoteEntryDocument[] {
  return Array.isArray(value) && value.every(isFirestoreActionNoteEntryDocument);
}

function isFirestoreActionNoteEntryDocument(value: unknown): value is FirestoreActionNoteEntryDocument {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<FirestoreActionNoteEntryDocument>;

  return (
    typeof entry.id === "string" &&
    typeof entry.text === "string" &&
    typeof entry.createdAt === "string" &&
    entry.author !== undefined &&
    typeof entry.author === "object" &&
    entry.author !== null &&
    typeof entry.author.initials === "string" &&
    (entry.author.userId === null || entry.author.userId === undefined || typeof entry.author.userId === "string") &&
    (entry.author.displayName === null ||
      entry.author.displayName === undefined ||
      typeof entry.author.displayName === "string")
  );
}

function isFirestoreEventSubEventDocument(value: unknown): value is FirestoreEventSubEventDocument {
  if (!value || typeof value !== "object") {
    return false;
  }

  const subEvent = value as Partial<FirestoreEventSubEventDocument>;

  return (
    typeof subEvent.id === "string" &&
    typeof subEvent.eventInstanceId === "string" &&
    typeof subEvent.name === "string" &&
    typeof subEvent.sortOrder === "number" &&
    (subEvent.scheduleMode === undefined || normalizeSubEventScheduleMode(subEvent.scheduleMode, subEvent.name) !== null) &&
    (subEvent.date === undefined || typeof subEvent.date === "string") &&
    (subEvent.endDate === undefined || typeof subEvent.endDate === "string") &&
    (subEvent.startTime === undefined || typeof subEvent.startTime === "string") &&
    (subEvent.endTime === undefined || typeof subEvent.endTime === "string")
  );
}

function isCollateralProfileMap(value: unknown): value is Record<string, FirestoreLegDayCollateralProfileDocument> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(isLegDayCollateralProfileDocument);
}

function isSponsorshipSetupMap(
  value: unknown,
  eventInstances: FirestoreEventInstanceDocument[],
  eventSubEvents: FirestoreEventSubEventDocument[]
): value is Record<string, FirestoreSponsorshipSetupDocument> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.entries(value).every(([instanceId, setup]) => {
    if (
      !eventInstances.some((instance) => instance.id === instanceId) ||
      !setup ||
      typeof setup !== "object" ||
      !Array.isArray((setup as FirestoreSponsorshipSetupDocument).opportunities) ||
      !Array.isArray((setup as FirestoreSponsorshipSetupDocument).commitments)
    ) {
      return false;
    }

    const sponsorshipSetup = setup as FirestoreSponsorshipSetupDocument;
    const opportunities = sponsorshipSetup.opportunities
      .map((opportunity) =>
        normalizeSponsorOpportunity(opportunity as Partial<SponsorOpportunity>, {
          eventInstances,
          eventSubEvents
        })
      )
      .filter((opportunity): opportunity is SponsorOpportunity => opportunity !== null);

    return (
      opportunities.length === sponsorshipSetup.opportunities.length &&
      sponsorshipSetup.commitments.every((commitment) =>
        normalizeSponsorCommitment(commitment as Partial<SponsorCommitment>, {
          eventInstances,
          eventSubEvents,
          opportunities
        }) !== null
      )
    );
  });
}

function isLegDayCollateralProfileDocument(value: unknown): value is FirestoreLegDayCollateralProfileDocument {
  if (!value || typeof value !== "object") {
    return false;
  }

  const profile = value as Partial<FirestoreLegDayCollateralProfileDocument>;

  return (
    typeof profile.eventStartDate === "string" &&
    typeof profile.eventEndDate === "string" &&
    typeof profile.roomBlockDeadline === "string" &&
    typeof profile.roomBlockNote === "string" &&
    typeof profile.logoDeadline === "string" &&
    typeof profile.logoDeadlineNote === "string" &&
    typeof profile.externalPrintingDue === "string" &&
    typeof profile.internalPrintingStart === "string"
  );
}

function getConfiguredDb(getDb: () => Firestore | null, isConfigured: () => boolean) {
  if (!isConfigured()) {
    throw new Error("Collateral persistence mode is set to Firestore, but Firebase is not configured.");
  }

  const firestore = getDb();

  if (!firestore) {
    throw new Error("Collateral persistence mode is set to Firestore, but Firestore is unavailable.");
  }

  return firestore;
}

function removeUndefinedFields<T extends object>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
