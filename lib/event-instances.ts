export type EventFamily = {
  id: string;
  name: string;
};

export type EventType = {
  id: string;
  name: string;
  familyId: string;
};

export type EventDateMode = "single" | "range" | "multiple";

export type EventInstance = {
  id: string;
  eventTypeId: string;
  name: string;
  dateMode: EventDateMode;
  dates: string[];
  startDate: string;
  endDate: string;
  location?: string;
  notes?: string;
};

export type EventSubEvent = {
  id: string;
  eventInstanceId: string;
  name: string;
  sortOrder: number;
};

export const LEGISLATIVE_DAY_2026_INSTANCE_ID = "legislative-day-2026";

export const initialEventFamilies: EventFamily[] = [
  {
    id: "legislative-advocacy",
    name: "Legislative Day / Advocacy Event"
  },
  {
    id: "expo-large-multiday",
    name: "Expo / Large Multi-Day Event"
  },
  {
    id: "recurring-monthly-program",
    name: "Recurring Monthly Program"
  },
  {
    id: "multi-location-training",
    name: "Multi-Location Training Event"
  },
  {
    id: "single-run-education",
    name: "Single-Run Education Event"
  }
];

export const initialEventTypes: EventType[] = [
  {
    id: "legislative-day",
    name: "Legislative Day",
    familyId: "legislative-advocacy"
  },
  {
    id: "best-pest-expo",
    name: "Best Pest Expo",
    familyId: "expo-large-multiday"
  },
  {
    id: "first-friday",
    name: "First Friday",
    familyId: "recurring-monthly-program"
  },
  {
    id: "monday-mingle",
    name: "Monday Mingle",
    familyId: "recurring-monthly-program"
  },
  {
    id: "pest-ed",
    name: "Pest Ed",
    familyId: "multi-location-training"
  },
  {
    id: "termite-academy",
    name: "Termite Academy",
    familyId: "single-run-education"
  },
  {
    id: "development-summit",
    name: "Development Summit",
    familyId: "expo-large-multiday"
  }
];

export const initialEventInstances: EventInstance[] = [
  {
    id: LEGISLATIVE_DAY_2026_INSTANCE_ID,
    eventTypeId: "legislative-day",
    name: "Legislative Day 2026",
    dateMode: "range",
    dates: ["2026-04-21", "2026-04-23"],
    startDate: "2026-04-21",
    endDate: "2026-04-23",
    location: "Sacramento",
    notes: ""
  }
];

export const initialEventSubEvents: EventSubEvent[] = [
  { id: "leg-day-golf-reception", eventInstanceId: LEGISLATIVE_DAY_2026_INSTANCE_ID, name: "Golf Reception", sortOrder: 10 },
  { id: "leg-day-golf-registration", eventInstanceId: LEGISLATIVE_DAY_2026_INSTANCE_ID, name: "Golf Registration", sortOrder: 20 },
  { id: "leg-day-golf-tournament", eventInstanceId: LEGISLATIVE_DAY_2026_INSTANCE_ID, name: "Golf Tournament", sortOrder: 30 },
  { id: "leg-day-legislative-visits", eventInstanceId: LEGISLATIVE_DAY_2026_INSTANCE_ID, name: "Legislative Visits", sortOrder: 40 },
  { id: "leg-day-multi-event", eventInstanceId: LEGISLATIVE_DAY_2026_INSTANCE_ID, name: "Multi-Event/All Days", sortOrder: 50 },
  { id: "leg-day-thursday-breakfast", eventInstanceId: LEGISLATIVE_DAY_2026_INSTANCE_ID, name: "Thursday Breakfast", sortOrder: 60 },
  { id: "leg-day-thursday-luncheon", eventInstanceId: LEGISLATIVE_DAY_2026_INSTANCE_ID, name: "Thursday Luncheon", sortOrder: 70 },
  { id: "leg-day-wednesday-board", eventInstanceId: LEGISLATIVE_DAY_2026_INSTANCE_ID, name: "Wednesday Board Meeting", sortOrder: 80 },
  { id: "leg-day-wednesday-breakfast", eventInstanceId: LEGISLATIVE_DAY_2026_INSTANCE_ID, name: "Wednesday Breakfast", sortOrder: 90 },
  { id: "leg-day-wednesday-ceus", eventInstanceId: LEGISLATIVE_DAY_2026_INSTANCE_ID, name: "Wednesday CEUs", sortOrder: 100 },
  { id: "leg-day-wednesday-committees", eventInstanceId: LEGISLATIVE_DAY_2026_INSTANCE_ID, name: "Wednesday Committees", sortOrder: 110 },
  { id: "leg-day-wednesday-reception", eventInstanceId: LEGISLATIVE_DAY_2026_INSTANCE_ID, name: "Wednesday Reception", sortOrder: 120 },
  { id: "leg-day-wed-night-reception", eventInstanceId: LEGISLATIVE_DAY_2026_INSTANCE_ID, name: "Wed Night Reception", sortOrder: 130 },
  { id: "leg-day-wednesday-registration", eventInstanceId: LEGISLATIVE_DAY_2026_INSTANCE_ID, name: "Wednesday Registration", sortOrder: 140 }
];

export function getInitialLegDaySubEventIdByName(name: string) {
  return initialEventSubEvents.find((subEvent) => subEvent.name === name)?.id ?? null;
}

export function normalizeEventInstance(instance: Partial<EventInstance> & { dates?: unknown }) {
  if (
    typeof instance.id !== "string" ||
    typeof instance.eventTypeId !== "string" ||
    typeof instance.name !== "string" ||
    typeof instance.startDate !== "string" ||
    typeof instance.endDate !== "string"
  ) {
    return null;
  }

  const normalizedDates = Array.isArray(instance.dates)
    ? instance.dates.filter((date): date is string => typeof date === "string" && date.length > 0).sort()
    : [];
  const normalizedDateMode = isEventDateMode(instance.dateMode) ? instance.dateMode : inferDateMode(normalizedDates);

  return {
    id: instance.id,
    eventTypeId: instance.eventTypeId,
    name: instance.name,
    dateMode: normalizedDateMode,
    dates:
      normalizedDates.length > 0
        ? normalizedDates
        : normalizedDateMode === "multiple"
          ? [instance.startDate, instance.endDate].filter((date, index, all) => date.length > 0 && all.indexOf(date) === index)
          : [instance.startDate, instance.endDate].filter((date, index, all) => date.length > 0 && all.indexOf(date) === index),
    startDate: instance.startDate,
    endDate: instance.endDate,
    location: typeof instance.location === "string" ? instance.location : undefined,
    notes: typeof instance.notes === "string" ? instance.notes : undefined
  } satisfies EventInstance;
}

export function deriveEventDateRange(dateMode: EventDateMode, dates: string[]) {
  const normalizedDates = dates.filter((date) => date.length > 0).sort();

  if (dateMode === "multiple") {
    const startDate = normalizedDates[0] ?? "";
    const endDate = normalizedDates[normalizedDates.length - 1] ?? startDate;
    return { dates: normalizedDates, startDate, endDate };
  }

  if (dateMode === "range") {
    const startDate = normalizedDates[0] ?? "";
    const endDate = normalizedDates[1] ?? startDate;
    return { dates: [startDate, endDate].filter((date) => date.length > 0), startDate, endDate };
  }

  const singleDate = normalizedDates[0] ?? "";
  return { dates: singleDate ? [singleDate] : [], startDate: singleDate, endDate: singleDate };
}

export function createSuggestedEventInstanceName(
  eventTypeName: string,
  dateMode: EventDateMode,
  dates: string[],
  location?: string
) {
  const { startDate } = deriveEventDateRange(dateMode, dates);

  if (!startDate) {
    return eventTypeName;
  }

  const start = new Date(`${startDate}T00:00:00`);
  const monthLabel = start.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  const yearLabel = start.toLocaleDateString("en-US", { year: "numeric", timeZone: "UTC" });

  if (eventTypeName === "First Friday" || eventTypeName === "Monday Mingle") {
    return `${monthLabel} ${yearLabel} ${eventTypeName}`;
  }

  if (eventTypeName === "Pest Ed" && location?.trim()) {
    return `${eventTypeName} ${location.trim()} ${yearLabel}`;
  }

  return `${eventTypeName} ${yearLabel}`;
}

function isEventDateMode(value: unknown): value is EventDateMode {
  return value === "single" || value === "range" || value === "multiple";
}

function inferDateMode(dates: string[]): EventDateMode {
  if (dates.length > 2) {
    return "multiple";
  }

  if (dates.length === 2) {
    return "range";
  }

  return "single";
}
