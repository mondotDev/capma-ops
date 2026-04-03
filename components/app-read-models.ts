"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStateValues } from "@/components/app-state";
import type { CollateralProfileDeadlineFilter } from "@/components/collateral-profile-card";
import type { CollateralSummaryFilter } from "@/components/collateral-summary-strip";
import type { CollateralItem } from "@/lib/collateral-data";
import {
  getCollateralCreateTraceId,
  traceCollateralCreate
} from "@/lib/collateral-create-trace";
import {
  getDashboardSessionReadSelection,
  type DashboardSessionReadSelection
} from "@/lib/firebase-dashboard-source";
import {
  getActionListViewData,
  getPublicationIssueWorkspaceSummary,
  getSelectedActionItemWorkspace,
  type ActionDetailWorkspaceData,
  type ActionListViewData,
  type PublicationIssueWorkspaceSummary
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
import type { ActionSummaryCounts } from "@/lib/ops-utils";
import type { ActionViewFilters } from "@/lib/action-view-utils";
import type { EventInstance, EventProgram } from "@/lib/event-instances";
import type { DashboardSourceData } from "@/lib/read-source/app-read-source";

const EMPTY_DASHBOARD_SOURCE: DashboardSourceData = {
  executionItems: [],
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
  } = useAppStateValues();

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

// Guardrail:
// Mutation-capable surfaces (Action View, Collateral, Settings)
// must remain single-authority per session.
// Do not introduce remote reads here unless writes move with it.
// See docs/read-write-coherence.md

export function useActionViewReadModel(input: {
  filters: ActionViewFilters;
  selectedId: string | null;
}): {
  actionListView: ActionListViewData;
  publicationIssueWorkspace: PublicationIssueWorkspaceSummary | null;
  selectedWorkspace: ActionDetailWorkspaceData;
  summaryCounts: ActionSummaryCounts;
  eventInstances: EventInstance[];
  eventPrograms: EventProgram[];
  activeEventInstanceId: string;
} {
  // Keep Action View fully local until there is an explicit read/write coherence policy
  // for mutation-heavy screens. Do not add Firebase list/detail reads here yet.
  const { activeEventInstanceId } = useAppStateValues();
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
  const publicationIssueWorkspace = useMemo(
    () =>
      getPublicationIssueWorkspaceSummary({
        activeIssue: input.filters.activeIssue,
        issues: actionDetailSource.issues,
        items: actionListSource.items
      }),
    [actionDetailSource.issues, actionListSource.items, input.filters.activeIssue]
  );

  return {
    actionListView,
    publicationIssueWorkspace,
    selectedWorkspace,
    summaryCounts: actionListView.summaryCounts,
    eventInstances: actionListSource.eventInstances,
    eventPrograms: actionListSource.eventPrograms ?? actionListSource.eventTypes ?? [],
    activeEventInstanceId
  };
}

export function useCollateralWorkspaceReadModel(input: {
  activeSummaryFilter: CollateralSummaryFilter;
  activeProfileDeadlineFilter: CollateralProfileDeadlineFilter;
  selectedId: string | null;
  draftCollateralItem: CollateralItem | null;
  showArchived: boolean;
}): {
  workspaceBundle: CollateralEventInstanceWorkspaceBundle;
  collateralListView: CollateralInstanceListView;
  selectedWorkspace: SelectedCollateralItemWorkspace;
  eventPrograms: EventProgram[];
  eventInstances: EventInstance[];
} {
  // Keep Collateral fully local until Action View-style coherence rules are defined.
  // Collateral is an operational workspace, not a safe remote-read-only surface yet.
  const { activeEventInstanceId } = useAppStateValues();
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
        draftCollateralItem: input.draftCollateralItem,
        showArchived: input.showArchived
      }),
    [
      input.activeProfileDeadlineFilter,
      input.activeSummaryFilter,
      input.draftCollateralItem,
      input.showArchived,
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

  useEffect(() => {
    const traceId = getCollateralCreateTraceId();

    if (!traceId) {
      return;
    }

    const workspaceItem = workspaceSource.collateralItems.find((item) => item.id === traceId) ?? null;
    const visibleItem = collateralListView.visibleInstanceItems.find((item) => item.id === traceId) ?? null;
    const groupedPresence = collateralListView.groupedItems.find(([, items]) =>
      items.some((item) => item.id === traceId)
    );

    traceCollateralCreate("read-model-workspace", {
      traceId,
      activeEventInstanceId,
      resolvedActiveEventInstanceId: workspaceBundle.resolvedActiveEventInstanceId,
      activeSummaryFilter: input.activeSummaryFilter,
      activeProfileDeadlineFilter: input.activeProfileDeadlineFilter,
      showArchived: input.showArchived,
      inWorkspaceSource: workspaceItem
        ? {
            id: workspaceItem.id,
            eventInstanceId: workspaceItem.eventInstanceId,
            subEventId: workspaceItem.subEventId,
            status: workspaceItem.status,
            archivedAt: workspaceItem.archivedAt
          }
        : null,
      inVisibleItems: visibleItem
        ? {
            id: visibleItem.id,
            eventInstanceId: visibleItem.eventInstanceId,
            subEventId: visibleItem.subEventId,
            status: visibleItem.status,
            archivedAt: visibleItem.archivedAt
          }
        : null,
      groupedUnder: groupedPresence?.[0] ?? null,
      groupedIds: collateralListView.groupedItems.flatMap(([, items]) => items.map((item) => item.id)),
      selectedId: input.selectedId
    });
  }, [
    activeEventInstanceId,
    collateralListView.groupedItems,
    collateralListView.visibleInstanceItems,
    input.activeProfileDeadlineFilter,
    input.activeSummaryFilter,
    input.selectedId,
    input.showArchived,
    workspaceBundle.resolvedActiveEventInstanceId,
    workspaceSource.collateralItems
  ]);

  return {
    workspaceBundle,
    collateralListView,
    selectedWorkspace,
    eventPrograms: workspaceSource.eventPrograms ?? workspaceSource.eventTypes ?? [],
    eventInstances: workspaceSource.eventInstances
  };
}

