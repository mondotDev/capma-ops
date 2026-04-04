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
  isDefault: boolean;
  isUnassigned: boolean;
  actionUsageCount: number;
  collateralUsageCount: number;
  canRemove: boolean;
  removeBlockReason: string | null;
};

export type EventOnboardingSelectedInstance = {
  instance: EventInstance;
  definition: EventTypeDefinition | null;
  eventFamilyName: string;
  subEvents: EventOnboardingSubEventView[];
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

  return {
    groups,
    selectedInstance: {
      instance: selectedInstance,
      definition,
      eventFamilyName:
        selectedGroup?.eventFamilyName ??
        familyNameById.get(definition?.eventFamilyId ?? "") ??
        selectedInstance.eventTypeId,
      subEvents: selectedSubEvents.map((subEvent) => {
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
          isDefault,
          isUnassigned,
          actionUsageCount,
          collateralUsageCount,
          canRemove: removeBlockReason === null,
          removeBlockReason
        } satisfies EventOnboardingSubEventView;
      })
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
