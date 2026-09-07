"use client";

import Link from "next/link";
import { BarChart3, CalendarDays, ChevronRight, ClipboardList, LogOut, Menu, Settings, TicketCheck, X } from "lucide-react";
import { ReactNode, useState } from "react";

type StaffSection = "events" | "bookings" | "check-in" | "reports" | "admin";

const navigation = [
  { id: "events", label: "Events", href: "/manage/cms", icon: CalendarDays },
  { id: "bookings", label: "Bookings", href: "/manage/cms#submissions", icon: ClipboardList },
  { id: "check-in", label: "Check-in", href: "/manage/check-in", icon: TicketCheck },
  { id: "reports", label: "Reports", href: "/manage/operations", icon: BarChart3 },
  { id: "admin", label: "Admin", href: "/manage/admin", icon: Settings },
] as const;

export default function StaffShell({ active, title, children }: { active: StaffSection; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  function logout() {
    fetch("/api/auth/logout", { method: "POST" }).finally(() => { window.location.href = "/"; });
  }

  return (
    <main className="staff-app-shell">
      <aside className={open ? "staff-sidebar is-open" : "staff-sidebar"} aria-label="Staff navigation">
        <Link className="staff-logo" href="/manage/cms" onClick={() => setOpen(false)}>
          <img src="/brand/hilston-park-logo.webp" alt="Hilston Park" />
          <span>Operations</span>
        </Link>
        <nav className="staff-nav">
          <p>Workspace</p>
          {navigation.map(({ id, label, href, icon: Icon }) => (
            <Link className={active === id ? "staff-nav-link active" : "staff-nav-link"} href={href} key={id} onClick={() => setOpen(false)}>
              <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {active === id && <ChevronRight aria-hidden="true" size={16} />}
            </Link>
          ))}
        </nav>
        <button className="staff-logout" type="button" onClick={logout}><LogOut aria-hidden="true" size={17} /> Log out</button>
      </aside>
      {open && <button className="staff-scrim" type="button" aria-label="Close navigation" onClick={() => setOpen(false)} />}
      <section className="staff-main">
        <header className="staff-topbar">
          <button className="staff-menu-toggle" type="button" aria-label={open ? "Close navigation" : "Open navigation"} onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
          <div><p>Hilston Park ticketing</p><h1>{title}</h1></div>
          <Link className="staff-checkin-shortcut" href="/manage/check-in"><TicketCheck aria-hidden="true" size={17} /> <span>Check-in</span></Link>
        </header>
        <div className="staff-page-content">{children}</div>
      </section>
    </main>
  );
}
