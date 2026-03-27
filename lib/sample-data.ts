export type ActionItem = {
  id: string;
  title: string;
  type: string;
  workstream: string;
  dueDate: string;
  status: string;
  owner: string;
  waitingOn: string;
  lastUpdated: string;
  notes: string;
};

export const initialActionItems: ActionItem[] = [
  {
    id: "draft-ceo-briefing",
    title: "Draft CEO Briefing",
    type: "Deliverable",
    workstream: "News Brief",
    dueDate: "2026-04-18",
    status: "In Progress",
    owner: "Melissa",
    waitingOn: "",
    lastUpdated: "2026-03-25",
    notes: ""
  },
  {
    id: "get-sponsor-logos",
    title: "Get sponsor logos",
    type: "Task",
    workstream: "Legislative Day",
    dueDate: "2026-04-10",
    status: "Waiting",
    owner: "Melissa",
    waitingOn: "Sponsor",
    lastUpdated: "2026-03-20",
    notes: ""
  },
  {
    id: "print-table-tents",
    title: "Print table tents",
    type: "Collateral",
    workstream: "Legislative Day",
    dueDate: "2026-04-15",
    status: "Not Started",
    owner: "Melissa",
    waitingOn: "",
    lastUpdated: "2026-03-10",
    notes: ""
  },
  {
    id: "confirm-luncheon-signage",
    title: "Confirm luncheon signage",
    type: "Task",
    workstream: "Legislative Day",
    dueDate: "2026-03-29",
    status: "Waiting",
    owner: "Melissa",
    waitingOn: "Sponsor",
    lastUpdated: "2026-03-24",
    notes: ""
  },
  {
    id: "secure-printer-vendor",
    title: "Secure printer vendor",
    type: "Production",
    workstream: "The Voice",
    dueDate: "2026-03-30",
    status: "Waiting",
    owner: "Melissa",
    waitingOn: "Vendor",
    lastUpdated: "2026-03-22",
    notes: "Missing printer confirmation."
  },
  {
    id: "collect-final-ad-assets",
    title: "Collect final ad assets",
    type: "Task",
    workstream: "The Voice",
    dueDate: "2026-03-28",
    status: "Waiting",
    owner: "Melissa",
    waitingOn: "Assets",
    lastUpdated: "2026-03-23",
    notes: "Missing file package for production handoff."
  },
  {
    id: "production-proof-approval",
    title: "Production proof not ready",
    type: "Production",
    workstream: "News Brief",
    dueDate: "2026-03-27",
    status: "In Progress",
    owner: "Melissa",
    waitingOn: "Internal",
    lastUpdated: "2026-03-26",
    notes: "Press proof is not ready for release."
  },
  {
    id: "sponsor-thank-you-email",
    title: "Sponsor thank-you email",
    type: "Deliverable",
    workstream: "Legislative Day",
    dueDate: "2026-03-26",
    status: "Complete",
    owner: "Melissa",
    waitingOn: "",
    lastUpdated: "2026-03-26",
    notes: ""
  }
];
