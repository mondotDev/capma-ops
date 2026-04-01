import { doc, getDoc, getFirestore } from "firebase/firestore";
import type { DashboardSourceData } from "@/lib/read-source/app-read-source";
import type { ActionItem } from "@/lib/sample-data";
import {
  normalizeActionItemFields,
  normalizeWorkstreamSchedules,
  type IssueRecord,
  type WorkstreamSchedule
} from "@/lib/ops-utils";
import { getFirebaseApp, isFirebaseConfigured } from "@/lib/firebase";

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
  items: DashboardItemDTO[];
  issues: IssueRecord[];
  workstreamSchedules: WorkstreamSchedule[];
  updatedAt?: string;
  schemaVersion?: number | string;
};

export type DashboardSessionReadSelection =
  | {
      source: "local";
    }
  | {
      source: "remote";
      dashboardSource: DashboardSourceData;
    };

const DASHBOARD_READS_ENABLED = process.env.NEXT_PUBLIC_FIREBASE_DASHBOARD_READS_ENABLED === "true";
/**
 * Temporary bootstrap path for the first Firebase read slice only.
 * Do not casually expand this projection into a general-purpose app document.
 */
const DASHBOARD_PROJECTION_COLLECTION = "dashboardProjections";
const DASHBOARD_PROJECTION_DOCUMENT = "current";

let cachedDashboardSessionSelection: DashboardSessionReadSelection | null = null;
let cachedDashboardSessionSelectionPromise: Promise<DashboardSessionReadSelection> | null = null;

export function getDashboardSessionReadSelection(): Promise<DashboardSessionReadSelection> {
  if (cachedDashboardSessionSelection) {
    return Promise.resolve(cachedDashboardSessionSelection);
  }

  if (!cachedDashboardSessionSelectionPromise) {
    cachedDashboardSessionSelectionPromise = resolveDashboardSessionReadSelection().then((selection) => {
      cachedDashboardSessionSelection = selection;
      return selection;
    });
  }

  return cachedDashboardSessionSelectionPromise;
}

export async function loadFirebaseDashboardSource(): Promise<DashboardSourceData | null> {
  if (!DASHBOARD_READS_ENABLED || !isFirebaseConfigured()) {
    return null;
  }

  try {
    const firestore = getFirestore(getFirebaseApp());
    const snapshot = await getDoc(doc(firestore, DASHBOARD_PROJECTION_COLLECTION, DASHBOARD_PROJECTION_DOCUMENT));

    if (!snapshot.exists()) {
      return null;
    }

    const parsedProjection = parseDashboardProjectionDocument(snapshot.data());

    if (!parsedProjection) {
      return null;
    }

    return {
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

function parseDashboardProjectionDocument(value: unknown): DashboardProjectionDocument | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const projection = value as Partial<DashboardProjectionDocument>;

  if (
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
