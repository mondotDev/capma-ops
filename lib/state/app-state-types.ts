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
import type { SponsorPlacementsByInstance } from "@/lib/sponsor-fulfillment";
import type { ActionItem } from "@/lib/sample-data";
import type { IssueStatus, WorkstreamSchedule } from "@/lib/ops-utils";

export type CollateralProfilesByInstance = Record<string, LegDayCollateralProfile>;

export type AppStateData = {
  items: ActionItem[];
  issueStatuses: Partial<Record<string, IssueStatus>>;
  collateralItems: CollateralItem[];
  collateralProfiles: CollateralProfilesByInstance;
  sponsorPlacementsByInstance: SponsorPlacementsByInstance;
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

export type UpdateEventInstanceInput = {
  instanceName?: string;
  dateMode?: EventDateMode;
  dates?: string[];
  location?: string;
  notes?: string;
};

export type UpsertEventSubEventInput = {
  id?: string;
  name: string;
  sortOrder?: number;
};
