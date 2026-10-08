export default function ComingSoon({ eyebrow, heading, description, bullets }: { eyebrow: string; heading: string; description: string; bullets: string[] }) {
  return (
    <>
      <section className="staff-page-heading">
        <div><p className="eyebrow">{eyebrow}</p><h2>{heading}</h2><p>{description}</p></div>
      </section>
      <section className="staff-page-panel">
        <section className="cms-card">
          <div className="card-heading"><div><p className="eyebrow">Coming soon</p><h2>Not built yet</h2></div></div>
          <p className="panel-copy">This section is a placeholder. It isn’t connected to any data yet, and nothing here is functional.</p>
          {bullets.length > 0 && <ul className="admin-list">{bullets.map((item) => <li key={item}><strong>{item}</strong></li>)}</ul>}
        </section>
      </section>
    </>
  );
}
