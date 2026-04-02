import planningSeed from "@/lib/planning-seed.json";

export type ActionNoteAuthor = {
  userId: string | null;
  initials: string;
  displayName?: string | null;
};

export type ActionNoteEntry = {
  id: string;
  text: string;
  createdAt: string;
  author: ActionNoteAuthor;
};

export type ActionItem = {
  id: string;
  title: string;
  type: string;
  workstream: string;
  archivedAt?: string;
  operationalBucket?: string;
  /**
   * Legacy Action View grouping field kept only for transitional compatibility.
   * New domain logic should prefer eventInstanceId or operationalBucket.
   */
  eventGroup?: string;
  legacyEventGroupMigrated?: boolean;
  eventInstanceId?: string;
  subEventId?: string;
  isBlocked?: boolean;
  blockedBy?: string;
  issue?: string;
  dueDate: string;
  status: string;
  owner: string;
  waitingOn: string;
  lastUpdated: string;
  noteEntries: ActionNoteEntry[];
  notes?: string;
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
