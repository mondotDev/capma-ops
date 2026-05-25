import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_FOUNDATION_DATA,
  createActionItem,
  createClientAssociation,
  createDefaultBucketsForClient,
  createCollateralActionItem,
  createWorkBucket,
  DEFAULT_CLIENT_BUCKET_KINDS,
  ensureDefaultBucketsForClients,
  getAssigneeName,
  getFoundationWorkItems,
  getVisibleWorkItems,
  linkCollateralActionItem,
  validateActionItemCreateInput,
  validateClientAssociationCreateInput,
  validateWorkBucketCreateInput,
  type CurrentUser,
  type WorkItem
} from "../lib/amc-domain";
import {
  AMC_LOCAL_STATE_STORAGE_KEY,
  addActionItemToAmcLocalState,
  addClientAssociationToAmcLocalState,
  addWorkBucketToAmcLocalState,
  createDefaultAmcLocalState,
  loadAmcLocalState,
  saveAmcLocalState
} from "../lib/amc-local-state";

test("employee visibility is limited to assigned work in their organization", () => {
  const employee: CurrentUser = {
    uid: "user-employee",
    role: "employee",
    displayName: "Operations Coordinator",
    email: "ops@example.com",
    assigneeId: "staff-operations",
    organizationId: DEMO_FOUNDATION_DATA.organization.id
  };

  const visibleItems = getVisibleWorkItems(getDemoWorkItems(), { viewer: employee });

  assert.deepEqual(visibleItems.map((item) => item.id), ["action-ppma-ceu-application"]);
});

test("admin visibility includes all organization work by default", () => {
  const visibleItems = getVisibleWorkItems(getDemoWorkItems(), {
    viewer: DEMO_FOUNDATION_DATA.currentUser
  });

  assert.equal(visibleItems.length, DEMO_FOUNDATION_DATA.actionItems.length + DEMO_FOUNDATION_DATA.collateralItems.length);
});

test("admin visibility can filter by assignee", () => {
  const visibleItems = getVisibleWorkItems(getDemoWorkItems(), {
    viewer: DEMO_FOUNDATION_DATA.currentUser,
    assigneeId: "staff-operations"
  });

  assert.deepEqual(visibleItems.map((item) => item.id), ["action-ppma-ceu-application"]);
});

test("client association filter applies across the shared work queue", () => {
  const visibleItems = getVisibleWorkItems(getDemoWorkItems(), {
    viewer: DEMO_FOUNDATION_DATA.currentUser,
    clientAssociationId: "client-western-parks"
  });

  assert.deepEqual(visibleItems.map((item) => item.id), ["action-wpc-sponsor-logo"]);
});

test("unassigned work is visible to admins but not employees", () => {
  const unassignedItem: WorkItem = {
    id: "work-unassigned",
    organizationId: DEMO_FOUNDATION_DATA.organization.id,
    clientAssociationId: "client-pacific-pest",
    bucketId: "bucket-ppma-annual-conference",
    tracker: "action",
    title: "Assign post-event survey follow-up",
    status: "notStarted",
    assigneeId: null,
    dueDate: "2026-06-25"
  };
  const items = [...getDemoWorkItems(), unassignedItem];
  const employee: CurrentUser = {
    ...DEMO_FOUNDATION_DATA.currentUser,
    role: "employee"
  };

  assert.equal(
    getVisibleWorkItems(items, { viewer: DEMO_FOUNDATION_DATA.currentUser }).some((item) => item.id === unassignedItem.id),
    true
  );
  assert.equal(getVisibleWorkItems(items, { viewer: employee }).some((item) => item.id === unassignedItem.id), false);
  assert.equal(getAssigneeName(DEMO_FOUNDATION_DATA.staff, null), "Unassigned");
});

test("action item creation requires client association and bucket", () => {
  assert.deepEqual(
    validateActionItemCreateInput(
      {
        title: "Call venue",
        clientAssociationId: "",
        bucketId: ""
      },
      DEMO_FOUNDATION_DATA
    ).errors,
    ["Client association is required.", "Bucket is required."]
  );
});

test("action item creation requires bucket to belong to selected client", () => {
  const validation = validateActionItemCreateInput(
    {
      title: "Call venue",
      clientAssociationId: "client-pacific-pest",
      bucketId: "bucket-wpc-sponsor-fulfillment"
    },
    DEMO_FOUNDATION_DATA
  );

  assert.equal(validation.isValid, false);
  assert.deepEqual(validation.errors, ["Bucket must belong to the selected client association."]);
});

test("action item creation keeps assignee and due date optional", () => {
  const actionItem = createActionItem(
    {
      title: "Confirm registration page copy",
      clientAssociationId: "client-pacific-pest",
      bucketId: "bucket-ppma-annual-conference"
    },
    DEMO_FOUNDATION_DATA
  );

  assert.equal(actionItem.status, "notStarted");
  assert.equal(actionItem.assigneeId, null);
  assert.equal(actionItem.dueDate, "");
  assert.equal(actionItem.clientAssociationId, "client-pacific-pest");
  assert.equal(actionItem.bucketId, "bucket-ppma-annual-conference");
});

test("collateral can create and link action items while retaining collateral fields", () => {
  const collateral = DEMO_FOUNDATION_DATA.collateralItems[0]!;
  const actionItem = createCollateralActionItem({
    collateralItem: collateral,
    title: "Send postcard proof to printer",
    data: DEMO_FOUNDATION_DATA
  });
  const linkedCollateral = linkCollateralActionItem(collateral, actionItem);

  assert.equal(actionItem.clientAssociationId, collateral.clientAssociationId);
  assert.equal(actionItem.bucketId, collateral.bucketId);
  assert.equal(actionItem.origin?.tracker, "collateral");
  assert.equal(actionItem.relatedEntities[0]?.entityId, collateral.id);
  assert.equal(linkedCollateral.relatedActionItemIds.includes(actionItem.id), true);
  assert.equal(linkedCollateral.printer, collateral.printer);
  assert.equal(linkedCollateral.quantity, collateral.quantity);
});

test("v2 local state loads defaults when storage is empty or malformed", () => {
  const emptyStorage = createMemoryStorage();
  const malformedStorage = createMemoryStorage({
    [AMC_LOCAL_STATE_STORAGE_KEY]: "{bad json"
  });

  assert.equal(loadAmcLocalState(emptyStorage).organization.id, DEMO_FOUNDATION_DATA.organization.id);
  assert.equal(loadAmcLocalState(malformedStorage).organization.id, DEMO_FOUNDATION_DATA.organization.id);
});

test("v2 local state saves and reloads action items", () => {
  const storage = createMemoryStorage();
  const snapshot = createDefaultAmcLocalState();
  const actionItem = createActionItem(
    {
      title: "Persisted local action",
      clientAssociationId: "client-pacific-pest",
      bucketId: "bucket-ppma-annual-conference"
    },
    DEMO_FOUNDATION_DATA
  );
  const nextSnapshot = addActionItemToAmcLocalState(snapshot, actionItem);

  saveAmcLocalState(nextSnapshot, storage);

  const reloaded = loadAmcLocalState(storage);
  assert.equal(reloaded.actionItems[0]?.id, actionItem.id);
  assert.equal(reloaded.actionItems[0]?.title, "Persisted local action");
});

test("client association creation requires name and short name", () => {
  const validation = validateClientAssociationCreateInput({
    name: "",
    shortName: ""
  });

  assert.equal(validation.isValid, false);
  assert.deepEqual(validation.errors, ["Client name is required.", "Client short name is required."]);
});

test("client association creation defaults to active status", () => {
  const client = createClientAssociation(
    {
      name: "New Trade Association",
      shortName: "NTA"
    },
    DEMO_FOUNDATION_DATA
  );

  assert.equal(client.organizationId, DEMO_FOUNDATION_DATA.organization.id);
  assert.equal(client.name, "New Trade Association");
  assert.equal(client.shortName, "NTA");
  assert.equal(client.status, "active");
});

test("work bucket creation requires a valid client and name", () => {
  const validation = validateWorkBucketCreateInput(
    {
      clientAssociationId: "missing-client",
      kind: "event",
      name: ""
    },
    DEMO_FOUNDATION_DATA
  );

  assert.equal(validation.isValid, false);
  assert.deepEqual(validation.errors, ["Client association is required.", "Bucket name is required."]);
});

test("event creation is represented as a client-scoped event bucket", () => {
  const bucket = createWorkBucket(
    {
      clientAssociationId: "client-pacific-pest",
      kind: "event",
      name: "Summer Leadership Summit"
    },
    DEMO_FOUNDATION_DATA
  );

  assert.equal(bucket.clientAssociationId, "client-pacific-pest");
  assert.equal(bucket.kind, "event");
  assert.equal(bucket.status, "planning");
});

test("v2 local state persists added clients and buckets", () => {
  const storage = createMemoryStorage();
  const snapshot = createDefaultAmcLocalState();
  const client = createClientAssociation(
    {
      name: "Regional Operators Council",
      shortName: "ROC"
    },
    DEMO_FOUNDATION_DATA
  );
  const withClient = addClientAssociationToAmcLocalState(snapshot, client);
  const bucket = createWorkBucket(
    {
      clientAssociationId: client.id,
      kind: "event",
      name: "ROC Annual Meeting"
    },
    withClient
  );
  const withBucket = addWorkBucketToAmcLocalState(withClient, bucket);

  saveAmcLocalState(withBucket, storage);
  const reloaded = loadAmcLocalState(storage);

  assert.equal(reloaded.clients.some((candidate) => candidate.id === client.id), true);
  assert.equal(reloaded.buckets.some((candidate) => candidate.id === bucket.id), true);
});

test("seeded clients include membership and general operations buckets", () => {
  for (const client of DEMO_FOUNDATION_DATA.clients) {
    const clientBucketKinds = DEMO_FOUNDATION_DATA.buckets
      .filter((bucket) => bucket.clientAssociationId === client.id)
      .map((bucket) => bucket.kind);

    assert.equal(clientBucketKinds.includes("membership"), true);
    assert.equal(clientBucketKinds.includes("generalOperations"), true);
  }
});

test("new clients get default membership and general operations buckets", () => {
  const snapshot = createDefaultAmcLocalState();
  const client = createClientAssociation(
    {
      name: "Default Bucket Association",
      shortName: "DBA"
    },
    snapshot
  );
  const nextSnapshot = addClientAssociationToAmcLocalState(snapshot, client);
  const clientBuckets = nextSnapshot.buckets.filter((bucket) => bucket.clientAssociationId === client.id);

  assert.deepEqual(
    clientBuckets.map((bucket) => bucket.kind).sort(),
    [...DEFAULT_CLIENT_BUCKET_KINDS].sort()
  );
  assert.deepEqual(
    clientBuckets.map((bucket) => bucket.name).sort(),
    ["General Operations", "Membership"]
  );
});

test("default bucket creation does not duplicate existing defaults", () => {
  const existingBuckets = [
    createWorkBucket(
      {
        clientAssociationId: "client-pacific-pest",
        kind: "membership",
        name: "Membership"
      },
      DEMO_FOUNDATION_DATA
    )
  ];
  const defaults = createDefaultBucketsForClient({
    clientAssociationId: "client-pacific-pest",
    organizationId: DEMO_FOUNDATION_DATA.organization.id,
    existingBuckets
  });

  assert.deepEqual(defaults.map((bucket) => bucket.kind), ["generalOperations"]);
});

test("normalizing local state backfills missing default client buckets", () => {
  const bucketsWithoutDefaults = DEMO_FOUNDATION_DATA.buckets.filter(
    (bucket) => bucket.kind !== "membership" && bucket.kind !== "generalOperations"
  );
  const normalizedBuckets = ensureDefaultBucketsForClients(
    DEMO_FOUNDATION_DATA.clients,
    bucketsWithoutDefaults,
    DEMO_FOUNDATION_DATA.organization.id
  );

  for (const client of DEMO_FOUNDATION_DATA.clients) {
    const kinds = normalizedBuckets.filter((bucket) => bucket.clientAssociationId === client.id).map((bucket) => bucket.kind);

    assert.equal(kinds.includes("membership"), true);
    assert.equal(kinds.includes("generalOperations"), true);
  }
});

function getDemoWorkItems() {
  return getFoundationWorkItems({
    actionItems: DEMO_FOUNDATION_DATA.actionItems,
    collateralItems: DEMO_FOUNDATION_DATA.collateralItems
  });
}

function createMemoryStorage(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    }
  };
}
