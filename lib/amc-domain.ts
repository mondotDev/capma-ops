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
}

export interface FoundationData {
  organization: AmcOrganization;
  clients: ClientAssociation[];
  staff: StaffProfile[];
  currentUser: CurrentUser;
  buckets: WorkBucket[];
  workItems: WorkItem[];
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
  workItems: [
    {
      id: "work-ppma-speaker-confirmations",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      bucketId: "bucket-ppma-annual-conference",
      tracker: "speaker",
      title: "Confirm speaker materials for breakout sessions",
      status: "inProgress",
      assigneeId: "staff-melissa",
      dueDate: "2026-06-12"
    },
    {
      id: "work-ppma-ceu-application",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-pacific-pest",
      bucketId: "bucket-ppma-ceu-program",
      tracker: "education",
      title: "Draft CEU application details",
      status: "notStarted",
      assigneeId: "staff-operations",
      dueDate: "2026-06-18"
    },
    {
      id: "work-wpc-sponsor-logo",
      organizationId: "org-demo-amc",
      clientAssociationId: "client-western-parks",
      bucketId: "bucket-wpc-sponsor-fulfillment",
      tracker: "sponsorFulfillment",
      title: "Collect sponsor logo and recognition copy",
      status: "waiting",
      assigneeId: null,
      dueDate: "2026-06-20"
    }
  ]
};

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
