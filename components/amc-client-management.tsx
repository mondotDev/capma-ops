"use client";

import type { Dispatch, FormEvent, SetStateAction } from "react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAmcLocalState } from "@/components/amc-local-state-provider";
import {
  createClientAssociation,
  createProgramSeries,
  createWorkBucket,
  DELIVERY_FORMAT_LABELS,
  DELIVERY_FORMATS,
  generateBucketLabel,
  getBucketDisplayLabel,
  getClientWorkStructure,
  getCurrentBuckets,
  isBucketArchived,
  isBucketPast,
  LOCATION_TYPE_LABELS,
  LOCATION_TYPES,
  RECURRENCE_PATTERN_LABELS,
  RECURRENCE_PATTERNS,
  validateClientAssociationCreateInput,
  validateProgramSeriesCreateInput,
  validateWorkBucketCreateInput,
  WORK_BUCKET_KIND_LABELS,
  WORK_BUCKET_STATUSES,
  WORK_BUCKET_STATUS_LABELS,
  type ClientAssociationCreateInput,
  type DeliveryFormat,
  type LocationType,
  type ProgramSeries,
  type ProgramSeriesCreateInput,
  type ProgramSeriesUpdateInput,
  type RecurrencePattern,
  type StaffProfile,
  type WorkBucket,
  type WorkBucketCreateInput,
  type WorkBucketUpdateInput,
  type WorkBucketKind
} from "@/lib/amc-domain";

const BUCKET_KIND_OPTIONS: Array<{ value: WorkBucketKind; label: string }> = [
  { value: "event", label: WORK_BUCKET_KIND_LABELS.event },
  { value: "educationProgram", label: WORK_BUCKET_KIND_LABELS.educationProgram },
  { value: "publicationIssue", label: WORK_BUCKET_KIND_LABELS.publicationIssue },
  { value: "sponsorFulfillment", label: WORK_BUCKET_KIND_LABELS.sponsorFulfillment },
  { value: "membership", label: WORK_BUCKET_KIND_LABELS.membership },
  { value: "generalOperations", label: WORK_BUCKET_KIND_LABELS.generalOperations },
  { value: "internalOps", label: WORK_BUCKET_KIND_LABELS.internalOps }
];

const MONTH_OPTIONS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" }
];

const QUARTER_OPTIONS = [
  { value: "1", label: "Q1", startMonth: "01" },
  { value: "2", label: "Q2", startMonth: "04" },
  { value: "3", label: "Q3", startMonth: "07" },
  { value: "4", label: "Q4", startMonth: "10" }
];

export function AmcClientManagement() {
  const { state, addClientAssociation, addProgramSeries, addWorkBucket, updateProgramSeries, updateWorkBucket } = useAmcLocalState();
  const firstClientId = state.clients[0]?.id ?? "";
  const firstSeries = state.programSeries.find((series) => series.clientAssociationId === firstClientId);
  const [clientForm, setClientForm] = useState<ClientAssociationCreateInput>({
    name: "",
    shortName: "",
    status: "active"
  });
  const [programSeriesMode, setProgramSeriesMode] = useState<"existing" | "new">("existing");
  const [programSeriesForm, setProgramSeriesForm] = useState<ProgramSeriesCreateInput>({
    clientAssociationId: firstClientId,
    name: "",
    defaultKind: "event",
    recurrence: "annual",
    defaultDeliveryFormat: "inPerson",
    active: true,
    notes: ""
  });
  const [cycleInputs, setCycleInputs] = useState({
    year: "2026",
    month: "06",
    quarter: "3",
    adHocLabel: ""
  });
  const [bucketForm, setBucketForm] = useState<WorkBucketCreateInput>({
    clientAssociationId: firstClientId,
    programSeriesId: firstSeries?.id ?? "",
    kind: firstSeries?.defaultKind ?? "event",
    name: firstSeries?.name ?? "",
    status: "planning"
  });
  const [clientFeedback, setClientFeedback] = useState("");
  const [bucketFeedback, setBucketFeedback] = useState("");
  const [managedClientId, setManagedClientId] = useState<string | null>(null);
  const [structureFeedback, setStructureFeedback] = useState("");
  const bucketsByClient = useMemo(
    () =>
      state.clients.map((client) => ({
        client,
        buckets: state.buckets.filter((bucket) => bucket.clientAssociationId === client.id)
      })),
    [state.buckets, state.clients]
  );
  const selectedClientSeries = state.programSeries.filter((series) => series.clientAssociationId === bucketForm.clientAssociationId && series.active);
  const selectedProgramSeries =
    programSeriesMode === "existing"
      ? selectedClientSeries.find((series) => series.id === bucketForm.programSeriesId)
      : null;
  const selectedRecurrence = selectedProgramSeries?.recurrence ?? programSeriesForm.recurrence;
  const structuredCycle = getStructuredCycle(selectedRecurrence, cycleInputs);
  const generatedBucketLabel = generateBucketLabel({
    programSeriesName: selectedProgramSeries?.name ?? programSeriesForm.name,
    recurrence: selectedRecurrence,
    startsAt: bucketForm.startsAt || structuredCycle.startsAt,
    cycleLabel: bucketForm.cycleLabel || structuredCycle.cycleLabel
  });

  function handleClientSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateClientAssociationCreateInput(clientForm);

    if (!validation.isValid) {
      setClientFeedback(validation.errors[0] ?? "Check the required fields.");
      return;
    }

    const client = createClientAssociation(clientForm, state);
    addClientAssociation(client);
    setClientForm({ name: "", shortName: "", status: "active" });
    setBucketForm((current) => ({
      ...current,
      clientAssociationId: current.clientAssociationId || client.id
    }));
    setProgramSeriesForm((current) => ({
      ...current,
      clientAssociationId: current.clientAssociationId || client.id
    }));
    setClientFeedback("Client added with Membership and General Operations buckets.");
  }

  function handleBucketSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let nextProgramSeries = selectedProgramSeries;

    if (programSeriesMode === "new") {
      const seriesValidation = validateProgramSeriesCreateInput(programSeriesForm, state);

      if (!seriesValidation.isValid) {
        setBucketFeedback(seriesValidation.errors[0] ?? "Check the program/series fields.");
        return;
      }

      nextProgramSeries = createProgramSeries(programSeriesForm, state);
      addProgramSeries(nextProgramSeries);
    }

    if (!nextProgramSeries) {
      setBucketFeedback("Program/series is required.");
      return;
    }

    const structuredBucket: WorkBucketCreateInput = {
      ...bucketForm,
      clientAssociationId: nextProgramSeries.clientAssociationId,
      programSeriesId: nextProgramSeries.id,
      kind: nextProgramSeries.defaultKind,
      name: nextProgramSeries.name,
      recurrence: nextProgramSeries.recurrence,
      deliveryFormat: bucketForm.deliveryFormat ?? nextProgramSeries.defaultDeliveryFormat,
      startsAt: bucketForm.startsAt || structuredCycle.startsAt,
      cycleLabel: bucketForm.cycleLabel?.trim() || structuredCycle.cycleLabel,
      generatedLabel: bucketForm.generatedLabel?.trim() || generatedBucketLabel
    };
    const validation = validateWorkBucketCreateInput(structuredBucket, {
      ...state,
      programSeries: programSeriesMode === "new" ? [...state.programSeries, nextProgramSeries] : state.programSeries
    });

    if (!validation.isValid) {
      setBucketFeedback(validation.errors[0] ?? "Check the required fields.");
      return;
    }

    const bucket = createWorkBucket(structuredBucket, {
      ...state,
      programSeries: programSeriesMode === "new" ? [...state.programSeries, nextProgramSeries] : state.programSeries
    });
    addWorkBucket(bucket);
    setBucketForm((current) => ({
      ...current,
      generatedLabel: "",
      notes: "",
      status: "planning"
    }));
    setProgramSeriesForm((current) => ({ ...current, name: "", notes: "" }));
    setProgramSeriesMode("existing");
    setBucketFeedback(`${getBucketDisplayLabel(bucket, nextProgramSeries)} added.`);
  }

  return (
    <div className="amc-dashboard">
      <section className="amc-page-header">
        <div>
          <p className="amc-kicker">Client Associations</p>
          <h1>Clients and buckets</h1>
          <p>
            Client associations are the parent scope for events, programs, sponsor fulfillment,
            publications, and internal operations. Event creation starts here as an event bucket.
          </p>
        </div>
      </section>

      <section className="amc-grid">
        <div className="amc-panel">
          <div className="amc-panel__header">
            <h2>Add Client</h2>
            <span>Association scope</span>
          </div>
          <form className="amc-form-stack" onSubmit={handleClientSubmit}>
            <label>
              <span>Client Name</span>
              <input
                onChange={(event) => setClientForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Association name"
                type="text"
                value={clientForm.name}
              />
            </label>
            <label>
              <span>Short Name</span>
              <input
                onChange={(event) => setClientForm((current) => ({ ...current, shortName: event.target.value }))}
                placeholder="Acronym"
                type="text"
                value={clientForm.shortName}
              />
            </label>
            <label>
              <span>Status</span>
              <select
                onChange={(event) =>
                  setClientForm((current) => ({
                    ...current,
                    status: event.target.value as ClientAssociationCreateInput["status"]
                  }))
                }
                value={clientForm.status}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <button className="topbar__button" type="submit">
              Add Client
            </button>
          </form>
          {clientFeedback ? <div className="amc-form-feedback">{clientFeedback}</div> : null}
        </div>

        <div className="amc-panel">
          <div className="amc-panel__header">
            <h2>Add Bucket</h2>
            <span>Event or work area</span>
          </div>
          <form className="amc-form-stack" onSubmit={handleBucketSubmit}>
            <label>
              <span>Client</span>
              <select
                onChange={(event) => {
                  const clientAssociationId = event.target.value;
                  const nextSeries = state.programSeries.find((series) => series.clientAssociationId === clientAssociationId && series.active);

                  setBucketForm((current) => ({
                    ...current,
                    clientAssociationId,
                    programSeriesId: nextSeries?.id ?? "",
                    kind: nextSeries?.defaultKind ?? current.kind,
                    name: nextSeries?.name ?? current.name
                  }));
                  setProgramSeriesForm((current) => ({
                    ...current,
                    clientAssociationId
                  }));
                }}
                value={bucketForm.clientAssociationId}
              >
                {state.clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.shortName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Program / Series</span>
              <select
                onChange={(event) => {
                  const value = event.target.value;

                  if (value === "__new__") {
                    setProgramSeriesMode("new");
                    setBucketForm((current) => ({ ...current, programSeriesId: "", name: "" }));
                    return;
                  }

                  const series = state.programSeries.find((candidate) => candidate.id === value);

                  setProgramSeriesMode("existing");
                  setBucketForm((current) => ({
                    ...current,
                    programSeriesId: value,
                    kind: series?.defaultKind ?? current.kind,
                    name: series?.name ?? current.name,
                    recurrence: series?.recurrence ?? current.recurrence,
                    deliveryFormat: series?.defaultDeliveryFormat ?? current.deliveryFormat
                  }));
                }}
                value={programSeriesMode === "new" ? "__new__" : bucketForm.programSeriesId ?? ""}
              >
                {selectedClientSeries.map((series) => (
                  <option key={series.id} value={series.id}>
                    {series.name} ({RECURRENCE_PATTERN_LABELS[series.recurrence]})
                  </option>
                ))}
                <option value="__new__">Create new program/series</option>
              </select>
            </label>

            {programSeriesMode === "new" ? (
              <>
                <label>
                  <span>Program / Series Name</span>
                  <input
                    onChange={(event) => setProgramSeriesForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Best Pest Expo, News Brief, General Operations"
                    type="text"
                    value={programSeriesForm.name}
                  />
                </label>
                <div className="amc-inline-form-grid">
                  <label>
                    <span>Default Kind</span>
                    <select
                      onChange={(event) =>
                        setProgramSeriesForm((current) => ({
                          ...current,
                          defaultKind: event.target.value as WorkBucketKind
                        }))
                      }
                      value={programSeriesForm.defaultKind}
                    >
                      {BUCKET_KIND_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Recurrence</span>
                    <select
                      onChange={(event) =>
                        setProgramSeriesForm((current) => ({
                          ...current,
                          recurrence: event.target.value as RecurrencePattern
                        }))
                      }
                      value={programSeriesForm.recurrence}
                    >
                      {RECURRENCE_PATTERNS.map((recurrence) => (
                        <option key={recurrence} value={recurrence}>
                          {RECURRENCE_PATTERN_LABELS[recurrence]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  <span>Default Delivery Format</span>
                  <select
                    onChange={(event) =>
                      setProgramSeriesForm((current) => ({
                        ...current,
                        defaultDeliveryFormat: event.target.value as DeliveryFormat
                      }))
                    }
                    value={programSeriesForm.defaultDeliveryFormat}
                  >
                    {DELIVERY_FORMATS.map((format) => (
                      <option key={format} value={format}>
                        {DELIVERY_FORMAT_LABELS[format]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Program / Series Notes</span>
                  <textarea
                    onChange={(event) => setProgramSeriesForm((current) => ({ ...current, notes: event.target.value }))}
                    value={programSeriesForm.notes}
                  />
                </label>
              </>
            ) : null}

            <div className="amc-inline-form-grid">
              <CycleInputs
                cycleInputs={cycleInputs}
                recurrence={selectedRecurrence}
                setBucketForm={setBucketForm}
                setCycleInputs={setCycleInputs}
              />
            </div>

            <label>
              <span>Generated Label</span>
              <input readOnly type="text" value={generatedBucketLabel} />
            </label>
            <label>
              <span>Label Override</span>
              <input
                onChange={(event) => setBucketForm((current) => ({ ...current, generatedLabel: event.target.value }))}
                placeholder="Optional for unusual cases"
                type="text"
                value={bucketForm.generatedLabel ?? ""}
              />
            </label>
            <label>
              <span>Status</span>
              <select
                onChange={(event) =>
                  setBucketForm((current) => ({
                    ...current,
                    status: event.target.value as WorkBucketCreateInput["status"]
                  }))
                }
                value={bucketForm.status}
              >
                <option value="idea">Idea</option>
                <option value="planning">Planning</option>
                <option value="production">Production</option>
                <option value="live">Live</option>
                <option value="closeout">Closeout</option>
                <option value="complete">Complete</option>
                <option value="canceled">Canceled</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <div className="amc-inline-form-grid">
              <label>
                <span>Planning Starts</span>
                <input
                  onChange={(event) => setBucketForm((current) => ({ ...current, planningStartsAt: event.target.value }))}
                  type="date"
                  value={bucketForm.planningStartsAt ?? ""}
                />
              </label>
              <label>
                <span>Start Date</span>
                <input
                  onChange={(event) => setBucketForm((current) => ({ ...current, startsAt: event.target.value }))}
                  type="date"
                  value={bucketForm.startsAt || structuredCycle.startsAt}
                />
              </label>
            </div>
            <div className="amc-inline-form-grid">
              <label>
                <span>End Date</span>
                <input
                  onChange={(event) => setBucketForm((current) => ({ ...current, endsAt: event.target.value }))}
                  type="date"
                  value={bucketForm.endsAt ?? ""}
                />
              </label>
              <label>
                <span>Closeout Due</span>
                <input
                  onChange={(event) => setBucketForm((current) => ({ ...current, closeoutDueAt: event.target.value }))}
                  type="date"
                  value={bucketForm.closeoutDueAt ?? ""}
                />
              </label>
            </div>
            <div className="amc-inline-form-grid">
              <label>
                <span>Delivery Format</span>
                <select
                  onChange={(event) =>
                    setBucketForm((current) => ({
                      ...current,
                      deliveryFormat: event.target.value as DeliveryFormat
                    }))
                  }
                  value={bucketForm.deliveryFormat ?? selectedProgramSeries?.defaultDeliveryFormat ?? programSeriesForm.defaultDeliveryFormat}
                >
                  {DELIVERY_FORMATS.map((format) => (
                    <option key={format} value={format}>
                      {DELIVERY_FORMAT_LABELS[format]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Location Type</span>
                <select
                  onChange={(event) =>
                    setBucketForm((current) => ({
                      ...current,
                      locationType: event.target.value as LocationType
                    }))
                  }
                  value={bucketForm.locationType ?? "notApplicable"}
                >
                  {LOCATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {LOCATION_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <span>Location / Platform</span>
              <input
                onChange={(event) => setBucketForm((current) => ({ ...current, locationName: event.target.value }))}
                placeholder="Venue, city, Zoom, LMS, or N/A"
                type="text"
                value={bucketForm.locationName ?? ""}
              />
            </label>
            <label>
              <span>Owner</span>
              <select
                onChange={(event) => setBucketForm((current) => ({ ...current, ownerId: event.target.value }))}
                value={bucketForm.ownerId ?? ""}
              >
                <option value="">Unassigned</option>
                {state.staff.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Notes</span>
              <textarea
                onChange={(event) => setBucketForm((current) => ({ ...current, notes: event.target.value }))}
                value={bucketForm.notes ?? ""}
              />
            </label>
            <button className="topbar__button" disabled={state.clients.length === 0} type="submit">
              Add Bucket
            </button>
          </form>
          {bucketFeedback ? <div className="amc-form-feedback">{bucketFeedback}</div> : null}
        </div>
      </section>

      <section className="amc-panel">
        <div className="amc-panel__header">
          <h2>Client Work Structure</h2>
          <span>{state.clients.length} clients</span>
        </div>
        <div className="amc-client-card-grid">
          {bucketsByClient.map(({ client, buckets }) => {
            const clientProgramSeries = state.programSeries.filter((series) => series.clientAssociationId === client.id);
            const activeProgramSeries = clientProgramSeries.filter((series) => series.active);
            const currentBuckets = getCurrentBuckets(buckets);
            const pastOrArchivedBuckets = buckets.filter((bucket) => isBucketPast(bucket) || isBucketArchived(bucket));
            const visibleBuckets = currentBuckets.slice(0, 5);
            const visibleProgramSeries = activeProgramSeries.slice(0, 6);
            const managedStructure = managedClientId === client.id ? getClientWorkStructure(state, { clientId: client.id }) : null;

            return (
              <article className="amc-client-card" key={client.id}>
                <div className="amc-client-card__header">
                  <div>
                    <p className="amc-kicker">Client association</p>
                    <h3>{client.name}</h3>
                    <span>{client.shortName} / {client.status}</span>
                  </div>
                  <button
                    className="topbar__button"
                    onClick={() => {
                      setManagedClientId((current) => (current === client.id ? null : client.id));
                      setStructureFeedback("");
                    }}
                    type="button"
                  >
                    {managedClientId === client.id ? "Hide work structure" : "Manage work structure"}
                  </button>
                </div>

                <div className="amc-client-card__summary" aria-label={`${client.shortName} work structure summary`}>
                  <div>
                    <strong>{activeProgramSeries.length}</strong>
                    <span>Active programs</span>
                  </div>
                  <div>
                    <strong>{currentBuckets.length}</strong>
                    <span>Current buckets</span>
                  </div>
                  <div>
                    <strong>{pastOrArchivedBuckets.length}</strong>
                    <span>Past or archived</span>
                  </div>
                  <div>
                    <strong>{buckets.length}</strong>
                    <span>Total buckets</span>
                  </div>
                </div>

                <div className="amc-client-card__section">
                  <div className="amc-client-card__section-header">
                    <strong>Program / Series</strong>
                    <span>{activeProgramSeries.length} active</span>
                  </div>
                  {visibleProgramSeries.length === 0 ? (
                    <div className="empty-state empty-state--compact">No active ProgramSeries yet.</div>
                  ) : (
                    <div className="amc-chip-list">
                      {visibleProgramSeries.map((series) => (
                        <span className="amc-chip" key={series.id}>
                          {series.name}
                        </span>
                      ))}
                      {activeProgramSeries.length > visibleProgramSeries.length ? (
                        <span className="amc-chip">+{activeProgramSeries.length - visibleProgramSeries.length} more</span>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="amc-client-card__section">
                  <div className="amc-client-card__section-header">
                    <strong>Current bucket workspaces</strong>
                    <span>{currentBuckets.length} visible</span>
                  </div>
                  {visibleBuckets.length === 0 ? (
                    <div className="empty-state empty-state--compact">No current buckets. Use Add Bucket to create the next cycle.</div>
                  ) : (
                    <div className="amc-client-card__bucket-links">
                      {visibleBuckets.map((bucket) => {
                        const programSeries = state.programSeries.find((series) => series.id === bucket.programSeriesId);

                        return (
                          <Link className="button-link button-link--inline-secondary" href={`/clients/${client.id}/buckets/${bucket.id}`} key={bucket.id}>
                            {getBucketDisplayLabel(bucket, programSeries)}
                          </Link>
                        );
                      })}
                      {currentBuckets.length > visibleBuckets.length ? (
                        <button
                          className="button-link button-link--inline-secondary"
                          onClick={() => {
                            setManagedClientId(client.id);
                            setStructureFeedback("");
                          }}
                          type="button"
                        >
                          View {currentBuckets.length - visibleBuckets.length} more
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>

                {managedStructure?.client ? (
                  <ClientWorkStructureManager
                    bucketFeedback={structureFeedback}
                    buckets={state.buckets}
                    clientName={managedStructure.client.name}
                    onArchiveBucket={(bucket) => {
                      updateWorkBucket(bucket.id, {
                        status: "archived",
                        isArchived: true,
                        archivedAt: new Date().toISOString()
                      });
                      setStructureFeedback(`${getBucketDisplayLabel(bucket)} archived.`);
                    }}
                    onRestoreBucket={(bucket) => {
                      updateWorkBucket(bucket.id, {
                        status: "planning",
                        isArchived: false,
                        archivedAt: ""
                      });
                      setStructureFeedback(`${getBucketDisplayLabel(bucket)} restored.`);
                    }}
                    onUpdateBucket={(bucketId, updates) => {
                      updateWorkBucket(bucketId, updates);
                      setStructureFeedback("Bucket updated.");
                    }}
                    onUpdateProgramSeries={(seriesId, updates) => {
                      updateProgramSeries(seriesId, updates);
                      setStructureFeedback("Program/series updated.");
                    }}
                    programSeries={managedStructure.programSeries}
                    staff={state.staff}
                    unassignedBuckets={managedStructure.unassignedBuckets}
                  />
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function CycleInputs({
  cycleInputs,
  recurrence,
  setBucketForm,
  setCycleInputs
}: {
  cycleInputs: { year: string; month: string; quarter: string; adHocLabel: string };
  recurrence: RecurrencePattern;
  setBucketForm: Dispatch<SetStateAction<WorkBucketCreateInput>>;
  setCycleInputs: Dispatch<SetStateAction<{ year: string; month: string; quarter: string; adHocLabel: string }>>;
}) {
  if (recurrence === "ongoing") {
    return (
      <label>
        <span>Cycle</span>
        <input readOnly type="text" value="Ongoing" />
      </label>
    );
  }

  if (recurrence === "monthly") {
    return (
      <>
        <label>
          <span>Cycle Month</span>
          <select
            onChange={(event) => {
              setCycleInputs((current) => ({ ...current, month: event.target.value }));
              setBucketForm((current) => ({ ...current, startsAt: "" }));
            }}
            value={cycleInputs.month}
          >
            {MONTH_OPTIONS.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </label>
        <YearInput cycleInputs={cycleInputs} setBucketForm={setBucketForm} setCycleInputs={setCycleInputs} />
      </>
    );
  }

  if (recurrence === "quarterly") {
    return (
      <>
        <label>
          <span>Cycle Quarter</span>
          <select
            onChange={(event) => {
              setCycleInputs((current) => ({ ...current, quarter: event.target.value }));
              setBucketForm((current) => ({ ...current, startsAt: "" }));
            }}
            value={cycleInputs.quarter}
          >
            {QUARTER_OPTIONS.map((quarter) => (
              <option key={quarter.value} value={quarter.value}>
                {quarter.label}
              </option>
            ))}
          </select>
        </label>
        <YearInput cycleInputs={cycleInputs} setBucketForm={setBucketForm} setCycleInputs={setCycleInputs} />
      </>
    );
  }

  if (recurrence === "annual") {
    return <YearInput cycleInputs={cycleInputs} setBucketForm={setBucketForm} setCycleInputs={setCycleInputs} />;
  }

  return (
    <label>
      <span>Cycle Label</span>
      <input
        onChange={(event) => {
          setCycleInputs((current) => ({ ...current, adHocLabel: event.target.value }));
          setBucketForm((current) => ({ ...current, cycleLabel: event.target.value }));
        }}
        placeholder="Spring 2026, Launch cycle, Week of 6/1"
        type="text"
        value={cycleInputs.adHocLabel}
      />
    </label>
  );
}

function ClientWorkStructureManager({
  bucketFeedback,
  buckets,
  clientName,
  onArchiveBucket,
  onRestoreBucket,
  onUpdateBucket,
  onUpdateProgramSeries,
  programSeries,
  staff,
  unassignedBuckets
}: {
  bucketFeedback: string;
  buckets: WorkBucket[];
  clientName: string;
  onArchiveBucket: (bucket: WorkBucket) => void;
  onRestoreBucket: (bucket: WorkBucket) => void;
  onUpdateBucket: (bucketId: string, updates: WorkBucketUpdateInput) => void;
  onUpdateProgramSeries: (seriesId: string, updates: ProgramSeriesUpdateInput) => void;
  programSeries: Array<{ series: ProgramSeries; buckets: WorkBucket[] }>;
  staff: StaffProfile[];
  unassignedBuckets: WorkBucket[];
}) {
  return (
    <section className="amc-panel">
      <div className="amc-panel__header">
        <div>
          <h2>Manage work structure</h2>
          <span>{clientName}</span>
        </div>
        <span>{programSeries.length} program/series</span>
      </div>
      {bucketFeedback ? <div className="amc-form-feedback">{bucketFeedback}</div> : null}
      <div className="amc-list">
        {programSeries.map(({ series, buckets: seriesBuckets }) => (
          <article className="amc-client-structure-row" key={series.id}>
            <ProgramSeriesEditForm onUpdate={(updates) => onUpdateProgramSeries(series.id, updates)} series={series} />
            <div className="amc-bucket-link-list">
              {seriesBuckets.length === 0 ? (
                <div className="empty-state">No bucket instances yet.</div>
              ) : (
                seriesBuckets.map((bucket) => (
                  <BucketLifecycleEditForm
                    bucket={bucket}
                    buckets={buckets}
                    key={bucket.id}
                    onArchive={() => onArchiveBucket(bucket)}
                    onRestore={() => onRestoreBucket(bucket)}
                    onUpdate={(updates) => onUpdateBucket(bucket.id, updates)}
                    programSeries={series}
                    staff={staff}
                  />
                ))
              )}
            </div>
          </article>
        ))}
        {unassignedBuckets.length > 0 ? (
          <article className="amc-client-structure-row">
            <div className="amc-client-structure-row__header">
              <div>
                <strong>Unassigned buckets</strong>
                <span>Missing or unknown ProgramSeries</span>
              </div>
              <span>{unassignedBuckets.length} buckets</span>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}

function ProgramSeriesEditForm({
  onUpdate,
  series
}: {
  onUpdate: (updates: ProgramSeriesUpdateInput) => void;
  series: ProgramSeries;
}) {
  const [draft, setDraft] = useState<ProgramSeriesUpdateInput>({
    name: series.name,
    defaultKind: series.defaultKind,
    recurrence: series.recurrence,
    defaultDeliveryFormat: series.defaultDeliveryFormat,
    active: series.active,
    notes: series.notes
  });

  return (
    <div className="amc-client-structure-row__header">
      <div className="amc-form-stack">
        <label>
          <span>Program / Series Name</span>
          <input onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} type="text" value={draft.name ?? ""} />
        </label>
        <div className="amc-inline-form-grid">
          <label>
            <span>Default Kind</span>
            <select
              onChange={(event) => setDraft((current) => ({ ...current, defaultKind: event.target.value as WorkBucketKind }))}
              value={draft.defaultKind}
            >
              {BUCKET_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Recurrence</span>
            <select
              onChange={(event) => setDraft((current) => ({ ...current, recurrence: event.target.value as RecurrencePattern }))}
              value={draft.recurrence}
            >
              {RECURRENCE_PATTERNS.map((recurrence) => (
                <option key={recurrence} value={recurrence}>
                  {RECURRENCE_PATTERN_LABELS[recurrence]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="amc-inline-form-grid">
          <label>
            <span>Default Delivery</span>
            <select
              onChange={(event) => setDraft((current) => ({ ...current, defaultDeliveryFormat: event.target.value as DeliveryFormat }))}
              value={draft.defaultDeliveryFormat}
            >
              {DELIVERY_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {DELIVERY_FORMAT_LABELS[format]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Active</span>
            <select
              onChange={(event) => setDraft((current) => ({ ...current, active: event.target.value === "true" }))}
              value={String(draft.active)}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
        </div>
        <label>
          <span>Notes</span>
          <textarea onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} value={draft.notes ?? ""} />
        </label>
        <button className="button-link button-link--inline-secondary" onClick={() => onUpdate(draft)} type="button">
          Save Program / Series
        </button>
      </div>
      <span>
        {WORK_BUCKET_KIND_LABELS[series.defaultKind]} / {RECURRENCE_PATTERN_LABELS[series.recurrence]}
      </span>
    </div>
  );
}

function BucketLifecycleEditForm({
  bucket,
  buckets,
  onArchive,
  onRestore,
  onUpdate,
  programSeries,
  staff
}: {
  bucket: WorkBucket;
  buckets: WorkBucket[];
  onArchive: () => void;
  onRestore: () => void;
  onUpdate: (updates: WorkBucketUpdateInput) => void;
  programSeries: ProgramSeries;
  staff: StaffProfile[];
}) {
  const [draft, setDraft] = useState<WorkBucketUpdateInput>({
    status: bucket.status,
    cycleLabel: bucket.cycleLabel ?? "",
    generatedLabel: bucket.generatedLabel ?? "",
    planningStartsAt: bucket.planningStartsAt ?? "",
    startsAt: bucket.startsAt ?? "",
    endsAt: bucket.endsAt ?? "",
    closeoutDueAt: bucket.closeoutDueAt ?? "",
    deliveryFormat: bucket.deliveryFormat ?? programSeries.defaultDeliveryFormat,
    locationName: bucket.locationName ?? "",
    locationType: bucket.locationType ?? "notApplicable",
    ownerId: bucket.ownerId ?? "",
    previousBucketId: bucket.previousBucketId ?? "",
    notes: bucket.notes ?? ""
  });
  const displayLabel = getBucketDisplayLabel({ ...bucket, ...draft }, programSeries);

  return (
    <div className="amc-bucket-link-row">
      <div className="amc-form-stack">
        <div>
          <strong>{displayLabel}</strong>
          <span>
            {WORK_BUCKET_STATUS_LABELS[bucket.status]} / {bucket.cycleLabel || "No cycle"} /{" "}
            {isBucketArchived(bucket) ? "Archived" : "Active views"}
          </span>
        </div>
        <div className="amc-inline-form-grid">
          <label>
            <span>Status</span>
            <select
              onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as WorkBucketUpdateInput["status"] }))}
              value={draft.status}
            >
              {WORK_BUCKET_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {WORK_BUCKET_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Cycle Label</span>
            <input onChange={(event) => setDraft((current) => ({ ...current, cycleLabel: event.target.value }))} type="text" value={draft.cycleLabel ?? ""} />
          </label>
        </div>
        <label>
          <span>Label Override</span>
          <input onChange={(event) => setDraft((current) => ({ ...current, generatedLabel: event.target.value }))} type="text" value={draft.generatedLabel ?? ""} />
        </label>
        <div className="amc-inline-form-grid">
          <label>
            <span>Planning Starts</span>
            <input onChange={(event) => setDraft((current) => ({ ...current, planningStartsAt: event.target.value }))} type="date" value={draft.planningStartsAt ?? ""} />
          </label>
          <label>
            <span>Start</span>
            <input onChange={(event) => setDraft((current) => ({ ...current, startsAt: event.target.value }))} type="date" value={draft.startsAt ?? ""} />
          </label>
        </div>
        <div className="amc-inline-form-grid">
          <label>
            <span>End</span>
            <input onChange={(event) => setDraft((current) => ({ ...current, endsAt: event.target.value }))} type="date" value={draft.endsAt ?? ""} />
          </label>
          <label>
            <span>Closeout Due</span>
            <input onChange={(event) => setDraft((current) => ({ ...current, closeoutDueAt: event.target.value }))} type="date" value={draft.closeoutDueAt ?? ""} />
          </label>
        </div>
        <div className="amc-inline-form-grid">
          <label>
            <span>Delivery Format</span>
            <select
              onChange={(event) => setDraft((current) => ({ ...current, deliveryFormat: event.target.value as DeliveryFormat }))}
              value={draft.deliveryFormat}
            >
              {DELIVERY_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {DELIVERY_FORMAT_LABELS[format]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Location Type</span>
            <select
              onChange={(event) => setDraft((current) => ({ ...current, locationType: event.target.value as LocationType }))}
              value={draft.locationType}
            >
              {LOCATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {LOCATION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          <span>Location / Platform</span>
          <input onChange={(event) => setDraft((current) => ({ ...current, locationName: event.target.value }))} type="text" value={draft.locationName ?? ""} />
        </label>
        <div className="amc-inline-form-grid">
          <label>
            <span>Owner</span>
            <select onChange={(event) => setDraft((current) => ({ ...current, ownerId: event.target.value }))} value={draft.ownerId ?? ""}>
              <option value="">Unassigned</option>
              {staff.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Previous Bucket</span>
            <select onChange={(event) => setDraft((current) => ({ ...current, previousBucketId: event.target.value }))} value={draft.previousBucketId ?? ""}>
              <option value="">None</option>
              {buckets
                .filter((candidate) => candidate.id !== bucket.id && candidate.programSeriesId === bucket.programSeriesId)
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {getBucketDisplayLabel(candidate, programSeries)}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <label>
          <span>Notes</span>
          <textarea onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} value={draft.notes ?? ""} />
        </label>
        <div className="amc-record-actions">
          <button className="button-link button-link--inline-secondary" onClick={() => onUpdate(draft)} type="button">
            Save Bucket
          </button>
          {isBucketArchived(bucket) ? (
            <button className="topbar__button" onClick={onRestore} type="button">
              Unarchive
            </button>
          ) : (
            <button className="button-link button-link--inline-secondary" onClick={onArchive} type="button">
              Archive
            </button>
          )}
        </div>
      </div>
      <Link className="button-link button-link--inline-secondary" href={`/clients/${bucket.clientAssociationId}/buckets/${bucket.id}`}>
        Open workspace
      </Link>
    </div>
  );
}

function YearInput({
  cycleInputs,
  setBucketForm,
  setCycleInputs
}: {
  cycleInputs: { year: string; month: string; quarter: string; adHocLabel: string };
  setBucketForm: Dispatch<SetStateAction<WorkBucketCreateInput>>;
  setCycleInputs: Dispatch<SetStateAction<{ year: string; month: string; quarter: string; adHocLabel: string }>>;
}) {
  return (
    <label>
      <span>Cycle Year</span>
      <input
        onChange={(event) => {
          setCycleInputs((current) => ({ ...current, year: event.target.value }));
          setBucketForm((current) => ({ ...current, startsAt: "" }));
        }}
        type="number"
        value={cycleInputs.year}
      />
    </label>
  );
}

function getStructuredCycle(
  recurrence: RecurrencePattern,
  cycleInputs: { year: string; month: string; quarter: string; adHocLabel: string }
) {
  const year = cycleInputs.year.trim();

  if (!year || recurrence === "ongoing") {
    return { cycleLabel: "", startsAt: "" };
  }

  if (recurrence === "annual") {
    return { cycleLabel: year, startsAt: `${year}-01-01` };
  }

  if (recurrence === "monthly") {
    const month = MONTH_OPTIONS.find((option) => option.value === cycleInputs.month);

    return {
      cycleLabel: `${month?.label ?? "January"} ${year}`,
      startsAt: `${year}-${cycleInputs.month}-01`
    };
  }

  if (recurrence === "quarterly") {
    const quarter = QUARTER_OPTIONS.find((option) => option.value === cycleInputs.quarter) ?? QUARTER_OPTIONS[0]!;

    return {
      cycleLabel: `${quarter.label} ${year}`,
      startsAt: `${year}-${quarter.startMonth}-01`
    };
  }

  return {
    cycleLabel: cycleInputs.adHocLabel.trim(),
    startsAt: ""
  };
}
