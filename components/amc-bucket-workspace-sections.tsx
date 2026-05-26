"use client";

import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import {
  COLLATERAL_STATUSES,
  COLLATERAL_STATUS_LABELS,
  COLLATERAL_TYPE_LABELS,
  COLLATERAL_TYPES,
  getAssigneeName,
  SPONSOR_FULFILLMENT_STATUSES,
  SPONSOR_FULFILLMENT_STATUS_LABELS,
  SPONSOR_FULFILLMENT_TYPES,
  SPONSOR_FULFILLMENT_TYPE_LABELS,
  WORK_BUCKET_KIND_LABELS,
  WORK_STATUS_LABELS,
  WORK_TRACKER_LABELS,
  type ActionItem,
  type BucketWorkspace,
  type CollateralItem,
  type CollateralItemCreateInput,
  type CollateralItemUpdateInput,
  type EducationApplication,
  type SpeakerEngagement,
  type SponsorFulfillmentCreateInput,
  type SponsorFulfillmentRecord,
  type SponsorFulfillmentUpdateInput,
  type StaffProfile,
  type WorkItem
} from "@/lib/amc-domain";

type ActionDraft = { title: string; assigneeId: string; dueDate: string };
type SponsorCollateralDraft = {
  title: string;
  collateralType: CollateralItemCreateInput["collateralType"];
  assigneeId: string;
  dueDate: string;
  notes: string;
};

export function BucketWorkspaceSummary({ workspace }: { workspace: BucketWorkspace }) {
  return (
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
        <strong className="amc-metric__text">{workspace.bucket ? WORK_BUCKET_KIND_LABELS[workspace.bucket.kind] : ""}</strong>
      </div>
    </section>
  );
}

export function BucketAssignedWorkSection({ staff, workItems }: { staff: StaffProfile[]; workItems: WorkItem[] }) {
  return (
    <SectionCard title="Assigned Work" emptyCopy="No assigned or related work yet.">
      {workItems.map((item) => (
        <article className="amc-list-row amc-list-row--work" key={`${item.tracker}-${item.id}`}>
          <div>
            <strong>{item.title}</strong>
            <span>
              {WORK_TRACKER_LABELS[item.tracker]} / {WORK_STATUS_LABELS[item.status]}
            </span>
          </div>
          <div className="amc-list-row__meta">
            <span>{getAssigneeName(staff, item.assigneeId)}</span>
            <span>{item.dueDate || "No due date"}</span>
          </div>
        </article>
      ))}
    </SectionCard>
  );
}

export function BucketActionItemsSection({ actionItems, staff }: { actionItems: ActionItem[]; staff: StaffProfile[] }) {
  return (
    <SectionCard title="Action Items" emptyCopy="No action items in this bucket yet.">
      {actionItems.map((item) => (
        <article className="amc-list-row amc-list-row--work" key={item.id}>
          <div>
            <strong>{item.title}</strong>
            <span>{WORK_STATUS_LABELS[item.status]}</span>
          </div>
          <div className="amc-list-row__meta">
            <span>{getAssigneeName(staff, item.assigneeId)}</span>
            <span>{item.dueDate || "No due date"}</span>
          </div>
        </article>
      ))}
    </SectionCard>
  );
}

export function BucketCollateralSection({
  actionDrafts,
  actionItems,
  collateralFeedback,
  collateralForm,
  collateralItems,
  editDrafts,
  editingCollateralId,
  handleCollateralSubmit,
  handleCollateralUpdate,
  handleCreateCollateralAction,
  isAddingCollateral,
  setCollateralForm,
  setEditingCollateralId,
  setIsAddingCollateral,
  staff,
  startEditingCollateral,
  updateActionDraft,
  updateEditDraft
}: {
  actionDrafts: Record<string, ActionDraft>;
  actionItems: ActionItem[];
  collateralFeedback: string;
  collateralForm: CollateralItemCreateInput;
  collateralItems: CollateralItem[];
  editDrafts: Record<string, CollateralItemUpdateInput>;
  editingCollateralId: string | null;
  handleCollateralSubmit: (event: FormEvent<HTMLFormElement>) => void;
  handleCollateralUpdate: (collateralItemId: string) => void;
  handleCreateCollateralAction: (collateralItemId: string) => void;
  isAddingCollateral: boolean;
  setCollateralForm: Dispatch<SetStateAction<CollateralItemCreateInput>>;
  setEditingCollateralId: Dispatch<SetStateAction<string | null>>;
  setIsAddingCollateral: Dispatch<SetStateAction<boolean>>;
  staff: StaffProfile[];
  startEditingCollateral: (item: CollateralItem) => void;
  updateActionDraft: (collateralItemId: string, updates: Partial<ActionDraft>) => void;
  updateEditDraft: (collateralItemId: string, updates: CollateralItemUpdateInput) => void;
}) {
  return (
    <section className="amc-panel">
      <div className="amc-panel__header">
        <h2>Collateral</h2>
        <div className="amc-panel__actions">
          <span>{collateralItems.length} records</span>
          <button className="button-link button-link--inline-secondary" onClick={() => setIsAddingCollateral((current) => !current)} type="button">
            {isAddingCollateral ? "Hide form" : "Add collateral"}
          </button>
        </div>
      </div>
      {collateralFeedback ? <div className="amc-form-feedback">{collateralFeedback}</div> : null}
      <div className="amc-list">
        {collateralItems.length === 0 ? <EmptySectionState>No collateral records in this bucket yet.</EmptySectionState> : null}
        {collateralItems.map((item) => (
          <article className="amc-collateral-card" key={item.id}>
            {editingCollateralId === item.id ? (
              <CollateralEditForm
                draft={editDrafts[item.id]}
                item={item}
                onCancel={() => setEditingCollateralId(null)}
                onSave={() => handleCollateralUpdate(item.id)}
                onUpdate={(updates) => updateEditDraft(item.id, updates)}
                staff={staff}
              />
            ) : (
              <CollateralRecordDisplay actionItems={actionItems} item={item} onEdit={() => startEditingCollateral(item)} staff={staff} />
            )}
            <RelatedActionForm
              assigneeCopy="Use collateral assignee"
              draft={actionDrafts[item.id]}
              labelBase={item.title}
              onCreate={() => handleCreateCollateralAction(item.id)}
              onUpdate={(updates) => updateActionDraft(item.id, updates)}
              staff={staff}
            />
          </article>
        ))}
      </div>
      {isAddingCollateral ? (
        <CollateralCreateForm collateralForm={collateralForm} handleCollateralSubmit={handleCollateralSubmit} setCollateralForm={setCollateralForm} staff={staff} />
      ) : null}
    </section>
  );
}

export function BucketEducationSection({ educationApplications, staff }: { educationApplications: EducationApplication[]; staff: StaffProfile[] }) {
  return (
    <SectionCard title="Education" emptyCopy="Education records are not built out yet.">
      {educationApplications.map((item) => (
        <article className="amc-list-row amc-list-row--work" key={item.id}>
          <div>
            <strong>{item.courseTitle}</strong>
            <span>
              {item.sessionCategory} / {item.hours} hour{item.hours === 1 ? "" : "s"}
            </span>
          </div>
          <div className="amc-list-row__meta">
            <span>{item.status}</span>
            <span>{getAssigneeName(staff, item.assigneeId)}</span>
          </div>
        </article>
      ))}
    </SectionCard>
  );
}

export function BucketSpeakersSection({ speakerEngagements, staff }: { speakerEngagements: SpeakerEngagement[]; staff: StaffProfile[] }) {
  return (
    <SectionCard title="Speakers" emptyCopy="Speaker records are not built out yet.">
      {speakerEngagements.map((item) => (
        <article className="amc-list-row amc-list-row--work" key={item.id}>
          <div>
            <strong>{item.speakerName}</strong>
            <span>
              {item.topicTitle} / {item.sessionCategory}
            </span>
          </div>
          <div className="amc-list-row__meta">
            <span>{item.status}</span>
            <span>{getAssigneeName(staff, item.assigneeId)}</span>
          </div>
        </article>
      ))}
    </SectionCard>
  );
}

export function BucketSponsorFulfillmentSection({
  actionItems,
  collateralItems,
  editingSponsorFulfillmentId,
  handleCreateSponsorAction,
  handleCreateSponsorCollateral,
  handleSponsorFulfillmentSubmit,
  handleSponsorFulfillmentUpdate,
  isAddingSponsorFulfillment,
  setEditingSponsorFulfillmentId,
  setIsAddingSponsorFulfillment,
  setSponsorForm,
  sponsorActionDrafts,
  sponsorCollateralDrafts,
  sponsorEditDrafts,
  sponsorFeedback,
  sponsorForm,
  sponsorFulfillmentRecords,
  staff,
  startEditingSponsorFulfillment,
  updateSponsorActionDraft,
  updateSponsorCollateralDraft,
  updateSponsorEditDraft
}: {
  actionItems: ActionItem[];
  collateralItems: CollateralItem[];
  editingSponsorFulfillmentId: string | null;
  handleCreateSponsorAction: (sponsorFulfillmentId: string) => void;
  handleCreateSponsorCollateral: (sponsorFulfillmentId: string) => void;
  handleSponsorFulfillmentSubmit: (event: FormEvent<HTMLFormElement>) => void;
  handleSponsorFulfillmentUpdate: (sponsorFulfillmentId: string) => void;
  isAddingSponsorFulfillment: boolean;
  setEditingSponsorFulfillmentId: Dispatch<SetStateAction<string | null>>;
  setIsAddingSponsorFulfillment: Dispatch<SetStateAction<boolean>>;
  setSponsorForm: Dispatch<SetStateAction<SponsorFulfillmentCreateInput>>;
  sponsorActionDrafts: Record<string, ActionDraft>;
  sponsorCollateralDrafts: Record<string, SponsorCollateralDraft>;
  sponsorEditDrafts: Record<string, SponsorFulfillmentUpdateInput>;
  sponsorFeedback: string;
  sponsorForm: SponsorFulfillmentCreateInput;
  sponsorFulfillmentRecords: SponsorFulfillmentRecord[];
  staff: StaffProfile[];
  startEditingSponsorFulfillment: (item: SponsorFulfillmentRecord) => void;
  updateSponsorActionDraft: (sponsorFulfillmentId: string, updates: Partial<ActionDraft>) => void;
  updateSponsorCollateralDraft: (sponsorFulfillmentId: string, updates: Partial<SponsorCollateralDraft>) => void;
  updateSponsorEditDraft: (sponsorFulfillmentId: string, updates: SponsorFulfillmentUpdateInput) => void;
}) {
  return (
    <section className="amc-panel">
      <div className="amc-panel__header">
        <h2>Sponsor Fulfillment</h2>
        <div className="amc-panel__actions">
          <span>{sponsorFulfillmentRecords.length} records</span>
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
        {sponsorFulfillmentRecords.length === 0 ? <EmptySectionState>No sponsor fulfillment records in this bucket yet.</EmptySectionState> : null}
        {sponsorFulfillmentRecords.map((item) => (
          <article className="amc-collateral-card" key={item.id}>
            {editingSponsorFulfillmentId === item.id ? (
              <SponsorFulfillmentEditForm
                draft={sponsorEditDrafts[item.id]}
                item={item}
                onCancel={() => setEditingSponsorFulfillmentId(null)}
                onSave={() => handleSponsorFulfillmentUpdate(item.id)}
                onUpdate={(updates) => updateSponsorEditDraft(item.id, updates)}
                staff={staff}
              />
            ) : (
              <SponsorFulfillmentRecordDisplay
                actionItems={actionItems}
                collateralItems={collateralItems}
                item={item}
                onEdit={() => startEditingSponsorFulfillment(item)}
                staff={staff}
              />
            )}
            <RelatedActionForm
              assigneeCopy="Use fulfillment assignee"
              draft={sponsorActionDrafts[item.id]}
              labelBase={item.fulfillmentTitle}
              onCreate={() => handleCreateSponsorAction(item.id)}
              onUpdate={(updates) => updateSponsorActionDraft(item.id, updates)}
              staff={staff}
            />
            <RelatedCollateralForm
              draft={sponsorCollateralDrafts[item.id]}
              item={item}
              onCreate={() => handleCreateSponsorCollateral(item.id)}
              onUpdate={(updates) => updateSponsorCollateralDraft(item.id, updates)}
              staff={staff}
            />
          </article>
        ))}
      </div>
      {isAddingSponsorFulfillment ? (
        <SponsorFulfillmentCreateForm
          handleSponsorFulfillmentSubmit={handleSponsorFulfillmentSubmit}
          setSponsorForm={setSponsorForm}
          sponsorForm={sponsorForm}
          staff={staff}
        />
      ) : null}
    </section>
  );
}

function CollateralEditForm({
  draft,
  item,
  onCancel,
  onSave,
  onUpdate,
  staff
}: {
  draft?: CollateralItemUpdateInput;
  item: CollateralItem;
  onCancel: () => void;
  onSave: () => void;
  onUpdate: (updates: CollateralItemUpdateInput) => void;
  staff: StaffProfile[];
}) {
  return (
    <div className="amc-collateral-edit-form">
      <label>
        <span>Title</span>
        <input onChange={(event) => onUpdate({ title: event.target.value })} type="text" value={draft?.title ?? item.title} />
      </label>
      <div className="amc-inline-form-grid">
        <label>
          <span>Type</span>
          <select onChange={(event) => onUpdate({ collateralType: event.target.value as CollateralItemUpdateInput["collateralType"] })} value={draft?.collateralType ?? item.collateralType}>
            {COLLATERAL_TYPES.map((type) => (
              <option key={type} value={type}>
                {COLLATERAL_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select onChange={(event) => onUpdate({ status: event.target.value as CollateralItemUpdateInput["status"] })} value={draft?.status ?? item.status}>
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
          <select onChange={(event) => onUpdate({ assigneeId: event.target.value })} value={draft?.assigneeId ?? item.assigneeId ?? ""}>
            <option value="">Unassigned</option>
            {staff.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Due Date</span>
          <input onChange={(event) => onUpdate({ dueDate: event.target.value })} type="date" value={draft?.dueDate ?? item.dueDate} />
        </label>
      </div>
      <label>
        <span>Channel or Use</span>
        <input onChange={(event) => onUpdate({ channelOrUse: event.target.value })} type="text" value={draft?.channelOrUse ?? item.channelOrUse} />
      </label>
      <label>
        <span>Audience</span>
        <input onChange={(event) => onUpdate({ audience: event.target.value })} type="text" value={draft?.audience ?? item.audience} />
      </label>
      <label>
        <span>Notes</span>
        <textarea onChange={(event) => onUpdate({ notes: event.target.value })} value={draft?.notes ?? item.notes} />
      </label>
      <div className="amc-record-actions">
        <button className="topbar__button" onClick={onSave} type="button">
          Save Collateral
        </button>
        <button className="button-link button-link--inline-secondary" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}

function CollateralRecordDisplay({
  actionItems,
  item,
  onEdit,
  staff
}: {
  actionItems: ActionItem[];
  item: CollateralItem;
  onEdit: () => void;
  staff: StaffProfile[];
}) {
  return (
    <>
      <div className="amc-collateral-card__main">
        <div>
          <strong>{item.title}</strong>
          <span>
            {COLLATERAL_TYPE_LABELS[item.collateralType]} / {item.channelOrUse || "No channel/use"}
          </span>
        </div>
        <div className="amc-collateral-card__chips">
          <span>{COLLATERAL_STATUS_LABELS[item.status]}</span>
          <span>{getAssigneeName(staff, item.assigneeId)}</span>
          {item.dueDate ? <span>{item.dueDate}</span> : null}
          <span>
            {item.relatedActionItemIds.length} related action{item.relatedActionItemIds.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="amc-collateral-card__secondary">
          {item.audience ? <span>Audience: {item.audience}</span> : null}
          {item.notes ? <span>Notes: {item.notes}</span> : null}
          {item.relatedActionItemIds.map((actionItemId) => {
            const actionItem = actionItems.find((candidate) => candidate.id === actionItemId);

            return <span key={actionItemId}>Action: {actionItem?.title ?? actionItemId}</span>;
          })}
        </div>
      </div>
      <div className="amc-record-actions">
        <button className="button-link button-link--inline-secondary" onClick={onEdit} type="button">
          Edit
        </button>
      </div>
    </>
  );
}

function CollateralCreateForm({
  collateralForm,
  handleCollateralSubmit,
  setCollateralForm,
  staff
}: {
  collateralForm: CollateralItemCreateInput;
  handleCollateralSubmit: (event: FormEvent<HTMLFormElement>) => void;
  setCollateralForm: Dispatch<SetStateAction<CollateralItemCreateInput>>;
  staff: StaffProfile[];
}) {
  return (
    <form className="amc-form-stack amc-collateral-add-form" onSubmit={handleCollateralSubmit}>
      <div className="amc-panel__header">
        <h3>Add collateral</h3>
        <span>Client and bucket are inherited</span>
      </div>
      <label>
        <span>Title</span>
        <input onChange={(event) => setCollateralForm((current) => ({ ...current, title: event.target.value }))} placeholder="Collateral title" type="text" value={collateralForm.title} />
      </label>
      <div className="amc-inline-form-grid">
        <label>
          <span>Type</span>
          <select
            onChange={(event) => setCollateralForm((current) => ({ ...current, collateralType: event.target.value as CollateralItemCreateInput["collateralType"] }))}
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
          <select onChange={(event) => setCollateralForm((current) => ({ ...current, status: event.target.value as CollateralItemCreateInput["status"] }))} value={collateralForm.status}>
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
          <select onChange={(event) => setCollateralForm((current) => ({ ...current, assigneeId: event.target.value }))} value={collateralForm.assigneeId ?? ""}>
            <option value="">Unassigned</option>
            {staff.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Due Date</span>
          <input onChange={(event) => setCollateralForm((current) => ({ ...current, dueDate: event.target.value }))} type="date" value={collateralForm.dueDate} />
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
        <input onChange={(event) => setCollateralForm((current) => ({ ...current, audience: event.target.value }))} placeholder="Members, sponsors, attendees" type="text" value={collateralForm.audience} />
      </label>
      <label>
        <span>Notes</span>
        <textarea onChange={(event) => setCollateralForm((current) => ({ ...current, notes: event.target.value }))} value={collateralForm.notes} />
      </label>
      <button className="topbar__button" type="submit">
        Add Collateral
      </button>
    </form>
  );
}

function SponsorFulfillmentEditForm({
  draft,
  item,
  onCancel,
  onSave,
  onUpdate,
  staff
}: {
  draft?: SponsorFulfillmentUpdateInput;
  item: SponsorFulfillmentRecord;
  onCancel: () => void;
  onSave: () => void;
  onUpdate: (updates: SponsorFulfillmentUpdateInput) => void;
  staff: StaffProfile[];
}) {
  return (
    <div className="amc-collateral-edit-form">
      <div className="amc-inline-form-grid">
        <label>
          <span>Sponsor</span>
          <input onChange={(event) => onUpdate({ sponsorName: event.target.value })} type="text" value={draft?.sponsorName ?? item.sponsorName} />
        </label>
        <label>
          <span>Fulfillment</span>
          <input onChange={(event) => onUpdate({ fulfillmentTitle: event.target.value })} type="text" value={draft?.fulfillmentTitle ?? item.fulfillmentTitle} />
        </label>
      </div>
      <div className="amc-inline-form-grid">
        <label>
          <span>Type</span>
          <select onChange={(event) => onUpdate({ fulfillmentType: event.target.value as SponsorFulfillmentUpdateInput["fulfillmentType"] })} value={draft?.fulfillmentType ?? item.fulfillmentType}>
            {SPONSOR_FULFILLMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {SPONSOR_FULFILLMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select onChange={(event) => onUpdate({ status: event.target.value as SponsorFulfillmentUpdateInput["status"] })} value={draft?.status ?? item.status}>
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
          <select onChange={(event) => onUpdate({ assigneeId: event.target.value })} value={draft?.assigneeId ?? item.assigneeId ?? ""}>
            <option value="">Unassigned</option>
            {staff.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Due Date</span>
          <input onChange={(event) => onUpdate({ dueDate: event.target.value })} type="date" value={draft?.dueDate ?? item.dueDate} />
        </label>
      </div>
      <label>
        <span>Notes</span>
        <textarea onChange={(event) => onUpdate({ notes: event.target.value })} value={draft?.notes ?? item.notes} />
      </label>
      <div className="amc-record-actions">
        <button className="topbar__button" onClick={onSave} type="button">
          Save Fulfillment
        </button>
        <button className="button-link button-link--inline-secondary" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}

function SponsorFulfillmentRecordDisplay({
  actionItems,
  collateralItems,
  item,
  onEdit,
  staff
}: {
  actionItems: ActionItem[];
  collateralItems: CollateralItem[];
  item: SponsorFulfillmentRecord;
  onEdit: () => void;
  staff: StaffProfile[];
}) {
  return (
    <>
      <div className="amc-collateral-card__main">
        <div>
          <strong>{item.fulfillmentTitle}</strong>
          <span>
            {item.sponsorName} / {SPONSOR_FULFILLMENT_TYPE_LABELS[item.fulfillmentType]}
          </span>
        </div>
        <div className="amc-collateral-card__chips">
          <span>{SPONSOR_FULFILLMENT_STATUS_LABELS[item.status]}</span>
          <span>{getAssigneeName(staff, item.assigneeId)}</span>
          {item.dueDate ? <span>{item.dueDate}</span> : null}
          <span>
            {item.relatedActionItemIds.length} action{item.relatedActionItemIds.length === 1 ? "" : "s"}
          </span>
          <span>{item.relatedCollateralIds.length} collateral</span>
        </div>
        <div className="amc-collateral-card__secondary">
          {item.notes ? <span>Notes: {item.notes}</span> : null}
          {item.relatedActionItemIds.map((actionItemId) => {
            const actionItem = actionItems.find((candidate) => candidate.id === actionItemId);

            return <span key={actionItemId}>Action: {actionItem?.title ?? actionItemId}</span>;
          })}
          {item.relatedCollateralIds.map((collateralItemId) => {
            const collateralItem = collateralItems.find((candidate) => candidate.id === collateralItemId);

            return <span key={collateralItemId}>Collateral: {collateralItem?.title ?? collateralItemId}</span>;
          })}
        </div>
      </div>
      <div className="amc-record-actions">
        <button className="button-link button-link--inline-secondary" onClick={onEdit} type="button">
          Edit
        </button>
      </div>
    </>
  );
}

function SponsorFulfillmentCreateForm({
  handleSponsorFulfillmentSubmit,
  setSponsorForm,
  sponsorForm,
  staff
}: {
  handleSponsorFulfillmentSubmit: (event: FormEvent<HTMLFormElement>) => void;
  setSponsorForm: Dispatch<SetStateAction<SponsorFulfillmentCreateInput>>;
  sponsorForm: SponsorFulfillmentCreateInput;
  staff: StaffProfile[];
}) {
  return (
    <form className="amc-form-stack amc-collateral-add-form" onSubmit={handleSponsorFulfillmentSubmit}>
      <div className="amc-panel__header">
        <h3>Add sponsor fulfillment</h3>
        <span>Client and bucket are inherited</span>
      </div>
      <div className="amc-inline-form-grid">
        <label>
          <span>Sponsor</span>
          <input onChange={(event) => setSponsorForm((current) => ({ ...current, sponsorName: event.target.value }))} placeholder="Sponsor name" type="text" value={sponsorForm.sponsorName} />
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
            onChange={(event) => setSponsorForm((current) => ({ ...current, fulfillmentType: event.target.value as SponsorFulfillmentCreateInput["fulfillmentType"] }))}
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
          <select onChange={(event) => setSponsorForm((current) => ({ ...current, status: event.target.value as SponsorFulfillmentCreateInput["status"] }))} value={sponsorForm.status}>
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
          <select onChange={(event) => setSponsorForm((current) => ({ ...current, assigneeId: event.target.value }))} value={sponsorForm.assigneeId ?? ""}>
            <option value="">Unassigned</option>
            {staff.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Due Date</span>
          <input onChange={(event) => setSponsorForm((current) => ({ ...current, dueDate: event.target.value }))} type="date" value={sponsorForm.dueDate} />
        </label>
      </div>
      <label>
        <span>Notes</span>
        <textarea onChange={(event) => setSponsorForm((current) => ({ ...current, notes: event.target.value }))} value={sponsorForm.notes} />
      </label>
      <button className="topbar__button" type="submit">
        Add Fulfillment
      </button>
    </form>
  );
}

function RelatedActionForm({
  assigneeCopy,
  draft,
  labelBase,
  onCreate,
  onUpdate,
  staff
}: {
  assigneeCopy: string;
  draft?: ActionDraft;
  labelBase: string;
  onCreate: () => void;
  onUpdate: (updates: Partial<ActionDraft>) => void;
  staff: StaffProfile[];
}) {
  return (
    <div className="amc-related-action-form">
      <input aria-label={`Action title for ${labelBase}`} onChange={(event) => onUpdate({ title: event.target.value })} placeholder="Next action" type="text" value={draft?.title ?? ""} />
      <select aria-label={`Action assignee for ${labelBase}`} onChange={(event) => onUpdate({ assigneeId: event.target.value })} value={draft?.assigneeId ?? ""}>
        <option value="">{assigneeCopy}</option>
        {staff.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.displayName}
          </option>
        ))}
      </select>
      <input aria-label={`Action due date for ${labelBase}`} onChange={(event) => onUpdate({ dueDate: event.target.value })} type="date" value={draft?.dueDate ?? ""} />
      <button className="button-link button-link--inline-secondary" onClick={onCreate} type="button">
        Add Action
      </button>
    </div>
  );
}

function RelatedCollateralForm({
  draft,
  item,
  onCreate,
  onUpdate,
  staff
}: {
  draft?: SponsorCollateralDraft;
  item: SponsorFulfillmentRecord;
  onCreate: () => void;
  onUpdate: (updates: Partial<SponsorCollateralDraft>) => void;
  staff: StaffProfile[];
}) {
  return (
    <div className="amc-related-collateral-form">
      <input
        aria-label={`Collateral title for ${item.fulfillmentTitle}`}
        onChange={(event) => onUpdate({ title: event.target.value })}
        placeholder="Related collateral"
        type="text"
        value={draft?.title ?? ""}
      />
      <select
        aria-label={`Collateral type for ${item.fulfillmentTitle}`}
        onChange={(event) => onUpdate({ collateralType: event.target.value as CollateralItemCreateInput["collateralType"] })}
        value={draft?.collateralType ?? "email"}
      >
        {COLLATERAL_TYPES.map((type) => (
          <option key={type} value={type}>
            {COLLATERAL_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
      <select aria-label={`Collateral assignee for ${item.fulfillmentTitle}`} onChange={(event) => onUpdate({ assigneeId: event.target.value })} value={draft?.assigneeId ?? ""}>
        <option value="">Use fulfillment assignee</option>
        {staff.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.displayName}
          </option>
        ))}
      </select>
      <input aria-label={`Collateral due date for ${item.fulfillmentTitle}`} onChange={(event) => onUpdate({ dueDate: event.target.value })} type="date" value={draft?.dueDate ?? ""} />
      <button className="button-link button-link--inline-secondary" onClick={onCreate} type="button">
        Add Collateral
      </button>
    </div>
  );
}

function SectionCard({
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
      <div className="amc-list">{hasChildren ? children : <EmptySectionState>{emptyCopy}</EmptySectionState>}</div>
    </section>
  );
}

function EmptySectionState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
