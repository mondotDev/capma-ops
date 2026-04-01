import type {
  CollateralItem,
  LegDayCollateralProfile
} from "@/lib/collateral-data";
import type {
  EventInstance,
  EventProgram,
  EventSubEvent,
} from "@/lib/event-instances";
import type { ActionItem } from "@/lib/sample-data";
import type { CollateralProfilesByInstance } from "@/lib/state/app-state-types";
import type { IssueRecord, WorkstreamSchedule } from "@/lib/ops-utils";

export type DashboardSourceData = {
  items: ActionItem[];
  issues: IssueRecord[];
  workstreamSchedules: WorkstreamSchedule[];
};

export type ActionListSourceData = {
  items: ActionItem[];
  collateralItems: CollateralItem[];
  eventInstances: EventInstance[];
  eventSubEvents: EventSubEvent[];
  eventPrograms?: EventProgram[];
  eventTypes?: EventProgram[];
};

export type ActionDetailSourceData = {
  selectedItem: ActionItem | null;
  issues: IssueRecord[];
  selectedItemSubEvents: EventSubEvent[];
};

export type CollateralWorkspaceSourceData = {
  activeEventInstanceId: string;
  collateralItems: CollateralItem[];
  collateralProfiles: Partial<CollateralProfilesByInstance>;
  eventInstances: EventInstance[];
  eventSubEvents: EventSubEvent[];
  eventPrograms?: EventProgram[];
  eventTypes?: EventProgram[];
};

export type CollateralDetailSourceData = {
  selectedId: string | null;
  visibleInstanceItems: CollateralItem[];
  instanceSubEvents: EventSubEvent[];
  resolvedActiveEventInstanceId: string;
};

export type AppReadSourceSnapshot = {
  items: ActionItem[];
  issues: IssueRecord[];
  collateralItems: CollateralItem[];
  collateralProfiles: CollateralProfilesByInstance;
  activeEventInstanceId: string;
  eventPrograms?: EventProgram[];
  eventTypes?: EventProgram[];
  eventInstances: EventInstance[];
  eventSubEvents: EventSubEvent[];
  workstreamSchedules: WorkstreamSchedule[];
};

export interface AppReadSource {
  getDashboardSource(): DashboardSourceData;
  getActionListSource(input: { activeEventInstanceId: string }): ActionListSourceData;
  getActionDetailSource(input: { selectedId: string | null }): ActionDetailSourceData;
  getCollateralWorkspaceSource(input: { activeEventInstanceId: string }): CollateralWorkspaceSourceData;
  getCollateralDetailSource(input: {
    activeEventInstanceId: string;
    selectedId: string | null;
    draftCollateralItem: CollateralItem | null;
  }): CollateralDetailSourceData;
}

export type { LegDayCollateralProfile };
