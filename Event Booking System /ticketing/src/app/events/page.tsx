import Link from "next/link";
import EventCatalogue from "../event-catalogue";

export default function EventsPage() {
  return (
    <main className="page-shell">
      <header className="subbar"><Link className="brand" href="/"><span className="brand-mark">HP</span><span>Hilston Park <em>Tickets</em></span></Link><Link className="account-link" href="/account">Sign in <span aria-hidden="true">↗</span></Link></header>
      <section className="page-intro"><p className="eyebrow">The programme</p><h1>Upcoming events</h1><p>Find an event, choose your session, and book securely online.</p></section>
      <section className="content-section"><div className="section-heading"><div><p className="eyebrow">Live catalogue</p><h2>Available to book</h2></div><span className="status-pill">Live catalogue</span></div><EventCatalogue /></section>
      <footer className="footer"><Link href="/">Hilston Park Tickets</Link><Link href="/manage">Staff access</Link></footer>
    </main>
  );
}
