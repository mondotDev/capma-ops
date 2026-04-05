import type { CollateralItem } from "@/lib/collateral-data";
import type { EventFamily, EventInstance, EventSubEvent, EventType } from "@/lib/event-instances";
import {
  getAvailableEventTypeDefinitions,
  getEventTypeDefinition,
  isDefaultSubEventNameForEventType,
  type EventTypeDefinition
} from "@/lib/event-type-definitions";
import type { ActionItem } from "@/lib/sample-data";

export type EventOnboardingGroup = {
  definition: EventTypeDefinition;
  eventFamilyName: string;
  instances: EventInstance[];
};

export type EventOnboardingSubEventView = {
  id: string;
  name: string;
  sortOrder: number;
  date: string;
  startTime: string;
  endTime: string;
  isDefault: boolean;
  isUnassigned: boolean;
  actionUsageCount: number;
  collateralUsageCount: number;
  canRemove: boolean;
  removeBlockReason: string | null;
};

export type EventOnboardingScheduleStatus = "none" | "partial" | "scheduled";
export type EventOnboardingSetupStepStatus = "needs_attention" | "ready_next" | "done";

export type EventOnboardingSetupStep = {
  key: "details" | "schedule" | "collateral";
  label: string;
  status: EventOnboardingSetupStepStatus;
  guidance: string;
};

export type EventOnboardingFallbackLane = {
  id: string;
  name: string;
  actionUsageCount: number;
  collateralUsageCount: number;
  removeBlockReason: string | null;
};

export type EventOnboardingSelectedInstance = {
  instance: EventInstance;
  definition: EventTypeDefinition | null;
  eventFamilyName: string;
  scheduleStatus: EventOnboardingScheduleStatus;
  setupSteps: EventOnboardingSetupStep[];
  nextStepGuidance: string;
  isCollateralReady: boolean;
  scheduledSubEvents: EventOnboardingSubEventView[];
  fallbackLane: EventOnboardingFallbackLane | null;
};

export type EventOnboardingView = {
  groups: EventOnboardingGroup[];
  selectedInstance: EventOnboardingSelectedInstance | null;
};

export function getEventOnboardingGroups(input: {
  eventFamilies: EventFamily[];
  eventTypes: EventType[];
  eventInstances: EventInstance[];
}) {
  return getEventOnboardingView({
    ...input,
    eventSubEvents: [],
    items: [],
    collateralItems: [],
    selectedInstanceId: null
  }).groups;
}

export function getEventOnboardingView(input: {
  eventFamilies: EventFamily[];
  eventTypes: EventType[];
  eventInstances: EventInstance[];
  eventSubEvents: EventSubEvent[];
  items: ActionItem[];
  collateralItems: CollateralItem[];
  selectedInstanceId: string | null;
}): EventOnboardingView {
  const familyNameById = new Map(input.eventFamilies.map((family) => [family.id, family.name]));
  const instancesByTypeId = new Map<string, EventInstance[]>();

  for (const instance of [...input.eventInstances].sort((left, right) => left.startDate.localeCompare(right.startDate))) {
    const current = instancesByTypeId.get(instance.eventTypeId) ?? [];
    current.push(instance);
    instancesByTypeId.set(instance.eventTypeId, current);
  }

  const groups = getAvailableEventTypeDefinitions(input.eventTypes).map((definition) => ({
    definition,
    eventFamilyName: familyNameById.get(definition.eventFamilyId) ?? definition.eventFamilyId,
    instances: instancesByTypeId.get(definition.key) ?? []
  })) satisfies EventOnboardingGroup[];

  const selectedInstance =
    input.selectedInstanceId
      ? input.eventInstances.find((instance) => instance.id === input.selectedInstanceId) ?? null
      : null;

  if (!selectedInstance) {
    return {
      groups,
      selectedInstance: null
    };
  }

  const definition = getEventTypeDefinition(selectedInstance.eventTypeId);
  const selectedGroup = groups.find((group) => group.definition.key === selectedInstance.eventTypeId) ?? null;
  const selectedSubEvents = [...input.eventSubEvents]
    .filter((subEvent) => subEvent.eventInstanceId === selectedInstance.id)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  const scheduleStatus = getScheduleStatus(selectedSubEvents);
  const subEventViews = selectedSubEvents.map((subEvent) => {
    const actionUsageCount = input.items.filter(
      (item) => item.eventInstanceId === selectedInstance.id && item.subEventId === subEvent.id
    ).length;
    const collateralUsageCount = input.collateralItems.filter(
      (item) => item.eventInstanceId === selectedInstance.id && item.subEventId === subEvent.id
    ).length;
    const isUnassigned = subEvent.id === `${selectedInstance.id}-unassigned`;
    const isDefault = isDefaultSubEventNameForEventType(selectedInstance.eventTypeId, subEvent.name);
    const removeBlockReason = getSubEventRemoveBlockReason({
      isDefault,
      isUnassigned,
      actionUsageCount,
      collateralUsageCount
    });

    return {
      id: subEvent.id,
      name: subEvent.name,
      sortOrder: subEvent.sortOrder,
      date: subEvent.date ?? "",
      startTime: subEvent.startTime ?? "",
      endTime: subEvent.endTime ?? "",
      isDefault,
      isUnassigned,
      actionUsageCount,
      collateralUsageCount,
      canRemove: removeBlockReason === null,
      removeBlockReason
    } satisfies EventOnboardingSubEventView;
  });
  const scheduledSubEvents = subEventViews.filter((subEvent) => !subEvent.isUnassigned);
  const fallbackLane = subEventViews.find((subEvent) => subEvent.isUnassigned) ?? null;
  const setupSteps = getSetupSteps({
    instance: selectedInstance,
    scheduleStatus
  });
  const nextStepGuidance =
    setupSteps.find((step) => step.status === "ready_next")?.guidance ??
    setupSteps.find((step) => step.status === "needs_attention")?.guidance ??
    "Open Collateral to start production work for this event instance.";
  const isCollateralReady = scheduleStatus === "scheduled";

  return {
    groups,
    selectedInstance: {
      instance: selectedInstance,
      definition,
      eventFamilyName:
        selectedGroup?.eventFamilyName ??
        familyNameById.get(definition?.eventFamilyId ?? "") ??
        selectedInstance.eventTypeId,
      scheduleStatus,
      setupSteps,
      nextStepGuidance,
      isCollateralReady,
      scheduledSubEvents,
      fallbackLane:
        fallbackLane
          ? {
              id: fallbackLane.id,
              name: fallbackLane.name,
              actionUsageCount: fallbackLane.actionUsageCount,
              collateralUsageCount: fallbackLane.collateralUsageCount,
              removeBlockReason: fallbackLane.removeBlockReason
            }
          : null
    }
  };
}

function getSubEventRemoveBlockReason(input: {
  isDefault: boolean;
  isUnassigned: boolean;
  actionUsageCount: number;
  collateralUsageCount: number;
}) {
  if (input.isUnassigned) {
    return "Keep the unassigned lane so new work always has a safe fallback.";
  }

  if (input.isDefault) {
    return "Default sub-events come from the event type scaffold and stay in place for this slice.";
  }

  if (input.actionUsageCount > 0 || input.collateralUsageCount > 0) {
    return "This sub-event is already in use by Action View or Collateral records.";
  }

  return null;
}

function getScheduleStatus(subEvents: EventSubEvent[]): EventOnboardingScheduleStatus {
  const schedulableSubEvents = subEvents.filter((subEvent) => !subEvent.id.endsWith("-unassigned"));

  if (schedulableSubEvents.length === 0) {
    return "none";
  }

  const scheduledCount = schedulableSubEvents.filter((subEvent) => Boolean(subEvent.date)).length;

  if (scheduledCount === 0) {
    return "none";
  }

  if (scheduledCount === schedulableSubEvents.length) {
    return "scheduled";
  }

  return "partial";
}

function getSetupSteps(input: {
  instance: EventInstance;
  scheduleStatus: EventOnboardingScheduleStatus;
}): EventOnboardingSetupStep[] {
  const hasEventDetails = Boolean(input.instance.name.trim() && input.instance.startDate);
  const detailsStatus: EventOnboardingSetupStepStatus = hasEventDetails ? "done" : "needs_attention";
  const scheduleStatus: EventOnboardingSetupStepStatus =
    input.scheduleStatus === "scheduled"
      ? "done"
      : detailsStatus === "done"
        ? "ready_next"
        : "needs_attention";
  const collateralStatus: EventOnboardingSetupStepStatus =
    input.scheduleStatus === "scheduled" ? "ready_next" : "needs_attention";

  return [
    {
      key: "details",
      label: "Event details",
      status: detailsStatus,
      guidance: hasEventDetails
        ? "Core event details are in place."
        : "Add the event name and dates before moving downstream."
    },
    {
      key: "schedule",
      label: "Sub-event schedule",
      status: scheduleStatus,
      guidance:
        input.scheduleStatus === "scheduled"
          ? "Sub-event dates are confirmed."
          : input.scheduleStatus === "partial"
            ? "Next step: finish adding dates and times for the remaining sub-events."
            : "Next step: add dates and times for this event's sub-events."
    },
    {
      key: "collateral",
      label: "Open in Collateral",
      status: collateralStatus,
      guidance:
        input.scheduleStatus === "scheduled"
          ? "Next step: open Collateral to start production work."
          : "You can open Collateral now, but this setup still needs schedule confirmation."
    }
  ];
}
