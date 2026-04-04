import { loadLocalScriptEnv } from "@/lib/script-env";
import { getFirestoreDb, isFirebaseConfigured } from "@/lib/firebase";
import {
  createFirestoreCollateralPersistenceStore,
  loadExistingFirestoreCollateralStateDocument
} from "@/lib/firestore-collateral-persistence-store";
import { getAppStateRepository } from "@/lib/state/app-state-repository-provider";
import { createDefaultAppStateData } from "@/lib/state/app-state-defaults";

type BootstrapMode = "dry-run" | "write";

function main() {
  loadLocalScriptEnv();
  const options = parseArgs(process.argv.slice(2));

  bootstrapCollateralState(options.mode).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

async function bootstrapCollateralState(mode: BootstrapMode) {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Set the NEXT_PUBLIC_FIREBASE_* values before bootstrapping collateral state.");
  }

  const firestore = getFirestoreDb();

  if (!firestore) {
    throw new Error("Firestore is unavailable. The collateral bootstrap cannot continue.");
  }

  const existingRemoteDocument = await loadExistingFirestoreCollateralStateDocument({
    getDb: () => firestore,
    isConfigured: () => true
  });

  if (existingRemoteDocument) {
    throw new Error(
      "Remote collateral state already exists in Firestore. Bootstrap only initializes missing remote state and will not overwrite an existing bundle."
    );
  }

  const loadResult = getAppStateRepository().load();

  if (!loadResult.state) {
    throw new Error(
      "No local CAPMA Ops state is available to bootstrap collateral from. Open the app in local mode first so the collateral bundle exists locally."
    );
  }

  const localState = loadResult.state;
  const persistedCollateralState = {
    collateralItems: localState.collateralItems,
    collateralProfiles: localState.collateralProfiles,
    sponsorPlacementsByInstance: localState.sponsorPlacementsByInstance,
    eventInstances: localState.eventInstances,
    eventSubEvents: localState.eventSubEvents
  };
  const defaultState = createDefaultAppStateData();
  const store = createFirestoreCollateralPersistenceStore({
    getDb: () => firestore,
    isConfigured: () => true
  });

  if (mode === "dry-run") {
    printSummary({
      mode,
      collateralItemCount: persistedCollateralState.collateralItems.length,
      eventInstanceCount: persistedCollateralState.eventInstances.length,
      eventSubEventCount: persistedCollateralState.eventSubEvents.length,
      collateralProfileCount: Object.keys(persistedCollateralState.collateralProfiles).length,
      sourceState: loadResult.shouldPersist ? "local-snapshot" : "in-memory-defaults",
      activeEventInstanceIdLocalOnly: localState.activeEventInstanceId,
      defaultOwnerUsedForNormalization:
        localState.defaultOwnerForNewItems || defaultState.defaultOwnerForNewItems
    });
    return;
  }

  const normalizedState = await store.replaceAll(persistedCollateralState, {
    defaultOwner: localState.defaultOwnerForNewItems || defaultState.defaultOwnerForNewItems,
    eventTypes: localState.eventTypes
  });

  printSummary({
    mode,
    collateralItemCount: normalizedState.collateralItems.length,
    eventInstanceCount: normalizedState.eventInstances.length,
    eventSubEventCount: normalizedState.eventSubEvents.length,
    collateralProfileCount: Object.keys(normalizedState.collateralProfiles).length,
    sourceState: loadResult.shouldPersist ? "local-snapshot" : "in-memory-defaults",
    activeEventInstanceIdLocalOnly: localState.activeEventInstanceId,
    defaultOwnerUsedForNormalization:
      localState.defaultOwnerForNewItems || defaultState.defaultOwnerForNewItems
  });
}

function parseArgs(args: string[]) {
  let mode: BootstrapMode = "dry-run";

  for (const arg of args) {
    if (arg === "--write") {
      mode = "write";
      continue;
    }

    if (arg === "--dry-run") {
      mode = "dry-run";
    }
  }

  return { mode };
}

function printSummary(summary: {
  mode: BootstrapMode;
  collateralItemCount: number;
  eventInstanceCount: number;
  eventSubEventCount: number;
  collateralProfileCount: number;
  sourceState: "local-snapshot" | "in-memory-defaults";
  activeEventInstanceIdLocalOnly: string;
  defaultOwnerUsedForNormalization: string;
}) {
  console.log("Collateral Firestore bootstrap summary");
  console.log(JSON.stringify(summary, null, 2));
  console.log("");
  console.log("Notes:");
  console.log("- This initializes only the persisted collateral bundle.");
  console.log("- activeEventInstanceId remains local-only and was not written.");
  console.log("- Existing remote collateral state is never overwritten by this script.");
}

main();
