import {
  initialLegDayCollateralItems,
  initialLegDayCollateralProfile,
  type CollateralItem,
  type LegDayCollateralProfile
} from "@/lib/collateral-data";
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
  collateralItems: CollateralItem[];
  collateralProfile: LegDayCollateralProfile;
  workstreamSchedules: WorkstreamSchedule[];
};

export function createAppStateSnapshot(
  items: ActionItem[],
  issueStatuses: Partial<Record<string, IssueStatus>>,
  collateralItems: CollateralItem[],
  collateralProfile: LegDayCollateralProfile,
  workstreamSchedules: WorkstreamSchedule[]
): AppStateSnapshot {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    items: items.map((item) => ({ ...item })),
    issueStatuses: { ...issueStatuses },
    collateralItems: collateralItems.map((item) => ({ ...item })),
    collateralProfile: { ...collateralProfile },
    workstreamSchedules: normalizeWorkstreamSchedules(workstreamSchedules)
  };
}

export function parseImportedAppState(
  value: unknown
): ({
  items: ActionItem[];
  issueStatuses: Partial<Record<string, IssueStatus>>;
  collateralItems: CollateralItem[];
  collateralProfile: LegDayCollateralProfile;
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
      collateralItems: [],
      collateralProfile: { ...initialLegDayCollateralProfile },
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
  const collateralItems = Array.isArray(snapshot.collateralItems)
    ? snapshot.collateralItems.filter(isCollateralItemRecord)
    : initialLegDayCollateralItems.map((item) => ({ ...item }));

  if (
    items.length !== snapshot.items.length ||
    (Array.isArray(snapshot.collateralItems) && collateralItems.length !== snapshot.collateralItems.length)
  ) {
    return null;
  }

  return {
    items,
    issueStatuses: snapshot.issueStatuses,
    collateralItems,
    collateralProfile: isCollateralProfileRecord(snapshot.collateralProfile)
      ? snapshot.collateralProfile
      : { ...initialLegDayCollateralProfile },
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

function isCollateralItemRecord(value: unknown): value is CollateralItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<CollateralItem>;

  return [
    item.id,
    item.subEvent,
    item.itemName,
    item.status,
    item.printer,
    item.printerDeadline,
    item.quantity,
    item.updateType,
    item.notes,
    item.lastUpdated
  ].every((field) => typeof field === "string");
}

function isCollateralProfileRecord(value: unknown): value is LegDayCollateralProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const profile = value as Partial<LegDayCollateralProfile>;

  return [
    profile.eventStartDate,
    profile.eventEndDate,
    profile.roomBlockDeadline,
    profile.roomBlockNote,
    profile.logoDeadline,
    profile.logoDeadlineNote,
    profile.externalPrintingDue,
    profile.internalPrintingStart
  ].every((field) => typeof field === "string");
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
