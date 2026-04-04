import type { CollateralItem } from "@/lib/collateral-data";

export type CollateralDuplicateGroup = {
  key: string;
  keepId: string;
  removeIds: string[];
  eventInstanceId: string;
  subEventId: string;
  itemName: string;
  reason: "template-origin" | "strict-shape";
};

export function findObviousCollateralDuplicateGroups(items: CollateralItem[]) {
  const groups = new Map<string, { reason: CollateralDuplicateGroup["reason"]; items: CollateralItem[] }>();

  for (const item of items) {
    const key = getCollateralDuplicateKey(item);
    if (!key) {
      continue;
    }

    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    groups.set(key, {
      reason: item.templateOriginId ? "template-origin" : "strict-shape",
      items: [item]
    });
  }

  return [...groups.entries()]
    .filter(([, group]) => group.items.length > 1)
    .map(([key, group]) => {
      const sorted = [...group.items].sort(compareCollateralDuplicatePriority);
      const keep = sorted[0]!;

      return {
        key,
        keepId: keep.id,
        removeIds: sorted.slice(1).map((item) => item.id),
        eventInstanceId: keep.eventInstanceId,
        subEventId: keep.subEventId,
        itemName: keep.itemName,
        reason: group.reason
      } satisfies CollateralDuplicateGroup;
    });
}

export function removeObviousCollateralDuplicates(items: CollateralItem[]) {
  const duplicateGroups = findObviousCollateralDuplicateGroups(items);
  const removeIds = new Set(duplicateGroups.flatMap((group) => group.removeIds));

  return {
    items: items.filter((item) => !removeIds.has(item.id)),
    duplicateGroups
  };
}

function getCollateralDuplicateKey(item: CollateralItem) {
  if (item.templateOriginId?.trim()) {
    return `template:${item.eventInstanceId}:${item.templateOriginId.trim().toLowerCase()}`;
  }

  const itemName = normalizeLooseText(item.itemName);
  if (!itemName) {
    return null;
  }

  return [
    "strict",
    item.eventInstanceId,
    item.subEventId,
    itemName,
    normalizeLooseText(item.printer),
    item.dueDate,
    normalizeLooseText(item.quantity),
    normalizeLooseText(item.updateType),
    normalizeLooseText(item.owner),
    normalizeLooseText(item.status),
    normalizeLooseText(item.blockedBy),
    normalizeLooseText(item.fileLink)
  ].join(":");
}

function compareCollateralDuplicatePriority(a: CollateralItem, b: CollateralItem) {
  return (
    getCollateralItemCompletenessScore(b) - getCollateralItemCompletenessScore(a) ||
    b.lastUpdated.localeCompare(a.lastUpdated) ||
    a.id.localeCompare(b.id)
  );
}

function getCollateralItemCompletenessScore(item: CollateralItem) {
  return [
    item.fileLink,
    item.printer,
    item.quantity,
    item.updateType,
    item.blockedBy
  ].filter((value) => normalizeLooseText(value).length > 0).length + item.noteEntries.length;
}

function normalizeLooseText(value?: string) {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}
