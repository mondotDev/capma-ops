import {
  normalizeCollateralItem,
  normalizeCollateralUpdateType,
  normalizeCollateralWorkflowStatus,
  type CollateralItem,
  type LegDayCollateralProfile
} from "@/lib/collateral-data";
import type { CollateralTemplateItem, CollateralTemplateSubEvent } from "@/lib/collateral-templates";
import { traceCollateralCreate } from "@/lib/collateral-create-trace";
import { getUnassignedSubEventId, type EventInstance, type EventSubEvent } from "@/lib/event-instances";
import { DEFAULT_OWNER, normalizeNoteEntries } from "@/lib/ops-utils";

export type NewCollateralItemInput = Omit<CollateralItem, "archivedAt" | "id" | "lastUpdated">;

export type CollateralMutationContext = {
  defaultOwner?: string;
  eventInstances?: EventInstance[];
  eventSubEvents?: EventSubEvent[];
};

export type ApplyCollateralTemplateResult = {
  items: CollateralItem[];
  subEventAdditions: EventSubEvent[];
};

export function createCollateralItem(
  input: NewCollateralItemInput,
  context?: CollateralMutationContext
): CollateralItem {
  const eventInstanceId = resolveEventInstanceId(input.eventInstanceId, context?.eventInstances);
  const nextTimestamp = getCurrentDateKey();
  const normalized = reconcileCollateralFields(
    {
      ...input,
      id: `collateral-${crypto.randomUUID()}`,
      eventInstanceId,
      subEventId: normalizeSubEventId(input.subEventId, eventInstanceId, context?.eventSubEvents),
      notes: input.notes ?? "",
      requiresLogo: input.requiresLogo === true,
      requiresCopy: input.requiresCopy === true,
      requiresApproval: input.requiresApproval === true,
      owner: normalizeOwner(input.owner, context),
      updateType: normalizeCollateralUpdateType(input.updateType),
      noteEntries: normalizeNoteEntries(input.noteEntries, "", nextTimestamp),
      lastUpdated: nextTimestamp
    },
    context
  );

  traceCollateralCreate("seam-create", {
    input: {
      eventInstanceId: input.eventInstanceId,
      subEventId: input.subEventId,
      status: input.status
    },
    normalized: {
      id: normalized.id,
      eventInstanceId: normalized.eventInstanceId,
      subEventId: normalized.subEventId,
      status: normalized.status,
      archivedAt: normalized.archivedAt
    }
  });

  return normalized;
}

export function applyCollateralItemUpdates(
  item: CollateralItem,
  updates: Partial<CollateralItem>,
  context?: CollateralMutationContext
): CollateralItem {
  const nextTimestamp = hasOwnField(updates, "lastUpdated")
    ? updates.lastUpdated ?? item.lastUpdated
    : getCurrentDateKey();
  const nextEventInstanceId = hasOwnField(updates, "eventInstanceId")
    ? resolveEventInstanceId(updates.eventInstanceId, context?.eventInstances)
    : item.eventInstanceId;
  const nextStatus = (hasOwnField(updates, "status") ? updates.status : item.status) ?? item.status;
  const normalizedArchivedAt = hasOwnField(updates, "archivedAt")
    ? updates.archivedAt
    : isArchivedStatus(nextStatus)
      ? nextTimestamp
      : undefined;
  const normalized = reconcileCollateralFields(
    {
      ...item,
      ...updates,
      archivedAt: normalizedArchivedAt,
      eventInstanceId: nextEventInstanceId,
      subEventId: normalizeSubEventId(
        hasOwnField(updates, "subEventId") ? updates.subEventId : item.subEventId,
        nextEventInstanceId,
        context?.eventSubEvents
      )
    },
    context
  );

  if (serializeCollateralItem(item) === serializeCollateralItem(normalized)) {
    return item;
  }

  return {
    ...normalized,
    lastUpdated: nextTimestamp
  };
}

export function updateCollateralItemById(
  items: CollateralItem[],
  id: string,
  updates: Partial<CollateralItem>,
  context?: CollateralMutationContext
) {
  return items.map((item) => (item.id === id ? applyCollateralItemUpdates(item, updates, context) : item));
}

export function deleteCollateralItemById(items: CollateralItem[], id: string) {
  return items.filter((item) => item.id !== id);
}

export function markCollateralItemComplete(
  items: CollateralItem[],
  id: string,
  context?: CollateralMutationContext
) {
  return updateCollateralItemById(items, id, { status: "Complete" }, context);
}

export function markCollateralItemCut(items: CollateralItem[], id: string, context?: CollateralMutationContext) {
  return updateCollateralItemById(items, id, { status: "Cut" }, context);
}

export function restoreCollateralItem(
  items: CollateralItem[],
  id: string,
  restoredStatus: Exclude<CollateralItem["status"], "Complete" | "Cut"> = "Backlog",
  context?: CollateralMutationContext
) {
  return updateCollateralItemById(items, id, { status: restoredStatus }, context);
}

export function normalizeCollateralItems(
  items: CollateralItem[],
  context?: CollateralMutationContext
) {
  const validInstanceIds = new Set((context?.eventInstances ?? []).map((instance) => instance.id));

  return items.reduce<CollateralItem[]>((accumulator, rawItem) => {
    const normalizedRecord = normalizeCollateralItem(rawItem);

    if (!normalizedRecord) {
      return accumulator;
    }

    if (validInstanceIds.size > 0 && !validInstanceIds.has(normalizedRecord.eventInstanceId)) {
      return accumulator;
    }

    const normalizedItem = reconcileCollateralFields(normalizedRecord, context);
    accumulator.push(normalizedItem);
    return accumulator;
  }, []);
}

export function applyCollateralTemplate(input: {
  currentItems: CollateralItem[];
  currentSubEvents: EventSubEvent[];
  defaultOwner: string;
  eventInstanceId: string;
  templateItems: CollateralTemplateItem[];
  templateSubEvents: CollateralTemplateSubEvent[];
}) {
  const existingItemOrigins = new Set(
    input.currentItems
      .filter((item) => item.eventInstanceId === input.eventInstanceId && item.templateOriginId)
      .map((item) => item.templateOriginId as string)
  );
  const existingByName = new Map(
    input.currentSubEvents
      .filter((subEvent) => subEvent.eventInstanceId === input.eventInstanceId)
      .map((subEvent) => [subEvent.name, subEvent.id])
  );
  const nextSubEventIdsByTemplateId = new Map<string, string>();
  const subEventAdditions = input.templateSubEvents
    .filter((templateSubEvent) => !existingByName.has(templateSubEvent.name))
    .map((templateSubEvent) => {
      const nextId = `${input.eventInstanceId}-${slugify(templateSubEvent.name)}`;
      nextSubEventIdsByTemplateId.set(templateSubEvent.id, nextId);
      return {
        id: nextId,
        eventInstanceId: input.eventInstanceId,
        name: templateSubEvent.name,
        sortOrder: templateSubEvent.sortOrder
      } satisfies EventSubEvent;
    });

  for (const templateSubEvent of input.templateSubEvents) {
    const existingId = existingByName.get(templateSubEvent.name);
    if (existingId) {
      nextSubEventIdsByTemplateId.set(templateSubEvent.id, existingId);
    }
  }

  const additions = input.templateItems
    .filter((templateItem) => !existingItemOrigins.has(templateItem.id))
    .map((templateItem) =>
      createCollateralItem(
        {
          eventInstanceId: input.eventInstanceId,
          subEventId:
            nextSubEventIdsByTemplateId.get(templateItem.templateSubEventId) ??
            getUnassignedSubEventId(input.eventInstanceId),
          templateOriginId: templateItem.id,
          itemName: templateItem.name,
          status: templateItem.defaultStatus as CollateralItem["status"],
          owner: input.defaultOwner,
          blockedBy: "",
          dueDate: "",
          printer: templateItem.defaultPrinter,
          quantity: templateItem.defaultQuantity,
          updateType: templateItem.defaultUpdateType,
          noteEntries: normalizeNoteEntries(undefined, templateItem.defaultNotes, new Date().toISOString()),
          notes: "",
          requiresLogo: false,
          requiresCopy: false,
          requiresApproval: false,
          fileLink: undefined
        },
        {
          defaultOwner: input.defaultOwner,
          eventSubEvents: [...input.currentSubEvents, ...subEventAdditions]
        }
      )
    )
    .map((item) => ({
      ...item,
      id: getTemplateAppliedCollateralItemId(input.eventInstanceId, item.templateOriginId ?? item.id)
    }));

  return {
    items: [...additions, ...input.currentItems],
    subEventAdditions
  } satisfies ApplyCollateralTemplateResult;
}

export function updateCollateralProfile(
  currentProfiles: Record<string, LegDayCollateralProfile>,
  instanceId: string,
  profile: LegDayCollateralProfile
) {
  return {
    ...currentProfiles,
    [instanceId]: profile
  };
}

function reconcileCollateralFields(item: CollateralItem, context?: CollateralMutationContext): CollateralItem {
  const eventInstanceId = resolveEventInstanceId(item.eventInstanceId, context?.eventInstances);
  const normalizedStatus = item.status;
  const isArchived = isArchivedStatus(normalizedStatus);
  const fallbackArchivedAt =
    isArchived
      ? normalizeDateString(item.archivedAt) ?? normalizeDateString(item.lastUpdated) ?? getCurrentDateKey()
      : undefined;

  return {
    ...item,
    eventInstanceId,
    subEventId: normalizeSubEventId(item.subEventId, eventInstanceId, context?.eventSubEvents),
    owner: normalizeOwner(item.owner, context),
    updateType: normalizeCollateralUpdateType(item.updateType),
    notes: item.notes ?? "",
    requiresLogo: item.requiresLogo === true,
    requiresCopy: item.requiresCopy === true,
    requiresApproval: item.requiresApproval === true,
    noteEntries: normalizeNoteEntries(item.noteEntries, "", item.lastUpdated),
    archivedAt: fallbackArchivedAt
  };
}

function isArchivedStatus(status: CollateralItem["status"]) {
  const normalized = normalizeCollateralWorkflowStatus(status);
  return normalized === "complete" || normalized === "cut";
}

function normalizeOwner(owner: string | undefined, context?: CollateralMutationContext) {
  const trimmedOwner = owner?.trim() ?? "";
  return trimmedOwner.length > 0 ? trimmedOwner : context?.defaultOwner ?? DEFAULT_OWNER;
}

function resolveEventInstanceId(
  eventInstanceId: string | undefined,
  eventInstances?: EventInstance[]
) {
  const trimmed = eventInstanceId?.trim() ?? "";

  if (!trimmed) {
    return eventInstances?.[0]?.id ?? "";
  }

  if (!eventInstances || eventInstances.length === 0) {
    return trimmed;
  }

  return eventInstances.some((instance) => instance.id === trimmed) ? trimmed : trimmed;
}

function normalizeSubEventId(
  subEventId: string | undefined,
  eventInstanceId: string,
  eventSubEvents?: EventSubEvent[]
) {
  const trimmed = subEventId?.trim() ?? "";

  if (!eventSubEvents || eventSubEvents.length === 0) {
    return trimmed || getUnassignedSubEventId(eventInstanceId);
  }

  const matchingSubEvent = eventSubEvents.find(
    (subEvent) => subEvent.id === trimmed && subEvent.eventInstanceId === eventInstanceId
  );

  return matchingSubEvent?.id ?? getUnassignedSubEventId(eventInstanceId);
}

function getTemplateAppliedCollateralItemId(eventInstanceId: string, templateOriginId: string) {
  return `collateral-${eventInstanceId}-${templateOriginId}`;
}

function getCurrentDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeDateString(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : undefined;
}

function serializeCollateralItem(item: CollateralItem) {
  return JSON.stringify({
    archivedAt: item.archivedAt ?? "",
    blockedBy: item.blockedBy,
    dueDate: item.dueDate,
    eventInstanceId: item.eventInstanceId,
    fileLink: item.fileLink ?? "",
    id: item.id,
    itemName: item.itemName,
    lastUpdated: item.lastUpdated,
    noteEntries: item.noteEntries,
    notes: item.notes,
    owner: item.owner,
    printer: item.printer,
    quantity: item.quantity,
    requiresApproval: item.requiresApproval === true,
    requiresCopy: item.requiresCopy === true,
    requiresLogo: item.requiresLogo === true,
    status: item.status,
    subEventId: item.subEventId,
    templateOriginId: item.templateOriginId ?? "",
    updateType: item.updateType
  });
}

function hasOwnField<Key extends keyof CollateralItem>(
  value: Partial<CollateralItem>,
  key: Key
): value is Partial<CollateralItem> & Required<Pick<CollateralItem, Key>> {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
