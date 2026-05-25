export const PRODUCT_NAME = "AMC Ops Hub";

export type AmcUserRole = "admin" | "employee";

export type ClientAssociationStatus = "active" | "paused" | "archived";

export type WorkBucketKind =
  | "event"
  | "educationProgram"
  | "publicationIssue"
  | "sponsorFulfillment"
  | "internalOps";

export type WorkTrackerKind =
  | "action"
  | "collateral"
  | "education"
  | "speaker"
  | "sponsorFulfillment";

export type WorkStatus = "notStarted" | "inProgress" | "waiting" | "blocked" | "complete";

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
  status: "planned" | "inProgress" | "proofing" | "ready" | "complete";
  assigneeId: string | null;
  dueDate: string;
  printer: string;
  quantity: string;
  format: string;
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
}

export interface WorkVisibilityFilter {
  viewer: CurrentUser;
  clientAssociationId?: string;
  assigneeId?: string;
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
      id: "bucket-wpc-sponsor-fulfillment",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-western-parks",
      kind: "sponsorFulfillment",
      name: "Partner Fulfillment",
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
      status: "proofing",
      assigneeId: "staff-melissa",
      dueDate: "2026-06-10",
      printer: "Preferred local printer",
      quantity: "500",
      format: "Postcard",
      relatedActionItemIds: [],
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

export function createCollateralActionItem(input: {
  collateralItem: CollateralItem;
  title: string;
  assigneeId?: string | null;
  dueDate?: string;
  data: Pick<FoundationData, "buckets" | "clients" | "organization">;
}) {
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

  if (status === "planned") {
    return "notStarted";
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

    if (filter.viewer.role !== "admin" && item.assigneeId !== filter.viewer.assigneeId) {
      return false;
    }

    if (filter.viewer.role === "admin" && filter.assigneeId && item.assigneeId !== filter.assigneeId) {
      return false;
    }

    return true;
  });
}
