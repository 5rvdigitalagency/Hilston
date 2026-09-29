"use client";

import { useEffect, useState } from "react";
import StaffShell from "../staff-shell";
import { formatGBP } from "@/lib/booking-status";

type Report = {
  sales: { bookings: number; current_revenue_pence: number; projected_revenue_pence: number };
  publishedEvents: number;
  activity: { action: string; metadata?: Record<string, unknown> | null; createdAt: string }[];
};

const ACTIVITY_LABELS: Record<string, string> = {
  "event.created": "created a draft event",
  "event.created_published": "created and published an event",
  "event.published": "published an event",
  "event.unpublished": "took down an event",
  "event.updated": "edited an event",
  "event.archived": "archived an event",
  "event.restored": "restored an event",
  "event.cancelled": "cancelled an event",
  "event.uncancelled": "reopened a cancelled event",
  "event.deleted": "deleted an event",
};

const STAFF_ACTIVITY: Record<string, (target: string) => string> = {
  "staff.disabled": (target) => `disabled the staff account ${target}`,
  "staff.enabled": (target) => `re-enabled the staff account ${target}`,
  "staff.password_reset": (target) => `reset the password for ${target}`,
  "staff.password_changed": () => "changed their password",
  "staff.renamed": (target) => `renamed the staff account ${target}`,
};

function describeActivity(item: { action: string; metadata?: Record<string, unknown> | null }) {
  const meta = item.metadata ?? {};
  const who = typeof meta.staffEmail === "string" && meta.staffEmail ? meta.staffEmail : "Someone";
  const title = typeof meta.title === "string" && meta.title ? ` \u201c${meta.title}\u201d` : "";
  const target = typeof meta.staff === "string" ? meta.staff : "a staff account";
  if (item.action === "staff.login_locked") {
    const ip = typeof meta.ip === "string" && meta.ip ? meta.ip : "an unknown network address";
    return meta.reason === "ip" ? `Sign-in blocked for network address ${ip} after too many wrong passwords (last tried ${target})` : `Sign-in locked for ${target} after repeated wrong passwords (from ${ip})`;
  }
  if (item.action === "booking.cancelled") {
    const customer = typeof meta.customer === "string" && meta.customer ? ` for ${meta.customer}` : "";
    const count = typeof meta.tickets === "number" ? ` (${meta.tickets} ${meta.tickets === 1 ? "ticket" : "tickets"} released)` : "";
    return `${who} cancelled a booking${customer}${title ? ` on${title}` : ""}${count}`;
  }
  if (item.action === "booking.confirmed" && meta.paymentProvider === "mock") return `${who} created a test booking (no payment)`;
  if (item.action === "booking.confirmed") return `${who} confirmed a booking`;
  const staffLabel = STAFF_ACTIVITY[item.action];
  if (staffLabel) return `${who} ${staffLabel(target)}`;
  const label = ACTIVITY_LABELS[item.action];
  if (label) return `${who} ${label}${title}`;
  return item.action.replace(/[._]/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export default function OperationsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [message, setMessage] = useState("");

  function loadReport() {
    fetch("/api/manage/operations", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setReport(data);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Reports are unavailable."));
  }

  function retryReport() {
    setMessage("");
    loadReport();
  }

  useEffect(() => {
    loadReport();
  }, []);

  return (
    <StaffShell active="reports" title="Reports">
      <section className="staff-page-heading">
        <div><p className="eyebrow">Operations intelligence</p><h2>Sales and activity</h2><p>Review booking movement and recent operational actions.</p></div>
      </section>
      <section className="staff-page-panel">
        {message && <p className="form-error" role="alert">{message} <button type="button" className="link-button" onClick={retryReport}>Retry</button></p>}
        {!report && !message && <p className="dashboard-loading" role="status">Loading reports...</p>}
        {report && <>
          <div className="report-grid">
            <div><span>Confirmed bookings</span><strong>{report.sales.bookings || 0}</strong></div>
            <div><span>Current revenue</span><strong>{formatGBP(report.sales.current_revenue_pence)}</strong></div>
            <div><span>Projected revenue</span><strong>{formatGBP(report.sales.projected_revenue_pence)}</strong></div>
            <div><span>Published events</span><strong>{report.publishedEvents || 0}</strong></div>
          </div>
          <section className="cms-card permissions-panel">
            <div className="card-heading"><div><p className="eyebrow">Audit trail</p><h2>Recent activity</h2></div></div>
            {report.activity.length ? <ul className="admin-list">{report.activity.map((item, index) => <li key={`${item.action}-${index}`}><strong>{describeActivity(item)}</strong><small>{new Date(item.createdAt).toLocaleString("en-GB")}</small></li>)}</ul> : <p className="panel-copy">No audited activity yet.</p>}
          </section>
        </>}
      </section>
    </StaffShell>
  );
}
