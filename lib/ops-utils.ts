import type { ActionItem, ActionNoteAuthor, ActionNoteEntry } from "@/lib/sample-data";

export const STATUS_OPTIONS = ["Not Started", "In Progress", "Waiting", "Cut", "Canceled", "Complete"] as const;
export const WAITING_ON_SUGGESTIONS = ["Sponsor", "Vendor", "Assets", "Internal", "Crystelle", "External"] as const;
export const WORKSTREAM_OPTIONS = [
  "Legislative Day",
  "Best Pest Expo",
  "Pest Ed",
  "Termite Academy",
  "First Friday",
  "Hands-On Workshops",
  "Development Summit",
  "Monday Mingle",
  "Newsbrief",
  "The Voice",
  "Membership Campaigns",
  "General Operations"
] as const;
export const EVENT_GROUP_OPTIONS = [
  "Legislative Day",
  "Best Pest Expo",
  "Pest Ed",
  "Termite Academy",
  "First Friday",
  "Hands-On Workshops",
  "Development Summit",
  "Monday Mingle",
  "Membership Campaigns",
  "General Operations"
] as const;
export const OWNER_OPTIONS = [
  "Melissa",
  "Crystelle",
  "Sitting President",
  "Governmental Affairs Chair",
  "External / TBD"
] as const;
export const SCHEDULED_WORKSTREAM_OPTIONS = [
  "Legislative Day",
  "Best Pest Expo",
  "Pest Ed",
  "Termite Academy",
  "First Friday",
  "Hands-On Workshops",
  "Development Summit",
  "Monday Mingle"
] as const;
export const DEFAULT_OWNER = "Melissa";
export type OwnerOption = (typeof OWNER_OPTIONS)[number];
export type EventGroupOption = (typeof EVENT_GROUP_OPTIONS)[number];
export type WorkstreamScheduleMode = "none" | "single" | "range" | "multiple";
export type WorkstreamSchedule = {
  workstream: (typeof SCHEDULED_WORKSTREAM_OPTIONS)[number];
  mode: WorkstreamScheduleMode;
  singleDate?: string;
  startDate?: string;
  endDate?: string;
  dates?: string[];
};
type LegacyBlockedFields = {
  blocked?: boolean;
};
type LegacyNotesField = {
  notes?: string;
};
type ActionItemBlockedState = Pick<ActionItem, "isBlocked" | "blockedBy" | "status"> & LegacyBlockedFields;
type NormalizeActionItemInput = Pick<ActionItem, "owner" | "workstream"> &
  Partial<Pick<ActionItem, "eventGroup" | "isBlocked" | "blockedBy" | "waitingOn" | "noteEntries" | "lastUpdated">> &
  LegacyBlockedFields &
  LegacyNotesField;
type NormalizeActionItemResult<T extends NormalizeActionItemInput> = Omit<
  T,
  "blocked" | "isBlocked" | "blockedBy" | "notes" | "noteEntries"
> &
  Pick<ActionItem, "owner" | "workstream"> &
  Pick<ActionItem, "noteEntries"> &
  Partial<Pick<ActionItem, "eventGroup" | "isBlocked" | "blockedBy" | "notes">>;

const NEWSBRIEF_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;

const VOICE_ISSUE_CONFIG = {
  2026: {
    Spring: "2026-01-22",
    Summer: "2026-04-30",
    Fall: "2026-07-23",
    Winter: "2026-10-22"
  },
  2027: {
    Spring: undefined,
    Summer: undefined,
    Fall: undefined,
    Winter: undefined
  }
} as const;

export type ActionFilter = "all" | "overdue" | "dueSoon" | "waiting" | "blocked" | "mine";
export type ActionFocus = "all" | "sponsor" | "production";
export type ActionLens =
  | "all"
  | "executionNow"
  | "plannedLater"
  | "reviewMissingDueDate"
  | "reviewWaitingTooLong"
  | "reviewStale";
export type IssueStatus = "Planned" | "Open" | "Complete";
export type IssueDefinition = {
  label: string;
  workstream: "Newsbrief" | "The Voice";
  year: number;
  dueDate?: string;
};
export type IssueRecord = IssueDefinition & {
  status: IssueStatus;
};

export type ActionSummaryCounts = {
  overdue: number;
  dueSoon: number;
  blocked: number;
  waiting: number;
  totalActive: number;
};
export type DailyLoadEntry = {
  date: string;
  count: number;
};
export type WorkstreamSummaryEntry = {
  workstream: string;
  total: number;
  overdue: number;
  dueSoon: number;
  inProgress: number;
};
export type IssueProgress = {
  complete: number;
  total: number;
};
export type StuckReasonCount = {
  label: string;
  count: number;
  source: "waiting" | "blocked" | "mixed";
};
export type WorkstreamDateContext = {
  dateText: string;
  countdownText: string;
};

export type ActionItemValidation = {
  type: boolean;
  title: boolean;
  workstream: boolean;
  issue: boolean;
  dueDate: boolean;
  owner: boolean;
  status: boolean;
  waitingOn: boolean;
  isValid: boolean;
};

const NEWSBRIEF_ISSUES = buildNewsbriefIssues([2026, 2027]);
const VOICE_ISSUES = buildVoiceIssues();
export const ISSUE_DEFINITIONS = [...NEWSBRIEF_ISSUES, ...VOICE_ISSUES];
export const ISSUE_OPTIONS = ISSUE_DEFINITIONS.map((issue) => issue.label);
export const LOCAL_FALLBACK_NOTE_AUTHOR: ActionNoteAuthor = {
  userId: null,
  initials: "LOC",
  displayName: "Local user"
};
export const LEGACY_NOTE_AUTHOR: ActionNoteAuthor = {
  userId: null,
  initials: "LEG",
  displayName: "Legacy note"
};

const DEFAULT_WORKSTREAM_SCHEDULES: WorkstreamSchedule[] = [
  { workstream: "Legislative Day", mode: "none" },
  { workstream: "Best Pest Expo", mode: "none" },
  { workstream: "Pest Ed", mode: "none" },
  { workstream: "Termite Academy", mode: "none" },
  {
    workstream: "First Friday",
    mode: "multiple",
    dates: ["2026-03-06", "2026-05-01", "2026-06-05", "2026-08-07", "2026-10-02", "2026-11-06"]
  },
  { workstream: "Hands-On Workshops", mode: "none" },
  { workstream: "Development Summit", mode: "none" },
  {
    workstream: "Monday Mingle",
    mode: "multiple",
    dates: ["2026-03-02", "2026-05-04", "2026-06-01", "2026-08-03", "2026-10-05", "2026-11-02"]
  }
];

export function getCurrentDate() {
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  return currentDate;
}

export function parseDate(dateValue: string) {
  if (!dateValue) {
    return null;
  }

  return new Date(`${dateValue}T00:00:00`);
}

export function isComplete(item: ActionItem) {
  return isTerminalStatus(item.status);
}

export function isTerminalStatus(status: string) {
  return status === "Complete" || status === "Cut" || status === "Canceled";
}

export function isDueSoonExcludedStatus(status: string) {
  return isTerminalStatus(status);
}

export function getActiveItems(items: ActionItem[]) {
  return items.filter((item) => !isTerminalStatus(item.status));
}

export function hasDueDate(item: Pick<ActionItem, "dueDate"> | string) {
  const dueDate = typeof item === "string" ? item : item.dueDate;
  return dueDate.trim().length > 0;
}

export function daysUntil(dateValue: string) {
  const parsedDate = parseDate(dateValue);

  if (!parsedDate) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.ceil((parsedDate.getTime() - getCurrentDate().getTime()) / (24 * 60 * 60 * 1000));
}

export function daysSince(dateValue: string) {
  const parsedDate = parseDate(dateValue);

  if (!parsedDate) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor((getCurrentDate().getTime() - parsedDate.getTime()) / (24 * 60 * 60 * 1000));
}

export function isOverdue(dueDate: string) {
  const parsedDate = parseDate(dueDate);
  return Boolean(parsedDate && parsedDate.getTime() < getCurrentDate().getTime());
}

export function isDueSoon(dueDate: string) {
  if (!hasDueDate(dueDate)) {
    return false;
  }

  const days = daysUntil(dueDate);
  return days >= 0 && days <= 3;
}

export function isItemDueSoon(item: ActionItem) {
  if (isDueSoonExcludedStatus(item.status)) {
    return false;
  }

  if (!hasDueDate(item.dueDate)) {
    return false;
  }

  if (isOverdue(item.dueDate)) {
    return false;
  }

  return isDueSoon(item.dueDate);
}

export function isWaitingIssue(item: ActionItem) {
  return item.status === "Waiting";
}

export function isWaitingTooLong(item: Pick<ActionItem, "status" | "lastUpdated">) {
  return item.status === "Waiting" && daysSince(item.lastUpdated) >= 7;
}

export function isStaleItem(item: Pick<ActionItem, "status" | "lastUpdated">) {
  return !isTerminalStatus(item.status) && item.status !== "Waiting" && daysSince(item.lastUpdated) >= 14;
}

export function isWaitingMissingReason(item: ActionItem) {
  return isWaitingIssue(item) && item.waitingOn.trim().length === 0;
}

export function getContextualDueDateLabel(status: string, isBlocked?: boolean) {
  if (status === "Waiting") {
    return "Next Follow-Up";
  }

  if (isBlocked) {
    return "Next Action";
  }

  return "Due Date";
}

export function isBlockedItem(item: ActionItemBlockedState) {
  if (isTerminalStatus(item.status)) {
    return false;
  }

  return Boolean(item.isBlocked ?? item.blocked ?? item.blockedBy?.trim());
}

export function isPublicationWorkstream(workstream: string) {
  return workstream === "Newsbrief" || workstream === "The Voice";
}

export function isOwnerOption(value: string): value is OwnerOption {
  return OWNER_OPTIONS.includes(value as OwnerOption);
}

export function normalizeOwnerValue(owner?: string) {
  const trimmedOwner = owner?.trim();

  if (!trimmedOwner) {
    return DEFAULT_OWNER;
  }

  if (isOwnerOption(trimmedOwner)) {
    return trimmedOwner;
  }

  const normalizedOwner = trimmedOwner.toLowerCase();

  if (normalizedOwner === "jake" || normalizedOwner.includes("governmental affairs chair")) {
    return "Governmental Affairs Chair";
  }

  if (
    normalizedOwner === "president" ||
    normalizedOwner === "sitting president" ||
    (normalizedOwner.includes("president") && normalizedOwner !== "vice president")
  ) {
    return "Sitting President";
  }

  if (normalizedOwner === "crystelle") {
    return "Crystelle";
  }

  if (normalizedOwner === "melissa") {
    return "Melissa";
  }

  if (
    normalizedOwner === "external" ||
    normalizedOwner === "tbd" ||
    normalizedOwner === "external / tbd" ||
    normalizedOwner.includes("vendor")
  ) {
    return "External / TBD";
  }

  return trimmedOwner;
}

export function resolveInitialOwner(owner: string, workstream: string) {
  const trimmedOwner = owner.trim();

  if (trimmedOwner.length > 0 && trimmedOwner !== DEFAULT_OWNER) {
    return trimmedOwner;
  }

  return (getSuggestedOwnerForWorkstream(workstream) ?? trimmedOwner) || DEFAULT_OWNER;
}

export function getOwnerOptions(owner?: string) {
  const normalizedOwner = owner?.trim();

  if (!normalizedOwner || isOwnerOption(normalizedOwner)) {
    return [...OWNER_OPTIONS];
  }

  return [normalizedOwner, ...OWNER_OPTIONS];
}

export function normalizeActionItemFields<T extends NormalizeActionItemInput>(item: T): NormalizeActionItemResult<T> {
  const { blocked, blockedBy, isBlocked, noteEntries, notes, ...rest } = item;
  const normalizedBlockedBy = normalizeOperationalReason(blockedBy);
  const normalizedNoteEntries = normalizeNoteEntries(noteEntries, notes, item.lastUpdated);

  return {
    ...rest,
    owner: normalizeOwnerValue(item.owner),
    workstream: normalizeWorkstreamValue(item.workstream),
    eventGroup: normalizeEventGroupValue(item.eventGroup),
    waitingOn: normalizeOperationalReason(item.waitingOn) ?? "",
    isBlocked: isBlocked ?? blocked ?? undefined,
    blockedBy: normalizedBlockedBy ? normalizedBlockedBy : undefined,
    noteEntries: normalizedNoteEntries,
    notes: undefined
  } as NormalizeActionItemResult<T>;
}

export function createActionNoteEntry(
  text: string,
  options?: {
    author?: Partial<ActionNoteAuthor>;
    createdAt?: string;
    id?: string;
  }
): ActionNoteEntry | null {
  const normalizedText = text.trim();

  if (!normalizedText) {
    return null;
  }

  const initials = options?.author?.initials?.trim() || LOCAL_FALLBACK_NOTE_AUTHOR.initials;
  const displayName = options?.author?.displayName?.trim() || LOCAL_FALLBACK_NOTE_AUTHOR.displayName || null;

  return {
    id: options?.id?.trim() || `note-${Date.now().toString(36)}`,
    text: normalizedText,
    createdAt: normalizeNoteTimestamp(options?.createdAt),
    author: {
      userId: options?.author?.userId ?? LOCAL_FALLBACK_NOTE_AUTHOR.userId,
      initials,
      displayName
    }
  };
}

export function normalizeNoteEntries(
  noteEntries?: ActionNoteEntry[],
  legacyNotes?: string,
  fallbackCreatedAt?: string
) {
  const normalizedEntries = (noteEntries ?? []).flatMap((entry) => {
    const normalizedText = entry.text?.trim();

    if (!normalizedText) {
      return [];
    }

    return [
      {
        id: entry.id?.trim() || `note-${normalizeNoteTimestamp(entry.createdAt)}-${normalizedText.slice(0, 12)}`,
        text: normalizedText,
        createdAt: normalizeNoteTimestamp(entry.createdAt || fallbackCreatedAt),
        author: {
          userId: entry.author?.userId ?? LOCAL_FALLBACK_NOTE_AUTHOR.userId,
          initials: entry.author?.initials?.trim() || LOCAL_FALLBACK_NOTE_AUTHOR.initials,
          displayName: entry.author?.displayName?.trim() || LOCAL_FALLBACK_NOTE_AUTHOR.displayName || null
        }
      }
    ];
  });

  if (normalizedEntries.length > 0) {
    return normalizedEntries;
  }

  const migratedLegacyNote = legacyNotes?.trim();

  if (!migratedLegacyNote) {
    return [];
  }

  return [
    {
      id: "legacy-note",
      text: migratedLegacyNote,
      createdAt: normalizeNoteTimestamp(fallbackCreatedAt),
      author: { ...LEGACY_NOTE_AUTHOR }
    }
  ];
}

export function sortNoteEntriesNewestFirst(noteEntries: ActionNoteEntry[]) {
  return [...noteEntries].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export function formatNoteEntryTimestamp(createdAt: string) {
  const parsedDate = new Date(createdAt);

  if (Number.isNaN(parsedDate.getTime())) {
    return createdAt;
  }

  return parsedDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function normalizeNoteTimestamp(createdAt?: string) {
  if (!createdAt?.trim()) {
    return new Date().toISOString();
  }

  const normalizedCreatedAt = createdAt.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedCreatedAt)) {
    return `${normalizedCreatedAt}T12:00:00.000Z`;
  }

  return normalizedCreatedAt;
}

export function syncActionItemStatus<T extends Pick<ActionItem, "status" | "waitingOn">>(
  current: T,
  nextStatus: string
): T {
  return {
    ...current,
    status: nextStatus,
    waitingOn: nextStatus === "Waiting" ? current.waitingOn : ""
  };
}

export function syncActionItemWorkstream<
  T extends Pick<ActionItem, "workstream" | "dueDate"> & Partial<Pick<ActionItem, "eventGroup" | "issue">>
>(current: T, nextWorkstream: string): T {
  const nextIssues = getIssuesForWorkstream(nextWorkstream);
  const nextIssue =
    current.issue && nextIssues.includes(current.issue as (typeof nextIssues)[number]) ? current.issue : "";

  return {
    ...current,
    workstream: nextWorkstream,
    eventGroup: syncEventGroupWithWorkstream(current.eventGroup, current.workstream, nextWorkstream) ?? "",
    issue: nextIssue,
    dueDate: nextIssue ? (getIssueDueDate(nextIssue) ?? current.dueDate) : current.dueDate
  };
}

export function syncActionItemIssue<
  T extends Pick<ActionItem, "workstream" | "dueDate"> & Partial<Pick<ActionItem, "eventGroup" | "issue">>
>(current: T, nextIssue: string): T {
  const nextWorkstream = nextIssue ? (getWorkstreamForIssue(nextIssue) ?? current.workstream) : current.workstream;

  return {
    ...current,
    issue: nextIssue,
    workstream: nextWorkstream,
    eventGroup: syncEventGroupWithWorkstream(current.eventGroup, current.workstream, nextWorkstream) ?? "",
    dueDate: nextIssue ? (getIssueDueDate(nextIssue) ?? current.dueDate) : current.dueDate
  };
}

export function validateActionItemInput(
  input: Pick<ActionItem, "type" | "title" | "workstream" | "dueDate" | "owner" | "status" | "waitingOn"> &
    Partial<Pick<ActionItem, "issue">>
): ActionItemValidation {
  const validation = {
    type: input.type.trim().length === 0,
    title: input.title.trim().length === 0,
    workstream: input.workstream.trim().length === 0,
    issue: shouldRequireIssue(input.type, input.workstream) && (input.issue?.length ?? 0) === 0,
    dueDate: input.dueDate.length === 0 && !isIssueMissingDueDate(input.issue),
    owner: input.owner.trim().length === 0,
    status: input.status.trim().length === 0,
    waitingOn: input.status === "Waiting" && input.waitingOn.length === 0
  };

  return {
    ...validation,
    isValid: Object.values(validation).every((value) => !value)
  };
}

export function normalizeWorkstreamValue(workstream?: string) {
  const trimmedWorkstream = workstream?.trim();

  if (!trimmedWorkstream) {
    return "";
  }

  if (trimmedWorkstream === "First Fridays") {
    return "First Friday";
  }

  return trimmedWorkstream;
}

export function normalizeEventGroupValue(eventGroup?: string) {
  const trimmedEventGroup = eventGroup?.trim();

  if (!trimmedEventGroup) {
    return undefined;
  }

  if (trimmedEventGroup === "First Fridays") {
    return "First Friday";
  }

  return trimmedEventGroup;
}

export function isEventGroupOption(value: string): value is EventGroupOption {
  return EVENT_GROUP_OPTIONS.includes(value as EventGroupOption);
}

export function getSuggestedEventGroupForWorkstream(workstream?: string): EventGroupOption | undefined {
  const normalizedWorkstream = normalizeWorkstreamValue(workstream);

  if (!normalizedWorkstream || isPublicationWorkstream(normalizedWorkstream)) {
    return undefined;
  }

  if (isEventGroupOption(normalizedWorkstream)) {
    return normalizedWorkstream;
  }

  return "General Operations";
}

export function syncEventGroupWithWorkstream(
  currentEventGroup: string | undefined,
  previousWorkstream: string | undefined,
  nextWorkstream: string | undefined
) {
  const trimmedEventGroup = normalizeEventGroupValue(currentEventGroup);

  if (!trimmedEventGroup) {
    return getSuggestedEventGroupForWorkstream(nextWorkstream);
  }

  const previousSuggestedEventGroup = getSuggestedEventGroupForWorkstream(previousWorkstream);

  if (trimmedEventGroup === previousSuggestedEventGroup) {
    return getSuggestedEventGroupForWorkstream(nextWorkstream);
  }

  return trimmedEventGroup;
}

export function getSuggestedOwnerForWorkstream(workstream?: string): OwnerOption | undefined {
  const normalizedWorkstream = normalizeWorkstreamValue(workstream).toLowerCase();

  if (!normalizedWorkstream || isPublicationWorkstream(normalizedWorkstream)) {
    return undefined;
  }

  if (normalizedWorkstream === "legislative day" || normalizedWorkstream === "first friday") {
    return "Melissa";
  }

  if (normalizedWorkstream.includes("government") || normalizedWorkstream.includes("legislative")) {
    return "Governmental Affairs Chair";
  }

  return undefined;
}

export function getIssueDefinition(issue: string) {
  return ISSUE_DEFINITIONS.find((definition) => definition.label === issue);
}

export function getGeneratedIssues(issueStatuses: Partial<Record<string, IssueStatus>> = {}) {
  return ISSUE_DEFINITIONS.map((issue) => ({
    ...issue,
    status: getIssueStatus(issue.label, issueStatuses)
  }));
}

export function getIssuesForWorkstream(workstream: string) {
  return ISSUE_DEFINITIONS.filter((issue) => issue.workstream === workstream).map((issue) => issue.label);
}

export function getIssueDueDate(issue?: string) {
  if (!issue) {
    return undefined;
  }

  return getIssueDefinition(issue)?.dueDate;
}

export function getWorkstreamForIssue(issue: string) {
  return getIssueDefinition(issue)?.workstream;
}

export function getIssueStatus(issue: string, issueStatuses: Partial<Record<string, IssueStatus>> = {}) {
  return issueStatuses[issue] ?? "Planned";
}

export function getOpenIssuesForWorkstream(issues: IssueRecord[], workstream: IssueRecord["workstream"]) {
  return issues
    .filter((issue) => issue.workstream === workstream && issue.status === "Open")
    .sort(compareIssuesByUpcomingOrder);
}

export function getNextPlannedIssueForWorkstream(
  issues: IssueRecord[],
  workstream: IssueRecord["workstream"],
  currentDate = getCurrentDate()
) {
  const plannedIssues = issues.filter((issue) => issue.workstream === workstream && issue.status === "Planned");
  const currentDateKey = currentDate.toISOString().slice(0, 10);

  const upcomingDatedIssues = plannedIssues
    .filter((issue) => issue.dueDate && issue.dueDate >= currentDateKey)
    .sort(compareIssuesByUpcomingOrder);

  if (upcomingDatedIssues.length > 0) {
    return upcomingDatedIssues[0];
  }

  const placeholderIssues = plannedIssues.filter((issue) => !issue.dueDate).sort(compareIssuesByUpcomingOrder);

  if (workstream === "The Voice" && placeholderIssues.length > 0) {
    return placeholderIssues[0];
  }

  return undefined;
}

export function getVisiblePublicationIssues(issues: IssueRecord[], currentDate = getCurrentDate()) {
  const workstreams: IssueRecord["workstream"][] = ["Newsbrief", "The Voice"];
  const visibleIssues: IssueRecord[] = [];

  for (const workstream of workstreams) {
    const openIssues = getOpenIssuesForWorkstream(issues, workstream);
    if (openIssues.length > 0) {
      visibleIssues.push(...openIssues);
      continue;
    }

    const nextPlannedIssue = getNextPlannedIssueForWorkstream(issues, workstream, currentDate);

    if (nextPlannedIssue) {
      visibleIssues.push(nextPlannedIssue);
    }
  }

  return visibleIssues;
}

export function isIssueMissingDueDate(issue?: string) {
  if (!issue) {
    return false;
  }

  return getIssueDefinition(issue) !== undefined && !getIssueDueDate(issue);
}

export function isItemMissingDueDate(item: ActionItem) {
  return Boolean(item.issue && isIssueMissingDueDate(item.issue) && !hasDueDate(item.dueDate));
}

export function shouldRequireIssue(itemType: string, workstream: string) {
  return itemType === "Deliverable" && isPublicationWorkstream(workstream);
}

export function getOpenCountForIssue(items: ActionItem[], issue: string) {
  return getActiveItems(items).filter((item) => item.issue === issue).length;
}

export function getOpenDeliverableCountForIssue(items: ActionItem[], issue: string) {
  return getActiveItems(items).filter((item) => item.issue === issue && item.type === "Deliverable").length;
}

export function getIssueCompletionCount(items: ActionItem[], issue: string) {
  return items.filter((item) => item.issue === issue && item.type === "Deliverable" && item.status === "Complete")
    .length;
}

export function getIssueProgress(items: ActionItem[], issue: string): IssueProgress {
  const deliverables = items.filter((item) => item.issue === issue && item.type === "Deliverable");

  return {
    complete: deliverables.filter((item) => item.status === "Complete").length,
    total: deliverables.length
  };
}

export function formatShortDate(dateValue: string) {
  const parsedDate = parseDate(dateValue);

  if (!parsedDate) {
    return "No due date set";
  }

  return parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

export function getDefaultWorkstreamSchedules() {
  return DEFAULT_WORKSTREAM_SCHEDULES.map((schedule) => ({
    ...schedule,
    dates: schedule.dates ? [...schedule.dates] : undefined
  }));
}

export function normalizeWorkstreamSchedules(schedules?: WorkstreamSchedule[]) {
  const normalizedByWorkstream = new Map<WorkstreamSchedule["workstream"], WorkstreamSchedule>(
    getDefaultWorkstreamSchedules().map((schedule) => [schedule.workstream, schedule] as const)
  );

  for (const schedule of schedules ?? []) {
    if (!SCHEDULED_WORKSTREAM_OPTIONS.includes(schedule.workstream)) {
      continue;
    }

    normalizedByWorkstream.set(schedule.workstream, normalizeWorkstreamSchedule(schedule));
  }

  return SCHEDULED_WORKSTREAM_OPTIONS.map((workstream) => normalizedByWorkstream.get(workstream)!).filter(Boolean);
}

export function getWorkstreamDateContext(
  workstream: string,
  schedules: WorkstreamSchedule[],
  issues: IssueRecord[],
  currentDate = getCurrentDate()
): WorkstreamDateContext | null {
  if (workstream === "Newsbrief" || workstream === "The Voice") {
    const openIssue = getOpenIssuesForWorkstream(issues, workstream)[0];
    const nextIssue = openIssue ?? getNextPlannedIssueForWorkstream(issues, workstream, currentDate);

    if (!nextIssue?.dueDate || daysUntil(nextIssue.dueDate) < 0) {
      return null;
    }

    return {
      dateText: formatShortDate(nextIssue.dueDate),
      countdownText: formatCountdownText(nextIssue.dueDate)
    };
  }

  const schedule = normalizeWorkstreamSchedules(schedules).find((entry) => entry.workstream === workstream);

  if (!schedule || schedule.mode === "none") {
    return null;
  }

  if (schedule.mode === "single" && schedule.singleDate && daysUntil(schedule.singleDate) >= 0) {
    return {
      dateText: formatShortDate(schedule.singleDate),
      countdownText: formatCountdownText(schedule.singleDate)
    };
  }

  if (schedule.mode === "range" && schedule.startDate && schedule.endDate && daysUntil(schedule.startDate) >= 0) {
    return {
      dateText: `${formatShortDate(schedule.startDate)} - ${formatShortDate(schedule.endDate)}`,
      countdownText: formatCountdownText(schedule.startDate)
    };
  }

  if (schedule.mode === "multiple" && schedule.dates) {
    const nextDate = [...schedule.dates].sort().find((date) => daysUntil(date) >= 0);

    if (nextDate) {
      return {
        dateText: `Next: ${formatShortDate(nextDate)}`,
        countdownText: formatCountdownText(nextDate)
      };
    }
  }

  return null;
}

export function formatRelativeDueLabel(item: ActionItem) {
  if (isItemMissingDueDate(item)) {
    return "missing issue setup";
  }

  if (!hasDueDate(item.dueDate)) {
    return "no due date set";
  }

  if (isWaitingIssue(item)) {
    return item.waitingOn ? `waiting on ${item.waitingOn}` : "waiting on required input";
  }

  const days = daysUntil(item.dueDate);

  if (days < 0) {
    return "overdue";
  }

  if (days === 0) {
    return "due today";
  }

  if (days <= 3) {
    return `due in ${days} day${days === 1 ? "" : "s"}`;
  }

  return `due ${formatShortDate(item.dueDate)}`;
}

export function formatDashboardItem(item: ActionItem) {
  return `${item.title} — ${item.issue ?? item.workstream} — ${formatRelativeDueLabel(item)}`;
}

export function getImmediateRiskPreview(item: ActionItem) {
  const title = item.title;

  if (isItemMissingDueDate(item) || !hasDueDate(item.dueDate)) {
    return {
      title,
      meta: `Needs date • ${item.workstream}`
    };
  }

  const days = daysUntil(item.dueDate);
  const dueText = `due ${formatShortDate(item.dueDate)}`;

  if (days < 0) {
    return {
      title,
      meta: `Overdue ${Math.abs(days)}d • ${dueText} • ${item.workstream}`
    };
  }

  if (days === 0) {
    return {
      title,
      meta: `Due today • ${dueText} • ${item.workstream}`
    };
  }

  return {
    title,
    meta: `Due in ${days}d • ${dueText} • ${item.workstream}`
  };
}

function normalizeWorkstreamSchedule(schedule: WorkstreamSchedule): WorkstreamSchedule {
  if (schedule.mode === "single") {
    return {
      workstream: schedule.workstream,
      mode: "single",
      singleDate: normalizeScheduleDate(schedule.singleDate)
    };
  }

  if (schedule.mode === "range") {
    return {
      workstream: schedule.workstream,
      mode: "range",
      startDate: normalizeScheduleDate(schedule.startDate),
      endDate: normalizeScheduleDate(schedule.endDate)
    };
  }

  if (schedule.mode === "multiple") {
    const dates = Array.from(
      new Set(
        (schedule.dates ?? [])
          .map((date) => normalizeScheduleDate(date))
          .filter((date): date is string => Boolean(date))
      )
    ).sort();

    return {
      workstream: schedule.workstream,
      mode: "multiple",
      dates
    };
  }

  return {
    workstream: schedule.workstream,
    mode: "none"
  };
}

function normalizeScheduleDate(value?: string) {
  return value?.trim() || undefined;
}

function formatCountdownText(dateValue: string) {
  const days = daysUntil(dateValue);

  if (days <= 0) {
    return "today";
  }

  if (days === 1) {
    return "tomorrow";
  }

  return `${days} days out`;
}

export function formatItemWithWorkstream(item: ActionItem) {
  return `${item.title} — ${item.workstream}`;
}

export function formatDueLabel(item: ActionItem) {
  if (isItemMissingDueDate(item) || !hasDueDate(item.dueDate)) {
    return "No due date set";
  }

  const days = daysUntil(item.dueDate);

  if (days < 0) {
    return "Overdue";
  }

  if (days === 0) {
    return "Due today";
  }

  if (days <= 3) {
    return `Due in ${days} day${days === 1 ? "" : "s"}`;
  }

  return "";
}

export function sortByPriority(a: ActionItem, b: ActionItem) {
  const aMissingIssueDueDate = isItemMissingDueDate(a);
  const bMissingIssueDueDate = isItemMissingDueDate(b);

  if (aMissingIssueDueDate !== bMissingIssueDueDate) {
    return aMissingIssueDueDate ? -1 : 1;
  }

  const aOverdue = isOverdue(a.dueDate);
  const bOverdue = isOverdue(b.dueDate);

  if (aOverdue !== bOverdue) {
    return aOverdue ? -1 : 1;
  }

  const aHasDueDate = hasDueDate(a.dueDate);
  const bHasDueDate = hasDueDate(b.dueDate);

  if (aHasDueDate !== bHasDueDate) {
    return aHasDueDate ? -1 : 1;
  }

  const dueDiff = daysUntil(a.dueDate) - daysUntil(b.dueDate);

  if (Number.isFinite(dueDiff) && dueDiff !== 0) {
    return dueDiff;
  }

  return a.title.localeCompare(b.title);
}

export function isSponsorRelated(item: ActionItem) {
  const haystack = `${item.title} ${item.workstream} ${item.waitingOn} ${item.type}`.toLowerCase();
  return haystack.includes("sponsor");
}

export function isProductionRisk(item: ActionItem) {
  const haystack = `${item.title} ${item.noteEntries.map((entry) => entry.text).join(" ")} ${item.waitingOn} ${item.type}`.toLowerCase();
  return (
    isItemMissingDueDate(item) ||
    haystack.includes("missing file") ||
    haystack.includes("missing printer") ||
    haystack.includes("not ready") ||
    haystack.includes("printer") ||
    haystack.includes("production")
  );
}

export function matchesSearchQuery(item: ActionItem, query?: string) {
  const normalizedQuery = query?.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    item.title,
    ...item.noteEntries.map((entry) => entry.text),
    item.workstream,
    item.eventGroup,
    item.issue,
    item.owner,
    item.waitingOn,
    item.blockedBy
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export function matchesActionFilter(item: ActionItem, filter: ActionFilter) {
  if (filter === "overdue") {
    return !isTerminalStatus(item.status) && isOverdue(item.dueDate);
  }

  if (filter === "dueSoon") {
    return isItemDueSoon(item);
  }

  if (filter === "waiting") {
    return isWaitingIssue(item) && !isBlockedItem(item);
  }

  if (filter === "blocked") {
    return isBlockedItem(item);
  }

  if (filter === "mine") {
    return normalizeOwnerValue(item.owner) === DEFAULT_OWNER;
  }

  return true;
}

export function matchesActionFocus(item: ActionItem, focus: ActionFocus) {
  if (focus === "sponsor") {
    return isSponsorRelated(item);
  }

  if (focus === "production") {
    return isProductionRisk(item);
  }

  return true;
}

export function matchesActionLens(item: ActionItem, lens: ActionLens) {
  if (lens === "all") {
    return true;
  }

  if (isTerminalStatus(item.status)) {
    return false;
  }

  if (lens === "reviewMissingDueDate") {
    return !hasDueDate(item.dueDate);
  }

  if (lens === "reviewWaitingTooLong") {
    return isWaitingTooLong(item);
  }

  if (lens === "reviewStale") {
    return isStaleItem(item);
  }

  const needsAttention =
    isBlockedItem(item) ||
    isWaitingIssue(item) ||
    isOverdue(item.dueDate) ||
    isItemDueSoon(item) ||
    item.status === "In Progress";

  if (lens === "executionNow") {
    return needsAttention;
  }

  return !needsAttention;
}

export function matchesEventGroup(item: ActionItem, eventGroup?: string) {
  if (!eventGroup || eventGroup === "all") {
    return true;
  }

  return (item.eventGroup ?? "").trim() === eventGroup;
}

export function getActionSummaryCounts(items: ActionItem[]): ActionSummaryCounts {
  const activeItems = getActiveItems(items);

  return {
    overdue: activeItems.filter((item) => isOverdue(item.dueDate)).length,
    dueSoon: activeItems.filter((item) => isItemDueSoon(item)).length,
    blocked: activeItems.filter((item) => isBlockedItem(item)).length,
    waiting: activeItems.filter((item) => isWaitingIssue(item)).length,
    totalActive: activeItems.length
  };
}

export function getDailyLoad(items: ActionItem[], days = 14): DailyLoadEntry[] {
  const startDate = getCurrentDate();
  const loadByDate = new Map<string, number>();

  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + offset);
    loadByDate.set(date.toISOString().slice(0, 10), 0);
  }

  for (const item of items) {
    if (isDueSoonExcludedStatus(item.status) || !hasDueDate(item.dueDate)) {
      continue;
    }

    if (!loadByDate.has(item.dueDate)) {
      continue;
    }

    loadByDate.set(item.dueDate, (loadByDate.get(item.dueDate) ?? 0) + 1);
  }

  return Array.from(loadByDate, ([date, count]) => ({
    date,
    count
  }));
}

export function getWorkstreamSummary(items: ActionItem[]): WorkstreamSummaryEntry[] {
  const summaryByWorkstream = new Map<string, WorkstreamSummaryEntry>();

  for (const item of items) {
    if (isTerminalStatus(item.status)) {
      continue;
    }

    const workstream = item.workstream.trim() || "Unassigned";
    const existingSummary = summaryByWorkstream.get(workstream) ?? {
      workstream,
      total: 0,
      overdue: 0,
      dueSoon: 0,
      inProgress: 0
    };

    existingSummary.total += 1;

    if (isOverdue(item.dueDate)) {
      existingSummary.overdue += 1;
    }

    if (isItemDueSoon(item)) {
      existingSummary.dueSoon += 1;
    }

    if (item.status === "In Progress") {
      existingSummary.inProgress += 1;
    }

    summaryByWorkstream.set(workstream, existingSummary);
  }

  return [...summaryByWorkstream.values()].sort(
    (a, b) =>
      b.total - a.total ||
      b.overdue - a.overdue ||
      b.dueSoon - a.dueSoon ||
      a.workstream.localeCompare(b.workstream)
  );
}

export function getDashboardMetrics(items: ActionItem[]) {
  const activeItems = getActiveItems(items);
  const summary = getActionSummaryCounts(items);
  const waitingCount = activeItems.filter((item) => isWaitingIssue(item) && !isBlockedItem(item)).length;
  const stuckItems = activeItems.filter((item) => isBlockedItem(item) || isWaitingIssue(item));
  const stuckReasonCounts = getStuckReasonCounts(stuckItems);
  const upcomingLoad = getDailyLoad(items, 7);
  const peakUpcomingLoadEntry = [...upcomingLoad].sort((a, b) => b.count - a.count || a.date.localeCompare(b.date))[0];
  const peakUpcomingLoadCount = peakUpcomingLoadEntry?.count ?? 0;
  const peakUpcomingLoadDate = peakUpcomingLoadEntry && peakUpcomingLoadEntry.count > 0 ? peakUpcomingLoadEntry.date : null;

  const urgentItems = activeItems
    .filter((item) => isItemMissingDueDate(item) || isOverdue(item.dueDate) || isItemDueSoon(item))
    .sort(sortByPriority)
    .slice(0, 3);

  const sponsorRiskItems = activeItems.filter(isSponsorRelated).sort(sortByPriority).slice(0, 3);
  const productionRiskItems = activeItems.filter(isProductionRisk).sort(sortByPriority).slice(0, 3);

  const workstreamOpenCounts = activeItems.reduce<Record<string, number>>((counts, item) => {
    counts[item.workstream] = (counts[item.workstream] ?? 0) + 1;
    return counts;
  }, {});

  const issueOpenCounts = ISSUE_OPTIONS.reduce<Record<string, number>>((counts, issue) => {
    counts[issue] = getOpenCountForIssue(items, issue);
    return counts;
  }, {});

  const issueDeliverableCounts = ISSUE_OPTIONS.reduce<Record<string, number>>((counts, issue) => {
    counts[issue] = getOpenDeliverableCountForIssue(items, issue);
    return counts;
  }, {});

  const issueProgress = ISSUE_OPTIONS.reduce<Record<string, IssueProgress>>((progress, issue) => {
    progress[issue] = getIssueProgress(items, issue);
    return progress;
  }, {});

  const issueSetupRisks = ISSUE_OPTIONS.map((issue) => ({
    issue,
    count: activeItems.filter((item) => item.issue === issue && isItemMissingDueDate(item)).length
  })).filter((entry) => entry.count > 0);

  return {
    ...summary,
    waiting: waitingCount,
    peakUpcomingLoadCount,
    peakUpcomingLoadDate,
    urgentItems,
    blockedCount: activeItems.filter((item) => isBlockedItem(item)).length,
    stuckReasonCounts,
    sponsorRiskItems,
    productionRiskItems,
    workstreamOpenCounts,
    issueOpenCounts,
    issueDeliverableCounts,
    issueProgress,
    issueSetupRisks
  };
}

function getStuckReasonCounts(items: ActionItem[]): StuckReasonCount[] {
  const reasonCounts = items.reduce<
    Map<string, { count: number; hasWaiting: boolean; hasBlocked: boolean }>
  >((counts, item) => {
    const reasons = new Map<string, { waiting: boolean; blocked: boolean }>();
    const waitingReason = normalizeStuckReason(item.waitingOn);
    const blockedReason = normalizeStuckReason(item.blockedBy);

    if (isWaitingIssue(item)) {
      reasons.set(waitingReason, {
        waiting: true,
        blocked: reasons.get(waitingReason)?.blocked ?? false
      });
    }

    if (isBlockedItem(item)) {
      reasons.set(blockedReason, {
        waiting: reasons.get(blockedReason)?.waiting ?? false,
        blocked: true
      });
    }

    reasons.forEach((reasonState, label) => {
      const existing = counts.get(label);
      counts.set(label, {
        count: (existing?.count ?? 0) + 1,
        hasWaiting: (existing?.hasWaiting ?? false) || reasonState.waiting,
        hasBlocked: (existing?.hasBlocked ?? false) || reasonState.blocked
      });
    });

    return counts;
  }, new Map());

  return [...reasonCounts.entries()]
    .map(([label, counts]) => ({
      label,
      count: counts.count,
      source: (
        counts.hasWaiting && counts.hasBlocked ? "mixed" : counts.hasBlocked ? "blocked" : "waiting"
      ) as StuckReasonCount["source"]
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 3);
}

function normalizeStuckReason(reason?: string) {
  const normalizedReason = normalizeOperationalReason(reason);
  return normalizedReason ? normalizedReason : "Unspecified";
}

function normalizeOperationalReason(reason?: string) {
  const trimmedReason = reason?.trim();

  if (!trimmedReason) {
    return undefined;
  }

  const matchedSuggestion = WAITING_ON_SUGGESTIONS.find(
    (option) => option.toLowerCase() === trimmedReason.toLowerCase()
  );

  return matchedSuggestion ?? trimmedReason;
}

function buildNewsbriefIssues(years: number[]) {
  return years.flatMap((year) =>
    NEWSBRIEF_MONTHS.map((month, monthIndex) => ({
      label: `${month} ${year} Newsbrief`,
      workstream: "Newsbrief" as const,
      year,
      dueDate: getNewsbriefDueDate(year, monthIndex)
    }))
  );
}

function buildVoiceIssues() {
  return Object.entries(VOICE_ISSUE_CONFIG).flatMap(([year, seasons]) =>
    Object.entries(seasons).map(([season, dueDate]) => ({
      label: `${season} ${year} The Voice`,
      workstream: "The Voice" as const,
      year: Number(year),
      dueDate
    }))
  );
}

function getNewsbriefDueDate(year: number, monthIndex: number) {
  const candidate = new Date(Date.UTC(year, monthIndex, 20));
  const day = candidate.getUTCDay();

  if (day === 6) {
    candidate.setUTCDate(candidate.getUTCDate() - 1);
  } else if (day === 0) {
    candidate.setUTCDate(candidate.getUTCDate() - 2);
  }

  return candidate.toISOString().slice(0, 10);
}

function compareIssuesByUpcomingOrder(a: IssueRecord, b: IssueRecord) {
  const aHasDueDate = Boolean(a.dueDate);
  const bHasDueDate = Boolean(b.dueDate);

  if (aHasDueDate !== bHasDueDate) {
    return aHasDueDate ? -1 : 1;
  }

  if (a.dueDate && b.dueDate) {
    return a.dueDate.localeCompare(b.dueDate);
  }

  if (a.year !== b.year) {
    return a.year - b.year;
  }

  return a.label.localeCompare(b.label);
}
