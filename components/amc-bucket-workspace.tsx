"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useState } from "react";
import { useAmcLocalState } from "@/components/amc-local-state-provider";
import {
  BucketActionItemsSection,
  BucketAssignedWorkSection,
  BucketCollateralSection,
  BucketEducationSection,
  BucketSpeakersSection,
  BucketSponsorFulfillmentSection,
  BucketWorkspaceSummary
} from "@/components/amc-bucket-workspace-sections";
import {
  createCollateralActionItem,
  createCollateralItem,
  createSponsorFulfillmentActionItem,
  createSponsorFulfillmentCollateralItem,
  createSponsorFulfillmentRecord,
  getBucketWorkspace,
  validateCollateralItemCreateInput,
  validateSponsorFulfillmentCreateInput,
  WORK_BUCKET_KIND_LABELS,
  WORK_BUCKET_STATUS_LABELS,
  type CollateralItem,
  type CollateralItemCreateInput,
  type CollateralItemUpdateInput,
  type SponsorFulfillmentCreateInput,
  type SponsorFulfillmentRecord,
  type SponsorFulfillmentUpdateInput
} from "@/lib/amc-domain";

type ActionDraft = { title: string; assigneeId: string; dueDate: string };
type SponsorCollateralDraft = {
  title: string;
  collateralType: CollateralItemCreateInput["collateralType"];
  assigneeId: string;
  dueDate: string;
  notes: string;
};

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
  const [actionDrafts, setActionDrafts] = useState<Record<string, ActionDraft>>({});
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
  const [sponsorActionDrafts, setSponsorActionDrafts] = useState<Record<string, ActionDraft>>({});
  const [sponsorCollateralDrafts, setSponsorCollateralDrafts] = useState<Record<string, SponsorCollateralDraft>>({});
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

  function updateActionDraft(collateralItemId: string, updates: Partial<ActionDraft>) {
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

  function updateSponsorActionDraft(sponsorFulfillmentId: string, updates: Partial<ActionDraft>) {
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

  function updateSponsorCollateralDraft(sponsorFulfillmentId: string, updates: Partial<SponsorCollateralDraft>) {
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

      <BucketWorkspaceSummary workspace={workspace} />

      <section className="amc-grid">
        <BucketAssignedWorkSection staff={state.staff} workItems={workspace.workItems} />
        <BucketActionItemsSection actionItems={workspace.actionItems} staff={state.staff} />
      </section>

      <section className="amc-grid">
        <BucketCollateralSection
          actionDrafts={actionDrafts}
          actionItems={state.actionItems}
          collateralFeedback={collateralFeedback}
          collateralForm={collateralForm}
          collateralItems={workspace.collateralItems}
          editDrafts={editDrafts}
          editingCollateralId={editingCollateralId}
          handleCollateralSubmit={handleCollateralSubmit}
          handleCollateralUpdate={handleCollateralUpdate}
          handleCreateCollateralAction={handleCreateCollateralAction}
          isAddingCollateral={isAddingCollateral}
          setCollateralForm={setCollateralForm}
          setEditingCollateralId={setEditingCollateralId}
          setIsAddingCollateral={setIsAddingCollateral}
          staff={state.staff}
          startEditingCollateral={startEditingCollateral}
          updateActionDraft={updateActionDraft}
          updateEditDraft={updateEditDraft}
        />
        <BucketEducationSection educationApplications={workspace.educationApplications} staff={state.staff} />
      </section>

      <section className="amc-grid">
        <BucketSpeakersSection speakerEngagements={workspace.speakerEngagements} staff={state.staff} />
        <BucketSponsorFulfillmentSection
          actionItems={state.actionItems}
          collateralItems={state.collateralItems}
          editingSponsorFulfillmentId={editingSponsorFulfillmentId}
          handleCreateSponsorAction={handleCreateSponsorAction}
          handleCreateSponsorCollateral={handleCreateSponsorCollateral}
          handleSponsorFulfillmentSubmit={handleSponsorFulfillmentSubmit}
          handleSponsorFulfillmentUpdate={handleSponsorFulfillmentUpdate}
          isAddingSponsorFulfillment={isAddingSponsorFulfillment}
          setEditingSponsorFulfillmentId={setEditingSponsorFulfillmentId}
          setIsAddingSponsorFulfillment={setIsAddingSponsorFulfillment}
          setSponsorForm={setSponsorForm}
          sponsorActionDrafts={sponsorActionDrafts}
          sponsorCollateralDrafts={sponsorCollateralDrafts}
          sponsorEditDrafts={sponsorEditDrafts}
          sponsorFeedback={sponsorFeedback}
          sponsorForm={sponsorForm}
          sponsorFulfillmentRecords={workspace.sponsorFulfillmentRecords}
          staff={state.staff}
          startEditingSponsorFulfillment={startEditingSponsorFulfillment}
          updateSponsorActionDraft={updateSponsorActionDraft}
          updateSponsorCollateralDraft={updateSponsorCollateralDraft}
          updateSponsorEditDraft={updateSponsorEditDraft}
        />
      </section>
    </div>
  );
}
