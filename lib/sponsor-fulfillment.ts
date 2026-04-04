import type { NewActionItemInput } from "@/lib/action-item-mutations";
import type { LegDayCollateralProfile } from "@/lib/collateral-data";
import type { EventInstance, EventSubEvent } from "@/lib/event-instances";
import type { ActionItem } from "@/lib/sample-data";
import { createActionNoteEntry, LOCAL_FALLBACK_NOTE_AUTHOR } from "@/lib/ops-utils";

export const SPONSOR_SUPPORTED_EVENT_TYPE_ID = "legislative-day";

export const SPONSOR_PLACEMENT_OPTIONS = [
  {
    id: "thank-you-sign",
    label: "Thank-you signage"
  },
  {
    id: "table-tents",
    label: "Table tents"
  },
  {
    id: "slide-mention",
    label: "Slide / deck mention"
  }
] as const;

export type SponsorPlacementType = (typeof SPONSOR_PLACEMENT_OPTIONS)[number]["id"];

export type SponsorPlacement = {
  id: string;
  eventInstanceId: string;
  sponsorName: string;
  placementType: SponsorPlacementType;
  subEventId?: string;
  notes?: string;
};

export type SponsorPlacementsByInstance = Record<string, SponsorPlacement[]>;

export type SponsorFulfillmentGenerationResult = {
  created: NewActionItemInput[];
  skipped: number;
};

export function supportsSponsorSetupForEventType(eventTypeId: string) {
  return eventTypeId === SPONSOR_SUPPORTED_EVENT_TYPE_ID;
}

export function createSponsorPlacementDraft(eventInstanceId: string): SponsorPlacement {
  return {
    id: `sponsor-placement-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    eventInstanceId,
    sponsorName: "",
    placementType: SPONSOR_PLACEMENT_OPTIONS[0].id,
    subEventId: undefined,
    notes: ""
  };
}

export function normalizeSponsorPlacement(
  value: Partial<SponsorPlacement>,
  input: {
    eventInstances: EventInstance[];
    eventSubEvents: EventSubEvent[];
  }
): SponsorPlacement | null {
  if (
    typeof value.id !== "string" ||
    typeof value.eventInstanceId !== "string" ||
    typeof value.sponsorName !== "string" ||
    typeof value.placementType !== "string"
  ) {
    return null;
  }

  if (!input.eventInstances.some((instance) => instance.id === value.eventInstanceId)) {
    return null;
  }

  if (!isSponsorPlacementType(value.placementType)) {
    return null;
  }

  const normalizedSubEventId =
    typeof value.subEventId === "string" &&
    input.eventSubEvents.some(
      (subEvent) => subEvent.id === value.subEventId && subEvent.eventInstanceId === value.eventInstanceId
    )
      ? value.subEventId
      : undefined;

  return {
    id: value.id,
    eventInstanceId: value.eventInstanceId,
    sponsorName: value.sponsorName.trim(),
    placementType: value.placementType,
    subEventId: normalizedSubEventId,
    notes: typeof value.notes === "string" && value.notes.trim() ? value.notes.trim() : undefined
  };
}

export function normalizeSponsorPlacementsByInstance(
  placementsByInstance: SponsorPlacementsByInstance | undefined,
  input: {
    eventInstances: EventInstance[];
    eventSubEvents: EventSubEvent[];
  }
): SponsorPlacementsByInstance {
  if (!placementsByInstance || typeof placementsByInstance !== "object" || Array.isArray(placementsByInstance)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(placementsByInstance)
      .filter(([instanceId]) => input.eventInstances.some((instance) => instance.id === instanceId))
      .map(([instanceId, placements]) => [
        instanceId,
        Array.isArray(placements)
          ? placements
              .map((placement) =>
                placement && typeof placement === "object"
                  ? normalizeSponsorPlacement(placement as Partial<SponsorPlacement>, input)
                  : null
              )
              .filter((placement): placement is SponsorPlacement => placement !== null)
          : []
      ])
  );
}

export function buildSponsorFulfillmentGenerationResult(input: {
  placements: SponsorPlacement[];
  eventInstance: EventInstance;
  eventSubEvents: EventSubEvent[];
  activeProfile: LegDayCollateralProfile | null;
  existingItems: ActionItem[];
  defaultOwner: string;
}): SponsorFulfillmentGenerationResult {
  const seenPlacementKeys = new Set<string>();
  const created: NewActionItemInput[] = [];
  let skipped = 0;

  for (const placement of input.placements) {
    const normalizedSponsorName = placement.sponsorName.trim();

    if (!normalizedSponsorName) {
      skipped += 1;
      continue;
    }

    const placementKey = serializeSponsorPlacementKey(placement);

    if (seenPlacementKeys.has(placementKey)) {
      skipped += 1;
      continue;
    }

    seenPlacementKeys.add(placementKey);

    const generatedTask = createSponsorFulfillmentTask({
      placement,
      eventInstance: input.eventInstance,
      eventSubEvents: input.eventSubEvents,
      activeProfile: input.activeProfile,
      defaultOwner: input.defaultOwner
    });

    if (
      input.existingItems.some((item) =>
        matchesSponsorFulfillmentTask(item, generatedTask, placement)
      )
    ) {
      skipped += 1;
      continue;
    }

    created.push(generatedTask);
  }

  return { created, skipped };
}

export function getSponsorPlacementTypeLabel(type: SponsorPlacementType) {
  return SPONSOR_PLACEMENT_OPTIONS.find((option) => option.id === type)?.label ?? "Sponsor placement";
}

function createSponsorFulfillmentTask(input: {
  placement: SponsorPlacement;
  eventInstance: EventInstance;
  eventSubEvents: EventSubEvent[];
  activeProfile: LegDayCollateralProfile | null;
  defaultOwner: string;
}): NewActionItemInput {
  const placementLabel = getSponsorPlacementTypeLabel(input.placement.placementType);
  const subEventName =
    input.placement.subEventId
      ? input.eventSubEvents.find((subEvent) => subEvent.id === input.placement.subEventId)?.name ?? ""
      : "";
  const title = subEventName
    ? `${input.placement.sponsorName}: ${placementLabel} for ${subEventName}`
    : `${input.placement.sponsorName}: ${placementLabel}`;
  const notes = [
    `Generated from sponsor setup for ${input.eventInstance.name}.`,
    input.placement.notes?.trim() || ""
  ].filter(Boolean).join(" ");
  const initialNote = createActionNoteEntry(notes, {
    author: LOCAL_FALLBACK_NOTE_AUTHOR
  });

  return {
    type: "Task",
    title,
    workstream: "Legislative Day",
    eventInstanceId: input.eventInstance.id,
    subEventId: input.placement.subEventId,
    operationalBucket: undefined,
    issue: undefined,
    dueDate: input.activeProfile?.logoDeadline || input.activeProfile?.externalPrintingDue || "",
    owner: input.defaultOwner,
    status: "Not Started",
    waitingOn: "",
    isBlocked: undefined,
    blockedBy: "",
    noteEntries: initialNote ? [initialNote] : []
  };
}

function matchesSponsorFulfillmentTask(
  item: ActionItem,
  generatedTask: NewActionItemInput,
  placement: SponsorPlacement
) {
  return (
    item.workstream === generatedTask.workstream &&
    item.eventInstanceId === placement.eventInstanceId &&
    (item.subEventId ?? "") === (placement.subEventId ?? "") &&
    item.title.trim() === generatedTask.title.trim()
  );
}

function serializeSponsorPlacementKey(placement: SponsorPlacement) {
  return JSON.stringify({
    eventInstanceId: placement.eventInstanceId,
    sponsorName: placement.sponsorName.trim().toLowerCase(),
    placementType: placement.placementType,
    subEventId: placement.subEventId ?? ""
  });
}

function isSponsorPlacementType(value: string): value is SponsorPlacementType {
  return SPONSOR_PLACEMENT_OPTIONS.some((option) => option.id === value);
}
