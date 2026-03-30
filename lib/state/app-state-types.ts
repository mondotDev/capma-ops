import type {
  CollateralItem,
  LegDayCollateralProfile
} from "@/lib/collateral-data";
import type {
  EventDateMode,
  EventFamily,
  EventInstance,
  EventSubEvent,
  EventType
} from "@/lib/event-instances";
import type { ActionItem } from "@/lib/sample-data";
import type { IssueStatus, WorkstreamSchedule } from "@/lib/ops-utils";

export type CollateralProfilesByInstance = Record<string, LegDayCollateralProfile>;

export type AppStateData = {
  items: ActionItem[];
  issueStatuses: Partial<Record<string, IssueStatus>>;
  collateralItems: CollateralItem[];
  collateralProfiles: CollateralProfilesByInstance;
  activeEventInstanceId: string;
  defaultOwnerForNewItems: string;
  eventFamilies: EventFamily[];
  eventTypes: EventType[];
  eventInstances: EventInstance[];
  eventSubEvents: EventSubEvent[];
  workstreamSchedules: WorkstreamSchedule[];
};

export type ImportAppStateResult = {
  itemCount: number;
  usedLegacyFormat: boolean;
};

export type ImportedAppState = AppStateData & ImportAppStateResult;

export type CreateEventInstanceInput = {
  eventTypeId: string;
  instanceName: string;
  dateMode: EventDateMode;
  dates: string[];
  location?: string;
  notes?: string;
};
