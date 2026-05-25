"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { useAmcLocalState } from "@/components/amc-local-state-provider";
import {
  createActionItem,
  DEMO_FOUNDATION_DATA,
  getAssigneeName,
  getBucketName,
  getClientAssociationName,
  getFoundationWorkItems,
  getVisibleWorkItems,
  validateActionItemCreateInput,
  type ActionItemCreateInput
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
  const [feedback, setFeedback] = useState("");
  const bucketsForClient = data.buckets.filter((bucket) => bucket.clientAssociationId === formState.clientAssociationId);
  const workItems = useMemo(
    () =>
      getFoundationWorkItems({
        actionItems: data.actionItems,
        collateralItems: data.collateralItems
      }),
    [data.actionItems, data.collateralItems]
  );
  const visibleItems = getVisibleWorkItems(workItems, { viewer: data.currentUser });
  const validation = validateActionItemCreateInput(formState, data);

  function updateField<Key extends keyof ActionItemCreateInput>(field: Key, value: ActionItemCreateInput[Key]) {
    setFeedback("");
    setFormState((current) => {
      if (field === "clientAssociationId") {
        const nextClientId = String(value);
        const nextBucketId = data.buckets.find((bucket) => bucket.clientAssociationId === nextClientId)?.id ?? "";

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
                  {bucket.name}
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
                <span>{item.status}</span>
                <span>{item.tracker}</span>
                <span>{getAssigneeName(data.staff, item.assigneeId)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
