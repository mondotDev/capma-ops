import {
  DEMO_FOUNDATION_DATA,
  getAssigneeName,
  getBucketName,
  getClientAssociationName,
  getVisibleWorkItems
} from "@/lib/amc-domain";

export default function WorkPage() {
  const data = DEMO_FOUNDATION_DATA;
  const items = getVisibleWorkItems(data.workItems, { viewer: data.currentUser });

  return (
    <div className="amc-dashboard">
      <section className="amc-page-header">
        <div>
          <p className="amc-kicker">Assigned Work</p>
          <h1>One readable work queue</h1>
          <p>
            The queue is fed by separate tracker domains. Action items, collateral, education,
            speakers, and sponsor fulfillment keep their own fields while sharing client, bucket,
            and assignee scope.
          </p>
        </div>
      </section>

      <section className="amc-panel">
        <div className="amc-list">
          {items.map((item) => (
            <article className="amc-list-row amc-list-row--work" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>
                  {getClientAssociationName(data.clients, item.clientAssociationId)} /{" "}
                  {getBucketName(data.buckets, item.bucketId)}
                </span>
              </div>
              <div className="amc-list-row__meta">
                <span>{item.status}</span>
                <span>{item.tracker}</span>
                <span>{getAssigneeName(data.staff, item.assigneeId)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
