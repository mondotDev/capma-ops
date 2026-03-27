"use client";

import { createContext, useContext, useState } from "react";
import { getPublicationTemplateTitles } from "@/lib/publication-templates";
import { initialActionItems, type ActionItem } from "@/lib/sample-data";
import {
  DEFAULT_OWNER,
  type IssueRecord,
  type IssueStatus,
  getGeneratedIssues,
  getIssueDueDate,
  getWorkstreamForIssue
} from "@/lib/ops-utils";

export type NewActionItem = Omit<ActionItem, "id" | "lastUpdated">;
export type GenerateDeliverablesResult = {
  created: number;
  skipped: number;
};

type AppStateContextValue = {
  items: ActionItem[];
  issues: IssueRecord[];
  addItem: (item: NewActionItem) => void;
  deleteItem: (id: string) => void;
  completeIssue: (issue: string) => void;
  generateMissingDeliverablesForIssue: (issue: string) => GenerateDeliverablesResult;
  generateIssueDeliverables: (issue: string) => GenerateDeliverablesResult;
  openIssue: (issue: string) => GenerateDeliverablesResult;
  setIssueStatus: (issue: string, status: IssueStatus) => void;
  updateItem: (id: string, updates: Partial<ActionItem>) => void;
};

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ActionItem[]>(initialActionItems);
  const [issueStatuses, setIssueStatuses] = useState<Partial<Record<string, IssueStatus>>>({});

  function addItem(item: NewActionItem) {
    setItems((current) => [createActionItem(item), ...current]);
  }

  function deleteItem(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  function generateIssueDeliverables(issue: string): GenerateDeliverablesResult {
    const workstream = getWorkstreamForIssue(issue);

    if (!workstream) {
      return { created: 0, skipped: 0 };
    }

    const templateTitles = getPublicationTemplateTitles(workstream);
    let result: GenerateDeliverablesResult = { created: 0, skipped: 0 };

    setItems((current) => {
      const additions: ActionItem[] = [];
      const issueDueDate = getIssueDueDate(issue) ?? "";

      for (const title of templateTitles) {
        const exists = current.some(
          (item) => item.issue === issue && item.workstream === workstream && item.title === title
        );

        if (exists) {
          result = { ...result, skipped: result.skipped + 1 };
          continue;
        }

        additions.push(
          createActionItem({
            type: "Deliverable",
            title,
            workstream,
            issue,
            dueDate: issueDueDate,
            status: "Not Started",
            owner: DEFAULT_OWNER,
            waitingOn: "",
            notes: ""
          })
        );
      }

      result = { ...result, created: additions.length };
      return additions.length > 0 ? [...additions, ...current] : current;
    });

    return result;
  }

  function generateMissingDeliverablesForIssue(issue: string): GenerateDeliverablesResult {
    return generateIssueDeliverables(issue);
  }

  function openIssue(issue: string): GenerateDeliverablesResult {
    setIssueStatuses((current) => ({
      ...current,
      [issue]: "Open"
    }));

    return generateIssueDeliverables(issue);
  }

  function setIssueStatus(issue: string, status: IssueStatus) {
    setIssueStatuses((current) => ({
      ...current,
      [issue]: status
    }));
  }

  function completeIssue(issue: string) {
    setIssueStatuses((current) => ({
      ...current,
      [issue]: "Complete"
    }));
  }

  const value = {
    items,
    issues: getGeneratedIssues(issueStatuses),
    addItem,
    deleteItem,
    completeIssue,
    generateMissingDeliverablesForIssue,
    generateIssueDeliverables,
    openIssue,
    setIssueStatus,
    updateItem: (id: string, updates: Partial<ActionItem>) => {
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                ...updates,
                lastUpdated: updates.lastUpdated ?? new Date().toISOString().slice(0, 10)
              }
            : item
        )
      );
    }
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);

  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }

  return context;
}

function createActionItem(item: NewActionItem): ActionItem {
  const slug = item.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const timestamp = Date.now().toString(36);

  return {
    ...item,
    id: `${slug || "item"}-${timestamp}`,
    lastUpdated: new Date().toISOString().slice(0, 10)
  };
}
