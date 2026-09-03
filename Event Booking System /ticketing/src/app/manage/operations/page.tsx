"use client";

import { useEffect, useState } from "react";
import StaffShell from "../staff-shell";

type Report = {
  sales: { bookings: number; current_revenue_pence: number; projected_revenue_pence: number };
  publishedEvents: number;
  activity: { action: string; createdAt: string }[];
};

const money = (pence: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format((pence || 0) / 100);

export default function OperationsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/manage/operations", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setReport(data);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Reports are unavailable."));
  }, []);

  return (
    <StaffShell active="reports" title="Reports">
      <section className="staff-page-heading">
        <div><p className="eyebrow">Operations intelligence</p><h2>Sales and activity</h2><p>Review booking movement and recent operational actions.</p></div>
      </section>
      <section className="staff-page-panel">
        {message && <p className="form-error" role="alert">{message}</p>}
        {report && <>
          <div className="report-grid">
            <div><span>Confirmed bookings</span><strong>{report.sales.bookings || 0}</strong></div>
            <div><span>Current revenue</span><strong>{money(report.sales.current_revenue_pence)}</strong></div>
            <div><span>Projected revenue</span><strong>{money(report.sales.projected_revenue_pence)}</strong></div>
            <div><span>Published events</span><strong>{report.publishedEvents || 0}</strong></div>
          </div>
          <section className="cms-card permissions-panel">
            <div className="card-heading"><div><p className="eyebrow">Audit trail</p><h2>Recent activity</h2></div></div>
            {report.activity.length ? <ul className="admin-list">{report.activity.map((item, index) => <li key={`${item.action}-${index}`}><strong>{item.action}</strong><small>{new Date(item.createdAt).toLocaleString("en-GB")}</small></li>)}</ul> : <p className="panel-copy">No audited activity yet.</p>}
          </section>
        </>}
      </section>
    </StaffShell>
  );
}
