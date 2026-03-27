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
  }
];
