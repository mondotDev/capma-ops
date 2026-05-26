"use client";

import type { FormEvent } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useAmcLocalState } from "@/components/amc-local-state-provider";
import {
  COLLATERAL_STATUSES,
  COLLATERAL_TYPES,
  COLLATERAL_STATUS_LABELS,
  COLLATERAL_TYPE_LABELS,
  createCollateralActionItem,
  createCollateralItem,
  createSponsorFulfillmentActionItem,
  createSponsorFulfillmentCollateralItem,
  createSponsorFulfillmentRecord,
  getAssigneeName,
  getBucketWorkspace,
  SPONSOR_FULFILLMENT_STATUSES,
  SPONSOR_FULFILLMENT_STATUS_LABELS,
  SPONSOR_FULFILLMENT_TYPES,
  SPONSOR_FULFILLMENT_TYPE_LABELS,
  WORK_BUCKET_KIND_LABELS,
  WORK_BUCKET_STATUS_LABELS,
  WORK_STATUS_LABELS,
  WORK_TRACKER_LABELS,
  validateCollateralItemCreateInput,
  validateSponsorFulfillmentCreateInput,
  type CollateralActionItemCreateInput,
  type CollateralItem,
  type CollateralItemCreateInput,
  type CollateralItemUpdateInput,
  type SponsorFulfillmentCreateInput,
  type SponsorFulfillmentRecord,
  type SponsorFulfillmentUpdateInput
} from "@/lib/amc-domain";
import { useState } from "react";

export function AmcBucketWorkspace({ clientId, bucketId }: { clientId: string; bucketId: string }) {
  const {
    state,
    addCollateralActionItem,
    addCollateralItem,
    addSponsorFulfillmentActionItem,
    addSponsorFulfillmentCollateralItem,
    addSponsorFulfillmentRecord,
    updateCollateralItem,
    updateSponsorFulfillmentRecord
  } = useAmcLocalState();
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
  const [isAddingCollateral, setIsAddingCollateral] = useState(false);
  const [sponsorForm, setSponsorForm] = useState<SponsorFulfillmentCreateInput>({
    clientAssociationId: clientId,
    bucketId,
    sponsorName: "",
    fulfillmentTitle: "",
    fulfillmentType: "logoRecognition",
    status: "notStarted",
    assigneeId: "",
    dueDate: "",
    notes: ""
  });
  const [sponsorFeedback, setSponsorFeedback] = useState("");
  const [isAddingSponsorFulfillment, setIsAddingSponsorFulfillment] = useState(false);
  const [editingSponsorFulfillmentId, setEditingSponsorFulfillmentId] = useState<string | null>(null);
  const [sponsorEditDrafts, setSponsorEditDrafts] = useState<Record<string, SponsorFulfillmentUpdateInput>>({});
  const [sponsorActionDrafts, setSponsorActionDrafts] = useState<Record<string, { title: string; assigneeId: string; dueDate: string }>>({});
  const [sponsorCollateralDrafts, setSponsorCollateralDrafts] = useState<
    Record<string, { title: string; collateralType: CollateralItemCreateInput["collateralType"]; assigneeId: string; dueDate: string; notes: string }>
  >({});
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
    setIsAddingCollateral(false);
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

  function handleSponsorFulfillmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateSponsorFulfillmentCreateInput(sponsorForm, state);

    if (!validation.isValid) {
      setSponsorFeedback(validation.errors[0] ?? "Check the required fields.");
      return;
    }

    const sponsorFulfillment = createSponsorFulfillmentRecord(sponsorForm, state);
    addSponsorFulfillmentRecord(sponsorFulfillment);
    setSponsorForm((current) => ({
      ...current,
      sponsorName: "",
      fulfillmentTitle: "",
      fulfillmentType: "logoRecognition",
      status: "notStarted",
      assigneeId: "",
      dueDate: "",
      notes: ""
    }));
    setIsAddingSponsorFulfillment(false);
    setSponsorFeedback("Sponsor fulfillment added.");
  }

  function startEditingSponsorFulfillment(item: SponsorFulfillmentRecord) {
    setEditingSponsorFulfillmentId(item.id);
    setSponsorEditDrafts((current) => ({
      ...current,
      [item.id]: {
        sponsorName: item.sponsorName,
        fulfillmentTitle: item.fulfillmentTitle,
        fulfillmentType: item.fulfillmentType,
        status: item.status,
        assigneeId: item.assigneeId,
        dueDate: item.dueDate,
        notes: item.notes
      }
    }));
    setSponsorFeedback("");
  }

  function updateSponsorEditDraft(sponsorFulfillmentId: string, updates: SponsorFulfillmentUpdateInput) {
    setSponsorEditDrafts((current) => ({
      ...current,
      [sponsorFulfillmentId]: {
        ...current[sponsorFulfillmentId],
        ...updates
      }
    }));
  }

  function handleSponsorFulfillmentUpdate(sponsorFulfillmentId: string) {
    const draft = sponsorEditDrafts[sponsorFulfillmentId];

    if (!draft?.sponsorName?.trim() || !draft?.fulfillmentTitle?.trim()) {
      setSponsorFeedback("Sponsor name and fulfillment title are required.");
      return;
    }

    try {
      updateSponsorFulfillmentRecord(sponsorFulfillmentId, draft);
      setEditingSponsorFulfillmentId(null);
      setSponsorFeedback("Sponsor fulfillment updated.");
    } catch (error) {
      setSponsorFeedback(error instanceof Error ? error.message : "Could not update sponsor fulfillment.");
    }
  }

  function updateSponsorActionDraft(sponsorFulfillmentId: string, updates: Partial<{ title: string; assigneeId: string; dueDate: string }>) {
    setSponsorActionDrafts((current) => ({
      ...current,
      [sponsorFulfillmentId]: {
        title: current[sponsorFulfillmentId]?.title ?? "",
        assigneeId: current[sponsorFulfillmentId]?.assigneeId ?? "",
        dueDate: current[sponsorFulfillmentId]?.dueDate ?? "",
        ...updates
      }
    }));
  }

  function handleCreateSponsorAction(sponsorFulfillmentId: string) {
    const sponsorFulfillment = state.sponsorFulfillmentRecords.find((item) => item.id === sponsorFulfillmentId);
    const draft = sponsorActionDrafts[sponsorFulfillmentId];

    if (!sponsorFulfillment || !draft?.title.trim()) {
      setSponsorFeedback("Action title is required.");
      return;
    }

    const actionItem = createSponsorFulfillmentActionItem({
      sponsorFulfillment,
      title: draft.title,
      assigneeId: draft.assigneeId || sponsorFulfillment.assigneeId,
      dueDate: draft.dueDate,
      data: state
    });
    addSponsorFulfillmentActionItem({ sponsorFulfillmentId, actionItem });
    setSponsorActionDrafts((current) => ({
      ...current,
      [sponsorFulfillmentId]: { title: "", assigneeId: "", dueDate: "" }
    }));
    setSponsorFeedback("Related action item added.");
  }

  function updateSponsorCollateralDraft(
    sponsorFulfillmentId: string,
    updates: Partial<{ title: string; collateralType: CollateralItemCreateInput["collateralType"]; assigneeId: string; dueDate: string; notes: string }>
  ) {
    setSponsorCollateralDrafts((current) => ({
      ...current,
      [sponsorFulfillmentId]: {
        title: current[sponsorFulfillmentId]?.title ?? "",
        collateralType: current[sponsorFulfillmentId]?.collateralType ?? "email",
        assigneeId: current[sponsorFulfillmentId]?.assigneeId ?? "",
        dueDate: current[sponsorFulfillmentId]?.dueDate ?? "",
        notes: current[sponsorFulfillmentId]?.notes ?? "",
        ...updates
      }
    }));
  }

  function handleCreateSponsorCollateral(sponsorFulfillmentId: string) {
    const sponsorFulfillment = state.sponsorFulfillmentRecords.find((item) => item.id === sponsorFulfillmentId);
    const draft = sponsorCollateralDrafts[sponsorFulfillmentId];

    if (!sponsorFulfillment || !draft?.title.trim()) {
      setSponsorFeedback("Collateral title is required.");
      return;
    }

    const collateralItem = createSponsorFulfillmentCollateralItem({
      sponsorFulfillment,
      title: draft.title,
      collateralType: draft.collateralType,
      assigneeId: draft.assigneeId || sponsorFulfillment.assigneeId,
      dueDate: draft.dueDate,
      notes: draft.notes,
      data: state
    });
    addSponsorFulfillmentCollateralItem({ sponsorFulfillmentId, collateralItem });
    setSponsorCollateralDrafts((current) => ({
      ...current,
      [sponsorFulfillmentId]: { title: "", collateralType: "email", assigneeId: "", dueDate: "", notes: "" }
    }));
    setSponsorFeedback("Related collateral added.");
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
            {WORK_BUCKET_KIND_LABELS[workspace.bucket.kind]} / {WORK_BUCKET_STATUS_LABELS[workspace.bucket.status]}
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
        <div className="amc-metric">
          <span>Sponsor Fulfillment</span>
          <strong>{workspace.sponsorFulfillmentRecords.length}</strong>
        </div>
        <div className="amc-metric">
          <span>Bucket Type</span>
          <strong className="amc-metric__text">{WORK_BUCKET_KIND_LABELS[workspace.bucket.kind]}</strong>
        </div>
      </section>

      <section className="amc-grid">
        <BucketSection title="Assigned Work" emptyCopy="No assigned or related work yet.">
          {workspace.workItems.map((item) => (
            <article className="amc-list-row amc-list-row--work" key={`${item.tracker}-${item.id}`}>
              <div>
                <strong>{item.title}</strong>
                <span>{WORK_TRACKER_LABELS[item.tracker]} / {WORK_STATUS_LABELS[item.status]}</span>
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
                <span>{WORK_STATUS_LABELS[item.status]}</span>
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
            <div className="amc-panel__actions">
              <span>{workspace.collateralItems.length} records</span>
              <button className="button-link button-link--inline-secondary" onClick={() => setIsAddingCollateral((current) => !current)} type="button">
                {isAddingCollateral ? "Hide form" : "Add collateral"}
              </button>
            </div>
          </div>
          {collateralFeedback ? <div className="amc-form-feedback">{collateralFeedback}</div> : null}
          <div className="amc-list">
            {workspace.collateralItems.length === 0 ? <div className="empty-state">No collateral records in this bucket yet.</div> : null}
            {workspace.collateralItems.map((item) => (
              <article className="amc-collateral-card" key={item.id}>
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
                            {COLLATERAL_TYPE_LABELS[type]}
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
                            {COLLATERAL_STATUS_LABELS[status]}
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
                  <div className="amc-collateral-card__main">
                    <div>
                      <strong>{item.title}</strong>
                      <span>{COLLATERAL_TYPE_LABELS[item.collateralType]} / {item.channelOrUse || "No channel/use"}</span>
                    </div>
                    <div className="amc-collateral-card__chips">
                      <span>{COLLATERAL_STATUS_LABELS[item.status]}</span>
                      <span>{getAssigneeName(state.staff, item.assigneeId)}</span>
                      {item.dueDate ? <span>{item.dueDate}</span> : null}
                      <span>
                        {item.relatedActionItemIds.length} related action{item.relatedActionItemIds.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="amc-collateral-card__secondary">
                      {item.audience ? <span>Audience: {item.audience}</span> : null}
                      {item.notes ? <span>Notes: {item.notes}</span> : null}
                      {item.relatedActionItemIds.map((actionItemId) => {
                        const actionItem = state.actionItems.find((candidate) => candidate.id === actionItemId);

                        return <span key={actionItemId}>Action: {actionItem?.title ?? actionItemId}</span>;
                      })}
                    </div>
                  </div>
                  <div className="amc-record-actions">
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
          {isAddingCollateral ? (
            <form className="amc-form-stack amc-collateral-add-form" onSubmit={handleCollateralSubmit}>
              <div className="amc-panel__header">
                <h3>Add collateral</h3>
                <span>Client and bucket are inherited</span>
              </div>
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
                        {COLLATERAL_TYPE_LABELS[type]}
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
                        {COLLATERAL_STATUS_LABELS[status]}
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
          ) : null}
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

        <section className="amc-panel">
          <div className="amc-panel__header">
            <h2>Sponsor Fulfillment</h2>
            <div className="amc-panel__actions">
              <span>{workspace.sponsorFulfillmentRecords.length} records</span>
              <button
                className="button-link button-link--inline-secondary"
                onClick={() => setIsAddingSponsorFulfillment((current) => !current)}
                type="button"
              >
                {isAddingSponsorFulfillment ? "Hide form" : "Add fulfillment"}
              </button>
            </div>
          </div>
          {sponsorFeedback ? <div className="amc-form-feedback">{sponsorFeedback}</div> : null}
          <div className="amc-list">
            {workspace.sponsorFulfillmentRecords.length === 0 ? (
              <div className="empty-state">No sponsor fulfillment records in this bucket yet.</div>
            ) : null}
            {workspace.sponsorFulfillmentRecords.map((item) => (
              <article className="amc-collateral-card" key={item.id}>
                {editingSponsorFulfillmentId === item.id ? (
                  <div className="amc-collateral-edit-form">
                    <div className="amc-inline-form-grid">
                      <label>
                        <span>Sponsor</span>
                        <input
                          onChange={(event) => updateSponsorEditDraft(item.id, { sponsorName: event.target.value })}
                          type="text"
                          value={sponsorEditDrafts[item.id]?.sponsorName ?? item.sponsorName}
                        />
                      </label>
                      <label>
                        <span>Fulfillment</span>
                        <input
                          onChange={(event) => updateSponsorEditDraft(item.id, { fulfillmentTitle: event.target.value })}
                          type="text"
                          value={sponsorEditDrafts[item.id]?.fulfillmentTitle ?? item.fulfillmentTitle}
                        />
                      </label>
                    </div>
                    <div className="amc-inline-form-grid">
                      <label>
                        <span>Type</span>
                        <select
                          onChange={(event) =>
                            updateSponsorEditDraft(item.id, {
                              fulfillmentType: event.target.value as SponsorFulfillmentUpdateInput["fulfillmentType"]
                            })
                          }
                          value={sponsorEditDrafts[item.id]?.fulfillmentType ?? item.fulfillmentType}
                        >
                          {SPONSOR_FULFILLMENT_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {SPONSOR_FULFILLMENT_TYPE_LABELS[type]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Status</span>
                        <select
                          onChange={(event) =>
                            updateSponsorEditDraft(item.id, {
                              status: event.target.value as SponsorFulfillmentUpdateInput["status"]
                            })
                          }
                          value={sponsorEditDrafts[item.id]?.status ?? item.status}
                        >
                          {SPONSOR_FULFILLMENT_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {SPONSOR_FULFILLMENT_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="amc-inline-form-grid">
                      <label>
                        <span>Assignee</span>
                        <select
                          onChange={(event) => updateSponsorEditDraft(item.id, { assigneeId: event.target.value })}
                          value={sponsorEditDrafts[item.id]?.assigneeId ?? item.assigneeId ?? ""}
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
                          onChange={(event) => updateSponsorEditDraft(item.id, { dueDate: event.target.value })}
                          type="date"
                          value={sponsorEditDrafts[item.id]?.dueDate ?? item.dueDate}
                        />
                      </label>
                    </div>
                    <label>
                      <span>Notes</span>
                      <textarea
                        onChange={(event) => updateSponsorEditDraft(item.id, { notes: event.target.value })}
                        value={sponsorEditDrafts[item.id]?.notes ?? item.notes}
                      />
                    </label>
                    <div className="amc-record-actions">
                      <button className="topbar__button" onClick={() => handleSponsorFulfillmentUpdate(item.id)} type="button">
                        Save Fulfillment
                      </button>
                      <button className="button-link button-link--inline-secondary" onClick={() => setEditingSponsorFulfillmentId(null)} type="button">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="amc-collateral-card__main">
                      <div>
                        <strong>{item.fulfillmentTitle}</strong>
                        <span>{item.sponsorName} / {SPONSOR_FULFILLMENT_TYPE_LABELS[item.fulfillmentType]}</span>
                      </div>
                      <div className="amc-collateral-card__chips">
                        <span>{SPONSOR_FULFILLMENT_STATUS_LABELS[item.status]}</span>
                        <span>{getAssigneeName(state.staff, item.assigneeId)}</span>
                        {item.dueDate ? <span>{item.dueDate}</span> : null}
                        <span>
                          {item.relatedActionItemIds.length} action{item.relatedActionItemIds.length === 1 ? "" : "s"}
                        </span>
                        <span>
                          {item.relatedCollateralIds.length} collateral
                        </span>
                      </div>
                      <div className="amc-collateral-card__secondary">
                        {item.notes ? <span>Notes: {item.notes}</span> : null}
                        {item.relatedActionItemIds.map((actionItemId) => {
                          const actionItem = state.actionItems.find((candidate) => candidate.id === actionItemId);

                          return <span key={actionItemId}>Action: {actionItem?.title ?? actionItemId}</span>;
                        })}
                        {item.relatedCollateralIds.map((collateralItemId) => {
                          const collateralItem = state.collateralItems.find((candidate) => candidate.id === collateralItemId);

                          return <span key={collateralItemId}>Collateral: {collateralItem?.title ?? collateralItemId}</span>;
                        })}
                      </div>
                    </div>
                    <div className="amc-record-actions">
                      <button className="button-link button-link--inline-secondary" onClick={() => startEditingSponsorFulfillment(item)} type="button">
                        Edit
                      </button>
                    </div>
                  </>
                )}
                <div className="amc-related-action-form">
                  <input
                    aria-label={`Action title for ${item.fulfillmentTitle}`}
                    onChange={(event) => updateSponsorActionDraft(item.id, { title: event.target.value })}
                    placeholder="Next action"
                    type="text"
                    value={sponsorActionDrafts[item.id]?.title ?? ""}
                  />
                  <select
                    aria-label={`Action assignee for ${item.fulfillmentTitle}`}
                    onChange={(event) => updateSponsorActionDraft(item.id, { assigneeId: event.target.value })}
                    value={sponsorActionDrafts[item.id]?.assigneeId ?? ""}
                  >
                    <option value="">Use fulfillment assignee</option>
                    {state.staff.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.displayName}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`Action due date for ${item.fulfillmentTitle}`}
                    onChange={(event) => updateSponsorActionDraft(item.id, { dueDate: event.target.value })}
                    type="date"
                    value={sponsorActionDrafts[item.id]?.dueDate ?? ""}
                  />
                  <button className="button-link button-link--inline-secondary" onClick={() => handleCreateSponsorAction(item.id)} type="button">
                    Add Action
                  </button>
                </div>
                <div className="amc-related-collateral-form">
                  <input
                    aria-label={`Collateral title for ${item.fulfillmentTitle}`}
                    onChange={(event) => updateSponsorCollateralDraft(item.id, { title: event.target.value })}
                    placeholder="Related collateral"
                    type="text"
                    value={sponsorCollateralDrafts[item.id]?.title ?? ""}
                  />
                  <select
                    aria-label={`Collateral type for ${item.fulfillmentTitle}`}
                    onChange={(event) =>
                      updateSponsorCollateralDraft(item.id, {
                        collateralType: event.target.value as CollateralItemCreateInput["collateralType"]
                      })
                    }
                    value={sponsorCollateralDrafts[item.id]?.collateralType ?? "email"}
                  >
                    {COLLATERAL_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {COLLATERAL_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Collateral assignee for ${item.fulfillmentTitle}`}
                    onChange={(event) => updateSponsorCollateralDraft(item.id, { assigneeId: event.target.value })}
                    value={sponsorCollateralDrafts[item.id]?.assigneeId ?? ""}
                  >
                    <option value="">Use fulfillment assignee</option>
                    {state.staff.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.displayName}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`Collateral due date for ${item.fulfillmentTitle}`}
                    onChange={(event) => updateSponsorCollateralDraft(item.id, { dueDate: event.target.value })}
                    type="date"
                    value={sponsorCollateralDrafts[item.id]?.dueDate ?? ""}
                  />
                  <button className="button-link button-link--inline-secondary" onClick={() => handleCreateSponsorCollateral(item.id)} type="button">
                    Add Collateral
                  </button>
                </div>
              </article>
            ))}
          </div>
          {isAddingSponsorFulfillment ? (
            <form className="amc-form-stack amc-collateral-add-form" onSubmit={handleSponsorFulfillmentSubmit}>
              <div className="amc-panel__header">
                <h3>Add sponsor fulfillment</h3>
                <span>Client and bucket are inherited</span>
              </div>
              <div className="amc-inline-form-grid">
                <label>
                  <span>Sponsor</span>
                  <input
                    onChange={(event) => setSponsorForm((current) => ({ ...current, sponsorName: event.target.value }))}
                    placeholder="Sponsor name"
                    type="text"
                    value={sponsorForm.sponsorName}
                  />
                </label>
                <label>
                  <span>Fulfillment</span>
                  <input
                    onChange={(event) => setSponsorForm((current) => ({ ...current, fulfillmentTitle: event.target.value }))}
                    placeholder="Promised benefit"
                    type="text"
                    value={sponsorForm.fulfillmentTitle}
                  />
                </label>
              </div>
              <div className="amc-inline-form-grid">
                <label>
                  <span>Type</span>
                  <select
                    onChange={(event) =>
                      setSponsorForm((current) => ({
                        ...current,
                        fulfillmentType: event.target.value as SponsorFulfillmentCreateInput["fulfillmentType"]
                      }))
                    }
                    value={sponsorForm.fulfillmentType}
                  >
                    {SPONSOR_FULFILLMENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {SPONSOR_FULFILLMENT_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Status</span>
                  <select
                    onChange={(event) =>
                      setSponsorForm((current) => ({
                        ...current,
                        status: event.target.value as SponsorFulfillmentCreateInput["status"]
                      }))
                    }
                    value={sponsorForm.status}
                  >
                    {SPONSOR_FULFILLMENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {SPONSOR_FULFILLMENT_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="amc-inline-form-grid">
                <label>
                  <span>Assignee</span>
                  <select
                    onChange={(event) => setSponsorForm((current) => ({ ...current, assigneeId: event.target.value }))}
                    value={sponsorForm.assigneeId ?? ""}
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
                    onChange={(event) => setSponsorForm((current) => ({ ...current, dueDate: event.target.value }))}
                    type="date"
                    value={sponsorForm.dueDate}
                  />
                </label>
              </div>
              <label>
                <span>Notes</span>
                <textarea
                  onChange={(event) => setSponsorForm((current) => ({ ...current, notes: event.target.value }))}
                  value={sponsorForm.notes}
                />
              </label>
              <button className="topbar__button" type="submit">
                Add Fulfillment
              </button>
            </form>
          ) : null}
        </section>
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
