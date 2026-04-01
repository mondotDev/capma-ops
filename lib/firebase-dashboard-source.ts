import { doc, getDoc } from "firebase/firestore";
import type { DashboardExecutionItem } from "@/lib/dashboard-execution-items";
import type { DashboardSourceData } from "@/lib/read-source/app-read-source";
import type { ActionItem } from "@/lib/sample-data";
import {
  normalizeActionItemFields,
  normalizeWorkstreamSchedules,
  type IssueRecord,
  type WorkstreamSchedule
} from "@/lib/ops-utils";
import { getFirestoreDb, isDashboardReadsEnabled, isFirebaseConfigured } from "@/lib/firebase";

export type DashboardItemDTO = {
  id: string;
  title: string;
  type: string;
  workstream: string;
  issue?: string;
  dueDate: string;
  status: string;
  owner: string;
  waitingOn: string;
  isBlocked?: boolean;
  blockedBy?: string;
  lastUpdated: string;
};

type DashboardProjectionDocument = {
  executionItems: DashboardExecutionItemDTO[];
  items: DashboardItemDTO[];
  issues: IssueRecord[];
  workstreamSchedules: WorkstreamSchedule[];
  updatedAt?: string;
  schemaVersion?: number | string;
};

export type DashboardExecutionItemDTO = {
  id: string;
  kind: "action" | "collateral";
  title: string;
  workstream: string;
  dueDate: string;
  status: string;
  blockedBy: string;
  waitingOn: string;
  lastUpdated: string;
  isBlocked: boolean;
  isWaiting: boolean;
  isOverdue: boolean;
  isDueSoon: boolean;
  isTerminal: boolean;
  isMissingDueDate: boolean;
  isProductionRisk: boolean;
};

export type DashboardSessionReadSelection =
  | {
      source: "local";
    }
  | {
      source: "remote";
      dashboardSource: DashboardSourceData;
    };

/**
 * Temporary bootstrap path for the first Firebase read slice only.
 * Do not casually expand this projection into a general-purpose app document.
 */
const DASHBOARD_PROJECTION_COLLECTION = "dashboardProjections";
const DASHBOARD_PROJECTION_DOCUMENT = "current";

let cachedDashboardSessionSelection: DashboardSessionReadSelection | null = null;
let cachedDashboardSessionSelectionPromise: Promise<DashboardSessionReadSelection> | null = null;

export function getDashboardSessionReadSelection(
  resolveSelection: () => Promise<DashboardSessionReadSelection> = resolveDashboardSessionReadSelection
): Promise<DashboardSessionReadSelection> {
  if (cachedDashboardSessionSelection) {
    return Promise.resolve(cachedDashboardSessionSelection);
  }

  if (!cachedDashboardSessionSelectionPromise) {
    cachedDashboardSessionSelectionPromise = resolveSelection().then((selection) => {
      cachedDashboardSessionSelection = selection;
      return selection;
    });
  }

  return cachedDashboardSessionSelectionPromise;
}

export async function loadFirebaseDashboardSource(): Promise<DashboardSourceData | null> {
  return loadFirebaseDashboardSourceWithDependencies({
    dashboardReadsEnabled: isDashboardReadsEnabled(),
    firebaseConfigured: isFirebaseConfigured(),
    getDb: getFirestoreDb,
    getProjectionDocument: async (firestore) => {
      const snapshot = await getDoc(doc(firestore, DASHBOARD_PROJECTION_COLLECTION, DASHBOARD_PROJECTION_DOCUMENT));
      return snapshot.exists() ? snapshot.data() : null;
    }
  });
}

export async function loadFirebaseDashboardSourceWithDependencies(input: {
  dashboardReadsEnabled: boolean;
  firebaseConfigured: boolean;
  getDb: () => ReturnType<typeof getFirestoreDb>;
  getProjectionDocument: (
    firestore: NonNullable<ReturnType<typeof getFirestoreDb>>
  ) => Promise<unknown | null>;
}): Promise<DashboardSourceData | null> {
  if (!input.dashboardReadsEnabled || !input.firebaseConfigured) {
    return null;
  }

  try {
    const firestore = input.getDb();

    if (!firestore) {
      return null;
    }

    const projectionDocument = await input.getProjectionDocument(firestore);

    if (!projectionDocument) {
      return null;
    }

    const parsedProjection = parseDashboardProjectionDocument(projectionDocument);

    if (!parsedProjection) {
      return null;
    }

    return {
      executionItems: parsedProjection.executionItems.map(mapDashboardExecutionItemDto),
      items: parsedProjection.items.map(mapDashboardItemDtoToActionItem),
      issues: parsedProjection.issues,
      workstreamSchedules: normalizeWorkstreamSchedules(parsedProjection.workstreamSchedules)
    };
  } catch {
    return null;
  }
}

async function resolveDashboardSessionReadSelection(): Promise<DashboardSessionReadSelection> {
  const remoteDashboardSource = await loadFirebaseDashboardSource();

  if (!remoteDashboardSource) {
    return { source: "local" };
  }

  return {
    source: "remote",
    dashboardSource: remoteDashboardSource
  };
}

export function resetDashboardSessionReadSelectionForTests() {
  cachedDashboardSessionSelection = null;
  cachedDashboardSessionSelectionPromise = null;
}

export function parseDashboardProjectionDocument(value: unknown): DashboardProjectionDocument | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const projection = value as Partial<DashboardProjectionDocument>;

  if (
    !Array.isArray(projection.executionItems) ||
    !projection.executionItems.every(isDashboardExecutionItemDto) ||
    !Array.isArray(projection.items) ||
    !projection.items.every(isDashboardItemDto) ||
    !Array.isArray(projection.issues) ||
    !projection.issues.every(isIssueRecord) ||
    !Array.isArray(projection.workstreamSchedules) ||
    !projection.workstreamSchedules.every(isWorkstreamSchedule)
  ) {
    return null;
  }

  if (
    (projection.updatedAt !== undefined && typeof projection.updatedAt !== "string") ||
    (projection.schemaVersion !== undefined &&
      typeof projection.schemaVersion !== "string" &&
      typeof projection.schemaVersion !== "number")
  ) {
    return null;
  }

  return {
    executionItems: projection.executionItems.map((item) => ({ ...item })),
    items: projection.items.map((item) => ({ ...item })),
    issues: projection.issues.map((issue) => ({ ...issue })),
    workstreamSchedules: projection.workstreamSchedules.map((schedule) => ({
      ...schedule,
      dates: Array.isArray(schedule.dates) ? [...schedule.dates] : undefined
    })),
    updatedAt: projection.updatedAt,
    schemaVersion: projection.schemaVersion
  };
}

function isDashboardExecutionItemDto(value: unknown): value is DashboardExecutionItemDTO {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<DashboardExecutionItemDTO>;

  return (
    typeof item.id === "string" &&
    (item.kind === "action" || item.kind === "collateral") &&
    typeof item.title === "string" &&
    typeof item.workstream === "string" &&
    typeof item.dueDate === "string" &&
    typeof item.status === "string" &&
    typeof item.blockedBy === "string" &&
    typeof item.waitingOn === "string" &&
    typeof item.lastUpdated === "string" &&
    typeof item.isBlocked === "boolean" &&
    typeof item.isWaiting === "boolean" &&
    typeof item.isOverdue === "boolean" &&
    typeof item.isDueSoon === "boolean" &&
    typeof item.isTerminal === "boolean" &&
    typeof item.isMissingDueDate === "boolean" &&
    typeof item.isProductionRisk === "boolean"
  );
}

function isDashboardItemDto(value: unknown): value is DashboardItemDTO {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<DashboardItemDTO>;

  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.type === "string" &&
    typeof item.workstream === "string" &&
    (item.issue === undefined || typeof item.issue === "string") &&
    typeof item.dueDate === "string" &&
    typeof item.status === "string" &&
    typeof item.owner === "string" &&
    typeof item.waitingOn === "string" &&
    (item.isBlocked === undefined || typeof item.isBlocked === "boolean") &&
    (item.blockedBy === undefined || typeof item.blockedBy === "string") &&
    typeof item.lastUpdated === "string"
  );
}

function isIssueRecord(value: unknown): value is IssueRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const issue = value as Partial<IssueRecord>;

  return (
    typeof issue.label === "string" &&
    (issue.workstream === "Newsbrief" || issue.workstream === "The Voice") &&
    typeof issue.year === "number" &&
    (issue.dueDate === undefined || typeof issue.dueDate === "string") &&
    (issue.status === "Planned" || issue.status === "Open" || issue.status === "Complete")
  );
}

function isWorkstreamSchedule(value: unknown): value is WorkstreamSchedule {
  if (!value || typeof value !== "object") {
    return false;
  }

  const schedule = value as Partial<WorkstreamSchedule>;

  return (
    typeof schedule.workstream === "string" &&
    (schedule.mode === "none" ||
      schedule.mode === "single" ||
      schedule.mode === "range" ||
      schedule.mode === "multiple") &&
    (schedule.singleDate === undefined || typeof schedule.singleDate === "string") &&
    (schedule.startDate === undefined || typeof schedule.startDate === "string") &&
    (schedule.endDate === undefined || typeof schedule.endDate === "string") &&
    (schedule.dates === undefined ||
      (Array.isArray(schedule.dates) && schedule.dates.every((date) => typeof date === "string")))
  );
}

function mapDashboardItemDtoToActionItem(item: DashboardItemDTO): ActionItem {
  return normalizeActionItemFields({
    id: item.id,
    title: item.title,
    type: item.type,
    workstream: item.workstream,
    issue: item.issue?.trim() ? item.issue.trim() : "",
    dueDate: item.dueDate,
    status: item.status,
    owner: item.owner,
    waitingOn: item.waitingOn,
    isBlocked: item.isBlocked,
    blockedBy: item.blockedBy,
    lastUpdated: item.lastUpdated,
    noteEntries: []
  });
}

function mapDashboardExecutionItemDto(item: DashboardExecutionItemDTO): DashboardExecutionItem {
  return { ...item };
}
