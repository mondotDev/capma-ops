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
    items
  } = useAppStateValues();
  const {
    applyDefaultTemplateToInstance,
    createEventInstance,
    removeEventSubEvent,
    setActiveEventInstanceId,
    updateEventInstance,
    upsertEventSubEvent
  } = useAppActions();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pendingTemplateInstanceId, setPendingTemplateInstanceId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(activeEventInstanceId);

  useEffect(() => {
    if (selectedInstanceId && eventInstances.some((instance) => instance.id === selectedInstanceId)) {
      return;
    }

    setSelectedInstanceId(activeEventInstanceId);
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

  return (
    <section className="events-page page">
      <div className="events-page__header">
        <div>
          <h1 className="collateral-page__title">Events</h1>
          <p className="collateral-page__subtitle">
            Start new event setup here: create the instance, confirm sub-event schedule, then hand off into Collateral for production work and Action View for downstream execution pressure.
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
          {onboardingView.groups.map((group) => (
            <section className="card card--secondary events-group" key={group.definition.key}>
              <div className="events-group__header">
                <div>
                  <div className="card__title">{group.definition.label}</div>
                  <div className="events-group__meta">
                    <span>{group.eventFamilyName}</span>
                    <span>{describeDateMode(group.definition.dateMode)}</span>
                    <span>{group.definition.defaultSubEvents.length} default sub-events</span>
                  </div>
                  {group.definition.description ? (
                    <div className="events-group__description">{group.definition.description}</div>
                  ) : null}
                </div>
                <div className="events-group__tags">
                  <span className="events-chip">
                    {group.definition.supportsCollateral === false
                      ? "No collateral pack yet"
                      : group.definition.collateralTemplatePackId
                        ? "Collateral pack ready"
                        : "Collateral-ready scaffold"}
                  </span>
                  {group.definition.supportsSponsorSetup ? (
                    <span className="events-chip events-chip--accent">
                      {group.definition.sponsorModelReference ?? "Sponsor setup supported"}
                    </span>
                  ) : null}
                </div>
              </div>
              {group.instances.length > 0 ? (
                <div className="events-instance-list">
                  {group.instances.map((instance) => {
                    const isSelected = instance.id === onboardingView.selectedInstance?.instance.id;
                    const isActive = instance.id === activeEventInstanceId;
                    const scheduleStatus = getInstanceScheduleStatus(instance.id, eventSubEvents);
                    return (
                      <article
                        className={`events-instance-card${isSelected ? " events-instance-card--selected" : ""}`}
                        key={instance.id}
                      >
                        <button
                          className="events-instance-card__body events-instance-card__body--button"
                          onClick={() => setSelectedInstanceId(instance.id)}
                          type="button"
                        >
                          <div className="events-instance-card__title-row">
                            <strong>{instance.name}</strong>
                            {isActive ? (
                              <span className="events-chip events-chip--active">Active</span>
                            ) : null}
                            {isSelected ? (
                              <span className="events-chip">Selected</span>
                            ) : null}
                          </div>
                          <div className="events-instance-card__meta">
                            <span>{formatEventDateRange(instance.startDate, instance.endDate)}</span>
                            {instance.location ? <span>{instance.location}</span> : null}
                            <span>{group.definition.collateralTemplatePackId ? "Pack available" : "Start empty"}</span>
                            <span>{formatScheduleStatus(scheduleStatus)}</span>
                          </div>
                          {instance.notes ? <div className="events-instance-card__notes">{instance.notes}</div> : null}
                        </button>
                        <div className="events-instance-card__actions">
                          <button
                            className="button-link button-link--inline-secondary"
                            onClick={() => handleOpenInCollateral(instance.id)}
                            type="button"
                          >
                            Open in Collateral
                          </button>
                        </div>
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
        </div>
        <aside className="events-page__aside">
          <EventInstanceDetailPanel
            isActive={onboardingView.selectedInstance?.instance.id === activeEventInstanceId}
            onOpenInCollateral={handleOpenInCollateral}
            onRemoveSubEvent={removeEventSubEvent}
            onSetActive={(instanceId) => {
              setActiveEventInstanceId(instanceId);
              setFeedback("Active event context updated.");
            }}
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
          />

          <section className="card card--secondary events-reference-card">
            <div className="card__title">How This Surface Works</div>
            <div className="events-reference-card__body">
              <p>Events owns the recurring structure: event type, default sub-events, date mode, and whether a collateral or sponsor model is ready.</p>
              <p>Collateral owns the production records for a specific event instance once the scaffold is in place.</p>
              <p>Action View owns the execution work generated downstream from those event and sponsor decisions.</p>
            </div>
          </section>
        </aside>
      </div>

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

function formatScheduleStatus(status: "none" | "partial" | "scheduled") {
  if (status === "scheduled") {
    return "Sub-events scheduled";
  }

  if (status === "partial") {
    return "Sub-events partially scheduled";
  }

  return "Sub-event schedule still needed";
}
