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
import type { SponsorshipSetupByInstance } from "@/lib/sponsor-fulfillment";
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

export function createEmptyActionItems() {
  return [] as ReturnType<typeof createDefaultActionItems>;
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

export function createEmptyCollateralItems() {
  return [] as ReturnType<typeof createDefaultCollateralItems>;
}

export function createDefaultCollateralProfiles(): CollateralProfilesByInstance {
  return {
    [initialEventInstances[0].id]: { ...initialLegDayCollateralProfile }
  };
}

export function createEmptyCollateralProfiles(): CollateralProfilesByInstance {
  return {};
}

export function createDefaultSponsorshipSetupByInstance(): SponsorshipSetupByInstance {
  return {};
}

export function createEmptySponsorshipSetupByInstance(): SponsorshipSetupByInstance {
  return {};
}

export function createDefaultEventFamilies() {
  return initialEventFamilies.map((family) => ({ ...family }));
}

export function createEmptyEventFamilies() {
  return [] as ReturnType<typeof createDefaultEventFamilies>;
}

export function createDefaultEventTypes() {
  return initialEventTypes.map((eventType) => ({ ...eventType }));
}

export function createEmptyEventTypes() {
  return [] as ReturnType<typeof createDefaultEventTypes>;
}

export function createDefaultEventInstances() {
  return initialEventInstances.map((instance) => ({ ...instance }));
}

export function createEmptyEventInstances() {
  return [] as ReturnType<typeof createDefaultEventInstances>;
}

export function createDefaultEventSubEvents() {
  return initialEventSubEvents.map((subEvent) => ({ ...subEvent }));
}

export function createEmptyEventSubEvents() {
  return [] as ReturnType<typeof createDefaultEventSubEvents>;
}

export function getDefaultActiveEventInstanceId() {
  return initialEventInstances[0]?.id ?? "";
}

export function getEmptyActiveEventInstanceId() {
  return "";
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
    sponsorshipSetupByInstance: createDefaultSponsorshipSetupByInstance(),
    activeEventInstanceId: getDefaultActiveEventInstanceId(),
    defaultOwnerForNewItems: getDefaultOwnerForNewItems(),
    eventFamilies: createDefaultEventFamilies(),
    eventTypes: createDefaultEventTypes(),
    eventInstances: createDefaultEventInstances(),
    eventSubEvents: createDefaultEventSubEvents(),
    workstreamSchedules: getDefaultWorkstreamSchedules()
  };
}

export function createEmptyAppStateData(): AppStateData {
  return {
    items: createEmptyActionItems(),
    issueStatuses: {},
    collateralItems: createEmptyCollateralItems(),
    collateralProfiles: createEmptyCollateralProfiles(),
    sponsorshipSetupByInstance: createEmptySponsorshipSetupByInstance(),
    activeEventInstanceId: getEmptyActiveEventInstanceId(),
    defaultOwnerForNewItems: getDefaultOwnerForNewItems(),
    eventFamilies: createEmptyEventFamilies(),
    eventTypes: createEmptyEventTypes(),
    eventInstances: createEmptyEventInstances(),
    eventSubEvents: createEmptyEventSubEvents(),
    workstreamSchedules: getDefaultWorkstreamSchedules()
  };
}
