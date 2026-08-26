"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const initialForm = { name: "", email: "", eventType: "", message: "", consent: false };

export default function PrivateEnquiryPage() {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/private-enquiries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || "Please check your details."); return; }
    setSubmitted(true);
    setForm(initialForm);
    setMessage(result.message);
  }

  return <main className="page-shell"><header className="subbar"><Link className="brand" href="/"><img className="brand-logo" src="/brand/hilston-park-logo.webp" alt="Hilston Park Tickets" /></Link><Link className="account-link" href="/account">Sign in <span aria-hidden="true">↗</span></Link></header><section className="content-section enquiry-layout"><p className="eyebrow">Private events</p><h1>Tell us what you are planning.</h1><p className="lead-copy">For corporate days, school visits, weddings, private parties, and group stays, the Hilston Park team will help shape the right experience.</p>{submitted ? <div className="account-panel"><h2>Thank you.</h2><p>{message} The Hilston Park team can now review your request.</p><button className="primary-button" type="button" onClick={() => { setSubmitted(false); setMessage(""); }}>Send another enquiry <span aria-hidden="true">→</span></button></div> : <form className="enquiry-form" onSubmit={submit}><label>Name<input name="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} type="text" autoComplete="name" required /></label><label>Email<input name="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" autoComplete="email" required /></label><label>What are you planning?<select name="eventType" value={form.eventType} onChange={(event) => setForm({ ...form, eventType: event.target.value })} required><option value="" disabled>Select an event type</option><option>Corporate event</option><option>School trip</option><option>Wedding or private party</option><option>Group accommodation</option></select></label><label>Preferred dates and requirements<textarea name="message" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} rows={5} required /></label><label className="check-label"><input name="consent" checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} type="checkbox" required /> I agree that Hilston Park may use these details to respond to my enquiry.</label>{message && <p className="form-error" role="alert">{message}</p>}<button className="primary-button" type="submit">Send enquiry <span aria-hidden="true">→</span></button></form>}<p className="form-note">Your details are sent to this standalone ticketing service for enquiry handling.</p></section><footer className="footer"><Link href="/events">Browse public events</Link><Link href="/">Back to ticketing</Link></footer></main>;
}
