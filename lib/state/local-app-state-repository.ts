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
import {
  normalizeActionItems
} from "@/lib/action-item-mutations";
import { LEGACY_SAMPLE_ITEM_IDS } from "@/lib/sample-data";
import { normalizeActionItemFields } from "@/lib/ops-utils";
import {
  createDefaultActionItems
} from "@/lib/state/app-state-defaults";
import type { AppStateRepository } from "@/lib/state/app-state-repository";
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
      items: normalizeActionItems(parsedState.items, {
        eventInstances: parsedState.eventInstances,
        eventSubEvents: parsedState.eventSubEvents
      }),
      issueStatuses: parsedState.issueStatuses,
      collateralItems: parsedState.collateralItems,
      collateralProfiles: parsedState.collateralProfiles,
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

  load() {
    const result = loadPersistedAppState(normalizeActionItemFields);

    if (!result.state) {
      return result;
    }

    return {
      ...result,
      state: {
        ...result.state,
        items: normalizeActionItems(
          migratePersistedItems(result.state.items, {
            legacySampleItemIds: LEGACY_SAMPLE_ITEM_IDS,
            getDefaultItems: createDefaultActionItems,
            normalizeItem: normalizeActionItemFields
          }),
          {
            eventInstances: result.state.eventInstances,
            eventSubEvents: result.state.eventSubEvents
          }
        )
      }
    };
  }

  save(state: AppStateData) {
    savePersistedAppState(state);
  }
}

export const localAppStateRepository: AppStateRepository = new LocalAppStateRepository();
