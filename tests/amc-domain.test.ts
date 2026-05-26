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
  createSponsorFulfillmentActionItem,
  createSponsorFulfillmentCollateralItem,
  createSponsorFulfillmentRecord,
  createWorkBucket,
  DEFAULT_CLIENT_BUCKET_KINDS,
  ensureDefaultBucketsForClients,
  generateBucketLabel,
  getAssigneeName,
  getBucketDisplayLabel,
  getBucketDropdownOptions,
  getBucketOptionLabel,
  getBucketWorkspace,
  getCurrentBuckets,
  getCycleLabel,
  getFoundationWorkItems,
  getPastBuckets,
  getRecentBucketsByProgramSeries,
  getSearchableBuckets,
  getVisibleWorkItems,
  isBucketArchived,
  isBucketCurrent,
  isBucketPast,
  linkCollateralActionItem,
  linkSponsorFulfillmentActionItem,
  linkSponsorFulfillmentCollateralItem,
  SESSION_CATEGORIES,
  SPONSOR_FULFILLMENT_STATUS_LABELS,
  SPONSOR_FULFILLMENT_TYPE_LABELS,
  updateCollateralItem,
  updateSponsorFulfillmentRecord,
  validateActionItemCreateInput,
  validateCollateralItemCreateInput,
  validateClientAssociationCreateInput,
  validateSponsorFulfillmentCreateInput,
  validateWorkBucketCreateInput,
  COLLATERAL_TYPE_LABELS,
  WORK_BUCKET_KIND_LABELS,
  WORK_BUCKET_STATUS_LABELS,
  WORK_STATUS_LABELS,
  WORK_TRACKER_LABELS,
  type CurrentUser,
  type EducationApplication,
  type SpeakerEngagement,
  type WorkBucket,
  type WorkItem
} from "../lib/amc-domain";
import {
  AMC_LOCAL_STATE_STORAGE_KEY,
  addActionItemToAmcLocalState,
  addCollateralActionItemToAmcLocalState,
  addCollateralItemToAmcLocalState,
  addClientAssociationToAmcLocalState,
  addSponsorFulfillmentActionItemToAmcLocalState,
  addSponsorFulfillmentCollateralItemToAmcLocalState,
  addSponsorFulfillmentRecordToAmcLocalState,
  addWorkBucketToAmcLocalState,
  createDefaultAmcLocalState,
  loadAmcLocalState,
  saveAmcLocalState,
  updateCollateralItemInAmcLocalState,
  updateSponsorFulfillmentRecordInAmcLocalState
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

  assert.equal(
    visibleItems.length,
    DEMO_FOUNDATION_DATA.actionItems.length +
      DEMO_FOUNDATION_DATA.collateralItems.length +
      DEMO_FOUNDATION_DATA.sponsorFulfillmentRecords.length
  );
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

  assert.deepEqual(visibleItems.map((item) => item.id), ["action-wpc-sponsor-logo", "sponsor-demo-logo"]);
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
    ["action-wpc-sponsor-logo", "sponsor-demo-logo"]
  );
  assert.deepEqual(
    getVisibleWorkItems(workItems, {
      viewer: DEMO_FOUNDATION_DATA.currentUser,
      unassignedOnly: true
    }).map((item) => item.id),
    ["action-wpc-sponsor-logo", "sponsor-demo-logo"]
  );
  assert.deepEqual(
    getVisibleWorkItems(workItems, {
      viewer: DEMO_FOUNDATION_DATA.currentUser,
      tracker: "sponsorFulfillment"
    }).map((item) => item.id),
    ["action-wpc-sponsor-logo", "sponsor-demo-logo"]
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
  assert.equal(workspace.bucket?.id, "bucket-ppma-annual-conference");
  assert.equal(
    getBucketDisplayLabel(workspace.bucket!, DEMO_FOUNDATION_DATA.programSeries.find((series) => series.id === workspace.bucket?.programSeriesId)),
    "Annual Conference 2026"
  );
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

test("existing bucket-linked records remain connected by bucketId", () => {
  const ppmaWorkspace = getBucketWorkspace(DEMO_FOUNDATION_DATA, {
    clientId: "client-pacific-pest",
    bucketId: "bucket-ppma-annual-conference"
  });
  const wpcWorkspace = getBucketWorkspace(DEMO_FOUNDATION_DATA, {
    clientId: "client-western-parks",
    bucketId: "bucket-wpc-sponsor-fulfillment"
  });

  assert.deepEqual(ppmaWorkspace.actionItems.map((item) => item.bucketId), ["bucket-ppma-annual-conference"]);
  assert.deepEqual(ppmaWorkspace.collateralItems.map((item) => item.bucketId), ["bucket-ppma-annual-conference"]);
  assert.deepEqual(wpcWorkspace.sponsorFulfillmentRecords.map((item) => item.bucketId), ["bucket-wpc-sponsor-fulfillment"]);
});

test("bucket option labels include client context and distinguish duplicate bucket names", () => {
  const ppmaMembership = DEMO_FOUNDATION_DATA.buckets.find((bucket) => bucket.id === "bucket-ppma-membership")!;
  const wpcMembership = {
    ...ppmaMembership,
    id: "bucket-wpc-membership",
    clientAssociationId: "client-western-parks"
  };

  assert.equal(
    getBucketOptionLabel({ bucket: ppmaMembership, clients: DEMO_FOUNDATION_DATA.clients, includeKind: true }),
    "PPMA / Membership (Membership)"
  );
  assert.equal(
    getBucketOptionLabel({ bucket: wpcMembership, clients: DEMO_FOUNDATION_DATA.clients, includeKind: true }),
    "WPC / Membership (Membership)"
  );
});

test("bucket option labels fall back to client name when short name is missing", () => {
  const client = {
    ...DEMO_FOUNDATION_DATA.clients[0]!,
    shortName: ""
  };
  const bucket = DEMO_FOUNDATION_DATA.buckets.find((candidate) => candidate.clientAssociationId === client.id)!;

  assert.equal(
    getBucketOptionLabel({ bucket, clients: [client], includeKind: false }),
    `${client.name} / ${bucket.name}`
  );
});

test("bucket label helpers generate annual, monthly, quarterly, and ongoing labels", () => {
  assert.equal(
    generateBucketLabel({
      programSeriesName: "Best Pest Expo",
      recurrence: "annual",
      startsAt: "2026-04-15"
    }),
    "Best Pest Expo 2026"
  );
  assert.equal(getCycleLabel({ recurrence: "monthly", startsAt: "2026-06-01" }), "June 2026");
  assert.equal(
    generateBucketLabel({
      programSeriesName: "News Brief",
      recurrence: "monthly",
      startsAt: "2026-06-01"
    }),
    "News Brief - June 2026"
  );
  assert.equal(
    generateBucketLabel({
      programSeriesName: "The Voice",
      recurrence: "quarterly",
      startsAt: "2026-07-01"
    }),
    "The Voice - Q3 2026"
  );
  assert.equal(
    generateBucketLabel({
      programSeriesName: "General Operations",
      recurrence: "ongoing"
    }),
    "General Operations"
  );
});

test("bucket lifecycle selectors detect current, past, complete, canceled, and archived buckets", () => {
  const referenceDate = new Date("2026-05-26T12:00:00.000Z");
  const currentBucket: WorkBucket = makeTestBucket({
    id: "bucket-current",
    status: "production",
    startsAt: "2026-06-01",
    closeoutDueAt: "2026-06-30"
  });
  const datePastBucket: WorkBucket = makeTestBucket({
    id: "bucket-date-past",
    status: "live",
    startsAt: "2026-01-01",
    closeoutDueAt: "2026-02-01"
  });
  const completeBucket = makeTestBucket({ id: "bucket-complete", status: "complete" });
  const canceledBucket = makeTestBucket({ id: "bucket-canceled", status: "canceled" });
  const archivedBucket = makeTestBucket({ id: "bucket-archived", status: "archived", isArchived: true });

  assert.equal(isBucketCurrent(currentBucket, referenceDate), true);
  assert.equal(isBucketPast(datePastBucket, referenceDate), true);
  assert.equal(isBucketPast(completeBucket, referenceDate), true);
  assert.equal(isBucketPast(canceledBucket, referenceDate), true);
  assert.equal(isBucketArchived(archivedBucket), true);
  assert.deepEqual(getCurrentBuckets([currentBucket, datePastBucket, completeBucket, archivedBucket], referenceDate).map((bucket) => bucket.id), [
    "bucket-current"
  ]);
  assert.deepEqual(getPastBuckets([currentBucket, datePastBucket, completeBucket, canceledBucket, archivedBucket], referenceDate).map((bucket) => bucket.id), [
    "bucket-date-past",
    "bucket-complete",
    "bucket-canceled"
  ]);
});

test("bucket dropdown options exclude archived buckets by default and include last 3 previous buckets per ProgramSeries", () => {
  const referenceDate = new Date("2026-05-26T12:00:00.000Z");
  const buckets: WorkBucket[] = [
    makeTestBucket({ id: "bucket-2027", programSeriesId: "series-expo", status: "planning", startsAt: "2027-04-01", closeoutDueAt: "2027-05-01" }),
    makeTestBucket({ id: "bucket-2026", programSeriesId: "series-expo", status: "complete", startsAt: "2026-04-01", closeoutDueAt: "2026-05-01" }),
    makeTestBucket({ id: "bucket-2025", programSeriesId: "series-expo", status: "complete", startsAt: "2025-04-01", closeoutDueAt: "2025-05-01" }),
    makeTestBucket({ id: "bucket-2024", programSeriesId: "series-expo", status: "complete", startsAt: "2024-04-01", closeoutDueAt: "2024-05-01" }),
    makeTestBucket({ id: "bucket-2023", programSeriesId: "series-expo", status: "complete", startsAt: "2023-04-01", closeoutDueAt: "2023-05-01" }),
    makeTestBucket({ id: "bucket-archived", programSeriesId: "series-expo", status: "archived", isArchived: true, startsAt: "2022-04-01" })
  ];

  assert.deepEqual(
    getRecentBucketsByProgramSeries({ buckets, programSeriesId: "series-expo", referenceDate }).map((bucket) => bucket.id),
    ["bucket-2026", "bucket-2025", "bucket-2024"]
  );
  assert.deepEqual(
    getBucketDropdownOptions({ buckets, referenceDate }).map((bucket) => bucket.id),
    ["bucket-2027", "bucket-2026", "bucket-2025", "bucket-2024"]
  );
  assert.equal(getBucketDropdownOptions({ buckets, referenceDate }).some((bucket) => bucket.id === "bucket-archived"), false);
  assert.equal(getBucketDropdownOptions({ buckets, referenceDate, includeArchived: true }).some((bucket) => bucket.id === "bucket-archived"), true);
});

test("searchable buckets can include archived records when search or include archived asks for them", () => {
  const archivedBucket = makeTestBucket({
    id: "bucket-archived-news",
    name: "News Brief - January 2025",
    generatedLabel: "News Brief - January 2025",
    status: "archived",
    isArchived: true
  });

  assert.equal(getSearchableBuckets({ buckets: [archivedBucket] }).length, 0);
  assert.equal(getSearchableBuckets({ buckets: [archivedBucket], includeArchived: true }).length, 1);
  assert.equal(getSearchableBuckets({ buckets: [archivedBucket], query: "January 2025" }).length, 1);
});

test("human-readable labels cover greenfield work enums", () => {
  assert.equal(WORK_BUCKET_KIND_LABELS.educationProgram, "Education program");
  assert.equal(WORK_BUCKET_KIND_LABELS.sponsorFulfillment, "Sponsor fulfillment");
  assert.equal(WORK_BUCKET_STATUS_LABELS.planning, "Planning");
  assert.equal(WORK_STATUS_LABELS.notStarted, "Not started");
  assert.equal(WORK_STATUS_LABELS.inProgress, "In progress");
  assert.equal(WORK_TRACKER_LABELS.sponsorFulfillment, "Sponsor fulfillment");
  assert.equal(COLLATERAL_TYPE_LABELS.socialPost, "Social post");
  assert.equal(COLLATERAL_TYPE_LABELS.websiteUpdate, "Website update");
  assert.equal(COLLATERAL_TYPE_LABELS.programBook, "Program book");
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

test("sponsor fulfillment model requires client association and bucket", () => {
  const validation = validateSponsorFulfillmentCreateInput(
    {
      sponsorName: "Acme Sponsor",
      fulfillmentTitle: "Logo in email",
      clientAssociationId: "",
      bucketId: "",
      fulfillmentType: "logoRecognition"
    },
    DEMO_FOUNDATION_DATA
  );

  assert.equal(validation.isValid, false);
  assert.deepEqual(validation.errors, ["Client association is required.", "Bucket is required."]);
});

test("sponsor fulfillment creation preserves assignee and bucket scope", () => {
  const sponsorFulfillment = createSponsorFulfillmentRecord(
    {
      sponsorName: "Acme Sponsor",
      fulfillmentTitle: "Logo in event reminder email",
      clientAssociationId: "client-western-parks",
      bucketId: "bucket-wpc-sponsor-fulfillment",
      fulfillmentType: "logoRecognition",
      status: "inProgress",
      assigneeId: "staff-melissa",
      dueDate: "2026-06-21",
      notes: "Needs approval copy.",
      now: "2026-05-25T12:00:00.000Z"
    },
    DEMO_FOUNDATION_DATA
  );

  assert.equal(sponsorFulfillment.clientAssociationId, "client-western-parks");
  assert.equal(sponsorFulfillment.bucketId, "bucket-wpc-sponsor-fulfillment");
  assert.equal(sponsorFulfillment.assigneeId, "staff-melissa");
  assert.equal(sponsorFulfillment.status, "inProgress");
  assert.deepEqual(sponsorFulfillment.relatedCollateralIds, []);
  assert.deepEqual(sponsorFulfillment.relatedActionItemIds, []);
  assert.equal(sponsorFulfillment.createdAt, "2026-05-25T12:00:00.000Z");
});

test("sponsor fulfillment records list by bucket through bucket workspace selector", () => {
  const sponsorFulfillment = createSponsorFulfillmentRecord(
    {
      sponsorName: "Acme Sponsor",
      fulfillmentTitle: "Program ad",
      clientAssociationId: "client-pacific-pest",
      bucketId: "bucket-ppma-annual-conference",
      fulfillmentType: "programAd"
    },
    DEMO_FOUNDATION_DATA
  );
  const workspace = getBucketWorkspace(
    {
      ...DEMO_FOUNDATION_DATA,
      sponsorFulfillmentRecords: [...DEMO_FOUNDATION_DATA.sponsorFulfillmentRecords, sponsorFulfillment]
    },
    {
      clientId: sponsorFulfillment.clientAssociationId,
      bucketId: sponsorFulfillment.bucketId
    }
  );

  assert.equal(workspace.sponsorFulfillmentRecords.some((item) => item.id === sponsorFulfillment.id), true);
});

test("sponsor fulfillment updates status and assignee while preserving scope", () => {
  const sponsorFulfillment = DEMO_FOUNDATION_DATA.sponsorFulfillmentRecords[0]!;
  const updated = updateSponsorFulfillmentRecord(sponsorFulfillment, {
    status: "readyForReview",
    assigneeId: "staff-operations",
    now: "2026-05-26T12:00:00.000Z"
  });

  assert.equal(updated.status, "readyForReview");
  assert.equal(updated.assigneeId, "staff-operations");
  assert.equal(updated.clientAssociationId, sponsorFulfillment.clientAssociationId);
  assert.equal(updated.bucketId, sponsorFulfillment.bucketId);
  assert.deepEqual(updated.relatedActionItemIds, sponsorFulfillment.relatedActionItemIds);
  assert.deepEqual(updated.relatedCollateralIds, sponsorFulfillment.relatedCollateralIds);
  assert.equal(updated.updatedAt, "2026-05-26T12:00:00.000Z");
});

test("sponsor fulfillment can create related action items and collateral", () => {
  const sponsorFulfillment = createSponsorFulfillmentRecord(
    {
      sponsorName: "Acme Sponsor",
      fulfillmentTitle: "Logo recognition in event reminder email",
      clientAssociationId: "client-western-parks",
      bucketId: "bucket-wpc-sponsor-fulfillment",
      fulfillmentType: "logoRecognition",
      assigneeId: "staff-melissa"
    },
    DEMO_FOUNDATION_DATA
  );
  const actionItem = createSponsorFulfillmentActionItem({
    sponsorFulfillment,
    title: "Collect sponsor logo and approval copy",
    data: DEMO_FOUNDATION_DATA
  });
  const collateralItem = createSponsorFulfillmentCollateralItem({
    sponsorFulfillment,
    title: "Annual conference reminder email",
    collateralType: "email",
    data: DEMO_FOUNDATION_DATA
  });
  const linkedActionSponsor = linkSponsorFulfillmentActionItem(sponsorFulfillment, actionItem);
  const linkedSponsor = linkSponsorFulfillmentCollateralItem(linkedActionSponsor, collateralItem);
  const workspace = getBucketWorkspace(
    {
      ...DEMO_FOUNDATION_DATA,
      actionItems: [...DEMO_FOUNDATION_DATA.actionItems, actionItem],
      collateralItems: [...DEMO_FOUNDATION_DATA.collateralItems, collateralItem],
      sponsorFulfillmentRecords: [...DEMO_FOUNDATION_DATA.sponsorFulfillmentRecords, linkedSponsor]
    },
    {
      clientId: sponsorFulfillment.clientAssociationId,
      bucketId: sponsorFulfillment.bucketId
    }
  );

  assert.equal(actionItem.clientAssociationId, sponsorFulfillment.clientAssociationId);
  assert.equal(actionItem.bucketId, sponsorFulfillment.bucketId);
  assert.equal(actionItem.origin?.tracker, "sponsorFulfillment");
  assert.equal(actionItem.origin?.entityId, sponsorFulfillment.id);
  assert.equal(collateralItem.clientAssociationId, sponsorFulfillment.clientAssociationId);
  assert.equal(collateralItem.bucketId, sponsorFulfillment.bucketId);
  assert.deepEqual(collateralItem.relatedSponsorFulfillmentIds, [sponsorFulfillment.id]);
  assert.equal(workspace.actionItems.some((item) => item.id === actionItem.id), true);
  assert.equal(workspace.collateralItems.some((item) => item.id === collateralItem.id), true);
  assert.deepEqual(workspace.sponsorFulfillmentRecords.find((item) => item.id === linkedSponsor.id)?.relatedActionItemIds, [actionItem.id]);
  assert.deepEqual(workspace.sponsorFulfillmentRecords.find((item) => item.id === linkedSponsor.id)?.relatedCollateralIds, [collateralItem.id]);
});

test("local state can persist sponsor fulfillment with related action items and collateral", () => {
  const snapshot = createDefaultAmcLocalState();
  const sponsorFulfillment = createSponsorFulfillmentRecord(
    {
      sponsorName: "Local Sponsor",
      fulfillmentTitle: "Social mention",
      clientAssociationId: "client-western-parks",
      bucketId: "bucket-wpc-sponsor-fulfillment",
      fulfillmentType: "socialMention"
    },
    snapshot
  );
  const withSponsor = addSponsorFulfillmentRecordToAmcLocalState(snapshot, sponsorFulfillment);
  const updatedSponsorState = updateSponsorFulfillmentRecordInAmcLocalState(withSponsor, sponsorFulfillment.id, {
    status: "blocked",
    assigneeId: "staff-operations"
  });
  const actionItem = createSponsorFulfillmentActionItem({
    sponsorFulfillment,
    title: "Ask sponsor for copy",
    data: updatedSponsorState
  });
  const withAction = addSponsorFulfillmentActionItemToAmcLocalState({
    snapshot: updatedSponsorState,
    sponsorFulfillmentId: sponsorFulfillment.id,
    actionItem
  });
  const collateralItem = createSponsorFulfillmentCollateralItem({
    sponsorFulfillment,
    title: "Sponsor social post",
    collateralType: "socialPost",
    data: withAction
  });
  const withCollateral = addSponsorFulfillmentCollateralItemToAmcLocalState({
    snapshot: withAction,
    sponsorFulfillmentId: sponsorFulfillment.id,
    collateralItem
  });
  const persistedSponsor = withCollateral.sponsorFulfillmentRecords.find((item) => item.id === sponsorFulfillment.id)!;

  assert.equal(persistedSponsor.status, "blocked");
  assert.equal(persistedSponsor.assigneeId, "staff-operations");
  assert.deepEqual(persistedSponsor.relatedActionItemIds, [actionItem.id]);
  assert.deepEqual(persistedSponsor.relatedCollateralIds, [collateralItem.id]);
  assert.equal(withCollateral.actionItems[0]?.id, actionItem.id);
  assert.equal(withCollateral.collateralItems[0]?.id, collateralItem.id);
});

test("human-readable sponsor fulfillment labels cover starting values", () => {
  assert.equal(SPONSOR_FULFILLMENT_TYPE_LABELS.logoRecognition, "Logo recognition");
  assert.equal(SPONSOR_FULFILLMENT_TYPE_LABELS.emailMention, "Email mention");
  assert.equal(SPONSOR_FULFILLMENT_STATUS_LABELS.readyForReview, "Ready for review");
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
    collateralItems: DEMO_FOUNDATION_DATA.collateralItems,
    sponsorFulfillmentRecords: DEMO_FOUNDATION_DATA.sponsorFulfillmentRecords
  });
}

function makeTestBucket(overrides: Partial<WorkBucket> = {}): WorkBucket {
  return {
    id: "bucket-test",
    organizationId: DEMO_FOUNDATION_DATA.organization.id,
    clientAssociationId: "client-pacific-pest",
    programSeriesId: "series-test",
    kind: "event",
    name: "Test Bucket",
    generatedLabel: "Test Bucket",
    cycleLabel: "",
    status: "planning",
    recurrence: "annual",
    planningStartsAt: "",
    startsAt: "",
    endsAt: "",
    closeoutDueAt: "",
    deliveryFormat: "notApplicable",
    locationName: "",
    locationType: "notApplicable",
    ownerId: null,
    previousBucketId: null,
    isArchived: false,
    archivedAt: "",
    notes: "",
    createdAt: "2026-05-01T12:00:00.000Z",
    updatedAt: "2026-05-01T12:00:00.000Z",
    ...overrides
  };
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
