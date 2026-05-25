import { DEMO_FOUNDATION_DATA } from "@/lib/amc-domain";

export default function ClientsPage() {
  return (
    <div className="amc-dashboard">
      <section className="amc-page-header">
        <div>
          <p className="amc-kicker">Client Associations</p>
          <h1>Client list foundation</h1>
          <p>
            Client association records are now the parent scope for buckets, events, programs, and
            tracker work. This page is intentionally lightweight while the model settles.
          </p>
        </div>
      </section>

      <section className="amc-panel">
        <div className="amc-list">
          {DEMO_FOUNDATION_DATA.clients.map((client) => (
            <article className="amc-list-row" key={client.id}>
              <div>
                <strong>{client.name}</strong>
                <span>{client.shortName}</span>
              </div>
              <em>{client.status}</em>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
