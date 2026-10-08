"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import StaffShell from "../staff-shell";
import QrCamera from "./qr-camera";

type LookupResult = {
  ticketCode: string;
  bookingReference: string | null;
  eventTitle: string;
  sessionStartsAt: string | null;
  sessionEndsAt: string | null;
  buyerName: string;
  guestBreakdown: { name: string; quantity: number }[];
  totalGuests: number;
  checkedInCount: number;
  remainingGuests: number;
  paid: boolean;
  testPayment: boolean;
  partialCheckInAllowed: boolean;
  fullyCheckedIn: boolean;
};

type ErrorResult = { tone: "duplicate" | "missing" | "cancelled" | "mismatch" | "error"; title: string; detail: string; ticketCode: string };

type ConfirmResult = { tone: "success"; title: string; detail: string; ticketCode: string };

type CheckInOption = { id: string; title: string; sessions: { id: string; startsAt: string; endsAt: string | null }[] };

function formatScanTime(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" });
}
export default function CheckInPage() {
  const [ticketCode, setTicketCode] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [errorResult, setErrorResult] = useState<ErrorResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [guestsToAdmit, setGuestsToAdmit] = useState(1);
  const [checkingIn, setCheckingIn] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ticketInputRef = useRef<HTMLInputElement>(null);
  const [options, setOptions] = useState<CheckInOption[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");

  useEffect(() => {
    fetch("/api/manage/check-in/options", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { options: [] })
      .then((data) => setOptions(Array.isArray(data.options) ? data.options : []))
      .catch(() => setOptions([]));
  }, []);

  function sessionLabel(startsAt: string | null, endsAt: string | null) {
    if (!startsAt) return null;
    const start = new Date(startsAt);
    const end = endsAt ? new Date(endsAt) : null;
    if (Number.isNaN(start.getTime())) return "Session date to confirm";
    const date = start.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    const time = start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const endTime = end && !Number.isNaN(end.getTime()) ? `-${end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "";
    return `${date}, ${time}${endTime}`;
  }

  function resetPanels() {
    setLookup(null);
    setErrorResult(null);
    setConfirmResult(null);
  }

  function buildErrorResult(data: Record<string, unknown>, code: string): ErrorResult {
    const detail = (data.error as string) || "The ticket could not be checked in.";
    if (data.mismatch) {
      return { tone: "mismatch", title: "Wrong event session", detail: `This ticket is for ${data.eventTitle || "a different event"}${data.sessionStartsAt ? ` at ${sessionLabel(data.sessionStartsAt as string, null)}` : ""}.`, ticketCode: code };
    }
    if (/cancelled/i.test(detail)) {
      return { tone: "cancelled", title: "Booking cancelled - do not admit", detail, ticketCode: code };
    }
    if (data.fullyCheckedIn) {
      const scannedAt = formatScanTime(data.firstScannedAt as string | undefined);
      return {
        tone: "duplicate",
        title: "Fully checked in - do not admit again",
        detail: `${data.buyerName ? `${data.buyerName}'s booking` : "This booking"} has already had all its guests checked in${scannedAt ? ` (last scan ${scannedAt})` : ""}.${data.eventTitle ? ` Event: ${data.eventTitle}.` : ""}`,
        ticketCode: code,
      };
    }
    if (/not found/i.test(detail)) return { tone: "missing", title: "Ticket not found", detail, ticketCode: code };
    if (/remaining|guest\(s\)/i.test(detail)) return { tone: "error", title: "Too many guests", detail, ticketCode: code };
    return { tone: "error", title: "Check-in needs attention", detail, ticketCode: code };
  }

  async function verifyTicket(code: string) {
    const normalizedCode = code.trim();
    if (!normalizedCode || checkingIn) return;
    setTicketCode(normalizedCode);
    resetPanels();
    setCheckingIn(true);
    try {
      const response = await fetch("/api/check-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketCode: normalizedCode, sessionId: selectedSessionId || undefined, confirm: false }) });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.mode === "lookup") {
        setLookup(data as LookupResult);
        setGuestsToAdmit(Math.max(1, (data as LookupResult).remainingGuests || 1));
        return;
      }
      setErrorResult(buildErrorResult(data, normalizedCode));
    } catch {
      setErrorResult({ tone: "error", title: "Check-in needs attention", detail: "Network problem while checking in. Please try again.", ticketCode: normalizedCode });
    } finally {
      setCheckingIn(false);
    }
  }

  async function confirmCheckIn() {
    if (!lookup || confirming) return;
    setConfirming(true);
    try {
      const response = await fetch("/api/check-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketCode: lookup.ticketCode, sessionId: selectedSessionId || undefined, guests: guestsToAdmit, confirm: true }) });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.ok) {
        setLookup(null);
        setConfirmResult({
          tone: "success",
          title: "Ticket accepted",
          detail: `${data.buyerName ? `${data.buyerName} - ` : ""}${data.guestsCheckedIn} guest${data.guestsCheckedIn === 1 ? "" : "s"} checked in (${data.checkedInCount} of ${data.totalGuests} total).${data.eventTitle ? ` Event: ${data.eventTitle}.` : ""}`,
          ticketCode: data.ticketCode,
        });
        return;
      }
      setErrorResult(buildErrorResult(data, lookup.ticketCode));
      setLookup(null);
    } catch {
      setErrorResult({ tone: "error", title: "Check-in needs attention", detail: "Network problem while checking in. Please try again.", ticketCode: lookup.ticketCode });
      setLookup(null);
    } finally {
      setConfirming(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!ticketCode.trim()) {
      setErrorResult({ tone: "error", title: "Enter a ticket code", detail: "Scan a ticket or enter its code before verifying.", ticketCode: "" });
      ticketInputRef.current?.focus();
      return;
    }
    verifyTicket(ticketCode);
  }

  function scanNext() {
    resetPanels();
    setTicketCode("");
    requestAnimationFrame(() => ticketInputRef.current?.focus());
  }

  return (
    <StaffShell active="check-in" title="Check-in">
      <section className="staff-page-heading checkin-heading">
        <div><p className="eyebrow">Doors and arrivals</p><h2>Check someone in</h2><p>Scan one ticket at a time using the device camera, or enter its code manually. Each booking has a single ticket that can cover several guests.</p></div>
      </section>
      <section className="staff-page-panel checkin-layout">
        <div className="checkin-panel">
          <div className="scanner-placeholder"><strong>Camera scanner</strong><small>Allow camera access when your browser asks.</small><QrCamera onCode={verifyTicket} /></div>
          <form className="enquiry-form" onSubmit={submit}>
            <label>Checking in for<select value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)}><option value="">All events and sessions</option>{options.map((event) => <optgroup key={event.id} label={event.title}>{event.sessions.map((session) => <option key={session.id} value={session.id}>{sessionLabel(session.startsAt, session.endsAt)}</option>)}</optgroup>)}</select></label>
            <label>Ticket code<input ref={ticketInputRef} value={ticketCode} onChange={(event) => setTicketCode(event.target.value.toUpperCase())} placeholder="HP-XXXXXX" autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="go" required /></label>
            <button className="primary-button" type="submit" disabled={checkingIn}>{checkingIn ? "Looking up..." : "Verify ticket"} <span aria-hidden="true">&rarr;</span></button>
          </form>
        </div>
        <p className="form-note">One ticket admits the whole booking. Guests can arrive together or in separate groups when partial check-in is enabled.</p>
      </section>

      {lookup && (
        <div className="checkin-overlay" role="dialog" aria-modal="true" aria-labelledby="checkin-lookup-title">
          <section className="checkin-dialog checkin-dialog-lookup">
            <span className="checkin-dialog-icon" aria-hidden="true">&#10003;</span>
            <p className="eyebrow">Valid ticket</p>
            <h2 id="checkin-lookup-title">{lookup.buyerName || "Guest"}</h2>
            <dl className="booking-facts">
              <div><dt>Event</dt><dd>{lookup.eventTitle}</dd></div>
              {lookup.sessionStartsAt && <div><dt>Session</dt><dd>{sessionLabel(lookup.sessionStartsAt, lookup.sessionEndsAt)}</dd></div>}
              <div><dt>Guests</dt><dd>{lookup.guestBreakdown.map((item) => `${item.name} \u00d7 ${item.quantity}`).join(", ") || `${lookup.totalGuests} guest(s)`}</dd></div>
              <div><dt>Ticket code</dt><dd><code>{lookup.ticketCode}</code></dd></div>
              {lookup.bookingReference && <div><dt>Booking reference</dt><dd><code>{lookup.bookingReference}</code></dd></div>}
              <div><dt>Payment</dt><dd>{lookup.paid ? "Paid" : lookup.testPayment ? "Test (no payment)" : "Awaiting payment"}</dd></div>
              <div><dt>Checked in so far</dt><dd>{lookup.checkedInCount} of {lookup.totalGuests}</dd></div>
            </dl>
            {lookup.partialCheckInAllowed ? (
              <div className="checkin-guest-stepper">
                <span>Check in</span>
                <button type="button" aria-label="Fewer guests" onClick={() => setGuestsToAdmit((value) => Math.max(1, value - 1))}>&minus;</button>
                <strong>{guestsToAdmit}</strong>
                <button type="button" aria-label="More guests" onClick={() => setGuestsToAdmit((value) => Math.min(lookup.remainingGuests, value + 1))}>+</button>
                <span>of {lookup.remainingGuests} remaining guest(s)</span>
              </div>
            ) : <p className="panel-copy">Partial check-in is switched off, so this admits all {lookup.remainingGuests} remaining guest(s) at once.</p>}
            <button className="primary-button" type="button" disabled={confirming} onClick={confirmCheckIn}>{confirming ? "Checking in..." : `Check in ${lookup.partialCheckInAllowed ? guestsToAdmit : lookup.remainingGuests} guest${(lookup.partialCheckInAllowed ? guestsToAdmit : lookup.remainingGuests) === 1 ? "" : "s"}`} <span aria-hidden="true">&rarr;</span></button>
            <button className="secondary-button" type="button" disabled={confirming} onClick={scanNext}>Cancel</button>
          </section>
        </div>
      )}

      {confirmResult && (
        <div className="checkin-overlay" role="dialog" aria-modal="true" aria-labelledby="checkin-result-title">
          <section className="checkin-dialog checkin-dialog-success">
            <span className="checkin-dialog-icon" aria-hidden="true">&#10003;</span>
            <p className="eyebrow">Ticket scan result</p>
            <h2 id="checkin-result-title">{confirmResult.title}</h2>
            <p>{confirmResult.detail}</p>
            <code>{confirmResult.ticketCode}</code>
            <button className="primary-button" type="button" onClick={scanNext}>Scan next ticket <span aria-hidden="true">&rarr;</span></button>
          </section>
        </div>
      )}

      {errorResult && (
        <div className="checkin-overlay" role="dialog" aria-modal="true" aria-labelledby="checkin-error-title">
          <section className={`checkin-dialog checkin-dialog-${errorResult.tone === "mismatch" || errorResult.tone === "cancelled" ? "error" : errorResult.tone}`}>
            <span className="checkin-dialog-icon" aria-hidden="true">!</span>
            <p className="eyebrow">Ticket scan result</p>
            <h2 id="checkin-error-title">{errorResult.title}</h2>
            <p>{errorResult.detail}</p>
            {errorResult.ticketCode && <code>{errorResult.ticketCode}</code>}
            <button className="primary-button" type="button" onClick={scanNext}>Scan next ticket <span aria-hidden="true">&rarr;</span></button>
          </section>
        </div>
      )}
    </StaffShell>
  );
}
