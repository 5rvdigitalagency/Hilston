"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDots, CaretLeft, CheckCircle, CreditCard, DeviceMobile, MapPin, Minus, Plus, ShieldCheck, Ticket, X } from "@phosphor-icons/react";
import type { EventRecord } from "@/lib/store";
import { formatGBP } from "@/lib/booking-status";

type CatalogueTicketType = { id: string; name: string; pricePence: number; maxPerOrder: number };
type CatalogueSession = { id: string; startsAt: string; endsAt: string | null; venue: string; capacity: number; remaining: number; ticketTypes: CatalogueTicketType[] };
type CatalogueEvent = EventRecord & { status: "published" | "sold_out"; sessions: CatalogueSession[]; imageUrl?: string };

type Step = "session" | "tickets" | "details" | "review";
const STEPS: { key: Step; label: string }[] = [
  { key: "session", label: "Date" },
  { key: "tickets", label: "Tickets" },
  { key: "details", label: "Details" },
  { key: "review", label: "Review" },
];

const formatSessionDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const formatSessionTime = (startsAt: string, endsAt: string | null) => {
  const start = new Date(startsAt).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
  if (!endsAt) return start;
  return `${start} \u2013 ${new Date(endsAt).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}`;
};

export default function EventCatalogue({ events }: { events: CatalogueEvent[] }) {
  const [selectedEvent, setSelectedEvent] = useState<CatalogueEvent | null>(null);
  const [step, setStep] = useState<Step>("session");
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "apple_pay">("card");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [venueFilter, setVenueFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<"all" | "week" | "month">("all");
  const [currentTime] = useState(() => Date.now());
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const submittingRef = useRef(false);

  const categories = useMemo(() => Array.from(new Set(events.map((event) => event.category))).sort(), [events]);
  const venues = useMemo(() => Array.from(new Set(events.map((event) => event.venue).filter(Boolean))).sort(), [events]);

  const filteredEvents = useMemo(() => {
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const monthMs = 31 * 24 * 60 * 60 * 1000;
    return events.filter((event) => {
      const matchesSearch = !searchTerm || event.title.toLowerCase().includes(searchTerm.toLowerCase()) || event.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === "all" || event.category === categoryFilter;
      const matchesVenue = venueFilter === "all" || event.venue === venueFilter;
      const startsAtMs = new Date(event.startsAt).getTime();
      const matchesDate = dateFilter === "all" || (dateFilter === "week" ? startsAtMs - currentTime <= weekMs : startsAtMs - currentTime <= monthMs);
      return matchesSearch && matchesCategory && matchesVenue && matchesDate;
    });
  }, [events, searchTerm, categoryFilter, venueFilter, dateFilter, currentTime]);

  const selectedSession = useMemo(() => selectedEvent?.sessions.find((session) => session.id === selectedSessionId) || null, [selectedEvent, selectedSessionId]);
  const totalQuantity = useMemo(() => Object.values(quantities).reduce((sum, qty) => sum + qty, 0), [quantities]);
  const subtotalPence = useMemo(() => {
    if (!selectedSession) return 0;
    return selectedSession.ticketTypes.reduce((sum, ticketType) => sum + (quantities[ticketType.id] || 0) * ticketType.pricePence, 0);
  }, [selectedSession, quantities]);

  function openEvent(event: CatalogueEvent, trigger: HTMLElement) {
    returnFocusRef.current = trigger;
    setError("");
    setSelectedEvent(event);
    setStep("session");
    setSelectedSessionId(event.sessions.find((session) => session.remaining > 0)?.id || null);
    setQuantities({});
    setName("");
    setEmail("");
    setPhone("");
    setSpecialRequests("");
    setAgreedToTerms(false);
    setPaymentMethod("card");
  }

  function closeModal() {
    if (submittingRef.current) return;
    setSelectedEvent(null);
  }

  useEffect(() => {
    if (!selectedEvent) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("input, button")?.focus();
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeModal();
      if (event.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled)");
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
     
  }, [selectedEvent]);

  function goToStep(next: Step) {
    setError("");
    setStep(next);
  }

  function handleBack() {
    if (step === "session") return closeModal();
    if (step === "tickets") return goToStep("session");
    if (step === "details") return goToStep("tickets");
    if (step === "review") return goToStep("details");
  }

  function handleContinue() {
    if (step === "session") {
      if (!selectedSession) { setError("Please choose an available date and time."); return; }
      if (selectedSession.remaining <= 0) { setError("This session is sold out. Please choose another."); return; }
      return goToStep("tickets");
    }
    if (step === "tickets") {
      if (totalQuantity === 0) { setError("Please select at least one ticket."); return; }
      if (selectedSession && totalQuantity > selectedSession.remaining) { setError("Not enough places remaining for this quantity."); return; }
      return goToStep("details");
    }
    if (step === "details") {
      if (name.trim().length < 2 || !email.trim() || phone.trim().length < 5) { setError("Please complete all required details."); return; }
      if (!agreedToTerms) { setError("Please accept the booking terms to continue."); return; }
      return goToStep("review");
    }
  }

  function adjustQuantity(ticketTypeId: string, delta: number, maxPerOrder: number) {
    setQuantities((current) => {
      if (delta > 0 && selectedSession && totalQuantity + 1 > selectedSession.remaining) {
        setError("Session capacity reached.");
        return current;
      }
      const next = Math.max(0, Math.min(maxPerOrder, (current[ticketTypeId] || 0) + delta));
      return { ...current, [ticketTypeId]: next };
    });
  }

  async function confirmBooking() {
    if (!selectedEvent || !selectedSession) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/storefront/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEvent.id,
          sessionId: selectedSession.id,
          items: Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity })),
          name,
          email,
          phone,
          specialRequests,
          paymentMode: "test",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Booking could not be confirmed.");
      window.location.assign(data.confirmationUrl);
    } catch (bookingError) {
      setError(bookingError instanceof Error ? bookingError.message : "Booking could not be confirmed.");
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return <>
    <div className="catalogue-filters" role="search" aria-label="Filter events">
      <label className="catalogue-search">
        <span className="sr-only">Search events</span>
        <input type="search" placeholder="Search events" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
      </label>
      <label className="filter-field">
        <span>Category</span>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="all">All categories</option>
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
      </label>
      <label className="filter-field">
        <span>Venue</span>
        <select value={venueFilter} onChange={(event) => setVenueFilter(event.target.value)}>
          <option value="all">All venues</option>
          {venues.map((venue) => <option key={venue} value={venue}>{venue}</option>)}
        </select>
      </label>
      <label className="filter-field">
        <span>When</span>
        <select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as "all" | "week" | "month")}>
          <option value="all">Any date</option>
          <option value="week">Next 7 days</option>
          <option value="month">Next 31 days</option>
        </select>
      </label>
    </div>
    <div className="catalogue-cards">
      {filteredEvents.map((event) => {
        const hasOpenSessions = event.sessions.some((session) => session.remaining > 0);
        const canBook = event.status === "published" && event.sessions.length > 0 && hasOpenSessions;
        const lowestRemaining = event.sessions.reduce((min, session) => Math.min(min, session.remaining), Infinity);
        const isLowAvailability = hasOpenSessions && Number.isFinite(lowestRemaining) && lowestRemaining <= 5;
        const earliestSession = event.sessions.length > 0
          ? [...event.sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]
          : null;
        return <article key={event.id} className="catalogue-card event-catalogue-card">
          {event.imageUrl && <img className="event-cover" src={event.imageUrl} alt="" />}
          <p className="eyebrow">{event.category}</p>
          <h3>{event.title}</h3>
          <p className="event-card-description event-card-description-clamped">{event.description}</p>
          <div className="catalogue-meta">
            {earliestSession
              ? <span><CalendarDots aria-hidden="true" size={14} weight="regular" /> {new Date(earliestSession.startsAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
              : <span><CalendarDots aria-hidden="true" size={14} weight="regular" /> Dates to be confirmed</span>}
            <span><MapPin aria-hidden="true" size={14} weight="regular" /> {event.venue || "Hilston Park"}</span>
          </div>
          <p className={!hasOpenSessions ? "availability-badge availability-sold-out" : isLowAvailability ? "availability-badge availability-low" : "availability-badge"}>
            {!hasOpenSessions ? "Fully booked" : event.sessions.length === 0 ? "Dates to be confirmed" : `${lowestRemaining} places remaining`}
          </p>
          {canBook
            ? <button className="primary-button event-book-button" type="button" onClick={(clickEvent) => openEvent(event, clickEvent.currentTarget)}>Book event</button>
            : <span className="event-preview-note">{event.sessions.length === 0 ? "Dates for this event are being finalised." : "Booking is not currently available."}</span>}
        </article>;
      })}
      {filteredEvents.length === 0 && <p className="catalogue-empty">No events match your search. Try clearing a filter.</p>}
    </div>
    {selectedEvent && <div className="booking-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
      <section ref={dialogRef} className="booking-dialog" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <button className="dialog-close" type="button" aria-label="Close booking" disabled={submitting} onClick={closeModal}><X aria-hidden="true" size={22} /></button>
        <p className="eyebrow">Test booking</p>
        <h2 id="booking-title">{selectedEvent.title}</h2>
        <nav className="step-track" aria-label="Booking steps">
          {STEPS.map((item) => <span key={item.key} className={item.key === step ? "step-active" : undefined}>{item.label}</span>)}
        </nav>

        {step === "session" && <div className="booking-step">
          <p className="booking-event-facts"><MapPin aria-hidden="true" size={14} weight="regular" /> {selectedEvent.venue || "Hilston Park"}</p>
          {selectedEvent.sessions.length === 0 && <p className="event-preview-note">Dates for this event are being finalised. Please check back soon.</p>}
          <div className="session-options">
            {selectedEvent.sessions.map((session) => <label key={session.id} className={session.remaining <= 0 ? "option option-disabled" : "option"}>
              <input type="radio" name="session" checked={selectedSessionId === session.id} disabled={session.remaining <= 0} onChange={() => setSelectedSessionId(session.id)} />
              <span><b>{formatSessionDate(session.startsAt)}</b><small>{formatSessionTime(session.startsAt, session.endsAt)}{session.venue ? ` \u00b7 ${session.venue}` : ""}</small></span>
              <em className={session.remaining <= 0 ? "sold" : undefined}>{session.remaining <= 0 ? "Sold out" : `${session.remaining} places remaining`}</em>
            </label>)}
          </div>
        </div>}

        {step === "tickets" && selectedSession && <div className="booking-step">
          <h3>Select tickets</h3>
          {selectedSession.ticketTypes.length === 0 && <p className="event-preview-note">Ticket types for this date have not been set up yet.</p>}
          <div className="ticket-grid header"><span>Ticket type</span><span>Price</span><span>Quantity</span></div>
          {selectedSession.ticketTypes.map((ticketType) => <div key={ticketType.id} className="ticket-grid ticket-row">
            <span>{ticketType.name}</span>
            <span>{ticketType.pricePence ? formatGBP(ticketType.pricePence) : "Free"}</span>
            <div className="counter">
              <button type="button" aria-label={`Remove ${ticketType.name}`} onClick={() => adjustQuantity(ticketType.id, -1, ticketType.maxPerOrder)}><Minus aria-hidden="true" size={14} weight="bold" /></button>
              <span>{quantities[ticketType.id] || 0}</span>
              <button type="button" aria-label={`Add ${ticketType.name}`} onClick={() => adjustQuantity(ticketType.id, 1, ticketType.maxPerOrder)}><Plus aria-hidden="true" size={14} weight="bold" /></button>
            </div>
          </div>)}
          <div className="booking-total"><span>Total ({totalQuantity} tickets)</span><span>{formatGBP(subtotalPence)}</span></div>
        </div>}

        {step === "details" && <form className="booking-form booking-step" id="details-form" onSubmit={(event: FormEvent) => { event.preventDefault(); handleContinue(); }}>
          <fieldset className="booking-fieldset">
            <legend>Your details</legend>
            <label>Full name <span aria-hidden="true">*</span><input autoFocus autoComplete="name" minLength={2} maxLength={120} required value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label>Email address <span aria-hidden="true">*</span><input autoComplete="email" type="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Phone number <span aria-hidden="true">*</span><input autoComplete="tel" type="tel" maxLength={30} required value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            <label>Special requests (optional)<textarea maxLength={500} rows={3} placeholder="E.g. dietary requirements, accessibility needs" value={specialRequests} onChange={(event) => setSpecialRequests(event.target.value)} /></label>
          </fieldset>
          <label className="consent-check">
            <input type="checkbox" checked={agreedToTerms} onChange={(event) => setAgreedToTerms(event.target.checked)} required />
            <span>I accept the <a href="https://hilstonpark.com/terms" target="_blank" rel="noreferrer">booking terms</a> and <a href="https://hilstonpark.com/privacy" target="_blank" rel="noreferrer">privacy policy</a>. <span aria-hidden="true">*</span></span>
          </label>
        </form>}

        {step === "review" && selectedSession && <div className="booking-step">
          <h3>Tickets</h3>
          {selectedSession.ticketTypes.filter((ticketType) => (quantities[ticketType.id] || 0) > 0).map((ticketType) => <div key={ticketType.id} className="review-line">
            <span>{ticketType.name} &times; {quantities[ticketType.id]}</span>
            <span>{formatGBP(ticketType.pricePence)}</span>
            <span>{formatGBP(ticketType.pricePence * quantities[ticketType.id])}</span>
          </div>)}
          <div className="review-line total-line"><span>Total payable</span><span /><span>{formatGBP(subtotalPence)}</span></div>
          <h3>Payment method</h3>
          <label className="pay-option"><input type="radio" name="pay" checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")} /><CreditCard aria-hidden="true" size={18} weight="regular" /> Pay by card</label>
          <label className="pay-option"><input type="radio" name="pay" checked={paymentMethod === "apple_pay"} onChange={() => setPaymentMethod("apple_pay")} /><DeviceMobile aria-hidden="true" size={18} weight="regular" /> Pay with Apple Pay</label>
          <p className="booking-confirmation"><ShieldCheck aria-hidden="true" size={14} weight="regular" /> No real payment will be taken in this preview.</p>
        </div>}

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-footer">
          <button className="text-btn" type="button" onClick={handleBack} disabled={submitting}><CaretLeft aria-hidden="true" size={14} weight="bold" /> Back</button>
          {step === "review"
            ? <button className="primary-button" type="button" onClick={confirmBooking} disabled={submitting}>{submitting ? "Confirming..." : <><Ticket aria-hidden="true" size={16} weight="regular" /> Confirm test booking</>}</button>
            : step === "details"
              ? <button className="primary-button" type="submit" form="details-form"><CheckCircle aria-hidden="true" size={16} weight="regular" /> Continue</button>
              : <button className="primary-button" type="button" onClick={handleContinue}>Continue</button>}
        </div>
      </section>
    </div>}
  </>;
}