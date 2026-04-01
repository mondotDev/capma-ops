"use client";

import { useMemo } from "react";
import { useAppState } from "@/components/app-state";
import type { CollateralProfileDeadlineFilter } from "@/components/collateral-profile-card";
import type { CollateralSummaryFilter } from "@/components/collateral-summary-strip";
import type { CollateralItem } from "@/lib/collateral-data";
import {
  getActionListViewData,
  getSelectedActionItemWorkspace,
  type ActionDetailWorkspaceData,
  type ActionListViewData
} from "@/lib/queries/action/action-view-queries";
import {
  getCollateralEventInstanceWorkspaceBundle,
  getCollateralInstanceListView,
  getSelectedCollateralItemWorkspace,
  type CollateralEventInstanceWorkspaceBundle,
  type CollateralInstanceListView,
  type SelectedCollateralItemWorkspace
} from "@/lib/queries/collateral/collateral-workspace-queries";
import {
  getDashboardLiveSummary,
  getDashboardUrgentPreview,
  getPublicationIssueSummary,
  type DashboardLiveSummary,
  type DashboardUrgentPreviewItem,
  type PublicationIssueSummaryRow
} from "@/lib/queries/dashboard/dashboard-queries";
import { createLocalAppReadSource } from "@/lib/read-source/local-app-read-source";
import { getActionSummaryCounts, type ActionSummaryCounts } from "@/lib/ops-utils";
import type { ActionViewFilters } from "@/lib/action-view-utils";
import type { EventInstance, EventType } from "@/lib/event-instances";

function useLocalAppReadSource() {
  const {
    activeEventInstanceId,
    collateralItems,
    collateralProfiles,
    eventInstances,
    eventSubEvents,
    eventTypes,
    issues,
    items,
    workstreamSchedules
  } = useAppState();

  return useMemo(
    () =>
      createLocalAppReadSource({
        items,
        issues,
        collateralItems,
        collateralProfiles,
        activeEventInstanceId,
        eventTypes,
        eventInstances,
        eventSubEvents,
        workstreamSchedules
      }),
    [
      activeEventInstanceId,
      collateralItems,
      collateralProfiles,
      eventInstances,
      eventSubEvents,
      eventTypes,
      issues,
      items,
      workstreamSchedules
    ]
  );
}

export function useDashboardReadModel(): {
  dashboardSummary: DashboardLiveSummary;
  urgentPreviewItems: DashboardUrgentPreviewItem[];
  publicationIssueSummaryRows: PublicationIssueSummaryRow[];
} {
  const readSource = useLocalAppReadSource();
  const dashboardSource = useMemo(() => readSource.getDashboardSource(), [readSource]);
  const dashboardSummary = useMemo(() => getDashboardLiveSummary(dashboardSource), [dashboardSource]);
  const urgentPreviewItems = useMemo(() => getDashboardUrgentPreview(dashboardSource, 2), [dashboardSource]);
  const publicationIssueSummaryRows = useMemo(() => getPublicationIssueSummary(dashboardSource), [dashboardSource]);

  return {
    dashboardSummary,
    urgentPreviewItems,
    publicationIssueSummaryRows
  };
}

export function useActionViewReadModel(input: {
  filters: ActionViewFilters;
  selectedId: string | null;
}): {
  actionListView: ActionListViewData;
  selectedWorkspace: ActionDetailWorkspaceData;
  summaryCounts: ActionSummaryCounts;
  eventInstances: EventInstance[];
  activeEventInstanceId: string;
} {
  const { activeEventInstanceId } = useAppState();
  const readSource = useLocalAppReadSource();
  const actionListSource = useMemo(
    () => readSource.getActionListSource({ activeEventInstanceId }),
    [activeEventInstanceId, readSource]
  );
  const actionListView = useMemo(
    () =>
      getActionListViewData({
        ...actionListSource,
        activeEventInstanceId,
        filters: input.filters
      }),
    [actionListSource, activeEventInstanceId, input.filters]
  );
  const actionDetailSource = useMemo(
    () => readSource.getActionDetailSource({ selectedId: input.selectedId }),
    [input.selectedId, readSource]
  );
  const selectedWorkspace = useMemo(
    () =>
      getSelectedActionItemWorkspace({
        selectedItem: actionDetailSource.selectedItem,
        issues: actionDetailSource.issues,
        selectedItemSubEvents: actionDetailSource.selectedItemSubEvents
      }),
    [actionDetailSource]
  );
  const summaryCounts = useMemo(() => getActionSummaryCounts(actionListSource.items), [actionListSource.items]);

  return {
    actionListView,
    selectedWorkspace,
    summaryCounts,
    eventInstances: actionListSource.eventInstances,
    activeEventInstanceId
  };
}

export function useCollateralWorkspaceReadModel(input: {
  activeSummaryFilter: CollateralSummaryFilter;
  activeProfileDeadlineFilter: CollateralProfileDeadlineFilter;
  selectedId: string | null;
  draftCollateralItem: CollateralItem | null;
}): {
  workspaceBundle: CollateralEventInstanceWorkspaceBundle;
  collateralListView: CollateralInstanceListView;
  selectedWorkspace: SelectedCollateralItemWorkspace;
  eventTypes: EventType[];
  eventInstances: EventInstance[];
} {
  const { activeEventInstanceId } = useAppState();
  const readSource = useLocalAppReadSource();
  const workspaceSource = useMemo(
    () => readSource.getCollateralWorkspaceSource({ activeEventInstanceId }),
    [activeEventInstanceId, readSource]
  );
  const workspaceBundle = useMemo(
    () =>
      getCollateralEventInstanceWorkspaceBundle({
        activeEventInstanceId: workspaceSource.activeEventInstanceId,
        collateralItems: workspaceSource.collateralItems,
        collateralProfiles: workspaceSource.collateralProfiles,
        eventInstances: workspaceSource.eventInstances,
        eventSubEvents: workspaceSource.eventSubEvents,
        eventTypes: workspaceSource.eventTypes
      }),
    [workspaceSource]
  );
  const collateralListView = useMemo(
    () =>
      getCollateralInstanceListView({
        collateralItems: workspaceSource.collateralItems,
        resolvedActiveEventInstanceId: workspaceBundle.resolvedActiveEventInstanceId,
        instanceSubEvents: workspaceBundle.instanceSubEvents,
        activeProfile: workspaceBundle.activeProfile,
        activeSummaryFilter: input.activeSummaryFilter,
        activeProfileDeadlineFilter: input.activeProfileDeadlineFilter,
        draftCollateralItem: input.draftCollateralItem
      }),
    [
      input.activeProfileDeadlineFilter,
      input.activeSummaryFilter,
      input.draftCollateralItem,
      workspaceBundle,
      workspaceSource.collateralItems
    ]
  );
  const collateralDetailSource = useMemo(
    () =>
      readSource.getCollateralDetailSource({
        activeEventInstanceId: workspaceBundle.resolvedActiveEventInstanceId,
        selectedId: input.selectedId,
        draftCollateralItem: input.draftCollateralItem
      }),
    [input.draftCollateralItem, input.selectedId, readSource, workspaceBundle.resolvedActiveEventInstanceId]
  );
  const selectedWorkspace = useMemo(
    () => getSelectedCollateralItemWorkspace(collateralDetailSource),
    [collateralDetailSource]
  );

  return {
    workspaceBundle,
    collateralListView,
    selectedWorkspace,
    eventTypes: workspaceSource.eventTypes,
    eventInstances: workspaceSource.eventInstances
  };
}
