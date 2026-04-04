import type { NewActionItemInput } from "@/lib/action-item-mutations";
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
  logoReceived: boolean;
  notes?: string;
};

export type SponsorPlacementsByInstance = Record<string, SponsorPlacement[]>;

export type SponsorFulfillmentGenerationResult = {
  created: NewActionItemInput[];
  skipped: number;
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
    logoReceived: false,
    notes: ""
  };
}

export function normalizeSponsorPlacement(
  value: Partial<SponsorPlacement> & { placementType?: string },
  input: {
    eventInstances: EventInstance[];
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
    logoReceived: normalizeLogoReceivedValue(value.logoReceived),
    notes: typeof value.notes === "string" && value.notes.trim() ? value.notes.trim() : undefined
  };
}

export function normalizeSponsorPlacementsByInstance(
  placementsByInstance: SponsorPlacementsByInstance | undefined,
  input: {
    eventInstances: EventInstance[];
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
}) {
  if (!input.item.eventInstanceId) {
    return null;
  }

  const source = parseSponsorFulfillmentSourceFromItem(input.item);
  if (!source) {
    return null;
  }

  const rule = getAllSponsorCollateralPromotionRules().find(
    (entry) => entry.placement === source.placement && entry.deliverableName === source.deliverableName
  );

  if (!rule) {
    return null;
  }

  const matchedSubEvent =
    rule.preferredSubEventName
      ? input.eventSubEvents.find(
          (subEvent) =>
            subEvent.eventInstanceId === input.item.eventInstanceId &&
            subEvent.name === rule.preferredSubEventName
        ) ?? null
      : null;

  return {
    eventInstanceId: input.item.eventInstanceId,
    sponsorName: source.sponsorName,
    placement: source.placement,
    deliverableName: source.deliverableName,
    collateralItemName: rule.collateralItemName,
    subEventId: matchedSubEvent?.id ?? getUnassignedSubEventId(input.item.eventInstanceId),
    subEventName: matchedSubEvent?.name ?? null
  } satisfies SponsorCollateralPromotionDefaults;
}

export function buildSponsorFulfillmentGenerationResult(input: {
  placements: SponsorPlacement[];
  eventInstance: EventInstance;
  existingItems: ActionItem[];
  defaultOwner: string;
  eventSubEvents?: EventSubEvent[];
}): SponsorFulfillmentGenerationResult {
  const sponsorModel = getSponsorModelDefinitionForEventType(input.eventInstance.eventTypeId);

  if (!sponsorModel) {
    return { created: [], skipped: input.placements.length };
  }

  const seenPlacementKeys = new Set<string>();
  const created: NewActionItemInput[] = [];
  let skipped = 0;

  for (const placement of input.placements) {
    const normalizedSponsorName = placement.sponsorName.trim();

    if (!normalizedSponsorName) {
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
      const generatedTask = createSponsorFulfillmentTask({
        placement,
        deliverable,
        eventInstance: input.eventInstance,
        defaultOwner: input.defaultOwner,
        eventSubEvents: input.eventSubEvents ?? []
      });

      if (
        input.existingItems.some((item) =>
          matchesSponsorFulfillmentTask(item, generatedTask, placement, deliverable, input.eventInstance)
        )
      ) {
        skipped += 1;
        continue;
      }

      created.push(generatedTask);
    }
  }

  return { created, skipped };
}

function createSponsorFulfillmentTask(input: {
  placement: SponsorPlacement;
  deliverable: SponsorDeliverableRule;
  eventInstance: EventInstance;
  defaultOwner: string;
  eventSubEvents: EventSubEvent[];
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
    !input.placement.logoReceived && input.deliverable.requiresLogo ? "Waiting on sponsor logo." : "",
    input.deliverable.requiresCopy ? "This deliverable also needs sponsor copy or approval." : "",
    input.placement.notes?.trim() ?? ""
  ].filter(Boolean);
  const initialNote = createActionNoteEntry(noteParts.join(" "), {
    author: LOCAL_FALLBACK_NOTE_AUTHOR
  });
  const dueDate = resolveSponsorDeliverableDueDate(input.deliverable, input.eventInstance, input.eventSubEvents);
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
    deliverableName
  });
}

function serializeSponsorPlacementKey(placement: SponsorPlacement) {
  return JSON.stringify({
    eventInstanceId: placement.eventInstanceId,
    sponsorName: placement.sponsorName.trim().toLowerCase(),
    placement: placement.placement
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
      deliverableName: parsed.deliverableName
    };
  } catch {
    return null;
  }
}

function resolveSponsorDeliverableDueDate(
  deliverable: SponsorDeliverableRule,
  eventInstance: EventInstance,
  eventSubEvents: EventSubEvent[]
) {
  if (deliverable.timingType === "Pre_Event") {
    return shiftIsoDate(eventInstance.startDate, -(deliverable.offsetDays ?? 0));
  }

  if (deliverable.timingType === "Event_Day") {
    return shiftIsoDate(eventInstance.startDate, deliverable.offsetDays ?? 0);
  }

  if (deliverable.timingType === "Post_Event") {
    return shiftIsoDate(eventInstance.endDate || eventInstance.startDate, deliverable.offsetDays ?? 0);
  }

  if (deliverable.timingType === "Sub_Event") {
    const subEventDate =
      eventSubEvents.find(
        (subEvent) =>
          subEvent.eventInstanceId === eventInstance.id &&
          subEvent.name === deliverable.subEventName &&
          subEvent.date
      )?.date ?? eventInstance.startDate;
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

function isSponsorPlacementType(eventTypeId: string, value: string): value is SponsorPlacementType {
  return getSponsorPlacementOptions(eventTypeId).some((option) => option.id === value);
}
