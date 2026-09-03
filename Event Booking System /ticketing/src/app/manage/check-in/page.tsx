"use client";

import { FormEvent, useState } from "react";
import StaffShell from "../staff-shell";
import QrCamera from "./qr-camera";

type CheckInResult = { tone: "success" | "duplicate" | "missing" | "error"; title: string; detail: string; ticketCode: string; warning?: string };

function formatScanTime(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" });
}

export default function CheckInPage() {
  const [ticketCode, setTicketCode] = useState("");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);

  async function verifyTicket(code: string) {
    const normalizedCode = code.trim();
    if (!normalizedCode || checkingIn) return;
    setTicketCode(normalizedCode);
    setResult(null);
    setCheckingIn(true);
    try {
      const response = await fetch("/api/check-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketCode: normalizedCode }) });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setResult({ tone: "success", title: "Ticket accepted", detail: data.guestName ? `${data.guestName} is checked in.` : data.ticket?.attendeeName ? `${data.ticket.attendeeName} is checked in.` : "This ticket holder is checked in.", ticketCode: normalizedCode });
        return;
      }
      const detail = data.error || "The ticket could not be checked in.";
      const tone = /already checked in/i.test(detail) ? "duplicate" : /not found/i.test(detail) ? "missing" : "error";
      const scannedAt = formatScanTime(data.firstScannedAt);
      setResult({
        tone,
        title: tone === "duplicate" ? "Already used - do not admit" : tone === "missing" ? "Ticket not found" : "Check-in needs attention",
        detail: tone === "duplicate" ? `${data.guestName ? `${data.guestName}'s ticket` : "This ticket"} was already scanned${scannedAt ? ` at ${scannedAt}` : ""}. This may be a copied or forwarded ticket.` : detail,
        ticketCode: normalizedCode,
        warning: tone === "duplicate" && data.scannedBy ? `First scanned by ${data.scannedBy}` : undefined,
      });
    } catch {
      setResult({ tone: "error", title: "Check-in needs attention", detail: "Network problem while checking in. Please try again.", ticketCode: normalizedCode });
    } finally {
      setCheckingIn(false);
    }
  }

  function submit(event: FormEvent) { event.preventDefault(); verifyTicket(ticketCode); }

  return (
    <StaffShell active="check-in" title="Check-in">
      <section className="staff-page-heading checkin-heading">
        <div><p className="eyebrow">Doors and arrivals</p><h2>Check someone in</h2><p>Scan one ticket at a time using the device camera, or enter its code manually.</p></div>
      </section>
      <section className="staff-page-panel checkin-layout">
        <div className="checkin-panel">
          <div className="scanner-placeholder"><strong>Camera scanner</strong><small>Allow camera access when your browser asks.</small><QrCamera onCode={verifyTicket} /></div>
          <form className="enquiry-form" onSubmit={submit}>
            <label>Ticket code<input value={ticketCode} onChange={(event) => setTicketCode(event.target.value.toUpperCase())} placeholder="HP-XXXXXXXXXXXX" autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} enterKeyHint="go" required /></label>
            <button className="primary-button" type="submit" disabled={checkingIn}>{checkingIn ? "Checking in..." : "Verify ticket"} <span aria-hidden="true">&rarr;</span></button>
          </form>
        </div>
        <p className="form-note">Each ticket can be accepted once. A second scan of the same code is rejected.</p>
      </section>
      {result && <div className="checkin-overlay" role="dialog" aria-modal="true" aria-labelledby="checkin-result-title"><section className={`checkin-dialog checkin-dialog-${result.tone}`}><span className="checkin-dialog-icon" aria-hidden="true">{result.tone === "success" ? "✓" : "!"}</span><p className="eyebrow">Ticket scan result</p><h2 id="checkin-result-title">{result.title}</h2><p>{result.detail}</p>{result.warning && <p className="checkin-dialog-warning">{result.warning}</p>}<code>{result.ticketCode}</code><button className="primary-button" type="button" onClick={() => { setResult(null); setTicketCode(""); }}>Scan next ticket <span aria-hidden="true">&rarr;</span></button></section></div>}
    </StaffShell>
  );
}
