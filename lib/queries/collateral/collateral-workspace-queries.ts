import {
  isCollateralBlocked,
  isCollateralDueSoon,
  isCollateralOverdue,
  isCollateralTerminalStatus,
  type CollateralItem,
  type LegDayCollateralProfile
} from "@/lib/collateral-data";
import { getDefaultTemplatePackForEventType, supportsCollateralEventType } from "@/lib/collateral-templates";
import {
  getUnassignedSubEventId,
  resolveActiveEventInstanceId,
  type EventInstance,
  type EventProgram,
  type EventSubEvent,
} from "@/lib/event-instances";
import { formatShortDate } from "@/lib/ops-utils";

export type CollateralWorkspaceSummaryFilter =
  | "all"
  | "active"
  | "needsAttention"
  | "atPrinter"
  | "readyForPrint";

export type CollateralWorkspaceProfileDeadlineFilter =
  | "none"
  | "logoDeadline"
  | "externalPrintingDue"
  | "internalPrintingStart";

export type CollateralWorkspaceInstanceGroup = {
  eventProgram: EventProgram;
  eventType?: EventProgram;
  instances: EventInstance[];
};

export type CollateralEventInstanceWorkspaceBundle = {
  resolvedActiveEventInstanceId: string;
  selectedEventInstance: EventInstance | null;
  currentEventProgram: EventProgram | null;
  currentEventType?: EventProgram | null;
  defaultTemplatePack: ReturnType<typeof getDefaultTemplatePackForEventType> | null;
  supportedCreateEventPrograms: EventProgram[];
  supportedCreateEventTypes?: EventProgram[];
  isSelectedEventProgramSupported: boolean;
  isSelectedEventTypeSupported?: boolean;
  activeProfile: LegDayCollateralProfile | null;
  selectedEventDateRange: string;
  eventInstancesByProgram: CollateralWorkspaceInstanceGroup[];
  eventInstancesByType?: CollateralWorkspaceInstanceGroup[];
  instanceSubEvents: EventSubEvent[];
  hasAppliedTemplateItems: boolean;
};

export type CollateralWorkspaceSummary = {
  active: number;
  needsAttention: number;
  atPrinter: number;
  atPrinterQuantity: number | null;
  readyForPrint: number;
};

export type CollateralInstanceListView = {
  instanceItems: CollateralItem[];
  visibleInstanceItems: CollateralItem[];
  groupedItems: Array<readonly [string, CollateralItem[]]>;
  summary: CollateralWorkspaceSummary;
};

export type SelectedCollateralItemWorkspace = {
  selectedItem: CollateralItem | null;
  subEventNameById: Map<string, string>;
  subEventOptions: EventSubEvent[];
  emptySubEventId: string;
};

export function getCollateralEventInstanceWorkspaceBundle(input: {
  activeEventInstanceId: string;
  collateralItems: CollateralItem[];
  collateralProfiles: Record<string, LegDayCollateralProfile | undefined>;
  eventInstances: EventInstance[];
  eventSubEvents: EventSubEvent[];
  eventPrograms?: EventProgram[];
  eventTypes?: EventProgram[];
}) {
  const eventPrograms = input.eventPrograms ?? input.eventTypes ?? [];
  const resolvedActiveEventInstanceId = resolveActiveEventInstanceId(
    input.activeEventInstanceId,
    input.eventInstances
  );
  const selectedEventInstance =
    input.eventInstances.find((instance) => instance.id === resolvedActiveEventInstanceId) ?? null;
  const currentEventProgram =
    eventPrograms.find((eventProgram) => eventProgram.id === selectedEventInstance?.eventTypeId) ?? null;
  const defaultTemplatePack = selectedEventInstance
    ? getDefaultTemplatePackForEventType(selectedEventInstance.eventTypeId)
    : null;
  const supportedCreateEventPrograms = eventPrograms.filter((eventProgram) =>
    supportsCollateralEventType(eventProgram.id)
  );
  const isSelectedEventProgramSupported = selectedEventInstance
    ? supportsCollateralEventType(selectedEventInstance.eventTypeId)
    : false;
  const activeProfile =
    input.collateralProfiles[resolvedActiveEventInstanceId] ??
    (selectedEventInstance?.eventTypeId === "legislative-day"
      ? getDefaultLegDayProfile(selectedEventInstance)
      : null);
  const selectedEventDateRange =
    selectedEventInstance && selectedEventInstance.startDate && selectedEventInstance.endDate
      ? selectedEventInstance.startDate === selectedEventInstance.endDate
        ? formatShortDate(selectedEventInstance.startDate)
        : `${formatShortDate(selectedEventInstance.startDate)} - ${formatShortDate(selectedEventInstance.endDate)}`
      : "";
  const instancesByType = new Map<string, EventInstance[]>();

  for (const instance of [...input.eventInstances].sort((a, b) => a.startDate.localeCompare(b.startDate))) {
    if (!instancesByType.has(instance.eventTypeId)) {
      instancesByType.set(instance.eventTypeId, []);
    }

    instancesByType.get(instance.eventTypeId)!.push(instance);
  }

  const eventInstancesByProgram = eventPrograms
    .map((eventProgram) => ({
      eventProgram,
      eventType: eventProgram,
      instances: instancesByType.get(eventProgram.id) ?? []
    }))
    .filter((group) => group.instances.length > 0);
  const instanceSubEvents = input.eventSubEvents.filter(
    (subEvent) => subEvent.eventInstanceId === resolvedActiveEventInstanceId
  );
  const hasAppliedTemplateItems = input.collateralItems.some(
    (item) => item.eventInstanceId === resolvedActiveEventInstanceId && Boolean(item.templateOriginId)
  );

  return {
    resolvedActiveEventInstanceId,
    selectedEventInstance,
    currentEventProgram,
    currentEventType: currentEventProgram,
    defaultTemplatePack,
    supportedCreateEventPrograms,
    supportedCreateEventTypes: supportedCreateEventPrograms,
    isSelectedEventProgramSupported,
    isSelectedEventTypeSupported: isSelectedEventProgramSupported,
    activeProfile,
    selectedEventDateRange,
    eventInstancesByProgram,
    eventInstancesByType: eventInstancesByProgram,
    instanceSubEvents,
    hasAppliedTemplateItems
  } satisfies CollateralEventInstanceWorkspaceBundle;
}

export function getCollateralInstanceListView(input: {
  collateralItems: CollateralItem[];
  resolvedActiveEventInstanceId: string;
  instanceSubEvents: EventSubEvent[];
  activeProfile: LegDayCollateralProfile | null;
  activeSummaryFilter: CollateralWorkspaceSummaryFilter;
  activeProfileDeadlineFilter: CollateralWorkspaceProfileDeadlineFilter;
  draftCollateralItem: CollateralItem | null;
}) {
  const instanceItems = input.collateralItems.filter(
    (item) => item.eventInstanceId === input.resolvedActiveEventInstanceId
  );
  const visibleInstanceItems =
    input.draftCollateralItem && input.draftCollateralItem.eventInstanceId === input.resolvedActiveEventInstanceId
      ? [input.draftCollateralItem, ...instanceItems]
      : instanceItems;
  const subEventNameById = new Map(input.instanceSubEvents.map((subEvent) => [subEvent.id, subEvent.name]));
  const activeItems = instanceItems.filter((item) => !isCollateralTerminalStatus(item.status));
  const filteredVisibleItems = visibleInstanceItems.filter(
    (item) =>
      matchesCollateralSummaryFilter(item, input.activeSummaryFilter) &&
      matchesCollateralProfileDeadlineFilter(item, input.activeProfile, input.activeProfileDeadlineFilter)
  );
  const groupedItems = groupCollateralItems(filteredVisibleItems, input.instanceSubEvents, subEventNameById);
  const atPrinterItems = activeItems.filter((item) => item.status === "Sent to Printer");
  const parsedAtPrinterQuantities = atPrinterItems.map((item) => {
    const trimmedQuantity = item.quantity.trim();
    if (!trimmedQuantity || !/^\d+$/.test(trimmedQuantity)) {
      return null;
    }

    return Number.parseInt(trimmedQuantity, 10);
  });
  const canShowAtPrinterQuantity =
    atPrinterItems.length > 0 && parsedAtPrinterQuantities.every((quantity) => quantity !== null);

  return {
    instanceItems,
    visibleInstanceItems,
    groupedItems,
    summary: {
      active: activeItems.length,
      needsAttention: activeItems.filter((item) => isCollateralBlocked(item) || isCollateralOverdue(item)).length,
      atPrinter: atPrinterItems.length,
      atPrinterQuantity: canShowAtPrinterQuantity
        ? parsedAtPrinterQuantities.reduce((total, quantity) => total + (quantity ?? 0), 0)
        : null,
      readyForPrint: activeItems.filter((item) => item.status === "Ready for Print").length
    }
  } satisfies CollateralInstanceListView;
}

export function getSelectedCollateralItemWorkspace(input: {
  selectedId: string | null;
  visibleInstanceItems: CollateralItem[];
  instanceSubEvents: EventSubEvent[];
  resolvedActiveEventInstanceId: string;
}) {
  const subEventNameById = new Map(input.instanceSubEvents.map((subEvent) => [subEvent.id, subEvent.name]));

  return {
    selectedItem: input.visibleInstanceItems.find((item) => item.id === input.selectedId) ?? null,
    subEventNameById,
    subEventOptions: input.instanceSubEvents,
    emptySubEventId: getUnassignedSubEventId(input.resolvedActiveEventInstanceId)
  } satisfies SelectedCollateralItemWorkspace;
}

function groupCollateralItems(
  items: CollateralItem[],
  subEvents: EventSubEvent[],
  subEventNameById: Map<string, string>
) {
  const grouped = new Map<string, CollateralItem[]>();

  for (const subEvent of subEvents) {
    grouped.set(subEvent.name, []);
  }

  for (const item of items) {
    const subEventName = subEventNameById.get(item.subEventId) ?? "Unassigned";

    if (!grouped.has(subEventName)) {
      grouped.set(subEventName, []);
    }

    grouped.get(subEventName)!.push(item);
  }

  return Array.from(grouped.entries())
    .map(([subEvent, groupedItems]) => [
      subEvent,
      [...groupedItems].sort((a, b) => {
        const aHasDeadline = a.dueDate.length > 0;
        const bHasDeadline = b.dueDate.length > 0;

        if (aHasDeadline !== bHasDeadline) {
          return aHasDeadline ? -1 : 1;
        }

        if (aHasDeadline && bHasDeadline) {
          const dateCompare = a.dueDate.localeCompare(b.dueDate);

          if (dateCompare !== 0) {
            return dateCompare;
          }
        }

        return a.itemName.localeCompare(b.itemName);
      })
    ] as const)
    .filter(([, groupedItems]) => groupedItems.length > 0);
}

function getDefaultLegDayProfile(instance: { startDate: string; endDate: string } | null): LegDayCollateralProfile {
  return {
    eventStartDate: instance?.startDate ?? "",
    eventEndDate: instance?.endDate ?? "",
    roomBlockDeadline: "",
    roomBlockNote: "",
    logoDeadline: "",
    logoDeadlineNote: "",
    externalPrintingDue: "",
    internalPrintingStart: ""
  };
}

function matchesCollateralSummaryFilter(item: CollateralItem, filter: CollateralWorkspaceSummaryFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "active") {
    return !isCollateralTerminalStatus(item.status);
  }

  if (filter === "needsAttention") {
    return isCollateralBlocked(item) || isCollateralOverdue(item);
  }

  if (filter === "atPrinter") {
    return item.status === "Sent to Printer";
  }

  if (filter === "readyForPrint") {
    return item.status === "Ready for Print";
  }

  return true;
}

function matchesCollateralProfileDeadlineFilter(
  item: CollateralItem,
  profile: LegDayCollateralProfile | null,
  filter: CollateralWorkspaceProfileDeadlineFilter
) {
  if (filter === "none") {
    return true;
  }

  if (isCollateralTerminalStatus(item.status) || item.dueDate.length === 0 || !profile) {
    return false;
  }

  const targetDate = getProfileDeadlineDate(profile, filter);

  if (!targetDate) {
    return false;
  }

  return item.dueDate <= targetDate;
}

function getProfileDeadlineDate(
  profile: LegDayCollateralProfile,
  filter: CollateralWorkspaceProfileDeadlineFilter
) {
  if (filter === "logoDeadline") {
    return profile.logoDeadline;
  }

  if (filter === "externalPrintingDue") {
    return profile.externalPrintingDue;
  }

  if (filter === "internalPrintingStart") {
    return profile.internalPrintingStart;
  }

  return "";
}
