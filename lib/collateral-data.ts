import type { ActionNoteEntry } from "@/lib/sample-data";
import { type NormalizedWorkflowStatus, isNormalizedTerminalStatus } from "@/lib/workflow-status";
import {
  LEGISLATIVE_DAY_2026_INSTANCE_ID,
  getUnassignedSubEventId,
  getInitialLegDaySubEventIdByName,
  initialEventSubEvents
} from "@/lib/event-instances";
import { DEFAULT_OWNER, hasDueDate, isOverdue, daysUntil, normalizeNoteEntries } from "@/lib/ops-utils";

export const COLLATERAL_STATUS_OPTIONS = [
  "Backlog",
  "In Design",
  "Waiting",
  "Blocked",
  "Ready for Print",
  "Sent to Printer",
  "Complete",
  "Cut"
] as const;

export const COLLATERAL_UPDATE_TYPE_OPTIONS = [
  "",
  "Reuse",
  "Light Update",
  "Moderate Update",
  "Net New"
] as const;

export type CollateralStatus = (typeof COLLATERAL_STATUS_OPTIONS)[number];

export type CollateralItem = {
  id: string;
  eventInstanceId: string;
  subEventId: string;
  templateOriginId?: string;
  itemName: string;
  status: CollateralStatus;
  owner: string;
  blockedBy: string;
  dueDate: string;
  printer: string;
  quantity: string;
  updateType: string;
  noteEntries: ActionNoteEntry[];
  notes?: string;
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
  createSeedItem("golf-reception-thank-you-sign", "Golf Reception", "Thank You/Welcome sign", "Backlog", DEFAULT_OWNER, "", "2026-03-27", "Clark", "1", "Minor Update", "", "golf-reception-thank-you-sign"),
  createSeedItem("golf-reception-table-tents", "Golf Reception", "Table Tents (Golf Reception)", "Backlog", DEFAULT_OWNER, "", "2026-04-10", "CAPMA", "10", "Minor Update", "", "golf-reception-table-tents"),
  createSeedItem("golf-registration-table-tents", "Golf Registration", "Golf Registration Table Tents", "Backlog", DEFAULT_OWNER, "", "2026-04-10", "CAPMA", "2", "", "", "golf-registration-table-tents"),
  createSeedItem("golf-registration-stickers", "Golf Registration", "Golf Registration Stickers (Name Stickers)", "In Design", DEFAULT_OWNER, "", "2026-04-10", "CAPMA", "", "Full Redesign", "", "golf-registration-stickers"),
  createSeedItem("golf-registration-qr-signin", "Golf Registration", "Sign-In Sheets with QR Code (Golf)", "Backlog", DEFAULT_OWNER, "", "2026-04-10", "CAPMA", "2", "Full Redesign", "", "golf-registration-qr-signin"),
  createSeedItem("golf-registration-logo-stickers", "Golf Registration", "Logo Stickers for Golf Bags", "Backlog", DEFAULT_OWNER, "", "2026-04-10", "CAPMA", "", "", "", "golf-registration-logo-stickers"),
  createSeedItem("golf-registration-water-bottle", "Golf Registration", "Water Bottle stickers", "Backlog", DEFAULT_OWNER, "", "2026-04-01", "CAPMA", "400", "Full Redesign", "", "golf-registration-water-bottle"),
  createSeedItem("golf-hole-signs", "Golf Tournament", "Golf Hole Signs", "Backlog", DEFAULT_OWNER, "", "2026-03-27", "Clark", "18", "Minor Update", "", "golf-hole-signs"),
  createSeedItem("golf-winning-team-sign", "Golf Tournament", "Winning Team Sign", "Backlog", DEFAULT_OWNER, "", "2026-03-27", "Clark", "1", "Full Redesign", "Podium sized", "golf-winning-team-sign"),
  createSeedItem("legislative-leave-behind", "Legislative Visits", "Legislative leave-behind", "Backlog", DEFAULT_OWNER, "", "2026-04-10", "CAPMA", "100", "Full Redesign", "", "legislative-leave-behind"),
  createSeedItem("group-photo-sign", "Legislative Visits", "CAPMA sign for group photo", "Backlog", DEFAULT_OWNER, "", "2026-03-27", "Clark", "1", "Minor Update", "Reusable, podium size", "group-photo-sign"),
  createSeedItem("podium-signage", "Multi-Event/All Days", "Podium Signage", "Backlog", DEFAULT_OWNER, "", "2026-03-27", "Clark", "1", "Minor Update", "", "podium-signage"),
  createSeedItem("welcome-leg-day-sign", "Multi-Event/All Days", "Welcome to Leg Day Sign", "Backlog", DEFAULT_OWNER, "", "2026-03-27", "Clark", "1", "Full Redesign", "", "welcome-leg-day-sign"),
  createSeedItem("leg-day-sponsor-thank-you", "Multi-Event/All Days", "Thank you all Leg Day sponsors", "Backlog", DEFAULT_OWNER, "", "2026-03-27", "Clark", "1", "Full Redesign", "", "leg-day-sponsor-thank-you"),
  createSeedItem("master-slide-deck", "Multi-Event/All Days", "Master Slide Deck", "Backlog", DEFAULT_OWNER, "", "2026-04-10", "CAPMA", "", "Full Redesign", "", "master-slide-deck"),
  createSeedItem("briefing-breakfast-sign", "Thursday Breakfast", "Welcome to the Briefing Breakfast (Sponsored By Sign)", "Backlog", DEFAULT_OWNER, "", "2026-03-27", "Clark", "1", "Full Redesign", "", "briefing-breakfast-sign"),
  createSeedItem("briefing-breakfast-table-tents", "Thursday Breakfast", "Briefing Breakfast Table Tents", "Backlog", DEFAULT_OWNER, "", "2026-04-10", "CAPMA", "", "Full Redesign", "", "briefing-breakfast-table-tents"),
  createSeedItem("briefing-breakfast-cups", "Thursday Breakfast", "Branded coffee cups with CAPMA and Sponsor", "Backlog", DEFAULT_OWNER, "", "2026-03-27", "Vendor", "", "Full Redesign", "", "briefing-breakfast-cups"),
  createSeedItem("luncheon-welcome-sign", "Thursday Luncheon", "Welcome to Legislative Luncheon - Sponsor thank you", "Backlog", DEFAULT_OWNER, "", "2026-03-27", "Clark", "1", "Full Redesign", "", "luncheon-welcome-sign"),
  createSeedItem("luncheon-napkins", "Thursday Luncheon", "Branded napkins for Thurs afternoon, year specific", "Backlog", DEFAULT_OWNER, "", "2026-03-27", "Vendor", "", "Minor Update", "", "luncheon-napkins"),
  createSeedItem("luncheon-table-tents", "Thursday Luncheon", "Table tents", "Backlog", DEFAULT_OWNER, "", "2026-04-10", "CAPMA", "", "Minor Update", "", "luncheon-table-tents"),
  createSeedItem("board-table-tents", "Wednesday Board Meeting", "Table tents", "Backlog", DEFAULT_OWNER, "", "2026-04-10", "CAPMA", "", "Full Redesign", "", "board-table-tents"),
  createSeedItem("board-agenda", "Wednesday Board Meeting", "Board Agenda", "Backlog", DEFAULT_OWNER, "", "2026-04-10", "CAPMA", "", "Full Redesign", "", "board-agenda"),
  createSeedItem("board-signage", "Wednesday Board Meeting", "Board Room Signage", "Backlog", DEFAULT_OWNER, "", "2026-03-27", "Clark", "1", "Full Redesign", "", "board-signage"),
  createSeedItem("committee-breakfast-table-tents", "Wednesday Breakfast", "Table Tents for Committee Breakfast", "Backlog", DEFAULT_OWNER, "", "2026-04-10", "CAPMA", "4", "Full Redesign", "", "committee-breakfast-table-tents"),
  createSeedItem("committee-breakfast-sign", "Wednesday Breakfast", "Welcome and Thank You Sign for Committee Breakfast Sponsors (All on One)", "Backlog", DEFAULT_OWNER, "", "2026-03-27", "Clark", "1", "Full Redesign", "", "committee-breakfast-sign"),
  createSeedItem("ceu-room-signage", "Wednesday CEUs", "Room Signage", "Backlog", DEFAULT_OWNER, "", "2026-03-27", "Clark", "1", "Full Redesign", "", "ceu-room-signage"),
  createSeedItem("ceu-signin-sheets", "Wednesday CEUs", "Branded sign-in sheets", "Backlog", DEFAULT_OWNER, "", "2026-04-10", "CAPMA", "", "", "", "ceu-signin-sheets"),
  createSeedItem("ceu-opening-deck", "Wednesday CEUs", "Opening Slide Deck", "Backlog", DEFAULT_OWNER, "", "2026-04-10", "CAPMA", "", "Full Redesign", "", "ceu-opening-deck"),
  createSeedItem("ceu-closing-deck", "Wednesday CEUs", "Closing slide deck w/ QR code for quiz", "Backlog", DEFAULT_OWNER, "", "2026-04-10", "CAPMA", "", "Full Redesign", "", "ceu-closing-deck"),
  createSeedItem("ceu-sticker-badges", "Wednesday CEUs", "sticker badges", "Backlog", DEFAULT_OWNER, "", "2026-04-10", "CAPMA", "", "Full Redesign", "", "ceu-sticker-badges"),
  createSeedItem("committee-qr-sheets", "Wednesday Committees", "Branded QR Sign-In Sheets", "Backlog", DEFAULT_OWNER, "", "2026-04-10", "CAPMA", "", "Full Redesign", "", "committee-qr-sheets"),
  createSeedItem("committee-agendas", "Wednesday Committees", "Committee Meeting agendas", "Backlog", DEFAULT_OWNER, "", "2026-04-10", "CAPMA", "", "", "", "committee-agendas"),
  createSeedItem("reception-table-tents", "Wednesday Reception", "Table Tents for Wednesday Night Reception", "Backlog", DEFAULT_OWNER, "", "2026-04-10", "CAPMA", "", "Full Redesign", "", "reception-table-tents"),
  createSeedItem("reception-napkins", "Wednesday Reception", "Branded Napkins for Wednesday Night Reception (Year-Specific)", "Backlog", DEFAULT_OWNER, "", "2026-03-27", "Vendor", "", "Full Redesign", "", "reception-napkins"),
  createSeedItem("reception-raffle-tent", "Wed Night Reception", "Wed Reception Raffle Table Tent", "Backlog", DEFAULT_OWNER, "", "2026-03-27", "CAPMA", "", "Full Redesign", "", "reception-raffle-tent"),
  createSeedItem("registration-welcome-sign", "Wednesday Registration", "Welcome to Leg Day Sign", "Backlog", DEFAULT_OWNER, "", "2026-03-27", "Clark", "1", "Full Redesign", "", "registration-welcome-sign"),
  createSeedItem("registration-lanyards", "Wednesday Registration", "Custom Lanyards w/ CAPMA + Premier logos", "In Design", DEFAULT_OWNER, "", "2026-03-27", "Vendor", "", "Full Redesign", "", "registration-lanyards"),
  createSeedItem("registration-badges", "Wednesday Registration", "Name Badges w/ Premier Sponsor", "Backlog", DEFAULT_OWNER, "", "2026-04-10", "CAPMA", "", "Minor Update", "", "registration-badges")
];

export const LEG_DAY_SUB_EVENT_OPTIONS = Array.from(
  new Set(initialEventSubEvents.map((subEvent) => subEvent.name))
);

export function normalizeCollateralWorkflowStatus(status: string): NormalizedWorkflowStatus {
  if (status === "Waiting") {
    return "waiting";
  }

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

export function isCollateralBlocked(item: Pick<CollateralItem, "status" | "blockedBy">) {
  return item.status === "Blocked" || item.blockedBy.trim().length > 0;
}

export function isCollateralOverdue(item: Pick<CollateralItem, "dueDate" | "status">) {
  return (
    !isCollateralTerminalStatus(item.status) &&
    item.status !== "Sent to Printer" &&
    hasDueDate(item.dueDate) &&
    isOverdue(item.dueDate)
  );
}

export function isCollateralDueSoon(item: Pick<CollateralItem, "dueDate" | "status">) {
  if (
    isCollateralTerminalStatus(item.status) ||
    item.status === "Sent to Printer" ||
    !hasDueDate(item.dueDate) ||
    isOverdue(item.dueDate)
  ) {
    return false;
  }

  const days = daysUntil(item.dueDate);
  return days >= 0 && days <= 3;
}

export function normalizeCollateralItem(
  item: Partial<CollateralItem> & { subEvent?: unknown }
): CollateralItem | null {
  if (
    typeof item.id !== "string" ||
    typeof item.itemName !== "string" ||
    typeof item.status !== "string" ||
    typeof item.printer !== "string" ||
    typeof item.quantity !== "string" ||
    typeof item.updateType !== "string" ||
    typeof item.lastUpdated !== "string"
  ) {
    return null;
  }

  const eventInstanceId =
    typeof item.eventInstanceId === "string" && item.eventInstanceId.length > 0
      ? item.eventInstanceId
      : LEGISLATIVE_DAY_2026_INSTANCE_ID;
  const subEventId =
    typeof item.subEventId === "string"
      ? item.subEventId === "__unassigned__"
        ? getUnassignedSubEventId(eventInstanceId)
        : item.subEventId
      : typeof item.subEvent === "string"
        ? getInitialLegDaySubEventIdByName(item.subEvent)
        : null;

  if (!subEventId) {
    return null;
  }

  return {
    id: item.id,
    eventInstanceId,
    subEventId,
    templateOriginId: typeof item.templateOriginId === "string" ? item.templateOriginId : undefined,
    itemName: item.itemName,
    status: item.status as CollateralStatus,
    owner: typeof item.owner === "string" && item.owner.length > 0 ? item.owner : DEFAULT_OWNER,
    blockedBy: typeof item.blockedBy === "string" ? item.blockedBy : "",
    dueDate:
      typeof item.dueDate === "string"
        ? item.dueDate
        : typeof (item as { printerDeadline?: unknown }).printerDeadline === "string"
          ? ((item as { printerDeadline?: string }).printerDeadline ?? "")
          : "",
    printer: item.printer,
    quantity: item.quantity,
    updateType: normalizeCollateralUpdateType(item.updateType),
    noteEntries: normalizeNoteEntries(item.noteEntries, typeof item.notes === "string" ? item.notes : "", item.lastUpdated),
    notes: undefined,
    fileLink: typeof item.fileLink === "string" ? item.fileLink : undefined,
    lastUpdated: item.lastUpdated
  };
}

function createSeedItem(
  id: string,
  subEventName: string,
  itemName: string,
  status: CollateralStatus,
  owner: string,
  blockedBy: string,
  dueDate: string,
  printer: string,
  quantity: string,
  updateType: string,
  notes: string,
  templateOriginId?: string
): CollateralItem {
  return {
    id,
    eventInstanceId: LEGISLATIVE_DAY_2026_INSTANCE_ID,
    subEventId: getInitialLegDaySubEventIdByName(subEventName) ?? "leg-day-multi-event",
    templateOriginId,
    itemName,
    status,
    owner,
    blockedBy,
    dueDate,
    printer,
    quantity,
    updateType: normalizeCollateralUpdateType(updateType),
    noteEntries: normalizeNoteEntries(undefined, notes, "2026-03-28"),
    notes: undefined,
    lastUpdated: "2026-03-28"
  };
}

export function normalizeCollateralUpdateType(updateType: string) {
  if (updateType === "Minor Update") {
    return "Light Update";
  }

  if (updateType === "Full Redesign") {
    return "Net New";
  }

  if (
    updateType === "Reuse" ||
    updateType === "Light Update" ||
    updateType === "Moderate Update" ||
    updateType === "Net New"
  ) {
    return updateType;
  }

  return "";
}
