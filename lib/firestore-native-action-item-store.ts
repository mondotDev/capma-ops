import {
  collection,
  doc,
  getDocs,
  writeBatch,
  type CollectionReference,
  type Firestore
} from "firebase/firestore";
import { getFirestoreDb, isFirebaseConfigured } from "@/lib/firebase";
import { nativeActionItemMutator } from "@/lib/native-action-item-mutator";
import { normalizeNoteEntries } from "@/lib/ops-utils";
import type { ActionItemMutationContext, NewActionItemInput } from "@/lib/action-item-mutations";
import type { ActionItem, ActionNoteEntry } from "@/lib/sample-data";

const ACTION_ITEMS_COLLECTION = "actionItems";

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

type FirestoreActionItemDocument = {
  title: string;
  type: string;
  workstream: string;
  dueDate: string;
  status: string;
  owner: string;
  waitingOn: string;
  lastUpdated: string;
  archivedAt?: string;
  operationalBucket?: string;
  eventGroup?: string;
  legacyEventGroupMigrated?: boolean;
  eventInstanceId?: string;
  subEventId?: string;
  isBlocked?: boolean;
  blockedBy?: string;
  issue?: string;
  noteEntries?: FirestoreActionNoteEntryDocument[];
};

export function createFirestoreNativeActionItemStore(input?: {
  collectionName?: string;
  getDb?: () => Firestore | null;
  isConfigured?: () => boolean;
}) {
  const collectionName = input?.collectionName ?? ACTION_ITEMS_COLLECTION;
  const getDb = input?.getDb ?? getFirestoreDb;
  const isConfigured = input?.isConfigured ?? isFirebaseConfigured;

  return {
    mode: "firebase" as const,
    async archive(items: ActionItem[], id: string, context?: ActionItemMutationContext) {
      const nextItems = nativeActionItemMutator.archive(items, id, context);
      await persistChangedItems(getCollection(getDb, isConfigured, collectionName), items, nextItems);
      return nextItems;
    },
    async bulkUpdate(
      items: ActionItem[],
      ids: string[],
      updates: Partial<ActionItem>,
      context?: ActionItemMutationContext
    ) {
      const nextItems = nativeActionItemMutator.bulkUpdate(items, ids, updates, context);
      await persistChangedItems(getCollection(getDb, isConfigured, collectionName), items, nextItems);
      return nextItems;
    },
    async create(items: ActionItem[], item: NewActionItemInput, context?: ActionItemMutationContext) {
      const nextItems = nativeActionItemMutator.create(items, item, context);
      await persistChangedItems(getCollection(getDb, isConfigured, collectionName), items, nextItems);
      return nextItems;
    },
    async delete(items: ActionItem[], id: string) {
      const nextItems = nativeActionItemMutator.delete(items, id);
      await persistChangedItems(getCollection(getDb, isConfigured, collectionName), items, nextItems);
      return nextItems;
    },
    async load(_items: ActionItem[], context?: ActionItemMutationContext) {
      const snapshot = await getDocs(getCollection(getDb, isConfigured, collectionName));
      const loadedItems = snapshot.docs.map((entry) => mapFirestoreDocumentToActionItem(entry.id, entry.data()));
      return nativeActionItemMutator.normalizeLoaded(loadedItems, context);
    },
    async replaceAll(items: ActionItem[], context?: ActionItemMutationContext) {
      const normalizedItems = nativeActionItemMutator.normalizeLoaded(items, context);
      await replaceCollection(getCollection(getDb, isConfigured, collectionName), normalizedItems);
      return normalizedItems;
    },
    async restore(items: ActionItem[], id: string, context?: ActionItemMutationContext) {
      const nextItems = nativeActionItemMutator.restore(items, id, context);
      await persistChangedItems(getCollection(getDb, isConfigured, collectionName), items, nextItems);
      return nextItems;
    },
    async update(
      items: ActionItem[],
      id: string,
      updates: Partial<ActionItem>,
      context?: ActionItemMutationContext
    ) {
      const nextItems = nativeActionItemMutator.update(items, id, updates, context);
      await persistChangedItems(getCollection(getDb, isConfigured, collectionName), items, nextItems);
      return nextItems;
    }
  };
}

export function mapActionItemToFirestoreDocument(item: ActionItem): FirestoreActionItemDocument {
  return removeUndefinedFields({
    archivedAt: item.archivedAt,
    blockedBy: item.blockedBy,
    dueDate: item.dueDate,
    eventGroup: item.eventGroup,
    eventInstanceId: item.eventInstanceId,
    isBlocked: item.isBlocked,
    issue: item.issue,
    lastUpdated: item.lastUpdated,
    legacyEventGroupMigrated: item.legacyEventGroupMigrated,
    noteEntries: item.noteEntries.map(mapActionNoteEntryToFirestoreDocument),
    operationalBucket: item.operationalBucket,
    owner: item.owner,
    status: item.status,
    subEventId: item.subEventId,
    title: item.title,
    type: item.type,
    waitingOn: item.waitingOn,
    workstream: item.workstream
  });
}

export function mapFirestoreDocumentToActionItem(id: string, value: unknown): ActionItem {
  const document = parseFirestoreActionItemDocument(value);

  if (!document) {
    throw new Error(`Firestore actionItems/${id} is not a valid CAPMA Ops action item document.`);
  }

  return nativeActionItemMutator.normalizeLoaded([
    {
      archivedAt: document.archivedAt,
      blockedBy: document.blockedBy,
      dueDate: document.dueDate,
      eventGroup: document.eventGroup,
      eventInstanceId: document.eventInstanceId,
      id,
      isBlocked: document.isBlocked,
      issue: document.issue,
      lastUpdated: document.lastUpdated,
      legacyEventGroupMigrated: document.legacyEventGroupMigrated,
      noteEntries: normalizeNoteEntries(
        document.noteEntries?.map(mapFirestoreNoteEntryToActionNoteEntry),
        undefined,
        document.lastUpdated
      ),
      operationalBucket: document.operationalBucket,
      owner: document.owner,
      status: document.status,
      subEventId: document.subEventId,
      title: document.title,
      type: document.type,
      waitingOn: document.waitingOn,
      workstream: document.workstream
    }
  ])[0] as ActionItem;
}

export function parseFirestoreActionItemDocument(value: unknown): FirestoreActionItemDocument | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Partial<FirestoreActionItemDocument>;

  if (
    typeof item.title !== "string" ||
    typeof item.type !== "string" ||
    typeof item.workstream !== "string" ||
    typeof item.dueDate !== "string" ||
    typeof item.status !== "string" ||
    typeof item.owner !== "string" ||
    typeof item.waitingOn !== "string" ||
    typeof item.lastUpdated !== "string"
  ) {
    return null;
  }

  if (
    (item.archivedAt !== undefined && typeof item.archivedAt !== "string") ||
    (item.operationalBucket !== undefined && typeof item.operationalBucket !== "string") ||
    (item.eventGroup !== undefined && typeof item.eventGroup !== "string") ||
    (item.legacyEventGroupMigrated !== undefined && typeof item.legacyEventGroupMigrated !== "boolean") ||
    (item.eventInstanceId !== undefined && typeof item.eventInstanceId !== "string") ||
    (item.subEventId !== undefined && typeof item.subEventId !== "string") ||
    (item.isBlocked !== undefined && typeof item.isBlocked !== "boolean") ||
    (item.blockedBy !== undefined && typeof item.blockedBy !== "string") ||
    (item.issue !== undefined && typeof item.issue !== "string") ||
    (item.noteEntries !== undefined && !isFirestoreActionNoteEntryList(item.noteEntries))
  ) {
    return null;
  }

  return {
    archivedAt: item.archivedAt,
    blockedBy: item.blockedBy,
    dueDate: item.dueDate,
    eventGroup: item.eventGroup,
    eventInstanceId: item.eventInstanceId,
    isBlocked: item.isBlocked,
    issue: item.issue,
    lastUpdated: item.lastUpdated,
    legacyEventGroupMigrated: item.legacyEventGroupMigrated,
    noteEntries: item.noteEntries?.map((entry) => ({ ...entry, author: { ...entry.author } })),
    operationalBucket: item.operationalBucket,
    owner: item.owner,
    status: item.status,
    subEventId: item.subEventId,
    title: item.title,
    type: item.type,
    waitingOn: item.waitingOn,
    workstream: item.workstream
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

function getCollection(
  getDb: () => Firestore | null,
  isConfigured: () => boolean,
  collectionName: string
) {
  if (!isConfigured()) {
    throw new Error("Native action-item store mode is set to firebase, but Firebase is not configured.");
  }

  const firestore = getDb();

  if (!firestore) {
    throw new Error("Native action-item store mode is set to firebase, but Firestore is unavailable.");
  }

  return collection(firestore, collectionName) as CollectionReference<FirestoreActionItemDocument>;
}

async function persistChangedItems(
  collectionRef: CollectionReference<FirestoreActionItemDocument>,
  previousItems: ActionItem[],
  nextItems: ActionItem[]
) {
  if (previousItems === nextItems) {
    return;
  }

  const previousById = new Map(previousItems.map((item) => [item.id, item]));
  const nextById = new Map(nextItems.map((item) => [item.id, item]));
  const batch = writeBatch(collectionRef.firestore);
  let hasWrites = false;

  for (const previousItem of previousItems) {
    if (!nextById.has(previousItem.id)) {
      batch.delete(doc(collectionRef, previousItem.id));
      hasWrites = true;
    }
  }

  for (const nextItem of nextItems) {
    const previousItem = previousById.get(nextItem.id);

    if (previousItem === nextItem) {
      continue;
    }

    batch.set(doc(collectionRef, nextItem.id), mapActionItemToFirestoreDocument(nextItem));
    hasWrites = true;
  }

  if (hasWrites) {
    await batch.commit();
  }
}

async function replaceCollection(
  collectionRef: CollectionReference<FirestoreActionItemDocument>,
  items: ActionItem[]
) {
  const existingSnapshot = await getDocs(collectionRef);
  const nextIds = new Set(items.map((item) => item.id));
  const batch = writeBatch(collectionRef.firestore);

  for (const existingDoc of existingSnapshot.docs) {
    if (!nextIds.has(existingDoc.id)) {
      batch.delete(existingDoc.ref);
    }
  }

  for (const item of items) {
    batch.set(doc(collectionRef, item.id), mapActionItemToFirestoreDocument(item));
  }

  await batch.commit();
}

function removeUndefinedFields<T extends object>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
