export const PRODUCT_NAME = "AMC Ops Hub";

export type AmcUserRole = "admin" | "employee";

export type ClientAssociationStatus = "active" | "paused" | "archived";

export type WorkBucketKind =
  | "event"
  | "educationProgram"
  | "publicationIssue"
  | "sponsorFulfillment"
  | "membership"
  | "generalOperations"
  | "internalOps";

export type WorkTrackerKind =
  | "action"
  | "collateral"
  | "education"
  | "speaker"
  | "sponsorFulfillment";

export type WorkStatus = "notStarted" | "inProgress" | "waiting" | "blocked" | "complete";

export const SESSION_CATEGORIES = ["R&R", "Branch 1", "Branch 2", "Branch 3", "General", "PUA", "IPM"] as const;

export type SessionCategory = (typeof SESSION_CATEGORIES)[number];

export const COLLATERAL_TYPES = [
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
] as const;

export const COLLATERAL_STATUSES = [
  "notStarted",
  "drafting",
  "waiting",
  "review",
  "approved",
  "scheduled",
  "complete"
] as const;

export type CollateralType = (typeof COLLATERAL_TYPES)[number];

export type CollateralStatus = (typeof COLLATERAL_STATUSES)[number];

export type RelationshipEntityType =
  | "actionItem"
  | "collateralItem"
  | "educationApplication"
  | "speakerEngagement"
  | "sponsorDeliverable";

export interface RelatedEntityRef {
  entityType: RelationshipEntityType;
  entityId: string;
}

export interface WorkOrigin {
  tracker: WorkTrackerKind;
  entityType: RelationshipEntityType;
  entityId: string;
}

export interface AmcOrganization {
  id: string;
  name: string;
}

export interface ClientAssociation {
  id: string;
  organizationId: string;
  name: string;
  shortName: string;
  status: ClientAssociationStatus;
}

export interface ClientAssociationCreateInput {
  name: string;
  shortName: string;
  status?: ClientAssociationStatus;
}

export interface StaffProfile {
  id: string;
  organizationId: string;
  displayName: string;
  email: string;
  role: AmcUserRole;
}

export interface CurrentUser {
  uid: string;
  role: AmcUserRole;
  displayName: string;
  email: string;
  assigneeId: string;
  organizationId: string;
}

export interface WorkBucket {
  id: string;
  organizationId: string;
  clientAssociationId: string;
  kind: WorkBucketKind;
  name: string;
  status: "planning" | "active" | "complete";
}

export type WorkBucketStatus = WorkBucket["status"];

export interface WorkBucketCreateInput {
  clientAssociationId: string;
  kind: WorkBucketKind;
  name: string;
  status?: WorkBucketStatus;
}

export const DEFAULT_CLIENT_BUCKET_KINDS = ["membership", "generalOperations"] as const;

export interface WorkItem {
  id: string;
  organizationId: string;
  clientAssociationId: string;
  bucketId: string;
  tracker: WorkTrackerKind;
  title: string;
  status: WorkStatus;
  assigneeId: string | null;
  dueDate: string;
  origin?: WorkOrigin;
  relatedEntities?: RelatedEntityRef[];
}

export interface ActionItem {
  id: string;
  organizationId: string;
  clientAssociationId: string;
  bucketId: string;
  title: string;
  status: WorkStatus;
  assigneeId: string | null;
  dueDate: string;
  origin?: WorkOrigin;
  relatedEntities: RelatedEntityRef[];
  notes: string;
}

export interface ActionItemCreateInput {
  title: string;
  clientAssociationId: string;
  bucketId: string;
  assigneeId?: string | null;
  dueDate?: string;
  origin?: WorkOrigin;
  relatedEntities?: RelatedEntityRef[];
  notes?: string;
}

export interface CollateralItem {
  id: string;
  organizationId: string;
  clientAssociationId: string;
  bucketId: string;
  title: string;
  collateralType: CollateralType;
  channelOrUse: string;
  status: CollateralStatus;
  assigneeId: string | null;
  dueDate: string;
  audience: string;
  notes: string;
  relatedActionItemIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CollateralItemCreateInput {
  clientAssociationId: string;
  bucketId: string;
  title: string;
  collateralType: CollateralType;
  channelOrUse?: string;
  status?: CollateralStatus;
  assigneeId?: string | null;
  dueDate?: string;
  audience?: string;
  notes?: string;
  now?: string;
}

export interface CollateralActionItemCreateInput {
  collateralItem: CollateralItem;
  title: string;
  assigneeId?: string | null;
  dueDate?: string;
  data: Pick<FoundationData, "buckets" | "clients" | "organization">;
}

export interface EducationApplication {
  id: string;
  organizationId: string;
  clientAssociationId: string;
  bucketId: string;
  courseTitle: string;
  sessionCategory: SessionCategory;
  hours: number;
  status: "needed" | "drafting" | "submitted" | "approved" | "completed";
  assigneeId: string | null;
  relatedActionItemIds: string[];
  notes: string;
}

export interface SpeakerEngagement {
  id: string;
  organizationId: string;
  clientAssociationId: string;
  bucketId: string;
  speakerName: string;
  topicTitle: string;
  sessionCategory: SessionCategory;
  status: "identified" | "invited" | "confirmed" | "ready" | "completed";
  assigneeId: string | null;
  relatedActionItemIds: string[];
  notes: string;
}

export interface FoundationData {
  organization: AmcOrganization;
  clients: ClientAssociation[];
  staff: StaffProfile[];
  currentUser: CurrentUser;
  buckets: WorkBucket[];
  actionItems: ActionItem[];
  collateralItems: CollateralItem[];
  educationApplications: EducationApplication[];
  speakerEngagements: SpeakerEngagement[];
}

export interface WorkVisibilityFilter {
  viewer: CurrentUser;
  clientAssociationId?: string;
  bucketId?: string;
  assigneeId?: string;
  tracker?: WorkTrackerKind;
  status?: WorkStatus;
  unassignedOnly?: boolean;
}

export interface BucketWorkspace {
  client: ClientAssociation | null;
  bucket: WorkBucket | null;
  workItems: WorkItem[];
  actionItems: ActionItem[];
  collateralItems: CollateralItem[];
  educationApplications: EducationApplication[];
  speakerEngagements: SpeakerEngagement[];
  sponsorFulfillmentRecords: [];
}

export const DEMO_FOUNDATION_DATA: FoundationData = {
  organization: {
    id: "org-demo-amc",
    name: "Demo Association Management Co."
  },
  clients: [
    {
      id: "client-pacific-pest",
      organizationId: "org-demo-amc",
      name: "Pacific Pest Management Association",
      shortName: "PPMA",
      status: "active"
    },
    {
      id: "client-western-parks",
      organizationId: "org-demo-amc",
      name: "Western Parks Coalition",
      shortName: "WPC",
      status: "active"
    }
  ],
  staff: [
    {
      id: "staff-melissa",
      organizationId: "org-demo-amc",
      displayName: "Melissa",
      email: "melissa@example.com",
      role: "admin"
    },
    {
      id: "staff-operations",
      organizationId: "org-demo-amc",
      displayName: "Operations Coordinator",
      email: "ops@example.com",
      role: "employee"
    }
  ],
  currentUser: {
    uid: "demo-user-melissa",
    role: "admin",
    displayName: "Melissa",
    email: "melissa@example.com",
    assigneeId: "staff-melissa",
    organizationId: "org-demo-amc"
  },
  buckets: [
    {
      id: "bucket-ppma-annual-conference",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      kind: "event",
      name: "Annual Conference 2026",
      status: "active"
    },
    {
      id: "bucket-ppma-ceu-program",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      kind: "educationProgram",
      name: "Spring CEU Program",
      status: "planning"
    },
    {
      id: "bucket-ppma-membership",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      kind: "membership",
      name: "Membership",
      status: "active"
    },
    {
      id: "bucket-ppma-general-operations",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      kind: "generalOperations",
      name: "General Operations",
      status: "active"
    },
    {
      id: "bucket-wpc-sponsor-fulfillment",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-western-parks",
      kind: "sponsorFulfillment",
      name: "Partner Fulfillment",
      status: "active"
    },
    {
      id: "bucket-wpc-membership",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-western-parks",
      kind: "membership",
      name: "Membership",
      status: "active"
    },
    {
      id: "bucket-wpc-general-operations",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-western-parks",
      kind: "generalOperations",
      name: "General Operations",
      status: "active"
    }
  ],
  actionItems: [
    {
      id: "action-ppma-speaker-confirmations",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      bucketId: "bucket-ppma-annual-conference",
      title: "Confirm speaker materials for breakout sessions",
      status: "inProgress",
      assigneeId: "staff-melissa",
      dueDate: "2026-06-12",
      origin: {
        tracker: "speaker",
        entityType: "speakerEngagement",
        entityId: "speaker-demo-breakouts"
      },
      relatedEntities: [],
      notes: ""
    },
    {
      id: "action-ppma-ceu-application",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      bucketId: "bucket-ppma-ceu-program",
      title: "Draft CEU application details",
      status: "notStarted",
      assigneeId: "staff-operations",
      dueDate: "2026-06-18",
      origin: {
        tracker: "education",
        entityType: "educationApplication",
        entityId: "education-demo-spring-ceu"
      },
      relatedEntities: [],
      notes: ""
    },
    {
      id: "action-wpc-sponsor-logo",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-western-parks",
      bucketId: "bucket-wpc-sponsor-fulfillment",
      title: "Collect sponsor logo and recognition copy",
      status: "waiting",
      assigneeId: null,
      dueDate: "2026-06-20",
      origin: {
        tracker: "sponsorFulfillment",
        entityType: "sponsorDeliverable",
        entityId: "sponsor-demo-logo"
      },
      relatedEntities: [],
      notes: ""
    }
  ],
  collateralItems: [
    {
      id: "collateral-ppma-postcard",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      bucketId: "bucket-ppma-annual-conference",
      title: "Annual conference reminder postcard",
      collateralType: "postcard",
      channelOrUse: "Reminder mailing",
      status: "review",
      assigneeId: "staff-melissa",
      dueDate: "2026-06-10",
      audience: "Members and prospects",
      relatedActionItemIds: [],
      notes: "",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z"
    }
  ],
  educationApplications: [
    {
      id: "education-demo-spring-ceu",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      bucketId: "bucket-ppma-ceu-program",
      courseTitle: "Spring CEU Program",
      sessionCategory: "General",
      hours: 2,
      status: "drafting",
      assigneeId: "staff-operations",
      relatedActionItemIds: ["action-ppma-ceu-application"],
      notes: ""
    }
  ],
  speakerEngagements: [
    {
      id: "speaker-demo-breakouts",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      bucketId: "bucket-ppma-annual-conference",
      speakerName: "TBD speaker",
      topicTitle: "Breakout sessions",
      sessionCategory: "General",
      status: "confirmed",
      assigneeId: "staff-melissa",
      relatedActionItemIds: ["action-ppma-speaker-confirmations"],
      notes: ""
    }
  ]
};

export function getFoundationWorkItems(input: {
  actionItems: ActionItem[];
  collateralItems: CollateralItem[];
}) {
  return [
    ...input.actionItems.map(projectActionItemToWorkItem),
    ...input.collateralItems.map(projectCollateralItemToWorkItem)
  ];
}

export function getBucketWorkspace(
  data: Pick<
    FoundationData,
    | "clients"
    | "buckets"
    | "actionItems"
    | "collateralItems"
    | "educationApplications"
    | "speakerEngagements"
  >,
  input: {
    clientId: string;
    bucketId: string;
  }
): BucketWorkspace {
  const client = data.clients.find((candidate) => candidate.id === input.clientId) ?? null;
  const bucket =
    data.buckets.find(
      (candidate) => candidate.id === input.bucketId && candidate.clientAssociationId === input.clientId
    ) ?? null;

  if (!client || !bucket) {
    return {
      client,
      bucket,
      workItems: [],
      actionItems: [],
      collateralItems: [],
      educationApplications: [],
      speakerEngagements: [],
      sponsorFulfillmentRecords: []
    };
  }

  const actionItems = data.actionItems.filter((item) => item.bucketId === bucket.id);
  const collateralItems = data.collateralItems.filter((item) => item.bucketId === bucket.id);
  const educationApplications = data.educationApplications.filter((item) => item.bucketId === bucket.id);
  const speakerEngagements = data.speakerEngagements.filter((item) => item.bucketId === bucket.id);

  return {
    client,
    bucket,
    workItems: getFoundationWorkItems({ actionItems, collateralItems }),
    actionItems,
    collateralItems,
    educationApplications,
    speakerEngagements,
    sponsorFulfillmentRecords: []
  };
}

export function projectActionItemToWorkItem(item: ActionItem): WorkItem {
  return {
    id: item.id,
    organizationId: item.organizationId,
    clientAssociationId: item.clientAssociationId,
    bucketId: item.bucketId,
    tracker: item.origin?.tracker ?? "action",
    title: item.title,
    status: item.status,
    assigneeId: item.assigneeId,
    dueDate: item.dueDate,
    origin: item.origin ?? {
      tracker: "action",
      entityType: "actionItem",
      entityId: item.id
    },
    relatedEntities: item.relatedEntities
  };
}

export function projectCollateralItemToWorkItem(item: CollateralItem): WorkItem {
  return {
    id: item.id,
    organizationId: item.organizationId,
    clientAssociationId: item.clientAssociationId,
    bucketId: item.bucketId,
    tracker: "collateral",
    title: item.title,
    status: mapCollateralStatusToWorkStatus(item.status),
    assigneeId: item.assigneeId,
    dueDate: item.dueDate,
    origin: {
      tracker: "collateral",
      entityType: "collateralItem",
      entityId: item.id
    },
    relatedEntities: item.relatedActionItemIds.map((actionItemId) => ({
      entityType: "actionItem",
      entityId: actionItemId
    }))
  };
}

export function validateCollateralItemCreateInput(
  input: CollateralItemCreateInput,
  data: Pick<FoundationData, "buckets" | "clients" | "organization">
) {
  const errors: string[] = [];
  const client = data.clients.find((candidate) => candidate.id === input.clientAssociationId);
  const bucket = data.buckets.find((candidate) => candidate.id === input.bucketId);

  if (!input.title.trim()) {
    errors.push("Collateral title is required.");
  }

  if (!client || client.organizationId !== data.organization.id) {
    errors.push("Client association is required.");
  }

  if (!bucket || bucket.organizationId !== data.organization.id) {
    errors.push("Bucket is required.");
  } else if (bucket.clientAssociationId !== input.clientAssociationId) {
    errors.push("Bucket must belong to the selected client association.");
  }

  if (!COLLATERAL_TYPES.includes(input.collateralType)) {
    errors.push("Collateral type is invalid.");
  }

  if (input.status && !COLLATERAL_STATUSES.includes(input.status)) {
    errors.push("Collateral status is invalid.");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function createCollateralItem(
  input: CollateralItemCreateInput,
  data: Pick<FoundationData, "buckets" | "clients" | "organization">
): CollateralItem {
  const validation = validateCollateralItemCreateInput(input, data);

  if (!validation.isValid) {
    throw new Error(validation.errors.join(" "));
  }

  const now = input.now ?? new Date().toISOString();

  return {
    id: `collateral-${crypto.randomUUID()}`,
    organizationId: data.organization.id,
    clientAssociationId: input.clientAssociationId,
    bucketId: input.bucketId,
    title: input.title.trim(),
    collateralType: input.collateralType,
    channelOrUse: input.channelOrUse?.trim() ?? "",
    status: input.status ?? "notStarted",
    assigneeId: input.assigneeId?.trim() || null,
    dueDate: input.dueDate?.trim() ?? "",
    audience: input.audience?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
    relatedActionItemIds: [],
    createdAt: now,
    updatedAt: now
  };
}

export function validateActionItemCreateInput(input: ActionItemCreateInput, data: Pick<FoundationData, "buckets" | "clients" | "organization">) {
  const errors: string[] = [];
  const title = input.title.trim();
  const client = data.clients.find((candidate) => candidate.id === input.clientAssociationId);
  const bucket = data.buckets.find((candidate) => candidate.id === input.bucketId);

  if (!title) {
    errors.push("Title is required.");
  }

  if (!client || client.organizationId !== data.organization.id) {
    errors.push("Client association is required.");
  }

  if (!bucket || bucket.organizationId !== data.organization.id) {
    errors.push("Bucket is required.");
  } else if (bucket.clientAssociationId !== input.clientAssociationId) {
    errors.push("Bucket must belong to the selected client association.");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function validateClientAssociationCreateInput(input: ClientAssociationCreateInput) {
  const errors: string[] = [];

  if (!input.name.trim()) {
    errors.push("Client name is required.");
  }

  if (!input.shortName.trim()) {
    errors.push("Client short name is required.");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function createClientAssociation(
  input: ClientAssociationCreateInput,
  data: Pick<FoundationData, "organization">
): ClientAssociation {
  const validation = validateClientAssociationCreateInput(input);

  if (!validation.isValid) {
    throw new Error(validation.errors.join(" "));
  }

  return {
    id: `client-${crypto.randomUUID()}`,
    organizationId: data.organization.id,
    name: input.name.trim(),
    shortName: input.shortName.trim(),
    status: input.status ?? "active"
  };
}

export function validateWorkBucketCreateInput(
  input: WorkBucketCreateInput,
  data: Pick<FoundationData, "clients" | "organization">
) {
  const errors: string[] = [];
  const client = data.clients.find((candidate) => candidate.id === input.clientAssociationId);

  if (!client || client.organizationId !== data.organization.id) {
    errors.push("Client association is required.");
  }

  if (!input.name.trim()) {
    errors.push("Bucket name is required.");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function createWorkBucket(
  input: WorkBucketCreateInput,
  data: Pick<FoundationData, "clients" | "organization">
): WorkBucket {
  const validation = validateWorkBucketCreateInput(input, data);

  if (!validation.isValid) {
    throw new Error(validation.errors.join(" "));
  }

  return {
    id: `bucket-${crypto.randomUUID()}`,
    organizationId: data.organization.id,
    clientAssociationId: input.clientAssociationId,
    kind: input.kind,
    name: input.name.trim(),
    status: input.status ?? "planning"
  };
}

export function createDefaultBucketsForClient(input: {
  clientAssociationId: string;
  organizationId: string;
  existingBuckets?: WorkBucket[];
}): WorkBucket[] {
  const existingKinds = new Set(
    input.existingBuckets
      ?.filter((bucket) => bucket.clientAssociationId === input.clientAssociationId)
      .map((bucket) => bucket.kind) ?? []
  );
  const defaults: WorkBucket[] = [];

  if (!existingKinds.has("membership")) {
    defaults.push({
      id: `bucket-${crypto.randomUUID()}`,
      organizationId: input.organizationId,
      clientAssociationId: input.clientAssociationId,
      kind: "membership",
      name: "Membership",
      status: "active"
    });
  }

  if (!existingKinds.has("generalOperations")) {
    defaults.push({
      id: `bucket-${crypto.randomUUID()}`,
      organizationId: input.organizationId,
      clientAssociationId: input.clientAssociationId,
      kind: "generalOperations",
      name: "General Operations",
      status: "active"
    });
  }

  return defaults;
}

export function ensureDefaultBucketsForClients(
  clients: ClientAssociation[],
  buckets: WorkBucket[],
  organizationId: string
): WorkBucket[] {
  return clients.reduce((nextBuckets, client) => {
    const defaults = createDefaultBucketsForClient({
      clientAssociationId: client.id,
      organizationId,
      existingBuckets: nextBuckets
    });

    return [...nextBuckets, ...defaults];
  }, [...buckets]);
}

export function createActionItem(
  input: ActionItemCreateInput,
  data: Pick<FoundationData, "buckets" | "clients" | "organization">
): ActionItem {
  const validation = validateActionItemCreateInput(input, data);

  if (!validation.isValid) {
    throw new Error(validation.errors.join(" "));
  }

  return {
    id: `action-${crypto.randomUUID()}`,
    organizationId: data.organization.id,
    clientAssociationId: input.clientAssociationId,
    bucketId: input.bucketId,
    title: input.title.trim(),
    status: "notStarted",
    assigneeId: input.assigneeId?.trim() || null,
    dueDate: input.dueDate?.trim() ?? "",
    origin: input.origin,
    relatedEntities: input.relatedEntities ?? [],
    notes: input.notes?.trim() ?? ""
  };
}

export function createCollateralActionItem(input: CollateralActionItemCreateInput) {
  return createActionItem(
    {
      title: input.title,
      clientAssociationId: input.collateralItem.clientAssociationId,
      bucketId: input.collateralItem.bucketId,
      assigneeId: input.assigneeId ?? input.collateralItem.assigneeId,
      dueDate: input.dueDate ?? input.collateralItem.dueDate,
      origin: {
        tracker: "collateral",
        entityType: "collateralItem",
        entityId: input.collateralItem.id
      },
      relatedEntities: [
        {
          entityType: "collateralItem",
          entityId: input.collateralItem.id
        }
      ]
    },
    input.data
  );
}

export function linkCollateralActionItem(collateralItem: CollateralItem, actionItem: ActionItem): CollateralItem {
  if (collateralItem.relatedActionItemIds.includes(actionItem.id)) {
    return collateralItem;
  }

  return {
    ...collateralItem,
    relatedActionItemIds: [...collateralItem.relatedActionItemIds, actionItem.id]
  };
}

function mapCollateralStatusToWorkStatus(status: CollateralItem["status"]): WorkStatus {
  if (status === "complete") {
    return "complete";
  }

  if (status === "notStarted") {
    return "notStarted";
  }

  if (status === "waiting") {
    return "waiting";
  }

  return "inProgress";
}

export function getClientAssociationName(clients: ClientAssociation[], clientAssociationId: string) {
  return clients.find((client) => client.id === clientAssociationId)?.shortName ?? "Unknown client";
}

export function getBucketName(buckets: WorkBucket[], bucketId: string) {
  return buckets.find((bucket) => bucket.id === bucketId)?.name ?? "Unbucketed work";
}

export function getAssigneeName(staff: StaffProfile[], assigneeId: string | null) {
  if (!assigneeId) {
    return "Unassigned";
  }

  return staff.find((profile) => profile.id === assigneeId)?.displayName ?? "Unknown assignee";
}

export function getVisibleWorkItems(items: WorkItem[], filter: WorkVisibilityFilter) {
  return items.filter((item) => {
    if (item.organizationId !== filter.viewer.organizationId) {
      return false;
    }

    if (filter.clientAssociationId && item.clientAssociationId !== filter.clientAssociationId) {
      return false;
    }

    if (filter.bucketId && item.bucketId !== filter.bucketId) {
      return false;
    }

    if (filter.viewer.role !== "admin" && item.assigneeId !== filter.viewer.assigneeId) {
      return false;
    }

    if (filter.unassignedOnly && item.assigneeId !== null) {
      return false;
    }

    if (filter.viewer.role === "admin" && filter.assigneeId && item.assigneeId !== filter.assigneeId) {
      return false;
    }

    if (filter.tracker && item.tracker !== filter.tracker) {
      return false;
    }

    if (filter.status && item.status !== filter.status) {
      return false;
    }

    return true;
  });
}
