import {
  deriveEventDateRange,
  type EventDateMode,
  type EventType,
  type EventInstance,
  type EventSubEvent
} from "@/lib/event-instances";

export type SponsorTimingType = "Pre_Event" | "Event_Day" | "Post_Event" | "Fixed_Month" | "Sub_Event";

export type SponsorDeliverableRule = {
  deliverableName: string;
  timingType: SponsorTimingType;
  offsetDays?: number;
  fixedMonth?: number;
  subEventName?: string;
  requiresLogo: boolean;
  requiresCopy: boolean;
  issue?: string;
};

export type SponsorPlacementDefinition = {
  id: string;
  label: string;
};

export type SponsorCollateralPromotionRule = {
  placement: string;
  deliverableName: string;
  collateralItemName: string;
  preferredSubEventName?: string;
};

export type SponsorModelDefinition = {
  key: string;
  label: string;
  placements: SponsorPlacementDefinition[];
  deliverableRulesByPlacement: Record<string, SponsorDeliverableRule[]>;
  collateralPromotionRules: SponsorCollateralPromotionRule[];
};

export type EventTypeDefinition = {
  key: string;
  label: string;
  eventFamilyId: string;
  dateMode: EventDateMode;
  description?: string;
  defaultSubEvents: Array<{
    name: string;
    sortOrder: number;
  }>;
  collateralTemplatePackId?: string;
  sponsorModelReference?: string;
  supportsCollateral?: boolean;
  supportsSponsorSetup?: boolean;
  sponsorModel?: SponsorModelDefinition;
};

export type EventInstanceCreationInput = {
  instanceId: string;
  eventTypeId: string;
  instanceName: string;
  dateMode: EventDateMode;
  dates: string[];
  location?: string;
  notes?: string;
};

const LEGISLATIVE_DAY_SPONSOR_MODEL: SponsorModelDefinition = {
  key: "legislative-day-sponsor-radar",
  label: "Legislative Day sponsor radar",
  placements: [
    { id: "Premier", label: "Premier" },
    { id: "Thursday Briefing Breakfast", label: "Thursday Briefing Breakfast" },
    { id: "Legislative Luncheon", label: "Legislative Luncheon" },
    { id: "Wed Night Reception", label: "Wed Night Reception" },
    { id: "Committee Breakfast", label: "Committee Breakfast" },
    { id: "Board Meeting", label: "Board Meeting" },
    { id: "Golf Bag", label: "Golf Bag" },
    { id: "Golf Hole", label: "Golf Hole" }
  ],
  deliverableRulesByPlacement: {
    Premier: [
      createSponsorRule("Spotlight Post 1", "Pre_Event", { offsetDays: 45, requiresLogo: true, requiresCopy: true }),
      createSponsorRule("Spotlight Post 2", "Pre_Event", { offsetDays: 30, requiresLogo: true, requiresCopy: true }),
      createSponsorRule("CAPMA Event Post Mention 1", "Pre_Event", { offsetDays: 21, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("CAPMA Event Post Mention 2", "Pre_Event", { offsetDays: 10, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("March NewsBrief Recognition", "Fixed_Month", { fixedMonth: 3, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("April NewsBrief Recognition", "Fixed_Month", { fixedMonth: 4, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("April NewsBrief Digital Advertorial", "Fixed_Month", { fixedMonth: 4, requiresLogo: true, requiresCopy: true }),
      createSponsorRule("Logo on Registration Page", "Pre_Event", { offsetDays: 60, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("Logo in Registration Confirmation Emails", "Pre_Event", { offsetDays: 45, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("Logo in Registration Reminder Emails", "Pre_Event", { offsetDays: 30, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("Slide Deck Logo", "Event_Day", { requiresLogo: true, requiresCopy: false, subEventName: "Multi-Event/All Days" }),
      createSponsorRule("Event Badge + Lanyard Logo", "Sub_Event", { requiresLogo: true, requiresCopy: false, subEventName: "Wednesday Registration" }),
      createSponsorRule("Verbal Recognition During Program", "Event_Day", { requiresLogo: false, requiresCopy: false }),
      createSponsorRule("Includes 10 Attendee Registrations", "Event_Day", { requiresLogo: false, requiresCopy: false }),
      createSponsorRule("Sponsor Thank-You Roundup Post", "Post_Event", { offsetDays: 3, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("Logo in Post-Event Recap Email", "Post_Event", { offsetDays: 5, requiresLogo: true, requiresCopy: false })
    ],
    "Thursday Briefing Breakfast": [
      createSponsorRule("Spotlight Post", "Pre_Event", { offsetDays: 30, requiresLogo: true, requiresCopy: true }),
      createSponsorRule("CAPMA Event Post Mention", "Pre_Event", { offsetDays: 14, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("Acknowledgement in Outgoing Emails", "Pre_Event", { offsetDays: 14, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("March NewsBrief Recognition", "Fixed_Month", { fixedMonth: 3, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("April NewsBrief Recognition", "Fixed_Month", { fixedMonth: 4, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("Logo in Post-Event Recap Email", "Post_Event", { offsetDays: 5, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("Sponsor Thank-You Roundup Post", "Post_Event", { offsetDays: 3, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("Speaking Opportunity", "Sub_Event", { requiresLogo: false, requiresCopy: false, subEventName: "Thursday Breakfast" }),
      createSponsorRule("Table Tents Displayed", "Sub_Event", { requiresLogo: true, requiresCopy: false, subEventName: "Thursday Breakfast" }),
      createSponsorRule("On-Site Signage (Digital or Print)", "Sub_Event", { requiresLogo: true, requiresCopy: false, subEventName: "Thursday Breakfast" }),
      createSponsorRule("Branded To-Go Coffee Cups", "Sub_Event", { requiresLogo: true, requiresCopy: false, subEventName: "Thursday Breakfast" }),
      createSponsorRule("Includes 4 Attendee Registrations", "Event_Day", { requiresLogo: false, requiresCopy: false })
    ],
    "Legislative Luncheon": [
      createSponsorRule("Sponsor Spotlight Post", "Pre_Event", { offsetDays: 21, requiresLogo: true, requiresCopy: true }),
      createSponsorRule("CAPMA Event Post Mention", "Pre_Event", { offsetDays: 14, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("March NewsBrief Recognition", "Fixed_Month", { fixedMonth: 3, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("April NewsBrief Recognition", "Fixed_Month", { fixedMonth: 4, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("Table Tents on Tables", "Sub_Event", { requiresLogo: true, requiresCopy: false, subEventName: "Thursday Luncheon" }),
      createSponsorRule("Exterior Signage", "Sub_Event", { requiresLogo: true, requiresCopy: false, subEventName: "Thursday Luncheon" }),
      createSponsorRule("Branded Napkins", "Sub_Event", { requiresLogo: true, requiresCopy: false, subEventName: "Thursday Luncheon" }),
      createSponsorRule("On-Site Signage Recognition", "Sub_Event", { requiresLogo: true, requiresCopy: false, subEventName: "Thursday Luncheon" }),
      createSponsorRule("2-Minute Speaking Opportunity", "Sub_Event", { requiresLogo: false, requiresCopy: true, subEventName: "Thursday Luncheon" }),
      createSponsorRule("Includes 5 Attendee Registrations", "Event_Day", { requiresLogo: false, requiresCopy: false }),
      createSponsorRule("Logo in Sponsor Thank-You Roundup", "Post_Event", { offsetDays: 3, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("Logo in Post-Event Recap Email", "Post_Event", { offsetDays: 5, requiresLogo: true, requiresCopy: false })
    ],
    "Wed Night Reception": [
      createSponsorRule("CAPMA Event Post Mention", "Pre_Event", { offsetDays: 14, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("Exterior Signage", "Sub_Event", { requiresLogo: true, requiresCopy: false, subEventName: "Wednesday Reception" }),
      createSponsorRule("Branded Napkins", "Sub_Event", { requiresLogo: true, requiresCopy: false, subEventName: "Wednesday Reception" }),
      createSponsorRule("On-Site Signage Recognition", "Sub_Event", { requiresLogo: true, requiresCopy: false, subEventName: "Wednesday Reception" }),
      createSponsorRule("Table Tents on Tables", "Sub_Event", { requiresLogo: true, requiresCopy: false, subEventName: "Wednesday Reception" }),
      createSponsorRule("2-Minute Speaking Opportunity", "Sub_Event", { requiresLogo: false, requiresCopy: true, subEventName: "Wednesday Reception" }),
      createSponsorRule("Includes 2 Attendee Registrations", "Event_Day", { requiresLogo: false, requiresCopy: false }),
      createSponsorRule("Logo in Sponsor Thank-You Roundup", "Post_Event", { offsetDays: 3, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("Logo in Post-Event Recap Email", "Post_Event", { offsetDays: 5, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("March NewsBrief Recognition", "Fixed_Month", { fixedMonth: 3, requiresLogo: false, requiresCopy: false })
    ],
    "Committee Breakfast": [
      createSponsorRule("March NewsBrief Recognition", "Fixed_Month", { fixedMonth: 3, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("April NewsBrief Recognition", "Fixed_Month", { fixedMonth: 4, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("Table Tents on or Near Buffet", "Sub_Event", { requiresLogo: true, requiresCopy: false, subEventName: "Wednesday Breakfast" }),
      createSponsorRule("On-Site Signage", "Sub_Event", { requiresLogo: true, requiresCopy: false, subEventName: "Wednesday Breakfast" }),
      createSponsorRule("Includes 1 Attendee Registration", "Event_Day", { requiresLogo: false, requiresCopy: false }),
      createSponsorRule("Sponsor Thank-You Roundup Post", "Post_Event", { offsetDays: 3, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("Logo in Post-Event Recap Email", "Post_Event", { offsetDays: 5, requiresLogo: false, requiresCopy: false })
    ],
    "Board Meeting": [
      createSponsorRule("Acknowledgement on Digital or Printed Signage", "Sub_Event", { requiresLogo: true, requiresCopy: false, subEventName: "Wednesday Board Meeting" }),
      createSponsorRule("Includes 1 Attendee Registration", "Event_Day", { requiresLogo: false, requiresCopy: false }),
      createSponsorRule("Logo in Sponsor Thank-You Roundup", "Post_Event", { offsetDays: 3, requiresLogo: true, requiresCopy: false }),
      createSponsorRule("Logo in Post-Event Recap Email", "Post_Event", { offsetDays: 5, requiresLogo: true, requiresCopy: false })
    ],
    "Golf Bag": [
      createSponsorRule("Branded Water & Snacks", "Sub_Event", { requiresLogo: true, requiresCopy: false, subEventName: "Golf Tournament" }),
      createSponsorRule("Logo in Sponsor Thank-You Roundup", "Post_Event", { offsetDays: 3, requiresLogo: true, requiresCopy: false })
    ],
    "Golf Hole": [
      createSponsorRule("Branded Signage at Hole", "Sub_Event", { requiresLogo: true, requiresCopy: false, subEventName: "Golf Tournament" }),
      createSponsorRule("Logo in Sponsor Thank-You Roundup", "Post_Event", { offsetDays: 3, requiresLogo: true, requiresCopy: false })
    ]
  },
  collateralPromotionRules: [
    { placement: "Premier", deliverableName: "Slide Deck Logo", collateralItemName: "Master Slide Deck", preferredSubEventName: "Multi-Event/All Days" },
    { placement: "Premier", deliverableName: "Event Badge + Lanyard Logo", collateralItemName: "Custom Lanyards w/ CAPMA + Premier logos", preferredSubEventName: "Wednesday Registration" },
    { placement: "Thursday Briefing Breakfast", deliverableName: "Table Tents Displayed", collateralItemName: "Briefing Breakfast Table Tents", preferredSubEventName: "Thursday Breakfast" },
    { placement: "Thursday Briefing Breakfast", deliverableName: "On-Site Signage (Digital or Print)", collateralItemName: "Welcome to the Briefing Breakfast (Sponsored By Sign)", preferredSubEventName: "Thursday Breakfast" },
    { placement: "Thursday Briefing Breakfast", deliverableName: "Branded To-Go Coffee Cups", collateralItemName: "Branded coffee cups with CAPMA and Sponsor", preferredSubEventName: "Thursday Breakfast" },
    { placement: "Legislative Luncheon", deliverableName: "Table Tents on Tables", collateralItemName: "Table tents", preferredSubEventName: "Thursday Luncheon" },
    { placement: "Legislative Luncheon", deliverableName: "Exterior Signage", collateralItemName: "Welcome to Legislative Luncheon - Sponsor thank you", preferredSubEventName: "Thursday Luncheon" },
    { placement: "Legislative Luncheon", deliverableName: "Branded Napkins", collateralItemName: "Branded napkins for Thurs afternoon, year specific", preferredSubEventName: "Thursday Luncheon" },
    { placement: "Wed Night Reception", deliverableName: "Table Tents on Tables", collateralItemName: "Table Tents for Wednesday Night Reception", preferredSubEventName: "Wednesday Reception" },
    { placement: "Wed Night Reception", deliverableName: "Exterior Signage", collateralItemName: "Wed Night Reception Sponsor Signage", preferredSubEventName: "Wednesday Reception" },
    { placement: "Wed Night Reception", deliverableName: "Branded Napkins", collateralItemName: "Branded napkins for Wednesday Night Reception", preferredSubEventName: "Wednesday Reception" },
    { placement: "Committee Breakfast", deliverableName: "Table Tents on or Near Buffet", collateralItemName: "Table Tents for Committee Breakfast", preferredSubEventName: "Wednesday Breakfast" },
    { placement: "Committee Breakfast", deliverableName: "On-Site Signage", collateralItemName: "Welcome and Thank You Sign for Committee Breakfast Sponsors (All on One)", preferredSubEventName: "Wednesday Breakfast" },
    { placement: "Board Meeting", deliverableName: "Acknowledgement on Digital or Printed Signage", collateralItemName: "Board Room Signage", preferredSubEventName: "Wednesday Board Meeting" },
    { placement: "Golf Hole", deliverableName: "Branded Signage at Hole", collateralItemName: "Golf Hole Signs", preferredSubEventName: "Golf Tournament" }
  ]
};

const EVENT_TYPE_DEFINITIONS: EventTypeDefinition[] = [
  {
    key: "legislative-day",
    label: "Legislative Day",
    eventFamilyId: "legislative-advocacy",
    dateMode: "range",
    description: "Legislative advocacy event with recurring sub-events, sponsor fulfillment, and collateral production needs.",
    collateralTemplatePackId: "legislative-day-core",
    sponsorModelReference: "Legislative Day sponsor radar",
    supportsCollateral: true,
    supportsSponsorSetup: true,
    sponsorModel: LEGISLATIVE_DAY_SPONSOR_MODEL,
    defaultSubEvents: [
      { name: "Golf Reception", sortOrder: 10 },
      { name: "Golf Registration", sortOrder: 20 },
      { name: "Golf Tournament", sortOrder: 30 },
      { name: "Legislative Visits", sortOrder: 40 },
      { name: "Multi-Event/All Days", sortOrder: 50 },
      { name: "Thursday Breakfast", sortOrder: 60 },
      { name: "Thursday Luncheon", sortOrder: 70 },
      { name: "Wednesday Board Meeting", sortOrder: 80 },
      { name: "Wednesday Breakfast", sortOrder: 90 },
      { name: "Wednesday CEUs", sortOrder: 100 },
      { name: "Wednesday Committees", sortOrder: 110 },
      { name: "Wednesday Reception", sortOrder: 120 },
      { name: "Wednesday Registration", sortOrder: 140 }
    ]
  },
  {
    key: "first-friday",
    label: "First Friday",
    eventFamilyId: "recurring-monthly-program",
    dateMode: "single",
    description: "Recurring monthly member program with a lighter event-production footprint.",
    supportsCollateral: false,
    supportsSponsorSetup: false,
    defaultSubEvents: [{ name: "Main Event", sortOrder: 10 }]
  }
];

export function getEventTypeDefinitions() {
  return EVENT_TYPE_DEFINITIONS.map((definition) => ({
    ...definition,
    defaultSubEvents: definition.defaultSubEvents.map((subEvent) => ({ ...subEvent })),
    sponsorModel: definition.sponsorModel
      ? {
          ...definition.sponsorModel,
          placements: definition.sponsorModel.placements.map((placement) => ({ ...placement })),
          deliverableRulesByPlacement: Object.fromEntries(
            Object.entries(definition.sponsorModel.deliverableRulesByPlacement).map(([placement, rules]) => [
              placement,
              rules.map((rule) => ({ ...rule }))
            ])
          ),
          collateralPromotionRules: definition.sponsorModel.collateralPromotionRules.map((rule) => ({ ...rule }))
        }
      : undefined
  }));
}

export function getAvailableEventTypeDefinitions(eventTypes: EventType[]) {
  const availableTypeIds = new Set(eventTypes.map((eventType) => eventType.id));
  return getEventTypeDefinitions().filter((definition) => availableTypeIds.has(definition.key));
}

export function getEventTypeDefinition(eventTypeId: string) {
  const definition = EVENT_TYPE_DEFINITIONS.find((entry) => entry.key === eventTypeId);

  if (!definition) {
    return null;
  }

  return {
    ...definition,
    defaultSubEvents: definition.defaultSubEvents.map((subEvent) => ({ ...subEvent })),
    sponsorModel: definition.sponsorModel
      ? {
          ...definition.sponsorModel,
          placements: definition.sponsorModel.placements.map((placement) => ({ ...placement })),
          deliverableRulesByPlacement: Object.fromEntries(
            Object.entries(definition.sponsorModel.deliverableRulesByPlacement).map(([placement, rules]) => [
              placement,
              rules.map((rule) => ({ ...rule }))
            ])
          ),
          collateralPromotionRules: definition.sponsorModel.collateralPromotionRules.map((rule) => ({ ...rule }))
        }
      : undefined
  } satisfies EventTypeDefinition;
}

export function getSponsorModelDefinitionForEventType(eventTypeId: string) {
  return getEventTypeDefinition(eventTypeId)?.sponsorModel ?? null;
}

export function getDefaultSubEventDefinitionsForEventType(eventTypeId: string) {
  return getEventTypeDefinition(eventTypeId)?.defaultSubEvents ?? [];
}

export function isDefaultSubEventNameForEventType(eventTypeId: string, name: string) {
  return getDefaultSubEventDefinitionsForEventType(eventTypeId).some(
    (subEvent) => subEvent.name === name
  );
}

export function getDefaultDatesForEventDateMode(dateMode: EventDateMode) {
  if (dateMode === "multiple") {
    return [""];
  }

  if (dateMode === "range") {
    return ["", ""];
  }

  return [""];
}

export function validateEventInstanceCreationInput(input: {
  eventTypeId: string;
  instanceName: string;
  dateMode: EventDateMode;
  dates: string[];
}) {
  if (!input.eventTypeId.trim()) {
    return false;
  }

  if (!input.instanceName.trim()) {
    return false;
  }

  const { startDate, endDate } = deriveEventDateRange(input.dateMode, input.dates);
  return Boolean(startDate && endDate);
}

export function createDefaultSubEventsForEventInstance(input: {
  eventTypeId: string;
  eventInstanceId: string;
}) {
  const definition = getEventTypeDefinition(input.eventTypeId);

  if (!definition) {
    return [] satisfies EventSubEvent[];
  }

  return definition.defaultSubEvents.map((subEvent) => ({
    id: `${input.eventInstanceId}-${slugify(subEvent.name)}`,
    eventInstanceId: input.eventInstanceId,
    name: subEvent.name,
    sortOrder: subEvent.sortOrder
  })) satisfies EventSubEvent[];
}

export function buildCreatedEventInstanceState(input: {
  currentEventInstances: EventInstance[];
  currentEventSubEvents: EventSubEvent[];
  creation: EventInstanceCreationInput;
}) {
  const { dates, startDate, endDate } = deriveEventDateRange(input.creation.dateMode, input.creation.dates);
  const eventInstance = {
    id: input.creation.instanceId,
    eventTypeId: input.creation.eventTypeId,
    name: input.creation.instanceName.trim(),
    dateMode: input.creation.dateMode,
    dates,
    startDate,
    endDate,
    location: input.creation.location?.trim() ? input.creation.location.trim() : undefined,
    notes: input.creation.notes?.trim() ? input.creation.notes.trim() : undefined
  } satisfies EventInstance;
  const nextEventInstances = [...input.currentEventInstances, eventInstance].sort((left, right) =>
    left.startDate.localeCompare(right.startDate)
  );
  const generatedSubEvents = createDefaultSubEventsForEventInstance({
    eventTypeId: input.creation.eventTypeId,
    eventInstanceId: input.creation.instanceId
  });

  return {
    eventInstance,
    nextEventInstances,
    nextEventSubEvents: [...input.currentEventSubEvents, ...generatedSubEvents],
    activeEventInstanceId: input.creation.instanceId
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createSponsorRule(
  deliverableName: string,
  timingType: SponsorTimingType,
  config: {
    offsetDays?: number;
    fixedMonth?: number;
    subEventName?: string;
    requiresLogo: boolean;
    requiresCopy: boolean;
    issue?: string;
  }
) {
  return {
    deliverableName,
    timingType,
    offsetDays: config.offsetDays,
    fixedMonth: config.fixedMonth,
    subEventName: config.subEventName,
    requiresLogo: config.requiresLogo,
    requiresCopy: config.requiresCopy,
    issue: config.issue
  } satisfies SponsorDeliverableRule;
}
