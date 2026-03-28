import { createActionItem } from "@/lib/action-item-mutations";
import { getPublicationTemplates } from "@/lib/publication-templates";
import type { ActionItem } from "@/lib/sample-data";
import { getIssueDueDate, getWorkstreamForIssue, type IssueStatus } from "@/lib/ops-utils";

export type GenerateDeliverablesResult = {
  created: number;
  skipped: number;
};

export function generatePublicationIssueDeliverables(
  items: ActionItem[],
  issue: string
): { items: ActionItem[]; result: GenerateDeliverablesResult } {
  const workstream = getWorkstreamForIssue(issue);

  if (!workstream) {
    return {
      items,
      result: { created: 0, skipped: 0 }
    };
  }

  const templates = getPublicationTemplates(workstream);
  const additions: ActionItem[] = [];
  let skipped = 0;
  const issueDueDate = getIssueDueDate(issue) ?? "";

  for (const template of templates) {
    const exists = items.some(
      (item) => item.issue === issue && item.workstream === workstream && item.title === template.title
    );

    if (exists) {
      skipped += 1;
      continue;
    }

    additions.push(
      createActionItem({
        type: "Deliverable",
        title: template.title,
        workstream,
        issue,
        dueDate: issueDueDate,
        status: "Not Started",
        owner: template.defaultOwner,
        waitingOn: "",
        notes: ""
      })
    );
  }

  return {
    items: additions.length > 0 ? [...additions, ...items] : items,
    result: {
      created: additions.length,
      skipped
    }
  };
}

export function setPublicationIssueStatus(
  issueStatuses: Partial<Record<string, IssueStatus>>,
  issue: string,
  status: IssueStatus
): Partial<Record<string, IssueStatus>> {
  return {
    ...issueStatuses,
    [issue]: status
  };
}

export function openPublicationIssue(
  items: ActionItem[],
  issueStatuses: Partial<Record<string, IssueStatus>>,
  issue: string
): {
  items: ActionItem[];
  issueStatuses: Partial<Record<string, IssueStatus>>;
  result: GenerateDeliverablesResult;
} {
  const nextIssueStatuses = setPublicationIssueStatus(issueStatuses, issue, "Open");
  const generation = generatePublicationIssueDeliverables(items, issue);

  return {
    items: generation.items,
    issueStatuses: nextIssueStatuses,
    result: generation.result
  };
}
