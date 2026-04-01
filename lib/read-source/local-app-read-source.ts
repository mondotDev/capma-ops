import { resolveActiveEventInstanceId } from "@/lib/event-instances";
import type { CollateralItem } from "@/lib/collateral-data";
import type {
  ActionDetailSourceData,
  ActionListSourceData,
  AppReadSource,
  AppReadSourceSnapshot,
  CollateralDetailSourceData,
  CollateralWorkspaceSourceData,
  DashboardSourceData
} from "@/lib/read-source/app-read-source";

class LocalAppReadSource implements AppReadSource {
  constructor(private readonly snapshot: AppReadSourceSnapshot) {}

  getDashboardSource(): DashboardSourceData {
    return {
      items: this.snapshot.items,
      issues: this.snapshot.issues,
      workstreamSchedules: this.snapshot.workstreamSchedules
    };
  }

  getActionListSource(_input: { activeEventInstanceId: string }): ActionListSourceData {
    return {
      items: this.snapshot.items,
      collateralItems: this.snapshot.collateralItems,
      eventInstances: this.snapshot.eventInstances,
      eventSubEvents: this.snapshot.eventSubEvents,
      eventPrograms: this.snapshot.eventPrograms ?? this.snapshot.eventTypes ?? [],
      eventTypes: this.snapshot.eventPrograms ?? this.snapshot.eventTypes ?? []
    };
  }

  getActionDetailSource(input: { selectedId: string | null }): ActionDetailSourceData {
    const selectedItem =
      input.selectedId
        ? this.snapshot.items.find((item) => item.id === input.selectedId) ?? null
        : null;

    return {
      selectedItem,
      issues: this.snapshot.issues,
      selectedItemSubEvents: selectedItem?.eventInstanceId
        ? this.snapshot.eventSubEvents.filter((subEvent) => subEvent.eventInstanceId === selectedItem.eventInstanceId)
        : []
    };
  }

  getCollateralWorkspaceSource(input: { activeEventInstanceId: string }): CollateralWorkspaceSourceData {
    const resolvedActiveEventInstanceId = resolveActiveEventInstanceId(
      input.activeEventInstanceId,
      this.snapshot.eventInstances
    );

    return {
      activeEventInstanceId: resolvedActiveEventInstanceId,
      collateralItems: this.snapshot.collateralItems.filter(
        (item) => item.eventInstanceId === resolvedActiveEventInstanceId
      ),
      collateralProfiles: this.snapshot.collateralProfiles[resolvedActiveEventInstanceId]
        ? { [resolvedActiveEventInstanceId]: this.snapshot.collateralProfiles[resolvedActiveEventInstanceId] }
        : {},
      eventInstances: this.snapshot.eventInstances,
      eventSubEvents: this.snapshot.eventSubEvents.filter(
        (subEvent) => subEvent.eventInstanceId === resolvedActiveEventInstanceId
      ),
      eventPrograms: this.snapshot.eventPrograms ?? this.snapshot.eventTypes ?? [],
      eventTypes: this.snapshot.eventPrograms ?? this.snapshot.eventTypes ?? []
    };
  }

  getCollateralDetailSource(input: {
    activeEventInstanceId: string;
    selectedId: string | null;
    draftCollateralItem: CollateralItem | null;
  }): CollateralDetailSourceData {
    const resolvedActiveEventInstanceId = resolveActiveEventInstanceId(
      input.activeEventInstanceId,
      this.snapshot.eventInstances
    );
    const instanceItems = this.snapshot.collateralItems.filter(
      (item) => item.eventInstanceId === resolvedActiveEventInstanceId
    );
    const visibleInstanceItems =
      input.draftCollateralItem && input.draftCollateralItem.eventInstanceId === resolvedActiveEventInstanceId
        ? [
            input.draftCollateralItem,
            ...instanceItems.filter((item) => item.id !== input.draftCollateralItem?.id)
          ]
        : instanceItems;

    return {
      selectedId: input.selectedId,
      visibleInstanceItems,
      instanceSubEvents: this.snapshot.eventSubEvents.filter(
        (subEvent) => subEvent.eventInstanceId === resolvedActiveEventInstanceId
      ),
      resolvedActiveEventInstanceId
    };
  }
}

export function createLocalAppReadSource(snapshot: AppReadSourceSnapshot): AppReadSource {
  return new LocalAppReadSource(snapshot);
}
