import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-shell">
      <section className="content-section auth-layout">
        <p className="eyebrow">Hilston Park Tickets</p>
        <h1>Page not found.</h1>
        <p className="lead-copy">The page you’re looking for doesn’t exist or may have moved.</p>
        <Link className="primary-button" href="/events">Browse events <span aria-hidden="true">&rarr;</span></Link>
      </section>
    </main>
  );
}
