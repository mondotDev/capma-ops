import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_FOUNDATION_DATA,
  COLLATERAL_STATUSES,
  COLLATERAL_TYPES,
  createActionItem,
  createClientAssociation,
  createDefaultBucketsForClient,
  createCollateralItem,
  createCollateralActionItem,
  createWorkBucket,
  DEFAULT_CLIENT_BUCKET_KINDS,
  ensureDefaultBucketsForClients,
  getAssigneeName,
  getBucketWorkspace,
  getFoundationWorkItems,
  getVisibleWorkItems,
  linkCollateralActionItem,
  SESSION_CATEGORIES,
  updateCollateralItem,
  validateActionItemCreateInput,
  validateCollateralItemCreateInput,
  validateClientAssociationCreateInput,
  validateWorkBucketCreateInput,
  type CurrentUser,
  type EducationApplication,
  type SpeakerEngagement,
  type WorkItem
} from "../lib/amc-domain";
import {
  AMC_LOCAL_STATE_STORAGE_KEY,
  addActionItemToAmcLocalState,
  addCollateralActionItemToAmcLocalState,
  addCollateralItemToAmcLocalState,
  addClientAssociationToAmcLocalState,
  addWorkBucketToAmcLocalState,
  createDefaultAmcLocalState,
  loadAmcLocalState,
  saveAmcLocalState,
  updateCollateralItemInAmcLocalState
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

test("work filtering supports bucket, assignee, tracker, status, and unassigned-only filters", () => {
  const workItems = getDemoWorkItems();

  assert.deepEqual(
    getVisibleWorkItems(workItems, {
      viewer: DEMO_FOUNDATION_DATA.currentUser,
      bucketId: "bucket-ppma-annual-conference"
    }).map((item) => item.id),
    ["action-ppma-speaker-confirmations", "collateral-ppma-postcard"]
  );
  assert.deepEqual(
    getVisibleWorkItems(workItems, {
      viewer: DEMO_FOUNDATION_DATA.currentUser,
      assigneeId: "staff-melissa"
    }).map((item) => item.id),
    ["action-ppma-speaker-confirmations", "collateral-ppma-postcard"]
  );
  assert.deepEqual(
    getVisibleWorkItems(workItems, {
      viewer: DEMO_FOUNDATION_DATA.currentUser,
      tracker: "collateral"
    }).map((item) => item.id),
    ["collateral-ppma-postcard"]
  );
  assert.deepEqual(
    getVisibleWorkItems(workItems, {
      viewer: DEMO_FOUNDATION_DATA.currentUser,
      status: "waiting"
    }).map((item) => item.id),
    ["action-wpc-sponsor-logo"]
  );
  assert.deepEqual(
    getVisibleWorkItems(workItems, {
      viewer: DEMO_FOUNDATION_DATA.currentUser,
      unassignedOnly: true
    }).map((item) => item.id),
    ["action-wpc-sponsor-logo"]
  );
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

test("bucket workspace selector returns scoped work and tracker records", () => {
  const workspace = getBucketWorkspace(DEMO_FOUNDATION_DATA, {
    clientId: "client-pacific-pest",
    bucketId: "bucket-ppma-annual-conference"
  });

  assert.equal(workspace.client?.shortName, "PPMA");
  assert.equal(workspace.bucket?.name, "Annual Conference 2026");
  assert.deepEqual(workspace.actionItems.map((item) => item.id), ["action-ppma-speaker-confirmations"]);
  assert.deepEqual(workspace.collateralItems.map((item) => item.id), ["collateral-ppma-postcard"]);
  assert.deepEqual(workspace.speakerEngagements.map((item) => item.id), ["speaker-demo-breakouts"]);
  assert.deepEqual(workspace.educationApplications, []);
  assert.deepEqual(workspace.sponsorFulfillmentRecords, []);
});

test("bucket workspace selector supports empty bucket behavior", () => {
  const workspace = getBucketWorkspace(DEMO_FOUNDATION_DATA, {
    clientId: "client-pacific-pest",
    bucketId: "bucket-ppma-membership"
  });

  assert.equal(workspace.client?.shortName, "PPMA");
  assert.equal(workspace.bucket?.name, "Membership");
  assert.deepEqual(workspace.workItems, []);
  assert.deepEqual(workspace.actionItems, []);
  assert.deepEqual(workspace.collateralItems, []);
  assert.deepEqual(workspace.educationApplications, []);
  assert.deepEqual(workspace.speakerEngagements, []);
});

test("education records support shared session categories and hours", () => {
  const educationRecord: EducationApplication = {
    id: "education-test",
    organizationId: DEMO_FOUNDATION_DATA.organization.id,
    clientAssociationId: "client-pacific-pest",
    bucketId: "bucket-ppma-ceu-program",
    courseTitle: "Branch 2 CEU Session",
    sessionCategory: "Branch 2",
    hours: 3,
    status: "needed",
    assigneeId: null,
    relatedActionItemIds: [],
    notes: ""
  };

  assert.equal(SESSION_CATEGORIES.includes(educationRecord.sessionCategory), true);
  assert.equal(educationRecord.hours, 3);
});

test("education and speaker records share the same session category vocabulary", () => {
  const educationRecord: Pick<EducationApplication, "sessionCategory"> = {
    sessionCategory: "IPM"
  };
  const speakerRecord: Pick<SpeakerEngagement, "sessionCategory"> = {
    sessionCategory: "IPM"
  };

  assert.deepEqual([...SESSION_CATEGORIES], ["R&R", "Branch 1", "Branch 2", "Branch 3", "General", "PUA", "IPM"]);
  assert.equal(educationRecord.sessionCategory, speakerRecord.sessionCategory);
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
  assert.equal(linkedCollateral.collateralType, collateral.collateralType);
  assert.equal(linkedCollateral.channelOrUse, collateral.channelOrUse);
});

test("collateral model requires client association and bucket", () => {
  const validation = validateCollateralItemCreateInput(
    {
      title: "New flyer",
      clientAssociationId: "",
      bucketId: "",
      collateralType: "flyer"
    },
    DEMO_FOUNDATION_DATA
  );

  assert.equal(validation.isValid, false);
  assert.deepEqual(validation.errors, ["Client association is required.", "Bucket is required."]);
});

test("collateral creation preserves assignee and bucket scope", () => {
  const collateral = createCollateralItem(
    {
      title: "Session handout",
      clientAssociationId: "client-pacific-pest",
      bucketId: "bucket-ppma-annual-conference",
      collateralType: "handout",
      status: "drafting",
      assigneeId: "staff-melissa",
      dueDate: "2026-06-08",
      audience: "Attendees",
      channelOrUse: "On-site session",
      notes: "Draft outline first.",
      now: "2026-05-25T12:00:00.000Z"
    },
    DEMO_FOUNDATION_DATA
  );

  assert.equal(collateral.clientAssociationId, "client-pacific-pest");
  assert.equal(collateral.bucketId, "bucket-ppma-annual-conference");
  assert.equal(collateral.assigneeId, "staff-melissa");
  assert.equal(collateral.status, "drafting");
  assert.equal(collateral.createdAt, "2026-05-25T12:00:00.000Z");
  assert.equal(collateral.updatedAt, "2026-05-25T12:00:00.000Z");
});

test("collateral status and type vocabularies include the starting values", () => {
  assert.deepEqual([...COLLATERAL_TYPES], [
    "email",
    "socialPost",
    "flyer",
    "postcard",
    "signage",
    "programBook",
    "websiteUpdate",
    "sponsorRecognition",
    "handout",
    "other"
  ]);
  assert.deepEqual([...COLLATERAL_STATUSES], [
    "notStarted",
    "drafting",
    "waiting",
    "review",
    "approved",
    "scheduled",
    "complete"
  ]);
});

test("collateral records list by bucket through bucket workspace selector", () => {
  const collateral = createCollateralItem(
    {
      title: "Bucket-specific social post",
      clientAssociationId: "client-pacific-pest",
      bucketId: "bucket-ppma-membership",
      collateralType: "socialPost"
    },
    DEMO_FOUNDATION_DATA
  );
  const workspace = getBucketWorkspace(
    {
      ...DEMO_FOUNDATION_DATA,
      collateralItems: [...DEMO_FOUNDATION_DATA.collateralItems, collateral]
    },
    {
      clientId: "client-pacific-pest",
      bucketId: "bucket-ppma-membership"
    }
  );

  assert.deepEqual(workspace.collateralItems.map((item) => item.id), [collateral.id]);
});

test("collateral updates editable fields while preserving scope and related actions", () => {
  const collateral = {
    ...DEMO_FOUNDATION_DATA.collateralItems[0]!,
    relatedActionItemIds: ["action-existing"]
  };
  const updated = updateCollateralItem(collateral, {
    title: "Updated postcard",
    collateralType: "email",
    channelOrUse: "Member reminder email",
    status: "scheduled",
    assigneeId: "staff-operations",
    dueDate: "2026-06-12",
    audience: "Registered attendees",
    notes: "Use final registration list.",
    now: "2026-05-26T09:00:00.000Z"
  });

  assert.equal(updated.title, "Updated postcard");
  assert.equal(updated.collateralType, "email");
  assert.equal(updated.channelOrUse, "Member reminder email");
  assert.equal(updated.status, "scheduled");
  assert.equal(updated.assigneeId, "staff-operations");
  assert.equal(updated.dueDate, "2026-06-12");
  assert.equal(updated.audience, "Registered attendees");
  assert.equal(updated.notes, "Use final registration list.");
  assert.equal(updated.clientAssociationId, collateral.clientAssociationId);
  assert.equal(updated.bucketId, collateral.bucketId);
  assert.deepEqual(updated.relatedActionItemIds, ["action-existing"]);
  assert.equal(updated.createdAt, collateral.createdAt);
  assert.equal(updated.updatedAt, "2026-05-26T09:00:00.000Z");
});

test("collateral update rejects blank title and invalid lifecycle values", () => {
  const collateral = DEMO_FOUNDATION_DATA.collateralItems[0]!;

  assert.throws(() => updateCollateralItem(collateral, { title: " " }), /Collateral title is required/);
  assert.throws(
    () => updateCollateralItem(collateral, { status: "sent" as never }),
    /Collateral status is invalid/
  );
  assert.throws(
    () => updateCollateralItem(collateral, { collateralType: "brochure" as never }),
    /Collateral type is invalid/
  );
});

test("related collateral action item appears in work queue selectors and preserves scope", () => {
  const collateral = createCollateralItem(
    {
      title: "Website update",
      clientAssociationId: "client-pacific-pest",
      bucketId: "bucket-ppma-membership",
      collateralType: "websiteUpdate",
      assigneeId: "staff-operations"
    },
    DEMO_FOUNDATION_DATA
  );
  const actionItem = createCollateralActionItem({
    collateralItem: collateral,
    title: "Draft website copy",
    data: DEMO_FOUNDATION_DATA
  });
  const linkedCollateral = linkCollateralActionItem(collateral, actionItem);
  const workspace = getBucketWorkspace(
    {
      ...DEMO_FOUNDATION_DATA,
      actionItems: [...DEMO_FOUNDATION_DATA.actionItems, actionItem],
      collateralItems: [...DEMO_FOUNDATION_DATA.collateralItems, linkedCollateral]
    },
    {
      clientId: collateral.clientAssociationId,
      bucketId: collateral.bucketId
    }
  );

  assert.equal(actionItem.clientAssociationId, collateral.clientAssociationId);
  assert.equal(actionItem.bucketId, collateral.bucketId);
  assert.equal(actionItem.origin?.tracker, "collateral");
  assert.equal(actionItem.origin?.entityId, collateral.id);
  assert.equal(workspace.actionItems.some((item) => item.id === actionItem.id), true);
  assert.equal(workspace.workItems.some((item) => item.id === actionItem.id), true);
});

test("edited collateral still appears in the correct bucket workspace with related actions connected", () => {
  const collateral = createCollateralItem(
    {
      title: "Draft handout",
      clientAssociationId: "client-pacific-pest",
      bucketId: "bucket-ppma-annual-conference",
      collateralType: "handout",
      status: "drafting"
    },
    DEMO_FOUNDATION_DATA
  );
  const actionItem = createCollateralActionItem({
    collateralItem: collateral,
    title: "Review handout draft",
    data: DEMO_FOUNDATION_DATA
  });
  const linkedCollateral = linkCollateralActionItem(collateral, actionItem);
  const editedCollateral = updateCollateralItem(linkedCollateral, {
    title: "Final handout",
    status: "approved",
    assigneeId: "staff-melissa"
  });
  const workspace = getBucketWorkspace(
    {
      ...DEMO_FOUNDATION_DATA,
      actionItems: [...DEMO_FOUNDATION_DATA.actionItems, actionItem],
      collateralItems: [...DEMO_FOUNDATION_DATA.collateralItems, editedCollateral]
    },
    {
      clientId: collateral.clientAssociationId,
      bucketId: collateral.bucketId
    }
  );

  assert.equal(workspace.collateralItems.some((item) => item.id === editedCollateral.id), true);
  assert.equal(workspace.collateralItems.find((item) => item.id === editedCollateral.id)?.status, "approved");
  assert.deepEqual(
    workspace.collateralItems.find((item) => item.id === editedCollateral.id)?.relatedActionItemIds,
    [actionItem.id]
  );
  assert.equal(workspace.actionItems.some((item) => item.id === actionItem.id), true);
});

test("local state can persist collateral and related collateral action items", () => {
  const snapshot = createDefaultAmcLocalState();
  const collateral = createCollateralItem(
    {
      title: "Local collateral",
      clientAssociationId: "client-pacific-pest",
      bucketId: "bucket-ppma-annual-conference",
      collateralType: "email"
    },
    snapshot
  );
  const withCollateral = addCollateralItemToAmcLocalState(snapshot, collateral);
  const actionItem = createCollateralActionItem({
    collateralItem: collateral,
    title: "Review local collateral",
    data: withCollateral
  });
  const withAction = addCollateralActionItemToAmcLocalState({
    snapshot: withCollateral,
    collateralItemId: collateral.id,
    actionItem
  });

  assert.equal(withAction.actionItems[0]?.id, actionItem.id);
  assert.equal(
    withAction.collateralItems.find((item) => item.id === collateral.id)?.relatedActionItemIds.includes(actionItem.id),
    true
  );
});

test("local state can update collateral without changing scope or related action links", () => {
  const snapshot = createDefaultAmcLocalState();
  const collateral = {
    ...snapshot.collateralItems[0]!,
    relatedActionItemIds: ["action-existing"]
  };
  const withCollateral = {
    ...snapshot,
    collateralItems: [collateral, ...snapshot.collateralItems.slice(1)]
  };
  const updatedSnapshot = updateCollateralItemInAmcLocalState(withCollateral, collateral.id, {
    title: "Updated local collateral",
    status: "complete",
    assigneeId: null,
    now: "2026-05-26T10:00:00.000Z"
  });
  const updated = updatedSnapshot.collateralItems.find((item) => item.id === collateral.id)!;

  assert.equal(updated.title, "Updated local collateral");
  assert.equal(updated.status, "complete");
  assert.equal(updated.assigneeId, null);
  assert.equal(updated.clientAssociationId, collateral.clientAssociationId);
  assert.equal(updated.bucketId, collateral.bucketId);
  assert.deepEqual(updated.relatedActionItemIds, ["action-existing"]);
  assert.equal(updated.updatedAt, "2026-05-26T10:00:00.000Z");
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
