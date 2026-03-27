"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAppState } from "@/components/app-state";
import type { ActionItem } from "@/lib/sample-data";

const STATUS_OPTIONS = ["Not Started", "In Progress", "Waiting", "Complete"];
const TODAY = new Date("2026-03-27T00:00:00");

function isOverdue(dueDate: string) {
  return new Date(`${dueDate}T00:00:00`).getTime() < TODAY.getTime();
}

function sortByPriority(a: ActionItem, b: ActionItem) {
  const aOverdue = isOverdue(a.dueDate);
  const bOverdue = isOverdue(b.dueDate);

  if (aOverdue !== bOverdue) {
    return aOverdue ? -1 : 1;
  }

  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
}

export function ActionView({ initialFilter }: { initialFilter?: string }) {
  const { items, updateItem } = useAppState();
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);

  const visibleItems = useMemo(() => {
    if (initialFilter === "waiting") {
      return items.filter((item) => Boolean(item.waitingOn));
    }

    return items;
  }, [initialFilter, items]);

  const sortedItems = useMemo(() => [...visibleItems].sort(sortByPriority), [visibleItems]);
  const selectedItem = sortedItems.find((item) => item.id === selectedId) ?? null;

  return (
    <section>
      {initialFilter === "waiting" ? (
        <p className="muted">
          Filtered to items with a waiting owner. <Link href="/action">Clear filter</Link>
        </p>
      ) : null}
      <div className={selectedItem ? "table-wrap drawer-open" : "table-wrap"}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Workstream</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Waiting On</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => (
                <tr
                  className={isOverdue(item.dueDate) ? "overdue-row" : undefined}
                  data-clickable="true"
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                >
                  <td>{item.title}</td>
                  <td>{item.type}</td>
                  <td>{item.workstream}</td>
                  <td>{item.dueDate}</td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <select
                      aria-label={`Status for ${item.title}`}
                      className="cell-select"
                      onChange={(event) => updateItem(item.id, { status: event.target.value })}
                      value={item.status}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <input
                      aria-label={`Owner for ${item.title}`}
                      className="cell-input"
                      onChange={(event) => updateItem(item.id, { owner: event.target.value })}
                      value={item.owner}
                    />
                  </td>
                  <td onClick={(event) => event.stopPropagation()}>
                    <input
                      aria-label={`Waiting on for ${item.title}`}
                      className="cell-input"
                      onChange={(event) => updateItem(item.id, { waitingOn: event.target.value })}
                      value={item.waitingOn}
                    />
                  </td>
                  <td>{item.lastUpdated}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {sortedItems.length === 0 ? <div className="empty-state">No items match this view.</div> : null}
        </div>

        {selectedItem ? (
          <aside className="drawer">
            <div className="drawer__header">
              <h2 className="drawer__title">{selectedItem.title}</h2>
              <button className="button-link" onClick={() => setSelectedId(null)} type="button">
                Close
              </button>
            </div>
            <div className="drawer__grid">
              <div className="field">
                <label htmlFor="drawer-title">Title</label>
                <input
                  id="drawer-title"
                  onChange={(event) => updateItem(selectedItem.id, { title: event.target.value })}
                  value={selectedItem.title}
                />
              </div>
              <div className="field">
                <label htmlFor="drawer-type">Type</label>
                <input
                  id="drawer-type"
                  onChange={(event) => updateItem(selectedItem.id, { type: event.target.value })}
                  value={selectedItem.type}
                />
              </div>
              <div className="field">
                <label htmlFor="drawer-workstream">Workstream</label>
                <input
                  id="drawer-workstream"
                  onChange={(event) =>
                    updateItem(selectedItem.id, { workstream: event.target.value })
                  }
                  value={selectedItem.workstream}
                />
              </div>
              <div className="field">
                <label htmlFor="drawer-due-date">Due Date</label>
                <input
                  id="drawer-due-date"
                  onChange={(event) => updateItem(selectedItem.id, { dueDate: event.target.value })}
                  type="date"
                  value={selectedItem.dueDate}
                />
              </div>
              <div className="field">
                <label htmlFor="drawer-status">Status</label>
                <select
                  id="drawer-status"
                  onChange={(event) => updateItem(selectedItem.id, { status: event.target.value })}
                  value={selectedItem.status}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="drawer-owner">Owner</label>
                <input
                  id="drawer-owner"
                  onChange={(event) => updateItem(selectedItem.id, { owner: event.target.value })}
                  value={selectedItem.owner}
                />
              </div>
              <div className="field">
                <label htmlFor="drawer-waiting-on">Waiting On</label>
                <input
                  id="drawer-waiting-on"
                  onChange={(event) => updateItem(selectedItem.id, { waitingOn: event.target.value })}
                  value={selectedItem.waitingOn}
                />
              </div>
              <div className="field">
                <label htmlFor="drawer-last-updated">Last Updated</label>
                <input
                  id="drawer-last-updated"
                  onChange={(event) =>
                    updateItem(selectedItem.id, { lastUpdated: event.target.value })
                  }
                  type="date"
                  value={selectedItem.lastUpdated}
                />
              </div>
              <div className="field">
                <label htmlFor="drawer-notes">Notes</label>
                <textarea
                  id="drawer-notes"
                  onChange={(event) => updateItem(selectedItem.id, { notes: event.target.value })}
                  rows={6}
                  value={selectedItem.notes}
                />
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
