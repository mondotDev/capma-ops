import {
  DEMO_FOUNDATION_DATA,
  getAssigneeName,
  getBucketDisplayLabel,
  getBucketName,
  getClientAssociationName,
  getFoundationWorkItems,
  isBucketCurrent,
  getVisibleWorkItems
} from "@/lib/amc-domain";

export function AmcDashboard() {
  const data = DEMO_FOUNDATION_DATA;
  const workItems = getFoundationWorkItems({
    actionItems: data.actionItems,
    collateralItems: data.collateralItems
  });
  const visibleWorkItems = getVisibleWorkItems(workItems, { viewer: data.currentUser });

  return (
    <div className="amc-dashboard">
      <section className="amc-page-header">
        <div>
          <p className="amc-kicker">{data.organization.name}</p>
          <h1>{data.currentUser.displayName}'s Operations Hub</h1>
          <p>
            A clean v2 foundation for AMCs managing multiple client associations, events, education
            programs, sponsors, collateral, speakers, and action items.
          </p>
        </div>
      </section>

      <section className="amc-metrics" aria-label="Workspace summary">
        <div className="amc-metric">
          <span>Clients</span>
          <strong>{data.clients.length}</strong>
        </div>
        <div className="amc-metric">
          <span>Active buckets</span>
          <strong>{data.buckets.filter((bucket) => isBucketCurrent(bucket)).length}</strong>
        </div>
        <div className="amc-metric">
          <span>Visible work</span>
          <strong>{visibleWorkItems.length}</strong>
        </div>
      </section>

      <section className="amc-grid">
        <div className="amc-panel">
          <div className="amc-panel__header">
            <h2>Client Buckets</h2>
            <span>First-class scope</span>
          </div>
          <div className="amc-list">
            {data.buckets.map((bucket) => (
              <article className="amc-list-row" key={bucket.id}>
                <div>
                  <strong>{getClientAssociationName(data.clients, bucket.clientAssociationId)}</strong>
                  <span>{getBucketDisplayLabel(bucket, data.programSeries.find((series) => series.id === bucket.programSeriesId))}</span>
                </div>
                <em>{bucket.kind}</em>
              </article>
            ))}
          </div>
        </div>

        <div className="amc-panel">
          <div className="amc-panel__header">
            <h2>Assigned Work</h2>
            <span>Role-aware read model</span>
          </div>
          <div className="amc-list">
            {visibleWorkItems.map((item) => (
              <article className="amc-list-row amc-list-row--work" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <span>
                    {getClientAssociationName(data.clients, item.clientAssociationId)} /{" "}
                    {getBucketName(data.buckets, item.bucketId)}
                  </span>
                </div>
                <div className="amc-list-row__meta">
                  <span>{item.tracker}</span>
                  <span>{getAssigneeName(data.staff, item.assigneeId)}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
