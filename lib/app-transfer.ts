import type { ActionItem } from "@/lib/sample-data";
import {
  getDefaultWorkstreamSchedules,
  normalizeWorkstreamSchedules,
  type IssueStatus,
  type WorkstreamSchedule
} from "@/lib/ops-utils";

export type AppStateSnapshot = {
  version: 1;
  exportedAt: string;
  items: ActionItem[];
  issueStatuses: Partial<Record<string, IssueStatus>>;
  workstreamSchedules: WorkstreamSchedule[];
};

export function createAppStateSnapshot(
  items: ActionItem[],
  issueStatuses: Partial<Record<string, IssueStatus>>,
  workstreamSchedules: WorkstreamSchedule[]
): AppStateSnapshot {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    items: items.map((item) => ({ ...item })),
    issueStatuses: { ...issueStatuses },
    workstreamSchedules: normalizeWorkstreamSchedules(workstreamSchedules)
  };
}

export function parseImportedAppState(
  value: unknown
): ({
  items: ActionItem[];
  issueStatuses: Partial<Record<string, IssueStatus>>;
  workstreamSchedules: WorkstreamSchedule[];
} & { usedLegacyFormat: boolean }) | null {
  if (Array.isArray(value)) {
    const items = value.filter(isActionItemRecord);

    if (items.length !== value.length) {
      return null;
    }

    return {
      items,
      issueStatuses: {},
      workstreamSchedules: getDefaultWorkstreamSchedules(),
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
    workstreamSchedules: Array.isArray(snapshot.workstreamSchedules)
      ? normalizeWorkstreamSchedules(snapshot.workstreamSchedules)
      : getDefaultWorkstreamSchedules(),
    usedLegacyFormat: false
  };
}

function isActionItemRecord(value: unknown): value is ActionItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<ActionItem> & { blocked?: unknown; notes?: unknown };

  return [
    item.id,
    item.title,
    item.type,
    item.workstream,
    item.dueDate,
    item.status,
    item.owner,
    item.waitingOn,
    item.lastUpdated
  ].every((field) => typeof field === "string") &&
    (item.noteEntries === undefined || isNoteEntryList(item.noteEntries)) &&
    (item.notes === undefined || typeof item.notes === "string") &&
    (item.isBlocked === undefined || typeof item.isBlocked === "boolean") &&
    (item.blocked === undefined || typeof item.blocked === "boolean") &&
    (item.blockedBy === undefined || typeof item.blockedBy === "string") &&
    (item.issue === undefined || typeof item.issue === "string") &&
    (item.eventGroup === undefined || typeof item.eventGroup === "string");
}

function isNoteEntryList(value: unknown) {
  return (
    Array.isArray(value) &&
    value.every((entry) => {
      if (!entry || typeof entry !== "object") {
        return false;
      }

      const noteEntry = entry as {
        id?: unknown;
        text?: unknown;
        createdAt?: unknown;
        author?: { userId?: unknown; initials?: unknown; displayName?: unknown };
      };

      return (
        typeof noteEntry.id === "string" &&
        typeof noteEntry.text === "string" &&
        typeof noteEntry.createdAt === "string" &&
        Boolean(noteEntry.author) &&
        (noteEntry.author?.userId === null || typeof noteEntry.author?.userId === "string") &&
        typeof noteEntry.author?.initials === "string" &&
        (noteEntry.author?.displayName === undefined ||
          noteEntry.author?.displayName === null ||
          typeof noteEntry.author?.displayName === "string")
      );
    })
  );
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
