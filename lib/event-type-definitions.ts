import {
  deriveEventDateRange,
  type EventDateMode,
  type EventType,
  type EventInstance,
  type EventSubEvent
} from "@/lib/event-instances";

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
    defaultSubEvents: definition.defaultSubEvents.map((subEvent) => ({ ...subEvent }))
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
    defaultSubEvents: definition.defaultSubEvents.map((subEvent) => ({ ...subEvent }))
  } satisfies EventTypeDefinition;
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
  if (!getEventTypeDefinition(input.eventTypeId)) {
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
