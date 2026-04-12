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

export type SponsorOpportunityDeliverable = {
  id: string;
  deliverableName: string;
  category: string;
  channel: string;
  timingType: string;
  offsetDays: string;
  fixedMonth: string;
  eventDayOffset: string;
  requiresLogo: boolean;
  requiresCopy: boolean;
  requiresApproval: boolean;
};

export type SponsorOpportunity = {
  id: string;
  eventInstanceId: string;
  label: string;
  placementType: SponsorPlacementType;
  linkedSubEventId?: string;
  isActive?: boolean;
  notes?: string;
  deliverables?: SponsorOpportunityDeliverable[];
};

export type SponsorCommitment = {
  id: string;
  eventInstanceId: string;
  sponsorName: string;
  opportunityId: string;
  placement?: SponsorPlacementType;
  linkedSubEventId?: string;
  isActive?: boolean;
  logoReceived: boolean;
  notes?: string;
};

export type SponsorshipSetup = {
  opportunities: SponsorOpportunity[];
  commitments: SponsorCommitment[];
};

export type SponsorshipSetupByInstance = Record<string, SponsorshipSetup>;

export type LegacySponsorPlacement = {
  id: string;
  eventInstanceId: string;
  sponsorName: string;
  placement: SponsorPlacementType;
  linkedSubEventId?: string;
  isActive?: boolean;
  logoReceived: boolean;
  notes?: string;
};

export type SponsorFulfillmentGenerationResult = {
  plans: SponsorFulfillmentGenerationPlan[];
  created: NewActionItemInput[];
  skipped: number;
  matchedExistingCollateralCount: number;
  fallbackCollateralToCreate: SponsorFallbackCollateralPlan[];
  obsoleteActionItems: SponsorGeneratedWorkReviewRecord[];
  obsoleteCollateralItems: SponsorGeneratedWorkReviewRecord[];
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

export type SponsorGeneratedWorkReviewRecord = {
  id: string;
  sourceKey: string;
  hasMeaningfulProgress: boolean;
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

export function getSponsorPlacementOptions(eventTypeId: string) {
  return (getSponsorModelDefinitionForEventType(eventTypeId)?.placements ?? []).map((placement) => ({
    id: placement.id,
    label: placement.label
  }));
}

export function getDefaultSponsorOpportunitiesForEventInstance(eventInstanceId: string, eventTypeId: string) {
  return getSponsorPlacementOptions(eventTypeId).map((placement, index) => ({
    id: `${eventInstanceId}-opportunity-${slugify(placement.id) || index + 1}`,
    eventInstanceId,
    label: placement.label,
    placementType: placement.id,
    linkedSubEventId: undefined,
    isActive: true,
    notes: undefined
  })) satisfies SponsorOpportunity[];
}

export function createDefaultSponsorshipSetupForEventInstance(eventInstanceId: string, eventTypeId: string): SponsorshipSetup {
  return {
    opportunities: getDefaultSponsorOpportunitiesForEventInstance(eventInstanceId, eventTypeId),
    commitments: []
  };
}

export function ensureSponsorshipSetupForEventInstance(
  eventInstanceId: string,
  eventTypeId: string,
  currentSetup?: SponsorshipSetup | null
) {
  if (currentSetup) {
    return {
      opportunities: currentSetup.opportunities.map((opportunity) => ({
        ...opportunity,
        deliverables: opportunity.deliverables?.map((deliverable) => ({ ...deliverable })) ?? []
      })),
      commitments: currentSetup.commitments.map((commitment) => ({ ...commitment }))
    } satisfies SponsorshipSetup;
  }

  return createDefaultSponsorshipSetupForEventInstance(eventInstanceId, eventTypeId);
}

export function supportsSponsorSetupForEventType(eventTypeId: string) {
  return getSponsorModelDefinitionForEventType(eventTypeId) !== null;
}

export function createSponsorOpportunityDraft(
  eventInstanceId: string,
  eventTypeId = DEFAULT_SPONSOR_EVENT_TYPE_ID
): SponsorOpportunity {
  const placementOptions = getSponsorPlacementOptions(eventTypeId);

  return {
    id: `sponsor-opportunity-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    eventInstanceId,
    label: placementOptions[0]?.label ?? "",
    placementType: placementOptions[0]?.id ?? "",
    linkedSubEventId: undefined,
    isActive: true,
    notes: "",
    deliverables: []
  };
}

export function createSponsorCommitmentDraft(
  eventInstanceId: string,
  sponsorshipSetup: SponsorshipSetup
): SponsorCommitment {
  return {
    id: `sponsor-commitment-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    eventInstanceId,
    sponsorName: "",
    opportunityId: sponsorshipSetup.opportunities[0]?.id ?? "",
    linkedSubEventId: undefined,
    isActive: true,
    logoReceived: false,
    notes: ""
  };
}

export function getSponsorCommitmentOpportunityOptions(setup: SponsorshipSetup) {
  return setup.opportunities
    .filter((opportunity) => opportunity.isActive !== false)
    .map((opportunity) => ({
      id: opportunity.id,
      label: opportunity.label
    }));
}

export function normalizeSponsorOpportunity(
  value: Partial<SponsorOpportunity> & { placement?: string; placementType?: string },
  input: {
    eventInstances: EventInstance[];
    eventSubEvents?: EventSubEvent[];
  }
): SponsorOpportunity | null {
  const placementType =
    typeof value.placementType === "string"
      ? value.placementType
      : typeof value.placement === "string"
        ? value.placement
        : undefined;

  if (
    typeof value.id !== "string" ||
    typeof value.eventInstanceId !== "string" ||
    typeof value.label !== "string" ||
    typeof placementType !== "string"
  ) {
    return null;
  }

  const eventInstance = input.eventInstances.find((instance) => instance.id === value.eventInstanceId) ?? null;

  if (!eventInstance || !isSponsorPlacementType(eventInstance.eventTypeId, placementType)) {
    return null;
  }

  return {
    id: value.id,
    eventInstanceId: value.eventInstanceId,
    label: value.label.trim(),
    placementType,
    linkedSubEventId: normalizeLinkedSubEventId(value.linkedSubEventId, value.eventInstanceId, input.eventSubEvents ?? []),
    isActive: normalizeIsActiveValue(value.isActive),
    notes: typeof value.notes === "string" && value.notes.trim() ? value.notes.trim() : undefined,
    deliverables: normalizeSponsorOpportunityDeliverables((value as Partial<SponsorOpportunity>).deliverables)
  };
}

export function normalizeSponsorCommitment(
  value: Partial<SponsorCommitment> & { placement?: string; placementType?: string; placementId?: string },
  input: {
    eventInstances: EventInstance[];
    eventSubEvents?: EventSubEvent[];
    opportunities: SponsorOpportunity[];
  }
): SponsorCommitment | null {
  if (
    typeof value.id !== "string" ||
    typeof value.eventInstanceId !== "string" ||
    typeof value.sponsorName !== "string"
  ) {
    return null;
  }

  const eventInstance = input.eventInstances.find((instance) => instance.id === value.eventInstanceId) ?? null;

  if (!eventInstance) {
    return null;
  }

  const opportunityId = resolveOpportunityId(value, input.opportunities);

  if (!opportunityId) {
    return null;
  }

  return {
    id: value.id,
    eventInstanceId: value.eventInstanceId,
    sponsorName: value.sponsorName.trim(),
    opportunityId,
    placement: input.opportunities.find((opportunity) => opportunity.id === opportunityId)?.placementType,
    linkedSubEventId: normalizeLinkedSubEventId(value.linkedSubEventId, value.eventInstanceId, input.eventSubEvents ?? []),
    isActive: normalizeIsActiveValue(value.isActive),
    logoReceived: normalizeLogoReceivedValue(value.logoReceived),
    notes: typeof value.notes === "string" && value.notes.trim() ? value.notes.trim() : undefined
  };
}

export function normalizeSponsorPlacement(
  value: Partial<SponsorCommitment> & { placement?: string; placementType?: string; placementId?: string },
  input: {
    eventInstances: EventInstance[];
    eventSubEvents?: EventSubEvent[];
    opportunities?: SponsorOpportunity[];
  }
) {
  const opportunities =
    input.opportunities ??
    input.eventInstances.flatMap((eventInstance) =>
      getDefaultSponsorOpportunitiesForEventInstance(eventInstance.id, eventInstance.eventTypeId)
    );

  return normalizeSponsorCommitment(value, {
    eventInstances: input.eventInstances,
    eventSubEvents: input.eventSubEvents,
    opportunities
  });
}

export function normalizeSponsorshipSetupByInstance(
  sponsorshipSetupByInstance: SponsorshipSetupByInstance | undefined,
  input: {
    eventInstances: EventInstance[];
    eventSubEvents?: EventSubEvent[];
    legacyPlacementsByInstance?: Record<string, unknown[]>;
  }
): SponsorshipSetupByInstance {
  const eventSubEvents = input.eventSubEvents ?? [];
  const legacyPlacementsByInstance = input.legacyPlacementsByInstance ?? {};
  const nextState: SponsorshipSetupByInstance = {};

  for (const eventInstance of input.eventInstances) {
    const rawSetup = sponsorshipSetupByInstance?.[eventInstance.id];
    const starterOpportunities = createDefaultSponsorshipSetupForEventInstance(
      eventInstance.id,
      eventInstance.eventTypeId
    ).opportunities;
    const synthesizedOpportunities = new Map<string, SponsorOpportunity>();

    const normalizedOpportunities =
      rawSetup?.opportunities
        ?.map((opportunity) => normalizeSponsorOpportunity(opportunity, { eventInstances: input.eventInstances, eventSubEvents }))
        .filter((opportunity): opportunity is SponsorOpportunity => opportunity !== null) ?? [];

    for (const opportunity of normalizedOpportunities.length > 0 ? normalizedOpportunities : starterOpportunities) {
      synthesizedOpportunities.set(opportunity.id, { ...opportunity });
    }

    for (const legacyPlacementValue of legacyPlacementsByInstance[eventInstance.id] ?? []) {
      const legacyPlacement = legacyPlacementValue as LegacySponsorPlacement;
      const placementType = legacyPlacement.placement;
      const existingOpportunity = Array.from(synthesizedOpportunities.values()).find(
        (opportunity) => opportunity.placementType === placementType
      );

      if (existingOpportunity) {
        continue;
      }

      const nextId = `${eventInstance.id}-opportunity-${slugify(placementType)}-legacy`;
      synthesizedOpportunities.set(nextId, {
        id: nextId,
        eventInstanceId: eventInstance.id,
        label: getSponsorPlacementLabel(placementType, eventInstance.eventTypeId),
        placementType,
        linkedSubEventId: normalizeLinkedSubEventId(legacyPlacement.linkedSubEventId, eventInstance.id, eventSubEvents),
        isActive: true,
        notes: undefined
      });
    }

    const opportunities = Array.from(synthesizedOpportunities.values());
    const normalizedCommitments: SponsorCommitment[] = [];

    for (const commitment of rawSetup?.commitments ?? []) {
      const normalizedCommitment = normalizeSponsorCommitment(commitment, {
        eventInstances: input.eventInstances,
        eventSubEvents,
        opportunities
      });

      if (normalizedCommitment) {
        normalizedCommitments.push(normalizedCommitment);
      }
    }

    for (const legacyPlacementValue of legacyPlacementsByInstance[eventInstance.id] ?? []) {
      const legacyPlacement = legacyPlacementValue as LegacySponsorPlacement;
      const normalizedCommitment = normalizeSponsorCommitment(
        {
          ...legacyPlacement,
          opportunityId: undefined
        },
        {
          eventInstances: input.eventInstances,
          eventSubEvents,
          opportunities
        }
      );

      if (normalizedCommitment && !normalizedCommitments.some((entry) => entry.id === normalizedCommitment.id)) {
        normalizedCommitments.push(normalizedCommitment);
      }
    }

    if (opportunities.length > 0 || normalizedCommitments.length > 0) {
      nextState[eventInstance.id] = {
        opportunities,
        commitments: normalizedCommitments
      };
    }
  }

  return nextState;
}

export function getSponsorPlacementLabel(type: SponsorPlacementType, eventTypeId = DEFAULT_SPONSOR_EVENT_TYPE_ID) {
  return getSponsorPlacementOptions(eventTypeId).find((option) => option.id === type)?.label ?? "Sponsor opportunity";
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
      placement: source.placementType,
      deliverableName: source.deliverableName,
      collateralItemName: linkedCollateral.collateralItemName,
      subEventId: linkedCollateral.subEventId,
      subEventName: linkedCollateral.subEventName
    } satisfies SponsorCollateralPromotionDefaults;
  }

  const rule = getSponsorCollateralPromotionRule(source.placementType, source.deliverableName);
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
    placement: source.placementType,
    deliverableName: source.deliverableName,
    collateralItemName: resolvedTarget.collateralItemName,
    subEventId: resolvedTarget.subEventId,
    subEventName: resolvedTarget.subEventName
  } satisfies SponsorCollateralPromotionDefaults;
}

export function buildSponsorFulfillmentGenerationResult(input: {
  sponsorshipSetup?: SponsorshipSetup;
  placements?: LegacySponsorPlacement[];
  eventInstance: EventInstance;
  existingItems: ActionItem[];
  existingCollateralItems?: CollateralItem[];
  defaultOwner: string;
  eventSubEvents?: EventSubEvent[];
}): SponsorFulfillmentGenerationResult {
  const sponsorshipSetup =
    input.sponsorshipSetup ??
    normalizeSponsorshipSetupByInstance(
      {
        [input.eventInstance.id]: {
          opportunities: [],
          commitments: []
        }
      },
      {
        eventInstances: [input.eventInstance],
        eventSubEvents: input.eventSubEvents,
        legacyPlacementsByInstance: input.placements ? { [input.eventInstance.id]: input.placements } : {}
      }
    )[input.eventInstance.id] ??
    createDefaultSponsorshipSetupForEventInstance(input.eventInstance.id, input.eventInstance.eventTypeId);
  const sponsorModel = getSponsorModelDefinitionForEventType(input.eventInstance.eventTypeId);

  if (!sponsorModel) {
    return {
      plans: [],
      created: [],
      skipped: sponsorshipSetup.commitments.length,
      matchedExistingCollateralCount: 0,
      fallbackCollateralToCreate: [],
      obsoleteActionItems: [],
      obsoleteCollateralItems: []
    };
  }

  const opportunityById = new Map(
    sponsorshipSetup.opportunities.map((opportunity) => [opportunity.id, opportunity] as const)
  );
  const seenCommitmentKeys = new Set<string>();
  const plannedFallbackCollateralKeys = new Set<string>();
  const plans: SponsorFulfillmentGenerationPlan[] = [];
  const created: NewActionItemInput[] = [];
  let skipped = 0;
  let matchedExistingCollateralCount = 0;
  const fallbackCollateralToCreate: SponsorFallbackCollateralPlan[] = [];
  const activeSourceKeys = new Set<string>();
  const activeFallbackSourceKeys = new Set<string>();

  for (const commitment of sponsorshipSetup.commitments) {
    const normalizedSponsorName = commitment.sponsorName.trim();
    const opportunity = opportunityById.get(commitment.opportunityId) ?? null;

    if (!opportunity || opportunity.isActive === false || commitment.isActive === false || !normalizedSponsorName) {
      skipped += 1;
      continue;
    }

    const commitmentKey = serializeSponsorCommitmentKey(commitment, opportunity);
    if (seenCommitmentKeys.has(commitmentKey)) {
      skipped += 1;
      continue;
    }

    seenCommitmentKeys.add(commitmentKey);

    const deliverables = getSponsorPlacementDeliverables(opportunity.placementType, input.eventInstance.eventTypeId);
    if (deliverables.length === 0) {
      skipped += 1;
      continue;
    }

    for (const deliverable of deliverables) {
      const sourceKey = getSponsorFulfillmentSourceKey(commitment, opportunity, deliverable.deliverableName);
      activeSourceKeys.add(sourceKey);
      const collateralPlan = buildSponsorCollateralPlan({
        commitment,
        opportunity,
        deliverable,
        eventInstance: input.eventInstance,
        defaultOwner: input.defaultOwner,
        eventSubEvents: input.eventSubEvents ?? [],
        existingCollateralItems: input.existingCollateralItems ?? [],
        plannedFallbackCollateralKeys
      });
      const generatedTask = createSponsorFulfillmentTask({
        commitment,
        opportunity,
        deliverable,
        eventInstance: input.eventInstance,
        defaultOwner: input.defaultOwner,
        eventSubEvents: input.eventSubEvents ?? [],
        collateralLink: collateralPlan?.collateralLink ?? null
      });
      const existingActionItem =
        input.existingItems.find((item) =>
          matchesSponsorFulfillmentTask(item, generatedTask, commitment, opportunity, deliverable, input.eventInstance)
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
        activeFallbackSourceKeys.add(collateralPlan.fallbackCollateral.sourceKey);
        fallbackCollateralToCreate.push(collateralPlan.fallbackCollateral);
      }
    }
  }

  const retainedExistingActionIds = new Set(
    plans
      .map((plan) => plan.existingActionItemId)
      .filter((existingActionItemId): existingActionItemId is string => typeof existingActionItemId === "string")
  );
  const obsoleteActionItems = input.existingItems
    .filter((item) => item.eventInstanceId === input.eventInstance.id)
    .reduce<SponsorGeneratedWorkReviewRecord[]>((records, item) => {
      if (retainedExistingActionIds.has(item.id)) {
        return records;
      }

      const parsedSource = parseSponsorFulfillmentSourceFromNoteEntries(item.noteEntries);
      if (!parsedSource) {
        return records;
      }

      const normalizedSourceKey = getNormalizedParsedSponsorSourceKey(parsedSource);
      if (normalizedSourceKey && activeSourceKeys.has(normalizedSourceKey)) {
        return records;
      }

      records.push({
        id: item.id,
        sourceKey: normalizedSourceKey ?? parsedSource.rawSourceKey,
        hasMeaningfulProgress: hasMeaningfulActionProgress(item)
      });
      return records;
    }, []);
  const obsoleteCollateralItems = (input.existingCollateralItems ?? []).reduce<SponsorGeneratedWorkReviewRecord[]>(
    (records, item) => {
      if (item.eventInstanceId !== input.eventInstance.id) {
        return records;
      }

      const parsedSource = parseSponsorFulfillmentSourceFromNoteEntries(item.noteEntries);
      if (!parsedSource) {
        return records;
      }

      const normalizedSourceKey = getNormalizedParsedSponsorSourceKey(parsedSource);
      if (normalizedSourceKey && activeFallbackSourceKeys.has(normalizedSourceKey)) {
        return records;
      }

      records.push({
        id: item.id,
        sourceKey: normalizedSourceKey ?? parsedSource.rawSourceKey,
        hasMeaningfulProgress: hasMeaningfulCollateralProgress(item)
      });
      return records;
    },
    []
  );

  return {
    plans,
    created,
    skipped,
    matchedExistingCollateralCount,
    fallbackCollateralToCreate,
    obsoleteActionItems,
    obsoleteCollateralItems
  };
}

function createSponsorFulfillmentTask(input: {
  commitment: SponsorCommitment;
  opportunity: SponsorOpportunity;
  deliverable: SponsorDeliverableRule;
  eventInstance: EventInstance;
  defaultOwner: string;
  eventSubEvents: EventSubEvent[];
  collateralLink: SponsorCollateralLink | null;
}): NewActionItemInput {
  const title = getSponsorFulfillmentTaskTitle({
    sponsorName: input.commitment.sponsorName.trim(),
    deliverableName: input.deliverable.deliverableName
  });
  const sourceKey = getSponsorFulfillmentSourceKey(
    input.commitment,
    input.opportunity,
    input.deliverable.deliverableName
  );
  const noteParts = [
    `Generated from sponsor setup for ${input.eventInstance.name}.`,
    `Sponsor radar source: ${sourceKey}.`,
    `Opportunity: ${input.opportunity.label}.`,
    `Placement: ${getSponsorPlacementLabel(input.opportunity.placementType, input.eventInstance.eventTypeId)}.`,
    input.collateralLink ? `Sponsor collateral link: ${serializeSponsorCollateralLink(input.collateralLink)}.` : "",
    !input.commitment.logoReceived && input.deliverable.requiresLogo ? "Waiting on sponsor logo." : "",
    input.deliverable.requiresCopy ? "This deliverable also needs sponsor copy or approval." : "",
    input.commitment.notes?.trim() ?? "",
    input.opportunity.notes?.trim() ?? ""
  ].filter(Boolean);
  const initialNote = createActionNoteEntry(noteParts.join(" "), {
    author: LOCAL_FALLBACK_NOTE_AUTHOR
  });
  const effectiveLinkedSubEventId = input.commitment.linkedSubEventId ?? input.opportunity.linkedSubEventId;
  const dueDate = resolveSponsorDeliverableDueDate(
    input.deliverable,
    input.eventInstance,
    input.eventSubEvents,
    effectiveLinkedSubEventId
  );
  const issue = input.deliverable.issue ?? getIssueForSponsorDeliverable(input.deliverable, input.eventInstance);
  const eventTypeLabel =
    getEventTypeDefinitions().find((definition) => definition.key === input.eventInstance.eventTypeId)?.label ??
    input.eventInstance.eventTypeId;

  return {
    type: "Deliverable",
    title,
    workstream: eventTypeLabel,
    eventInstanceId: input.eventInstance.id,
    operationalBucket: undefined,
    issue,
    dueDate,
    owner: input.defaultOwner,
    status: !input.commitment.logoReceived && input.deliverable.requiresLogo ? "Waiting" : "Not Started",
    waitingOn: !input.commitment.logoReceived && input.deliverable.requiresLogo ? "Sponsor logo" : "",
    isBlocked: undefined,
    blockedBy: "",
    noteEntries: initialNote ? [initialNote] : []
  };
}

function matchesSponsorFulfillmentTask(
  item: ActionItem,
  generatedTask: NewActionItemInput,
  commitment: SponsorCommitment,
  opportunity: SponsorOpportunity,
  deliverable: SponsorDeliverableRule,
  eventInstance: EventInstance
) {
  const sourceKey = getSponsorFulfillmentSourceKey(commitment, opportunity, deliverable.deliverableName);
  const hasExactSourceMarker = item.noteEntries.some((entry) => entry.text.includes(`Sponsor radar source: ${sourceKey}.`));
  const matchesLegacyGeneratedShape =
    item.workstream === generatedTask.workstream &&
    item.eventInstanceId === commitment.eventInstanceId &&
    item.title.trim() === generatedTask.title.trim() &&
    item.noteEntries.some((entry) => entry.text.includes(`Generated from sponsor setup for ${eventInstance.name}.`));

  return hasExactSourceMarker || matchesLegacyGeneratedShape;
}

function getSponsorFulfillmentSourceKey(
  commitment: SponsorCommitment,
  opportunity: SponsorOpportunity,
  deliverableName: string
) {
  return JSON.stringify({
    eventInstanceId: commitment.eventInstanceId,
    sponsorName: commitment.sponsorName.trim().toLowerCase(),
    opportunityId: opportunity.id,
    placementType: opportunity.placementType,
    deliverableName,
    linkedSubEventId: commitment.linkedSubEventId ?? opportunity.linkedSubEventId ?? null
  });
}

function serializeSponsorCommitmentKey(commitment: SponsorCommitment, opportunity: SponsorOpportunity) {
  return JSON.stringify({
    eventInstanceId: commitment.eventInstanceId,
    sponsorName: commitment.sponsorName.trim().toLowerCase(),
    opportunityId: commitment.opportunityId,
    placementType: opportunity.placementType,
    linkedSubEventId: commitment.linkedSubEventId ?? opportunity.linkedSubEventId ?? null
  });
}

function normalizeSponsorOpportunityDeliverables(
  value: unknown
): SponsorOpportunityDeliverable[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeSponsorOpportunityDeliverable(entry))
    .filter((entry): entry is SponsorOpportunityDeliverable => entry !== null);
}

function normalizeSponsorOpportunityDeliverable(
  value: unknown
): SponsorOpportunityDeliverable | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entry = value as Partial<SponsorOpportunityDeliverable>;

  return {
    id:
      typeof entry.id === "string" && entry.id.trim().length > 0
        ? entry.id
        : `deliverable-${Math.random().toString(36).slice(2, 8)}`,
    deliverableName: typeof entry.deliverableName === "string" ? entry.deliverableName : "",
    category: typeof entry.category === "string" ? entry.category : "",
    channel: typeof entry.channel === "string" ? entry.channel : "",
    timingType: typeof entry.timingType === "string" ? entry.timingType : "",
    offsetDays:
      typeof entry.offsetDays === "string"
        ? entry.offsetDays
        : typeof entry.offsetDays === "number"
          ? String(entry.offsetDays)
          : "",
    fixedMonth:
      typeof entry.fixedMonth === "string"
        ? entry.fixedMonth
        : typeof entry.fixedMonth === "number"
          ? String(entry.fixedMonth)
          : "",
    eventDayOffset:
      typeof entry.eventDayOffset === "string"
        ? entry.eventDayOffset
        : typeof entry.eventDayOffset === "number"
          ? String(entry.eventDayOffset)
          : "",
    requiresLogo: entry.requiresLogo === true,
    requiresCopy: entry.requiresCopy === true,
    requiresApproval: entry.requiresApproval === true
  };
}

function parseSponsorFulfillmentSourceFromItem(item: ActionItem) {
  return parseSponsorFulfillmentSourceFromNoteEntries(item.noteEntries);
}

function parseSponsorFulfillmentSourceFromNoteEntries(noteEntries: Array<{ text: string }>) {
  const marker = noteEntries.find((entry) => entry.text.includes("Sponsor radar source: "));

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
      opportunityId?: unknown;
      placement?: unknown;
      placementType?: unknown;
      deliverableName?: unknown;
      linkedSubEventId?: unknown;
    };

    if (
      typeof parsed.eventInstanceId !== "string" ||
      typeof parsed.sponsorName !== "string" ||
      typeof parsed.deliverableName !== "string"
    ) {
      return null;
    }

    const placementType =
      typeof parsed.placementType === "string"
        ? parsed.placementType
        : typeof parsed.placement === "string"
          ? parsed.placement
          : null;

    if (!placementType) {
      return null;
    }

    return {
      rawSourceKey: match[1] ?? "",
      eventInstanceId: parsed.eventInstanceId,
      sponsorName: parsed.sponsorName,
      opportunityId: typeof parsed.opportunityId === "string" ? parsed.opportunityId : undefined,
      placementType,
      deliverableName: parsed.deliverableName,
      linkedSubEventId: typeof parsed.linkedSubEventId === "string" ? parsed.linkedSubEventId : undefined
    };
  } catch {
    return null;
  }
}

function getNormalizedParsedSponsorSourceKey(parsedSource: {
  eventInstanceId: string;
  sponsorName: string;
  opportunityId?: string;
  placementType: string;
  deliverableName: string;
  linkedSubEventId?: string;
}) {
  return parsedSource.opportunityId
    ? JSON.stringify({
        eventInstanceId: parsedSource.eventInstanceId,
        sponsorName: parsedSource.sponsorName.trim().toLowerCase(),
        opportunityId: parsedSource.opportunityId,
        placementType: parsedSource.placementType,
        deliverableName: parsedSource.deliverableName,
        linkedSubEventId: parsedSource.linkedSubEventId ?? null
      })
    : null;
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
  commitment: SponsorCommitment;
  opportunity: SponsorOpportunity;
  deliverable: SponsorDeliverableRule;
  eventInstance: EventInstance;
  defaultOwner: string;
  eventSubEvents: EventSubEvent[];
  existingCollateralItems: CollateralItem[];
  plannedFallbackCollateralKeys: Set<string>;
}) {
  const promotionRule = getSponsorCollateralPromotionRule(
    input.opportunity.placementType,
    input.deliverable.deliverableName
  );

  if (!promotionRule) {
    return null;
  }

  const target = resolveSponsorCollateralTarget({
    eventInstanceId: input.eventInstance.id,
    placementLinkedSubEventId: input.commitment.linkedSubEventId ?? input.opportunity.linkedSubEventId,
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
    sourceKey: getSponsorFulfillmentSourceKey(
      input.commitment,
      input.opportunity,
      input.deliverable.deliverableName
    ),
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
        input.commitment.linkedSubEventId ?? input.opportunity.linkedSubEventId
      ),
      printer: "",
      quantity: "",
      updateType: "Net New",
      noteEntries: buildFallbackCollateralNotes(input.commitment, input.opportunity, input.deliverable, input.eventInstance)
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
  commitment: SponsorCommitment,
  opportunity: SponsorOpportunity,
  deliverable: SponsorDeliverableRule,
  eventInstance: EventInstance
) {
  const sourceKey = getSponsorFulfillmentSourceKey(commitment, opportunity, deliverable.deliverableName);
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

export function upsertSponsorFulfillmentSourceNoteEntries(
  noteEntries: ActionItem["noteEntries"],
  sourceKey: string
) {
  const marker = `Sponsor radar source: ${sourceKey}.`;
  const withoutExistingMarkers = noteEntries.filter((entry) => !entry.text.includes("Sponsor radar source: "));

  if (withoutExistingMarkers.length !== noteEntries.length) {
    const existingCurrentMarker = noteEntries.find((entry) => entry.text.includes(marker)) ?? null;

    if (existingCurrentMarker) {
      return [existingCurrentMarker, ...withoutExistingMarkers.filter((entry) => entry.id !== existingCurrentMarker.id)];
    }
  } else if (noteEntries.some((entry) => entry.text.includes(marker))) {
    return noteEntries;
  }

  const nextEntry = createActionNoteEntry(marker, {
    author: LOCAL_FALLBACK_NOTE_AUTHOR
  });

  return nextEntry ? [nextEntry, ...withoutExistingMarkers] : withoutExistingMarkers;
}

export function appendSponsorGeneratedWorkReviewNoteEntries(
  noteEntries: ActionItem["noteEntries"],
  sourceKey: string
) {
  const marker = `Sponsor setup review: generated source ${sourceKey} no longer matches current sponsorship setup. Keep if still needed, or archive/update manually.`;

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

export function getSponsorFulfillmentSourceFromActionItem(item: Pick<ActionItem, "noteEntries">) {
  return parseSponsorFulfillmentSourceFromNoteEntries(item.noteEntries);
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

function hasMeaningfulActionProgress(item: Pick<ActionItem, "status" | "archivedAt" | "noteEntries">) {
  if (item.archivedAt) {
    return true;
  }

  if (item.status !== "Not Started" && item.status !== "Waiting") {
    return true;
  }

  return item.noteEntries.some(
    (entry) =>
      !entry.text.includes("Generated from sponsor setup for ") &&
      !entry.text.includes("Sponsor radar source: ") &&
      !entry.text.includes("Sponsor collateral link: ") &&
      !entry.text.includes("Sponsor setup review: ")
  );
}

function hasMeaningfulCollateralProgress(item: Pick<CollateralItem, "status" | "archivedAt" | "noteEntries">) {
  if (item.archivedAt) {
    return true;
  }

  if (item.status !== "Backlog" && item.status !== "Waiting") {
    return true;
  }

  return item.noteEntries.some(
    (entry) =>
      !entry.text.includes("Generated as fallback collateral for sponsor setup on ") &&
      !entry.text.includes("Sponsor radar source: ") &&
      !entry.text.includes("Sponsor setup review: ")
  );
}

function resolveOpportunityId(
  value: Partial<SponsorCommitment> & { placement?: string; placementType?: string; placementId?: string },
  opportunities: SponsorOpportunity[]
) {
  if (typeof value.opportunityId === "string" && opportunities.some((opportunity) => opportunity.id === value.opportunityId)) {
    return value.opportunityId;
  }

  const placementType =
    typeof value.placementType === "string"
      ? value.placementType
      : typeof value.placement === "string"
        ? value.placement
        : typeof value.placementId === "string"
          ? value.placementId
          : undefined;

  if (!placementType) {
    return null;
  }

  return opportunities.find((opportunity) => opportunity.placementType === placementType)?.id ?? null;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
