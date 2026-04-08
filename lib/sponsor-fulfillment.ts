import type { NewActionItemInput } from "@/lib/action-item-mutations";
import type { CollateralItem } from "@/lib/collateral-data";
import { getUnassignedSubEventId, type EventInstance, type EventSubEvent } from "@/lib/event-instances";
import {
  getEventTypeDefinitions,
  getSponsorModelDefinitionForEventType,
  type SponsorDeliverableRule
} from "@/lib/event-type-definitions";
import { createActionNoteEntry, getIssueDueDate, LOCAL_FALLBACK_NOTE_AUTHOR } from "@/lib/ops-utils";
import type { ActionItem } from "@/lib/sample-data";

export type SponsorPlacementType = string;

export type SponsorPlacement = {
  id: string;
  eventInstanceId: string;
  sponsorName: string;
  placement: SponsorPlacementType;
  linkedSubEventId?: string;
  isActive?: boolean;
  logoReceived: boolean;
  notes?: string;
};

export type SponsorPlacementsByInstance = Record<string, SponsorPlacement[]>;

export type SponsorFulfillmentGenerationResult = {
  plans: SponsorFulfillmentGenerationPlan[];
  created: NewActionItemInput[];
  skipped: number;
  matchedExistingCollateralCount: number;
  fallbackCollateralToCreate: SponsorFallbackCollateralPlan[];
};

export type SponsorFallbackCollateralPlan = {
  sourceKey: string;
  itemName: string;
  subEventId: string;
  subEventName: string | null;
  input: Omit<CollateralItem, "archivedAt" | "id" | "lastUpdated">;
};

export type SponsorCollateralLink = {
  collateralItemId: string;
  collateralItemName: string;
  subEventId: string;
  subEventName: string | null;
  source: "matched" | "fallback_created";
};

export type SponsorFulfillmentGenerationPlan = {
  sourceKey: string;
  actionItem: NewActionItemInput;
  existingActionItemId: string | null;
  collateralLink: SponsorCollateralLink | null;
  fallbackCollateral: SponsorFallbackCollateralPlan | null;
};

export type SponsorCollateralPromotionDefaults = {
  eventInstanceId: string;
  sponsorName: string;
  placement: SponsorPlacementType;
  deliverableName: string;
  collateralItemName: string;
  subEventId: string;
  subEventName: string | null;
};

const DEFAULT_SPONSOR_EVENT_TYPE_ID = "legislative-day";
const NEWS_BRIEF_MONTH_NAMES = {
  3: "March",
  4: "April"
} as const;

export const SPONSOR_PLACEMENT_OPTIONS = getSponsorPlacementOptions(DEFAULT_SPONSOR_EVENT_TYPE_ID);

export function getSponsorPlacementOptions(eventTypeId: string) {
  return (getSponsorModelDefinitionForEventType(eventTypeId)?.placements ?? []).map((placement) => ({
    id: placement.id,
    label: placement.label
  }));
}

export function supportsSponsorSetupForEventType(eventTypeId: string) {
  return getSponsorModelDefinitionForEventType(eventTypeId) !== null;
}

export function createSponsorPlacementDraft(eventInstanceId: string, eventTypeId = DEFAULT_SPONSOR_EVENT_TYPE_ID): SponsorPlacement {
  const placementOptions = getSponsorPlacementOptions(eventTypeId);

  return {
    id: `sponsor-placement-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    eventInstanceId,
    sponsorName: "",
    placement: placementOptions[0]?.id ?? "",
    linkedSubEventId: undefined,
    isActive: true,
    logoReceived: false,
    notes: ""
  };
}

export function normalizeSponsorPlacement(
  value: Partial<SponsorPlacement> & { placementType?: string },
  input: {
    eventInstances: EventInstance[];
    eventSubEvents?: EventSubEvent[];
  }
): SponsorPlacement | null {
  const placementValue =
    typeof value.placement === "string"
      ? value.placement
      : typeof value.placementType === "string"
        ? value.placementType
        : undefined;

  if (
    typeof value.id !== "string" ||
    typeof value.eventInstanceId !== "string" ||
    typeof value.sponsorName !== "string" ||
    typeof placementValue !== "string"
  ) {
    return null;
  }

  const eventInstance = input.eventInstances.find((instance) => instance.id === value.eventInstanceId) ?? null;

  if (!eventInstance || !isSponsorPlacementType(eventInstance.eventTypeId, placementValue)) {
    return null;
  }

  return {
    id: value.id,
    eventInstanceId: value.eventInstanceId,
    sponsorName: value.sponsorName.trim(),
    placement: placementValue,
    linkedSubEventId: normalizeLinkedSubEventId(value.linkedSubEventId, value.eventInstanceId, input.eventSubEvents ?? []),
    isActive: normalizeIsActiveValue(value.isActive),
    logoReceived: normalizeLogoReceivedValue(value.logoReceived),
    notes: typeof value.notes === "string" && value.notes.trim() ? value.notes.trim() : undefined
  };
}

export function normalizeSponsorPlacementsByInstance(
  placementsByInstance: SponsorPlacementsByInstance | undefined,
  input: {
    eventInstances: EventInstance[];
    eventSubEvents?: EventSubEvent[];
  }
): SponsorPlacementsByInstance {
  if (!placementsByInstance || typeof placementsByInstance !== "object" || Array.isArray(placementsByInstance)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(placementsByInstance)
      .filter(([instanceId]) => input.eventInstances.some((instance) => instance.id === instanceId))
      .map(([instanceId, placements]) => [
        instanceId,
        Array.isArray(placements)
          ? placements
              .map((placement) =>
                placement && typeof placement === "object"
                  ? normalizeSponsorPlacement(placement as Partial<SponsorPlacement> & { placementType?: string }, input)
                  : null
              )
              .filter((placement): placement is SponsorPlacement => placement !== null)
          : []
      ])
  );
}

export function getSponsorPlacementLabel(type: SponsorPlacementType, eventTypeId = DEFAULT_SPONSOR_EVENT_TYPE_ID) {
  return getSponsorPlacementOptions(eventTypeId).find((option) => option.id === type)?.label ?? "Sponsor placement";
}

export function getSponsorPlacementDeliverables(placement: SponsorPlacementType, eventTypeId = DEFAULT_SPONSOR_EVENT_TYPE_ID) {
  const sponsorModel = getSponsorModelDefinitionForEventType(eventTypeId);
  return sponsorModel?.deliverableRulesByPlacement[placement]?.map((rule) => ({ ...rule })) ?? [];
}

export function getSponsorFulfillmentTaskTitle(input: {
  sponsorName: string;
  deliverableName: string;
}) {
  return `${input.sponsorName} - ${input.deliverableName}`;
}

export function getSponsorCollateralPromotionDefaults(input: {
  item: ActionItem;
  eventSubEvents: EventSubEvent[];
  collateralItems?: CollateralItem[];
}) {
  if (!input.item.eventInstanceId) {
    return null;
  }

  const source = parseSponsorFulfillmentSourceFromItem(input.item);
  if (!source) {
    return null;
  }

  const linkedCollateral = getSponsorCollateralLinkFromItem(input.item);
  if (linkedCollateral) {
    return {
      eventInstanceId: input.item.eventInstanceId,
      sponsorName: source.sponsorName,
      placement: source.placement,
      deliverableName: source.deliverableName,
      collateralItemName: linkedCollateral.collateralItemName,
      subEventId: linkedCollateral.subEventId,
      subEventName: linkedCollateral.subEventName
    } satisfies SponsorCollateralPromotionDefaults;
  }

  const rule = getSponsorCollateralPromotionRule(source.placement, source.deliverableName);
  if (!rule) {
    return null;
  }

  const resolvedTarget = resolveSponsorCollateralTarget({
    eventInstanceId: input.item.eventInstanceId,
    placementLinkedSubEventId: source.linkedSubEventId,
    preferredSubEventName: rule.preferredSubEventName,
    collateralItemName: rule.collateralItemName,
    eventSubEvents: input.eventSubEvents,
    collateralItems: input.collateralItems ?? []
  });

  return {
    eventInstanceId: input.item.eventInstanceId,
    sponsorName: source.sponsorName,
    placement: source.placement,
    deliverableName: source.deliverableName,
    collateralItemName: resolvedTarget.collateralItemName,
    subEventId: resolvedTarget.subEventId,
    subEventName: resolvedTarget.subEventName
  } satisfies SponsorCollateralPromotionDefaults;
}

export function buildSponsorFulfillmentGenerationResult(input: {
  placements: SponsorPlacement[];
  eventInstance: EventInstance;
  existingItems: ActionItem[];
  existingCollateralItems?: CollateralItem[];
  defaultOwner: string;
  eventSubEvents?: EventSubEvent[];
}): SponsorFulfillmentGenerationResult {
  const sponsorModel = getSponsorModelDefinitionForEventType(input.eventInstance.eventTypeId);

  if (!sponsorModel) {
    return {
      plans: [],
      created: [],
      skipped: input.placements.length,
      matchedExistingCollateralCount: 0,
      fallbackCollateralToCreate: []
    };
  }

  const seenPlacementKeys = new Set<string>();
  const plannedFallbackCollateralKeys = new Set<string>();
  const plans: SponsorFulfillmentGenerationPlan[] = [];
  const created: NewActionItemInput[] = [];
  let skipped = 0;
  let matchedExistingCollateralCount = 0;
  const fallbackCollateralToCreate: SponsorFallbackCollateralPlan[] = [];

  for (const placement of input.placements) {
    const normalizedSponsorName = placement.sponsorName.trim();

    if (placement.isActive === false || !normalizedSponsorName) {
      skipped += 1;
      continue;
    }

    const placementKey = serializeSponsorPlacementKey(placement);
    if (seenPlacementKeys.has(placementKey)) {
      skipped += 1;
      continue;
    }

    seenPlacementKeys.add(placementKey);

    const deliverables = getSponsorPlacementDeliverables(placement.placement, input.eventInstance.eventTypeId);
    if (deliverables.length === 0) {
      skipped += 1;
      continue;
    }

    for (const deliverable of deliverables) {
      const sourceKey = getSponsorFulfillmentSourceKey(placement, deliverable.deliverableName);
      const collateralPlan = buildSponsorCollateralPlan({
        placement,
        deliverable,
        eventInstance: input.eventInstance,
        defaultOwner: input.defaultOwner,
        eventSubEvents: input.eventSubEvents ?? [],
        existingCollateralItems: input.existingCollateralItems ?? [],
        plannedFallbackCollateralKeys
      });
      const generatedTask = createSponsorFulfillmentTask({
        placement,
        deliverable,
        eventInstance: input.eventInstance,
        defaultOwner: input.defaultOwner,
        eventSubEvents: input.eventSubEvents ?? [],
        collateralLink: collateralPlan?.collateralLink ?? null
      });
      const existingActionItem =
        input.existingItems.find((item) =>
          matchesSponsorFulfillmentTask(item, generatedTask, placement, deliverable, input.eventInstance)
        ) ?? null;

      if (existingActionItem) {
        skipped += 1;
        plans.push({
          sourceKey,
          actionItem: generatedTask,
          existingActionItemId: existingActionItem.id,
          collateralLink: collateralPlan?.collateralLink ?? getSponsorCollateralLinkFromItem(existingActionItem),
          fallbackCollateral: collateralPlan?.fallbackCollateral ?? null
        });
      } else {
        created.push(generatedTask);
        plans.push({
          sourceKey,
          actionItem: generatedTask,
          existingActionItemId: null,
          collateralLink: collateralPlan?.collateralLink ?? null,
          fallbackCollateral: collateralPlan?.fallbackCollateral ?? null
        });
      }

      if (collateralPlan?.collateralLink?.source === "matched") {
        matchedExistingCollateralCount += 1;
      }

      if (collateralPlan?.fallbackCollateral) {
        fallbackCollateralToCreate.push(collateralPlan.fallbackCollateral);
      }
    }
  }

  return {
    plans,
    created,
    skipped,
    matchedExistingCollateralCount,
    fallbackCollateralToCreate
  };
}

function createSponsorFulfillmentTask(input: {
  placement: SponsorPlacement;
  deliverable: SponsorDeliverableRule;
  eventInstance: EventInstance;
  defaultOwner: string;
  eventSubEvents: EventSubEvent[];
  collateralLink: SponsorCollateralLink | null;
}): NewActionItemInput {
  const title = getSponsorFulfillmentTaskTitle({
    sponsorName: input.placement.sponsorName.trim(),
    deliverableName: input.deliverable.deliverableName
  });
  const sourceKey = getSponsorFulfillmentSourceKey(input.placement, input.deliverable.deliverableName);
  const noteParts = [
    `Generated from sponsor setup for ${input.eventInstance.name}.`,
    `Sponsor radar source: ${sourceKey}.`,
    `Placement: ${getSponsorPlacementLabel(input.placement.placement, input.eventInstance.eventTypeId)}.`,
    input.collateralLink ? `Sponsor collateral link: ${serializeSponsorCollateralLink(input.collateralLink)}.` : "",
    !input.placement.logoReceived && input.deliverable.requiresLogo ? "Waiting on sponsor logo." : "",
    input.deliverable.requiresCopy ? "This deliverable also needs sponsor copy or approval." : "",
    input.placement.notes?.trim() ?? ""
  ].filter(Boolean);
  const initialNote = createActionNoteEntry(noteParts.join(" "), {
    author: LOCAL_FALLBACK_NOTE_AUTHOR
  });
  const dueDate = resolveSponsorDeliverableDueDate(input.deliverable, input.eventInstance, input.eventSubEvents, input.placement.linkedSubEventId);
  const issue = input.deliverable.issue ?? getIssueForSponsorDeliverable(input.deliverable, input.eventInstance);
  const eventTypeLabel = getEventTypeDefinitions().find((definition) => definition.key === input.eventInstance.eventTypeId)?.label ?? input.eventInstance.eventTypeId;

  return {
    type: "Deliverable",
    title,
    workstream: eventTypeLabel,
    eventInstanceId: input.eventInstance.id,
    operationalBucket: undefined,
    issue,
    dueDate,
    owner: input.defaultOwner,
    status: !input.placement.logoReceived && input.deliverable.requiresLogo ? "Waiting" : "Not Started",
    waitingOn: !input.placement.logoReceived && input.deliverable.requiresLogo ? "Sponsor logo" : "",
    isBlocked: undefined,
    blockedBy: "",
    noteEntries: initialNote ? [initialNote] : []
  };
}

function matchesSponsorFulfillmentTask(
  item: ActionItem,
  generatedTask: NewActionItemInput,
  placement: SponsorPlacement,
  deliverable: SponsorDeliverableRule,
  eventInstance: EventInstance
) {
  const sourceKey = getSponsorFulfillmentSourceKey(placement, deliverable.deliverableName);
  const hasExactSourceMarker = item.noteEntries.some((entry) => entry.text.includes(`Sponsor radar source: ${sourceKey}.`));
  const matchesLegacyGeneratedShape =
    item.workstream === generatedTask.workstream &&
    item.eventInstanceId === placement.eventInstanceId &&
    item.title.trim() === generatedTask.title.trim() &&
    item.noteEntries.some((entry) => entry.text.includes(`Generated from sponsor setup for ${eventInstance.name}.`));

  return hasExactSourceMarker || matchesLegacyGeneratedShape;
}

function getSponsorFulfillmentSourceKey(placement: SponsorPlacement, deliverableName: string) {
  return JSON.stringify({
    eventInstanceId: placement.eventInstanceId,
    sponsorName: placement.sponsorName.trim().toLowerCase(),
    placement: placement.placement,
    deliverableName,
    linkedSubEventId: placement.linkedSubEventId ?? null
  });
}

function serializeSponsorPlacementKey(placement: SponsorPlacement) {
  return JSON.stringify({
    eventInstanceId: placement.eventInstanceId,
    sponsorName: placement.sponsorName.trim().toLowerCase(),
    placement: placement.placement,
    linkedSubEventId: placement.linkedSubEventId ?? null
  });
}

function parseSponsorFulfillmentSourceFromItem(item: ActionItem) {
  const marker = item.noteEntries.find((entry) => entry.text.includes("Sponsor radar source: "));

  if (!marker) {
    return null;
  }

  const match = marker.text.match(/Sponsor radar source: (\{.+?\})\./);
  if (!match) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[1] ?? "") as {
      eventInstanceId?: unknown;
      sponsorName?: unknown;
      placement?: unknown;
      deliverableName?: unknown;
      linkedSubEventId?: unknown;
    };

    if (
      typeof parsed.eventInstanceId !== "string" ||
      typeof parsed.sponsorName !== "string" ||
      typeof parsed.placement !== "string" ||
      typeof parsed.deliverableName !== "string"
    ) {
      return null;
    }

    return {
      eventInstanceId: parsed.eventInstanceId,
      sponsorName: parsed.sponsorName,
      placement: parsed.placement,
      deliverableName: parsed.deliverableName,
      linkedSubEventId: typeof parsed.linkedSubEventId === "string" ? parsed.linkedSubEventId : undefined
    };
  } catch {
    return null;
  }
}

function resolveSponsorDeliverableDueDate(
  deliverable: SponsorDeliverableRule,
  eventInstance: EventInstance,
  eventSubEvents: EventSubEvent[],
  linkedSubEventId?: string
) {
  if (deliverable.timingType === "Pre_Event") {
    return shiftIsoDate(eventInstance.startDate, -(deliverable.offsetDays ?? 0));
  }

  if (deliverable.timingType === "Event_Day") {
    const linkedSubEventDate = getSubEventDateById(linkedSubEventId, eventSubEvents, eventInstance.id);
    return shiftIsoDate(linkedSubEventDate ?? eventInstance.startDate, deliverable.offsetDays ?? 0);
  }

  if (deliverable.timingType === "Post_Event") {
    return shiftIsoDate(eventInstance.endDate || eventInstance.startDate, deliverable.offsetDays ?? 0);
  }

  if (deliverable.timingType === "Sub_Event") {
    const subEventDate =
      getSubEventDateById(linkedSubEventId, eventSubEvents, eventInstance.id) ??
      eventSubEvents.find(
        (subEvent) =>
          subEvent.eventInstanceId === eventInstance.id &&
          subEvent.name === deliverable.subEventName &&
          subEvent.date
      )?.date ??
      eventInstance.startDate;
    return shiftIsoDate(subEventDate, deliverable.offsetDays ?? 0);
  }

  if (deliverable.timingType === "Fixed_Month" && deliverable.fixedMonth) {
    const issueLabel = deliverable.issue ?? getNewsBriefIssueLabel(eventInstance.startDate, deliverable.fixedMonth);
    return getIssueDueDate(issueLabel) ?? "";
  }

  return "";
}

function getNewsBriefIssueLabel(eventStartDate: string, fixedMonth: number) {
  const year = Number(eventStartDate.slice(0, 4));
  const monthName = NEWS_BRIEF_MONTH_NAMES[fixedMonth as keyof typeof NEWS_BRIEF_MONTH_NAMES];

  return monthName ? `${monthName} ${year} News Brief` : "";
}

function getIssueForSponsorDeliverable(deliverable: SponsorDeliverableRule, eventInstance: EventInstance) {
  if (deliverable.timingType === "Fixed_Month" && deliverable.fixedMonth) {
    return getNewsBriefIssueLabel(eventInstance.startDate, deliverable.fixedMonth) || undefined;
  }

  return deliverable.issue ?? undefined;
}

function getAllSponsorCollateralPromotionRules() {
  return getEventTypeDefinitions()
    .flatMap((definition) => definition.sponsorModel?.collateralPromotionRules ?? [])
    .map((rule) => ({ ...rule }));
}

function getSponsorCollateralPromotionRule(placement: string, deliverableName: string) {
  return getAllSponsorCollateralPromotionRules().find(
    (entry) => entry.placement === placement && entry.deliverableName === deliverableName
  ) ?? null;
}

function buildSponsorCollateralPlan(input: {
  placement: SponsorPlacement;
  deliverable: SponsorDeliverableRule;
  eventInstance: EventInstance;
  defaultOwner: string;
  eventSubEvents: EventSubEvent[];
  existingCollateralItems: CollateralItem[];
  plannedFallbackCollateralKeys: Set<string>;
}) {
  const promotionRule = getSponsorCollateralPromotionRule(input.placement.placement, input.deliverable.deliverableName);

  if (!promotionRule) {
    return null;
  }

  const target = resolveSponsorCollateralTarget({
    eventInstanceId: input.eventInstance.id,
    placementLinkedSubEventId: input.placement.linkedSubEventId,
    preferredSubEventName: promotionRule.preferredSubEventName,
    collateralItemName: promotionRule.collateralItemName,
    eventSubEvents: input.eventSubEvents,
    collateralItems: input.existingCollateralItems
  });

  if (target.matchedCollateralItemId) {
    return {
      collateralLink: {
        collateralItemId: target.matchedCollateralItemId,
        collateralItemName: target.collateralItemName,
        subEventId: target.subEventId,
        subEventName: target.subEventName,
        source: "matched"
      } satisfies SponsorCollateralLink,
      fallbackCollateral: null
    };
  }

  const fallbackKey = JSON.stringify({
    eventInstanceId: input.eventInstance.id,
    collateralItemName: target.collateralItemName.trim().toLowerCase(),
    subEventId: target.subEventId
  });

  if (input.plannedFallbackCollateralKeys.has(fallbackKey)) {
    return {
      collateralLink: null,
      fallbackCollateral: null
    };
  }

  input.plannedFallbackCollateralKeys.add(fallbackKey);

  const fallbackCollateral = {
    sourceKey: getSponsorFulfillmentSourceKey(input.placement, input.deliverable.deliverableName),
    itemName: target.collateralItemName,
    subEventId: target.subEventId,
    subEventName: target.subEventName,
    input: {
      eventInstanceId: input.eventInstance.id,
      subEventId: target.subEventId,
      itemName: target.collateralItemName,
      status: "Backlog",
      owner: input.defaultOwner,
      blockedBy: "",
      dueDate: resolveSponsorDeliverableDueDate(
        input.deliverable,
        input.eventInstance,
        input.eventSubEvents,
        input.placement.linkedSubEventId
      ),
      printer: "",
      quantity: "",
      updateType: "Net New",
      noteEntries: buildFallbackCollateralNotes(input.placement, input.deliverable, input.eventInstance)
    }
  } satisfies SponsorFallbackCollateralPlan;

  return {
    collateralLink: null,
    fallbackCollateral
  };
}

function resolveSponsorCollateralTarget(input: {
  eventInstanceId: string;
  placementLinkedSubEventId?: string;
  preferredSubEventName?: string;
  collateralItemName: string;
  eventSubEvents: EventSubEvent[];
  collateralItems: CollateralItem[];
}) {
  const linkedSubEvent =
    input.placementLinkedSubEventId
      ? input.eventSubEvents.find(
          (subEvent) =>
            subEvent.eventInstanceId === input.eventInstanceId && subEvent.id === input.placementLinkedSubEventId
        ) ?? null
      : null;
  const preferredSubEvent =
    linkedSubEvent ??
    (input.preferredSubEventName
      ? input.eventSubEvents.find(
          (subEvent) =>
            subEvent.eventInstanceId === input.eventInstanceId && subEvent.name === input.preferredSubEventName
        ) ?? null
      : null);
  const subEventId = preferredSubEvent?.id ?? getUnassignedSubEventId(input.eventInstanceId);
  const subEventName = preferredSubEvent?.name ?? null;
  const normalizedTargetName = input.collateralItemName.trim().toLowerCase();
  const matchedItem =
    input.collateralItems.find(
      (item) =>
        item.eventInstanceId === input.eventInstanceId &&
        item.subEventId === subEventId &&
        item.itemName.trim().toLowerCase() === normalizedTargetName
    ) ??
    null;

  return {
    collateralItemName: input.collateralItemName,
    subEventId,
    subEventName,
    matchedCollateralItemId: matchedItem?.id ?? null
  };
}

function buildFallbackCollateralNotes(
  placement: SponsorPlacement,
  deliverable: SponsorDeliverableRule,
  eventInstance: EventInstance
) {
  const sourceKey = getSponsorFulfillmentSourceKey(placement, deliverable.deliverableName);
  const noteEntry = createActionNoteEntry(
    `Generated as fallback collateral for sponsor setup on ${eventInstance.name}. Sponsor radar source: ${sourceKey}.`,
    { author: LOCAL_FALLBACK_NOTE_AUTHOR }
  );

  return noteEntry ? [noteEntry] : [];
}

export function appendSponsorCollateralLinkNoteEntries(
  noteEntries: ActionItem["noteEntries"],
  collateralLink: SponsorCollateralLink | null
) {
  if (!collateralLink) {
    return noteEntries;
  }

  const marker = `Sponsor collateral link: ${serializeSponsorCollateralLink(collateralLink)}.`;
  if (noteEntries.some((entry) => entry.text.includes(marker))) {
    return noteEntries;
  }

  const nextEntry = createActionNoteEntry(marker, {
    author: LOCAL_FALLBACK_NOTE_AUTHOR
  });

  return nextEntry ? [nextEntry, ...noteEntries] : noteEntries;
}

export function getSponsorCollateralLinkFromItem(item: ActionItem) {
  const marker = item.noteEntries.find((entry) => entry.text.includes("Sponsor collateral link: "));

  if (!marker) {
    return null;
  }

  const match = marker.text.match(/Sponsor collateral link: (\{.+?\})\./);
  if (!match) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[1] ?? "") as {
      collateralItemId?: unknown;
      collateralItemName?: unknown;
      subEventId?: unknown;
      subEventName?: unknown;
      source?: unknown;
    };

    if (
      typeof parsed.collateralItemId !== "string" ||
      typeof parsed.collateralItemName !== "string" ||
      typeof parsed.subEventId !== "string" ||
      (parsed.subEventName !== null && parsed.subEventName !== undefined && typeof parsed.subEventName !== "string") ||
      (parsed.source !== "matched" && parsed.source !== "fallback_created")
    ) {
      return null;
    }

    return {
      collateralItemId: parsed.collateralItemId,
      collateralItemName: parsed.collateralItemName,
      subEventId: parsed.subEventId,
      subEventName: typeof parsed.subEventName === "string" ? parsed.subEventName : null,
      source: parsed.source
    } satisfies SponsorCollateralLink;
  } catch {
    return null;
  }
}

function serializeSponsorCollateralLink(link: SponsorCollateralLink) {
  return JSON.stringify(link);
}

function shiftIsoDate(isoDate: string, days: number) {
  if (!isoDate) {
    return "";
  }

  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function getSubEventDateById(
  linkedSubEventId: string | undefined,
  eventSubEvents: EventSubEvent[],
  eventInstanceId: string
) {
  if (!linkedSubEventId) {
    return null;
  }

  return (
    eventSubEvents.find(
      (subEvent) =>
        subEvent.eventInstanceId === eventInstanceId &&
        subEvent.id === linkedSubEventId &&
        subEvent.date
    )?.date ?? null
  );
}

function normalizeLogoReceivedValue(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value > 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
  }

  return false;
}

function normalizeLinkedSubEventId(value: unknown, eventInstanceId: string, eventSubEvents: EventSubEvent[]) {
  if (typeof value !== "string" || !value) {
    return undefined;
  }

  return eventSubEvents.some((subEvent) => subEvent.eventInstanceId === eventInstanceId && subEvent.id === value)
    ? value
    : undefined;
}

function normalizeIsActiveValue(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }

  return true;
}

function isSponsorPlacementType(eventTypeId: string, value: string): value is SponsorPlacementType {
  return getSponsorPlacementOptions(eventTypeId).some((option) => option.id === value);
}
