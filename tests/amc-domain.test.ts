import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_FOUNDATION_DATA,
  getAssigneeName,
  getVisibleWorkItems,
  type CurrentUser,
  type WorkItem
} from "../lib/amc-domain";

test("employee visibility is limited to assigned work in their organization", () => {
  const employee: CurrentUser = {
    uid: "user-employee",
    role: "employee",
    displayName: "Operations Coordinator",
    email: "ops@example.com",
    assigneeId: "staff-operations",
    organizationId: DEMO_FOUNDATION_DATA.organization.id
  };

  const visibleItems = getVisibleWorkItems(DEMO_FOUNDATION_DATA.workItems, { viewer: employee });

  assert.deepEqual(visibleItems.map((item) => item.id), ["work-ppma-ceu-application"]);
});

test("admin visibility includes all organization work by default", () => {
  const visibleItems = getVisibleWorkItems(DEMO_FOUNDATION_DATA.workItems, {
    viewer: DEMO_FOUNDATION_DATA.currentUser
  });

  assert.equal(visibleItems.length, DEMO_FOUNDATION_DATA.workItems.length);
});

test("admin visibility can filter by assignee", () => {
  const visibleItems = getVisibleWorkItems(DEMO_FOUNDATION_DATA.workItems, {
    viewer: DEMO_FOUNDATION_DATA.currentUser,
    assigneeId: "staff-operations"
  });

  assert.deepEqual(visibleItems.map((item) => item.id), ["work-ppma-ceu-application"]);
});

test("client association filter applies across the shared work queue", () => {
  const visibleItems = getVisibleWorkItems(DEMO_FOUNDATION_DATA.workItems, {
    viewer: DEMO_FOUNDATION_DATA.currentUser,
    clientAssociationId: "client-western-parks"
  });

  assert.deepEqual(visibleItems.map((item) => item.id), ["work-wpc-sponsor-logo"]);
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
  const items = [...DEMO_FOUNDATION_DATA.workItems, unassignedItem];
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
