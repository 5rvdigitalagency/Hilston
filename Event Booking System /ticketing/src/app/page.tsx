import Link from "next/link";
import EventCatalogue from "./event-catalogue";

const navItems = ["Events", "My bookings", "Help"];

export default function Home() {
  return (
    <main className="page-shell">
      <nav className="topbar" aria-label="Ticketing navigation">
        <Link className="brand" href="/" aria-label="Hilston Park ticketing home">
          <img className="brand-logo" src="/brand/hilston-park-logo.webp" alt="Hilston Park Tickets" />
        </Link>
        <div className="nav-links">
          {navItems.map((item) => <a key={item} href={item === "Events" ? "/" : `/${item.toLowerCase().replace(" ", "-")}`}>{item}</a>)}
        </div>
        <a className="account-link" href="/account">Sign in <span aria-hidden="true">↗</span></a>
      </nav>

      <section className="intro" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Ticketing &amp; operations</p>
          <h1 id="page-title">Make a day of <span className="script-accent">it.</span></h1>
          <p className="intro-copy">A simple place to discover what is happening at Hilston Park and secure your place when tickets go on sale.</p>
        </div>
        <div className="intro-note"><span className="note-dot" /> <span>New events are added by the Hilston Park team.</span></div>
      </section>

      <section className="catalogue" aria-labelledby="catalogue-title">
        <div className="section-heading"><div><p className="eyebrow">The programme</p><h2 id="catalogue-title">Upcoming events</h2></div><span className="status-pill">Catalogue connecting soon</span></div>
        <EventCatalogue />
      </section>

      <footer className="footer"><span>Hilston Park Tickets</span><span>UK · GBP · Secure online booking</span><a href="/manage">Staff access</a></footer>
    </main>
  );
}
