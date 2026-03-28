import planningSeed from "@/lib/planning-seed.json";

export type ActionItem = {
  id: string;
  title: string;
  type: string;
  workstream: string;
  eventGroup?: string;
  blocked?: boolean;
  blockedBy?: string;
  issue?: string;
  dueDate: string;
  status: string;
  owner: string;
  waitingOn: string;
  lastUpdated: string;
  notes: string;
};

export const LEGACY_SAMPLE_ITEM_IDS = [
  "draft-ceo-briefing",
  "get-sponsor-logos",
  "print-table-tents",
  "confirm-luncheon-signage",
  "secure-printer-vendor",
  "collect-final-ad-assets",
  "production-proof-approval",
  "sponsor-thank-you-email",
  "spring-voice-planning"
] as const;

export const initialActionItems: ActionItem[] = planningSeed as ActionItem[];
