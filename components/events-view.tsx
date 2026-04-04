"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EventInstanceCreateModal } from "@/components/event-instance-create-modal";
import { EventInstanceTemplatePrompt } from "@/components/event-instance-template-prompt";
import { useAppActions, useAppStateValues, type CreateEventInstanceInput } from "@/components/app-state";
import { formatShortDate } from "@/lib/ops-utils";
import { getEventOnboardingGroups } from "@/lib/events/event-onboarding";
import { getDefaultTemplatePackForEventType } from "@/lib/collateral-templates";

export function EventsView() {
  const router = useRouter();
  const { activeEventInstanceId, eventFamilies, eventInstances, eventTypes } = useAppStateValues();
  const { applyDefaultTemplateToInstance, createEventInstance } = useAppActions();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [pendingTemplateInstanceId, setPendingTemplateInstanceId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const onboardingGroups = useMemo(
    () =>
      getEventOnboardingGroups({
        eventFamilies,
        eventTypes,
        eventInstances
      }),
    [eventFamilies, eventInstances, eventTypes]
  );
  const pendingTemplateInstance =
    pendingTemplateInstanceId
      ? eventInstances.find((instance) => instance.id === pendingTemplateInstanceId) ?? null
      : null;

  function handleCreateEventInstance(input: CreateEventInstanceInput) {
    const nextId = createEventInstance(input);
    setIsCreateOpen(false);
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

  return (
    <section className="events-page page">
      <div className="events-page__header">
        <div>
          <h1 className="collateral-page__title">Events</h1>
          <p className="collateral-page__subtitle">
            Create clean event instances, scaffold the recurring structure, and then hand off into Collateral for event production work.
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
          {onboardingGroups.map((group) => (
            <section className="card card--secondary events-group" key={group.definition.key}>
              <div className="events-group__header">
                <div>
                  <div className="card__title">{group.definition.label}</div>
                  <div className="events-group__meta">
                    <span>{group.eventFamilyName}</span>
                    <span>{group.definition.dateMode === "range" ? "Date range" : group.definition.dateMode === "single" ? "Single day" : "Multiple dates"}</span>
                    <span>{group.definition.defaultSubEvents.length} default sub-events</span>
                  </div>
                </div>
                <div className="events-group__tags">
                  <span className="events-chip">{group.definition.collateralTemplatePackId ? "Collateral pack ready" : "No collateral pack yet"}</span>
                  {group.definition.sponsorModelReference ? (
                    <span className="events-chip events-chip--accent">{group.definition.sponsorModelReference}</span>
                  ) : null}
                </div>
              </div>
              {group.instances.length > 0 ? (
                <div className="events-instance-list">
                  {group.instances.map((instance) => (
                    <article className="events-instance-card" key={instance.id}>
                      <div className="events-instance-card__body">
                        <div className="events-instance-card__title-row">
                          <strong>{instance.name}</strong>
                          {instance.id === activeEventInstanceId ? (
                            <span className="events-chip events-chip--active">Active</span>
                          ) : null}
                        </div>
                        <div className="events-instance-card__meta">
                          <span>{formatEventDateRange(instance.startDate, instance.endDate)}</span>
                          {instance.location ? <span>{instance.location}</span> : null}
                        </div>
                        {instance.notes ? <div className="events-instance-card__notes">{instance.notes}</div> : null}
                      </div>
                      <div className="events-instance-card__actions">
                        <button
                          className="button-link button-link--inline-secondary"
                          onClick={() => router.push(`/collateral?eventInstanceId=${encodeURIComponent(instance.id)}`)}
                          type="button"
                        >
                          Open in Collateral
                        </button>
                      </div>
                    </article>
                  ))}
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
          <section className="card card--secondary events-reference-card">
            <div className="card__title">How This Surface Works</div>
            <div className="events-reference-card__body">
              <p>Events owns the recurring structure: event type, default sub-events, date mode, and optional collateral pack references.</p>
              <p>Collateral owns the production records for a specific event instance.</p>
              <p>Action View owns the execution work generated downstream from those event and sponsor decisions.</p>
            </div>
          </section>
        </aside>
      </div>

      <EventInstanceCreateModal
        availableEventTypeDefinitions={onboardingGroups.map((group) => group.definition)}
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
