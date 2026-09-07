"use client";

import { FormEvent, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

function StaffLoginForm() {
  const next = useSearchParams().get("next") || "/manage/cms";
  const router = useRouter();
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credentials) }); setBusy(false); if (!response.ok) { setError("The username or password was not recognised."); return; } router.replace(next); }
  return <main className="auth-gate"><div className="auth-gate-panel"><img className="auth-logo" src="/brand/hilston-park-logo.webp" alt="Hilston Park Tickets" /><p className="eyebrow">Hilston Park operations</p><h1>Staff access only.</h1><p>Sign in to manage events, guest submissions, payments, tickets, and check-in.</p><form className="enquiry-form auth-form" onSubmit={submit}><label>Username or email<input type="email" autoComplete="username" value={credentials.email} onChange={(event) => setCredentials({ ...credentials, email: event.target.value })} required /></label><label>Password<input type="password" autoComplete="current-password" value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={busy}>{busy ? "Signing in..." : "Enter staff workspace →"}</button></form><small className="auth-footnote">Authorised Hilston Park team members only.</small></div></main>;
}

export default function StaffLoginPage() { return <Suspense fallback={<main className="auth-gate"><div className="auth-gate-panel"><h1>Loading staff access...</h1></div></main>}><StaffLoginForm /></Suspense>; }
