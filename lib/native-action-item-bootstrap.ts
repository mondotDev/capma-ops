import { LEGISLATIVE_DAY_2026_INSTANCE_ID } from "@/lib/event-instances";
import { ISSUE_DEFINITIONS, normalizeOperationalReason } from "@/lib/ops-utils";
import type { ActionItem } from "@/lib/sample-data";

export type BootstrapLinkedEventMapping = {
  workstream: string;
  eventInstanceId?: string;
  operationalBucket?: "General Operations" | "Membership Campaigns";
};

export function mapBootstrapLinkedEvent(value: string): BootstrapLinkedEventMapping | null {
  if (!value || value === "Admin" || value === "Website" || value === "District") {
    return {
      workstream: "General Operations",
      operationalBucket: "General Operations"
    };
  }

  if (value === "Member") {
    return {
      workstream: "Membership Campaigns",
      operationalBucket: "Membership Campaigns"
    };
  }

  if (value === "Leg Day" || value === "Golf - Leg Day") {
    return {
      workstream: "Legislative Day",
      eventInstanceId: LEGISLATIVE_DAY_2026_INSTANCE_ID
    };
  }

  if (value === "Best Pest" || value === "Golf - Best Pest") {
    return { workstream: "Best Pest Expo" };
  }

  if (value === "FF") {
    return { workstream: "First Friday" };
  }

  if (value === "May Hands-On") {
    return { workstream: "Hands-On Workshops" };
  }

  if (value === "Termite Academy") {
    return { workstream: "Termite Academy" };
  }

  if (value === "Development Summit") {
    return { workstream: "Development Summit" };
  }

  if (value === "Monday Mingle") {
    return { workstream: "Monday Mingle" };
  }

  if (value === "NewsBrief") {
    return { workstream: "Newsbrief" };
  }

  if (value === "The Voice") {
    return { workstream: "The Voice" };
  }

  return null;
}

export function mapBootstrapStatus(value: string): ActionItem["status"] | null {
  if (value === "Backlog") {
    return "Not Started";
  }

  if (value === "In Progress") {
    return "In Progress";
  }

  if (value === "Waiting") {
    return "Waiting";
  }

  if (value === "Complete") {
    return "Complete";
  }

  if (value === "Ready") {
    return "In Progress";
  }

  if (value === "Canceled") {
    return "Canceled";
  }

  if (value === "Cut") {
    return "Cut";
  }

  return null;
}

export function inferBootstrapIssue(workstream: string, dueDate: string, title = "") {
  if (workstream !== "Newsbrief" && workstream !== "The Voice") {
    return "";
  }

  if (workstream === "The Voice") {
    const normalizedTitle = title.trim().toLowerCase();
    const dueYear = dueDate ? Number(dueDate.slice(0, 4)) : Number.NaN;
    const matchedSeason = ["spring", "summer", "fall", "winter"].find((season) => normalizedTitle.includes(season));

    if (matchedSeason && Number.isFinite(dueYear)) {
      const seasonalIssue = ISSUE_DEFINITIONS.find(
        (issue) =>
          issue.workstream === "The Voice" &&
          issue.year === dueYear &&
          issue.label.toLowerCase().startsWith(matchedSeason)
      );

      if (seasonalIssue) {
        return seasonalIssue.label;
      }
    }
  }

  if (!dueDate) {
    return "";
  }

  return ISSUE_DEFINITIONS.find((issue) => issue.workstream === workstream && issue.dueDate === dueDate)?.label ?? "";
}

export function inferBootstrapWaitingOn(status: ActionItem["status"], notes: string) {
  if (status !== "Waiting") {
    return "";
  }

  const trimmedNotes = notes.trim();

  if (!trimmedNotes) {
    return "";
  }

  const waitingMatch = trimmedNotes.match(/\bwaiting\s+(?:for|on)\s+(.+)/i);

  if (waitingMatch?.[1]) {
    return normalizeOperationalReason(waitingMatch[1].split(/[|.;]/, 1)[0]?.trim()) ?? "";
  }

  const needMatch = trimmedNotes.match(/^need\s+(.+)/i);

  if (needMatch?.[1]) {
    return normalizeOperationalReason(needMatch[1].split(/[|.;]/, 1)[0]?.trim()) ?? "";
  }

  return "";
}
