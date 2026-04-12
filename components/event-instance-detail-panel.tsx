"use client";

import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { NewActionItem, UpdateEventInstanceInput, UpsertEventSubEventInput } from "@/components/app-state";
import { sortSubEventsForEventWorkspace } from "@/lib/events/sub-event-ordering";
import type { EventOnboardingSelectedInstance } from "@/lib/events/event-onboarding";
import type { EventSubEventScheduleMode } from "@/lib/event-instances";
import { deriveEventDateRange } from "@/lib/event-instances";
import type { ActionItem } from "@/lib/sample-data";
import {
  createSponsorCommitmentDraft,
  createSponsorOpportunityDraft,
  ensureSponsorshipSetupForEventInstance,
  getSponsorCommitmentOpportunityOptions,
  type SponsorCommitment,
  type SponsorFulfillmentGenerationResult,
  type SponsorOpportunityDeliverable,
  type SponsorOpportunity,
  type SponsorshipSetup
} from "@/lib/sponsor-fulfillment";
import { createActionNoteEntry, isTerminalStatus, LOCAL_FALLBACK_NOTE_AUTHOR } from "@/lib/ops-utils";

type Props = {
  addItem: (item: NewActionItem) => void;
  items: ActionItem[];
  selectedInstance: EventOnboardingSelectedInstance;
  isActive: boolean;
  actionItemCount: number;
  actionViewHref: string;
  collateralItemCount: number;
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

type SponsorFulfillmentPreviewRow = {
  id: string;
  sourceKey: string;
  sponsorId: string;
  sponsorName: string;
  placementId: string;
  placementName: string;
  linkedSubEventId?: string;
  sponsorNotes?: string;
  placementNotes?: string;
  logoReceived: boolean;
  deliverableName: string;
  deliverableId: string;
  category: string;
  channel: string;
  timingType: string;
  offsetDays: string;
  fixedMonth: string;
  eventDayOffset: string;
  requiresLogo: boolean;
  requiresCopy: boolean;
  requiresApproval: boolean;
};

type FulfillmentPreviewSourceLink = {
  eventInstanceId: string;
  placementId: string;
  sponsorId: string;
  deliverableId: string;
};

type FulfillmentRollup = {
  generated: number;
  complete: number;
  open: number;
};

const WORKSPACE_SECTIONS = [
  { id: "basics", label: "Basics" },
  { id: "sub-events", label: "Sub-events" },
  { id: "placements", label: "Placements" },
  { id: "sponsors", label: "Sponsors" },
  { id: "collateral", label: "Collateral" },
  { id: "fulfillment-preview", label: "Fulfillment Preview" }
] as const;

export function EventInstanceDetailPanel({
  addItem,
  items,
  selectedInstance,
  isActive,
  actionItemCount,
  actionViewHref,
  collateralItemCount,
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
  const placementOptions = useMemo(() => getSponsorCommitmentOpportunityOptions(resolvedSetup), [resolvedSetup]);
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
  const [activeSectionId, setActiveSectionId] = useState<WorkspaceSectionId>("basics");
  const fulfillmentActionItems = useMemo(
    () =>
      items.flatMap((item) => {
        const source = getFulfillmentPreviewSourceLink(item);

        if (!source || source.eventInstanceId !== instance.id) {
          return [];
        }

        return [{ item, source }];
      }),
    [instance.id, items]
  );
  const placementRollups = useMemo(
    () =>
      resolvedSetup.opportunities.reduce((map, opportunity) => {
        const matchingItems = fulfillmentActionItems.filter(({ source }) => source.placementId === opportunity.id);
        const generated = matchingItems.length;
        const complete = matchingItems.filter(({ item }) => isTerminalStatus(item.status)).length;

        map.set(opportunity.id, {
          generated,
          complete,
          open: generated - complete
        });
        return map;
      }, new Map<string, FulfillmentRollup>()),
    [fulfillmentActionItems, resolvedSetup.opportunities]
  );
  const sponsorRollups = useMemo(
    () =>
      resolvedSetup.commitments.reduce((map, commitment) => {
        const matchingItems = fulfillmentActionItems.filter(({ source }) => source.sponsorId === commitment.id);
        const generated = matchingItems.length;
        const complete = matchingItems.filter(({ item }) => isTerminalStatus(item.status)).length;

        map.set(commitment.id, {
          generated,
          complete,
          open: generated - complete
        });
        return map;
      }, new Map<string, FulfillmentRollup>()),
    [fulfillmentActionItems, resolvedSetup.commitments]
  );

  useEffect(() => setDetailsDraft(createDetailsDraft(instance)), [instance]);
  useEffect(() => setActiveSectionId("basics"), [instance.id]);

  const steps = useMemo(
    () => buildSteps(instance.name, instance.startDate, scheduleStatus, resolvedSetup),
    [instance.name, instance.startDate, resolvedSetup, scheduleStatus]
  );
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

  function selectSection(sectionId: WorkspaceSectionId) {
    setActiveSectionId(sectionId);
  }

  return (
    <section className="card card--secondary events-workspace" aria-label="Event workspace">
      <div className="events-workspace__header">
        <div>
          <div className="events-workspace__eyebrow">Event Page</div>
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
        <Stat value={resolvedSetup.opportunities.length} label="Placements" />
        <Stat value={resolvedSetup.commitments.length} label="Sponsors" />
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
              <div className="events-workspace__section-eyebrow">{instance.name}</div>
              <h3 className="events-workspace__section-title">{activeStep?.label ?? "Event workspace section"}</h3>
              <div className="events-detail-card__meta">
                <span>{instance.name}</span>
                <span>{formatWorkspaceDateRange(instance.startDate, instance.endDate)}</span>
                {instance.location ? <span>{instance.location}</span> : null}
              </div>
            </div>
          </div>
          {activeSectionId === "basics" ? (
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
          {activeSectionId === "placements" ? (
            <SponsorOpportunitiesSection
              onAdd={() => {
                onUpsertSponsorOpportunity(instance.id, createSponsorOpportunityDraft(instance.id, instance.eventTypeId));
                setFeedback("Placement added.");
              }}
              onRemove={(opportunityId) =>
                setFeedback(onRemoveSponsorOpportunity(instance.id, opportunityId) ? "Placement removed." : "That placement still has sponsors assigned, so it was kept.")
              }
              onUpsert={(opportunity) => onUpsertSponsorOpportunity(instance.id, opportunity)}
              opportunities={resolvedSetup.opportunities}
              placementRollups={placementRollups}
              sponsorCommitments={resolvedSetup.commitments}
              subEventOptions={subEventOptions}
              supportsSponsorSetup={supportsSponsorSetup}
            />
          ) : null}
          {activeSectionId === "sponsors" ? (
            <SponsorCommitmentsSection
              commitments={resolvedSetup.commitments}
              onAdd={() => {
                onUpsertSponsorCommitment(instance.id, createSponsorCommitmentDraft(instance.id, resolvedSetup));
                setFeedback("Sponsor added.");
              }}
              onRemove={(commitmentId) => {
                onRemoveSponsorCommitment(instance.id, commitmentId);
                setFeedback("Sponsor removed.");
              }}
              onUpsert={(commitment) => onUpsertSponsorCommitment(instance.id, commitment)}
              opportunities={resolvedSetup.opportunities}
              placementOptions={placementOptions}
              sponsorRollups={sponsorRollups}
              subEventOptions={subEventOptions}
              supportsSponsorSetup={supportsSponsorSetup}
            />
          ) : null}
          {activeSectionId === "collateral" ? (
            <CollateralSection collateralItemCount={collateralItemCount} onOpenInCollateral={() => onOpenInCollateral(instance.id)} sponsorGenerationPreview={sponsorGenerationPreview} />
          ) : null}
          {activeSectionId === "fulfillment-preview" ? (
            <FulfillmentPreviewSection
              actionItemCount={actionItemCount}
              addItem={addItem}
              commitments={resolvedSetup.commitments}
              definitionLabel={definition?.label ?? instance.eventTypeId}
              eventInstanceId={instance.id}
              items={items}
              opportunities={resolvedSetup.opportunities}
              supportsSponsorSetup={supportsSponsorSetup}
            />
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

function buildSteps(name: string, startDate: string, scheduleStatus: EventOnboardingSelectedInstance["scheduleStatus"], setup: SponsorshipSetup): WorkspaceStep[] {
  const hasPreview = setup.commitments.some((commitment) => {
    if (commitment.isActive === false || !commitment.opportunityId || !commitment.sponsorName.trim()) {
      return false;
    }

    const opportunity = setup.opportunities.find((entry) => entry.id === commitment.opportunityId);
    return Boolean(opportunity && opportunity.isActive !== false && (opportunity.deliverables?.length ?? 0) > 0);
  });
  return [
    { sectionId: "basics", label: "Basics", badge: name.trim() && startDate ? "Ready" : "Needs attention", status: name.trim() && startDate ? "done" : "attention", copy: name.trim() && startDate ? "Core event details are in place and stay editable." : "Start by confirming the event name, dates, and location." },
    { sectionId: "sub-events", label: "Sub-events", badge: scheduleStatus === "scheduled" ? "Ready" : "Next", status: scheduleStatus === "scheduled" ? "done" : "next", copy: scheduleStatus === "scheduled" ? "Sub-event scheduling is ready for downstream work." : "Confirm dates and times so downstream work lands in the right places." },
    { sectionId: "placements", label: "Placements", badge: setup.opportunities.length > 0 ? "Ready" : "Next", status: setup.opportunities.length > 0 ? "done" : "next", copy: setup.opportunities.length > 0 ? `${setup.opportunities.length} placement${setup.opportunities.length === 1 ? "" : "s"} currently define this event structure.` : "Add the placements that sponsors can be assigned into for this event." },
    { sectionId: "sponsors", label: "Sponsors", badge: setup.commitments.length > 0 ? "Ready" : "Next", status: setup.commitments.length > 0 ? "done" : "next", copy: setup.commitments.length > 0 ? `${setup.commitments.length} sponsor${setup.commitments.length === 1 ? "" : "s"} currently attach to this event.` : "Add sponsors as they confirm and attach each one to a placement." },
    { sectionId: "collateral", label: "Collateral", badge: "Linked", status: "next", copy: "Review the current downstream collateral context without changing the collateral workspace itself." },
    { sectionId: "fulfillment-preview", label: "Fulfillment Preview", badge: hasPreview ? "Ready" : "Next", status: hasPreview ? "done" : "next", copy: hasPreview ? "Preview rows are ready for review and approval before downstream execution." : "Once sponsors are assigned to placements with deliverables, review rows will appear here automatically." }
  ];
}

function EventDetailsSection(input: {
  detailsDraft: DetailsDraft;
  instance: EventOnboardingSelectedInstance["instance"];
  onSave: () => void;
  setDetailsDraft: Dispatch<SetStateAction<DetailsDraft>>;
}) {
  return (
    <section className="events-detail-card__section" id="event-workspace-basics">
      <div className="events-detail-card__section-title">Basics</div>
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
  onAdd: () => void;
  onRemove: (opportunityId: string) => void;
  onUpsert: (opportunity: SponsorOpportunity) => void;
  opportunities: SponsorOpportunity[];
  placementRollups: Map<string, FulfillmentRollup>;
  sponsorCommitments: SponsorCommitment[];
  subEventOptions: Array<{ id: string; label: string }>;
  supportsSponsorSetup: boolean;
}) {
  const [expandedPlacements, setExpandedPlacements] = useState<Record<string, boolean>>({});

  function updateDeliverable(
    opportunity: SponsorOpportunity,
    deliverableId: string,
    updates: Partial<SponsorOpportunityDeliverable>
  ) {
    input.onUpsert({
      ...opportunity,
      deliverables: (opportunity.deliverables ?? []).map((deliverable) =>
        deliverable.id === deliverableId ? { ...deliverable, ...updates } : deliverable
      )
    });
  }

  function addDeliverable(opportunity: SponsorOpportunity) {
    input.onUpsert({
      ...opportunity,
      deliverables: [...(opportunity.deliverables ?? []), createEmptyPlacementDeliverable()]
    });
  }

  function removeDeliverable(opportunity: SponsorOpportunity, deliverableId: string) {
    input.onUpsert({
      ...opportunity,
      deliverables: (opportunity.deliverables ?? []).filter((deliverable) => deliverable.id !== deliverableId)
    });
  }

  return (
    <section className="events-detail-card__section" id="event-workspace-placements">
      <div className="events-detail-card__header">
        <div>
          <div className="events-detail-card__section-title">Placements</div>
          <div className="events-selector-card__copy">
            Placements define sponsorable slots for this event. They can be event-wide or tied to a specific sub-event, and they do not need a sponsor assigned yet.
          </div>
        </div>
        {input.supportsSponsorSetup ? <button className="button-link button-link--inline-secondary" onClick={input.onAdd} type="button">Add Placement</button> : null}
      </div>
      {!input.supportsSponsorSetup ? <div className="events-detail-card__empty">This event type does not currently use placements or sponsors.</div> : input.opportunities.length === 0 ? <div className="events-detail-card__empty">No placements yet.</div> : (
        <div className="events-workspace__list">
          {input.opportunities.map((opportunity) => {
            const sponsorCount = input.sponsorCommitments.filter((commitment) => commitment.opportunityId === opportunity.id).length;
            const deliverableCount = (opportunity.deliverables ?? []).length;
            const rollup = input.placementRollups.get(opportunity.id) ?? { generated: 0, complete: 0, open: 0 };

            return (
              <div className="events-workspace__placement-card" key={opportunity.id}>
                <div className="events-workspace__placement-card-header">
                  <div className="events-workspace__placement-card-title-block">
                    <strong>{opportunity.label.trim() || "New placement"}</strong>
                    <div className="events-workspace__placement-card-meta">
                      <span className="events-chip">
                        {opportunity.linkedSubEventId
                          ? `Linked to ${
                              input.subEventOptions.find((option) => option.id === opportunity.linkedSubEventId)?.label ?? "sub-event"
                            }`
                          : "Event-wide"}
                      </span>
                      <span className="events-chip">{deliverableCount} deliverable definition{deliverableCount === 1 ? "" : "s"}</span>
                      {opportunity.isActive === false ? <span className="events-chip">Inactive</span> : null}
                    </div>
                  </div>
                  <div className="events-detail-card__actions">
                    <button
                      className="button-link button-link--inline-secondary"
                      onClick={() =>
                        setExpandedPlacements((current) => ({
                          ...current,
                          [opportunity.id]: !(current[opportunity.id] ?? input.opportunities.length <= 2)
                        }))
                      }
                      type="button"
                    >
                      {(expandedPlacements[opportunity.id] ?? input.opportunities.length <= 2) ? "Collapse" : "Expand"}
                    </button>
                    <button className="button-link button-link--inline-secondary" onClick={() => input.onRemove(opportunity.id)} type="button">Remove</button>
                  </div>
                </div>
                {(expandedPlacements[opportunity.id] ?? input.opportunities.length <= 2) ? (
                  <div className="events-workspace__placement-card-body">
                    <div className="events-workspace__stat-grid">
                      <Stat label="Sponsors assigned" value={sponsorCount} />
                      <Stat label="Deliverable definitions" value={deliverableCount} />
                      <Stat label="Generated action items" value={rollup.generated} />
                      <Stat label="Complete" value={rollup.complete} />
                      <Stat label="Open" value={rollup.open} />
                    </div>
                    <div className="events-workspace__placement-structure">
                      <div className="events-workspace__placement-definition">
                        <div className="events-workspace__placement-definition-header">
                          <div className="events-detail-card__section-title">Placement Structure</div>
                          <div className="field-hint">Define where this sponsorship slot lives in the event.</div>
                        </div>
                        <div className="events-workspace__grid events-workspace__grid--placement">
                          <Field label="Placement name">
                            <input className="field-control" onChange={(event) => input.onUpsert({ ...opportunity, label: event.target.value })} value={opportunity.label} />
                          </Field>
                          <Field label="Scope">
                            <select
                              className="field-control"
                              onChange={(event) =>
                                input.onUpsert({
                                  ...opportunity,
                                  linkedSubEventId: event.target.value === "sub-event" ? opportunity.linkedSubEventId ?? input.subEventOptions[0]?.id : undefined
                                })
                              }
                              value={opportunity.linkedSubEventId ? "sub-event" : "event-wide"}
                            >
                              <option value="event-wide">Event-wide</option>
                              <option value="sub-event">Linked to sub-event</option>
                            </select>
                          </Field>
                          {opportunity.linkedSubEventId ? (
                            <Field label="Linked sub-event">
                              <select
                                className="field-control"
                                onChange={(event) => input.onUpsert({ ...opportunity, linkedSubEventId: event.target.value || undefined })}
                                value={opportunity.linkedSubEventId}
                              >
                                {input.subEventOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                              </select>
                            </Field>
                          ) : null}
                          <label className="events-workspace__toggle"><input checked={opportunity.isActive !== false} onChange={(event) => input.onUpsert({ ...opportunity, isActive: event.target.checked })} type="checkbox" />Active placement</label>
                          <Field label="Notes" wide>
                            <textarea className="field-control" onChange={(event) => input.onUpsert({ ...opportunity, notes: event.target.value })} value={opportunity.notes ?? ""} />
                          </Field>
                        </div>
                      </div>
                      <div className="events-workspace__deliverables events-workspace__deliverables--placement">
                        <div className="events-workspace__deliverables-header">
                          <div>
                            <div className="events-detail-card__section-title">Deliverables</div>
                            <div className="field-hint">
                              These rows define what this placement promises to any sponsor assigned to it.
                            </div>
                          </div>
                          <button
                            className="button-link button-link--inline-secondary"
                            onClick={() => addDeliverable(opportunity)}
                            type="button"
                          >
                            Add Line
                          </button>
                        </div>
                        <div className="events-workspace__deliverables-grid-wrap">
                          <table className="events-workspace__deliverables-grid">
                            <thead>
                              <tr>
                                <th>Deliverable_Name</th>
                                <th>Category</th>
                                <th>Channel</th>
                                <th>Timing_Type</th>
                                <th>Offset_Days</th>
                                <th>Fixed_Month</th>
                                <th>Event_Day_Offset</th>
                                <th>Requires_Logo</th>
                                <th>Requires_Copy</th>
                                <th>Requires_Approval</th>
                                <th aria-label="Actions" />
                              </tr>
                            </thead>
                            <tbody>
                              {(opportunity.deliverables ?? []).length === 0 ? (
                                <tr>
                                  <td className="events-workspace__deliverables-empty" colSpan={11}>
                                    No deliverable rows yet.
                                  </td>
                                </tr>
                              ) : (
                                (opportunity.deliverables ?? []).map((deliverable) => (
                                  <tr key={deliverable.id}>
                                    <td>
                                      <input
                                        className="field-control"
                                        onChange={(event) => updateDeliverable(opportunity, deliverable.id, { deliverableName: event.target.value })}
                                        value={deliverable.deliverableName}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        className="field-control"
                                        onChange={(event) => updateDeliverable(opportunity, deliverable.id, { category: event.target.value })}
                                        value={deliverable.category}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        className="field-control"
                                        onChange={(event) => updateDeliverable(opportunity, deliverable.id, { channel: event.target.value })}
                                        value={deliverable.channel}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        className="field-control"
                                        onChange={(event) => updateDeliverable(opportunity, deliverable.id, { timingType: event.target.value })}
                                        value={deliverable.timingType}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        className="field-control"
                                        onChange={(event) => updateDeliverable(opportunity, deliverable.id, { offsetDays: event.target.value })}
                                        value={deliverable.offsetDays}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        className="field-control"
                                        onChange={(event) => updateDeliverable(opportunity, deliverable.id, { fixedMonth: event.target.value })}
                                        value={deliverable.fixedMonth}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        className="field-control"
                                        onChange={(event) => updateDeliverable(opportunity, deliverable.id, { eventDayOffset: event.target.value })}
                                        value={deliverable.eventDayOffset}
                                      />
                                    </td>
                                    <td>
                                      <label className="events-workspace__deliverables-check">
                                        <input
                                          checked={deliverable.requiresLogo}
                                          onChange={(event) => updateDeliverable(opportunity, deliverable.id, { requiresLogo: event.target.checked })}
                                          type="checkbox"
                                        />
                                      </label>
                                    </td>
                                    <td>
                                      <label className="events-workspace__deliverables-check">
                                        <input
                                          checked={deliverable.requiresCopy}
                                          onChange={(event) => updateDeliverable(opportunity, deliverable.id, { requiresCopy: event.target.checked })}
                                          type="checkbox"
                                        />
                                      </label>
                                    </td>
                                    <td>
                                      <label className="events-workspace__deliverables-check">
                                        <input
                                          checked={deliverable.requiresApproval}
                                          onChange={(event) => updateDeliverable(opportunity, deliverable.id, { requiresApproval: event.target.checked })}
                                          type="checkbox"
                                        />
                                      </label>
                                    </td>
                                    <td>
                                      <button
                                        className="button-link button-link--inline-secondary"
                                        onClick={() => removeDeliverable(opportunity, deliverable.id)}
                                        type="button"
                                      >
                                        Remove
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
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

function SponsorCommitmentsSection(input: {
  commitments: SponsorCommitment[];
  onAdd: () => void;
  onRemove: (commitmentId: string) => void;
  onUpsert: (commitment: SponsorCommitment) => void;
  opportunities: SponsorOpportunity[];
  placementOptions: Array<{ id: string; label: string }>;
  sponsorRollups: Map<string, FulfillmentRollup>;
  subEventOptions: Array<{ id: string; label: string }>;
  supportsSponsorSetup: boolean;
}) {
  const unassignedSponsors = input.commitments.filter((commitment) => !commitment.opportunityId).length;
  const commitmentsMissingLogo = input.commitments.filter((commitment) => !commitment.logoReceived).length;

  return (
    <section className="events-detail-card__section" id="event-workspace-sponsors">
      <div className="events-detail-card__header">
        <div>
          <div className="events-detail-card__section-title">Sponsors</div>
          <div className="events-selector-card__copy">
            Sponsors attach to placements here. This section is only for entering sponsors, assigning them, and tracking setup status before fulfillment review.
          </div>
        </div>
        {input.supportsSponsorSetup ? <button className="button-link button-link--inline-secondary" disabled={input.placementOptions.length === 0} onClick={input.onAdd} type="button">Add Sponsor</button> : null}
      </div>
      {!input.supportsSponsorSetup ? <div className="events-detail-card__empty">This event type does not currently use placements or sponsors.</div> : input.commitments.length === 0 ? <div className="events-detail-card__empty">No sponsors yet.</div> : (
        <div className="events-workspace__list">
          <div className="events-workspace__stat-grid">
            <Stat label="Total sponsors" value={input.commitments.length} />
            <Stat label="Unassigned" value={unassignedSponsors} />
            <Stat label="Missing logo" value={commitmentsMissingLogo} />
          </div>
          {input.commitments.map((commitment) => {
            const selectedOpportunity = input.opportunities.find((opportunity) => opportunity.id === commitment.opportunityId) ?? null;
            const assignedPlacementLabel = selectedOpportunity?.label?.trim() || "Placement not assigned";
            const assignedPlacementScope =
              selectedOpportunity?.linkedSubEventId
                ? input.subEventOptions.find((option) => option.id === selectedOpportunity.linkedSubEventId)?.label ?? "Linked sub-event"
                : selectedOpportunity
                  ? "Event-wide"
                  : null;
            const rollup = input.sponsorRollups.get(commitment.id) ?? { generated: 0, complete: 0, open: 0 };
            return (
              <div className="events-workspace__sponsor-card" key={commitment.id}>
                <div className="events-workspace__placement-card-header">
                  <div className="events-workspace__placement-card-title-block">
                    <strong>{commitment.sponsorName.trim() || "New sponsor"}</strong>
                    <div className="events-workspace__placement-card-meta">
                      <span className={selectedOpportunity ? "events-chip events-chip--accent" : "events-chip"}>
                        {assignedPlacementLabel}
                      </span>
                      {assignedPlacementScope ? <span className="events-chip">{assignedPlacementScope}</span> : null}
                      {commitment.isActive === false ? <span className="events-chip">Inactive</span> : null}
                    </div>
                  </div>
                  <button className="button-link button-link--inline-secondary" onClick={() => input.onRemove(commitment.id)} type="button">Remove</button>
                </div>
                <div className="events-workspace__sponsor-card-body">
                  <div className="events-workspace__sponsor-summary">
                    <span className="events-chip events-chip--accent">{rollup.generated} action item{rollup.generated === 1 ? "" : "s"}</span>
                    <span className="events-chip">{rollup.complete} complete</span>
                    <span className="events-chip">{rollup.open} open</span>
                  </div>
                  <div className="events-workspace__sponsor-form">
                    <Field label="Sponsor name">
                      <input className="field-control" onChange={(event) => input.onUpsert({ ...commitment, sponsorName: event.target.value })} value={commitment.sponsorName} />
                    </Field>
                    <Field label="Assigned placement">
                      <select className="field-control" onChange={(event) => input.onUpsert({ ...commitment, opportunityId: event.target.value, placement: input.opportunities.find((opportunity) => opportunity.id === event.target.value)?.placementType })} value={commitment.opportunityId}>
                        <option value="">Choose a placement</option>
                        {input.placementOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                    </Field>
                    <label className="events-workspace__toggle"><input checked={commitment.logoReceived} onChange={(event) => input.onUpsert({ ...commitment, logoReceived: event.target.checked })} type="checkbox" />Logo received</label>
                    <label className="events-workspace__toggle"><input checked={commitment.isActive !== false} onChange={(event) => input.onUpsert({ ...commitment, isActive: event.target.checked })} type="checkbox" />Active sponsor</label>
                    <Field label="Notes" wide>
                      <textarea className="field-control" onChange={(event) => input.onUpsert({ ...commitment, notes: event.target.value })} value={commitment.notes ?? ""} />
                    </Field>
                  </div>
                  <div className="field-hint">
                    {selectedOpportunity
                      ? `Assigned to ${assignedPlacementLabel}${assignedPlacementScope ? ` · ${assignedPlacementScope}` : ""}.`
                      : "This sponsor record can be saved before assignment, but it needs a placement before fulfillment rows will appear."}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DeliverablesSection(input: {
  approvedRowIds: Record<string, true>;
  createdActionItemIdByRowId: Map<string, string>;
  onApproveAllPending: () => void;
  onApprovePlacement: (placementId: string) => void;
  onApproveRow: (rowId: string) => void;
  onApproveSponsor: (sponsorId: string) => void;
  pendingRows: SponsorFulfillmentPreviewRow[];
  previewRows: SponsorFulfillmentPreviewRow[];
  rowsByPlacement: Array<{ placementId: string; placementName: string; rows: SponsorFulfillmentPreviewRow[] }>;
  rowsBySponsor: Array<{ sponsorId: string; sponsorName: string; rows: SponsorFulfillmentPreviewRow[] }>;
  supportsSponsorSetup: boolean;
}) {
  return (
    <section className="events-detail-card__section" id="event-workspace-fulfillment-preview-deliverables">
      <div className="events-detail-card__header">
        <div>
          <div className="events-detail-card__section-title">Fulfillment Preview</div>
          <div className="events-selector-card__copy">
            Preview rows are generated automatically from placement deliverables plus sponsor assignments. Review and approval happen here before the work becomes actionable.
          </div>
        </div>
        {input.supportsSponsorSetup ? (
          <button
            className="topbar__button"
            disabled={input.pendingRows.length === 0}
            onClick={input.onApproveAllPending}
            type="button"
          >
            Approve All Pending
          </button>
        ) : null}
      </div>
      {input.previewRows.length === 0 ? <div className="events-detail-card__empty">No sponsor-driven preview rows exist yet. Add placement deliverables and assign sponsors to placements to generate them.</div> : (
        <>
          <div className="events-workspace__stat-grid">
            <Stat label="Total preview rows" value={input.previewRows.length} />
            <Stat label="Pending review" value={input.pendingRows.length} />
            <Stat label="Approved" value={input.previewRows.length - input.pendingRows.length} />
            <Stat label="Sponsors in preview" value={input.rowsBySponsor.length} />
          </div>
          <div className="events-workspace__approval-groups">
            <div className="events-workspace__approval-group">
              <div className="events-detail-card__section-title">Approve By Sponsor</div>
              <div className="events-workspace__approval-chip-list">
                {input.rowsBySponsor.map((group) => {
                  const pendingCount = group.rows.filter((row) => !input.approvedRowIds[row.id]).length;

                  return (
                    <button
                      className="button-link button-link--inline-secondary"
                      disabled={pendingCount === 0}
                      key={group.sponsorId}
                      onClick={() => input.onApproveSponsor(group.sponsorId)}
                      type="button"
                    >
                      {group.sponsorName || "Unnamed sponsor"} ({pendingCount})
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="events-workspace__approval-group">
              <div className="events-detail-card__section-title">Approve By Placement</div>
              <div className="events-workspace__approval-chip-list">
                {input.rowsByPlacement.map((group) => {
                  const pendingCount = group.rows.filter((row) => !input.approvedRowIds[row.id]).length;

                  return (
                    <button
                      className="button-link button-link--inline-secondary"
                      disabled={pendingCount === 0}
                      key={group.placementId}
                      onClick={() => input.onApprovePlacement(group.placementId)}
                      type="button"
                    >
                      {group.placementName} ({pendingCount})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="events-workspace__deliverables-grid-wrap">
            <table className="events-workspace__deliverables-grid">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Sponsor</th>
                  <th>Placement</th>
                  <th>Deliverable_Name</th>
                  <th>Category</th>
                  <th>Channel</th>
                  <th>Timing_Type</th>
                  <th>Offset_Days</th>
                  <th>Fixed_Month</th>
                  <th>Event_Day_Offset</th>
                  <th>Requires_Logo</th>
                  <th>Requires_Copy</th>
                  <th>Requires_Approval</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {input.previewRows.map((row) => {
                  const isApproved = Boolean(input.approvedRowIds[row.id]);
                  const createdActionItemId = input.createdActionItemIdByRowId.get(row.id) ?? null;
                  const isCreated = Boolean(createdActionItemId);

                  return (
                    <tr
                      className={
                        isCreated
                          ? "events-workspace__preview-row-status events-workspace__preview-row-status--created"
                          : isApproved
                            ? "events-workspace__preview-row-status events-workspace__preview-row-status--approved"
                            : "events-workspace__preview-row-status events-workspace__preview-row-status--pending"
                      }
                      key={row.id}
                    >
                      <td>
                        <span className={isCreated || isApproved ? "events-chip events-chip--active" : "events-chip"}>
                          {isCreated ? "Created" : isApproved ? "Approved" : "Pending"}
                        </span>
                      </td>
                      <td>{row.sponsorName}</td>
                      <td>{row.placementName}</td>
                      <td>{row.deliverableName || "Untitled deliverable"}</td>
                      <td>{row.category || "-"}</td>
                      <td>{row.channel || "-"}</td>
                      <td>{row.timingType || "-"}</td>
                      <td>{row.offsetDays || "-"}</td>
                      <td>{row.fixedMonth || "-"}</td>
                      <td>{row.eventDayOffset || "-"}</td>
                      <td>{row.requiresLogo ? "Yes" : "No"}</td>
                      <td>{row.requiresCopy ? "Yes" : "No"}</td>
                      <td>{row.requiresApproval ? "Yes" : "No"}</td>
                      <td>
                        <button
                          className="button-link button-link--inline-secondary"
                          disabled={isCreated || isApproved}
                          onClick={() => input.onApproveRow(row.id)}
                          type="button"
                        >
                          {isCreated ? "Created in Action View" : isApproved ? "Approved" : "Approve"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
  approvedCount: number;
  createdCount: number;
  pendingCount: number;
  previewCount: number;
}) {
  return (
    <section className="events-detail-card__section" id="event-workspace-fulfillment-preview-review">
      <div className="events-detail-card__header">
        <div>
          <div className="events-detail-card__section-title">Review State</div>
          <div className="events-selector-card__copy">
            This section shows what is still pending review and what has already been turned into Action View work.
          </div>
        </div>
      </div>
      <div className="events-workspace__review-callout">
        {input.pendingCount > 0
          ? `${input.pendingCount} preview row${input.pendingCount === 1 ? "" : "s"} still need review before they can move into Action View.`
          : input.createdCount > 0
            ? `${input.createdCount} approved row${input.createdCount === 1 ? "" : "s"} have already created Action View items.`
            : input.previewCount > 0
              ? "All current preview rows have been approved in this event workspace."
            : "No preview rows are available yet."}
      </div>
      <div className="events-workspace__review-grid">
        <Stat label="Current action items" value={input.actionItemCount} />
        <Stat label="Preview rows" value={input.previewCount} />
        <Stat label="Pending" value={input.pendingCount} />
        <Stat label="Approved" value={input.approvedCount} />
        <Stat label="Created in Action View" value={input.createdCount} />
      </div>
    </section>
  );
}

function FulfillmentPreviewSection(input: {
  actionItemCount: number;
  addItem: (item: NewActionItem) => void;
  definitionLabel: string;
  eventInstanceId: string;
  items: ActionItem[];
  opportunities: SponsorOpportunity[];
  commitments: SponsorCommitment[];
  supportsSponsorSetup: boolean;
}) {
  const previewRows = useMemo(
    () => buildSponsorFulfillmentPreviewRows(input.opportunities, input.commitments),
    [input.commitments, input.opportunities]
  );
  const createdActionItemIdByRowId = useMemo(
    () =>
      new Map(
        previewRows.flatMap((row) => {
          const existingItem =
            input.items.find((item) => hasFulfillmentPreviewSourceMarker(item, row.sourceKey)) ?? null;

          return existingItem ? [[row.id, existingItem.id] as const] : [];
        })
      ),
    [input.items, previewRows]
  );
  const [approvedRowIds, setApprovedRowIds] = useState<Record<string, true>>({});

  useEffect(() => {
    setApprovedRowIds((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([rowId]) => previewRows.some((row) => row.id === rowId))
      ) as Record<string, true>
    );
  }, [previewRows]);

  const pendingRows = previewRows.filter((row) => !approvedRowIds[row.id] && !createdActionItemIdByRowId.has(row.id));
  const approvedRows = previewRows.filter((row) => approvedRowIds[row.id] || createdActionItemIdByRowId.has(row.id));
  const createdRows = previewRows.filter((row) => createdActionItemIdByRowId.has(row.id));
  const rowsBySponsor = useMemo(
    () =>
      Array.from(
        previewRows.reduce((map, row) => {
          const current = map.get(row.sponsorId) ?? {
            sponsorId: row.sponsorId,
            sponsorName: row.sponsorName,
            rows: [] as SponsorFulfillmentPreviewRow[]
          };
          current.rows.push(row);
          map.set(row.sponsorId, current);
          return map;
        }, new Map<string, { sponsorId: string; sponsorName: string; rows: SponsorFulfillmentPreviewRow[] }>())
      ).map(([, value]) => value),
    [previewRows]
  );
  const rowsByPlacement = useMemo(
    () =>
      Array.from(
        previewRows.reduce((map, row) => {
          const current = map.get(row.placementId) ?? {
            placementId: row.placementId,
            placementName: row.placementName,
            rows: [] as SponsorFulfillmentPreviewRow[]
          };
          current.rows.push(row);
          map.set(row.placementId, current);
          return map;
        }, new Map<string, { placementId: string; placementName: string; rows: SponsorFulfillmentPreviewRow[] }>())
      ).map(([, value]) => value),
    [previewRows]
  );

  function approveRow(rowId: string) {
    const row = previewRows.find((entry) => entry.id === rowId) ?? null;

    if (!row) {
      return;
    }

    if (!createdActionItemIdByRowId.has(row.id)) {
      input.addItem(buildFulfillmentPreviewActionItem({
        definitionLabel: input.definitionLabel,
        eventInstanceId: input.eventInstanceId,
        row
      }));
    }

    setApprovedRowIds((current) => ({
      ...current,
      [rowId]: true
    }));
  }

  function approveRows(rowIds: string[]) {
    if (rowIds.length === 0) {
      return;
    }

    rowIds.forEach((rowId) => {
      const row = previewRows.find((entry) => entry.id === rowId) ?? null;

      if (!row || createdActionItemIdByRowId.has(row.id)) {
        return;
      }

      input.addItem(buildFulfillmentPreviewActionItem({
        definitionLabel: input.definitionLabel,
        eventInstanceId: input.eventInstanceId,
        row
      }));
    });

    setApprovedRowIds((current) => ({
      ...current,
      ...Object.fromEntries(rowIds.map((rowId) => [rowId, true] as const))
    }));
  }

  return (
    <div className="events-workspace__body">
      <DeliverablesSection
        approvedRowIds={approvedRowIds}
        createdActionItemIdByRowId={createdActionItemIdByRowId}
        onApproveAllPending={() => approveRows(pendingRows.map((row) => row.id))}
        onApprovePlacement={(placementId) =>
          approveRows(
            pendingRows
              .filter((row) => row.placementId === placementId)
              .map((row) => row.id)
          )
        }
        onApproveRow={approveRow}
        onApproveSponsor={(sponsorId) =>
          approveRows(
            pendingRows
              .filter((row) => row.sponsorId === sponsorId)
              .map((row) => row.id)
          )
        }
        pendingRows={pendingRows}
        previewRows={previewRows}
        rowsByPlacement={rowsByPlacement}
        rowsBySponsor={rowsBySponsor}
        supportsSponsorSetup={input.supportsSponsorSetup}
      />
      <ReviewSection
        actionItemCount={input.actionItemCount}
        approvedCount={approvedRows.length}
        createdCount={createdRows.length}
        pendingCount={pendingRows.length}
        previewCount={previewRows.length}
      />
    </div>
  );
}

function Field({ children, label, wide = false }: { children: ReactNode; label: string; wide?: boolean }) {
  return <div className={`field${wide ? " field--wide" : ""}`}><label>{label}</label>{children}</div>;
}

function createEmptyPlacementDeliverable(): SponsorOpportunityDeliverable {
  return {
    id: `placement-deliverable-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    deliverableName: "",
    category: "",
    channel: "",
    timingType: "",
    offsetDays: "",
    fixedMonth: "",
    eventDayOffset: "",
    requiresLogo: false,
    requiresCopy: false,
    requiresApproval: false
  };
}

function buildFulfillmentPreviewActionItem(input: {
  definitionLabel: string;
  eventInstanceId: string;
  row: SponsorFulfillmentPreviewRow;
}): NewActionItem {
  const noteEntry = createActionNoteEntry(
    [
      `Generated from approved fulfillment preview for ${input.row.sponsorName}.`,
      `Fulfillment preview source: ${input.row.sourceKey}.`,
      `Placement: ${input.row.placementName}.`,
      `Sponsor: ${input.row.sponsorName}.`,
      input.row.deliverableName ? `Deliverable: ${input.row.deliverableName}.` : "",
      input.row.category ? `Category: ${input.row.category}.` : "",
      input.row.channel ? `Channel: ${input.row.channel}.` : "",
      input.row.timingType ? `Timing type: ${input.row.timingType}.` : "",
      input.row.offsetDays ? `Offset days: ${input.row.offsetDays}.` : "",
      input.row.fixedMonth ? `Fixed month: ${input.row.fixedMonth}.` : "",
      input.row.eventDayOffset ? `Event day offset: ${input.row.eventDayOffset}.` : "",
      input.row.requiresLogo && !input.row.logoReceived ? "Waiting on sponsor logo." : "",
      input.row.requiresCopy ? "Requires sponsor copy." : "",
      input.row.requiresApproval ? "Requires approval." : "",
      input.row.sponsorNotes ?? "",
      input.row.placementNotes ?? ""
    ]
      .filter(Boolean)
      .join(" "),
    { author: LOCAL_FALLBACK_NOTE_AUTHOR }
  );

  return {
    type: "Deliverable",
    title: `${input.row.sponsorName} - ${input.row.deliverableName || "Fulfillment deliverable"}`,
    workstream: input.definitionLabel,
    eventInstanceId: input.eventInstanceId,
    subEventId: input.row.linkedSubEventId,
    operationalBucket: undefined,
    issue: undefined,
    dueDate: "",
    owner: "",
    status: input.row.requiresLogo && !input.row.logoReceived ? "Waiting" : "Not Started",
    waitingOn: input.row.requiresLogo && !input.row.logoReceived ? "Sponsor logo" : "",
    isBlocked: undefined,
    blockedBy: "",
    noteEntries: noteEntry ? [noteEntry] : []
  };
}

function hasFulfillmentPreviewSourceMarker(item: Pick<ActionItem, "noteEntries">, sourceKey: string) {
  return item.noteEntries.some((entry) => entry.text.includes(`Fulfillment preview source: ${sourceKey}.`));
}

function getFulfillmentPreviewSourceLink(item: Pick<ActionItem, "noteEntries">): FulfillmentPreviewSourceLink | null {
  for (const entry of item.noteEntries) {
    const markerStart = entry.text.indexOf("Fulfillment preview source: ");

    if (markerStart < 0) {
      continue;
    }

    const sourceStart = markerStart + "Fulfillment preview source: ".length;
    const sourceEnd = entry.text.indexOf(".", sourceStart);

    if (sourceEnd < 0) {
      continue;
    }

    try {
      const parsed = JSON.parse(entry.text.slice(sourceStart, sourceEnd)) as Partial<FulfillmentPreviewSourceLink>;

      if (
        typeof parsed.eventInstanceId === "string" &&
        typeof parsed.placementId === "string" &&
        typeof parsed.sponsorId === "string" &&
        typeof parsed.deliverableId === "string"
      ) {
        return {
          eventInstanceId: parsed.eventInstanceId,
          placementId: parsed.placementId,
          sponsorId: parsed.sponsorId,
          deliverableId: parsed.deliverableId
        };
      }
    } catch {
      continue;
    }
  }

  return null;
}

function buildSponsorFulfillmentPreviewRows(
  opportunities: SponsorOpportunity[],
  commitments: SponsorCommitment[]
): SponsorFulfillmentPreviewRow[] {
  const opportunityById = new Map(opportunities.map((opportunity) => [opportunity.id, opportunity] as const));

  return commitments.flatMap((commitment) => {
    const sponsorName = commitment.sponsorName.trim();
    const opportunity = opportunityById.get(commitment.opportunityId) ?? null;

    if (!sponsorName || !opportunity || opportunity.isActive === false || commitment.isActive === false) {
      return [];
    }

    return (opportunity.deliverables ?? []).map((deliverable) => ({
      id: [
        commitment.id,
        opportunity.id,
        deliverable.id,
        sponsorName,
        opportunity.label,
        deliverable.deliverableName,
        deliverable.category,
        deliverable.channel,
        deliverable.timingType,
        deliverable.offsetDays,
        deliverable.fixedMonth,
        deliverable.eventDayOffset,
        deliverable.requiresLogo ? "logo" : "no-logo",
        deliverable.requiresCopy ? "copy" : "no-copy",
        deliverable.requiresApproval ? "approval" : "no-approval"
      ].join("::"),
      sourceKey: JSON.stringify({
        eventInstanceId: commitment.eventInstanceId,
        placementId: opportunity.id,
        sponsorId: commitment.id,
        deliverableId: deliverable.id
      }),
      sponsorId: commitment.id,
      sponsorName,
      placementId: opportunity.id,
      placementName: opportunity.label.trim() || "Unnamed placement",
      linkedSubEventId: commitment.linkedSubEventId ?? opportunity.linkedSubEventId,
      sponsorNotes: commitment.notes,
      placementNotes: opportunity.notes,
      logoReceived: commitment.logoReceived,
      deliverableName: deliverable.deliverableName,
      deliverableId: deliverable.id,
      category: deliverable.category,
      channel: deliverable.channel,
      timingType: deliverable.timingType,
      offsetDays: deliverable.offsetDays,
      fixedMonth: deliverable.fixedMonth,
      eventDayOffset: deliverable.eventDayOffset,
      requiresLogo: deliverable.requiresLogo,
      requiresCopy: deliverable.requiresCopy,
      requiresApproval: deliverable.requiresApproval
    }));
  });
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
