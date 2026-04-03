"use client";

import type { ActionItem } from "@/lib/sample-data";
import {
  getActionDrawerPrimaryBadgeClassName,
  getActionDrawerPrimaryBadgeLabel,
  getActionDrawerSecondaryMeta
} from "@/lib/action/action-drawer-presentation";
import { formatShortDate, isItemMissingDueDate } from "@/lib/ops-utils";

type ActionItemDrawerHeaderProps = {
  item: ActionItem;
  eventInstanceName?: string | null;
  subEventName?: string | null;
  isEditingTitle: boolean;
  titleDraft: string;
  isActionsMenuOpen: boolean;
  onStartTitleEdit: () => void;
  onTitleDraftChange: (value: string) => void;
  onFinishTitleEdit: () => void;
  onCancelTitleEdit: () => void;
  onToggleActionsMenu: () => void;
  onArchiveRequest: () => void;
  onDeleteRequest: () => void;
  onClose: () => void;
};

export function ActionItemDrawerHeader({
  item,
  eventInstanceName,
  subEventName,
  isEditingTitle,
  titleDraft,
  isActionsMenuOpen,
  onStartTitleEdit,
  onTitleDraftChange,
  onFinishTitleEdit,
  onCancelTitleEdit,
  onToggleActionsMenu,
  onArchiveRequest,
  onDeleteRequest,
  onClose
}: ActionItemDrawerHeaderProps) {
  return (
    <div className="drawer__sticky">
      <div className="drawer__header">
        <div className="drawer__header-text">
          <div className="action-drawer__eyebrow">Action item</div>
          {isEditingTitle ? (
            <input
              aria-label="Edit title"
              autoFocus
              className="drawer__title-input action-drawer__title-input"
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
            <h2 className="drawer__title action-drawer__title">
              <button className="drawer__title-button" onClick={onStartTitleEdit} type="button">
                {item.title}
              </button>
            </h2>
          )}
          <div className="drawer__workstream">{item.workstream}</div>
          <div className="drawer__header-meta">
            <span className={getActionDrawerPrimaryBadgeClassName(item)}>
              {getActionDrawerPrimaryBadgeLabel(item)}
            </span>
            {getActionDrawerSecondaryMeta(item) ? (
              <span className="drawer__due-text">{getActionDrawerSecondaryMeta(item)}</span>
            ) : null}
          </div>
          <div className="action-drawer__meta-row">
            <span className="action-drawer__meta-pill">Owner: {item.owner || "Unassigned"}</span>
            <span className="action-drawer__meta-pill">Type: {item.type}</span>
            {item.issue ? <span className="action-drawer__meta-pill">Issue: {item.issue}</span> : null}
          </div>
          {eventInstanceName || subEventName || item.operationalBucket || (item.status === "Waiting" && item.waitingOn.trim()) ? (
            <div className="action-drawer__context-row">
              {eventInstanceName ? (
                <span className="action-drawer__context-pill">Event: {eventInstanceName}</span>
              ) : null}
              {subEventName ? (
                <span className="action-drawer__context-pill">Sub-Event: {subEventName}</span>
              ) : null}
              {item.operationalBucket ? (
                <span className="action-drawer__context-pill">Operational: {item.operationalBucket}</span>
              ) : null}
              {item.status === "Waiting" && item.waitingOn.trim() ? (
                <span className="action-drawer__context-pill">Waiting On: {item.waitingOn.trim()}</span>
              ) : null}
            </div>
          ) : null}
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
                  className="drawer__actions-item"
                  onClick={onArchiveRequest}
                  role="menuitem"
                  type="button"
                >
                  {item.archivedAt ? "Restore to active lane" : "Archive"}
                </button>
                <button
                  className="drawer__actions-item drawer__actions-item--danger"
                  onClick={onDeleteRequest}
                  role="menuitem"
                  type="button"
                >
                  Delete permanently
                </button>
              </div>
            ) : null}
          </div>
          <button className="button-link" onClick={onClose} type="button">
            Close
          </button>
        </div>
      </div>
      {item.blockedBy?.trim() ? (
        <div className="drawer__warning drawer__warning--blocked">Blocked by {item.blockedBy.trim()}</div>
      ) : null}
      {item.archivedAt ? (
        <div className="drawer__warning drawer__warning--archived">
          Archived from active views on {formatShortDate(item.archivedAt)}.
        </div>
      ) : null}
      {isItemMissingDueDate(item) ? (
        <div className="drawer__warning">Due date not configured for this issue</div>
      ) : null}
    </div>
  );
}
