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

export const WORK_BUCKET_STATUSES = [
  "idea",
  "planning",
  "production",
  "live",
  "closeout",
  "complete",
  "canceled",
  "archived"
] as const;

export type WorkBucketStatus = (typeof WORK_BUCKET_STATUSES)[number];

export const RECURRENCE_PATTERNS = ["annual", "quarterly", "monthly", "weekly", "oneTime", "ongoing", "adHoc"] as const;

export type RecurrencePattern = (typeof RECURRENCE_PATTERNS)[number];

export const DELIVERY_FORMATS = ["inPerson", "virtual", "hybrid", "notApplicable"] as const;

export type DeliveryFormat = (typeof DELIVERY_FORMATS)[number];

export const LOCATION_TYPES = ["venue", "platform", "mixed", "notApplicable"] as const;

export type LocationType = (typeof LOCATION_TYPES)[number];

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

export interface ProgramSeries {
  id: string;
  organizationId: string;
  clientAssociationId: string;
  name: string;
  defaultKind: WorkBucketKind;
  recurrence: RecurrencePattern;
  defaultDeliveryFormat: DeliveryFormat;
  active: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
  defaultOwnerId?: string | null;
  defaultPlanningLeadDays?: number;
  defaultCloseoutLeadDays?: number;
}

export interface ProgramSeriesCreateInput {
  clientAssociationId: string;
  name: string;
  defaultKind: WorkBucketKind;
  recurrence: RecurrencePattern;
  defaultDeliveryFormat: DeliveryFormat;
  active?: boolean;
  notes?: string;
  defaultOwnerId?: string | null;
  defaultPlanningLeadDays?: number;
  defaultCloseoutLeadDays?: number;
  now?: string;
}

export interface ProgramSeriesUpdateInput {
  name?: string;
  defaultKind?: WorkBucketKind;
  recurrence?: RecurrencePattern;
  defaultDeliveryFormat?: DeliveryFormat;
  active?: boolean;
  notes?: string;
  now?: string;
}

export interface WorkBucket {
  id: string;
  organizationId: string;
  clientAssociationId: string;
  programSeriesId?: string | null;
  kind: WorkBucketKind;
  name: string;
  generatedLabel?: string;
  cycleLabel?: string;
  status: WorkBucketStatus;
  recurrence?: RecurrencePattern;
  planningStartsAt?: string;
  startsAt?: string;
  endsAt?: string;
  closeoutDueAt?: string;
  deliveryFormat?: DeliveryFormat;
  locationName?: string;
  locationType?: LocationType;
  ownerId?: string | null;
  previousBucketId?: string | null;
  isArchived?: boolean;
  archivedAt?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const WORK_BUCKET_STATUS_LABELS: Record<WorkBucketStatus, string> = {
  idea: "Idea",
  planning: "Planning",
  production: "Production",
  live: "Live",
  closeout: "Closeout",
  complete: "Complete",
  canceled: "Canceled",
  archived: "Archived"
};

export interface WorkBucketCreateInput {
  clientAssociationId: string;
  programSeriesId?: string | null;
  kind: WorkBucketKind;
  name: string;
  generatedLabel?: string;
  cycleLabel?: string;
  status?: WorkBucketStatus;
  recurrence?: RecurrencePattern;
  planningStartsAt?: string;
  startsAt?: string;
  endsAt?: string;
  closeoutDueAt?: string;
  deliveryFormat?: DeliveryFormat;
  locationName?: string;
  locationType?: LocationType;
  ownerId?: string | null;
  previousBucketId?: string | null;
  isArchived?: boolean;
  archivedAt?: string;
  notes?: string;
  now?: string;
}

export interface WorkBucketUpdateInput {
  status?: WorkBucketStatus;
  generatedLabel?: string;
  cycleLabel?: string;
  planningStartsAt?: string;
  startsAt?: string;
  endsAt?: string;
  closeoutDueAt?: string;
  deliveryFormat?: DeliveryFormat;
  locationName?: string;
  locationType?: LocationType;
  ownerId?: string | null;
  previousBucketId?: string | null;
  isArchived?: boolean;
  archivedAt?: string;
  notes?: string;
  now?: string;
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

export const RECURRENCE_PATTERN_LABELS: Record<RecurrencePattern, string> = {
  annual: "Annual",
  quarterly: "Quarterly",
  monthly: "Monthly",
  weekly: "Weekly",
  oneTime: "One time",
  ongoing: "Ongoing",
  adHoc: "Ad hoc"
};

export const DELIVERY_FORMAT_LABELS: Record<DeliveryFormat, string> = {
  inPerson: "In person",
  virtual: "Virtual",
  hybrid: "Hybrid",
  notApplicable: "Not applicable"
};

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  venue: "Venue",
  platform: "Platform",
  mixed: "Mixed",
  notApplicable: "Not applicable"
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
  programSeries: ProgramSeries[];
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

export interface ClientWorkStructure {
  client: ClientAssociation | null;
  programSeries: Array<{
    series: ProgramSeries;
    buckets: WorkBucket[];
  }>;
  unassignedBuckets: WorkBucket[];
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
  programSeries: [
    {
      id: "series-ppma-pest-ed",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      name: "Pest Ed",
      defaultKind: "educationProgram",
      recurrence: "annual",
      defaultDeliveryFormat: "hybrid",
      active: true,
      notes: "",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z"
    },
    {
      id: "series-ppma-termite-academy",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      name: "Termite Academy",
      defaultKind: "educationProgram",
      recurrence: "annual",
      defaultDeliveryFormat: "hybrid",
      active: true,
      notes: "",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z"
    },
    {
      id: "series-ppma-legislative-day",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      name: "Legislative Day",
      defaultKind: "event",
      recurrence: "annual",
      defaultDeliveryFormat: "inPerson",
      active: true,
      notes: "",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z"
    },
    {
      id: "series-ppma-best-pest-expo",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      name: "Best Pest Expo",
      defaultKind: "event",
      recurrence: "annual",
      defaultDeliveryFormat: "inPerson",
      active: true,
      notes: "",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z"
    },
    {
      id: "series-ppma-development-summit",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      name: "Development Summit",
      defaultKind: "event",
      recurrence: "annual",
      defaultDeliveryFormat: "inPerson",
      active: true,
      notes: "",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z"
    },
    {
      id: "series-ppma-monday-mingle",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      name: "Monday Mingle",
      defaultKind: "educationProgram",
      recurrence: "monthly",
      defaultDeliveryFormat: "hybrid",
      active: true,
      notes: "",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z"
    },
    {
      id: "series-ppma-first-friday",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      name: "First Friday",
      defaultKind: "educationProgram",
      recurrence: "monthly",
      defaultDeliveryFormat: "virtual",
      active: true,
      notes: "",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z"
    },
    {
      id: "series-ppma-news-brief",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      name: "News Brief",
      defaultKind: "publicationIssue",
      recurrence: "monthly",
      defaultDeliveryFormat: "notApplicable",
      active: true,
      notes: "",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z"
    },
    {
      id: "series-ppma-the-voice",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      name: "The Voice",
      defaultKind: "publicationIssue",
      recurrence: "quarterly",
      defaultDeliveryFormat: "notApplicable",
      active: true,
      notes: "",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z"
    },
    {
      id: "series-ppma-membership",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      name: "Membership",
      defaultKind: "membership",
      recurrence: "ongoing",
      defaultDeliveryFormat: "notApplicable",
      active: true,
      notes: "",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z"
    },
    {
      id: "series-ppma-general-operations",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      name: "General Operations",
      defaultKind: "generalOperations",
      recurrence: "ongoing",
      defaultDeliveryFormat: "notApplicable",
      active: true,
      notes: "",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z"
    },
    {
      id: "series-wpc-partner-fulfillment",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-western-parks",
      name: "Partner Fulfillment",
      defaultKind: "sponsorFulfillment",
      recurrence: "ongoing",
      defaultDeliveryFormat: "notApplicable",
      active: true,
      notes: "",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z"
    },
    {
      id: "series-wpc-membership",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-western-parks",
      name: "Membership",
      defaultKind: "membership",
      recurrence: "ongoing",
      defaultDeliveryFormat: "notApplicable",
      active: true,
      notes: "",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z"
    },
    {
      id: "series-wpc-general-operations",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-western-parks",
      name: "General Operations",
      defaultKind: "generalOperations",
      recurrence: "ongoing",
      defaultDeliveryFormat: "notApplicable",
      active: true,
      notes: "",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z"
    }
  ],
  buckets: [
    {
      id: "bucket-ppma-annual-conference",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      programSeriesId: "series-ppma-best-pest-expo",
      kind: "event",
      name: "Best Pest Expo",
      generatedLabel: "Best Pest Expo 2026",
      cycleLabel: "2026",
      status: "live",
      recurrence: "annual",
      planningStartsAt: "2026-01-01",
      startsAt: "2026-06-24",
      endsAt: "2026-06-26",
      closeoutDueAt: "2026-07-15",
      deliveryFormat: "inPerson",
      locationName: "",
      locationType: "venue",
      ownerId: "staff-melissa",
      previousBucketId: null,
      isArchived: false,
      archivedAt: "",
      notes: "",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z"
    },
    {
      id: "bucket-ppma-ceu-program",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      programSeriesId: "series-ppma-pest-ed",
      kind: "educationProgram",
      name: "Pest Ed",
      generatedLabel: "Pest Ed 2026",
      cycleLabel: "2026",
      status: "planning",
      recurrence: "annual",
      planningStartsAt: "2026-03-01",
      startsAt: "2026-06-01",
      endsAt: "2026-06-30",
      closeoutDueAt: "2026-07-15",
      deliveryFormat: "hybrid",
      locationName: "",
      locationType: "mixed",
      ownerId: "staff-operations",
      previousBucketId: null,
      isArchived: false,
      archivedAt: "",
      notes: "",
      createdAt: "2026-05-01T12:00:00.000Z",
      updatedAt: "2026-05-01T12:00:00.000Z"
    },
    {
      id: "bucket-ppma-membership",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      programSeriesId: "series-ppma-membership",
      kind: "membership",
      name: "Membership",
      generatedLabel: "Membership",
      cycleLabel: "",
      status: "live",
      recurrence: "ongoing",
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
      updatedAt: "2026-05-01T12:00:00.000Z"
    },
    {
      id: "bucket-ppma-general-operations",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      programSeriesId: "series-ppma-general-operations",
      kind: "generalOperations",
      name: "General Operations",
      generatedLabel: "General Operations",
      cycleLabel: "",
      status: "live",
      recurrence: "ongoing",
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
      updatedAt: "2026-05-01T12:00:00.000Z"
    },
    {
      id: "bucket-wpc-sponsor-fulfillment",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-western-parks",
      programSeriesId: "series-wpc-partner-fulfillment",
      kind: "sponsorFulfillment",
      name: "Partner Fulfillment",
      generatedLabel: "Partner Fulfillment",
      cycleLabel: "",
      status: "live",
      recurrence: "ongoing",
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
      updatedAt: "2026-05-01T12:00:00.000Z"
    },
    {
      id: "bucket-wpc-membership",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-western-parks",
      programSeriesId: "series-wpc-membership",
      kind: "membership",
      name: "Membership",
      generatedLabel: "Membership",
      cycleLabel: "",
      status: "live",
      recurrence: "ongoing",
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
      updatedAt: "2026-05-01T12:00:00.000Z"
    },
    {
      id: "bucket-wpc-general-operations",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-western-parks",
      programSeriesId: "series-wpc-general-operations",
      kind: "generalOperations",
      name: "General Operations",
      generatedLabel: "General Operations",
      cycleLabel: "",
      status: "live",
      recurrence: "ongoing",
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
      updatedAt: "2026-05-01T12:00:00.000Z"
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

export function getClientWorkStructure(
  data: Pick<FoundationData, "clients" | "programSeries" | "buckets">,
  input: { clientId: string }
): ClientWorkStructure {
  const client = data.clients.find((candidate) => candidate.id === input.clientId) ?? null;
  const clientBuckets = data.buckets.filter((bucket) => bucket.clientAssociationId === input.clientId);
  const clientSeries = data.programSeries.filter((series) => series.clientAssociationId === input.clientId);
  const seriesIds = new Set(clientSeries.map((series) => series.id));

  return {
    client,
    programSeries: clientSeries.map((series) => ({
      series,
      buckets: clientBuckets.filter((bucket) => bucket.programSeriesId === series.id)
    })),
    unassignedBuckets: clientBuckets.filter((bucket) => !bucket.programSeriesId || !seriesIds.has(bucket.programSeriesId))
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

export function validateProgramSeriesCreateInput(
  input: ProgramSeriesCreateInput,
  data: Pick<FoundationData, "clients" | "organization">
) {
  const errors: string[] = [];
  const client = data.clients.find((candidate) => candidate.id === input.clientAssociationId);

  if (!client || client.organizationId !== data.organization.id) {
    errors.push("Client association is required.");
  }

  if (!input.name.trim()) {
    errors.push("Program/series name is required.");
  }

  if (!RECURRENCE_PATTERNS.includes(input.recurrence)) {
    errors.push("Program/series recurrence is invalid.");
  }

  if (!DELIVERY_FORMATS.includes(input.defaultDeliveryFormat)) {
    errors.push("Program/series delivery format is invalid.");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function createProgramSeries(
  input: ProgramSeriesCreateInput,
  data: Pick<FoundationData, "clients" | "organization">
): ProgramSeries {
  const validation = validateProgramSeriesCreateInput(input, data);

  if (!validation.isValid) {
    throw new Error(validation.errors.join(" "));
  }

  const now = input.now ?? new Date().toISOString();

  return {
    id: `series-${crypto.randomUUID()}`,
    organizationId: data.organization.id,
    clientAssociationId: input.clientAssociationId,
    name: input.name.trim(),
    defaultKind: input.defaultKind,
    recurrence: input.recurrence,
    defaultDeliveryFormat: input.defaultDeliveryFormat,
    active: input.active ?? true,
    notes: input.notes?.trim() ?? "",
    createdAt: now,
    updatedAt: now,
    defaultOwnerId: input.defaultOwnerId?.trim() || null,
    defaultPlanningLeadDays: input.defaultPlanningLeadDays,
    defaultCloseoutLeadDays: input.defaultCloseoutLeadDays
  };
}

export function updateProgramSeries(item: ProgramSeries, input: ProgramSeriesUpdateInput): ProgramSeries {
  const nextName = input.name === undefined ? item.name : input.name.trim();

  if (!nextName) {
    throw new Error("Program/series name is required.");
  }

  if (input.recurrence && !RECURRENCE_PATTERNS.includes(input.recurrence)) {
    throw new Error("Program/series recurrence is invalid.");
  }

  if (input.defaultDeliveryFormat && !DELIVERY_FORMATS.includes(input.defaultDeliveryFormat)) {
    throw new Error("Program/series delivery format is invalid.");
  }

  return {
    ...item,
    name: nextName,
    defaultKind: input.defaultKind ?? item.defaultKind,
    recurrence: input.recurrence ?? item.recurrence,
    defaultDeliveryFormat: input.defaultDeliveryFormat ?? item.defaultDeliveryFormat,
    active: input.active ?? item.active,
    notes: input.notes === undefined ? item.notes : input.notes.trim(),
    updatedAt: input.now ?? new Date().toISOString()
  };
}

function normalizeWorkBucketStatus(status: unknown): WorkBucketStatus {
  if (status === "active") {
    return "live";
  }

  return typeof status === "string" && WORK_BUCKET_STATUSES.includes(status as WorkBucketStatus)
    ? (status as WorkBucketStatus)
    : "planning";
}

function normalizeRecurrencePattern(recurrence: unknown): RecurrencePattern {
  return typeof recurrence === "string" && RECURRENCE_PATTERNS.includes(recurrence as RecurrencePattern)
    ? (recurrence as RecurrencePattern)
    : "adHoc";
}

function normalizeDeliveryFormat(deliveryFormat: unknown): DeliveryFormat {
  return typeof deliveryFormat === "string" && DELIVERY_FORMATS.includes(deliveryFormat as DeliveryFormat)
    ? (deliveryFormat as DeliveryFormat)
    : "notApplicable";
}

function normalizeLocationType(locationType: unknown): LocationType {
  return typeof locationType === "string" && LOCATION_TYPES.includes(locationType as LocationType)
    ? (locationType as LocationType)
    : "notApplicable";
}

export function validateWorkBucketCreateInput(
  input: WorkBucketCreateInput,
  data: Pick<FoundationData, "clients" | "organization"> & Partial<Pick<FoundationData, "programSeries">>
) {
  const errors: string[] = [];
  const client = data.clients.find((candidate) => candidate.id === input.clientAssociationId);
  const series = data.programSeries?.find((candidate) => candidate.id === input.programSeriesId);

  if (!client || client.organizationId !== data.organization.id) {
    errors.push("Client association is required.");
  }

  if (input.programSeriesId && !series) {
    errors.push("Program/series is required.");
  } else if (series && series.clientAssociationId !== input.clientAssociationId) {
    errors.push("Program/series must belong to the selected client association.");
  }

  if (!input.name.trim() && !series) {
    errors.push("Bucket name is required.");
  }

  if (input.status && !WORK_BUCKET_STATUSES.includes(input.status)) {
    errors.push("Bucket status is invalid.");
  }

  if (input.recurrence && !RECURRENCE_PATTERNS.includes(input.recurrence)) {
    errors.push("Bucket recurrence is invalid.");
  }

  if (input.deliveryFormat && !DELIVERY_FORMATS.includes(input.deliveryFormat)) {
    errors.push("Bucket delivery format is invalid.");
  }

  if (input.locationType && !LOCATION_TYPES.includes(input.locationType)) {
    errors.push("Bucket location type is invalid.");
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function createWorkBucket(
  input: WorkBucketCreateInput,
  data: Pick<FoundationData, "clients" | "organization"> & Partial<Pick<FoundationData, "programSeries">>
): WorkBucket {
  const validation = validateWorkBucketCreateInput(input, data);

  if (!validation.isValid) {
    throw new Error(validation.errors.join(" "));
  }

  const series = data.programSeries?.find((candidate) => candidate.id === input.programSeriesId);
  const now = input.now ?? new Date().toISOString();
  const recurrence = input.recurrence ?? series?.recurrence ?? "adHoc";
  const cycleLabel = input.cycleLabel?.trim() ?? getCycleLabel({ recurrence, startsAt: input.startsAt });
  const name = input.name.trim() || series?.name.trim() || "";
  const generatedLabel = input.generatedLabel?.trim() || generateBucketLabel({ programSeriesName: series?.name ?? name, recurrence, cycleLabel, startsAt: input.startsAt });

  return {
    id: `bucket-${crypto.randomUUID()}`,
    organizationId: data.organization.id,
    clientAssociationId: input.clientAssociationId,
    programSeriesId: input.programSeriesId?.trim() || null,
    kind: series?.defaultKind ?? input.kind,
    name,
    generatedLabel,
    cycleLabel,
    status: input.status ?? "planning",
    recurrence,
    planningStartsAt: input.planningStartsAt?.trim() ?? "",
    startsAt: input.startsAt?.trim() ?? "",
    endsAt: input.endsAt?.trim() ?? "",
    closeoutDueAt: input.closeoutDueAt?.trim() ?? "",
    deliveryFormat: input.deliveryFormat ?? series?.defaultDeliveryFormat ?? "notApplicable",
    locationName: input.locationName?.trim() ?? "",
    locationType: input.locationType ?? "notApplicable",
    ownerId: input.ownerId?.trim() || null,
    previousBucketId: input.previousBucketId?.trim() || null,
    isArchived: input.isArchived ?? false,
    archivedAt: input.archivedAt?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
    createdAt: now,
    updatedAt: now
  };
}

export function updateWorkBucket(item: WorkBucket, input: WorkBucketUpdateInput): WorkBucket {
  if (input.status && !WORK_BUCKET_STATUSES.includes(input.status)) {
    throw new Error("Bucket status is invalid.");
  }

  if (input.deliveryFormat && !DELIVERY_FORMATS.includes(input.deliveryFormat)) {
    throw new Error("Bucket delivery format is invalid.");
  }

  if (input.locationType && !LOCATION_TYPES.includes(input.locationType)) {
    throw new Error("Bucket location type is invalid.");
  }

  const isArchived = input.isArchived ?? item.isArchived ?? input.status === "archived";
  const status = input.status ?? (isArchived ? "archived" : item.status);

  return {
    ...item,
    status,
    generatedLabel: input.generatedLabel === undefined ? item.generatedLabel : input.generatedLabel.trim(),
    cycleLabel: input.cycleLabel === undefined ? item.cycleLabel : input.cycleLabel.trim(),
    planningStartsAt: input.planningStartsAt === undefined ? item.planningStartsAt : input.planningStartsAt.trim(),
    startsAt: input.startsAt === undefined ? item.startsAt : input.startsAt.trim(),
    endsAt: input.endsAt === undefined ? item.endsAt : input.endsAt.trim(),
    closeoutDueAt: input.closeoutDueAt === undefined ? item.closeoutDueAt : input.closeoutDueAt.trim(),
    deliveryFormat: input.deliveryFormat ?? item.deliveryFormat,
    locationName: input.locationName === undefined ? item.locationName : input.locationName.trim(),
    locationType: input.locationType ?? item.locationType,
    ownerId: input.ownerId === undefined ? item.ownerId : input.ownerId?.trim() || null,
    previousBucketId: input.previousBucketId === undefined ? item.previousBucketId : input.previousBucketId?.trim() || null,
    isArchived,
    archivedAt: input.archivedAt === undefined ? item.archivedAt : input.archivedAt.trim(),
    notes: input.notes === undefined ? item.notes : input.notes.trim(),
    updatedAt: input.now ?? new Date().toISOString()
  };
}

export function archiveWorkBucket(item: WorkBucket, now = new Date().toISOString()) {
  return updateWorkBucket(item, {
    status: "archived",
    isArchived: true,
    archivedAt: now,
    now
  });
}

export function unarchiveWorkBucket(item: WorkBucket, status: WorkBucketStatus = "planning", now = new Date().toISOString()) {
  return updateWorkBucket(item, {
    status: status === "archived" ? "planning" : status,
    isArchived: false,
    archivedAt: "",
    now
  });
}

export function createProgramSeriesForBucket(bucket: WorkBucket): ProgramSeries {
  const now = bucket.createdAt || new Date().toISOString();

  return {
    id: bucket.programSeriesId || `series-${bucket.id.replace(/^bucket-/, "")}`,
    organizationId: bucket.organizationId,
    clientAssociationId: bucket.clientAssociationId,
    name: inferProgramSeriesName(bucket),
    defaultKind: bucket.kind,
    recurrence: normalizeRecurrencePattern(bucket.recurrence),
    defaultDeliveryFormat: normalizeDeliveryFormat(bucket.deliveryFormat),
    active: !isBucketArchived(bucket),
    notes: "",
    createdAt: now,
    updatedAt: bucket.updatedAt || now,
    defaultOwnerId: bucket.ownerId ?? null
  };
}

export function ensureProgramSeriesForBuckets(
  programSeries: ProgramSeries[],
  buckets: WorkBucket[]
): ProgramSeries[] {
  const nextSeries = [...programSeries];
  const seriesIds = new Set(nextSeries.map((series) => series.id));

  for (const bucket of buckets) {
    const programSeriesId = bucket.programSeriesId || `series-${bucket.id.replace(/^bucket-/, "")}`;

    if (!seriesIds.has(programSeriesId)) {
      const series = createProgramSeriesForBucket({ ...bucket, programSeriesId });
      nextSeries.push(series);
      seriesIds.add(series.id);
    }
  }

  return nextSeries;
}

export function normalizeWorkBucketsForProgramSeries(
  buckets: WorkBucket[],
  programSeries: ProgramSeries[]
): WorkBucket[] {
  return buckets.map((bucket) => {
    const programSeriesId = bucket.programSeriesId || `series-${bucket.id.replace(/^bucket-/, "")}`;
    const series = programSeries.find((candidate) => candidate.id === programSeriesId);
    const recurrence = normalizeRecurrencePattern(bucket.recurrence ?? series?.recurrence);
    const status = normalizeWorkBucketStatus(bucket.status);
    const cycleLabel = bucket.cycleLabel ?? getCycleLabel({ recurrence, startsAt: bucket.startsAt });
    const generatedLabel =
      bucket.generatedLabel ||
      generateBucketLabel({
        programSeriesName: series?.name ?? bucket.name,
        recurrence,
        startsAt: bucket.startsAt,
        cycleLabel
      });
    const now = bucket.createdAt || "2026-05-01T12:00:00.000Z";

    return {
      ...bucket,
      programSeriesId,
      generatedLabel,
      cycleLabel,
      status,
      recurrence,
      planningStartsAt: bucket.planningStartsAt ?? "",
      startsAt: bucket.startsAt ?? "",
      endsAt: bucket.endsAt ?? "",
      closeoutDueAt: bucket.closeoutDueAt ?? "",
      deliveryFormat: normalizeDeliveryFormat(bucket.deliveryFormat ?? series?.defaultDeliveryFormat),
      locationName: bucket.locationName ?? "",
      locationType: normalizeLocationType(bucket.locationType),
      ownerId: bucket.ownerId ?? series?.defaultOwnerId ?? null,
      previousBucketId: bucket.previousBucketId ?? null,
      isArchived: bucket.isArchived ?? status === "archived",
      archivedAt: bucket.archivedAt ?? "",
      notes: bucket.notes ?? "",
      createdAt: now,
      updatedAt: bucket.updatedAt || now
    };
  });
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
    const now = new Date().toISOString();
    defaults.push({
      id: `bucket-${crypto.randomUUID()}`,
      organizationId: input.organizationId,
      clientAssociationId: input.clientAssociationId,
      kind: "membership",
      name: "Membership",
      generatedLabel: "Membership",
      cycleLabel: "",
      status: "live",
      recurrence: "ongoing",
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
      createdAt: now,
      updatedAt: now
    });
  }

  if (!existingKinds.has("generalOperations")) {
    const now = new Date().toISOString();
    defaults.push({
      id: `bucket-${crypto.randomUUID()}`,
      organizationId: input.organizationId,
      clientAssociationId: input.clientAssociationId,
      kind: "generalOperations",
      name: "General Operations",
      generatedLabel: "General Operations",
      cycleLabel: "",
      status: "live",
      recurrence: "ongoing",
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
      createdAt: now,
      updatedAt: now
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

export function getCycleLabel(input: {
  recurrence: RecurrencePattern;
  startsAt?: string;
  cycleLabel?: string;
}) {
  if (input.cycleLabel !== undefined) {
    return input.cycleLabel.trim();
  }

  const date = parseDateOnly(input.startsAt);

  if (input.recurrence === "ongoing") {
    return "";
  }

  if (!date) {
    return "";
  }

  const year = date.getUTCFullYear();

  if (input.recurrence === "annual") {
    return String(year);
  }

  if (input.recurrence === "monthly") {
    return `${date.toLocaleString("en-US", { month: "long", timeZone: "UTC" })} ${year}`;
  }

  if (input.recurrence === "quarterly") {
    return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${year}`;
  }

  if (input.recurrence === "weekly") {
    return `Week of ${input.startsAt}`;
  }

  return input.startsAt ?? "";
}

export function generateBucketLabel(input: {
  programSeriesName: string;
  recurrence: RecurrencePattern;
  startsAt?: string;
  cycleLabel?: string;
}) {
  const baseName = input.programSeriesName.trim();
  const cycleLabel = getCycleLabel({
    recurrence: input.recurrence,
    startsAt: input.startsAt,
    cycleLabel: input.cycleLabel
  });

  if (!cycleLabel || input.recurrence === "ongoing") {
    return baseName;
  }

  if (input.recurrence === "annual") {
    return `${baseName} ${cycleLabel}`;
  }

  return `${baseName} - ${cycleLabel}`;
}

export function getBucketDisplayLabel(bucket: WorkBucket, programSeries?: ProgramSeries | null) {
  if (bucket.generatedLabel?.trim()) {
    return bucket.generatedLabel;
  }

  if (programSeries) {
    return generateBucketLabel({
      programSeriesName: programSeries.name,
      recurrence: bucket.recurrence ?? programSeries.recurrence,
      startsAt: bucket.startsAt,
      cycleLabel: bucket.cycleLabel
    });
  }

  return bucket.name;
}

export function getBucketOptionLabel(input: {
  bucket: WorkBucket;
  clients: ClientAssociation[];
  programSeries?: ProgramSeries[];
  includeKind?: boolean;
}) {
  const client = input.clients.find((candidate) => candidate.id === input.bucket.clientAssociationId);
  const series = input.programSeries?.find((candidate) => candidate.id === input.bucket.programSeriesId);
  const clientLabel = client?.shortName || client?.name || "Unknown client";
  const kindLabel = input.includeKind ? ` (${WORK_BUCKET_KIND_LABELS[input.bucket.kind]})` : "";

  return `${clientLabel} / ${getBucketDisplayLabel(input.bucket, series)}${kindLabel}`;
}

export function isBucketArchived(bucket: WorkBucket) {
  return bucket.isArchived === true || bucket.status === "archived";
}

export function isBucketPast(bucket: WorkBucket, referenceDate = new Date()) {
  if (bucket.status === "complete" || bucket.status === "canceled" || isBucketArchived(bucket)) {
    return true;
  }

  const endBoundary = parseDateOnly(bucket.closeoutDueAt || bucket.endsAt);

  return Boolean(endBoundary && endBoundary.getTime() < startOfUtcDay(referenceDate).getTime());
}

export function isBucketCurrent(bucket: WorkBucket, referenceDate = new Date()) {
  if (isBucketArchived(bucket) || isBucketPast(bucket, referenceDate)) {
    return false;
  }

  return ["idea", "planning", "production", "live", "closeout"].includes(bucket.status);
}

export function getCurrentBuckets(buckets: WorkBucket[], referenceDate = new Date()) {
  return buckets.filter((bucket) => isBucketCurrent(bucket, referenceDate));
}

export function getPastBuckets(buckets: WorkBucket[], referenceDate = new Date()) {
  return buckets.filter((bucket) => isBucketPast(bucket, referenceDate) && !isBucketArchived(bucket));
}

export function getSearchableBuckets(input: {
  buckets: WorkBucket[];
  programSeries?: ProgramSeries[];
  query?: string;
  includeArchived?: boolean;
}) {
  const query = input.query?.trim().toLowerCase() ?? "";

  return input.buckets.filter((bucket) => {
    if (isBucketArchived(bucket) && !input.includeArchived && !query) {
      return false;
    }

    if (!query) {
      return true;
    }

    const series = input.programSeries?.find((candidate) => candidate.id === bucket.programSeriesId);
    const haystack = [
      bucket.id,
      bucket.name,
      bucket.generatedLabel,
      bucket.cycleLabel,
      series?.name,
      WORK_BUCKET_KIND_LABELS[bucket.kind],
      WORK_BUCKET_STATUS_LABELS[bucket.status]
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

export function getRecentBucketsByProgramSeries(input: {
  buckets: WorkBucket[];
  programSeriesId: string;
  referenceDate?: Date;
  limit?: number;
}) {
  const referenceDate = input.referenceDate ?? new Date();
  const limit = input.limit ?? 3;

  return input.buckets
    .filter((bucket) => bucket.programSeriesId === input.programSeriesId && isBucketPast(bucket, referenceDate) && !isBucketArchived(bucket))
    .sort(compareBucketsByMostRecent)
    .slice(0, limit);
}

export function getBucketDropdownOptions(input: {
  buckets: WorkBucket[];
  referenceDate?: Date;
  includeArchived?: boolean;
  previousPerProgramSeries?: number;
}) {
  const referenceDate = input.referenceDate ?? new Date();
  const previousPerProgramSeries = input.previousPerProgramSeries ?? 3;
  const currentBuckets = input.buckets.filter((bucket) => isBucketCurrent(bucket, referenceDate));
  const selected = new Map(currentBuckets.map((bucket) => [bucket.id, bucket]));
  const seriesIds = new Set(input.buckets.map((bucket) => bucket.programSeriesId).filter((id): id is string => Boolean(id)));

  for (const programSeriesId of seriesIds) {
    for (const bucket of getRecentBucketsByProgramSeries({
      buckets: input.buckets,
      programSeriesId,
      referenceDate,
      limit: previousPerProgramSeries
    })) {
      selected.set(bucket.id, bucket);
    }
  }

  if (input.includeArchived) {
    for (const bucket of input.buckets.filter(isBucketArchived)) {
      selected.set(bucket.id, bucket);
    }
  }

  return [...selected.values()].sort(compareBucketsByMostRecent);
}

export function getBucketName(buckets: WorkBucket[], bucketId: string) {
  const bucket = buckets.find((candidate) => candidate.id === bucketId);

  return bucket ? getBucketDisplayLabel(bucket) : "Unbucketed work";
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

function parseDateOnly(value?: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function inferProgramSeriesName(bucket: WorkBucket) {
  if (bucket.recurrence === "ongoing") {
    return bucket.name;
  }

  return bucket.name
    .replace(/\s+-\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}$/u, "")
    .replace(/\s+-\s+Q[1-4]\s+\d{4}$/u, "")
    .replace(/\s+\d{4}$/u, "")
    .trim() || bucket.name;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getBucketSortDate(bucket: WorkBucket) {
  return parseDateOnly(bucket.startsAt || bucket.endsAt || bucket.closeoutDueAt)?.getTime() ?? 0;
}

function compareBucketsByMostRecent(left: WorkBucket, right: WorkBucket) {
  return getBucketSortDate(right) - getBucketSortDate(left) || getBucketDisplayLabel(left).localeCompare(getBucketDisplayLabel(right));
}
