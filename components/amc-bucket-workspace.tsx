"use client";

import type { FormEvent } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useAmcLocalState } from "@/components/amc-local-state-provider";
import {
  COLLATERAL_STATUSES,
  COLLATERAL_TYPES,
  createCollateralActionItem,
  createCollateralItem,
  getAssigneeName,
  getBucketWorkspace,
  validateCollateralItemCreateInput,
  type CollateralActionItemCreateInput,
  type CollateralItem,
  type CollateralItemCreateInput,
  type CollateralItemUpdateInput
} from "@/lib/amc-domain";
import { useState } from "react";

export function AmcBucketWorkspace({ clientId, bucketId }: { clientId: string; bucketId: string }) {
  const { state, addCollateralActionItem, addCollateralItem, updateCollateralItem } = useAmcLocalState();
  const [collateralForm, setCollateralForm] = useState<CollateralItemCreateInput>({
    clientAssociationId: clientId,
    bucketId,
    title: "",
    collateralType: "email",
    channelOrUse: "",
    status: "notStarted",
    assigneeId: "",
    dueDate: "",
    audience: "",
    notes: ""
  });
  const [collateralFeedback, setCollateralFeedback] = useState("");
  const [actionDrafts, setActionDrafts] = useState<Record<string, { title: string; assigneeId: string; dueDate: string }>>({});
  const [editingCollateralId, setEditingCollateralId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, CollateralItemUpdateInput>>({});
  const workspace = getBucketWorkspace(state, { clientId, bucketId });

  function handleCollateralSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateCollateralItemCreateInput(collateralForm, state);

    if (!validation.isValid) {
      setCollateralFeedback(validation.errors[0] ?? "Check the required fields.");
      return;
    }

    const collateralItem = createCollateralItem(collateralForm, state);
    addCollateralItem(collateralItem);
    setCollateralForm((current) => ({
      ...current,
      title: "",
      channelOrUse: "",
      status: "notStarted",
      assigneeId: "",
      dueDate: "",
      audience: "",
      notes: ""
    }));
    setCollateralFeedback("Collateral added.");
  }

  function updateActionDraft(collateralItemId: string, updates: Partial<{ title: string; assigneeId: string; dueDate: string }>) {
    setActionDrafts((current) => ({
      ...current,
      [collateralItemId]: {
        title: current[collateralItemId]?.title ?? "",
        assigneeId: current[collateralItemId]?.assigneeId ?? "",
        dueDate: current[collateralItemId]?.dueDate ?? "",
        ...updates
      }
    }));
  }

  function startEditingCollateral(item: CollateralItem) {
    setEditingCollateralId(item.id);
    setEditDrafts((current) => ({
      ...current,
      [item.id]: {
        title: item.title,
        collateralType: item.collateralType,
        channelOrUse: item.channelOrUse,
        status: item.status,
        assigneeId: item.assigneeId,
        dueDate: item.dueDate,
        audience: item.audience,
        notes: item.notes
      }
    }));
    setCollateralFeedback("");
  }

  function updateEditDraft(collateralItemId: string, updates: CollateralItemUpdateInput) {
    setEditDrafts((current) => ({
      ...current,
      [collateralItemId]: {
        ...current[collateralItemId],
        ...updates
      }
    }));
  }

  function handleCollateralUpdate(collateralItemId: string) {
    const draft = editDrafts[collateralItemId];

    if (!draft?.title?.trim()) {
      setCollateralFeedback("Collateral title is required.");
      return;
    }

    try {
      updateCollateralItem(collateralItemId, draft);
      setEditingCollateralId(null);
      setCollateralFeedback("Collateral updated.");
    } catch (error) {
      setCollateralFeedback(error instanceof Error ? error.message : "Could not update collateral.");
    }
  }

  function handleCreateCollateralAction(collateralItemId: string) {
    const collateralItem = state.collateralItems.find((item) => item.id === collateralItemId);
    const draft = actionDrafts[collateralItemId];

    if (!collateralItem || !draft?.title.trim()) {
      setCollateralFeedback("Action title is required.");
      return;
    }

    const actionItem = createCollateralActionItem({
      collateralItem,
      title: draft.title,
      assigneeId: draft.assigneeId || collateralItem.assigneeId,
      dueDate: draft.dueDate,
      data: state
    });
    addCollateralActionItem({ collateralItemId, actionItem });
    setActionDrafts((current) => ({
      ...current,
      [collateralItemId]: { title: "", assigneeId: "", dueDate: "" }
    }));
    setCollateralFeedback("Related action item added.");
  }

  if (!workspace.client || !workspace.bucket) {
    return (
      <div className="amc-dashboard">
        <section className="amc-panel">
          <div className="amc-panel__header">
            <h1>Bucket not found</h1>
            <Link className="button-link button-link--inline-secondary" href="/clients">
              Back to Clients
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="amc-dashboard">
      <section className="amc-page-header">
        <div>
          <p className="amc-kicker">
            {workspace.client.shortName} / {workspace.client.name}
          </p>
          <h1>{workspace.bucket.name}</h1>
          <p>
            {workspace.bucket.kind} / {workspace.bucket.status}
          </p>
        </div>
        <Link className="button-link button-link--inline-secondary" href="/clients">
          Back to Clients
        </Link>
      </section>

      <section className="amc-metrics" aria-label="Bucket summary">
        <div className="amc-metric">
          <span>Work Items</span>
          <strong>{workspace.workItems.length}</strong>
        </div>
        <div className="amc-metric">
          <span>Action Items</span>
          <strong>{workspace.actionItems.length}</strong>
        </div>
        <div className="amc-metric">
          <span>Collateral</span>
          <strong>{workspace.collateralItems.length}</strong>
        </div>
      </section>

      <section className="amc-grid">
        <BucketSection title="Assigned Work" emptyCopy="No assigned or related work yet.">
          {workspace.workItems.map((item) => (
            <article className="amc-list-row amc-list-row--work" key={`${item.tracker}-${item.id}`}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.tracker} / {item.status}</span>
              </div>
              <div className="amc-list-row__meta">
                <span>{getAssigneeName(state.staff, item.assigneeId)}</span>
                <span>{item.dueDate || "No due date"}</span>
              </div>
            </article>
          ))}
        </BucketSection>

        <BucketSection title="Action Items" emptyCopy="No action items in this bucket yet.">
          {workspace.actionItems.map((item) => (
            <article className="amc-list-row amc-list-row--work" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.status}</span>
              </div>
              <div className="amc-list-row__meta">
                <span>{getAssigneeName(state.staff, item.assigneeId)}</span>
                <span>{item.dueDate || "No due date"}</span>
              </div>
            </article>
          ))}
        </BucketSection>
      </section>

      <section className="amc-grid">
        <section className="amc-panel">
          <div className="amc-panel__header">
            <h2>Collateral</h2>
            <span>{workspace.collateralItems.length} records</span>
          </div>
          <form className="amc-form-stack" onSubmit={handleCollateralSubmit}>
            <label>
              <span>Title</span>
              <input
                onChange={(event) => setCollateralForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Collateral title"
                type="text"
                value={collateralForm.title}
              />
            </label>
            <div className="amc-inline-form-grid">
              <label>
                <span>Type</span>
                <select
                  onChange={(event) =>
                    setCollateralForm((current) => ({
                      ...current,
                      collateralType: event.target.value as CollateralItemCreateInput["collateralType"]
                    }))
                  }
                  value={collateralForm.collateralType}
                >
                  {COLLATERAL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select
                  onChange={(event) =>
                    setCollateralForm((current) => ({
                      ...current,
                      status: event.target.value as CollateralItemCreateInput["status"]
                    }))
                  }
                  value={collateralForm.status}
                >
                  {COLLATERAL_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="amc-inline-form-grid">
              <label>
                <span>Assignee</span>
                <select
                  onChange={(event) => setCollateralForm((current) => ({ ...current, assigneeId: event.target.value }))}
                  value={collateralForm.assigneeId ?? ""}
                >
                  <option value="">Unassigned</option>
                  {state.staff.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Due Date</span>
                <input
                  onChange={(event) => setCollateralForm((current) => ({ ...current, dueDate: event.target.value }))}
                  type="date"
                  value={collateralForm.dueDate}
                />
              </label>
            </div>
            <label>
              <span>Channel or Use</span>
              <input
                onChange={(event) => setCollateralForm((current) => ({ ...current, channelOrUse: event.target.value }))}
                placeholder="Email, on-site signage, sponsor recognition"
                type="text"
                value={collateralForm.channelOrUse}
              />
            </label>
            <label>
              <span>Audience</span>
              <input
                onChange={(event) => setCollateralForm((current) => ({ ...current, audience: event.target.value }))}
                placeholder="Members, sponsors, attendees"
                type="text"
                value={collateralForm.audience}
              />
            </label>
            <label>
              <span>Notes</span>
              <textarea
                onChange={(event) => setCollateralForm((current) => ({ ...current, notes: event.target.value }))}
                value={collateralForm.notes}
              />
            </label>
            <button className="topbar__button" type="submit">
              Add Collateral
            </button>
          </form>
          {collateralFeedback ? <div className="amc-form-feedback">{collateralFeedback}</div> : null}
          <div className="amc-list">
          {workspace.collateralItems.length === 0 ? <div className="empty-state">No collateral records in this bucket yet.</div> : null}
          {workspace.collateralItems.map((item) => (
            <article className="amc-list-row amc-list-row--work" key={item.id}>
              {editingCollateralId === item.id ? (
                <div className="amc-collateral-edit-form">
                  <label>
                    <span>Title</span>
                    <input
                      onChange={(event) => updateEditDraft(item.id, { title: event.target.value })}
                      type="text"
                      value={editDrafts[item.id]?.title ?? item.title}
                    />
                  </label>
                  <div className="amc-inline-form-grid">
                    <label>
                      <span>Type</span>
                      <select
                        onChange={(event) =>
                          updateEditDraft(item.id, {
                            collateralType: event.target.value as CollateralItemUpdateInput["collateralType"]
                          })
                        }
                        value={editDrafts[item.id]?.collateralType ?? item.collateralType}
                      >
                        {COLLATERAL_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Status</span>
                      <select
                        onChange={(event) =>
                          updateEditDraft(item.id, {
                            status: event.target.value as CollateralItemUpdateInput["status"]
                          })
                        }
                        value={editDrafts[item.id]?.status ?? item.status}
                      >
                        {COLLATERAL_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="amc-inline-form-grid">
                    <label>
                      <span>Assignee</span>
                      <select
                        onChange={(event) => updateEditDraft(item.id, { assigneeId: event.target.value })}
                        value={editDrafts[item.id]?.assigneeId ?? item.assigneeId ?? ""}
                      >
                        <option value="">Unassigned</option>
                        {state.staff.map((profile) => (
                          <option key={profile.id} value={profile.id}>
                            {profile.displayName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Due Date</span>
                      <input
                        onChange={(event) => updateEditDraft(item.id, { dueDate: event.target.value })}
                        type="date"
                        value={editDrafts[item.id]?.dueDate ?? item.dueDate}
                      />
                    </label>
                  </div>
                  <label>
                    <span>Channel or Use</span>
                    <input
                      onChange={(event) => updateEditDraft(item.id, { channelOrUse: event.target.value })}
                      type="text"
                      value={editDrafts[item.id]?.channelOrUse ?? item.channelOrUse}
                    />
                  </label>
                  <label>
                    <span>Audience</span>
                    <input
                      onChange={(event) => updateEditDraft(item.id, { audience: event.target.value })}
                      type="text"
                      value={editDrafts[item.id]?.audience ?? item.audience}
                    />
                  </label>
                  <label>
                    <span>Notes</span>
                    <textarea
                      onChange={(event) => updateEditDraft(item.id, { notes: event.target.value })}
                      value={editDrafts[item.id]?.notes ?? item.notes}
                    />
                  </label>
                  <div className="amc-record-actions">
                    <button className="topbar__button" onClick={() => handleCollateralUpdate(item.id)} type="button">
                      Save Collateral
                    </button>
                    <button className="button-link button-link--inline-secondary" onClick={() => setEditingCollateralId(null)} type="button">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.collateralType} / {item.status}</span>
                    <span>Channel/use: {item.channelOrUse || "Not set"}</span>
                    <span>Audience: {item.audience || "Not set"}</span>
                    {item.notes ? <span>Notes: {item.notes}</span> : null}
                  </div>
                  <div className="amc-list-row__meta">
                    <span>{getAssigneeName(state.staff, item.assigneeId)}</span>
                    <span>{item.dueDate || "No due date"}</span>
                    <span>
                      {item.relatedActionItemIds.length} related action{item.relatedActionItemIds.length === 1 ? "" : "s"}
                    </span>
                    {item.relatedActionItemIds.map((actionItemId) => {
                      const actionItem = state.actionItems.find((candidate) => candidate.id === actionItemId);

                      return <span key={actionItemId}>{actionItem?.title ?? actionItemId}</span>;
                    })}
                    <button className="button-link button-link--inline-secondary" onClick={() => startEditingCollateral(item)} type="button">
                      Edit
                    </button>
                  </div>
                </>
              )}
              <div className="amc-related-action-form">
                <input
                  aria-label={`Action title for ${item.title}`}
                  onChange={(event) => updateActionDraft(item.id, { title: event.target.value })}
                  placeholder="Next action"
                  type="text"
                  value={actionDrafts[item.id]?.title ?? ""}
                />
                <select
                  aria-label={`Action assignee for ${item.title}`}
                  onChange={(event) => updateActionDraft(item.id, { assigneeId: event.target.value })}
                  value={actionDrafts[item.id]?.assigneeId ?? ""}
                >
                  <option value="">Use collateral assignee</option>
                  {state.staff.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.displayName}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Action due date for ${item.title}`}
                  onChange={(event) => updateActionDraft(item.id, { dueDate: event.target.value })}
                  type="date"
                  value={actionDrafts[item.id]?.dueDate ?? ""}
                />
                <button className="button-link button-link--inline-secondary" onClick={() => handleCreateCollateralAction(item.id)} type="button">
                  Add Action
                </button>
              </div>
            </article>
          ))}
          </div>
        </section>

        <BucketSection title="Education" emptyCopy="Education records are not built out yet.">
          {workspace.educationApplications.map((item) => (
            <article className="amc-list-row amc-list-row--work" key={item.id}>
              <div>
                <strong>{item.courseTitle}</strong>
                <span>{item.sessionCategory} / {item.hours} hour{item.hours === 1 ? "" : "s"}</span>
              </div>
              <div className="amc-list-row__meta">
                <span>{item.status}</span>
                <span>{getAssigneeName(state.staff, item.assigneeId)}</span>
              </div>
            </article>
          ))}
        </BucketSection>
      </section>

      <section className="amc-grid">
        <BucketSection title="Speakers" emptyCopy="Speaker records are not built out yet.">
          {workspace.speakerEngagements.map((item) => (
            <article className="amc-list-row amc-list-row--work" key={item.id}>
              <div>
                <strong>{item.speakerName}</strong>
                <span>{item.topicTitle} / {item.sessionCategory}</span>
              </div>
              <div className="amc-list-row__meta">
                <span>{item.status}</span>
                <span>{getAssigneeName(state.staff, item.assigneeId)}</span>
              </div>
            </article>
          ))}
        </BucketSection>

        <BucketSection title="Sponsor Fulfillment" emptyCopy="Sponsor fulfillment records are not built out yet." />
      </section>
    </div>
  );
}

function BucketSection({
  children,
  emptyCopy,
  title
}: {
  children?: ReactNode;
  emptyCopy: string;
  title: string;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);

  return (
    <section className="amc-panel">
      <div className="amc-panel__header">
        <h2>{title}</h2>
      </div>
      <div className="amc-list">{hasChildren ? children : <div className="empty-state">{emptyCopy}</div>}</div>
    </section>
  );
}
