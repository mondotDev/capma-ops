"use client";

import type { ActionItem } from "@/lib/sample-data";
import {
  formatDueLabel,
  formatShortDate,
  isBlockedItem,
  isItemMissingDueDate,
  isTerminalStatus,
  isWaitingIssue
} from "@/lib/ops-utils";

type ActionItemDrawerHeaderProps = {
  item: ActionItem;
  isEditingTitle: boolean;
  titleDraft: string;
  isActionsMenuOpen: boolean;
  onStartTitleEdit: () => void;
  onTitleDraftChange: (value: string) => void;
  onFinishTitleEdit: () => void;
  onCancelTitleEdit: () => void;
  onToggleActionsMenu: () => void;
  onDeleteRequest: () => void;
  onClose: () => void;
};

export function ActionItemDrawerHeader({
  item,
  isEditingTitle,
  titleDraft,
  isActionsMenuOpen,
  onStartTitleEdit,
  onTitleDraftChange,
  onFinishTitleEdit,
  onCancelTitleEdit,
  onToggleActionsMenu,
  onDeleteRequest,
  onClose
}: ActionItemDrawerHeaderProps) {
  return (
    <div className="drawer__sticky">
      <div className="drawer__header">
        <div className="drawer__header-text">
          {isEditingTitle ? (
            <input
              aria-label="Edit title"
              autoFocus
              className="drawer__title-input"
              id="drawer-title"
              onBlur={onFinishTitleEdit}
              onChange={(event) => onTitleDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  onCancelTitleEdit();
                }

                if (event.key === "Enter") {
                  event.preventDefault();
                  onFinishTitleEdit();
                }
              }}
              value={titleDraft}
            />
          ) : (
            <h2 className="drawer__title">
              <button className="drawer__title-button" onClick={onStartTitleEdit} type="button">
                {item.title}
              </button>
            </h2>
          )}
          <div className="drawer__workstream">{item.workstream}</div>
          <div className="drawer__header-meta">
            <span className={getDrawerPrimaryBadgeClassName(item)}>{getDrawerPrimaryBadgeLabel(item)}</span>
            {getDrawerSecondaryMeta(item) ? (
              <span className="drawer__due-text">{getDrawerSecondaryMeta(item)}</span>
            ) : null}
          </div>
        </div>
        <div className="drawer__header-actions">
          <div className="drawer__actions-menu">
            <button
              aria-expanded={isActionsMenuOpen}
              aria-haspopup="menu"
              className="drawer__actions-trigger"
              onClick={onToggleActionsMenu}
              type="button"
            >
              <span aria-hidden="true">⚙</span>
              <span className="sr-only">Open item actions</span>
            </button>
            {isActionsMenuOpen ? (
              <div className="drawer__actions-popover" role="menu">
                <button
                  className="drawer__actions-item drawer__actions-item--danger"
                  onClick={onDeleteRequest}
                  role="menuitem"
                  type="button"
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
          <button className="button-link" onClick={onClose} type="button">
            Close
          </button>
        </div>
      </div>

      {item.issue ? <div className="drawer__issue">{item.issue}</div> : null}
      {item.blockedBy?.trim() ? (
        <div className="drawer__warning drawer__warning--blocked">Blocked by {item.blockedBy.trim()}</div>
      ) : null}
      {isItemMissingDueDate(item) ? (
        <div className="drawer__warning">Due date not configured for this issue</div>
      ) : null}
    </div>
  );
}

function formatDrawerDueText(item: ActionItem) {
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

  return `${dueLabel} • ${formatShortDate(item.dueDate)}`;
}

function getDrawerPrimaryBadgeLabel(item: ActionItem) {
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

function getDrawerPrimaryBadgeClassName(item: ActionItem) {
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

function getDrawerSecondaryMeta(item: ActionItem) {
  const parts: string[] = [];
  const dueText = formatDrawerDueText(item);

  if (dueText && dueText !== getDrawerPrimaryBadgeLabel(item)) {
    parts.push(dueText);
  }

  if (item.status === "Waiting" && item.waitingOn.trim()) {
    parts.push(`Waiting on ${item.waitingOn.trim()}`);
  }

  return parts.join(" • ");
}
