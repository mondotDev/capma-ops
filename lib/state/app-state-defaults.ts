import {
  initialLegDayCollateralItems,
  initialLegDayCollateralProfile
} from "@/lib/collateral-data";
import { localCollateralStore } from "@/lib/collateral-store";
import {
  initialEventFamilies,
  initialEventInstances,
  initialEventPrograms,
  initialEventSubEvents,
  initialEventTypes
} from "@/lib/event-instances";
import { nativeActionItemMutator } from "@/lib/native-action-item-mutator";
import { initialActionItems } from "@/lib/sample-data";
import {
  DEFAULT_OWNER,
  getDefaultWorkstreamSchedules
} from "@/lib/ops-utils";
import type { AppStateData, CollateralProfilesByInstance } from "@/lib/state/app-state-types";

export function createDefaultActionItems() {
  return nativeActionItemMutator.normalizeLoaded(initialActionItems, {
    eventPrograms: initialEventPrograms,
    eventInstances: initialEventInstances,
    eventSubEvents: initialEventSubEvents
  });
}

export function createDefaultCollateralItems() {
  return localCollateralStore.normalizeLoaded(
    initialLegDayCollateralItems.map((item) => ({ ...item })),
    {
      eventInstances: initialEventInstances,
      eventSubEvents: initialEventSubEvents
    }
  );
}

export function createDefaultCollateralProfiles(): CollateralProfilesByInstance {
  return {
    [initialEventInstances[0].id]: { ...initialLegDayCollateralProfile }
  };
}

export function createDefaultEventFamilies() {
  return initialEventFamilies.map((family) => ({ ...family }));
}

export function createDefaultEventTypes() {
  return initialEventTypes.map((eventType) => ({ ...eventType }));
}

export function createDefaultEventInstances() {
  return initialEventInstances.map((instance) => ({ ...instance }));
}

export function createDefaultEventSubEvents() {
  return initialEventSubEvents.map((subEvent) => ({ ...subEvent }));
}

export function getDefaultActiveEventInstanceId() {
  return initialEventInstances[0]?.id ?? "";
}

export function getDefaultOwnerForNewItems() {
  return DEFAULT_OWNER;
}

export function createDefaultAppStateData(): AppStateData {
  return {
    items: createDefaultActionItems(),
    issueStatuses: {},
    collateralItems: createDefaultCollateralItems(),
    collateralProfiles: createDefaultCollateralProfiles(),
    activeEventInstanceId: getDefaultActiveEventInstanceId(),
    defaultOwnerForNewItems: getDefaultOwnerForNewItems(),
    eventFamilies: createDefaultEventFamilies(),
    eventTypes: createDefaultEventTypes(),
    eventInstances: createDefaultEventInstances(),
    eventSubEvents: createDefaultEventSubEvents(),
    workstreamSchedules: getDefaultWorkstreamSchedules()
  };
}
