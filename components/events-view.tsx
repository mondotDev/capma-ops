"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EventInstanceCreateModal } from "@/components/event-instance-create-modal";
import { EventInstanceDetailPanel } from "@/components/event-instance-detail-panel";
import { EventInstanceTemplatePrompt } from "@/components/event-instance-template-prompt";
import {
  useAppActions,
  useAppStateValues,
  type CreateEventInstanceInput
} from "@/components/app-state";
import { formatShortDate } from "@/lib/ops-utils";
import { getEventOnboardingView } from "@/lib/events/event-onboarding";
import { getDefaultTemplatePackForEventType } from "@/lib/collateral-templates";
import {
  buildSponsorFulfillmentGenerationResult,
  ensureSponsorshipSetupForEventInstance
} from "@/lib/sponsor-fulfillment";

export function EventsView() {
  const router = useRouter();
  const {
    activeEventInstanceId,
    collateralItems,
    defaultOwnerForNewItems,
    eventFamilies,
    eventInstances,
    eventSubEvents,
    eventTypes,
    items,
    sponsorshipSetupByInstance
  } = useAppStateValues();
  const {
    addItem,
    applyDefaultTemplateToInstance,
    createEventInstance,
    removeEventSubEvent,
    removeSponsorCommitment,
    removeSponsorOpportunity,
    setActiveEventInstanceId,
    updateEventInstance,
    upsertEventSubEvent,
    upsertSponsorCommitment,
    upsertSponsorOpportunity
  } = useAppActions();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pendingTemplateInstanceId, setPendingTemplateInstanceId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(activeEventInstanceId);

  useEffect(() => {
    if (selectedInstanceId && eventInstances.some((instance) => instance.id === selectedInstanceId)) {
      return;
    }

    if (activeEventInstanceId && eventInstances.some((instance) => instance.id === activeEventInstanceId)) {
      setSelectedInstanceId(activeEventInstanceId);
      return;
    }

    const firstInstance = [...eventInstances].sort((left, right) => left.startDate.localeCompare(right.startDate))[0];
    setSelectedInstanceId(firstInstance?.id ?? null);
  }, [activeEventInstanceId, eventInstances, selectedInstanceId]);

  const onboardingView = useMemo(
    () =>
      getEventOnboardingView({
        eventFamilies,
        eventTypes,
        eventInstances,
        eventSubEvents,
        items,
        collateralItems,
        selectedInstanceId
      }),
    [collateralItems, eventFamilies, eventInstances, eventSubEvents, eventTypes, items, selectedInstanceId]
  );
  const selectedWorkspaceInstance = onboardingView.selectedInstance;
  const selectedSponsorshipSetup = selectedWorkspaceInstance
    ? ensureSponsorshipSetupForEventInstance(
        selectedWorkspaceInstance.instance.id,
        selectedWorkspaceInstance.instance.eventTypeId,
        sponsorshipSetupByInstance[selectedWorkspaceInstance.instance.id] ?? null
      )
    : null;
  const selectedSponsorGenerationPreview = useMemo(() => {
    if (!selectedWorkspaceInstance || !selectedSponsorshipSetup) {
      return null;
    }

    return buildSponsorFulfillmentGenerationResult({
      sponsorshipSetup: selectedSponsorshipSetup,
      eventInstance: selectedWorkspaceInstance.instance,
      existingItems: items,
      existingCollateralItems: collateralItems,
      defaultOwner: defaultOwnerForNewItems,
      eventSubEvents
    });
  }, [collateralItems, defaultOwnerForNewItems, eventSubEvents, items, selectedSponsorshipSetup, selectedWorkspaceInstance]);
  const pendingTemplateInstance =
    pendingTemplateInstanceId
      ? eventInstances.find((instance) => instance.id === pendingTemplateInstanceId) ?? null
      : null;

  function handleCreateEventInstance(input: CreateEventInstanceInput) {
    const nextId = createEventInstance(input);
    setIsCreateOpen(false);
    setSelectedInstanceId(nextId);
    setFeedback(`${input.instanceName} created and set as the active event instance.`);

    if (getDefaultTemplatePackForEventType(input.eventTypeId)) {
      setPendingTemplateInstanceId(nextId);
    }
  }

  function handleApplyTemplate() {
    if (!pendingTemplateInstanceId) {
      return;
    }

    applyDefaultTemplateToInstance(pendingTemplateInstanceId);
    setPendingTemplateInstanceId(null);
    setFeedback("Collateral options were applied. Continue setup here or open Collateral when you're ready.");
  }

  function handleSkipTemplate() {
    setPendingTemplateInstanceId(null);
    setFeedback("Event created. Continue setup in Events and open Collateral later if needed.");
  }

  function handleOpenInCollateral(instanceId: string) {
    router.push(`/collateral?eventInstanceId=${encodeURIComponent(instanceId)}`);
  }

  function handleSelectInstance(instanceId: string) {
    setSelectedInstanceId(instanceId);
  }

  return (
    <section className="events-page page">
      <div className="events-page__header">
        <div>
          <h1 className="collateral-page__title">Events</h1>
          <p className="collateral-page__subtitle">
            Manage event records, open an event-centered workspace, and keep setup clear before work flows into Action View and Collateral.
          </p>
        </div>
        <div className="events-page__actions">
          <button className="topbar__button" onClick={() => setIsCreateOpen(true)} type="button">
            Add New Event
          </button>
        </div>
      </div>

      {feedback ? (
        <div className="collateral-setup-banner" role="status">
          <span>{feedback}</span>
          <button className="button-link button-link--inline-secondary" onClick={() => setFeedback("")} type="button">
            Dismiss
          </button>
        </div>
      ) : null}

      <section className="card card--secondary events-selector-card events-selector-card--board">
        <div className="events-selector-card__header events-selector-card__header--board">
          <div>
            <div className="card__title">Event Records</div>
            <div className="events-selector-card__copy">
              Choose an event card to open its workspace. The selected event becomes the clear home for basics, sub-events, placements, sponsors, collateral context, and fulfillment preview.
            </div>
          </div>
          <button className="button-link button-link--inline-secondary" onClick={() => setIsCreateOpen(true)} type="button">
            Add New Event
          </button>
        </div>
        {onboardingView.groups.map((group) => (
          <section className="events-group" key={group.definition.key}>
            <div className="events-group__header">
              <div>
                <div className="events-group__title-row">
                  <div className="card__title">{group.definition.label}</div>
                  <div className="events-group__tags">
                    <span className="events-chip">
                      {group.definition.supportsCollateral === false
                        ? "Collateral handled manually"
                        : group.definition.collateralTemplatePackId
                          ? "Collateral options available"
                          : "Ready for manual setup"}
                    </span>
                    {group.definition.supportsSponsorSetup ? (
                      <span className="events-chip events-chip--accent">
                        {group.definition.sponsorModelReference ?? "Sponsor setup supported"}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="events-group__meta">
                  <span>{group.eventFamilyName}</span>
                  <span>{describeDateMode(group.definition.dateMode)}</span>
                  <span>{group.definition.defaultSubEvents.length} common sub-event lanes</span>
                </div>
              </div>
            </div>
            {group.instances.length > 0 ? (
              <div className="events-instance-list events-instance-list--board">
                {group.instances.map((instance) => {
                  const isSelected = instance.id === selectedWorkspaceInstance?.instance.id;
                  const scheduleStatus = getInstanceScheduleStatus(instance.id, eventSubEvents);
                  const subEventCount = getInstanceSubEventCount(instance.id, eventSubEvents);

                  return (
                    <article
                      className={`events-instance-card${isSelected ? " events-instance-card--selected" : ""}`}
                      key={instance.id}
                    >
                      <button
                        className="events-instance-card__body events-instance-card__body--button"
                        onClick={() => handleSelectInstance(instance.id)}
                        type="button"
                      >
                        <div className="events-instance-card__title-row">
                          <strong>{instance.name}</strong>
                          <span className={`events-chip${isSelected ? " events-chip--workspace-active" : ""}`}>
                            {isSelected ? "Open Event" : "Open Workspace"}
                          </span>
                        </div>
                        <div className="events-instance-card__meta">
                          <span>{formatEventDateRange(instance.startDate, instance.endDate)}</span>
                          {instance.location ? <span>{instance.location}</span> : null}
                          <span>{subEventCount} sub-event{subEventCount === 1 ? "" : "s"}</span>
                          <span>{group.definition.collateralTemplatePackId ? "Collateral options available" : "Manual collateral setup"}</span>
                          <span>{formatScheduleStatus(scheduleStatus)}</span>
                        </div>
                        {instance.notes ? <div className="events-instance-card__notes">{instance.notes}</div> : null}
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="events-group__empty">
                No instances created for this event type yet.
              </div>
            )}
          </section>
        ))}
      </section>

      <section className="events-page__workspace">
        {selectedWorkspaceInstance ? (
          <div className="events-page__workspace-header">
            <div>
              <div className="card__title">Selected Event</div>
              <div className="events-selector-card__copy">
                You are viewing <strong>{selectedWorkspaceInstance.instance.name}</strong>. Use the section navigation inside the workspace to move between event setup areas.
              </div>
            </div>
          </div>
        ) : null}
        <div className="events-page__workspace-body">
          {selectedWorkspaceInstance ? (
          <EventInstanceDetailPanel
            addItem={addItem}
            actionItemCount={items.filter((item) => item.eventInstanceId === selectedWorkspaceInstance.instance.id).length}
            actionViewHref={`/action?focus=sponsor&eventGroup=${encodeURIComponent(selectedWorkspaceInstance.instance.name)}`}
            collateralItemCount={collateralItems.filter((item) => item.eventInstanceId === selectedWorkspaceInstance.instance.id).length}
            isActive={selectedWorkspaceInstance.instance.id === activeEventInstanceId}
            items={items}
            onOpenInAction={(href) => router.push(href)}
            onOpenInCollateral={handleOpenInCollateral}
            onRemoveSubEvent={removeEventSubEvent}
            onSetActive={(instanceId) => {
              setActiveEventInstanceId(instanceId);
              setFeedback("Active event context updated.");
            }}
            onRemoveSponsorCommitment={removeSponsorCommitment}
            onRemoveSponsorOpportunity={removeSponsorOpportunity}
            onUpsertSponsorCommitment={upsertSponsorCommitment}
            onUpsertSponsorOpportunity={upsertSponsorOpportunity}
            onUpdateInstance={(instanceId, updates) => {
              const didUpdate = updateEventInstance(instanceId, updates);
              if (didUpdate) {
                setFeedback("Event instance details saved.");
              }
              return didUpdate;
            }}
            onUpsertSubEvent={(instanceId, input) => {
              const nextId = upsertEventSubEvent(instanceId, input);
              if (nextId) {
                setFeedback(input.id ? "Sub-event updated." : "Manual sub-event added.");
              }
              return nextId;
            }}
            selectedInstance={selectedWorkspaceInstance}
            sponsorGenerationPreview={selectedSponsorGenerationPreview}
            sponsorshipSetup={selectedSponsorshipSetup}
          />
          ) : (
            <section className="card card--secondary events-builder-empty">
              <div className="empty-state__title">Select an event card to open its workspace</div>
              <div className="empty-state__copy">
                Create a new event or choose an existing event record above to continue setup, sponsor edits, and downstream review.
              </div>
            </section>
          )}
        </div>
      </section>

      <EventInstanceCreateModal
        availableEventTypeDefinitions={onboardingView.groups.map((group) => group.definition)}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreateEventInstance}
      />
      <EventInstanceTemplatePrompt
        instanceName={pendingTemplateInstance?.name ?? "New event instance"}
        isOpen={Boolean(pendingTemplateInstanceId)}
        onApply={handleApplyTemplate}
        onSkip={handleSkipTemplate}
      />
    </section>
  );
}

function formatEventDateRange(startDate: string, endDate: string) {
  if (!startDate) {
    return "";
  }

  if (!endDate || startDate === endDate) {
    return formatShortDate(startDate);
  }

  return `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`;
}

function describeDateMode(dateMode: "single" | "range" | "multiple") {
  if (dateMode === "range") {
    return "Date range";
  }

  if (dateMode === "single") {
    return "Single day";
  }

  return "Multiple dates";
}

function getInstanceScheduleStatus(instanceId: string, eventSubEvents: Array<{ eventInstanceId: string; id: string; date?: string }>) {
  const schedulableSubEvents = eventSubEvents.filter(
    (subEvent) => subEvent.eventInstanceId === instanceId && !subEvent.id.endsWith("-unassigned")
  );

  if (schedulableSubEvents.length === 0) {
    return "none";
  }

  const scheduledCount = schedulableSubEvents.filter((subEvent) => Boolean(subEvent.date)).length;

  if (scheduledCount === 0) {
    return "none";
  }

  if (scheduledCount === schedulableSubEvents.length) {
    return "scheduled";
  }

  return "partial";
}

function getInstanceSubEventCount(instanceId: string, eventSubEvents: Array<{ eventInstanceId: string; id: string }>) {
  return eventSubEvents.filter(
    (subEvent) => subEvent.eventInstanceId === instanceId && !subEvent.id.endsWith("-unassigned")
  ).length;
}

function formatScheduleStatus(status: "none" | "partial" | "scheduled") {
  if (status === "scheduled") {
    return "Sub-events scheduled";
  }

  if (status === "partial") {
    return "Sub-events partially scheduled";
  }

  return "Sub-event schedule still needed";
}
