import type { NewActionItemInput } from "@/lib/action-item-mutations";
import { getUnassignedSubEventId, type EventInstance, type EventSubEvent } from "@/lib/event-instances";
import { createActionNoteEntry, getIssueDueDate, LOCAL_FALLBACK_NOTE_AUTHOR } from "@/lib/ops-utils";
import type { ActionItem } from "@/lib/sample-data";

export const SPONSOR_SUPPORTED_EVENT_TYPE_ID = "legislative-day";

export const SPONSOR_PLACEMENT_OPTIONS = [
  { id: "Premier", label: "Premier" },
  { id: "Thursday Briefing Breakfast", label: "Thursday Briefing Breakfast" },
  { id: "Legislative Luncheon", label: "Legislative Luncheon" },
  { id: "Wed Night Reception", label: "Wed Night Reception" },
  { id: "Committee Breakfast", label: "Committee Breakfast" },
  { id: "Board Meeting", label: "Board Meeting" },
  { id: "Golf Bag", label: "Golf Bag" },
  { id: "Golf Hole", label: "Golf Hole" }
] as const;

type SponsorTimingType = "Pre_Event" | "Event_Day" | "Post_Event" | "Fixed_Month";

type SponsorDeliverableRule = {
  deliverableName: string;
  timingType: SponsorTimingType;
  offsetDays?: number;
  fixedMonth?: number;
  requiresLogo: boolean;
  requiresCopy: boolean;
  issue?: string;
};

export type SponsorPlacementType = (typeof SPONSOR_PLACEMENT_OPTIONS)[number]["id"];

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

const NEWS_BRIEF_MONTH_NAMES = {
  3: "March",
  4: "April"
} as const;

const SPONSOR_DELIVERABLE_RULES: Record<SponsorPlacementType, SponsorDeliverableRule[]> = {
  Premier: [
    createRule("Spotlight Post 1", "Pre_Event", { offsetDays: 45, requiresLogo: true, requiresCopy: true }),
    createRule("Spotlight Post 2", "Pre_Event", { offsetDays: 30, requiresLogo: true, requiresCopy: true }),
    createRule("CAPMA Event Post Mention 1", "Pre_Event", { offsetDays: 21, requiresLogo: true, requiresCopy: false }),
    createRule("CAPMA Event Post Mention 2", "Pre_Event", { offsetDays: 10, requiresLogo: true, requiresCopy: false }),
    createRule("March NewsBrief Recognition", "Fixed_Month", { fixedMonth: 3, requiresLogo: true, requiresCopy: false }),
    createRule("April NewsBrief Recognition", "Fixed_Month", { fixedMonth: 4, requiresLogo: true, requiresCopy: false }),
    createRule("April NewsBrief Digital Advertorial", "Fixed_Month", { fixedMonth: 4, requiresLogo: true, requiresCopy: true }),
    createRule("Logo on Registration Page", "Pre_Event", { offsetDays: 60, requiresLogo: true, requiresCopy: false }),
    createRule("Logo in Registration Confirmation Emails", "Pre_Event", { offsetDays: 45, requiresLogo: true, requiresCopy: false }),
    createRule("Logo in Registration Reminder Emails", "Pre_Event", { offsetDays: 30, requiresLogo: true, requiresCopy: false }),
    createRule("Slide Deck Logo", "Event_Day", { offsetDays: 0, requiresLogo: true, requiresCopy: false }),
    createRule("Event Badge + Lanyard Logo", "Event_Day", { offsetDays: 0, requiresLogo: true, requiresCopy: false }),
    createRule("Verbal Recognition During Program", "Event_Day", { offsetDays: 0, requiresLogo: false, requiresCopy: false }),
    createRule("Includes 10 Attendee Registrations", "Event_Day", { offsetDays: 0, requiresLogo: false, requiresCopy: false }),
    createRule("Sponsor Thank-You Roundup Post", "Post_Event", { offsetDays: 3, requiresLogo: true, requiresCopy: false }),
    createRule("Logo in Post-Event Recap Email", "Post_Event", { offsetDays: 5, requiresLogo: true, requiresCopy: false })
  ],
  "Thursday Briefing Breakfast": [
    createRule("Spotlight Post", "Pre_Event", { offsetDays: 30, requiresLogo: true, requiresCopy: true }),
    createRule("CAPMA Event Post Mention", "Pre_Event", { offsetDays: 14, requiresLogo: true, requiresCopy: false }),
    createRule("Acknowledgement in Outgoing Emails", "Pre_Event", { offsetDays: 14, requiresLogo: true, requiresCopy: false }),
    createRule("March NewsBrief Recognition", "Fixed_Month", { fixedMonth: 3, requiresLogo: true, requiresCopy: false }),
    createRule("April NewsBrief Recognition", "Fixed_Month", { fixedMonth: 4, requiresLogo: true, requiresCopy: false }),
    createRule("Logo in Post-Event Recap Email", "Post_Event", { offsetDays: 5, requiresLogo: true, requiresCopy: false }),
    createRule("Sponsor Thank-You Roundup Post", "Post_Event", { offsetDays: 3, requiresLogo: true, requiresCopy: false }),
    createRule("Speaking Opportunity", "Event_Day", { offsetDays: 0, requiresLogo: false, requiresCopy: false }),
    createRule("Table Tents Displayed", "Event_Day", { offsetDays: 0, requiresLogo: true, requiresCopy: false }),
    createRule("On-Site Signage (Digital or Print)", "Event_Day", { offsetDays: 0, requiresLogo: true, requiresCopy: false }),
    createRule("Branded To-Go Coffee Cups", "Event_Day", { offsetDays: 0, requiresLogo: true, requiresCopy: false }),
    createRule("Includes 4 Attendee Registrations", "Event_Day", { offsetDays: 0, requiresLogo: false, requiresCopy: false })
  ],
  "Legislative Luncheon": [
    createRule("Sponsor Spotlight Post", "Pre_Event", { offsetDays: 21, requiresLogo: true, requiresCopy: true }),
    createRule("CAPMA Event Post Mention", "Pre_Event", { offsetDays: 14, requiresLogo: true, requiresCopy: false }),
    createRule("March NewsBrief Recognition", "Fixed_Month", { fixedMonth: 3, requiresLogo: true, requiresCopy: false }),
    createRule("April NewsBrief Recognition", "Fixed_Month", { fixedMonth: 4, requiresLogo: true, requiresCopy: false }),
    createRule("Table Tents on Tables", "Event_Day", { offsetDays: 0, requiresLogo: true, requiresCopy: false }),
    createRule("Exterior Signage", "Event_Day", { offsetDays: 0, requiresLogo: true, requiresCopy: false }),
    createRule("Branded Napkins", "Event_Day", { offsetDays: 0, requiresLogo: true, requiresCopy: false }),
    createRule("On-Site Signage Recognition", "Event_Day", { offsetDays: 0, requiresLogo: true, requiresCopy: false }),
    createRule("2-Minute Speaking Opportunity", "Event_Day", { offsetDays: 0, requiresLogo: false, requiresCopy: true }),
    createRule("Includes 5 Attendee Registrations", "Event_Day", { offsetDays: 0, requiresLogo: false, requiresCopy: false }),
    createRule("Logo in Sponsor Thank-You Roundup", "Post_Event", { offsetDays: 3, requiresLogo: true, requiresCopy: false }),
    createRule("Logo in Post-Event Recap Email", "Post_Event", { offsetDays: 5, requiresLogo: true, requiresCopy: false })
  ],
  "Wed Night Reception": [
    createRule("CAPMA Event Post Mention", "Pre_Event", { offsetDays: 14, requiresLogo: true, requiresCopy: false }),
    createRule("Exterior Signage", "Event_Day", { offsetDays: 0, requiresLogo: true, requiresCopy: false }),
    createRule("Branded Napkins", "Event_Day", { offsetDays: 0, requiresLogo: true, requiresCopy: false }),
    createRule("On-Site Signage Recognition", "Event_Day", { offsetDays: 0, requiresLogo: true, requiresCopy: false }),
    createRule("Table Tents on Tables", "Event_Day", { offsetDays: 0, requiresLogo: true, requiresCopy: false }),
    createRule("2-Minute Speaking Opportunity", "Event_Day", { offsetDays: 0, requiresLogo: false, requiresCopy: true }),
    createRule("Includes 2 Attendee Registrations", "Event_Day", { offsetDays: 0, requiresLogo: false, requiresCopy: false }),
    createRule("Logo in Sponsor Thank-You Roundup", "Post_Event", { offsetDays: 3, requiresLogo: true, requiresCopy: false }),
    createRule("Logo in Post-Event Recap Email", "Post_Event", { offsetDays: 5, requiresLogo: true, requiresCopy: false }),
    createRule("March NewsBrief Recognition", "Fixed_Month", { fixedMonth: 3, requiresLogo: false, requiresCopy: false })
  ],
  "Committee Breakfast": [
    createRule("March NewsBrief Recognition", "Fixed_Month", { fixedMonth: 3, requiresLogo: true, requiresCopy: false }),
    createRule("April NewsBrief Recognition", "Fixed_Month", { fixedMonth: 4, requiresLogo: true, requiresCopy: false }),
    createRule("Table Tents on or Near Buffet", "Event_Day", { offsetDays: 0, requiresLogo: true, requiresCopy: false }),
    createRule("On-Site Signage", "Event_Day", { offsetDays: 0, requiresLogo: true, requiresCopy: false }),
    createRule("Includes 1 Attendee Registration", "Pre_Event", { offsetDays: 0, requiresLogo: false, requiresCopy: false }),
    createRule("Sponsor Thank-You Roundup Post", "Post_Event", { offsetDays: 3, requiresLogo: true, requiresCopy: false }),
    createRule("Logo in Post-Event Recap Email", "Post_Event", { offsetDays: 5, requiresLogo: false, requiresCopy: false })
  ],
  "Board Meeting": [
    createRule("Acknowledgement on Digital or Printed Signage", "Event_Day", { offsetDays: 0, requiresLogo: true, requiresCopy: false }),
    createRule("Includes 1 Attendee Registration", "Event_Day", { offsetDays: 0, requiresLogo: false, requiresCopy: false }),
    createRule("Logo in Sponsor Thank-You Roundup", "Post_Event", { offsetDays: 3, requiresLogo: true, requiresCopy: false }),
    createRule("Logo in Post-Event Recap Email", "Post_Event", { offsetDays: 5, requiresLogo: true, requiresCopy: false })
  ],
  "Golf Bag": [
    createRule("Branded Water & Snacks", "Event_Day", { offsetDays: 0, requiresLogo: true, requiresCopy: false }),
    createRule("Logo in Sponsor Thank-You Roundup", "Post_Event", { offsetDays: 3, requiresLogo: true, requiresCopy: false })
  ],
  "Golf Hole": [
    createRule("Branded Signage at Hole", "Event_Day", { offsetDays: 0, requiresLogo: true, requiresCopy: false }),
    createRule("Logo in Sponsor Thank-You Roundup", "Post_Event", { offsetDays: 3, requiresLogo: true, requiresCopy: false })
  ]
};

const SPONSOR_COLLATERAL_PROMOTION_RULES: Array<{
  placement: SponsorPlacementType;
  deliverableName: string;
  collateralItemName: string;
  preferredSubEventName?: string;
}> = [
  {
    placement: "Premier",
    deliverableName: "Slide Deck Logo",
    collateralItemName: "Master Slide Deck",
    preferredSubEventName: "Multi-Event/All Days"
  },
  {
    placement: "Premier",
    deliverableName: "Event Badge + Lanyard Logo",
    collateralItemName: "Custom Lanyards w/ CAPMA + Premier logos",
    preferredSubEventName: "Wednesday Registration"
  },
  {
    placement: "Thursday Briefing Breakfast",
    deliverableName: "Table Tents Displayed",
    collateralItemName: "Briefing Breakfast Table Tents",
    preferredSubEventName: "Thursday Breakfast"
  },
  {
    placement: "Thursday Briefing Breakfast",
    deliverableName: "On-Site Signage (Digital or Print)",
    collateralItemName: "Welcome to the Briefing Breakfast (Sponsored By Sign)",
    preferredSubEventName: "Thursday Breakfast"
  },
  {
    placement: "Thursday Briefing Breakfast",
    deliverableName: "Branded To-Go Coffee Cups",
    collateralItemName: "Branded coffee cups with CAPMA and Sponsor",
    preferredSubEventName: "Thursday Breakfast"
  },
  {
    placement: "Legislative Luncheon",
    deliverableName: "Table Tents on Tables",
    collateralItemName: "Table tents",
    preferredSubEventName: "Thursday Luncheon"
  },
  {
    placement: "Legislative Luncheon",
    deliverableName: "Exterior Signage",
    collateralItemName: "Welcome to Legislative Luncheon - Sponsor thank you",
    preferredSubEventName: "Thursday Luncheon"
  },
  {
    placement: "Legislative Luncheon",
    deliverableName: "Branded Napkins",
    collateralItemName: "Branded napkins for Thurs afternoon, year specific",
    preferredSubEventName: "Thursday Luncheon"
  },
  {
    placement: "Wed Night Reception",
    deliverableName: "Table Tents on Tables",
    collateralItemName: "Table Tents for Wednesday Night Reception",
    preferredSubEventName: "Wed Night Reception"
  },
  {
    placement: "Wed Night Reception",
    deliverableName: "Exterior Signage",
    collateralItemName: "Wed Night Reception Sponsor Signage",
    preferredSubEventName: "Wed Night Reception"
  },
  {
    placement: "Wed Night Reception",
    deliverableName: "Branded Napkins",
    collateralItemName: "Branded napkins for Wednesday Night Reception",
    preferredSubEventName: "Wed Night Reception"
  },
  {
    placement: "Committee Breakfast",
    deliverableName: "Table Tents on or Near Buffet",
    collateralItemName: "Table Tents for Committee Breakfast",
    preferredSubEventName: "Wednesday Breakfast"
  },
  {
    placement: "Committee Breakfast",
    deliverableName: "On-Site Signage",
    collateralItemName: "Welcome and Thank You Sign for Committee Breakfast Sponsors (All on One)",
    preferredSubEventName: "Wednesday Breakfast"
  },
  {
    placement: "Board Meeting",
    deliverableName: "Acknowledgement on Digital or Printed Signage",
    collateralItemName: "Board Room Signage",
    preferredSubEventName: "Wednesday Board Meeting"
  },
  {
    placement: "Golf Hole",
    deliverableName: "Branded Signage at Hole",
    collateralItemName: "Golf Hole Signs",
    preferredSubEventName: "Golf Tournament"
  }
];

export function supportsSponsorSetupForEventType(eventTypeId: string) {
  return eventTypeId === SPONSOR_SUPPORTED_EVENT_TYPE_ID;
}

export function createSponsorPlacementDraft(eventInstanceId: string): SponsorPlacement {
  return {
    id: `sponsor-placement-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    eventInstanceId,
    sponsorName: "",
    placement: SPONSOR_PLACEMENT_OPTIONS[0].id,
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

  if (!input.eventInstances.some((instance) => instance.id === value.eventInstanceId)) {
    return null;
  }

  if (!isSponsorPlacementType(placementValue)) {
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

export function getSponsorPlacementLabel(type: SponsorPlacementType) {
  return SPONSOR_PLACEMENT_OPTIONS.find((option) => option.id === type)?.label ?? "Sponsor placement";
}

export function getSponsorPlacementDeliverables(placement: SponsorPlacementType) {
  return SPONSOR_DELIVERABLE_RULES[placement] ?? [];
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

  const rule = SPONSOR_COLLATERAL_PROMOTION_RULES.find(
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
}): SponsorFulfillmentGenerationResult {
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

    const deliverables = getSponsorPlacementDeliverables(placement.placement);
    if (deliverables.length === 0) {
      skipped += 1;
      continue;
    }

    for (const deliverable of deliverables) {
      const generatedTask = createSponsorFulfillmentTask({
        placement,
        deliverable,
        eventInstance: input.eventInstance,
        defaultOwner: input.defaultOwner
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
}): NewActionItemInput {
  const title = getSponsorFulfillmentTaskTitle({
    sponsorName: input.placement.sponsorName.trim(),
    deliverableName: input.deliverable.deliverableName
  });
  const sourceKey = getSponsorFulfillmentSourceKey(input.placement, input.deliverable.deliverableName);
  const noteParts = [
    `Generated from sponsor setup for ${input.eventInstance.name}.`,
    `Sponsor radar source: ${sourceKey}.`,
    `Placement: ${getSponsorPlacementLabel(input.placement.placement)}.`,
    !input.placement.logoReceived && input.deliverable.requiresLogo ? "Waiting on sponsor logo." : "",
    input.deliverable.requiresCopy ? "This deliverable also needs sponsor copy or approval." : "",
    input.placement.notes?.trim() ?? ""
  ].filter(Boolean);
  const initialNote = createActionNoteEntry(noteParts.join(" "), {
    author: LOCAL_FALLBACK_NOTE_AUTHOR
  });
  const dueDate = resolveSponsorDeliverableDueDate(input.deliverable, input.eventInstance);
  const issue = input.deliverable.issue ?? getIssueForSponsorDeliverable(input.deliverable, input.eventInstance);

  return {
    type: "Deliverable",
    title,
    workstream: "Legislative Day",
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
      typeof parsed.deliverableName !== "string" ||
      !isSponsorPlacementType(parsed.placement)
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

function resolveSponsorDeliverableDueDate(deliverable: SponsorDeliverableRule, eventInstance: EventInstance) {
  if (deliverable.timingType === "Pre_Event") {
    return shiftIsoDate(eventInstance.startDate, -(deliverable.offsetDays ?? 0));
  }

  if (deliverable.timingType === "Event_Day") {
    return shiftIsoDate(eventInstance.startDate, deliverable.offsetDays ?? 0);
  }

  if (deliverable.timingType === "Post_Event") {
    return shiftIsoDate(eventInstance.endDate || eventInstance.startDate, deliverable.offsetDays ?? 0);
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

function isSponsorPlacementType(value: string): value is SponsorPlacementType {
  return SPONSOR_PLACEMENT_OPTIONS.some((option) => option.id === value);
}

function createRule(
  deliverableName: string,
  timingType: SponsorTimingType,
  config: {
    offsetDays?: number;
    fixedMonth?: number;
    requiresLogo: boolean;
    requiresCopy: boolean;
    issue?: string;
  }
): SponsorDeliverableRule {
  return {
    deliverableName,
    timingType,
    offsetDays: config.offsetDays,
    fixedMonth: config.fixedMonth,
    requiresLogo: config.requiresLogo,
    requiresCopy: config.requiresCopy,
    issue: config.issue
  };
}
