"use client";

import Link from "next/link";
import {
  ChartBar, Bell, CalendarDots, CaretDown, CaretLeft, ClipboardText, Kanban, Gift, Heart,
  Question, ClockCounterClockwise, House, SignOut, List, MagnifyingGlass, Gear, Shield, Ticket, QrCode, UserGear, Users, X,
} from "@phosphor-icons/react";
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type StaffSection = "overview" | "events" | "bookings" | "check-in" | "reports" | "admin" | "attendees" | "venues" | "coupons" | "gift-vouchers" | "settings" | "audit-logs";
type SearchEvent = { id: string; title: string; venue: string };
type SearchBooking = { bookingId: string; eventTitle: string; name: string };

type NavLink = { id: StaffSection; label: string; href: string; icon: typeof House; soon?: boolean };
type NavGroup = { heading: string; links: NavLink[] };

const topLink: NavLink = { id: "overview", label: "Dashboard", href: "/manage", icon: House };

const navGroups: NavGroup[] = [
  { heading: "Event management", links: [
    { id: "events", label: "Events", href: "/manage/cms", icon: CalendarDots },
    { id: "bookings", label: "Bookings", href: "/manage/bookings", icon: ClipboardText },
    { id: "attendees", label: "Attendees", href: "/manage/attendees", icon: Users, soon: true },
    { id: "check-in", label: "Check-in", href: "/manage/check-in", icon: QrCode },
  ] },
  { heading: "Catalogue", links: [
    { id: "admin", label: "Categories", href: "/manage/admin#admin-categories", icon: Kanban },
    { id: "venues", label: "Venues", href: "/manage/venues", icon: Heart, soon: true },
  ] },
  { heading: "Sales", links: [
    { id: "coupons", label: "Coupons", href: "/manage/coupons", icon: Ticket, soon: true },
    { id: "gift-vouchers", label: "Gift vouchers", href: "/manage/gift-vouchers", icon: Gift, soon: true },
  ] },
  { heading: "Reporting", links: [
    { id: "reports", label: "Reports", href: "/manage/operations", icon: ChartBar },
  ] },
  { heading: "Administration", links: [
    { id: "admin", label: "Users", href: "/manage/admin#admin-staff", icon: UserGear },
    { id: "admin", label: "Roles & permissions", href: "/manage/admin#admin-roles", icon: Shield },
    { id: "settings", label: "Settings", href: "/manage/settings", icon: Gear, soon: true },
    { id: "audit-logs", label: "Audit logs", href: "/manage/audit-logs", icon: ClockCounterClockwise, soon: true },
  ] },
];

export default function StaffShell({ active, title, children }: { active: StaffSection; title: string; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [session, setSession] = useState({ email: "", isAdmin: false });
  const [searchEvents, setSearchEvents] = useState<SearchEvent[] | null>(null);
  const [searchBookings, setSearchBookings] = useState<SearchBooking[] | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [hash, setHash] = useState("");
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const profileBoxRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const wasMobileOpenRef = useRef(false);

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  useIsomorphicLayoutEffect(() => {
    setCollapsed(window.localStorage.getItem("eventpro.sidebar.collapsed") === "1");
  }, []);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => { if (data) setSession({ email: data.email || "", isAdmin: Boolean(data.isAdmin) }); }).catch(() => {});
    Promise.all([
      fetch("/api/events", { cache: "no-store" }).then((response) => response.ok ? response.json() : { events: [] }).catch(() => ({ events: [] })),
      fetch("/api/manage/bookings", { cache: "no-store" }).then((response) => response.ok ? response.json() : { bookings: [] }).catch(() => ({ bookings: [] })),
    ]).then(([eventsData, bookingsData]) => {
      const events: (SearchEvent & { published?: boolean; archived?: boolean })[] = Array.isArray(eventsData.events) ? eventsData.events : [];
      const bookings: (SearchBooking & { paid?: boolean; status?: string })[] = Array.isArray(bookingsData.bookings) ? bookingsData.bookings : [];
      setSearchEvents(events);
      setSearchBookings(bookings);
      const draftCount = events.filter((event) => !event.published && !event.archived).length;
      const pendingCount = bookings.filter((booking) => !booking.paid && booking.status === "hold").length;
      setNotificationCount(draftCount + pendingCount);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    function onClickAway(event: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) setSearchOpen(false);
      if (profileBoxRef.current && !profileBoxRef.current.contains(event.target as Node)) setProfileOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (searchOpen) setSearchOpen(false);
      if (profileOpen) setProfileOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [searchOpen, profileOpen]);

  useEffect(() => {
    if (mobileOpen) {
      wasMobileOpenRef.current = true;
      sidebarRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    } else if (wasMobileOpenRef.current) {
      wasMobileOpenRef.current = false;
      menuToggleRef.current?.focus();
    }
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { setMobileOpen(false); return; }
      if (event.key !== "Tab" || !sidebarRef.current) return;
      const focusables = Array.from(sidebarRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  function toggleCollapsed() {
    setCollapsed((current) => { window.localStorage.setItem("eventpro.sidebar.collapsed", current ? "0" : "1"); return !current; });
  }

  function logout() {
    fetch("/api/auth/logout", { method: "POST" }).finally(() => { window.location.href = "/"; });
  }

  const matchedEvents = query.trim().length > 1 ? (searchEvents || []).filter((event) => event.title.toLowerCase().includes(query.toLowerCase()) || event.venue?.toLowerCase().includes(query.toLowerCase())).slice(0, 4) : [];
  const matchedBookings = query.trim().length > 1 ? (searchBookings || []).filter((booking) => booking.name.toLowerCase().includes(query.toLowerCase()) || booking.eventTitle?.toLowerCase().includes(query.toLowerCase())).slice(0, 4) : [];
  const identityInitials = session.email ? session.email.trim().slice(0, 2).toUpperCase() : "--";

  return (
    <main className={collapsed ? "staff-app-shell is-collapsed" : "staff-app-shell"}>
      <aside className={mobileOpen ? "staff-sidebar is-open" : "staff-sidebar"} aria-label="Staff navigation" ref={sidebarRef} role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen ? true : undefined}>
        <Link className="staff-brand" href="/manage" onClick={() => setMobileOpen(false)}>
          <span className="staff-brand-mark"><CalendarDots aria-hidden="true" size={18} /></span>
          <span className="staff-brand-copy"><strong>Hilston Park</strong><small>Admin portal</small></span>
        </Link>
        <nav className="staff-nav">
          <Link className={active === topLink.id ? "staff-nav-link active" : "staff-nav-link"} href={topLink.href} onClick={() => setMobileOpen(false)}>
            <House aria-hidden="true" size={18} weight="regular" /><span>{topLink.label}</span>
          </Link>
          {navGroups.map((group) => (
            <div className="staff-nav-group" key={group.heading}>
              <p className="staff-nav-heading">{group.heading}</p>
              {group.links.map((link) => {
                const isAmbiguousAdminLink = link.id === "admin" && link.href.includes("#");
                const isActive = isAmbiguousAdminLink ? active === "admin" && link.href.endsWith(hash || "#admin-categories") : active === link.id;
                if (link.soon) {
                  return (
                    <span className="staff-nav-link is-soon" key={link.label} aria-disabled="true" title="Coming soon">
                      <link.icon aria-hidden="true" size={18} weight="regular" /><span>{link.label}</span><small>Soon</small>
                    </span>
                  );
                }
                return (
                  <Link className={isActive ? "staff-nav-link active" : "staff-nav-link"} href={link.href} key={link.label} onClick={() => setMobileOpen(false)}>
                    <link.icon aria-hidden="true" size={18} weight="regular" /><span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <button className="staff-collapse-toggle" type="button" onClick={toggleCollapsed}><CaretLeft aria-hidden="true" size={18} className={collapsed ? "is-flipped" : ""} /><span>Collapse</span></button>
        <button className="staff-logout" type="button" onClick={logout}><SignOut aria-hidden="true" size={17} /> <span>Log out</span></button>
      </aside>
      {mobileOpen && <button className="staff-scrim" type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <section className="staff-main">
        <header className="staff-topbar">
          <button className="staff-menu-toggle" type="button" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} ref={menuToggleRef} onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X size={22} /> : <List size={22} />}</button>
          <h1 className="staff-topbar-title">{title}</h1>
          <div className="staff-search" ref={searchBoxRef}>
            <MagnifyingGlass aria-hidden="true" size={17} />
            <input role="combobox" aria-expanded={searchOpen && query.trim().length > 1} aria-controls="staff-search-listbox" aria-autocomplete="list" placeholder="Search events, bookings..." value={query} onFocus={() => setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} aria-label="Search events and bookings" />
            {searchOpen && query.trim().length > 1 && <div className="staff-search-results" id="staff-search-listbox" role="listbox">
              {matchedEvents.length === 0 && matchedBookings.length === 0 && <p className="staff-search-empty">No matches for “{query}”.</p>}
              {matchedEvents.map((event) => <Link role="option" href={`/manage/events/${event.id}`} key={event.id} onClick={() => setSearchOpen(false)}><CalendarDots aria-hidden="true" size={14} /><span>{event.title}</span></Link>)}
              {matchedBookings.map((booking) => <Link role="option" href="/manage/bookings" key={booking.bookingId} onClick={() => setSearchOpen(false)}><ClipboardText aria-hidden="true" size={14} /><span>{booking.name} · {booking.eventTitle}</span></Link>)}
            </div>}
          </div>
          <div className="staff-topbar-spacer" />
          <Link className="staff-icon-button" href="/manage#attention" aria-label={`${notificationCount} items need attention`}>
            <Bell aria-hidden="true" size={19} />
            {notificationCount > 0 && <span className="staff-badge">{notificationCount > 9 ? "9+" : notificationCount}</span>}
          </Link>
          <button className="staff-icon-button" type="button" aria-label="Help" title="Documentation is not set up yet"><Question aria-hidden="true" size={19} /></button>
          <span className="staff-separator" />
          <div className="staff-profile" ref={profileBoxRef}>
            <button className="staff-profile-trigger" type="button" aria-haspopup="menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((current) => !current)}>
              <span className="staff-avatar">{identityInitials}</span>
              <span className="staff-profile-copy"><strong>{session.email || "Staff"}</strong><small>{session.isAdmin ? "Administrator" : "Staff member"}</small></span>
              <CaretDown aria-hidden="true" size={16} />
            </button>
            {profileOpen && <div className="staff-profile-menu" role="menu"><Link href="/staff-login/change-password" role="menuitem" onClick={() => setProfileOpen(false)}><Shield aria-hidden="true" size={15} /> Change password</Link><button type="button" role="menuitem" onClick={logout}><SignOut aria-hidden="true" size={15} /> Log out</button></div>}
          </div>
        </header>
        <div className="staff-page-content">{children}</div>
      </section>
    </main>
  );
}
