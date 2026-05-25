import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_FOUNDATION_DATA,
  createActionItem,
  createCollateralActionItem,
  getAssigneeName,
  getFoundationWorkItems,
  getVisibleWorkItems,
  linkCollateralActionItem,
  validateActionItemCreateInput,
  type CurrentUser,
  type WorkItem
} from "../lib/amc-domain";
import {
  AMC_LOCAL_STATE_STORAGE_KEY,
  addActionItemToAmcLocalState,
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
