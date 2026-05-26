"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useAmcLocalState } from "@/components/amc-local-state-provider";
import {
  createActionItem,
  DEMO_FOUNDATION_DATA,
  getAssigneeName,
  getBucketName,
  getBucketDropdownOptions,
  getBucketOptionLabel,
  getClientAssociationName,
  getFoundationWorkItems,
  getVisibleWorkItems,
  WORK_STATUS_LABELS,
  WORK_TRACKER_LABELS,
  validateActionItemCreateInput,
  type ActionItemCreateInput,
  type WorkStatus,
  type WorkTrackerKind
} from "@/lib/amc-domain";

const INITIAL_FORM_STATE: ActionItemCreateInput = {
  title: "",
  clientAssociationId: DEMO_FOUNDATION_DATA.clients[0]?.id ?? "",
  bucketId: DEMO_FOUNDATION_DATA.buckets[0]?.id ?? "",
  assigneeId: "",
  dueDate: ""
};

export function AmcWorkQueue() {
  const { isHydrated, state, addActionItem, resetLocalState } = useAmcLocalState();
  const data = state;
  const [formState, setFormState] = useState<ActionItemCreateInput>(INITIAL_FORM_STATE);
  const [filters, setFilters] = useState<{
    assigneeId: string;
    bucketId: string;
    clientAssociationId: string;
    status: string;
    tracker: string;
    unassignedOnly: boolean;
  }>({
    assigneeId: "",
    bucketId: "",
    clientAssociationId: "",
    status: "",
    tracker: "",
    unassignedOnly: false
  });
  const [feedback, setFeedback] = useState("");
  const dropdownBuckets = getBucketDropdownOptions({ buckets: data.buckets });
  const bucketsForClient = dropdownBuckets.filter((bucket) => bucket.clientAssociationId === formState.clientAssociationId);
  const filterBuckets = filters.clientAssociationId
    ? dropdownBuckets.filter((bucket) => bucket.clientAssociationId === filters.clientAssociationId)
    : dropdownBuckets;
  const workItems = useMemo(
    () =>
      getFoundationWorkItems({
        actionItems: data.actionItems,
        collateralItems: data.collateralItems,
        sponsorFulfillmentRecords: data.sponsorFulfillmentRecords
      }),
    [data.actionItems, data.collateralItems, data.sponsorFulfillmentRecords]
  );
  const visibleItems = getVisibleWorkItems(workItems, {
    viewer: data.currentUser,
    assigneeId: filters.unassignedOnly ? undefined : filters.assigneeId || undefined,
    bucketId: filters.bucketId || undefined,
    clientAssociationId: filters.clientAssociationId || undefined,
    status: (filters.status || undefined) as WorkStatus | undefined,
    tracker: (filters.tracker || undefined) as WorkTrackerKind | undefined,
    unassignedOnly: filters.unassignedOnly
  });
  const validation = validateActionItemCreateInput(formState, data);

  function updateField<Key extends keyof ActionItemCreateInput>(field: Key, value: ActionItemCreateInput[Key]) {
    setFeedback("");
    setFormState((current) => {
      if (field === "clientAssociationId") {
        const nextClientId = String(value);
        const nextBucketId = dropdownBuckets.find((bucket) => bucket.clientAssociationId === nextClientId)?.id ?? "";

        return {
          ...current,
          clientAssociationId: nextClientId,
          bucketId: nextBucketId
        };
      }

      return {
        ...current,
        [field]: value
      };
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validation.isValid) {
      setFeedback(validation.errors[0] ?? "Check the required fields.");
      return;
    }

    const created = createActionItem(formState, data);
    addActionItem(created);
    setFormState({
      ...INITIAL_FORM_STATE,
      clientAssociationId: formState.clientAssociationId,
      bucketId: formState.bucketId,
      assigneeId: formState.assigneeId
    });
    setFeedback("Action item added.");
  }

  return (
    <div className="amc-dashboard">
      <section className="amc-page-header">
        <div>
          <p className="amc-kicker">Assigned Work</p>
          <h1>One readable work queue</h1>
          <p>
            Action items are quick to create but always routed to a client and bucket. Collateral,
            education, speaker, and sponsor records can still feed this queue without losing their
            own tracker fields.
          </p>
        </div>
        <button className="button-link button-link--inline-secondary" onClick={resetLocalState} type="button">
          Reset Local Demo
        </button>
      </section>

      {!isHydrated ? <div className="amc-form-feedback">Loading local workspace...</div> : null}

      <section className="amc-panel">
        <div className="amc-panel__header">
          <h2>Filters</h2>
          <span>{visibleItems.length} visible</span>
        </div>
        <div className="amc-filter-grid">
          <label>
            <span>Client</span>
            <select
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  bucketId: "",
                  clientAssociationId: event.target.value
                }))
              }
              value={filters.clientAssociationId}
            >
              <option value="">All clients</option>
              {data.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.shortName}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Bucket</span>
            <select onChange={(event) => setFilters((current) => ({ ...current, bucketId: event.target.value }))} value={filters.bucketId}>
              <option value="">All buckets</option>
              {filterBuckets.map((bucket) => (
                <option key={bucket.id} value={bucket.id}>
                  {getBucketOptionLabel({ bucket, clients: data.clients, programSeries: data.programSeries, includeKind: true })}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Assignee</span>
            <select
              disabled={filters.unassignedOnly}
              onChange={(event) => setFilters((current) => ({ ...current, assigneeId: event.target.value }))}
              value={filters.assigneeId}
            >
              <option value="">All assignees</option>
              {data.staff.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.displayName}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Tracker</span>
            <select onChange={(event) => setFilters((current) => ({ ...current, tracker: event.target.value }))} value={filters.tracker}>
              <option value="">All trackers</option>
              <option value="action">{WORK_TRACKER_LABELS.action}</option>
              <option value="collateral">{WORK_TRACKER_LABELS.collateral}</option>
              <option value="education">{WORK_TRACKER_LABELS.education}</option>
              <option value="speaker">{WORK_TRACKER_LABELS.speaker}</option>
              <option value="sponsorFulfillment">{WORK_TRACKER_LABELS.sponsorFulfillment}</option>
            </select>
          </label>

          <label>
            <span>Status</span>
            <select onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} value={filters.status}>
              <option value="">All statuses</option>
              <option value="notStarted">{WORK_STATUS_LABELS.notStarted}</option>
              <option value="inProgress">{WORK_STATUS_LABELS.inProgress}</option>
              <option value="waiting">{WORK_STATUS_LABELS.waiting}</option>
              <option value="blocked">{WORK_STATUS_LABELS.blocked}</option>
              <option value="complete">{WORK_STATUS_LABELS.complete}</option>
            </select>
          </label>

          <label className="amc-checkbox-field">
            <input
              checked={filters.unassignedOnly}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  assigneeId: event.target.checked ? "" : current.assigneeId,
                  unassignedOnly: event.target.checked
                }))
              }
              type="checkbox"
            />
            <span>Unassigned only</span>
          </label>
        </div>
      </section>

      <section className="amc-panel">
        <div className="amc-panel__header">
          <h2>Add Action Item</h2>
          <span>Client + bucket required</span>
        </div>
        <form className="amc-quick-add" onSubmit={handleSubmit}>
          <label>
            <span>Client</span>
            <select
              onChange={(event) => updateField("clientAssociationId", event.target.value)}
              value={formState.clientAssociationId}
            >
              {data.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.shortName}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Bucket</span>
            <select onChange={(event) => updateField("bucketId", event.target.value)} value={formState.bucketId}>
              {bucketsForClient.map((bucket) => (
                <option key={bucket.id} value={bucket.id}>
                  {getBucketOptionLabel({ bucket, clients: data.clients, programSeries: data.programSeries, includeKind: true })}
                </option>
              ))}
            </select>
          </label>

          <label className="amc-quick-add__title">
            <span>Task</span>
            <input
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="Add a task"
              type="text"
              value={formState.title}
            />
          </label>

          <label>
            <span>Assignee</span>
            <select onChange={(event) => updateField("assigneeId", event.target.value)} value={formState.assigneeId ?? ""}>
              <option value="">Unassigned</option>
              {data.staff.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.displayName}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Due Date</span>
            <input onChange={(event) => updateField("dueDate", event.target.value)} type="date" value={formState.dueDate} />
          </label>

          <button className="topbar__button" type="submit">
            Add
          </button>
        </form>
        {feedback ? <div className="amc-form-feedback">{feedback}</div> : null}
      </section>

      <section className="amc-panel">
        <div className="amc-list">
          {visibleItems.map((item) => (
            <article className="amc-list-row amc-list-row--work" key={`${item.tracker}-${item.id}`}>
              <div>
                <strong>{item.title}</strong>
                <span>
                  {getClientAssociationName(data.clients, item.clientAssociationId)} /{" "}
                  {getBucketName(data.buckets, item.bucketId)}
                </span>
              </div>
              <div className="amc-list-row__meta">
                <span>{WORK_STATUS_LABELS[item.status]}</span>
                <span>{WORK_TRACKER_LABELS[item.tracker]}</span>
                <span>{getAssigneeName(data.staff, item.assigneeId)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
