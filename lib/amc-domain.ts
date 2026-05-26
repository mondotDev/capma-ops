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

export const SPONSOR_FULFILLMENT_TYPES = [
  "logoRecognition",
  "emailMention",
  "socialMention",
  "signage",
  "boothOrTable",
  "speakingOpportunity",
  "attendeeList",
  "programAd",
  "sponsoredSession",
  "receptionRecognition",
  "other"
] as const;

export const SPONSOR_FULFILLMENT_STATUSES = [
  "notStarted",
  "waiting",
  "inProgress",
  "readyForReview",
  "fulfilled",
  "blocked",
  "canceled"
] as const;

export type SponsorFulfillmentType = (typeof SPONSOR_FULFILLMENT_TYPES)[number];

export type SponsorFulfillmentStatus = (typeof SPONSOR_FULFILLMENT_STATUSES)[number];

export type RelationshipEntityType =
  | "actionItem"
  | "collateralItem"
  | "educationApplication"
  | "speakerEngagement"
  | "sponsorFulfillment"
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

export const WORK_BUCKET_STATUS_LABELS: Record<WorkBucketStatus, string> = {
  planning: "Planning",
  active: "Active",
  complete: "Complete"
};

export interface WorkBucketCreateInput {
  clientAssociationId: string;
  kind: WorkBucketKind;
  name: string;
  status?: WorkBucketStatus;
}

export const DEFAULT_CLIENT_BUCKET_KINDS = ["membership", "generalOperations"] as const;

export const WORK_BUCKET_KIND_LABELS: Record<WorkBucketKind, string> = {
  event: "Event",
  educationProgram: "Education program",
  publicationIssue: "Publication issue",
  sponsorFulfillment: "Sponsor fulfillment",
  membership: "Membership",
  generalOperations: "General operations",
  internalOps: "Internal operations"
};

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  notStarted: "Not started",
  inProgress: "In progress",
  waiting: "Waiting",
  blocked: "Blocked",
  complete: "Complete"
};

export const WORK_TRACKER_LABELS: Record<WorkTrackerKind, string> = {
  action: "Action",
  collateral: "Collateral",
  education: "Education",
  speaker: "Speaker",
  sponsorFulfillment: "Sponsor fulfillment"
};

export const COLLATERAL_TYPE_LABELS: Record<CollateralType, string> = {
  email: "Email",
  socialPost: "Social post",
  flyer: "Flyer",
  postcard: "Postcard",
  signage: "Signage",
  programBook: "Program book",
  websiteUpdate: "Website update",
  sponsorRecognition: "Sponsor recognition",
  handout: "Handout",
  other: "Other"
};

export const COLLATERAL_STATUS_LABELS: Record<CollateralStatus, string> = {
  notStarted: "Not started",
  drafting: "Drafting",
  waiting: "Waiting",
  review: "Review",
  approved: "Approved",
  scheduled: "Scheduled",
  complete: "Complete"
};

export const SPONSOR_FULFILLMENT_TYPE_LABELS: Record<SponsorFulfillmentType, string> = {
  logoRecognition: "Logo recognition",
  emailMention: "Email mention",
  socialMention: "Social mention",
  signage: "Signage",
  boothOrTable: "Booth or table",
  speakingOpportunity: "Speaking opportunity",
  attendeeList: "Attendee list",
  programAd: "Program ad",
  sponsoredSession: "Sponsored session",
  receptionRecognition: "Reception recognition",
  other: "Other"
};

export const SPONSOR_FULFILLMENT_STATUS_LABELS: Record<SponsorFulfillmentStatus, string> = {
  notStarted: "Not started",
  waiting: "Waiting",
  inProgress: "In progress",
  readyForReview: "Ready for review",
  fulfilled: "Fulfilled",
  blocked: "Blocked",
  canceled: "Canceled"
};

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
  relatedSponsorFulfillmentIds?: string[];
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

export interface CollateralItemUpdateInput {
  title?: string;
  collateralType?: CollateralType;
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

export interface SponsorFulfillmentRecord {
  id: string;
  organizationId: string;
  clientAssociationId: string;
  bucketId: string;
  sponsorName: string;
  fulfillmentTitle: string;
  fulfillmentType: SponsorFulfillmentType;
  status: SponsorFulfillmentStatus;
  assigneeId: string | null;
  dueDate: string;
  notes: string;
  relatedCollateralIds: string[];
  relatedActionItemIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SponsorFulfillmentCreateInput {
  clientAssociationId: string;
  bucketId: string;
  sponsorName: string;
  fulfillmentTitle: string;
  fulfillmentType: SponsorFulfillmentType;
  status?: SponsorFulfillmentStatus;
  assigneeId?: string | null;
  dueDate?: string;
  notes?: string;
  now?: string;
}

export interface SponsorFulfillmentUpdateInput {
  sponsorName?: string;
  fulfillmentTitle?: string;
  fulfillmentType?: SponsorFulfillmentType;
  status?: SponsorFulfillmentStatus;
  assigneeId?: string | null;
  dueDate?: string;
  notes?: string;
  now?: string;
}

export interface SponsorFulfillmentActionItemCreateInput {
  sponsorFulfillment: SponsorFulfillmentRecord;
  title: string;
  assigneeId?: string | null;
  dueDate?: string;
  data: Pick<FoundationData, "buckets" | "clients" | "organization">;
}

export interface SponsorFulfillmentCollateralCreateInput {
  sponsorFulfillment: SponsorFulfillmentRecord;
  title: string;
  collateralType: CollateralType;
  assigneeId?: string | null;
  dueDate?: string;
  notes?: string;
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
  sponsorFulfillmentRecords: SponsorFulfillmentRecord[];
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
  sponsorFulfillmentRecords: SponsorFulfillmentRecord[];
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
      relatedSponsorFulfillmentIds: [],
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
  ],
  sponsorFulfillmentRecords: [
    {
      id: "sponsor-demo-logo",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-western-parks",
      bucketId: "bucket-wpc-sponsor-fulfillment",
      sponsorName: "Trailhead Partners",
      fulfillmentTitle: "Logo recognition in partner reminder email",
      fulfillmentType: "logoRecognition",
      status: "waiting",
      assigneeId: null,
      dueDate: "2026-06-20",
      notes: "Need current logo and approval copy.",
      relatedCollateralIds: [],
      relatedActionItemIds: ["action-wpc-sponsor-logo"],
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z"
    }
  ]
};

export function getFoundationWorkItems(input: {
  actionItems: ActionItem[];
  collateralItems: CollateralItem[];
  sponsorFulfillmentRecords?: SponsorFulfillmentRecord[];
}) {
  return [
    ...input.actionItems.map(projectActionItemToWorkItem),
    ...input.collateralItems.map(projectCollateralItemToWorkItem),
    ...(input.sponsorFulfillmentRecords ?? []).map(projectSponsorFulfillmentToWorkItem)
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
    | "sponsorFulfillmentRecords"
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
  const sponsorFulfillmentRecords = data.sponsorFulfillmentRecords.filter((item) => item.bucketId === bucket.id);

  return {
    client,
    bucket,
    workItems: getFoundationWorkItems({ actionItems, collateralItems, sponsorFulfillmentRecords }),
    actionItems,
    collateralItems,
    educationApplications,
    speakerEngagements,
    sponsorFulfillmentRecords
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

export function projectSponsorFulfillmentToWorkItem(item: SponsorFulfillmentRecord): WorkItem {
  return {
    id: item.id,
    organizationId: item.organizationId,
    clientAssociationId: item.clientAssociationId,
    bucketId: item.bucketId,
    tracker: "sponsorFulfillment",
    title: `${item.sponsorName}: ${item.fulfillmentTitle}`,
    status: mapSponsorFulfillmentStatusToWorkStatus(item.status),
    assigneeId: item.assigneeId,
    dueDate: item.dueDate,
    origin: {
      tracker: "sponsorFulfillment",
      entityType: "sponsorFulfillment",
      entityId: item.id
    },
    relatedEntities: [
      ...item.relatedActionItemIds.map((actionItemId) => ({
        entityType: "actionItem" as const,
        entityId: actionItemId
      })),
      ...item.relatedCollateralIds.map((collateralItemId) => ({
        entityType: "collateralItem" as const,
        entityId: collateralItemId
      }))
    ]
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
    relatedSponsorFulfillmentIds: [],
    relatedActionItemIds: [],
    createdAt: now,
    updatedAt: now
  };
}

export function updateCollateralItem(item: CollateralItem, input: CollateralItemUpdateInput): CollateralItem {
  const nextTitle = input.title === undefined ? item.title : input.title.trim();

  if (!nextTitle) {
    throw new Error("Collateral title is required.");
  }

  if (input.collateralType && !COLLATERAL_TYPES.includes(input.collateralType)) {
    throw new Error("Collateral type is invalid.");
  }

  if (input.status && !COLLATERAL_STATUSES.includes(input.status)) {
    throw new Error("Collateral status is invalid.");
  }

  return {
    ...item,
    title: nextTitle,
    collateralType: input.collateralType ?? item.collateralType,
    channelOrUse: input.channelOrUse === undefined ? item.channelOrUse : input.channelOrUse.trim(),
    status: input.status ?? item.status,
    assigneeId: input.assigneeId === undefined ? item.assigneeId : input.assigneeId?.trim() || null,
    dueDate: input.dueDate === undefined ? item.dueDate : input.dueDate.trim(),
    audience: input.audience === undefined ? item.audience : input.audience.trim(),
    notes: input.notes === undefined ? item.notes : input.notes.trim(),
    updatedAt: input.now ?? new Date().toISOString()
  };
}

export function validateSponsorFulfillmentCreateInput(
  input: SponsorFulfillmentCreateInput,
  data: Pick<FoundationData, "buckets" | "clients" | "organization">
) {
  const errors: string[] = [];
  const client = data.clients.find((candidate) => candidate.id === input.clientAssociationId);
  const bucket = data.buckets.find((candidate) => candidate.id === input.bucketId);

  if (!input.sponsorName.trim()) {
    errors.push("Sponsor name is required.");
  }

  if (!input.fulfillmentTitle.trim()) {
    errors.push("Fulfillment title is required.");
  }

  if (!client || client.organizationId !== data.organization.id) {
    errors.push("Client association is required.");
  }

  if (!bucket || bucket.organizationId !== data.organization.id) {
    errors.push("Bucket is required.");
  } else if (bucket.clientAssociationId !== input.clientAssociationId) {
    errors.push("Bucket must belong to the selected client association.");
  }

  if (!SPONSOR_FULFILLMENT_TYPES.includes(input.fulfillmentType)) {
    errors.push("Sponsor fulfillment type is invalid.");
  }

  if (input.status && !SPONSOR_FULFILLMENT_STATUSES.includes(input.status)) {
    errors.push("Sponsor fulfillment status is invalid.");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function createSponsorFulfillmentRecord(
  input: SponsorFulfillmentCreateInput,
  data: Pick<FoundationData, "buckets" | "clients" | "organization">
): SponsorFulfillmentRecord {
  const validation = validateSponsorFulfillmentCreateInput(input, data);

  if (!validation.isValid) {
    throw new Error(validation.errors.join(" "));
  }

  const now = input.now ?? new Date().toISOString();

  return {
    id: `sponsor-${crypto.randomUUID()}`,
    organizationId: data.organization.id,
    clientAssociationId: input.clientAssociationId,
    bucketId: input.bucketId,
    sponsorName: input.sponsorName.trim(),
    fulfillmentTitle: input.fulfillmentTitle.trim(),
    fulfillmentType: input.fulfillmentType,
    status: input.status ?? "notStarted",
    assigneeId: input.assigneeId?.trim() || null,
    dueDate: input.dueDate?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
    relatedCollateralIds: [],
    relatedActionItemIds: [],
    createdAt: now,
    updatedAt: now
  };
}

export function updateSponsorFulfillmentRecord(
  item: SponsorFulfillmentRecord,
  input: SponsorFulfillmentUpdateInput
): SponsorFulfillmentRecord {
  const nextSponsorName = input.sponsorName === undefined ? item.sponsorName : input.sponsorName.trim();
  const nextFulfillmentTitle = input.fulfillmentTitle === undefined ? item.fulfillmentTitle : input.fulfillmentTitle.trim();

  if (!nextSponsorName) {
    throw new Error("Sponsor name is required.");
  }

  if (!nextFulfillmentTitle) {
    throw new Error("Fulfillment title is required.");
  }

  if (input.fulfillmentType && !SPONSOR_FULFILLMENT_TYPES.includes(input.fulfillmentType)) {
    throw new Error("Sponsor fulfillment type is invalid.");
  }

  if (input.status && !SPONSOR_FULFILLMENT_STATUSES.includes(input.status)) {
    throw new Error("Sponsor fulfillment status is invalid.");
  }

  return {
    ...item,
    sponsorName: nextSponsorName,
    fulfillmentTitle: nextFulfillmentTitle,
    fulfillmentType: input.fulfillmentType ?? item.fulfillmentType,
    status: input.status ?? item.status,
    assigneeId: input.assigneeId === undefined ? item.assigneeId : input.assigneeId?.trim() || null,
    dueDate: input.dueDate === undefined ? item.dueDate : input.dueDate.trim(),
    notes: input.notes === undefined ? item.notes : input.notes.trim(),
    updatedAt: input.now ?? new Date().toISOString()
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

export function createSponsorFulfillmentActionItem(input: SponsorFulfillmentActionItemCreateInput) {
  return createActionItem(
    {
      title: input.title,
      clientAssociationId: input.sponsorFulfillment.clientAssociationId,
      bucketId: input.sponsorFulfillment.bucketId,
      assigneeId: input.assigneeId ?? input.sponsorFulfillment.assigneeId,
      dueDate: input.dueDate ?? input.sponsorFulfillment.dueDate,
      origin: {
        tracker: "sponsorFulfillment",
        entityType: "sponsorFulfillment",
        entityId: input.sponsorFulfillment.id
      },
      relatedEntities: [
        {
          entityType: "sponsorFulfillment",
          entityId: input.sponsorFulfillment.id
        }
      ]
    },
    input.data
  );
}

export function createSponsorFulfillmentCollateralItem(input: SponsorFulfillmentCollateralCreateInput) {
  const collateral = createCollateralItem(
    {
      title: input.title,
      clientAssociationId: input.sponsorFulfillment.clientAssociationId,
      bucketId: input.sponsorFulfillment.bucketId,
      collateralType: input.collateralType,
      status: "notStarted",
      assigneeId: input.assigneeId ?? input.sponsorFulfillment.assigneeId,
      dueDate: input.dueDate ?? input.sponsorFulfillment.dueDate,
      notes: input.notes,
      channelOrUse: SPONSOR_FULFILLMENT_TYPE_LABELS[input.sponsorFulfillment.fulfillmentType],
      audience: input.sponsorFulfillment.sponsorName
    },
    input.data
  );

  return {
    ...collateral,
    relatedSponsorFulfillmentIds: [input.sponsorFulfillment.id]
  };
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

export function linkSponsorFulfillmentActionItem(
  sponsorFulfillment: SponsorFulfillmentRecord,
  actionItem: ActionItem
): SponsorFulfillmentRecord {
  if (sponsorFulfillment.relatedActionItemIds.includes(actionItem.id)) {
    return sponsorFulfillment;
  }

  return {
    ...sponsorFulfillment,
    relatedActionItemIds: [...sponsorFulfillment.relatedActionItemIds, actionItem.id]
  };
}

export function linkSponsorFulfillmentCollateralItem(
  sponsorFulfillment: SponsorFulfillmentRecord,
  collateralItem: CollateralItem
): SponsorFulfillmentRecord {
  if (sponsorFulfillment.relatedCollateralIds.includes(collateralItem.id)) {
    return sponsorFulfillment;
  }

  return {
    ...sponsorFulfillment,
    relatedCollateralIds: [...sponsorFulfillment.relatedCollateralIds, collateralItem.id]
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

function mapSponsorFulfillmentStatusToWorkStatus(status: SponsorFulfillmentStatus): WorkStatus {
  if (status === "fulfilled" || status === "canceled") {
    return "complete";
  }

  if (status === "notStarted") {
    return "notStarted";
  }

  if (status === "waiting") {
    return "waiting";
  }

  if (status === "blocked") {
    return "blocked";
  }

  return "inProgress";
}

export function getClientAssociationName(clients: ClientAssociation[], clientAssociationId: string) {
  return clients.find((client) => client.id === clientAssociationId)?.shortName ?? "Unknown client";
}

export function getBucketOptionLabel(input: {
  bucket: WorkBucket;
  clients: ClientAssociation[];
  includeKind?: boolean;
}) {
  const client = input.clients.find((candidate) => candidate.id === input.bucket.clientAssociationId);
  const clientLabel = client?.shortName || client?.name || "Unknown client";
  const kindLabel = input.includeKind ? ` (${WORK_BUCKET_KIND_LABELS[input.bucket.kind]})` : "";

  return `${clientLabel} / ${input.bucket.name}${kindLabel}`;
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
