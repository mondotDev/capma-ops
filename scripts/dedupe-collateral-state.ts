import { loadLocalScriptEnv } from "@/lib/script-env";
import { createFirestoreCollateralPersistenceStore } from "@/lib/firestore-collateral-persistence-store";
import { getFirestoreDb, isFirebaseConfigured } from "@/lib/firebase";
import { removeObviousCollateralDuplicates } from "@/lib/collateral-dedupe";
import { getCollateralPersistenceStoreMode } from "@/lib/collateral-persistence-store";
import { getAppStateRepository } from "@/lib/state/app-state-repository-provider";
import { createDefaultAppStateData } from "@/lib/state/app-state-defaults";

type CleanupMode = "dry-run" | "write";

function main() {
  loadLocalScriptEnv();
  const options = parseArgs(process.argv.slice(2));

  dedupeCollateralState(options.mode).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

async function dedupeCollateralState(mode: CleanupMode) {
  const collateralStoreMode = getCollateralPersistenceStoreMode();
  const defaults = createDefaultAppStateData();

  if (collateralStoreMode === "local") {
    const loadResult = getAppStateRepository().load();

    if (!loadResult.state) {
      throw new Error("No local CAPMA Ops state is available to clean up.");
    }

    const result = removeObviousCollateralDuplicates(loadResult.state.collateralItems);

    printSummary({
      mode,
      source: "local",
      originalCount: loadResult.state.collateralItems.length,
      dedupedCount: result.items.length,
      duplicateGroupCount: result.duplicateGroups.length,
      duplicateRowCount: result.duplicateGroups.reduce((sum, group) => sum + group.removeIds.length, 0),
      duplicateGroups: result.duplicateGroups
    });

    if (mode === "write" && result.duplicateGroups.length > 0) {
      getAppStateRepository().save({
        ...loadResult.state,
        collateralItems: result.items
      });
    }

    return;
  }

  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured. Set the NEXT_PUBLIC_FIREBASE_* values before deduping collateral state.");
  }

  const firestore = getFirestoreDb();
  if (!firestore) {
    throw new Error("Firestore is unavailable. The collateral dedupe cannot continue.");
  }

  const store = createFirestoreCollateralPersistenceStore({
    getDb: () => firestore,
    isConfigured: () => true
  });

  const currentState = await store.load(
    {
      collateralItems: [],
      collateralProfiles: {},
      sponsorPlacementsByInstance: {},
      eventInstances: [],
      eventSubEvents: []
    },
    {
      defaultOwner: defaults.defaultOwnerForNewItems,
      eventTypes: defaults.eventTypes
    }
  );

  const result = removeObviousCollateralDuplicates(currentState.collateralItems);

  printSummary({
    mode,
    source: "firebase",
    originalCount: currentState.collateralItems.length,
    dedupedCount: result.items.length,
    duplicateGroupCount: result.duplicateGroups.length,
    duplicateRowCount: result.duplicateGroups.reduce((sum, group) => sum + group.removeIds.length, 0),
    duplicateGroups: result.duplicateGroups
  });

  if (mode === "dry-run" || result.duplicateGroups.length === 0) {
    return;
  }

  await store.replaceAll(
    {
      ...currentState,
      collateralItems: result.items
    },
    {
      defaultOwner: defaults.defaultOwnerForNewItems,
      eventTypes: defaults.eventTypes
    }
  );
}

function parseArgs(args: string[]) {
  let mode: CleanupMode = "dry-run";

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
  mode: CleanupMode;
  source: "local" | "firebase";
  originalCount: number;
  dedupedCount: number;
  duplicateGroupCount: number;
  duplicateRowCount: number;
  duplicateGroups: ReturnType<typeof removeObviousCollateralDuplicates>["duplicateGroups"];
}) {
  console.log("Collateral duplicate cleanup summary");
  console.log(
    JSON.stringify(
      {
        mode: summary.mode,
        source: summary.source,
        originalCount: summary.originalCount,
        dedupedCount: summary.dedupedCount,
        duplicateGroupCount: summary.duplicateGroupCount,
        duplicateRowCount: summary.duplicateRowCount
      },
      null,
      2
    )
  );

  if (summary.duplicateGroups.length === 0) {
    console.log("\nNo obvious duplicate collateral groups found.");
    return;
  }

  console.log("\nDuplicate groups:");
  for (const group of summary.duplicateGroups) {
    console.log(
      `- [${group.reason}] ${group.itemName} | instance=${group.eventInstanceId} | subEvent=${group.subEventId} | keep=${group.keepId} | remove=${group.removeIds.join(", ")}`
    );
  }
}

main();
