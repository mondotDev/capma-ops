import type { EventInstance, EventProgram } from "@/lib/event-instances";
import { normalizeIdentifierValue, normalizeWorkstreamValue } from "@/lib/ops-utils";

export const ACTION_ITEM_MEANING_HINT =
  "Event Instance = event-linked work. Operational Bucket = non-event work. Only one applies at a time.";

export type QuickAddManualEventSelection = {
  eventProgramId: string | null;
  eventInstanceId: string;
};

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

export function getQuickAddMeaningUiState(input: {
  workstream: string;
  eventInstanceId?: string;
  eventPrograms: EventProgram[];
}) {
  const normalizedWorkstream = normalizeWorkstreamValue(input.workstream);
  const hasWorkstream = Boolean(normalizedWorkstream);
  const isEventWorkstream = Boolean(getEventProgramForWorkstream(input.workstream, input.eventPrograms));
  const actionMeaning = getActionMeaningUiState(input.eventInstanceId);

  return {
    ...actionMeaning,
    hasWorkstream,
    isEventWorkstream,
    eventPathActive: hasWorkstream && isEventWorkstream,
    eventPathMuted: !hasWorkstream || !isEventWorkstream,
    operationalPathActive: hasWorkstream && !isEventWorkstream,
    operationalPathMuted: !hasWorkstream || isEventWorkstream,
    contextualHint: !hasWorkstream
      ? "Choose a workstream first to guide the event vs non-event fields."
      : isEventWorkstream
        ? "This workstream is event-related, so Event Instance is the active path."
        : "This workstream is non-event work, so Operational Bucket is the active path."
  };
}

export function getEventProgramForWorkstream(workstream: string, eventPrograms: EventProgram[]) {
  const normalizedWorkstream = normalizeWorkstreamValue(workstream);

  if (!normalizedWorkstream) {
    return null;
  }

  return (
    eventPrograms.find((eventProgram) => normalizeWorkstreamValue(eventProgram.name) === normalizedWorkstream) ?? null
  );
}

export function getEventProgramIdForEventInstance(
  eventInstanceId: string | undefined,
  eventInstances: EventInstance[]
) {
  const normalizedEventInstanceId = normalizeIdentifierValue(eventInstanceId);

  if (!normalizedEventInstanceId) {
    return null;
  }

  return eventInstances.find((instance) => instance.id === normalizedEventInstanceId)?.eventTypeId ?? null;
}

export function getSoonestUpcomingEventInstanceIdForWorkstream(input: {
  workstream: string;
  eventInstances: EventInstance[];
  eventPrograms: EventProgram[];
  today?: string;
}) {
  const eventProgram = getEventProgramForWorkstream(input.workstream, input.eventPrograms);

  if (!eventProgram) {
    return "";
  }

  const todayDateKey = input.today ?? getLocalDateKey(new Date());
  const upcomingInstances = input.eventInstances
    .filter((instance) => instance.eventTypeId === eventProgram.id && instance.startDate >= todayDateKey)
    .sort((left, right) => {
      if (left.startDate !== right.startDate) {
        return left.startDate.localeCompare(right.startDate);
      }

      return left.name.localeCompare(right.name);
    });

  return upcomingInstances[0]?.id ?? "";
}

export function reconcileQuickAddEventSelectionOnWorkstreamChange(input: {
  currentEventInstanceId: string;
  currentSubEventId: string;
  nextWorkstream: string;
  manualSelection: QuickAddManualEventSelection;
  eventInstances: EventInstance[];
  eventPrograms: EventProgram[];
  today?: string;
}) {
  const nextEventProgram = getEventProgramForWorkstream(input.nextWorkstream, input.eventPrograms);

  if (!nextEventProgram) {
    return {
      eventInstanceId: "",
      subEventId: "",
      manualSelection: { eventProgramId: null, eventInstanceId: "" } satisfies QuickAddManualEventSelection
    };
  }

  const manualSelectionProgramId = input.manualSelection.eventInstanceId
    ? getEventProgramIdForEventInstance(input.manualSelection.eventInstanceId, input.eventInstances)
    : input.manualSelection.eventProgramId;
  const canPreserveManualSelection =
    manualSelectionProgramId === nextEventProgram.id &&
    (!input.manualSelection.eventInstanceId ||
      getEventProgramIdForEventInstance(input.manualSelection.eventInstanceId, input.eventInstances) === nextEventProgram.id);

  if (canPreserveManualSelection) {
    return {
      eventInstanceId: input.manualSelection.eventInstanceId,
      subEventId:
        input.manualSelection.eventInstanceId && input.manualSelection.eventInstanceId === input.currentEventInstanceId
          ? input.currentSubEventId
          : "",
      manualSelection: input.manualSelection
    };
  }

  return {
    eventInstanceId: getSoonestUpcomingEventInstanceIdForWorkstream({
      workstream: input.nextWorkstream,
      eventInstances: input.eventInstances,
      eventPrograms: input.eventPrograms,
      today: input.today
    }),
    subEventId: "",
    manualSelection: { eventProgramId: null, eventInstanceId: "" } satisfies QuickAddManualEventSelection
  };
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}
