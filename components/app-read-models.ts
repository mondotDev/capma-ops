"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppState } from "@/components/app-state";
import type { CollateralProfileDeadlineFilter } from "@/components/collateral-profile-card";
import type { CollateralSummaryFilter } from "@/components/collateral-summary-strip";
import type { CollateralItem } from "@/lib/collateral-data";
import {
  getDashboardSessionReadSelection,
  type DashboardSessionReadSelection
} from "@/lib/firebase-dashboard-source";
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
import type { EventInstance, EventProgram } from "@/lib/event-instances";
import type { DashboardSourceData } from "@/lib/read-source/app-read-source";

const EMPTY_DASHBOARD_SOURCE: DashboardSourceData = {
  items: [],
  issues: [],
  workstreamSchedules: []
};

function useLocalAppReadSource() {
  const {
    activeEventInstanceId,
    collateralItems,
    collateralProfiles,
    eventInstances,
    eventSubEvents,
    eventTypes: eventPrograms,
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
        eventPrograms,
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
      eventPrograms,
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
  isLoading: boolean;
  source: "loading" | "local" | "remote";
} {
  const readSource = useLocalAppReadSource();
  const localDashboardSource = useMemo(() => readSource.getDashboardSource(), [readSource]);
  const [dashboardSessionSource, setDashboardSessionSource] = useState<DashboardSessionReadSelection | null>(null);

  useEffect(() => {
    let isActive = true;

    void getDashboardSessionReadSelection().then((selection) => {
      if (!isActive) {
        return;
      }

      setDashboardSessionSource(selection);
    });

    return () => {
      isActive = false;
    };
  }, []);

  const dashboardSource = useMemo<DashboardSourceData | null>(() => {
    if (!dashboardSessionSource) {
      return null;
    }

    if (dashboardSessionSource.source === "remote") {
      return dashboardSessionSource.dashboardSource;
    }

    return localDashboardSource;
  }, [dashboardSessionSource, localDashboardSource]);
  const resolvedDashboardSource = dashboardSource ?? EMPTY_DASHBOARD_SOURCE;
  const dashboardSummary = useMemo(
    () => getDashboardLiveSummary(resolvedDashboardSource),
    [resolvedDashboardSource]
  );
  const urgentPreviewItems = useMemo(
    () => getDashboardUrgentPreview(resolvedDashboardSource, 2),
    [resolvedDashboardSource]
  );
  const publicationIssueSummaryRows = useMemo(
    () => getPublicationIssueSummary(resolvedDashboardSource),
    [resolvedDashboardSource]
  );

  return {
    dashboardSummary,
    urgentPreviewItems,
    publicationIssueSummaryRows,
    isLoading: dashboardSource === null,
    source: dashboardSessionSource?.source ?? "loading"
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
  eventPrograms: EventProgram[];
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
        eventPrograms: workspaceSource.eventPrograms
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
    eventPrograms: workspaceSource.eventPrograms ?? workspaceSource.eventTypes ?? [],
    eventInstances: workspaceSource.eventInstances
  };
}
