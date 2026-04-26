import {
  createAppStateSnapshot,
  parseImportedAppState
} from "@/lib/app-transfer";
import {
  clearPersistedAppState,
  loadPersistedAppState,
  migratePersistedItems,
  savePersistedAppState
} from "@/lib/app-persistence";
import { nativeActionItemMutator } from "@/lib/native-action-item-mutator";
import { LEGACY_SAMPLE_ITEM_IDS } from "@/lib/sample-data";
import { normalizeActionItemFields } from "@/lib/ops-utils";
import {
  createDefaultActionItems
} from "@/lib/state/app-state-defaults";
import type { AppStateRepository, LoadAppStateResult } from "@/lib/state/app-state-repository";
import type { AppStateData } from "@/lib/state/app-state-types";

class LocalAppStateRepository implements AppStateRepository {
  clear() {
    clearPersistedAppState();
  }

  export(state: AppStateData) {
    return createAppStateSnapshot(
      state.items,
      state.issueStatuses,
      state.collateralItems,
      state.collateralProfiles,
      state.sponsorshipSetupByInstance,
      state.fulfillmentStateByInstance,
      state.activeEventInstanceId,
      state.defaultOwnerForNewItems,
      state.eventFamilies,
      state.eventTypes,
      state.eventInstances,
      state.eventSubEvents,
      state.workstreamSchedules
    );
  }

  import(value: unknown) {
    const parsedState = parseImportedAppState(value);

    if (!parsedState) {
      throw new Error("That file is not a valid CAPMA Ops Hub backup.");
    }

    return {
      items: nativeActionItemMutator.normalizeLoaded(parsedState.items, {
        eventPrograms: parsedState.eventTypes,
        eventInstances: parsedState.eventInstances,
        eventSubEvents: parsedState.eventSubEvents
      }),
      issueStatuses: parsedState.issueStatuses,
      collateralItems: parsedState.collateralItems,
      collateralProfiles: parsedState.collateralProfiles,
      sponsorshipSetupByInstance: parsedState.sponsorshipSetupByInstance,
      fulfillmentStateByInstance: parsedState.fulfillmentStateByInstance,
      activeEventInstanceId: parsedState.activeEventInstanceId,
      defaultOwnerForNewItems: parsedState.defaultOwnerForNewItems,
      eventFamilies: parsedState.eventFamilies,
      eventTypes: parsedState.eventTypes,
      eventInstances: parsedState.eventInstances,
      eventSubEvents: parsedState.eventSubEvents,
      workstreamSchedules: parsedState.workstreamSchedules,
      itemCount: parsedState.items.length,
      usedLegacyFormat: parsedState.usedLegacyFormat
    };
  }

  load(): LoadAppStateResult {
    const result = loadPersistedAppState(normalizeActionItemFields);

    if (!result.state) {
      return {
        ...result,
        state: null
      };
    }

    return {
      ...result,
      state: {
        ...result.state,
        sponsorshipSetupByInstance: result.state.sponsorshipSetupByInstance ?? {},
        fulfillmentStateByInstance: result.state.fulfillmentStateByInstance ?? {},
        items: nativeActionItemMutator.normalizeLoaded(
          migratePersistedItems(result.state.items, {
            legacySampleItemIds: LEGACY_SAMPLE_ITEM_IDS,
            getDefaultItems: createDefaultActionItems,
            normalizeItem: normalizeActionItemFields
          }),
          {
            eventPrograms: result.state.eventTypes,
            eventInstances: result.state.eventInstances,
            eventSubEvents: result.state.eventSubEvents
          }
        )
      }
    };
  }

  save(state: AppStateData) {
    const result = savePersistedAppState(state);

    if (!result.ok && typeof console !== "undefined") {
      console.warn(
        `CAPMA Ops Hub could not persist local state (${result.status}). Continuing with in-memory state for this session.`
      );
    }
  }
}

export const localAppStateRepository: AppStateRepository = new LocalAppStateRepository();
