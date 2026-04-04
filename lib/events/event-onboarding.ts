import type { EventFamily, EventInstance, EventType } from "@/lib/event-instances";
import {
  getAvailableEventTypeDefinitions,
  type EventTypeDefinition
} from "@/lib/event-type-definitions";

export type EventOnboardingGroup = {
  definition: EventTypeDefinition;
  eventFamilyName: string;
  instances: EventInstance[];
};

export function getEventOnboardingGroups(input: {
  eventFamilies: EventFamily[];
  eventTypes: EventType[];
  eventInstances: EventInstance[];
}) {
  const familyNameById = new Map(input.eventFamilies.map((family) => [family.id, family.name]));
  const instancesByTypeId = new Map<string, EventInstance[]>();

  for (const instance of [...input.eventInstances].sort((left, right) => left.startDate.localeCompare(right.startDate))) {
    const current = instancesByTypeId.get(instance.eventTypeId) ?? [];
    current.push(instance);
    instancesByTypeId.set(instance.eventTypeId, current);
  }

  return getAvailableEventTypeDefinitions(input.eventTypes).map((definition) => ({
    definition,
    eventFamilyName: familyNameById.get(definition.eventFamilyId) ?? definition.eventFamilyId,
    instances: instancesByTypeId.get(definition.key) ?? []
  })) satisfies EventOnboardingGroup[];
}
