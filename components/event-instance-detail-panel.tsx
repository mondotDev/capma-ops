"use client";

import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { UpdateEventInstanceInput, UpsertEventSubEventInput } from "@/components/app-state";
import { sortSubEventsForEventWorkspace } from "@/lib/events/sub-event-ordering";
import type { EventOnboardingSelectedInstance } from "@/lib/events/event-onboarding";
import type { EventSubEventScheduleMode } from "@/lib/event-instances";
import { deriveEventDateRange } from "@/lib/event-instances";
import {
  createSponsorCommitmentDraft,
  createSponsorOpportunityDraft,
  ensureSponsorshipSetupForEventInstance,
  getSponsorCommitmentOpportunityOptions,
  getSponsorPlacementDeliverables,
  getSponsorPlacementLabel,
  type SponsorCommitment,
  type SponsorFulfillmentGenerationResult,
  type SponsorOpportunity,
  type SponsorshipSetup
} from "@/lib/sponsor-fulfillment";

type Props = {
  selectedInstance: EventOnboardingSelectedInstance;
  isActive: boolean;
  actionItemCount: number;
  actionViewHref: string;
  collateralItemCount: number;
  onGenerateSponsorFulfillment: (instanceId: string) => {
    createdActions: number;
    updatedActions: number;
    matchedCollateral: number;
    createdCollateral: number;
    skipped: number;
    obsoleteActions: number;
    obsoleteCollateral: number;
    progressedObsoleteActions: number;
    progressedObsoleteCollateral: number;
  };
  onOpenInAction: (href: string) => void;
  onOpenInCollateral: (instanceId: string) => void;
  onRemoveSubEvent: (instanceId: string, subEventId: string) => boolean;
  onRemoveSponsorCommitment: (instanceId: string, commitmentId: string) => void;
  onRemoveSponsorOpportunity: (instanceId: string, opportunityId: string) => boolean;
  onSetActive: (instanceId: string) => void;
  onUpdateInstance: (instanceId: string, updates: UpdateEventInstanceInput) => boolean;
  onUpsertSponsorCommitment: (instanceId: string, commitment: SponsorCommitment) => void;
  onUpsertSponsorOpportunity: (instanceId: string, opportunity: SponsorOpportunity) => void;
  onUpsertSubEvent: (instanceId: string, input: UpsertEventSubEventInput) => string | null;
  sponsorGenerationPreview: SponsorFulfillmentGenerationResult | null;
  sponsorshipSetup: SponsorshipSetup | null;
};

type DetailsDraft = { name: string; location: string; notes: string; dates: string[] };
type WorkspaceSectionId = (typeof WORKSPACE_SECTIONS)[number]["id"];
type WorkspaceStep = {
  sectionId: WorkspaceSectionId;
  label: string;
  badge: string;
  status: "done" | "next" | "attention";
  copy: string;
};

const WORKSPACE_SECTIONS = [
  { id: "details", label: "Event details" },
  { id: "sub-events", label: "Sub-events" },
  { id: "opportunities", label: "Sponsor opportunities" },
  { id: "commitments", label: "Sponsor commitments" },
  { id: "deliverables", label: "Generated work preview" },
  { id: "collateral", label: "Collateral" },
  { id: "review", label: "Review / execution preview" }
] as const;

export function EventInstanceDetailPanel({
  selectedInstance,
  isActive,
  actionItemCount,
  actionViewHref,
  collateralItemCount,
  onGenerateSponsorFulfillment,
  onOpenInAction,
  onOpenInCollateral,
  onRemoveSubEvent,
  onRemoveSponsorCommitment,
  onRemoveSponsorOpportunity,
  onSetActive,
  onUpdateInstance,
  onUpsertSponsorCommitment,
  onUpsertSponsorOpportunity,
  onUpsertSubEvent,
  sponsorGenerationPreview,
  sponsorshipSetup
}: Props) {
  const { definition, eventFamilyName, fallbackLane, instance, scheduleStatus, scheduledSubEvents } = selectedInstance;
  const supportsSponsorSetup = definition?.supportsSponsorSetup !== false;
  const orderedScheduledSubEvents = useMemo(
    () => sortSubEventsForEventWorkspace(scheduledSubEvents),
    [scheduledSubEvents]
  );
  const resolvedSetup = useMemo(
    () => ensureSponsorshipSetupForEventInstance(instance.id, instance.eventTypeId, sponsorshipSetup),
    [instance.eventTypeId, instance.id, sponsorshipSetup]
  );
  const opportunityOptions = useMemo(() => getSponsorCommitmentOpportunityOptions(resolvedSetup), [resolvedSetup]);
  const subEventOptions = useMemo(
    () =>
      [
        ...orderedScheduledSubEvents.map((subEvent) => ({ id: subEvent.id, label: subEvent.name })),
        ...(fallbackLane ? [{ id: fallbackLane.id, label: fallbackLane.name }] : [])
      ],
    [fallbackLane, orderedScheduledSubEvents]
  );
  const [detailsDraft, setDetailsDraft] = useState<DetailsDraft>(() => createDetailsDraft(instance));
  const [newSubEventDraft, setNewSubEventDraft] = useState<UpsertEventSubEventInput>(createEmptySubEventDraft());
  const [feedback, setFeedback] = useState("");
  const [activeSectionId, setActiveSectionId] = useState<WorkspaceSectionId>("details");

  useEffect(() => setDetailsDraft(createDetailsDraft(instance)), [instance]);
  useEffect(() => setActiveSectionId("details"), [instance.id]);

  const steps = useMemo(
    () => buildSteps(instance.name, instance.startDate, scheduleStatus, resolvedSetup, sponsorGenerationPreview),
    [instance.name, instance.startDate, resolvedSetup, scheduleStatus, sponsorGenerationPreview]
  );
  const previewRows = (sponsorGenerationPreview?.plans ?? []).slice(0, 8);
  const activeStep = steps.find((step) => step.sectionId === activeSectionId) ?? steps[0];

  function saveEventDetails() {
    const cleanedDates = detailsDraft.dates.map((date) => date.trim()).filter(Boolean);
    const nextDates =
      instance.dateMode === "single" ? cleanedDates.slice(0, 1) : instance.dateMode === "range" ? [cleanedDates[0] ?? "", cleanedDates[1] ?? ""] : cleanedDates;
    const nextRange = deriveEventDateRange(instance.dateMode, nextDates);
    const didUpdate = onUpdateInstance(instance.id, {
      instanceName: detailsDraft.name,
      location: detailsDraft.location,
      notes: detailsDraft.notes,
      dates: nextRange.dates
    });
    setFeedback(didUpdate ? "Event details updated." : "Event details need a name and valid date values before they can be saved.");
  }

  function addSubEvent() {
    const nextId = onUpsertSubEvent(instance.id, newSubEventDraft);
    if (!nextId) {
      setFeedback("Sub-event could not be added. Check for a unique name and valid schedule details.");
      return;
    }
    setNewSubEventDraft(createEmptySubEventDraft());
    setFeedback("Sub-event added.");
  }

  function generateSponsorWork() {
    const result = onGenerateSponsorFulfillment(instance.id);
    const staleCount = result.obsoleteActions + result.obsoleteCollateral;
    const progressCount = result.progressedObsoleteActions + result.progressedObsoleteCollateral;
    setFeedback(
      [
        result.createdActions > 0 ? `${result.createdActions} new action item${result.createdActions === 1 ? "" : "s"}` : "",
        result.updatedActions > 0 ? `${result.updatedActions} action item${result.updatedActions === 1 ? "" : "s"} refreshed` : "",
        result.createdCollateral > 0 ? `${result.createdCollateral} fallback collateral item${result.createdCollateral === 1 ? "" : "s"}` : "",
        result.matchedCollateral > 0 ? `${result.matchedCollateral} collateral match${result.matchedCollateral === 1 ? "" : "es"}` : "",
        result.skipped > 0 ? `${result.skipped} skipped duplicate or incomplete row${result.skipped === 1 ? "" : "s"}` : "",
        staleCount > 0 ? `${staleCount} generated item${staleCount === 1 ? "" : "s"} kept for review` : "",
        progressCount > 0 ? `${progressCount} preserved review item${progressCount === 1 ? "" : "s"} already had progress` : ""
      ].filter(Boolean).join(", ") || "No new sponsor work was needed."
    );
  }

  function selectSection(sectionId: WorkspaceSectionId) {
    setActiveSectionId(sectionId);
  }

  return (
    <section className="card card--secondary events-workspace" aria-label="Event workspace">
      <div className="events-workspace__header">
        <div>
          <div className="events-workspace__eyebrow">Event Workspace</div>
          <h2 className="collateral-page__title">{instance.name}</h2>
          <div className="events-detail-card__meta">
            <span>{eventFamilyName}</span>
            <span>{definition?.label ?? instance.eventTypeId}</span>
            <span>{instance.startDate}</span>
            {instance.location ? <span>{instance.location}</span> : null}
            <span>{scheduleStatus === "scheduled" ? "Schedule confirmed" : scheduleStatus === "partial" ? "Schedule in progress" : "Schedule still needed"}</span>
          </div>
        </div>
        <div className="events-detail-card__actions">
          <button className={isActive ? "button-link button-link--inline-secondary" : "topbar__button"} onClick={() => onSetActive(instance.id)} type="button">
            {isActive ? "Active Event" : "Make Active"}
          </button>
          <button className="button-link button-link--inline-secondary" onClick={() => onOpenInCollateral(instance.id)} type="button">
            Open in Collateral
          </button>
          <button className="button-link button-link--inline-secondary" onClick={() => onOpenInAction(actionViewHref)} type="button">
            Open in Action View
          </button>
        </div>
      </div>

      {feedback ? (
        <div className="collateral-setup-banner" role="status">
          <span>{feedback}</span>
          <button className="button-link button-link--inline-secondary" onClick={() => setFeedback("")} type="button">Dismiss</button>
        </div>
      ) : null}

      <div className="events-workspace__compact-summary">
        <Stat value={resolvedSetup.opportunities.length} label="Opportunities" />
        <Stat value={resolvedSetup.commitments.length} label="Commitments" />
        <Stat value={actionItemCount} label="Action items" />
        <Stat value={collateralItemCount} label="Collateral items" />
      </div>

      <div className={`events-workspace__shell${activeSectionId === "sub-events" ? " events-workspace__shell--sub-events" : ""}`}>
        <nav className="events-workspace__primary-nav" aria-label="Event workspace sections">
          {steps.map((step) => (
            <button
              className={`events-workspace__nav-item${activeSectionId === step.sectionId ? " events-workspace__nav-item--active" : ""}`}
              key={step.sectionId}
              onClick={() => selectSection(step.sectionId)}
              type="button"
            >
              <div className="events-workspace__nav-item-top">
                <strong>{step.label}</strong>
                <span className={`events-chip${activeSectionId === step.sectionId ? " events-chip--workspace-active" : ""}`}>{step.badge}</span>
              </div>
              <div className="events-workspace__nav-copy">{step.copy}</div>
            </button>
          ))}
        </nav>

        <section className={`events-workspace__content${activeSectionId === "sub-events" ? " events-workspace__content--sub-events" : ""}`} aria-label={activeStep?.label ?? "Event workspace section"}>
          <div className="events-workspace__section-header">
            <div>
              <div className="events-workspace__section-eyebrow">Selected Section</div>
              <h3 className="events-workspace__section-title">{activeStep?.label ?? "Event workspace section"}</h3>
              <div className="events-detail-card__meta">
                <span>{instance.name}</span>
                <span>{formatWorkspaceDateRange(instance.startDate, instance.endDate)}</span>
                {instance.location ? <span>{instance.location}</span> : null}
              </div>
            </div>
          </div>
          {activeSectionId === "details" ? (
            <EventDetailsSection detailsDraft={detailsDraft} instance={instance} onSave={saveEventDetails} setDetailsDraft={setDetailsDraft} />
          ) : null}
          {activeSectionId === "sub-events" ? (
            <SubEventsSection
              fallbackLane={fallbackLane}
              instanceId={instance.id}
              newSubEventDraft={newSubEventDraft}
              onAdd={addSubEvent}
              onChangeDraft={setNewSubEventDraft}
              onRemoveWithFeedback={(subEventId) => setFeedback(onRemoveSubEvent(instance.id, subEventId) ? "Sub-event removed." : "That sub-event is already in use, so it was kept in place.")}
              onUpsert={onUpsertSubEvent}
              scheduledSubEvents={orderedScheduledSubEvents}
            />
          ) : null}
          {activeSectionId === "opportunities" ? (
            <SponsorOpportunitiesSection
              eventTypeId={instance.eventTypeId}
              onAdd={() => {
                onUpsertSponsorOpportunity(instance.id, createSponsorOpportunityDraft(instance.id, instance.eventTypeId));
                setFeedback("Sponsor opportunity added.");
              }}
              onRemove={(opportunityId) =>
                setFeedback(onRemoveSponsorOpportunity(instance.id, opportunityId) ? "Sponsor opportunity removed." : "That opportunity still has commitments attached, so it was kept.")
              }
              onUpsert={(opportunity) => onUpsertSponsorOpportunity(instance.id, opportunity)}
              opportunities={resolvedSetup.opportunities}
              subEventOptions={subEventOptions}
              supportsSponsorSetup={supportsSponsorSetup}
            />
          ) : null}
          {activeSectionId === "commitments" ? (
            <SponsorCommitmentsSection
              commitments={resolvedSetup.commitments}
              eventTypeId={instance.eventTypeId}
              onAdd={() => {
                onUpsertSponsorCommitment(instance.id, createSponsorCommitmentDraft(instance.id, resolvedSetup));
                setFeedback("Sponsor commitment added.");
              }}
              onRemove={(commitmentId) => {
                onRemoveSponsorCommitment(instance.id, commitmentId);
                setFeedback("Sponsor commitment removed.");
              }}
              onUpsert={(commitment) => onUpsertSponsorCommitment(instance.id, commitment)}
              opportunities={resolvedSetup.opportunities}
              opportunityOptions={opportunityOptions}
              subEventOptions={subEventOptions}
              supportsSponsorSetup={supportsSponsorSetup}
            />
          ) : null}
          {activeSectionId === "deliverables" ? (
            <DeliverablesSection onGenerate={generateSponsorWork} previewRows={previewRows} sponsorGenerationPreview={sponsorGenerationPreview} supportsSponsorSetup={supportsSponsorSetup} />
          ) : null}
          {activeSectionId === "collateral" ? (
            <CollateralSection collateralItemCount={collateralItemCount} onOpenInCollateral={() => onOpenInCollateral(instance.id)} sponsorGenerationPreview={sponsorGenerationPreview} />
          ) : null}
          {activeSectionId === "review" ? (
            <ReviewSection actionItemCount={actionItemCount} actionViewHref={actionViewHref} onOpenInAction={onOpenInAction} sponsorGenerationPreview={sponsorGenerationPreview} />
          ) : null}
        </section>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="events-workspace__stat"><strong>{value}</strong><span>{label}</span></div>;
}

function createDetailsDraft(instance: EventOnboardingSelectedInstance["instance"]): DetailsDraft {
  return {
    name: instance.name,
    location: instance.location ?? "",
    notes: instance.notes ?? "",
    dates: instance.dateMode === "single" ? [instance.startDate] : instance.dateMode === "range" ? [instance.startDate, instance.endDate] : instance.dates.length > 0 ? [...instance.dates] : [instance.startDate, instance.endDate].filter(Boolean)
  };
}

function buildSteps(name: string, startDate: string, scheduleStatus: EventOnboardingSelectedInstance["scheduleStatus"], setup: SponsorshipSetup, preview: SponsorFulfillmentGenerationResult | null): WorkspaceStep[] {
  const hasPreview = (preview?.plans.length ?? 0) > 0;
  const hasReview = (preview?.obsoleteActionItems.length ?? 0) + (preview?.obsoleteCollateralItems.length ?? 0) > 0;
  return [
    { sectionId: "details", label: "Event details", badge: name.trim() && startDate ? "Ready" : "Needs attention", status: name.trim() && startDate ? "done" : "attention", copy: name.trim() && startDate ? "Core details are in place and stay editable." : "Start by confirming the event name, dates, and location." },
    { sectionId: "sub-events", label: "Sub-events", badge: scheduleStatus === "scheduled" ? "Ready" : "Next", status: scheduleStatus === "scheduled" ? "done" : "next", copy: scheduleStatus === "scheduled" ? "Sub-event scheduling is ready for downstream work." : "Confirm dates and times so downstream work lands in the right places." },
    { sectionId: "opportunities", label: "Sponsor opportunities", badge: setup.opportunities.length > 0 ? "Ready" : "Next", status: setup.opportunities.length > 0 ? "done" : "next", copy: setup.opportunities.length > 0 ? `${setup.opportunities.length} opportunity row${setup.opportunities.length === 1 ? "" : "s"} currently define this event's sponsor setup.` : "Add the event-specific sponsor opportunities Melissa is actually working from." },
    { sectionId: "commitments", label: "Sponsor commitments", badge: setup.commitments.length > 0 ? "Ready" : "Next", status: setup.commitments.length > 0 ? "done" : "next", copy: setup.commitments.length > 0 ? `${setup.commitments.length} commitment${setup.commitments.length === 1 ? "" : "s"} can drive downstream work.` : "Add commitments progressively as sponsors close." },
    { sectionId: "deliverables", label: "Generated work review", badge: hasReview ? "Review" : hasPreview ? "Ready" : "Next", status: hasReview ? "attention" : hasPreview ? "done" : "next", copy: hasReview ? "Some prior generated work is being preserved for review instead of deleted." : hasPreview ? "A sponsor-driven preview is ready for reconciliation." : "Once sponsor setup is in place, review what will flow into Action View and Collateral." }
  ];
}

function getReviewCalloutText(preview: SponsorFulfillmentGenerationResult | null) {
  if (!preview) {
    return "No sponsor generation preview is available yet.";
  }
  const obsoleteCount = preview.obsoleteActionItems.length + preview.obsoleteCollateralItems.length;
  const progressCount = preview.obsoleteActionItems.filter((item) => item.hasMeaningfulProgress).length + preview.obsoleteCollateralItems.filter((item) => item.hasMeaningfulProgress).length;
  if (obsoleteCount === 0) {
    return "No stale generated sponsor work is currently waiting for review.";
  }
  return progressCount === 0 ? `${obsoleteCount} generated item${obsoleteCount === 1 ? "" : "s"} would be preserved for review.` : `${obsoleteCount} generated item${obsoleteCount === 1 ? "" : "s"} would be preserved for review, including ${progressCount} item${progressCount === 1 ? "" : "s"} that already have progress.`;
}

function EventDetailsSection(input: {
  detailsDraft: DetailsDraft;
  instance: EventOnboardingSelectedInstance["instance"];
  onSave: () => void;
  setDetailsDraft: Dispatch<SetStateAction<DetailsDraft>>;
}) {
  return (
    <section className="events-detail-card__section" id="event-workspace-details">
      <div className="events-detail-card__section-title">Event Details</div>
      <div className="events-workspace__grid events-workspace__grid--details">
        <Field label="Event name">
          <input className="field-control" onChange={(event) => input.setDetailsDraft((current) => ({ ...current, name: event.target.value }))} value={input.detailsDraft.name} />
        </Field>
        <Field label="Location">
          <input className="field-control" onChange={(event) => input.setDetailsDraft((current) => ({ ...current, location: event.target.value }))} value={input.detailsDraft.location} />
        </Field>
        {input.detailsDraft.dates.map((dateValue, index) => (
          <Field key={index} label={getDateLabel(input.instance.dateMode, index)}>
            <input
              className="field-control"
              onChange={(event) =>
                input.setDetailsDraft((current) => ({
                  ...current,
                  dates: current.dates.map((entry, entryIndex) => (entryIndex === index ? event.target.value : entry))
                }))
              }
              type="date"
              value={dateValue}
            />
          </Field>
        ))}
        {input.instance.dateMode === "multiple" ? (
          <button className="button-link button-link--inline-secondary" onClick={() => input.setDetailsDraft((current) => ({ ...current, dates: [...current.dates, ""] }))} type="button">
            Add date
          </button>
        ) : null}
        <Field label="Notes" wide>
          <textarea className="field-control" onChange={(event) => input.setDetailsDraft((current) => ({ ...current, notes: event.target.value }))} value={input.detailsDraft.notes} />
        </Field>
      </div>
      <div className="events-detail-card__actions">
        <button className="topbar__button" onClick={input.onSave} type="button">Save Event Details</button>
      </div>
    </section>
  );
}

function SubEventsSection(input: {
  fallbackLane: EventOnboardingSelectedInstance["fallbackLane"];
  instanceId: string;
  newSubEventDraft: UpsertEventSubEventInput;
  onAdd: () => void;
  onChangeDraft: Dispatch<SetStateAction<UpsertEventSubEventInput>>;
  onRemoveWithFeedback: (subEventId: string) => void;
  onUpsert: (instanceId: string, upsert: UpsertEventSubEventInput) => string | null;
  scheduledSubEvents: EventOnboardingSelectedInstance["scheduledSubEvents"];
}) {
  const [pendingRemovalSubEvent, setPendingRemovalSubEvent] = useState<EventOnboardingSelectedInstance["scheduledSubEvents"][number] | null>(null);
  const linkedItemCount =
    (pendingRemovalSubEvent?.actionUsageCount ?? 0) + (pendingRemovalSubEvent?.collateralUsageCount ?? 0);

  return (
    <section className="events-detail-card__section" id="event-workspace-sub-events">
      <div className="events-detail-card__header">
        <div>
          <div className="events-detail-card__section-title">Sub-Events</div>
          <div className="events-selector-card__copy">Keep the schedule revisitable here rather than pushing setup back into downstream surfaces.</div>
        </div>
      </div>
      <div className="events-sub-events">
        {input.scheduledSubEvents.map((subEvent) => (
          <div className="events-sub-events__row" key={subEvent.id}>
            <div className="events-sub-events__main">
              <div className="events-sub-events__header">
                <div className="events-sub-events__name-field">
                  <Field label="Name">
                    <input className="field-control" onChange={(event) => input.onUpsert(input.instanceId, { id: subEvent.id, name: event.target.value, sortOrder: subEvent.sortOrder, date: subEvent.date, startTime: subEvent.startTime, endTime: subEvent.endTime })} value={subEvent.name} />
                  </Field>
                </div>
                <div className="events-sub-events__actions">
                  <button
                    className="button-link button-link--inline-secondary"
                    onClick={() => setPendingRemovalSubEvent(subEvent)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <div className="events-sub-events__schedule-wrap">
                <div className="events-sub-events__schedule-top">
                  <div className="events-sub-events__schedule-label">Schedule</div>
                  <Field label="Mode">
                    <select
                      className="field-control"
                      onChange={(event) =>
                        input.onUpsert(input.instanceId, buildSubEventUpsertPayload(subEvent, { scheduleMode: event.target.value as EventSubEventScheduleMode }))
                      }
                      value={subEvent.scheduleMode}
                    >
                      <option value="timed">Timed</option>
                      <option value="all_day">All day</option>
                      <option value="multi_day">Multi-day</option>
                    </select>
                  </Field>
                </div>
                <SubEventScheduleFields
                  draft={{
                    scheduleMode: subEvent.scheduleMode,
                    date: subEvent.date,
                    endDate: subEvent.endDate,
                    startTime: subEvent.startTime,
                    endTime: subEvent.endTime
                  }}
                  onChange={(updates) => input.onUpsert(input.instanceId, buildSubEventUpsertPayload(subEvent, updates))}
                />
              </div>
              <div className="events-sub-events__meta">
                <span>{getSubEventModeLabel(subEvent.scheduleMode ?? "timed")}</span>
                <span>{subEvent.actionUsageCount} action link{subEvent.actionUsageCount === 1 ? "" : "s"}</span>
                <span>{subEvent.collateralUsageCount} collateral link{subEvent.collateralUsageCount === 1 ? "" : "s"}</span>
                {subEvent.isDefault ? <span>Starter sub-event</span> : null}
              </div>
            </div>
            {subEvent.removeBlockReason ? <div className="events-sub-events__helper field-hint">{subEvent.removeBlockReason}</div> : null}
          </div>
        ))}
        {input.fallbackLane ? (
          <div className="events-fallback-lane">
            <div className="events-fallback-lane__header">
              <strong>{input.fallbackLane.name}</strong>
              <span className="events-chip">Fallback lane</span>
            </div>
            <div className="field-hint">{input.fallbackLane.actionUsageCount} action links and {input.fallbackLane.collateralUsageCount} collateral links currently land here.</div>
            {input.fallbackLane.removeBlockReason ? <div className="field-hint">{input.fallbackLane.removeBlockReason}</div> : null}
          </div>
        ) : null}
        <div className="events-sub-events__row events-sub-events__row--draft">
          <div className="events-sub-events__header">
            <div className="events-sub-events__name-field">
              <Field label="Add sub-event">
                <input className="field-control" onChange={(event) => input.onChangeDraft((current) => ({ ...current, name: event.target.value }))} value={input.newSubEventDraft.name ?? ""} />
              </Field>
            </div>
          </div>
          <div className="events-sub-events__schedule-wrap">
            <div className="events-sub-events__schedule-top">
              <div className="events-sub-events__schedule-label">Schedule</div>
              <Field label="Mode">
                <select className="field-control" onChange={(event) => input.onChangeDraft((current) => applySubEventScheduleMode(current, event.target.value as EventSubEventScheduleMode))} value={input.newSubEventDraft.scheduleMode ?? "timed"}>
                  <option value="timed">Timed</option>
                  <option value="all_day">All day</option>
                  <option value="multi_day">Multi-day</option>
                </select>
              </Field>
            </div>
            <SubEventScheduleFields draft={input.newSubEventDraft} onChange={(updates) => input.onChangeDraft((current) => ({ ...current, ...updates }))} />
          </div>
          <div className="events-detail-card__actions">
            <button className="button-link button-link--inline-secondary" onClick={input.onAdd} type="button">Add Sub-Event</button>
          </div>
        </div>
      </div>
      {pendingRemovalSubEvent ? (
        <div className="modal-layer" role="presentation">
          <button
            aria-label="Cancel sub-event removal"
            className="modal-backdrop"
            onClick={() => setPendingRemovalSubEvent(null)}
            type="button"
          />
          <section
            aria-labelledby="sub-event-remove-title"
            aria-modal="true"
            className="quick-add-modal"
            role="dialog"
          >
            <div className="quick-add-modal__header">
              <div>
                <h2 className="quick-add-modal__title" id="sub-event-remove-title">
                  Remove {pendingRemovalSubEvent.name}?
                </h2>
                <p className="quick-add-modal__subtitle">
                  This is a destructive change to the event setup and cannot be triggered with one click anymore.
                </p>
              </div>
            </div>
            <div className={`confirm-delete${linkedItemCount > 0 ? "" : " confirm-delete--neutral"}`}>
              <div className="confirm-delete__title">
                {linkedItemCount > 0 ? "This sub-event has downstream links." : "Confirm sub-event removal."}
              </div>
              <div className="confirm-delete__copy">
                <strong>{pendingRemovalSubEvent.name}</strong> will be removed from this event instance.
                {linkedItemCount > 0
                  ? ` It currently has ${pendingRemovalSubEvent.actionUsageCount} action link${pendingRemovalSubEvent.actionUsageCount === 1 ? "" : "s"} and ${pendingRemovalSubEvent.collateralUsageCount} collateral link${pendingRemovalSubEvent.collateralUsageCount === 1 ? "" : "s"}.`
                  : " No downstream links are currently attached."}
                {pendingRemovalSubEvent.removeBlockReason ? ` ${pendingRemovalSubEvent.removeBlockReason}` : ""}
              </div>
              <div className="confirm-delete__actions">
                <button className="button-link button-link--inline-secondary" onClick={() => setPendingRemovalSubEvent(null)} type="button">
                  Cancel
                </button>
                <button
                  className="button-danger"
                  onClick={() => {
                    input.onRemoveWithFeedback(pendingRemovalSubEvent.id);
                    setPendingRemovalSubEvent(null);
                  }}
                  type="button"
                >
                  Remove Sub-Event
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function SubEventScheduleFields(input: {
  draft: Pick<UpsertEventSubEventInput, "scheduleMode" | "date" | "endDate" | "startTime" | "endTime">;
  onChange: (updates: Partial<UpsertEventSubEventInput>) => void;
}) {
  const scheduleMode = input.draft.scheduleMode ?? "timed";

  if (scheduleMode === "multi_day") {
    return (
      <div className="events-sub-events__schedule events-sub-events__schedule--multi-day">
        <Field label="Start date">
          <input className="field-control" onChange={(event) => input.onChange({ date: event.target.value })} type="date" value={input.draft.date ?? ""} />
        </Field>
        <Field label="End date">
          <input className="field-control" onChange={(event) => input.onChange({ endDate: event.target.value })} type="date" value={input.draft.endDate ?? ""} />
        </Field>
      </div>
    );
  }

  if (scheduleMode === "all_day") {
    return (
      <div className="events-sub-events__schedule events-sub-events__schedule--all-day">
        <Field label="Date">
          <input className="field-control" onChange={(event) => input.onChange({ date: event.target.value })} type="date" value={input.draft.date ?? ""} />
        </Field>
      </div>
    );
  }

  return (
    <div className="events-sub-events__schedule">
      <Field label="Date">
        <input className="field-control" onChange={(event) => input.onChange({ date: event.target.value })} type="date" value={input.draft.date ?? ""} />
      </Field>
      <Field label="Start">
        <input className="field-control" onChange={(event) => input.onChange({ startTime: event.target.value })} type="time" value={input.draft.startTime ?? ""} />
      </Field>
      <Field label="End">
        <input className="field-control" onChange={(event) => input.onChange({ endTime: event.target.value })} type="time" value={input.draft.endTime ?? ""} />
      </Field>
    </div>
  );
}

function buildSubEventUpsertPayload(
  subEvent: EventOnboardingSelectedInstance["scheduledSubEvents"][number],
  updates: Partial<UpsertEventSubEventInput>
): UpsertEventSubEventInput {
  return {
    id: subEvent.id,
    name: updates.name ?? subEvent.name,
    sortOrder: updates.sortOrder ?? subEvent.sortOrder,
    scheduleMode: updates.scheduleMode ?? subEvent.scheduleMode,
    date: updates.date ?? subEvent.date,
    endDate: updates.endDate ?? subEvent.endDate,
    startTime: updates.startTime ?? subEvent.startTime,
    endTime: updates.endTime ?? subEvent.endTime
  };
}

function applySubEventScheduleMode(
  draft: UpsertEventSubEventInput,
  scheduleMode: EventSubEventScheduleMode
): UpsertEventSubEventInput {
  if (scheduleMode === "multi_day") {
    return {
      ...draft,
      scheduleMode,
      endDate: draft.endDate ?? draft.date ?? "",
      startTime: "",
      endTime: ""
    };
  }

  if (scheduleMode === "all_day") {
    return {
      ...draft,
      scheduleMode,
      endDate: "",
      startTime: "",
      endTime: ""
    };
  }

  return {
    ...draft,
    scheduleMode,
    endDate: ""
  };
}

function createEmptySubEventDraft(): UpsertEventSubEventInput {
  return {
    name: "",
    scheduleMode: "timed",
    date: "",
    endDate: "",
    startTime: "",
    endTime: ""
  };
}

function getSubEventModeLabel(scheduleMode: EventSubEventScheduleMode) {
  if (scheduleMode === "multi_day") {
    return "Multi-day";
  }

  if (scheduleMode === "all_day") {
    return "All day";
  }

  return "Timed";
}

function formatWorkspaceDateRange(startDate: string, endDate: string) {
  if (!startDate) {
    return "Dates not set";
  }

  if (!endDate || startDate === endDate) {
    return startDate;
  }

  return `${startDate} - ${endDate}`;
}

function SponsorOpportunitiesSection(input: {
  eventTypeId: string;
  onAdd: () => void;
  onRemove: (opportunityId: string) => void;
  onUpsert: (opportunity: SponsorOpportunity) => void;
  opportunities: SponsorOpportunity[];
  subEventOptions: Array<{ id: string; label: string }>;
  supportsSponsorSetup: boolean;
}) {
  const placementOptions = useMemo(
    () => Array.from(new Set(input.opportunities.map((opportunity) => opportunity.placementType))),
    [input.opportunities]
  );
  return (
    <section className="events-detail-card__section" id="event-workspace-opportunities">
      <div className="events-detail-card__header">
        <div>
          <div className="events-detail-card__section-title">Sponsor Opportunities</div>
          <div className="events-selector-card__copy">The event instance owns this list now. Keep it current as opportunities are added, changed, or paused.</div>
        </div>
        {input.supportsSponsorSetup ? <button className="button-link button-link--inline-secondary" onClick={input.onAdd} type="button">Add Opportunity</button> : null}
      </div>
      {!input.supportsSponsorSetup ? <div className="events-detail-card__empty">This event type does not currently use sponsor setup.</div> : input.opportunities.length === 0 ? <div className="events-detail-card__empty">No sponsor opportunities yet.</div> : (
        <div className="events-workspace__list">
          {input.opportunities.map((opportunity) => (
            <div className="events-workspace__list-row" key={opportunity.id}>
              <div className="events-workspace__grid events-workspace__grid--sponsor">
                <Field label="Opportunity label">
                  <input className="field-control" onChange={(event) => input.onUpsert({ ...opportunity, label: event.target.value })} value={opportunity.label} />
                </Field>
                <Field label="Placement type">
                  <select className="field-control" onChange={(event) => input.onUpsert({ ...opportunity, placementType: event.target.value, label: opportunity.label || getSponsorPlacementLabel(event.target.value, input.eventTypeId) })} value={opportunity.placementType}>
                    {placementOptions.map((placementType) => <option key={placementType} value={placementType}>{getSponsorPlacementLabel(placementType, input.eventTypeId)}</option>)}
                  </select>
                </Field>
                <Field label="Linked sub-event">
                  <select className="field-control" onChange={(event) => input.onUpsert({ ...opportunity, linkedSubEventId: event.target.value || undefined })} value={opportunity.linkedSubEventId ?? ""}>
                    <option value="">No sub-event link</option>
                    {input.subEventOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </Field>
                <label className="events-workspace__toggle"><input checked={opportunity.isActive !== false} onChange={(event) => input.onUpsert({ ...opportunity, isActive: event.target.checked })} type="checkbox" />Active opportunity</label>
                <Field label="Notes" wide>
                  <textarea className="field-control" onChange={(event) => input.onUpsert({ ...opportunity, notes: event.target.value })} value={opportunity.notes ?? ""} />
                </Field>
              </div>
              <div className="events-detail-card__actions">
                <div className="field-hint">{getSponsorPlacementDeliverables(opportunity.placementType, input.eventTypeId).length} deliverable rule{getSponsorPlacementDeliverables(opportunity.placementType, input.eventTypeId).length === 1 ? "" : "s"} flow from this type.</div>
                <button className="button-link button-link--inline-secondary" onClick={() => input.onRemove(opportunity.id)} type="button">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SponsorCommitmentsSection(input: {
  commitments: SponsorCommitment[];
  eventTypeId: string;
  onAdd: () => void;
  onRemove: (commitmentId: string) => void;
  onUpsert: (commitment: SponsorCommitment) => void;
  opportunities: SponsorOpportunity[];
  opportunityOptions: Array<{ id: string; label: string }>;
  subEventOptions: Array<{ id: string; label: string }>;
  supportsSponsorSetup: boolean;
}) {
  const [expandedDeliverablesByCommitment, setExpandedDeliverablesByCommitment] = useState<Record<string, boolean>>({});
  const totalDerivedDeliverables = input.commitments.reduce((total, commitment) => {
    const selectedOpportunity = input.opportunities.find((opportunity) => opportunity.id === commitment.opportunityId) ?? null;
    return total + (selectedOpportunity ? getSponsorPlacementDeliverables(selectedOpportunity.placementType, input.eventTypeId).length : 0);
  }, 0);
  const commitmentsMissingLogo = input.commitments.filter((commitment) => !commitment.logoReceived).length;

  return (
    <section className="events-detail-card__section" id="event-workspace-commitments">
      <div className="events-detail-card__header">
        <div>
          <div className="events-detail-card__section-title">Sponsor Commitments</div>
          <div className="events-selector-card__copy">Add sponsors as they close. Late additions should only create newly needed downstream work.</div>
        </div>
        {input.supportsSponsorSetup ? <button className="button-link button-link--inline-secondary" disabled={input.opportunityOptions.length === 0} onClick={input.onAdd} type="button">Add Commitment</button> : null}
      </div>
      {!input.supportsSponsorSetup ? <div className="events-detail-card__empty">This event type does not currently use sponsor commitments.</div> : input.commitments.length === 0 ? <div className="events-detail-card__empty">No sponsor commitments yet.</div> : (
        <div className="events-workspace__list">
          <div className="events-workspace__stat-grid">
            <Stat label="Total commitments" value={input.commitments.length} />
            <Stat label="Derived deliverables" value={totalDerivedDeliverables} />
            <Stat label="Missing logo" value={commitmentsMissingLogo} />
          </div>
          {input.commitments.map((commitment) => {
            const selectedOpportunity = input.opportunities.find((opportunity) => opportunity.id === commitment.opportunityId) ?? null;
            const derivedDeliverables = selectedOpportunity
              ? getSponsorPlacementDeliverables(selectedOpportunity.placementType, input.eventTypeId)
              : [];
            const deliverableCount = derivedDeliverables.length;
            const isExpanded = expandedDeliverablesByCommitment[commitment.id] ?? false;
            return (
              <div className="events-workspace__list-row" key={commitment.id}>
                <div className="events-detail-card__header">
                  <div>
                    <strong>{commitment.sponsorName.trim() || "New sponsor commitment"}</strong>
                    <div className="field-hint">
                      {selectedOpportunity ? selectedOpportunity.label : "Choose an opportunity to make downstream deliverables explicit."}
                    </div>
                  </div>
                  <button className="button-link button-link--inline-secondary" onClick={() => input.onRemove(commitment.id)} type="button">Remove</button>
                </div>
                <div className="events-workspace__grid events-workspace__grid--sponsor">
                  <Field label="Sponsor">
                    <input className="field-control" onChange={(event) => input.onUpsert({ ...commitment, sponsorName: event.target.value })} value={commitment.sponsorName} />
                  </Field>
                  <Field label="Opportunity">
                    <select className="field-control" onChange={(event) => input.onUpsert({ ...commitment, opportunityId: event.target.value, placement: input.opportunities.find((opportunity) => opportunity.id === event.target.value)?.placementType })} value={commitment.opportunityId}>
                      <option value="">Select an opportunity</option>
                      {input.opportunityOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Sub-event override">
                    <select className="field-control" onChange={(event) => input.onUpsert({ ...commitment, linkedSubEventId: event.target.value || undefined })} value={commitment.linkedSubEventId ?? ""}>
                      <option value="">Use opportunity default</option>
                      {input.subEventOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                  </Field>
                  <label className="events-workspace__toggle"><input checked={commitment.logoReceived} onChange={(event) => input.onUpsert({ ...commitment, logoReceived: event.target.checked })} type="checkbox" />Logo received</label>
                  <label className="events-workspace__toggle"><input checked={commitment.isActive !== false} onChange={(event) => input.onUpsert({ ...commitment, isActive: event.target.checked })} type="checkbox" />Active commitment</label>
                  <Field label="Notes" wide>
                    <textarea className="field-control" onChange={(event) => input.onUpsert({ ...commitment, notes: event.target.value })} value={commitment.notes ?? ""} />
                  </Field>
                </div>
                <div className="events-detail-card__actions">
                  <div className="field-hint">{selectedOpportunity ? `${deliverableCount} deliverable rule${deliverableCount === 1 ? "" : "s"} will reconcile from this commitment.` : "Choose an opportunity to make downstream deliverables explicit."}</div>
                  {deliverableCount > 0 ? (
                    <button
                      className="button-link button-link--inline-secondary"
                      onClick={() =>
                        setExpandedDeliverablesByCommitment((current) => ({
                          ...current,
                          [commitment.id]: !isExpanded
                        }))
                      }
                      type="button"
                    >
                      {isExpanded ? "Hide deliverables" : `Show deliverables (${deliverableCount})`}
                    </button>
                  ) : null}
                </div>
                {isExpanded && deliverableCount > 0 ? (
                  <div className="events-workspace__list">
                    {derivedDeliverables.map((deliverable) => (
                      <div className="events-workspace__preview-row" key={`${commitment.id}-${deliverable.deliverableName}`}>
                        <div>
                          <strong>{deliverable.deliverableName}</strong>
                          {deliverable.subEventName ? <div className="field-hint">Sub-event: {deliverable.subEventName}</div> : null}
                        </div>
                        <span className="events-chip">Derived</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DeliverablesSection(input: {
  onGenerate: () => void;
  previewRows: SponsorFulfillmentGenerationResult["plans"];
  sponsorGenerationPreview: SponsorFulfillmentGenerationResult | null;
  supportsSponsorSetup: boolean;
}) {
  return (
    <section className="events-detail-card__section" id="event-workspace-deliverables">
      <div className="events-detail-card__header">
        <div>
          <div className="events-detail-card__section-title">Deliverables / Generated Work Preview</div>
          <div className="events-selector-card__copy">This preview reads the event-owned sponsorship setup and shows what would be created, reused, or kept for review.</div>
        </div>
        {input.supportsSponsorSetup ? <button className="topbar__button" onClick={input.onGenerate} type="button">Reconcile Sponsor Work</button> : null}
      </div>
      {!input.sponsorGenerationPreview || input.previewRows.length === 0 ? <div className="events-detail-card__empty">No sponsor-driven deliverables are currently previewed for this event.</div> : (
        <>
          <div className="events-workspace__stat-grid">
            <Stat label="New actions" value={input.sponsorGenerationPreview.created.length} />
            <Stat label="Existing actions reused" value={input.sponsorGenerationPreview.plans.filter((plan) => plan.existingActionItemId).length} />
            <Stat label="Collateral matches" value={input.sponsorGenerationPreview.matchedExistingCollateralCount} />
            <Stat label="Fallback collateral" value={input.sponsorGenerationPreview.fallbackCollateralToCreate.length} />
          </div>
          <div className="events-workspace__preview-list">
            {input.previewRows.map((plan) => (
              <div className="events-workspace__preview-row" key={`${plan.sourceKey}-${plan.existingActionItemId ?? "new"}`}>
                <div>
                  <strong>{plan.actionItem.title}</strong>
                  {(plan.collateralLink?.collateralItemName ?? plan.fallbackCollateral?.itemName) ? <div className="field-hint">Collateral: {plan.collateralLink?.collateralItemName ?? plan.fallbackCollateral?.itemName}</div> : null}
                </div>
                <span className="events-chip">{plan.existingActionItemId ? "Already in Action View" : "Will be created"}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function CollateralSection(input: {
  collateralItemCount: number;
  onOpenInCollateral: () => void;
  sponsorGenerationPreview: SponsorFulfillmentGenerationResult | null;
}) {
  return (
    <section className="events-detail-card__section" id="event-workspace-collateral">
      <div className="events-detail-card__header">
        <div>
          <div className="events-detail-card__section-title">Collateral</div>
          <div className="events-selector-card__copy">Collateral remains the downstream production workspace. This section only shows the impact of current setup.</div>
        </div>
        <button className="button-link button-link--inline-secondary" onClick={input.onOpenInCollateral} type="button">Open Collateral Workspace</button>
      </div>
      <div className="events-workspace__stat-grid">
        <Stat label="Current collateral items" value={input.collateralItemCount} />
        <Stat label="Will match existing" value={input.sponsorGenerationPreview?.matchedExistingCollateralCount ?? 0} />
        <Stat label="Fallback collateral to create" value={input.sponsorGenerationPreview?.fallbackCollateralToCreate.length ?? 0} />
      </div>
    </section>
  );
}

function ReviewSection(input: {
  actionItemCount: number;
  actionViewHref: string;
  onOpenInAction: (href: string) => void;
  sponsorGenerationPreview: SponsorFulfillmentGenerationResult | null;
}) {
  const progressedCount = (input.sponsorGenerationPreview?.obsoleteActionItems.filter((item) => item.hasMeaningfulProgress).length ?? 0) + (input.sponsorGenerationPreview?.obsoleteCollateralItems.filter((item) => item.hasMeaningfulProgress).length ?? 0);
  return (
    <section className="events-detail-card__section" id="event-workspace-review">
      <div className="events-detail-card__header">
        <div>
          <div className="events-detail-card__section-title">Review / Execution Preview</div>
          <div className="events-selector-card__copy">Action View remains the execution cockpit. This section makes the handoff and review state easier to understand before Melissa leaves setup.</div>
        </div>
        <button className="button-link button-link--inline-secondary" onClick={() => input.onOpenInAction(input.actionViewHref)} type="button">Open Action View</button>
      </div>
      <div className="events-workspace__review-callout">{getReviewCalloutText(input.sponsorGenerationPreview)}</div>
      <div className="events-workspace__review-grid">
        <Stat label="Current action items" value={input.actionItemCount} />
        <Stat label="Generated actions kept for review" value={input.sponsorGenerationPreview?.obsoleteActionItems.length ?? 0} />
        <Stat label="Generated collateral kept for review" value={input.sponsorGenerationPreview?.obsoleteCollateralItems.length ?? 0} />
        <Stat label="Preserved review items with progress" value={progressedCount} />
      </div>
    </section>
  );
}

function Field({ children, label, wide = false }: { children: ReactNode; label: string; wide?: boolean }) {
  return <div className={`field${wide ? " field--wide" : ""}`}><label>{label}</label>{children}</div>;
}

function getDateLabel(dateMode: EventOnboardingSelectedInstance["instance"]["dateMode"], index: number) {
  if (dateMode === "single") {
    return "Event date";
  }
  if (dateMode === "range") {
    return index === 0 ? "Start date" : "End date";
  }
  return `Date ${index + 1}`;
}
