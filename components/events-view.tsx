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

export function EventsView() {
  const router = useRouter();
  const {
    activeEventInstanceId,
    collateralItems,
    eventFamilies,
    eventInstances,
    eventSubEvents,
    eventTypes,
    items,
    sponsorPlacementsByInstance
  } = useAppStateValues();
  const {
    applyDefaultTemplateToInstance,
    createEventInstance,
    generateSponsorFulfillmentItems,
    removeEventSubEvent,
    removeSponsorPlacement,
    setActiveEventInstanceId,
    updateEventInstance,
    upsertEventSubEvent,
    upsertSponsorPlacement
  } = useAppActions();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pendingTemplateInstanceId, setPendingTemplateInstanceId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(activeEventInstanceId);
  const [hasDismissedDrawer, setHasDismissedDrawer] = useState(false);

  useEffect(() => {
    if (selectedInstanceId && eventInstances.some((instance) => instance.id === selectedInstanceId)) {
      return;
    }

    if (selectedInstanceId === null && hasDismissedDrawer) {
      return;
    }

    if (activeEventInstanceId && eventInstances.some((instance) => instance.id === activeEventInstanceId)) {
      setSelectedInstanceId(activeEventInstanceId);
      return;
    }

    const firstInstance = [...eventInstances].sort((left, right) => left.startDate.localeCompare(right.startDate))[0];
    setSelectedInstanceId(firstInstance?.id ?? null);
  }, [activeEventInstanceId, eventInstances, hasDismissedDrawer, selectedInstanceId]);

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
  const pendingTemplateInstance =
    pendingTemplateInstanceId
      ? eventInstances.find((instance) => instance.id === pendingTemplateInstanceId) ?? null
      : null;

  function handleCreateEventInstance(input: CreateEventInstanceInput) {
    const nextId = createEventInstance(input);
    setIsCreateOpen(false);
    setHasDismissedDrawer(false);
    setSelectedInstanceId(nextId);
    setFeedback(`${input.instanceName} created and set as the active event instance.`);

    if (getDefaultTemplatePackForEventType(input.eventTypeId)) {
      setPendingTemplateInstanceId(nextId);
      return;
    }

    router.push(`/collateral?eventInstanceId=${encodeURIComponent(nextId)}`);
  }

  function handleApplyTemplate() {
    if (!pendingTemplateInstanceId) {
      return;
    }

    applyDefaultTemplateToInstance(pendingTemplateInstanceId);
    router.push(`/collateral?eventInstanceId=${encodeURIComponent(pendingTemplateInstanceId)}`);
    setPendingTemplateInstanceId(null);
  }

  function handleSkipTemplate() {
    if (pendingTemplateInstanceId) {
      router.push(`/collateral?eventInstanceId=${encodeURIComponent(pendingTemplateInstanceId)}`);
    }

    setPendingTemplateInstanceId(null);
  }

  function handleOpenInCollateral(instanceId: string) {
    router.push(`/collateral?eventInstanceId=${encodeURIComponent(instanceId)}`);
  }

  function handleSelectInstance(instanceId: string) {
    setHasDismissedDrawer(false);
    setSelectedInstanceId(instanceId);
  }

  function handleCloseDrawer() {
    setHasDismissedDrawer(true);
    setSelectedInstanceId(null);
  }

  return (
    <section className="events-page page">
      <div className="events-page__header">
        <div>
          <h1 className="collateral-page__title">Events</h1>
          <p className="collateral-page__subtitle">
            Start event setup here: create or select an instance, confirm its sub-event schedule, then hand off into Collateral when production work is ready to begin.
          </p>
        </div>
        <div className="events-page__actions">
          <button className="topbar__button" onClick={() => setIsCreateOpen(true)} type="button">
            New Event Instance
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

      <div className="events-page__grid">
        <div className="events-page__main">
          <section className="card card--secondary events-selector-card">
            <div className="events-selector-card__header">
              <div className="card__title">Choose an Event Instance</div>
              <div className="events-selector-card__copy">
                Pick an instance to review its setup and confirm sub-event scheduling before moving into Collateral.
              </div>
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
                          ? "No collateral pack yet"
                          : group.definition.collateralTemplatePackId
                            ? "Collateral pack ready"
                            : "Can start empty"}
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
                    <span>{group.definition.defaultSubEvents.length} default sub-events</span>
                  </div>
                </div>
              </div>
              {group.instances.length > 0 ? (
                <div className="events-instance-list">
                  {group.instances.map((instance) => {
                    const isSelected = instance.id === onboardingView.selectedInstance?.instance.id;
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
                            {isSelected ? (
                              <span className="events-chip">Selected</span>
                            ) : null}
                          </div>
                          <div className="events-instance-card__meta">
                            <span>{formatEventDateRange(instance.startDate, instance.endDate)}</span>
                            {instance.location ? <span>{instance.location}</span> : null}
                            <span>{subEventCount} sub-event{subEventCount === 1 ? "" : "s"}</span>
                            <span>{group.definition.collateralTemplatePackId ? "Collateral pack available" : "Can start empty"}</span>
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
        </div>
      </div>

      {onboardingView.selectedInstance ? (
        <>
          <button
            aria-label="Close event setup drawer"
            className="drawer-backdrop"
            onClick={handleCloseDrawer}
            type="button"
          />
          <EventInstanceDetailPanel
            isActive={onboardingView.selectedInstance.instance.id === activeEventInstanceId}
            onClose={handleCloseDrawer}
            onOpenInCollateral={handleOpenInCollateral}
            onRemoveSubEvent={removeEventSubEvent}
            onSetActive={(instanceId) => {
              setActiveEventInstanceId(instanceId);
              setHasDismissedDrawer(false);
              setFeedback("Active event context updated.");
            }}
            onGenerateSponsorFulfillment={generateSponsorFulfillmentItems}
            onRemoveSponsorPlacement={removeSponsorPlacement}
            onUpsertSponsorPlacement={upsertSponsorPlacement}
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
            selectedInstance={onboardingView.selectedInstance}
            sponsorPlacements={sponsorPlacementsByInstance[onboardingView.selectedInstance.instance.id] ?? []}
          />
        </>
      ) : null}

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
