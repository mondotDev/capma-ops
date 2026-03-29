import { type NormalizedWorkflowStatus, isNormalizedTerminalStatus } from "@/lib/workflow-status";
import { hasDueDate, isOverdue, daysUntil } from "@/lib/ops-utils";

export const COLLATERAL_STATUS_OPTIONS = [
  "Backlog",
  "In Design",
  "Ready for Print",
  "Sent to Printer",
  "Complete",
  "Cut"
] as const;

export type CollateralStatus = (typeof COLLATERAL_STATUS_OPTIONS)[number];

export type CollateralItem = {
  id: string;
  subEvent: string;
  itemName: string;
  status: CollateralStatus;
  printer: string;
  printerDeadline: string;
  quantity: string;
  updateType: string;
  notes: string;
  fileLink?: string;
  lastUpdated: string;
};

export type LegDayCollateralProfile = {
  eventStartDate: string;
  eventEndDate: string;
  roomBlockDeadline: string;
  roomBlockNote: string;
  logoDeadline: string;
  logoDeadlineNote: string;
  externalPrintingDue: string;
  internalPrintingStart: string;
};

export const initialLegDayCollateralProfile: LegDayCollateralProfile = {
  eventStartDate: "2026-04-21",
  eventEndDate: "2026-04-23",
  roomBlockDeadline: "2026-03-21",
  roomBlockNote: "Rooms will fill; Earth Day and other advocacy groups will be in town.",
  logoDeadline: "2026-03-23",
  logoDeadlineNote: "Sponsors confirmed after this date lose printed-material placement.",
  externalPrintingDue: "2026-03-27",
  internalPrintingStart: "2026-04-06"
};

export const initialLegDayCollateralItems: CollateralItem[] = [
  createSeedItem("golf-reception-thank-you-sign", "Golf Reception", "Thank You/Welcome sign", "Backlog", "Clark", "2026-03-27", "1", "Minor Update", ""),
  createSeedItem("golf-reception-table-tents", "Golf Reception", "Table Tents (Golf Reception)", "Backlog", "CAPMA", "2026-04-10", "10", "Minor Update", ""),
  createSeedItem("golf-registration-table-tents", "Golf Registration", "Golf Registration Table Tents", "Backlog", "CAPMA", "2026-04-10", "2", "", ""),
  createSeedItem("golf-registration-stickers", "Golf Registration", "Golf Registration Stickers (Name Stickers)", "In Design", "CAPMA", "2026-04-10", "", "Full Redesign", ""),
  createSeedItem("golf-registration-qr-signin", "Golf Registration", "Sign-In Sheets with QR Code (Golf)", "Backlog", "CAPMA", "2026-04-10", "2", "Full Redesign", ""),
  createSeedItem("golf-registration-logo-stickers", "Golf Registration", "Logo Stickers for Golf Bags", "Backlog", "CAPMA", "2026-04-10", "", "", ""),
  createSeedItem("golf-registration-water-bottle", "Golf Registration", "Water Bottle stickers", "Backlog", "CAPMA", "2026-04-01", "400", "Full Redesign", ""),
  createSeedItem("golf-hole-signs", "Golf Tournament", "Golf Hole Signs", "Backlog", "Clark", "2026-03-27", "18", "Minor Update", ""),
  createSeedItem("golf-winning-team-sign", "Golf Tournament", "Winning Team Sign", "Backlog", "Clark", "2026-03-27", "1", "Full Redesign", "Podium sized"),
  createSeedItem("legislative-leave-behind", "Legislative Visits", "Legislative leave-behind", "Backlog", "CAPMA", "2026-04-10", "100", "Full Redesign", ""),
  createSeedItem("group-photo-sign", "Legislative Visits", "CAPMA sign for group photo", "Backlog", "Clark", "2026-03-27", "1", "Minor Update", "Reusable, podium size"),
  createSeedItem("podium-signage", "Multi-Event/All Days", "Podium Signage", "Ready for Print", "Clark", "2026-03-27", "1", "Minor Update", ""),
  createSeedItem("welcome-leg-day-sign", "Multi-Event/All Days", "Welcome to Leg Day Sign", "Backlog", "Clark", "2026-03-27", "1", "Full Redesign", ""),
  createSeedItem("leg-day-sponsor-thank-you", "Multi-Event/All Days", "Thank you all Leg Day sponsors", "Backlog", "Clark", "2026-03-27", "1", "Full Redesign", ""),
  createSeedItem("master-slide-deck", "Multi-Event/All Days", "Master Slide Deck", "Backlog", "CAPMA", "2026-04-10", "", "Full Redesign", ""),
  createSeedItem("briefing-breakfast-sign", "Thursday Breakfast", "Welcome to the Briefing Breakfast (Sponsored By Sign)", "Backlog", "Clark", "2026-03-27", "1", "Full Redesign", ""),
  createSeedItem("briefing-breakfast-table-tents", "Thursday Breakfast", "Briefing Breakfast Table Tents", "Backlog", "CAPMA", "2026-04-10", "", "Full Redesign", ""),
  createSeedItem("briefing-breakfast-cups", "Thursday Breakfast", "Branded coffee cups with CAPMA and Sponsor", "Backlog", "Vendor", "2026-03-27", "", "Full Redesign", ""),
  createSeedItem("luncheon-welcome-sign", "Thursday Luncheon", "Welcome to Legislative Luncheon - Sponsor thank you", "Backlog", "Clark", "2026-03-27", "1", "Full Redesign", ""),
  createSeedItem("luncheon-napkins", "Thursday Luncheon", "Branded napkins for Thurs afternoon, year specific", "Backlog", "Vendor", "2026-03-27", "", "Minor Update", ""),
  createSeedItem("luncheon-table-tents", "Thursday Luncheon", "Table tents", "Backlog", "CAPMA", "2026-04-10", "", "Minor Update", ""),
  createSeedItem("board-table-tents", "Wednesday Board Meeting", "Table tents", "Backlog", "CAPMA", "2026-04-10", "", "Full Redesign", ""),
  createSeedItem("board-agenda", "Wednesday Board Meeting", "Board Agenda", "Backlog", "CAPMA", "2026-04-10", "", "Full Redesign", ""),
  createSeedItem("board-signage", "Wednesday Board Meeting", "Board Room Signage", "Backlog", "Clark", "2026-03-27", "1", "Full Redesign", ""),
  createSeedItem("committee-breakfast-table-tents", "Wednesday Breakfast", "Table Tents for Committee Breakfast", "Backlog", "CAPMA", "2026-04-10", "4", "Full Redesign", ""),
  createSeedItem("committee-breakfast-sign", "Wednesday Breakfast", "Welcome and Thank You Sign for Committee Breakfast Sponsors (All on One)", "Backlog", "Clark", "2026-03-27", "1", "Full Redesign", ""),
  createSeedItem("ceu-room-signage", "Wednesday CEUs", "Room Signage", "Backlog", "Clark", "2026-03-27", "1", "Full Redesign", ""),
  createSeedItem("ceu-signin-sheets", "Wednesday CEUs", "Branded sign-in sheets", "Backlog", "CAPMA", "2026-04-10", "", "", ""),
  createSeedItem("ceu-opening-deck", "Wednesday CEUs", "Opening Slide Deck", "Backlog", "CAPMA", "2026-04-10", "", "Full Redesign", ""),
  createSeedItem("ceu-closing-deck", "Wednesday CEUs", "Closing slide deck w/ QR code for quiz", "Backlog", "CAPMA", "2026-04-10", "", "Full Redesign", ""),
  createSeedItem("ceu-sticker-badges", "Wednesday CEUs", "sticker badges", "Backlog", "CAPMA", "2026-04-10", "", "Full Redesign", ""),
  createSeedItem("committee-qr-sheets", "Wednesday Committees", "Branded QR Sign-In Sheets", "Backlog", "CAPMA", "2026-04-10", "", "Full Redesign", ""),
  createSeedItem("committee-agendas", "Wednesday Committees", "Committee Meeting agendas", "Backlog", "CAPMA", "2026-04-10", "", "", ""),
  createSeedItem("reception-table-tents", "Wednesday Reception", "Table Tents for Wednesday Night Reception", "Backlog", "CAPMA", "2026-04-10", "", "Full Redesign", ""),
  createSeedItem("reception-napkins", "Wednesday Reception", "Branded Napkins for Wednesday Night Reception (Year-Specific)", "Backlog", "Vendor", "2026-03-27", "", "Full Redesign", ""),
  createSeedItem("reception-raffle-tent", "Wed Night Reception", "Wed Reception Raffle Table Tent", "Backlog", "CAPMA", "2026-03-27", "", "Full Redesign", ""),
  createSeedItem("registration-welcome-sign", "Wednesday Registration", "Welcome to Leg Day Sign", "Backlog", "Clark", "2026-03-27", "1", "Full Redesign", ""),
  createSeedItem("registration-lanyards", "Wednesday Registration", "Custom Lanyards w/ CAPMA + Premier logos", "In Design", "Vendor", "2026-03-27", "", "Full Redesign", ""),
  createSeedItem("registration-badges", "Wednesday Registration", "Name Badges w/ Premier Sponsor", "Backlog", "CAPMA", "2026-04-10", "", "Minor Update", "")
];

export const LEG_DAY_SUB_EVENT_OPTIONS = Array.from(
  new Set(initialLegDayCollateralItems.map((item) => item.subEvent))
);

export function normalizeCollateralWorkflowStatus(status: string): NormalizedWorkflowStatus {
  if (status === "Ready for Print") {
    return "ready";
  }

  if (status === "Complete") {
    return "complete";
  }

  if (status === "Cut") {
    return "cut";
  }

  return "active";
}

export function isCollateralTerminalStatus(status: string) {
  return isNormalizedTerminalStatus(normalizeCollateralWorkflowStatus(status));
}

export function isCollateralOverdue(item: Pick<CollateralItem, "printerDeadline" | "status">) {
  return !isCollateralTerminalStatus(item.status) && hasDueDate(item.printerDeadline) && isOverdue(item.printerDeadline);
}

export function isCollateralDueSoon(item: Pick<CollateralItem, "printerDeadline" | "status">) {
  if (isCollateralTerminalStatus(item.status) || !hasDueDate(item.printerDeadline) || isOverdue(item.printerDeadline)) {
    return false;
  }

  const days = daysUntil(item.printerDeadline);
  return days >= 0 && days <= 3;
}

function createSeedItem(
  id: string,
  subEvent: string,
  itemName: string,
  status: CollateralStatus,
  printer: string,
  printerDeadline: string,
  quantity: string,
  updateType: string,
  notes: string
): CollateralItem {
  return {
    id,
    subEvent,
    itemName,
    status,
    printer,
    printerDeadline,
    quantity,
    updateType,
    notes,
    lastUpdated: "2026-03-28"
  };
}
