import type { ActionItem } from "@/lib/sample-data";
import type { EventInstance, EventProgram, EventSubEvent } from "@/lib/event-instances";
import { getActionItemScopeLabel } from "@/lib/action-scopes";

export function getEventInstanceNameById(eventInstanceId: string | undefined, eventInstances: EventInstance[] = []) {
  if (!eventInstanceId) {
    return "";
  }

  return eventInstances.find((instance) => instance.id === eventInstanceId)?.name ?? "";
}

export function getEventSubEventNameById(
  eventInstanceId: string | undefined,
  subEventId: string | undefined,
  eventSubEvents: EventSubEvent[] = []
) {
  if (!eventInstanceId || !subEventId) {
    return "";
  }

  return (
    eventSubEvents.find(
      (subEvent) => subEvent.id === subEventId && subEvent.eventInstanceId === eventInstanceId
    )?.name ?? ""
  );
}

export function getActionItemEventGroupLabel(
  item: ActionItem,
  eventInstances: EventInstance[] = [],
  eventPrograms: EventProgram[] = []
) {
  return getActionItemScopeLabel(item, eventPrograms, eventInstances);
}

export function getActionItemSubEventLabel(item: ActionItem, eventSubEvents: EventSubEvent[] = []) {
  return getEventSubEventNameById(item.eventInstanceId, item.subEventId, eventSubEvents);
}
