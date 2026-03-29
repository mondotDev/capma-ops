export type CollateralTemplatePack = {
  id: string;
  name: string;
  eventTypeId: string;
  description: string;
};

export type CollateralTemplateSubEvent = {
  id: string;
  packId: string;
  name: string;
  sortOrder: number;
};

export type CollateralTemplateItem = {
  id: string;
  packId: string;
  name: string;
  templateSubEventId: string;
  defaultStatus: string;
  defaultPrinter: string;
  defaultQuantity: string;
  defaultUpdateType: string;
  defaultNotes: string;
};

export const initialCollateralTemplatePacks: CollateralTemplatePack[] = [
  {
    id: "legislative-day-core",
    name: "Legislative Day Core",
    eventTypeId: "legislative-day",
    description: "Baseline collateral structure for Legislative Day instances."
  }
];

export const initialCollateralTemplateSubEvents: CollateralTemplateSubEvent[] = [
  createLegDayTemplateSubEvent("golf-reception", "Golf Reception", 10),
  createLegDayTemplateSubEvent("golf-registration", "Golf Registration", 20),
  createLegDayTemplateSubEvent("golf-tournament", "Golf Tournament", 30),
  createLegDayTemplateSubEvent("legislative-visits", "Legislative Visits", 40),
  createLegDayTemplateSubEvent("multi-event", "Multi-Event/All Days", 50),
  createLegDayTemplateSubEvent("thursday-breakfast", "Thursday Breakfast", 60),
  createLegDayTemplateSubEvent("thursday-luncheon", "Thursday Luncheon", 70),
  createLegDayTemplateSubEvent("wednesday-board", "Wednesday Board Meeting", 80),
  createLegDayTemplateSubEvent("wednesday-breakfast", "Wednesday Breakfast", 90),
  createLegDayTemplateSubEvent("wednesday-ceus", "Wednesday CEUs", 100),
  createLegDayTemplateSubEvent("wednesday-committees", "Wednesday Committees", 110),
  createLegDayTemplateSubEvent("wednesday-reception", "Wednesday Reception", 120),
  createLegDayTemplateSubEvent("wed-night-reception", "Wed Night Reception", 130),
  createLegDayTemplateSubEvent("wednesday-registration", "Wednesday Registration", 140)
];

export const initialCollateralTemplateItems: CollateralTemplateItem[] = [
  createLegDayTemplateItem("golf-reception-thank-you-sign", "Thank You/Welcome sign", "Golf Reception", "Backlog", "Clark", "1", "Light Update", ""),
  createLegDayTemplateItem("golf-reception-table-tents", "Table Tents (Golf Reception)", "Golf Reception", "Backlog", "CAPMA", "10", "Light Update", ""),
  createLegDayTemplateItem("golf-registration-table-tents", "Golf Registration Table Tents", "Golf Registration", "Backlog", "CAPMA", "2", "", ""),
  createLegDayTemplateItem("golf-registration-stickers", "Golf Registration Stickers (Name Stickers)", "Golf Registration", "In Design", "CAPMA", "", "Net New", ""),
  createLegDayTemplateItem("golf-registration-qr-signin", "Sign-In Sheets with QR Code (Golf)", "Golf Registration", "Backlog", "CAPMA", "2", "Net New", ""),
  createLegDayTemplateItem("golf-registration-logo-stickers", "Logo Stickers for Golf Bags", "Golf Registration", "Backlog", "CAPMA", "", "", ""),
  createLegDayTemplateItem("golf-registration-water-bottle", "Water Bottle stickers", "Golf Registration", "Backlog", "CAPMA", "400", "Net New", ""),
  createLegDayTemplateItem("golf-hole-signs", "Golf Hole Signs", "Golf Tournament", "Backlog", "Clark", "18", "Light Update", ""),
  createLegDayTemplateItem("golf-winning-team-sign", "Winning Team Sign", "Golf Tournament", "Backlog", "Clark", "1", "Net New", "Podium sized"),
  createLegDayTemplateItem("legislative-leave-behind", "Legislative leave-behind", "Legislative Visits", "Backlog", "CAPMA", "100", "Net New", ""),
  createLegDayTemplateItem("group-photo-sign", "CAPMA sign for group photo", "Legislative Visits", "Backlog", "Clark", "1", "Light Update", "Reusable, podium size"),
  createLegDayTemplateItem("podium-signage", "Podium Signage", "Multi-Event/All Days", "Ready for Print", "Clark", "1", "Light Update", ""),
  createLegDayTemplateItem("welcome-leg-day-sign", "Welcome to Leg Day Sign", "Multi-Event/All Days", "Backlog", "Clark", "1", "Net New", ""),
  createLegDayTemplateItem("leg-day-sponsor-thank-you", "Thank you all Leg Day sponsors", "Multi-Event/All Days", "Backlog", "Clark", "1", "Net New", ""),
  createLegDayTemplateItem("master-slide-deck", "Master Slide Deck", "Multi-Event/All Days", "Backlog", "CAPMA", "", "Net New", ""),
  createLegDayTemplateItem("briefing-breakfast-sign", "Welcome to the Briefing Breakfast (Sponsored By Sign)", "Thursday Breakfast", "Backlog", "Clark", "1", "Net New", ""),
  createLegDayTemplateItem("briefing-breakfast-table-tents", "Briefing Breakfast Table Tents", "Thursday Breakfast", "Backlog", "CAPMA", "", "Net New", ""),
  createLegDayTemplateItem("briefing-breakfast-cups", "Branded coffee cups with CAPMA and Sponsor", "Thursday Breakfast", "Backlog", "Vendor", "", "Net New", ""),
  createLegDayTemplateItem("luncheon-welcome-sign", "Welcome to Legislative Luncheon - Sponsor thank you", "Thursday Luncheon", "Backlog", "Clark", "1", "Net New", ""),
  createLegDayTemplateItem("luncheon-napkins", "Branded napkins for Thurs afternoon, year specific", "Thursday Luncheon", "Backlog", "Vendor", "", "Light Update", ""),
  createLegDayTemplateItem("luncheon-table-tents", "Table tents", "Thursday Luncheon", "Backlog", "CAPMA", "", "Light Update", ""),
  createLegDayTemplateItem("board-table-tents", "Table tents", "Wednesday Board Meeting", "Backlog", "CAPMA", "", "Net New", ""),
  createLegDayTemplateItem("board-agenda", "Board Agenda", "Wednesday Board Meeting", "Backlog", "CAPMA", "", "Net New", ""),
  createLegDayTemplateItem("board-signage", "Board Room Signage", "Wednesday Board Meeting", "Backlog", "Clark", "1", "Net New", ""),
  createLegDayTemplateItem("committee-breakfast-table-tents", "Table Tents for Committee Breakfast", "Wednesday Breakfast", "Backlog", "CAPMA", "4", "Net New", ""),
  createLegDayTemplateItem("committee-breakfast-sign", "Welcome and Thank You Sign for Committee Breakfast Sponsors (All on One)", "Wednesday Breakfast", "Backlog", "Clark", "1", "Net New", ""),
  createLegDayTemplateItem("ceu-room-signage", "Room Signage", "Wednesday CEUs", "Backlog", "Clark", "1", "Net New", ""),
  createLegDayTemplateItem("ceu-signin-sheets", "Branded sign-in sheets", "Wednesday CEUs", "Backlog", "CAPMA", "", "", ""),
  createLegDayTemplateItem("ceu-opening-deck", "Opening Slide Deck", "Wednesday CEUs", "Backlog", "CAPMA", "", "Net New", ""),
  createLegDayTemplateItem("ceu-closing-deck", "Closing slide deck w/ QR code for quiz", "Wednesday CEUs", "Backlog", "CAPMA", "", "Net New", ""),
  createLegDayTemplateItem("ceu-sticker-badges", "sticker badges", "Wednesday CEUs", "Backlog", "CAPMA", "", "Net New", ""),
  createLegDayTemplateItem("committee-qr-sheets", "Branded QR Sign-In Sheets", "Wednesday Committees", "Backlog", "CAPMA", "", "Net New", ""),
  createLegDayTemplateItem("committee-agendas", "Committee Meeting agendas", "Wednesday Committees", "Backlog", "CAPMA", "", "", ""),
  createLegDayTemplateItem("reception-table-tents", "Table Tents for Wednesday Night Reception", "Wednesday Reception", "Backlog", "CAPMA", "", "Net New", ""),
  createLegDayTemplateItem("reception-napkins", "Branded Napkins for Wednesday Night Reception (Year-Specific)", "Wednesday Reception", "Backlog", "Vendor", "", "Net New", ""),
  createLegDayTemplateItem("reception-raffle-tent", "Wed Reception Raffle Table Tent", "Wed Night Reception", "Backlog", "CAPMA", "", "Net New", ""),
  createLegDayTemplateItem("registration-welcome-sign", "Welcome to Leg Day Sign", "Wednesday Registration", "Backlog", "Clark", "1", "Net New", ""),
  createLegDayTemplateItem("registration-lanyards", "Custom Lanyards w/ CAPMA + Premier logos", "Wednesday Registration", "In Design", "Vendor", "", "Net New", ""),
  createLegDayTemplateItem("registration-badges", "Name Badges w/ Premier Sponsor", "Wednesday Registration", "Backlog", "CAPMA", "", "Light Update", "")
];

export function getDefaultTemplatePackForEventType(eventTypeId: string) {
  return initialCollateralTemplatePacks.find((pack) => pack.eventTypeId === eventTypeId) ?? null;
}

export function getTemplateSubEventsForPack(packId: string) {
  return initialCollateralTemplateSubEvents.filter((subEvent) => subEvent.packId === packId);
}

export function getTemplateItemsForPack(packId: string) {
  return initialCollateralTemplateItems.filter((item) => item.packId === packId);
}

function createLegDayTemplateSubEvent(idSuffix: string, name: string, sortOrder: number): CollateralTemplateSubEvent {
  return {
    id: `legislative-day-core-${idSuffix}`,
    packId: "legislative-day-core",
    name,
    sortOrder
  };
}

function createLegDayTemplateItem(
  id: string,
  name: string,
  subEventName: string,
  defaultStatus: string,
  defaultPrinter: string,
  defaultQuantity: string,
  defaultUpdateType: string,
  defaultNotes: string
): CollateralTemplateItem {
  return {
    id,
    packId: "legislative-day-core",
    name,
    templateSubEventId:
      initialCollateralTemplateSubEvents.find((subEvent) => subEvent.name === subEventName)?.id ??
      "legislative-day-core-multi-event",
    defaultStatus,
    defaultPrinter,
    defaultQuantity,
    defaultUpdateType,
    defaultNotes
  };
}
