"use client";

import { useMemo, useState } from "react";
import { useAppState } from "@/components/app-state";
import {
  COLLATERAL_STATUS_OPTIONS,
  LEG_DAY_SUB_EVENT_OPTIONS,
  isCollateralDueSoon,
  isCollateralOverdue,
  isCollateralTerminalStatus,
  normalizeCollateralWorkflowStatus,
  type CollateralItem
} from "@/lib/collateral-data";
import { formatShortDate } from "@/lib/ops-utils";

export function CollateralView() {
  const {
    addCollateralItem,
    collateralItems,
    collateralProfile,
    deleteCollateralItem,
    setCollateralProfile,
    updateCollateralItem
  } = useAppState();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeItems = useMemo(
    () => collateralItems.filter((item) => !isCollateralTerminalStatus(item.status)),
    [collateralItems]
  );
  const groupedItems = useMemo(() => groupCollateralItems(collateralItems), [collateralItems]);
  const selectedItem = collateralItems.find((item) => item.id === selectedId) ?? null;
  const summary = useMemo(
    () => ({
      active: activeItems.length,
      overdue: activeItems.filter((item) => isCollateralOverdue(item)).length,
      dueSoon: activeItems.filter((item) => isCollateralDueSoon(item)).length,
      ready: activeItems.filter((item) => normalizeCollateralWorkflowStatus(item.status) === "ready").length
    }),
    [activeItems]
  );

  function handleAddCollateralItem() {
    const nextId = addCollateralItem({
      subEvent: LEG_DAY_SUB_EVENT_OPTIONS[0] ?? "Legislative Visits",
      itemName: "New collateral item",
      status: "Backlog",
      printer: "",
      printerDeadline: "",
      quantity: "",
      updateType: "",
      notes: ""
    });

    setSelectedId(nextId);
  }

  return (
    <section className="collateral-page">
      <div className="collateral-page__header">
        <div>
          <h1 className="collateral-page__title">Legislative Day Collateral</h1>
          <p className="collateral-page__subtitle">Production tracking for signage, print pieces, decks, and event materials.</p>
        </div>
        <button className="topbar__button" onClick={handleAddCollateralItem} type="button">
          + Add Collateral
        </button>
      </div>

      <div className="collateral-summary">
        <div className="collateral-metric">
          <span className="collateral-metric__label">Active</span>
          <strong className="collateral-metric__value">{summary.active}</strong>
        </div>
        <div className="collateral-metric collateral-metric--overdue">
          <span className="collateral-metric__label">Overdue</span>
          <strong className="collateral-metric__value">{summary.overdue}</strong>
        </div>
        <div className="collateral-metric collateral-metric--due-soon">
          <span className="collateral-metric__label">Due Soon</span>
          <strong className="collateral-metric__value">{summary.dueSoon}</strong>
        </div>
        <div className="collateral-metric collateral-metric--ready">
          <span className="collateral-metric__label">Ready for Print</span>
          <strong className="collateral-metric__value">{summary.ready}</strong>
        </div>
      </div>

      <div className="collateral-layout">
        <div className="collateral-main">
          <div className="card card--secondary collateral-profile">
            <div className="card__title">LEG DAY PROFILE</div>
            <div className="collateral-profile__grid">
              <div className="field">
                <label htmlFor="collateral-event-start">Event Start</label>
                <input
                  className="field-control"
                  id="collateral-event-start"
                  onChange={(event) =>
                    setCollateralProfile({ ...collateralProfile, eventStartDate: event.target.value })
                  }
                  type="date"
                  value={collateralProfile.eventStartDate}
                />
              </div>
              <div className="field">
                <label htmlFor="collateral-event-end">Event End</label>
                <input
                  className="field-control"
                  id="collateral-event-end"
                  onChange={(event) =>
                    setCollateralProfile({ ...collateralProfile, eventEndDate: event.target.value })
                  }
                  type="date"
                  value={collateralProfile.eventEndDate}
                />
              </div>
              <div className="field">
                <label htmlFor="collateral-room-block">Room Block Deadline</label>
                <input
                  className="field-control"
                  id="collateral-room-block"
                  onChange={(event) =>
                    setCollateralProfile({ ...collateralProfile, roomBlockDeadline: event.target.value })
                  }
                  type="date"
                  value={collateralProfile.roomBlockDeadline}
                />
              </div>
              <div className="field">
                <label htmlFor="collateral-logo-deadline">Logo Deadline</label>
                <input
                  className="field-control"
                  id="collateral-logo-deadline"
                  onChange={(event) =>
                    setCollateralProfile({ ...collateralProfile, logoDeadline: event.target.value })
                  }
                  type="date"
                  value={collateralProfile.logoDeadline}
                />
              </div>
              <div className="field">
                <label htmlFor="collateral-external-printing">External Printing Due</label>
                <input
                  className="field-control"
                  id="collateral-external-printing"
                  onChange={(event) =>
                    setCollateralProfile({ ...collateralProfile, externalPrintingDue: event.target.value })
                  }
                  type="date"
                  value={collateralProfile.externalPrintingDue}
                />
              </div>
              <div className="field">
                <label htmlFor="collateral-internal-printing">Start Internal Printing</label>
                <input
                  className="field-control"
                  id="collateral-internal-printing"
                  onChange={(event) =>
                    setCollateralProfile({ ...collateralProfile, internalPrintingStart: event.target.value })
                  }
                  type="date"
                  value={collateralProfile.internalPrintingStart}
                />
              </div>
            </div>
            <div className="collateral-profile__notes">
              <div className="field">
                <label htmlFor="collateral-room-block-note">Room Block Note</label>
                <textarea
                  className="field-control"
                  id="collateral-room-block-note"
                  onChange={(event) =>
                    setCollateralProfile({ ...collateralProfile, roomBlockNote: event.target.value })
                  }
                  rows={2}
                  value={collateralProfile.roomBlockNote}
                />
              </div>
              <div className="field">
                <label htmlFor="collateral-logo-note">Logo Deadline Note</label>
                <textarea
                  className="field-control"
                  id="collateral-logo-note"
                  onChange={(event) =>
                    setCollateralProfile({ ...collateralProfile, logoDeadlineNote: event.target.value })
                  }
                  rows={2}
                  value={collateralProfile.logoDeadlineNote}
                />
              </div>
            </div>
          </div>

          <div className="card card--secondary collateral-groups">
            <div className="card__title">COLLATERAL ITEMS</div>
            {groupedItems.map(([subEvent, items]) => (
              <section className="collateral-group" key={subEvent}>
                <div className="collateral-group__header">
                  <h2 className="collateral-group__title">{subEvent}</h2>
                  <span className="collateral-group__count">{items.length}</span>
                </div>
                <div className="collateral-list">
                  {items.map((item) => {
                    const isSelected = item.id === selectedId;
                    const isOverdue = isCollateralOverdue(item);
                    const isDueSoon = isCollateralDueSoon(item);

                    return (
                      <button
                        className={
                          isSelected
                            ? "collateral-row collateral-row--selected"
                            : isOverdue
                              ? "collateral-row collateral-row--overdue"
                              : isDueSoon
                                ? "collateral-row collateral-row--due-soon"
                                : "collateral-row"
                        }
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        type="button"
                      >
                        <div className="collateral-row__main">
                          <div className="collateral-row__title">{item.itemName}</div>
                          <div className="collateral-row__meta">
                            <span>{item.printer || "No printer assigned"}</span>
                            <span>{item.printerDeadline ? formatShortDate(item.printerDeadline) : "No printer deadline"}</span>
                            {item.quantity ? <span>Qty {item.quantity}</span> : null}
                          </div>
                        </div>
                        <div className="collateral-row__signals">
                          <span className="collateral-status">{item.status}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        {selectedItem ? (
          <aside className="drawer" aria-label="Collateral details">
            <div className="drawer__header">
              <div className="drawer__header-text">
                <h2 className="drawer__title">{selectedItem.itemName}</h2>
                <div className="drawer__header-meta">
                  <span className="drawer__workstream">{selectedItem.subEvent}</span>
                </div>
              </div>
              <div className="drawer__header-actions">
                <button
                  className="button-link button-link--inline-secondary"
                  onClick={() => {
                    deleteCollateralItem(selectedItem.id);
                    setSelectedId(null);
                  }}
                  type="button"
                >
                  Delete
                </button>
                <button className="button-link" onClick={() => setSelectedId(null)} type="button">
                  Close
                </button>
              </div>
            </div>

            <div className="drawer__sections">
              <section className="drawer-section drawer-section--form collateral-drawer">
                <div className="drawer__grid drawer__grid--form">
                  <div className="field field--priority">
                    <label htmlFor="collateral-item-name">Collateral Item</label>
                    <input
                      id="collateral-item-name"
                      onChange={(event) => updateCollateralItem(selectedItem.id, { itemName: event.target.value })}
                      value={selectedItem.itemName}
                    />
                  </div>
                  <div className="field field--secondary">
                    <label htmlFor="collateral-sub-event">Sub-Event</label>
                    <select
                      id="collateral-sub-event"
                      onChange={(event) => updateCollateralItem(selectedItem.id, { subEvent: event.target.value })}
                      value={selectedItem.subEvent}
                    >
                      {LEG_DAY_SUB_EVENT_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field field--priority">
                    <label htmlFor="collateral-status">Status</label>
                    <select
                      id="collateral-status"
                      onChange={(event) =>
                        updateCollateralItem(selectedItem.id, {
                          status: event.target.value as CollateralItem["status"]
                        })
                      }
                      value={selectedItem.status}
                    >
                      {COLLATERAL_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="collateral-printer">Printer</label>
                    <input
                      id="collateral-printer"
                      onChange={(event) => updateCollateralItem(selectedItem.id, { printer: event.target.value })}
                      value={selectedItem.printer}
                    />
                  </div>
                  <div className="field field--priority">
                    <label htmlFor="collateral-printer-deadline">Printer Deadline</label>
                    <input
                      id="collateral-printer-deadline"
                      onChange={(event) =>
                        updateCollateralItem(selectedItem.id, { printerDeadline: event.target.value })
                      }
                      type="date"
                      value={selectedItem.printerDeadline}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="collateral-quantity">Qty</label>
                    <input
                      id="collateral-quantity"
                      onChange={(event) => updateCollateralItem(selectedItem.id, { quantity: event.target.value })}
                      value={selectedItem.quantity}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="collateral-update-type">Update Type</label>
                    <input
                      id="collateral-update-type"
                      onChange={(event) => updateCollateralItem(selectedItem.id, { updateType: event.target.value })}
                      value={selectedItem.updateType}
                    />
                  </div>
                  <div className="field field--wide">
                    <label htmlFor="collateral-notes">Notes</label>
                    <textarea
                      id="collateral-notes"
                      onChange={(event) => updateCollateralItem(selectedItem.id, { notes: event.target.value })}
                      value={selectedItem.notes}
                    />
                  </div>
                </div>
              </section>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function groupCollateralItems(items: CollateralItem[]) {
  const grouped = new Map<string, CollateralItem[]>();

  for (const subEvent of LEG_DAY_SUB_EVENT_OPTIONS) {
    grouped.set(subEvent, []);
  }

  for (const item of items) {
    if (!grouped.has(item.subEvent)) {
      grouped.set(item.subEvent, []);
    }

    grouped.get(item.subEvent)!.push(item);
  }

  return Array.from(grouped.entries())
    .map(([subEvent, groupedItems]) => [
      subEvent,
      [...groupedItems].sort((a, b) => {
        const aHasDeadline = a.printerDeadline.length > 0;
        const bHasDeadline = b.printerDeadline.length > 0;

        if (aHasDeadline !== bHasDeadline) {
          return aHasDeadline ? -1 : 1;
        }

        if (aHasDeadline && bHasDeadline) {
          const dateCompare = a.printerDeadline.localeCompare(b.printerDeadline);

          if (dateCompare !== 0) {
            return dateCompare;
          }
        }

        return a.itemName.localeCompare(b.itemName);
      })
    ] as const)
    .filter(([, groupedItems]) => groupedItems.length > 0);
}
