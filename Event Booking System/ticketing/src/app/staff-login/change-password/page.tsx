"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (form.newPassword.length < 12) { setError("Your new password must be at least 12 characters."); return; }
    if (form.newPassword !== form.confirmPassword) { setError("The new passwords do not match."); return; }
    setBusy(true);
    const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }) });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (response.ok === false) {
      if (response.status === 401 && result.error === "Please sign in again.") { router.replace("/staff-login"); return; }
      setError(result.error || "Your password could not be changed.");
      return;
    }
    router.replace("/manage");
  }

  return <main className="auth-gate"><div className="auth-gate-panel"><img className="auth-logo" src="/brand/hilston-park-logo.webp" alt="Hilston Park Tickets" /><p className="eyebrow">Hilston Park operations</p><h1>Choose a new password.</h1><p>Enter your current password, then choose a new one. If an administrator reset your password, use the temporary password they gave you.</p><form className="enquiry-form auth-form" onSubmit={submit}><label>Current password<input name="currentPassword" type="password" autoComplete="current-password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} required /></label><label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={12} value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} required /></label><label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving..." : "Save new password"}</button></form><small className="auth-footnote">At least 12 characters. Changing your password signs you out on other devices. <a href="/manage">Back to dashboard</a></small></div></main>;
}
