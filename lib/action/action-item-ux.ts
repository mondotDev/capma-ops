import type { EventInstance, EventProgram } from "@/lib/event-instances";
import { normalizeIdentifierValue, normalizeWorkstreamValue } from "@/lib/ops-utils";

export const ACTION_ITEM_MEANING_HINT =
  "Event Instance = event-linked work. Operational Bucket = non-event work. Only one applies at a time.";

export function shouldClearEventLinkOnWorkstreamChange(input: {
  eventInstanceId?: string;
  nextWorkstream: string;
  eventInstances: EventInstance[];
  eventPrograms: EventProgram[];
}) {
  const normalizedEventInstanceId = normalizeIdentifierValue(input.eventInstanceId);

  if (!normalizedEventInstanceId) {
    return false;
  }

  const eventInstance = input.eventInstances.find((instance) => instance.id === normalizedEventInstanceId);

  if (!eventInstance) {
    return false;
  }

  const eventProgramWorkstream = input.eventPrograms.find(
    (eventProgram) => eventProgram.id === eventInstance.eventTypeId
  )?.name;

  if (!eventProgramWorkstream) {
    return false;
  }

  return normalizeWorkstreamValue(input.nextWorkstream) !== normalizeWorkstreamValue(eventProgramWorkstream);
}

export function getActionMeaningUiState(eventInstanceId?: string) {
  const isEventLinked = Boolean(normalizeIdentifierValue(eventInstanceId));

  return {
    isEventLinked,
    subEventDisabled: !isEventLinked,
    operationalBucketDisabled: isEventLinked,
    operationalBucketHint: isEventLinked
      ? "Operational buckets are disabled while this item is linked to an event instance."
      : "Use this only for non-event action items such as general operations or membership work."
  };
}
