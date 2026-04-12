type ChronologicalSubEvent = {
  id: string;
  name: string;
  sortOrder: number;
  scheduleMode?: "timed" | "all_day" | "multi_day";
  date?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
};

export function sortSubEventsForEventWorkspace<T extends ChronologicalSubEvent>(subEvents: T[]) {
  return [...subEvents].sort((left, right) => compareSubEventsForWorkspace(left, right));
}

function compareSubEventsForWorkspace(left: ChronologicalSubEvent, right: ChronologicalSubEvent) {
  const leftDateKey = getSubEventDateKey(left);
  const rightDateKey = getSubEventDateKey(right);

  if (leftDateKey && rightDateKey) {
    const dateDelta = leftDateKey.localeCompare(rightDateKey);

    if (dateDelta !== 0) {
      return dateDelta;
    }
  } else if (leftDateKey) {
    return -1;
  } else if (rightDateKey) {
    return 1;
  }

  const sortOrderDelta = left.sortOrder - right.sortOrder;

  if (sortOrderDelta !== 0) {
    return sortOrderDelta;
  }

  const nameDelta = left.name.localeCompare(right.name);

  if (nameDelta !== 0) {
    return nameDelta;
  }

  return left.id.localeCompare(right.id);
}

function getSubEventDateKey(subEvent: ChronologicalSubEvent) {
  const normalizedDate = subEvent.date?.trim() || subEvent.endDate?.trim();

  if (!normalizedDate) {
    return null;
  }

  const normalizedTime =
    subEvent.scheduleMode === "timed"
      ? subEvent.startTime?.trim() || subEvent.endTime?.trim() || "99:99"
      : "00:00";
  return `${normalizedDate}T${normalizedTime}`;
}
