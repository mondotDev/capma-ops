import type { ActionItem } from "@/lib/sample-data";
import type { IssueStatus } from "@/lib/ops-utils";

export type AppStateSnapshot = {
  version: 1;
  exportedAt: string;
  items: ActionItem[];
  issueStatuses: Partial<Record<string, IssueStatus>>;
};

export function createAppStateSnapshot(
  items: ActionItem[],
  issueStatuses: Partial<Record<string, IssueStatus>>
): AppStateSnapshot {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    items: items.map((item) => ({ ...item })),
    issueStatuses: { ...issueStatuses }
  };
}

export function parseImportedAppState(
  value: unknown
): ({ items: ActionItem[]; issueStatuses: Partial<Record<string, IssueStatus>> } & { usedLegacyFormat: boolean }) | null {
  if (Array.isArray(value)) {
    const items = value.filter(isActionItemRecord);

    if (items.length !== value.length) {
      return null;
    }

    return {
      items,
      issueStatuses: {},
      usedLegacyFormat: true
    };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const snapshot = value as Partial<AppStateSnapshot>;

  if (!Array.isArray(snapshot.items) || !isIssueStatusMap(snapshot.issueStatuses)) {
    return null;
  }

  const items = snapshot.items.filter(isActionItemRecord);

  if (items.length !== snapshot.items.length) {
    return null;
  }

  return {
    items,
    issueStatuses: snapshot.issueStatuses,
    usedLegacyFormat: false
  };
}

function isActionItemRecord(value: unknown): value is ActionItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<ActionItem> & { blocked?: unknown };

  return [
    item.id,
    item.title,
    item.type,
    item.workstream,
    item.dueDate,
    item.status,
    item.owner,
    item.waitingOn,
    item.lastUpdated,
    item.notes
  ].every((field) => typeof field === "string") &&
    (item.isBlocked === undefined || typeof item.isBlocked === "boolean") &&
    (item.blocked === undefined || typeof item.blocked === "boolean") &&
    (item.blockedBy === undefined || typeof item.blockedBy === "string") &&
    (item.issue === undefined || typeof item.issue === "string") &&
    (item.eventGroup === undefined || typeof item.eventGroup === "string");
}

function isIssueStatusMap(
  value: Partial<Record<string, IssueStatus>> | undefined
): value is Partial<Record<string, IssueStatus>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(
    (status) => status === "Planned" || status === "Open" || status === "Complete"
  );
}
