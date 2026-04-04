"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ActionItemNotesPanel } from "@/components/action-item-notes-panel";
import { useCollateralWorkspaceReadModel } from "@/components/app-read-models";
import {
  CollateralProfileCard,
  type CollateralProfileDeadlineFilter
} from "@/components/collateral-profile-card";
import {
  CollateralSummaryStrip,
  type CollateralSummaryFilter
} from "@/components/collateral-summary-strip";
import {
  useAppActions,
  useAppStateValues,
  type CreateEventInstanceInput
} from "@/components/app-state";
import { EventInstanceCreateModal } from "@/components/event-instance-create-modal";
import { EventInstanceTemplatePrompt } from "@/components/event-instance-template-prompt";
import {
  COLLATERAL_STATUS_OPTIONS,
  COLLATERAL_UPDATE_TYPE_OPTIONS,
  isCollateralArchived,
  isCollateralBlocked,
  isCollateralDueSoon,
  isCollateralOverdue,
  normalizeCollateralWorkflowStatus,
  type CollateralItem,
} from "@/lib/collateral-data";
import {
  getCollateralCreateTraceId,
  setCollateralCreateTraceId,
  traceCollateralCreate
} from "@/lib/collateral-create-trace";
import { getDefaultTemplatePackForEventType, supportsCollateralEventType } from "@/lib/collateral-templates";
import {
  getAvailableEventTypeDefinitions
} from "@/lib/event-type-definitions";
import {
  SCHEDULED_WORKSTREAM_OPTIONS,
  type WorkstreamSchedule,
  type WorkstreamScheduleMode,
  createActionNoteEntry,
  formatShortDate,
  getOwnerOptions,
  LOCAL_FALLBACK_NOTE_AUTHOR
} from "@/lib/ops-utils";
import {
  buildSponsorFulfillmentGenerationResult,
  createSponsorPlacementDraft,
  getSponsorPlacementOptions,
  getSponsorCollateralPromotionDefaults,
  getSponsorPlacementDeliverables,
  getSponsorPlacementLabel,
  getSponsorFulfillmentTaskTitle,
  supportsSponsorSetupForEventType
} from "@/lib/sponsor-fulfillment";

type PendingDraftDiscardIntent =
  | { type: "switch"; nextEventInstanceId: string }
  | { type: "createInstance" }
  | { type: "sponsorPromotion"; actionItemId: string; eventInstanceId: string }
  | null;

type PendingCollateralOpenIntent = {
  collateralId: string;
  eventInstanceId: string;
};

type PendingSponsorPromotionIntent = {
  actionItemId: string;
  eventInstanceId: string;
};

const DRAFT_COLLATERAL_ID = "__draft-collateral__";

type SponsorGenerationPreview = {
  readyCount: number;
  skippedCount: number;
  actionItemsToCreate: number;
  previewTitles: string[];
};

export function CollateralView({
  initialEventInstanceId,
  initialSelectedCollateralId
}: {
  initialEventInstanceId?: string;
  initialSelectedCollateralId?: string;
}) {
  const { defaultOwnerForNewItems, items, sponsorPlacementsByInstance, workstreamSchedules } = useAppStateValues();
  const {
    addCollateralItem,
    applyDefaultTemplateToInstance,
    createEventInstance,
    deleteCollateralItem,
    ensureEventInstanceUnassignedSubEvent,
    setActiveEventInstanceId,
    setCollateralProfile,
    setWorkstreamSchedules,
    upsertSponsorPlacement,
    removeSponsorPlacement,
    generateSponsorFulfillmentItems,
    updateCollateralItem
  } = useAppActions();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreateInstanceOpen, setIsCreateInstanceOpen] = useState(false);
  const [pendingTemplateInstanceId, setPendingTemplateInstanceId] = useState<string | null>(null);
  const [pendingCreateInstanceInput, setPendingCreateInstanceInput] = useState<CreateEventInstanceInput | null>(null);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [draftCollateralItem, setDraftCollateralItem] = useState<CollateralItem | null>(null);
  const [pendingDraftDiscardIntent, setPendingDraftDiscardIntent] = useState<PendingDraftDiscardIntent>(null);
  const [setupFeedback, setSetupFeedback] = useState<string>("");
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [activeSummaryFilter, setActiveSummaryFilter] = useState<CollateralSummaryFilter>("all");
  const [activeProfileDeadlineFilter, setActiveProfileDeadlineFilter] =
    useState<CollateralProfileDeadlineFilter>("none");
  const [showArchived, setShowArchived] = useState(false);
  const [pendingOpenIntent, setPendingOpenIntent] = useState<PendingCollateralOpenIntent>(() => ({
    collateralId: initialSelectedCollateralId ?? searchParams.get("collateralId") ?? "",
    eventInstanceId: initialEventInstanceId ?? searchParams.get("eventInstanceId") ?? ""
  }));
  const [pendingSponsorPromotionIntent, setPendingSponsorPromotionIntent] =
    useState<PendingSponsorPromotionIntent | null>(() => {
      const actionItemId = searchParams.get("promoteActionItemId") ?? "";
      const eventInstanceId = initialEventInstanceId ?? searchParams.get("eventInstanceId") ?? "";

      if (!actionItemId || !eventInstanceId) {
        return null;
      }

      return {
        actionItemId,
        eventInstanceId
      };
    });

  const {
    workspaceBundle,
    collateralListView,
    selectedWorkspace,
    eventPrograms
  } = useCollateralWorkspaceReadModel({
    activeSummaryFilter,
    activeProfileDeadlineFilter,
    selectedId,
    draftCollateralItem,
    showArchived
  });
  const resolvedActiveEventInstanceId = workspaceBundle.resolvedActiveEventInstanceId;
  const selectedEventInstance = workspaceBundle.selectedEventInstance;
  const currentEventProgram = workspaceBundle.currentEventProgram;
  const defaultTemplatePack = workspaceBundle.defaultTemplatePack;
  const isSelectedEventProgramSupported = workspaceBundle.isSelectedEventProgramSupported;
  const activeProfile = workspaceBundle.activeProfile;
  const scheduledWorkstream = getScheduledWorkstreamForEventProgram(currentEventProgram?.name ?? "");
  const currentProgramSchedule = scheduledWorkstream
    ? workstreamSchedules.find((entry) => entry.workstream === scheduledWorkstream) ?? null
    : null;
  const sponsorPlacements = sponsorPlacementsByInstance[resolvedActiveEventInstanceId] ?? [];
  const supportsSponsorSetup = selectedEventInstance
    ? supportsSponsorSetupForEventType(selectedEventInstance.eventTypeId)
    : false;
  const sponsorPlacementOptions = useMemo(
    () => (selectedEventInstance ? getSponsorPlacementOptions(selectedEventInstance.eventTypeId) : []),
    [selectedEventInstance]
  );
  const eventInstancesByProgram = workspaceBundle.eventInstancesByProgram;
  const creatableEventTypeDefinitions = useMemo(() => getAvailableEventTypeDefinitions(eventPrograms), [eventPrograms]);
  const sponsorGenerationPreview = useMemo<SponsorGenerationPreview | null>(() => {
    if (!selectedEventInstance || !supportsSponsorSetup) {
      return null;
    }

    const readyCount = sponsorPlacements.filter((placement) => placement.sponsorName.trim().length > 0).length;
    const generationResult = buildSponsorFulfillmentGenerationResult({
      placements: sponsorPlacements,
      eventInstance: selectedEventInstance,
      existingItems: items,
      defaultOwner: defaultOwnerForNewItems,
      eventSubEvents: workspaceBundle.instanceSubEvents
    });

    return {
      readyCount,
      skippedCount: generationResult.skipped,
      actionItemsToCreate: generationResult.created.length,
      previewTitles: generationResult.created.slice(0, 3).map((item) => item.title)
    };
  }, [
    defaultOwnerForNewItems,
    items,
    selectedEventInstance,
    sponsorPlacements,
    supportsSponsorSetup,
    workspaceBundle.instanceSubEvents
  ]);

  useEffect(() => {
    setIsActionsMenuOpen(false);
    setIsDeleteConfirmOpen(false);
  }, [selectedId, resolvedActiveEventInstanceId]);

  useEffect(() => {
    setActiveSummaryFilter("all");
    setActiveProfileDeadlineFilter("none");
  }, [resolvedActiveEventInstanceId]);

  useEffect(() => {
    setNoteDraft("");
  }, [selectedId]);

  useEffect(() => {
    setDraftCollateralItem((current) =>
      current && current.eventInstanceId !== resolvedActiveEventInstanceId ? null : current
    );
  }, [resolvedActiveEventInstanceId]);

  useEffect(() => {
    if (!searchParams.get("promoteActionItemId")) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("promoteActionItemId");
    const nextQuery = params.toString();
    router.replace(nextQuery ? `/collateral?${nextQuery}` : "/collateral");
  }, [router, searchParams]);

  useEffect(() => {
    if (!pendingOpenIntent.eventInstanceId) {
      return;
    }

    if (draftCollateralItem) {
      return;
    }

    if (pendingOpenIntent.eventInstanceId !== resolvedActiveEventInstanceId) {
      setActiveEventInstanceId(pendingOpenIntent.eventInstanceId);
      return;
    }

    setPendingOpenIntent((current) => ({ ...current, eventInstanceId: "" }));
  }, [
    draftCollateralItem,
    pendingOpenIntent.eventInstanceId,
    resolvedActiveEventInstanceId,
    setActiveEventInstanceId
  ]);

  useEffect(() => {
    if (!pendingSponsorPromotionIntent) {
      return;
    }

    if (draftCollateralItem) {
      setPendingDraftDiscardIntent((current) =>
        current ?? {
          type: "sponsorPromotion",
          actionItemId: pendingSponsorPromotionIntent.actionItemId,
          eventInstanceId: pendingSponsorPromotionIntent.eventInstanceId
        }
      );
      return;
    }

    if (pendingSponsorPromotionIntent.eventInstanceId !== resolvedActiveEventInstanceId) {
      setActiveEventInstanceId(pendingSponsorPromotionIntent.eventInstanceId);
      return;
    }

    const sourceItem = items.find((item) => item.id === pendingSponsorPromotionIntent.actionItemId);
    if (!sourceItem) {
      setSetupFeedback("The sponsor action item could not be found, so no collateral draft was created.");
      setPendingSponsorPromotionIntent(null);
      return;
    }

    const promotionDefaults = getSponsorCollateralPromotionDefaults({
      item: sourceItem,
      eventSubEvents: workspaceBundle.instanceSubEvents
    });

    if (!promotionDefaults) {
      setSetupFeedback("This sponsor action item does not map to a collateral draft yet.");
      setPendingSponsorPromotionIntent(null);
      return;
    }

    const promotionNoteEntry = createActionNoteEntry(
      `Created from sponsor action item "${sourceItem.title}". Placement: ${getSponsorPlacementLabel(
        promotionDefaults.placement,
        selectedEventInstance?.eventTypeId ?? "legislative-day"
      )}.`,
      { author: LOCAL_FALLBACK_NOTE_AUTHOR }
    );

    const nextDraft = {
      id: DRAFT_COLLATERAL_ID,
      eventInstanceId: promotionDefaults.eventInstanceId,
      subEventId: promotionDefaults.subEventId,
      itemName: promotionDefaults.collateralItemName,
      status: "Backlog",
      owner: defaultOwnerForNewItems,
      blockedBy: "",
      dueDate: "",
      printer: "",
      quantity: "",
      updateType: "",
      noteEntries: promotionNoteEntry ? [promotionNoteEntry] : [],
      lastUpdated: new Date().toISOString().slice(0, 10)
    } satisfies CollateralItem;

    setDraftCollateralItem(nextDraft);
    setSelectedId(DRAFT_COLLATERAL_ID);
    setActiveSummaryFilter("all");
    setActiveProfileDeadlineFilter("none");
    setSetupFeedback(
      `Opened a prefilled collateral draft for ${promotionDefaults.collateralItemName}. Review and save it when you're ready.`
    );
    setPendingSponsorPromotionIntent(null);
  }, [
    defaultOwnerForNewItems,
    draftCollateralItem,
    items,
    pendingSponsorPromotionIntent,
    resolvedActiveEventInstanceId,
    setActiveEventInstanceId,
    workspaceBundle.instanceSubEvents
  ]);

  const instanceItems = collateralListView.instanceItems;
  const visibleInstanceItems = collateralListView.visibleInstanceItems;
  const groupedItems = collateralListView.groupedItems;
  const summary = collateralListView.summary;
  const selectedItem = selectedWorkspace.selectedItem;
  const subEventNameById = selectedWorkspace.subEventNameById;
  const selectedSubEventOptions = selectedWorkspace.subEventOptions;
  const emptySubEventId = selectedWorkspace.emptySubEventId;
  const selectedEventDateRange = workspaceBundle.selectedEventDateRange;

  useEffect(() => {
    if (!pendingOpenIntent.collateralId) {
      return;
    }

    if (pendingOpenIntent.eventInstanceId && pendingOpenIntent.eventInstanceId !== resolvedActiveEventInstanceId) {
      return;
    }

    if (instanceItems.some((item) => item.id === pendingOpenIntent.collateralId)) {
      setSelectedId((current) => (current === pendingOpenIntent.collateralId ? current : pendingOpenIntent.collateralId));
    }

    setPendingOpenIntent((current) => ({ ...current, collateralId: "" }));
  }, [
    instanceItems,
    pendingOpenIntent.collateralId,
    pendingOpenIntent.eventInstanceId,
    resolvedActiveEventInstanceId
  ]);

  useEffect(() => {
    setIsEditingTitle(false);
    setTitleDraft(selectedItem?.itemName ?? "");
  }, [selectedItem?.id, selectedItem?.itemName]);

  useEffect(() => {
    const traceId = getCollateralCreateTraceId();

    if (!traceId) {
      return;
    }

    const renderedItem = groupedItems.flatMap(([, items]) => items).find((item) => item.id === traceId) ?? null;

    traceCollateralCreate("collateral-view-render", {
      traceId,
      activeEventInstanceId: resolvedActiveEventInstanceId,
      activeSummaryFilter,
      activeProfileDeadlineFilter,
      showArchived,
      selectedId,
      instanceItemIds: instanceItems.map((item) => item.id),
      visibleItemIds: visibleInstanceItems.map((item) => item.id),
      groupedSections: groupedItems.map(([subEvent, items]) => ({
        subEvent,
        itemIds: items.map((item) => item.id)
      })),
      renderedItem: renderedItem
        ? {
            id: renderedItem.id,
            eventInstanceId: renderedItem.eventInstanceId,
            subEventId: renderedItem.subEventId,
            status: renderedItem.status,
            archivedAt: renderedItem.archivedAt
          }
        : null
    });
  }, [
    activeProfileDeadlineFilter,
    activeSummaryFilter,
    groupedItems,
    instanceItems,
    resolvedActiveEventInstanceId,
    selectedId,
    showArchived,
    visibleInstanceItems
  ]);

  const pendingTemplateInstance =
    pendingTemplateInstanceId
      ? workspaceBundle.eventInstancesByProgram
          .flatMap((group) => group.instances)
          .find((instance) => instance.id === pendingTemplateInstanceId) ?? null
      : null;
  const hasAppliedTemplateItems = workspaceBundle.hasAppliedTemplateItems;
  const readiness = workspaceBundle.readiness;
  const hasActiveCollateralFilters =
    activeSummaryFilter !== "all" || activeProfileDeadlineFilter !== "none" || showArchived;
  const hasUnsavedDraftCollateral = Boolean(draftCollateralItem);
  const activeFilterLabel = getCollateralSummaryFilterLabel(activeSummaryFilter);
  const activeProfileFilterLabel = getCollateralProfileDeadlineFilterLabel(activeProfileDeadlineFilter);
  const showSetupPanel =
    Boolean(selectedEventInstance) &&
    Boolean(currentProgramSchedule || supportsSponsorSetup || activeProfile);

  function handleAddCollateralItem() {
    if (draftCollateralItem && draftCollateralItem.eventInstanceId === resolvedActiveEventInstanceId) {
      setSelectedId(draftCollateralItem.id);
      traceCollateralCreate("draft-reselected", {
        id: draftCollateralItem.id,
        eventInstanceId: draftCollateralItem.eventInstanceId,
        subEventId: draftCollateralItem.subEventId,
        status: draftCollateralItem.status,
        archivedAt: draftCollateralItem.archivedAt,
        activeEventInstanceId: resolvedActiveEventInstanceId
      });
      return;
    }

    const fallbackSubEventId = ensureEventInstanceUnassignedSubEvent(resolvedActiveEventInstanceId);
    const nextDraft = {
      id: DRAFT_COLLATERAL_ID,
      eventInstanceId: resolvedActiveEventInstanceId,
      subEventId: fallbackSubEventId,
      itemName: "New collateral item",
      status: "Backlog",
      owner: defaultOwnerForNewItems,
      blockedBy: "",
      dueDate: "",
      printer: "",
      quantity: "",
      updateType: "",
      noteEntries: [],
      lastUpdated: new Date().toISOString().slice(0, 10)
    } satisfies CollateralItem;
    setDraftCollateralItem(nextDraft);
    setSelectedId(DRAFT_COLLATERAL_ID);
    setCollateralCreateTraceId(null);
    traceCollateralCreate("draft-created", {
      id: nextDraft.id,
      eventInstanceId: nextDraft.eventInstanceId,
      subEventId: nextDraft.subEventId,
      status: nextDraft.status,
      archivedAt: undefined,
      activeEventInstanceId: resolvedActiveEventInstanceId,
      activeSummaryFilter,
      activeProfileDeadlineFilter,
      showArchived
    });
  }

  function toggleSummaryFilter(nextFilter: CollateralSummaryFilter) {
    setActiveSummaryFilter((current) => (current === nextFilter ? "all" : nextFilter));
  }

  function toggleProfileDeadlineFilter(nextFilter: CollateralProfileDeadlineFilter) {
    setActiveProfileDeadlineFilter((current) => (current === nextFilter ? "none" : nextFilter));
  }

  function openCreateInstanceModal() {
    setSetupFeedback("");
    setIsCreateInstanceOpen(true);
  }

  function closeCreateInstanceModal() {
    setIsCreateInstanceOpen(false);
    setPendingCreateInstanceInput(null);
  }

  function finishCreateInstance(input: CreateEventInstanceInput) {
    const nextId = createEventInstance(input);
    setSelectedId(null);
    closeCreateInstanceModal();
    setSetupFeedback(`${input.instanceName.trim()} created. Choose whether to start with the default template or an empty instance.`);

    if (getDefaultTemplatePackForEventType(input.eventTypeId)) {
      setPendingTemplateInstanceId(nextId);
    } else {
      setSetupFeedback(`${input.instanceName.trim()} created and set as the active event instance.`);
    }
  }

  function handleCreateInstance(input: CreateEventInstanceInput) {
    if (hasUnsavedDraftCollateral) {
      setPendingDraftDiscardIntent({ type: "createInstance" });
      setPendingCreateInstanceInput(input);
      return;
    }

    finishCreateInstance(input);
  }

  function handleConfirmTemplateApply() {
    if (!pendingTemplateInstanceId) {
      return;
    }

    applyDefaultTemplateToInstance(pendingTemplateInstanceId);
    setSetupFeedback(`${pendingTemplateInstance?.name ?? "Event instance"} is ready with its default template applied.`);
    setPendingTemplateInstanceId(null);
  }

  function handleSkipTemplateApply() {
    setSetupFeedback(`${pendingTemplateInstance?.name ?? "Event instance"} is active and ready to start empty.`);
    setPendingTemplateInstanceId(null);
  }

  function addNote(item: CollateralItem) {
    const nextEntry = createActionNoteEntry(noteDraft, { author: LOCAL_FALLBACK_NOTE_AUTHOR });

    if (!nextEntry) {
      return;
    }

    patchCollateralItem(item.id, { noteEntries: [nextEntry, ...item.noteEntries] });
    setNoteDraft("");
  }

  function commitTitleDraft(item: CollateralItem, value: string) {
    const nextTitle = value.trim();

    if (!nextTitle || nextTitle === item.itemName) {
      setTitleDraft(item.itemName);
      return;
    }

    patchCollateralItem(item.id, { itemName: nextTitle });
  }

  function finishTitleEdit(item: CollateralItem) {
    commitTitleDraft(item, titleDraft);
    setIsEditingTitle(false);
  }

  function cancelTitleEdit(item: CollateralItem) {
    setTitleDraft(item.itemName);
    setIsEditingTitle(false);
  }

  function patchCollateralItem(id: string, updates: Partial<CollateralItem>) {
    if (draftCollateralItem && id === draftCollateralItem.id) {
      setDraftCollateralItem((current) =>
        current
          ? {
              ...current,
              ...updates,
              lastUpdated: new Date().toISOString().slice(0, 10)
            }
          : current
      );
      return;
    }

    updateCollateralItem(id, updates);
  }

  function discardDraftCollateralItem() {
    setDraftCollateralItem(null);
    setSelectedId(null);
    setNoteDraft("");
  }

  function saveDraftCollateralItem() {
    if (!draftCollateralItem) {
      return;
    }

    traceCollateralCreate("save-requested", {
      id: draftCollateralItem.id,
      eventInstanceId: draftCollateralItem.eventInstanceId,
      subEventId: draftCollateralItem.subEventId,
      status: draftCollateralItem.status,
      archivedAt: draftCollateralItem.archivedAt,
      activeEventInstanceId: resolvedActiveEventInstanceId,
      activeSummaryFilter,
      activeProfileDeadlineFilter,
      showArchived
    });

    const nextId = addCollateralItem({
      eventInstanceId: draftCollateralItem.eventInstanceId,
      subEventId: draftCollateralItem.subEventId,
      templateOriginId: draftCollateralItem.templateOriginId,
      itemName: draftCollateralItem.itemName,
      status: draftCollateralItem.status,
      owner: draftCollateralItem.owner,
      blockedBy: draftCollateralItem.blockedBy,
      dueDate: draftCollateralItem.dueDate,
      printer: draftCollateralItem.printer,
      quantity: draftCollateralItem.quantity,
      updateType: draftCollateralItem.updateType,
      noteEntries: draftCollateralItem.noteEntries,
      notes: draftCollateralItem.notes,
      fileLink: draftCollateralItem.fileLink
    });

    setDraftCollateralItem(null);
    setActiveSummaryFilter("all");
    setActiveProfileDeadlineFilter("none");
    setSelectedId(nextId);
    setCollateralCreateTraceId(nextId);
    traceCollateralCreate("save-returned", {
      id: nextId,
      eventInstanceId: draftCollateralItem.eventInstanceId,
      subEventId: draftCollateralItem.subEventId,
      status: draftCollateralItem.status,
      archivedAt: draftCollateralItem.archivedAt,
      activeEventInstanceId: resolvedActiveEventInstanceId,
      filtersCleared: true
    });
  }

  function clearCollateralFilters() {
    setActiveSummaryFilter("all");
    setActiveProfileDeadlineFilter("none");
    setShowArchived(false);
  }

  function updateWorkstreamSchedule(
    workstream: WorkstreamSchedule["workstream"],
    updater: (schedule: WorkstreamSchedule) => WorkstreamSchedule
  ) {
    setWorkstreamSchedules(
      workstreamSchedules.map((schedule) => (schedule.workstream === workstream ? updater(schedule) : schedule))
    );
  }

  function handleWorkstreamScheduleModeChange(
    workstream: WorkstreamSchedule["workstream"],
    mode: WorkstreamScheduleMode
  ) {
    updateWorkstreamSchedule(workstream, (schedule) => ({
      ...schedule,
      mode,
      ...(mode === "multiple" && (!schedule.dates || schedule.dates.length === 0) ? { dates: [""] } : {})
    }));
  }

  function handleWorkstreamScheduleFieldChange(
    workstream: WorkstreamSchedule["workstream"],
    field: "singleDate" | "startDate" | "endDate",
    value: string
  ) {
    updateWorkstreamSchedule(workstream, (schedule) => ({
      ...schedule,
      [field]: value
    }));
  }

  function handleWorkstreamScheduleDateChange(
    workstream: WorkstreamSchedule["workstream"],
    index: number,
    value: string
  ) {
    updateWorkstreamSchedule(workstream, (schedule) => ({
      ...schedule,
      dates: (schedule.dates ?? []).map((date, dateIndex) => (dateIndex === index ? value : date))
    }));
  }

  function handleAddWorkstreamScheduleDate(workstream: WorkstreamSchedule["workstream"]) {
    updateWorkstreamSchedule(workstream, (schedule) => ({
      ...schedule,
      dates: [...(schedule.dates ?? []), ""]
    }));
  }

  function handleRemoveWorkstreamScheduleDate(workstream: WorkstreamSchedule["workstream"], index: number) {
    updateWorkstreamSchedule(workstream, (schedule) => {
      const nextDates = (schedule.dates ?? []).filter((_, dateIndex) => dateIndex !== index);

      return {
        ...schedule,
        dates: nextDates.length > 0 ? nextDates : [""]
      };
    });
  }

  function handleAddSponsorPlacement() {
    upsertSponsorPlacement(
      resolvedActiveEventInstanceId,
      createSponsorPlacementDraft(
        resolvedActiveEventInstanceId,
        selectedEventInstance?.eventTypeId ?? "legislative-day"
      )
    );
  }

  function handleSponsorPlacementChange(
    placementId: string,
    field: "sponsorName" | "placement" | "logoReceived" | "notes",
    value: string | boolean
  ) {
    const placement = sponsorPlacements.find((entry) => entry.id === placementId);

    if (!placement) {
      return;
    }

    upsertSponsorPlacement(resolvedActiveEventInstanceId, {
      ...placement,
      [field]: value
    });
  }

  function handleGenerateSponsorFulfillment() {
    const result = generateSponsorFulfillmentItems(resolvedActiveEventInstanceId);

    if (result.created === 0 && result.skipped === 0) {
      setSetupFeedback("No sponsor deadline action items were generated yet. Add at least one sponsor placement first.");
      return;
    }

    if (result.created === 0) {
      setSetupFeedback("Matching sponsor deadline action items already exist in Action View, or the current sponsor setup is still incomplete. Nothing new was generated.");
      return;
    }

    setSetupFeedback(
      result.skipped > 0
        ? `${result.created} sponsor deadline action item${result.created === 1 ? "" : "s"} created in Action View. ${result.skipped} deliverable${result.skipped === 1 ? "" : "s"} skipped because matching action items already exist or setup is incomplete.`
        : `${result.created} sponsor deadline action item${result.created === 1 ? "" : "s"} created in Action View.`
    );
  }

  function requestEventInstanceSwitch(nextEventInstanceId: string) {
    if (nextEventInstanceId === resolvedActiveEventInstanceId) {
      return;
    }

    if (hasUnsavedDraftCollateral) {
      setPendingDraftDiscardIntent({ type: "switch", nextEventInstanceId });
      return;
    }

    setActiveEventInstanceId(nextEventInstanceId);
    setSelectedId(null);
  }

  function handleCancelDraftDiscardIntent() {
    if (pendingDraftDiscardIntent?.type === "createInstance") {
      setPendingCreateInstanceInput(null);
    }
    if (pendingDraftDiscardIntent?.type === "sponsorPromotion") {
      setPendingSponsorPromotionIntent(null);
    }
    setPendingDraftDiscardIntent(null);
  }

  function handleConfirmDraftDiscardIntent() {
    if (!pendingDraftDiscardIntent) {
      return;
    }

    const intent = pendingDraftDiscardIntent;
    discardDraftCollateralItem();
    setPendingDraftDiscardIntent(null);

    if (intent.type === "switch") {
      setActiveEventInstanceId(intent.nextEventInstanceId);
      return;
    }

    if (intent.type === "sponsorPromotion") {
      setPendingSponsorPromotionIntent({
        actionItemId: intent.actionItemId,
        eventInstanceId: intent.eventInstanceId
      });

      if (intent.eventInstanceId !== resolvedActiveEventInstanceId) {
        setActiveEventInstanceId(intent.eventInstanceId);
      }
      return;
    }

    if (pendingCreateInstanceInput) {
      finishCreateInstance(pendingCreateInstanceInput);
      setPendingCreateInstanceInput(null);
    }
  }

  return (
    <section className="collateral-page">
      <div className="collateral-page__header">
        <div>
          <h1 className="collateral-page__title">{selectedEventInstance?.name ?? "Collateral"}</h1>
          <p className="collateral-page__subtitle">
            {selectedEventDateRange
              ? `${selectedEventDateRange} - production tracking for signage, print pieces, decks, and event materials.`
              : "Production tracking for signage, print pieces, decks, and event materials."}
          </p>
        </div>
        <div className="collateral-page__actions">
          <div className="field">
            <label htmlFor="collateral-event-instance">Event Instance</label>
            <select
              className="field-control"
              id="collateral-event-instance"
              onChange={(event) => requestEventInstanceSwitch(event.target.value)}
              value={resolvedActiveEventInstanceId}
            >
              {eventInstancesByProgram.map(({ eventProgram, instances }) => (
                <optgroup key={eventProgram.id} label={eventProgram.name}>
                  {instances.map((instance) => (
                    <option key={instance.id} value={instance.id}>
                      {supportsCollateralEventType(instance.eventTypeId) ? instance.name : `${instance.name} (Limited)`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <button
            className="button-link button-link--inline-secondary"
            onClick={() => router.push("/events")}
            type="button"
          >
            Events Setup
          </button>
          <button className="button-link button-link--inline-secondary" onClick={openCreateInstanceModal} type="button">
            Quick Create Instance
          </button>
          <button
            className="topbar__button"
            disabled={!isSelectedEventProgramSupported}
            onClick={handleAddCollateralItem}
            type="button"
          >
            + Add Collateral
          </button>
        </div>
      </div>

      {selectedEventInstance ? (
        <div className="collateral-context card card--secondary">
          <div className="collateral-context__primary">
            <div className="collateral-context__label">Current Event Context</div>
            <div className="collateral-context__title-row">
              <strong className="collateral-context__title">{selectedEventInstance.name}</strong>
              {currentEventProgram ? <span className="collateral-context__chip">{currentEventProgram.name}</span> : null}
            </div>
          </div>
          <div className="collateral-context__meta">
            {selectedEventDateRange ? <span>{selectedEventDateRange}</span> : null}
            {selectedEventInstance.location ? <span>{selectedEventInstance.location}</span> : null}
            {defaultTemplatePack ? (
              <span>{hasAppliedTemplateItems ? "Default template applied" : "Default template available"}</span>
            ) : (
              <span>Collateral workflow not configured for this event program yet</span>
            )}
          </div>
          <div className="collateral-context__hint">
            Use Events to create and configure new event instances. Collateral stays focused on the production records for the active occurrence.
          </div>
        </div>
      ) : null}

      {selectedEventInstance && !isSelectedEventProgramSupported ? (
        <div className="collateral-setup-banner collateral-setup-banner--warning" role="status">
          <span>
            This event instance is visible for context, but collateral workflows are not configured for this event program yet.
          </span>
        </div>
      ) : null}

      {selectedEventInstance && isSelectedEventProgramSupported ? (
        <div className="collateral-readiness card card--secondary" role="status">
          <div className="collateral-readiness__header">
            <div>
              <div className="card__title">INSTANCE READINESS</div>
              <div className="collateral-readiness__meta">
                {readiness.signals.length > 0
                  ? "This instance still has setup gaps or active work that needs attention."
                  : "No obvious setup gaps detected for the current instance."}
              </div>
            </div>
            {readiness.signals.some((signal) => signal.kind === "blockedItems") ? (
              <button
                className="button-link button-link--inline-secondary"
                onClick={() => setActiveSummaryFilter("needsAttention")}
                type="button"
              >
                View needs attention
              </button>
            ) : null}
          </div>
          {readiness.signals.length > 0 ? (
            <div className="collateral-readiness__signals">
              {readiness.signals.map((signal) => (
                <span
                  className={getCollateralReadinessClassName(signal.tone)}
                  key={signal.kind}
                  title={signal.copy}
                >
                  {signal.shortLabel}
                </span>
              ))}
            </div>
          ) : (
            <div className="collateral-readiness__empty">Template, profile dates, and active item setup look usable.</div>
          )}
          {defaultTemplatePack && !hasAppliedTemplateItems ? (
            <div className="collateral-readiness__actions">
              <button
                className="topbar__button"
                onClick={() => applyDefaultTemplateToInstance(resolvedActiveEventInstanceId)}
                type="button"
              >
                Apply Default Template
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {setupFeedback ? (
        <div className="collateral-setup-banner" role="status">
          <span>{setupFeedback}</span>
          <button className="button-link button-link--inline-secondary" onClick={() => setSetupFeedback("")} type="button">
            Dismiss
          </button>
        </div>
      ) : null}

      <CollateralSummaryStrip
        activeSummaryFilter={activeSummaryFilter}
        onToggleSummaryFilter={toggleSummaryFilter}
        summary={summary}
      />

      <div className="collateral-layout">
        <div className="collateral-main">
          <div className="card card--secondary collateral-groups">
            <div className="card__title">
              COLLATERAL ITEMS
              {currentEventProgram ? <span className="collateral-card-context"> - {currentEventProgram.name}</span> : null}
            </div>
            <div className="collateral-group-toolbar">
              <label className="toggle">
                <input
                  checked={showArchived}
                  onChange={(event) => setShowArchived(event.target.checked)}
                  type="checkbox"
                />
                <span>Show Completed/Cut</span>
              </label>
            </div>
            {hasActiveCollateralFilters ? (
              <div className="collateral-filter-context">
                <span>
                  Showing:{" "}
                  {[
                    activeSummaryFilter !== "all" ? activeFilterLabel : null,
                    showArchived ? "Including completed/cut history" : null,
                    activeProfileDeadlineFilter !== "none"
                      ? `Due by ${activeProfileFilterLabel}`
                      : null
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </span>
                <button
                  className="button-link button-link--inline-secondary"
                  onClick={clearCollateralFilters}
                  type="button"
                >
                  Clear
                </button>
              </div>
            ) : null}
            {groupedItems.length === 0 ? (
              <div className="empty-state empty-state--actionable">
                <div className="empty-state__title">
                  {hasActiveCollateralFilters ? "No items match this view." : "This event instance is empty."}
                </div>
                <div className="empty-state__copy">
                  {!hasActiveCollateralFilters
                    ? !isSelectedEventProgramSupported
                      ? "Collateral tracking is not enabled for this event program yet."
                      : defaultTemplatePack
                        ? `Apply the default template pack for ${currentEventProgram?.name ?? "this event"} or add your first collateral item manually.`
                        : "Add your first collateral item manually to start tracking production work for this event instance."
                    : "Try a different summary view, show completed/cut items, or clear the filter to return to the active collateral list."}
                </div>
                <div className="empty-state__actions">
                  {!hasActiveCollateralFilters && defaultTemplatePack && isSelectedEventProgramSupported ? (
                    <button
                      className="topbar__button"
                      onClick={() => applyDefaultTemplateToInstance(resolvedActiveEventInstanceId)}
                      type="button"
                    >
                      Apply Default Template
                    </button>
                  ) : null}
                  {!hasActiveCollateralFilters && isSelectedEventProgramSupported ? (
                    <button className="button-link button-link--inline-secondary" onClick={handleAddCollateralItem} type="button">
                      Add First Collateral Item
                    </button>
                  ) : (
                    <button
                      className="button-link button-link--inline-secondary"
                      onClick={clearCollateralFilters}
                      type="button"
                    >
                      Clear Filter
                    </button>
                  )}
                </div>
              </div>
            ) : (
              groupedItems.map(([subEvent, items]) => (
                <section className="collateral-group" key={subEvent}>
                  <div className="collateral-group__header">
                    <h2 className="collateral-group__title">{subEvent}</h2>
                    <span className="collateral-group__count">{items.length}</span>
                  </div>
                  <div className="collateral-list">
                    {items.map((item) => {
                      const isSelected = item.id === selectedId;

                      return (
                        <button
                          className={getCollateralRowClassName(item, isSelected)}
                          key={item.id}
                          onClick={() => setSelectedId(item.id)}
                          type="button"
                        >
                          <div className="collateral-row__main">
                            <div className="collateral-row__title">{item.itemName}</div>
                            <div className="collateral-row__meta">
                              {item.owner ? (
                                <span>{item.owner}</span>
                              ) : (
                                <span className="collateral-row__meta-flag collateral-row__meta-flag--unassigned">
                                  No owner assigned
                                </span>
                              )}
                              <span>{item.dueDate ? formatShortDate(item.dueDate) : "No due date"}</span>
                              {item.blockedBy ? (
                                <span className="collateral-row__meta-flag collateral-row__meta-flag--blocked">
                                  Blocked by {item.blockedBy}
                                </span>
                              ) : null}
                              <span>{item.printer || "No printer assigned"}</span>
                              {item.quantity ? <span>Qty {item.quantity}</span> : null}
                            </div>
                          </div>
                          <div className="collateral-row__signals">
                            <span className={getCollateralStatusClassName(item)}>{item.status}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>

        {selectedItem ? (
          <aside className="drawer drawer--collateral" aria-label="Collateral details">
            <div className="drawer__sticky">
            <div className="drawer__header">
              <div className="drawer__header-text">
                <div className="collateral-drawer__eyebrow">Collateral item</div>
                {isEditingTitle ? (
                  <input
                    aria-label="Edit collateral item title"
                    autoFocus
                    className="drawer__title-input collateral-drawer__title-input"
                    id="collateral-title"
                    onBlur={() => finishTitleEdit(selectedItem)}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelTitleEdit(selectedItem);
                      }

                      if (event.key === "Enter") {
                        event.preventDefault();
                        finishTitleEdit(selectedItem);
                      }
                    }}
                    value={titleDraft}
                  />
                ) : (
                  <h2 className="drawer__title collateral-drawer__title">
                    <button className="drawer__title-button" onClick={() => setIsEditingTitle(true)} type="button">
                      {selectedItem.itemName}
                    </button>
                  </h2>
                )}
                <div className="drawer__header-meta">
                  <span className="drawer__workstream">
                    {subEventNameById.get(selectedItem.subEventId) ?? "Unassigned sub-event"}
                  </span>
                  <span className={getCollateralStatusClassName(selectedItem)}>{selectedItem.status}</span>
                  {isCollateralArchived(selectedItem) ? (
                    <span className="drawer__status-chip">Hidden from active lane</span>
                  ) : null}
                  {draftCollateralItem?.id === selectedItem.id ? (
                    <span className="drawer__status-chip drawer__status-chip--new">New item</span>
                  ) : null}
                </div>
                <div className="collateral-drawer__meta-row">
                  {selectedItem.dueDate ? (
                    <span className="drawer__due-text">{getCollateralDrawerDueText(selectedItem)}</span>
                  ) : (
                    <span className="drawer__due-text">No due date set</span>
                  )}
                  {selectedItem.owner ? (
                    <span className="collateral-drawer__meta-pill">Owner: {selectedItem.owner}</span>
                  ) : null}
                  {selectedItem.printer.trim() ? (
                    <span className="collateral-drawer__meta-pill">Printer: {selectedItem.printer.trim()}</span>
                  ) : null}
                  {selectedItem.quantity.trim() ? (
                    <span className="collateral-drawer__meta-pill">Qty: {selectedItem.quantity.trim()}</span>
                  ) : null}
                </div>
                {selectedItem.blockedBy.trim() ? (
                  <div className="drawer__warning drawer__warning--blocked">
                    Blocked by {selectedItem.blockedBy.trim()}
                  </div>
                ) : null}
              </div>
              <div className="drawer__header-actions">
                <div className="drawer__actions-menu">
                  <button
                    aria-expanded={isActionsMenuOpen}
                    aria-haspopup="menu"
                    className="drawer__actions-trigger"
                    onClick={() => setIsActionsMenuOpen((current) => !current)}
                    type="button"
                  >
                    <span aria-hidden="true">⚙</span>
                    <span className="sr-only">Open collateral item actions</span>
                  </button>
                  {isActionsMenuOpen ? (
                    <div className="drawer__actions-popover" role="menu">
                      <button
                        className="drawer__actions-item drawer__actions-item--danger"
                        onClick={() => {
                          setIsActionsMenuOpen(false);
                          setIsDeleteConfirmOpen(true);
                        }}
                        role="menuitem"
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
                <button className="button-link" onClick={() => setSelectedId(null)} type="button">
                  Close
                </button>
              </div>
            </div>
            </div>

            <div className="drawer__sections">
              <section className="drawer-section drawer-section--form collateral-drawer">
                <div className="collateral-drawer__group">
                  <div className="drawer__panel-title">Identity</div>
                  <div className="drawer__grid drawer__grid--form collateral-drawer__grid">
                    <div className="field field--secondary">
                      <label htmlFor="collateral-sub-event">Sub-Event</label>
                      <select
                        id="collateral-sub-event"
                        onChange={(event) => patchCollateralItem(selectedItem.id, { subEventId: event.target.value })}
                        value={selectedItem.subEventId}
                      >
                        {selectedSubEventOptions.length === 0 ? (
                          <option value={emptySubEventId}>Unassigned</option>
                        ) : null}
                        {selectedSubEventOptions.map((subEvent) => (
                          <option key={subEvent.id} value={subEvent.id}>
                            {subEvent.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field field--priority">
                      <label htmlFor="collateral-status">Status</label>
                      <select
                        id="collateral-status"
                        onChange={(event) =>
                          patchCollateralItem(selectedItem.id, {
                            status: event.target.value as CollateralItem["status"]
                          })
                        }
                        value={selectedItem.status}
                      >
                        {COLLATERAL_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="collateral-drawer__group">
                  <div className="drawer__panel-title">Execution</div>
                  <div className="drawer__grid drawer__grid--form">
                    <div className="field">
                      <label htmlFor="collateral-owner">Owner</label>
                      <select
                        id="collateral-owner"
                        onChange={(event) => patchCollateralItem(selectedItem.id, { owner: event.target.value })}
                        value={selectedItem.owner}
                      >
                        <option value="">No owner assigned</option>
                        {getOwnerOptions(selectedItem.owner || defaultOwnerForNewItems).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field field--priority">
                      <label htmlFor="collateral-due-date">Due Date</label>
                      <input
                        id="collateral-due-date"
                        onChange={(event) => patchCollateralItem(selectedItem.id, { dueDate: event.target.value })}
                        type="date"
                        value={selectedItem.dueDate}
                      />
                    </div>
                    <div className="field field--wide collateral-drawer__blocked-field">
                      <label htmlFor="collateral-blocked-by">Blocked By</label>
                      <input
                        id="collateral-blocked-by"
                        onChange={(event) => patchCollateralItem(selectedItem.id, { blockedBy: event.target.value })}
                        placeholder="Optional blocker"
                        value={selectedItem.blockedBy}
                      />
                    </div>
                  </div>
                </div>

                <div className="collateral-drawer__group">
                  <div className="drawer__panel-title">Production</div>
                  <div className="drawer__grid drawer__grid--form">
                    <div className="field">
                      <label htmlFor="collateral-printer">Printer</label>
                      <input
                        id="collateral-printer"
                        onChange={(event) => patchCollateralItem(selectedItem.id, { printer: event.target.value })}
                        value={selectedItem.printer}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="collateral-quantity">Qty</label>
                      <input
                        id="collateral-quantity"
                        onChange={(event) => patchCollateralItem(selectedItem.id, { quantity: event.target.value })}
                        value={selectedItem.quantity}
                      />
                    </div>
                    <div className="field field--wide">
                      <label htmlFor="collateral-update-type">Update Type</label>
                      <select
                        id="collateral-update-type"
                        onChange={(event) => patchCollateralItem(selectedItem.id, { updateType: event.target.value })}
                        value={selectedItem.updateType}
                      >
                        <option value="">Select update type</option>
                        {COLLATERAL_UPDATE_TYPE_OPTIONS.filter((option) => option.length > 0).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

              </section>
              <ActionItemNotesPanel
                noteDraft={noteDraft}
                noteEntries={selectedItem.noteEntries}
                onAddNote={() => addNote(selectedItem)}
                onNoteDraftChange={setNoteDraft}
              />
            </div>
            {isDeleteConfirmOpen ? (
              <div className="drawer__confirm-bar">
                <div className="confirm-delete">
                  <div className="confirm-delete__title">Delete this collateral item?</div>
                  <div className="confirm-delete__copy">
                    This will permanently remove it from the current event instance.
                  </div>
                  <div className="confirm-delete__actions">
                    <button
                      className="button-link button-link--inline-secondary"
                      onClick={() => setIsDeleteConfirmOpen(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="button-danger"
                      onClick={() => {
                        if (draftCollateralItem?.id === selectedItem.id) {
                          discardDraftCollateralItem();
                          setIsDeleteConfirmOpen(false);
                          return;
                        }

                        deleteCollateralItem(selectedItem.id);
                        setIsDeleteConfirmOpen(false);
                        setSelectedId(null);
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {draftCollateralItem?.id === selectedItem.id ? (
              <div className="drawer__confirm-bar">
                <div className="confirm-delete confirm-delete--neutral">
                  <div className="confirm-delete__title">Save this new collateral item?</div>
                  <div className="confirm-delete__copy">
                    Save keeps this new item in the current event instance. Cancel removes it.
                  </div>
                  <div className="confirm-delete__actions">
                    <button
                      className="button-link button-link--inline-secondary"
                      onClick={discardDraftCollateralItem}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="topbar__button"
                      onClick={saveDraftCollateralItem}
                      type="button"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>

      {showSetupPanel ? (
        <div className="card card--secondary collateral-secondary-setup">
          <div className="collateral-secondary-setup__header">
            <div>
              <div className="card__title">SETUP & ADMIN</div>
              <div className="collateral-secondary-setup__meta">
                Open when you need to adjust profile dates, schedule rules, or sponsor placement setup for this instance.
              </div>
            </div>
            <button
              className="button-link button-link--inline-secondary"
              onClick={() => setIsSetupOpen((current) => !current)}
              type="button"
            >
              {isSetupOpen ? "Hide setup" : "Show setup"}
            </button>
          </div>
          {!isSetupOpen ? (
            <div className="collateral-secondary-setup__summary">
              {selectedEventInstance?.eventTypeId === "legislative-day" && activeProfile ? (
                <span>Event profile available</span>
              ) : null}
              {currentProgramSchedule ? (
                <span>Schedule rules for {currentProgramSchedule.workstream}</span>
              ) : null}
              {supportsSponsorSetup ? (
                <span>
                  {sponsorPlacements.length > 0
                    ? `${sponsorPlacements.length} sponsor placement${sponsorPlacements.length === 1 ? "" : "s"} configured`
                    : "No sponsor placements yet"}
                </span>
              ) : null}
            </div>
          ) : (
            <div className="collateral-secondary-setup__body">
              {selectedEventInstance?.eventTypeId === "legislative-day" && activeProfile ? (
                <CollateralProfileCard
                  activeProfileDeadlineFilter={activeProfileDeadlineFilter}
                  onProfileChange={(updates) =>
                    setCollateralProfile(resolvedActiveEventInstanceId, {
                      ...activeProfile,
                      ...updates
                    })
                  }
                  onToggleProfileDeadlineFilter={toggleProfileDeadlineFilter}
                  profile={activeProfile}
                />
              ) : null}

              {selectedEventInstance && currentProgramSchedule ? (
                <div className="card card--secondary collateral-event-setup">
                  <div className="collateral-event-setup__header">
                    <div>
                      <div className="card__title">EVENT SETUP</div>
                      <div className="collateral-event-setup__meta">
                        Schedule rules for {currentProgramSchedule.workstream} now live with the active event instance instead of global settings.
                      </div>
                    </div>
                  </div>
                  <div className="schedule-settings">
                    <div className="schedule-settings__row">
                      <div className="schedule-settings__heading">
                        <div className="schedule-settings__name">{currentProgramSchedule.workstream}</div>
                      </div>

                      <div className="schedule-settings__controls">
                        <div className="field">
                          <label htmlFor={`collateral-schedule-mode-${currentProgramSchedule.workstream}`}>Schedule Type</label>
                          <select
                            className="field-control"
                            id={`collateral-schedule-mode-${currentProgramSchedule.workstream}`}
                            onChange={(event) =>
                              handleWorkstreamScheduleModeChange(
                                currentProgramSchedule.workstream,
                                event.target.value as WorkstreamScheduleMode
                              )
                            }
                            value={currentProgramSchedule.mode}
                          >
                            <option value="none">None</option>
                            <option value="single">Single day</option>
                            <option value="range">Date range</option>
                            <option value="multiple">Multiple dates</option>
                          </select>
                        </div>

                        {currentProgramSchedule.mode === "single" ? (
                          <div className="field">
                            <label htmlFor={`collateral-schedule-single-${currentProgramSchedule.workstream}`}>Date</label>
                            <input
                              className="field-control"
                              id={`collateral-schedule-single-${currentProgramSchedule.workstream}`}
                              onChange={(event) =>
                                handleWorkstreamScheduleFieldChange(
                                  currentProgramSchedule.workstream,
                                  "singleDate",
                                  event.target.value
                                )
                              }
                              type="date"
                              value={currentProgramSchedule.singleDate ?? ""}
                            />
                          </div>
                        ) : null}

                        {currentProgramSchedule.mode === "range" ? (
                          <div className="schedule-settings__range">
                            <div className="field">
                              <label htmlFor={`collateral-schedule-start-${currentProgramSchedule.workstream}`}>Start Date</label>
                              <input
                                className="field-control"
                                id={`collateral-schedule-start-${currentProgramSchedule.workstream}`}
                                onChange={(event) =>
                                  handleWorkstreamScheduleFieldChange(
                                    currentProgramSchedule.workstream,
                                    "startDate",
                                    event.target.value
                                  )
                                }
                                type="date"
                                value={currentProgramSchedule.startDate ?? ""}
                              />
                            </div>
                            <div className="field">
                              <label htmlFor={`collateral-schedule-end-${currentProgramSchedule.workstream}`}>End Date</label>
                              <input
                                className="field-control"
                                id={`collateral-schedule-end-${currentProgramSchedule.workstream}`}
                                onChange={(event) =>
                                  handleWorkstreamScheduleFieldChange(
                                    currentProgramSchedule.workstream,
                                    "endDate",
                                    event.target.value
                                  )
                                }
                                type="date"
                                value={currentProgramSchedule.endDate ?? ""}
                              />
                            </div>
                          </div>
                        ) : null}

                        {currentProgramSchedule.mode === "multiple" ? (
                          <div className="schedule-settings__multiple">
                            {(currentProgramSchedule.dates ?? [""]).map((date, index) => (
                              <div className="schedule-settings__date-row" key={`${currentProgramSchedule.workstream}-${index}`}>
                                <input
                                  aria-label={`${currentProgramSchedule.workstream} date ${index + 1}`}
                                  className="field-control"
                                  onChange={(event) =>
                                    handleWorkstreamScheduleDateChange(
                                      currentProgramSchedule.workstream,
                                      index,
                                      event.target.value
                                    )
                                  }
                                  type="date"
                                  value={date}
                                />
                                <button
                                  className="button-link button-link--inline-secondary"
                                  onClick={() => handleRemoveWorkstreamScheduleDate(currentProgramSchedule.workstream, index)}
                                  type="button"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                            <button
                              className="button-link button-link--inline-secondary"
                              onClick={() => handleAddWorkstreamScheduleDate(currentProgramSchedule.workstream)}
                              type="button"
                            >
                              Add Date
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedEventInstance && supportsSponsorSetup ? (
                <div className="card card--secondary collateral-event-setup collateral-sponsor-setup">
                  <div className="collateral-event-setup__header">
                    <div>
                      <div className="card__title">SPONSOR PLACEMENTS</div>
                      <div className="collateral-event-setup__meta">
                        Track sponsor placement commitments for {selectedEventInstance.name}, then generate fulfillment work into Action View.
                      </div>
                    </div>
                    <button
                      className="button-link button-link--inline-secondary"
                      onClick={handleGenerateSponsorFulfillment}
                      type="button"
                    >
                      Generate Action Items
                    </button>
                  </div>
                  <div className="sponsor-setup__hint">
                    This first slice supports Legislative Day only. Each sponsor placement expands into sponsor deadline work, and generation creates native action items in Action View. Reruns skip matching sponsor-generated work that already exists.
                  </div>
                  {sponsorGenerationPreview ? (
                    <div className="sponsor-setup__summary" role="status">
                      <span>
                        {sponsorGenerationPreview.actionItemsToCreate > 0
                          ? `${sponsorGenerationPreview.actionItemsToCreate} sponsor deadline action item${sponsorGenerationPreview.actionItemsToCreate === 1 ? "" : "s"} ready to generate`
                          : sponsorGenerationPreview.readyCount > 0
                            ? "No new sponsor deadline action items ready right now"
                            : "Add a sponsor name to make a placement generation-ready"}
                      </span>
                      {sponsorGenerationPreview.skippedCount > 0 ? (
                        <span>
                          {sponsorGenerationPreview.skippedCount} deliverable{sponsorGenerationPreview.skippedCount === 1 ? "" : "s"} will be skipped because matching work already exists or setup is incomplete
                        </span>
                      ) : null}
                      {sponsorGenerationPreview.previewTitles.length > 0 ? (
                        <span>
                          Next up: {sponsorGenerationPreview.previewTitles.join(" • ")}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="sponsor-setup__rows">
                    {sponsorPlacements.length > 0 ? (
                      sponsorPlacements.map((placement) => (
                        <div className="sponsor-setup__row" key={placement.id}>
                          <div className="field">
                            <label htmlFor={`sponsor-name-${placement.id}`}>Sponsor</label>
                            <input
                              className="field-control"
                              id={`sponsor-name-${placement.id}`}
                              onChange={(event) =>
                                handleSponsorPlacementChange(placement.id, "sponsorName", event.target.value)
                              }
                              placeholder="Sponsor name"
                              value={placement.sponsorName}
                            />
                          </div>
                          <div className="field">
                            <label htmlFor={`sponsor-placement-${placement.id}`}>Placement</label>
                            <select
                              className="field-control"
                              id={`sponsor-placement-${placement.id}`}
                              onChange={(event) =>
                                handleSponsorPlacementChange(placement.id, "placement", event.target.value)
                              }
                              value={placement.placement}
                            >
                              {sponsorPlacementOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label htmlFor={`sponsor-logo-${placement.id}`}>Logo Received</label>
                            <label className="checkbox-field" htmlFor={`sponsor-logo-${placement.id}`}>
                              <input
                                checked={placement.logoReceived}
                                id={`sponsor-logo-${placement.id}`}
                                onChange={(event) =>
                                  handleSponsorPlacementChange(placement.id, "logoReceived", event.target.checked)
                                }
                                type="checkbox"
                              />
                              <span>{placement.logoReceived ? "Yes, logo is already in hand" : "No, still waiting on sponsor logo"}</span>
                            </label>
                          </div>
                          <div className="field field--wide">
                            <label htmlFor={`sponsor-notes-${placement.id}`}>Notes</label>
                            <textarea
                              className="field-control"
                              id={`sponsor-notes-${placement.id}`}
                              onChange={(event) =>
                                handleSponsorPlacementChange(placement.id, "notes", event.target.value)
                              }
                              placeholder={`Optional context for ${getSponsorPlacementLabel(placement.placement, selectedEventInstance.eventTypeId).toLowerCase()}`}
                              rows={2}
                              value={placement.notes ?? ""}
                            />
                            {placement.sponsorName.trim() ? (
                              <div className="field__hint">
                                Generates {getSponsorPlacementDeliverables(placement.placement, selectedEventInstance.eventTypeId).length} sponsor deadline item{getSponsorPlacementDeliverables(placement.placement, selectedEventInstance.eventTypeId).length === 1 ? "" : "s"}, including{" "}
                                {getSponsorPlacementDeliverables(placement.placement, selectedEventInstance.eventTypeId)
                                  .slice(0, 2)
                                  .map((deliverable) =>
                                    getSponsorFulfillmentTaskTitle({
                                      sponsorName: placement.sponsorName.trim(),
                                      deliverableName: deliverable.deliverableName
                                    })
                                  )
                                  .join(" • ")}
                                {getSponsorPlacementDeliverables(placement.placement, selectedEventInstance.eventTypeId).length > 2
                                  ? ` + ${getSponsorPlacementDeliverables(placement.placement, selectedEventInstance.eventTypeId).length - 2} more`
                                  : ""}
                                {!placement.logoReceived
                                  ? ". Logo-required deliverables will start in Waiting until the sponsor logo is received."
                                  : ""}
                              </div>
                            ) : null}
                          </div>
                          <div className="sponsor-setup__actions">
                            <button
                              className="button-link button-link--inline-secondary"
                              onClick={() => removeSponsorPlacement(resolvedActiveEventInstanceId, placement.id)}
                              type="button"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="sponsor-setup__empty">
                        No sponsor placements set up yet for this event instance.
                      </div>
                    )}
                  </div>
                  <div className="sponsor-setup__footer">
                    <button className="button-link button-link--inline-secondary" onClick={handleAddSponsorPlacement} type="button">
                      Add Placement
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <EventInstanceCreateModal
        availableEventTypeDefinitions={creatableEventTypeDefinitions}
        isOpen={isCreateInstanceOpen}
        onClose={closeCreateInstanceModal}
        onCreate={handleCreateInstance}
      />
      <EventInstanceTemplatePrompt
        instanceName={pendingTemplateInstance?.name ?? "New event instance"}
        isOpen={Boolean(pendingTemplateInstance)}
        onApply={handleConfirmTemplateApply}
        onSkip={handleSkipTemplateApply}
      />

        {pendingDraftDiscardIntent ? (
          <div className="modal-layer" role="presentation">
            <button
              aria-label="Close draft discard prompt"
              className="modal-backdrop"
              onClick={handleCancelDraftDiscardIntent}
              type="button"
            />
            <section aria-labelledby="discard-draft-title" aria-modal="true" className="quick-add-modal" role="dialog">
              <div className="quick-add-modal__header">
                <div>
                  <h2 className="quick-add-modal__title" id="discard-draft-title">
                    Discard unsaved collateral?
                  </h2>
                  <p className="quick-add-modal__subtitle">
                    {pendingDraftDiscardIntent.type === "switch"
                      ? "Switching event context will discard the new collateral item you have not saved yet."
                      : pendingDraftDiscardIntent.type === "sponsorPromotion"
                        ? "Creating a collateral draft from sponsor work will discard the new collateral item you have not saved yet."
                        : "Creating a new event instance will switch context and discard the new collateral item you have not saved yet."}
                  </p>
                </div>
              </div>
              <div className="confirm-delete confirm-delete--neutral">
                <div className="confirm-delete__copy">
                  Save the draft first if you want to keep it in the current event instance.
                </div>
                <div className="confirm-delete__actions">
                  <button
                    className="button-link button-link--inline-secondary"
                    onClick={handleCancelDraftDiscardIntent}
                    type="button"
                  >
                    Stay Here
                  </button>
                  <button className="button-danger" onClick={handleConfirmDraftDiscardIntent} type="button">
                    Discard and Continue
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    );
}

function getCollateralRowClassName(item: CollateralItem, isSelected: boolean) {
  const classNames = ["collateral-row"];

  if (isSelected) {
    classNames.push("collateral-row--selected");
  }

  if (isCollateralOverdue(item)) {
    classNames.push("collateral-row--overdue");
  } else if (isCollateralDueSoon(item)) {
    classNames.push("collateral-row--due-soon");
  }

  if (isCollateralBlocked(item)) {
    classNames.push("collateral-row--blocked");
  }

  if (normalizeCollateralWorkflowStatus(item.status) === "ready") {
    classNames.push("collateral-row--ready");
  }

  if (!item.owner.trim()) {
    classNames.push("collateral-row--unassigned");
  }

  return classNames.join(" ");
}

function getCollateralStatusClassName(item: CollateralItem) {
  const normalizedStatus = normalizeCollateralWorkflowStatus(item.status);

  if (isCollateralBlocked(item)) {
    return "collateral-status collateral-status--blocked";
  }

  if (normalizedStatus === "waiting") {
    return "collateral-status collateral-status--waiting";
  }

  if (normalizedStatus === "ready") {
    return "collateral-status collateral-status--ready";
  }

  if (normalizedStatus === "complete" || normalizedStatus === "cut") {
    return "collateral-status collateral-status--terminal";
  }

  return "collateral-status";
}

function getCollateralDrawerDueText(item: CollateralItem) {
  if (!item.dueDate) {
    return "No due date set";
  }

  if (isCollateralOverdue(item)) {
    return `Overdue - ${formatShortDate(item.dueDate)}`;
  }

  if (isCollateralDueSoon(item)) {
    return `Due soon - ${formatShortDate(item.dueDate)}`;
  }

  return `Due ${formatShortDate(item.dueDate)}`;
}

function getCollateralSummaryFilterLabel(filter: CollateralSummaryFilter) {
  if (filter === "active") {
    return "Active";
  }

  if (filter === "needsAttention") {
    return "Needs Attention";
  }

  if (filter === "atPrinter") {
    return "At Printer";
  }

  if (filter === "readyForPrint") {
    return "Ready for Print";
  }

  return "All";
}

function getCollateralProfileDeadlineFilterLabel(filter: CollateralProfileDeadlineFilter) {
  if (filter === "logoDeadline") {
    return "Logo Deadline";
  }

  if (filter === "externalPrintingDue") {
    return "External Printing Due";
  }

  if (filter === "internalPrintingStart") {
    return "Start Internal Printing";
  }

  return "";
}

function getCollateralReadinessClassName(tone: "warning" | "attention") {
  return tone === "warning"
    ? "collateral-readiness__pill collateral-readiness__pill--warning"
    : "collateral-readiness__pill collateral-readiness__pill--attention";
}

function getScheduledWorkstreamForEventProgram(name: string): WorkstreamSchedule["workstream"] | null {
  return SCHEDULED_WORKSTREAM_OPTIONS.find((option) => option === name) ?? null;
}
