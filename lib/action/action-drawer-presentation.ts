import type { ActionItem } from "@/lib/sample-data";
import {
  formatDueLabel,
  formatShortDate,
  isBlockedItem,
  isWaitingIssue,
  isTerminalStatus
} from "@/lib/ops-utils";

export function formatActionUrgencyBadge(item: ActionItem) {
  if (isWaitingIssue(item)) {
    return "Waiting";
  }

  const dueLabel = formatDueLabel(item);
  return dueLabel || `Due ${formatShortDate(item.dueDate)}`;
}

export function formatActionDrawerDueText(item: ActionItem) {
  const dueLabel = formatDueLabel(item);

  if (!item.dueDate) {
    return dueLabel || "No due date set";
  }

  if (!dueLabel || dueLabel === `Due ${formatShortDate(item.dueDate)}`) {
    return `Due ${formatShortDate(item.dueDate)}`;
  }

  if (dueLabel === "No due date set") {
    return dueLabel;
  }

  return `${formatShortDate(item.dueDate)} · ${dueLabel}`;
}

export function getActionDrawerPrimaryBadgeLabel(item: ActionItem) {
  if (isBlockedItem(item)) {
    return "Blocked";
  }

  if (formatDueLabel(item) === "Overdue") {
    return "Overdue";
  }

  if (isWaitingIssue(item)) {
    return "Waiting";
  }

  if (isTerminalStatus(item.status)) {
    return item.status;
  }

  return item.status === "In Progress" ? "Active" : "Normal";
}

export function getActionDrawerPrimaryBadgeClassName(item: ActionItem) {
  if (isBlockedItem(item)) {
    return "drawer__status-chip drawer__status-chip--blocked";
  }

  if (formatDueLabel(item) === "Overdue") {
    return "drawer__status-chip drawer__status-chip--overdue";
  }

  if (isWaitingIssue(item)) {
    return "drawer__status-chip drawer__status-chip--waiting";
  }

  return "drawer__status-chip";
}

export function getActionDrawerSecondaryMeta(item: ActionItem) {
  const parts: string[] = [];
  const dueText = formatActionDrawerDueText(item);

  if (dueText && dueText !== getActionDrawerPrimaryBadgeLabel(item)) {
    parts.push(dueText);
  }

  if (item.status === "Waiting" && item.waitingOn.trim()) {
    parts.push(`Waiting on ${item.waitingOn.trim()}`);
  }

  return parts.join(" • ");
}

export function getActionUrgencyBadgeClassName(item: ActionItem) {
  if (isWaitingIssue(item)) {
    return "urgency-badge urgency-badge--waiting";
  }

  if (formatDueLabel(item) === "Overdue") {
    return "urgency-badge urgency-badge--overdue";
  }

  return "urgency-badge urgency-badge--due-soon";
}
