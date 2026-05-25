"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAmcLocalState } from "@/components/amc-local-state-provider";
import {
  createClientAssociation,
  createWorkBucket,
  validateClientAssociationCreateInput,
  validateWorkBucketCreateInput,
  WORK_BUCKET_KIND_LABELS,
  WORK_BUCKET_STATUS_LABELS,
  type ClientAssociationCreateInput,
  type WorkBucketCreateInput,
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

export function AmcClientManagement() {
  const { state, addClientAssociation, addWorkBucket } = useAmcLocalState();
  const firstClientId = state.clients[0]?.id ?? "";
  const [clientForm, setClientForm] = useState<ClientAssociationCreateInput>({
    name: "",
    shortName: "",
    status: "active"
  });
  const [bucketForm, setBucketForm] = useState<WorkBucketCreateInput>({
    clientAssociationId: firstClientId,
    kind: "event",
    name: "",
    status: "planning"
  });
  const [clientFeedback, setClientFeedback] = useState("");
  const [bucketFeedback, setBucketFeedback] = useState("");
  const bucketsByClient = useMemo(
    () =>
      state.clients.map((client) => ({
        client,
        buckets: state.buckets.filter((bucket) => bucket.clientAssociationId === client.id)
      })),
    [state.buckets, state.clients]
  );

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
    setClientFeedback("Client added with Membership and General Operations buckets.");
  }

  function handleBucketSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateWorkBucketCreateInput(bucketForm, state);

    if (!validation.isValid) {
      setBucketFeedback(validation.errors[0] ?? "Check the required fields.");
      return;
    }

    const bucket = createWorkBucket(bucketForm, state);
    addWorkBucket(bucket);
    setBucketForm((current) => ({ ...current, name: "", status: "planning" }));
    setBucketFeedback(bucket.kind === "event" ? "Event bucket added." : "Bucket added.");
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
                onChange={(event) => setBucketForm((current) => ({ ...current, clientAssociationId: event.target.value }))}
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
              <span>Kind</span>
              <select
                onChange={(event) =>
                  setBucketForm((current) => ({ ...current, kind: event.target.value as WorkBucketKind }))
                }
                value={bucketForm.kind}
              >
                {BUCKET_KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{bucketForm.kind === "event" ? "Event Name" : "Bucket Name"}</span>
              <input
                onChange={(event) => setBucketForm((current) => ({ ...current, name: event.target.value }))}
                placeholder={bucketForm.kind === "event" ? "Annual Conference 2027" : "Work bucket name"}
                type="text"
                value={bucketForm.name}
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
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="complete">Complete</option>
              </select>
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
        <div className="amc-list">
          {bucketsByClient.map(({ client, buckets }) => (
            <article className="amc-client-structure-row" key={client.id}>
              <div className="amc-client-structure-row__header">
                <div>
                  <strong>{client.name}</strong>
                  <span>{client.shortName} / {client.status}</span>
                </div>
                <span>{buckets.length} buckets</span>
              </div>
              <div className="amc-bucket-link-list">
                {buckets.length === 0 ? (
                  <div className="empty-state">No buckets yet.</div>
                ) : (
                  buckets.map((bucket) => (
                    <div className="amc-bucket-link-row" key={bucket.id}>
                      <div>
                        <strong>{bucket.name}</strong>
                        <span>
                          {WORK_BUCKET_KIND_LABELS[bucket.kind]} / {WORK_BUCKET_STATUS_LABELS[bucket.status]}
                        </span>
                      </div>
                      <Link className="button-link button-link--inline-secondary" href={`/clients/${client.id}/buckets/${bucket.id}`}>
                        Open workspace
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
