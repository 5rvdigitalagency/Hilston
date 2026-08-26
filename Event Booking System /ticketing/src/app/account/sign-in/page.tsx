"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  function submit(event: FormEvent) { event.preventDefault(); setSubmitted(true); }
  return <main className="page-shell"><header className="subbar"><Link className="brand" href="/"><img className="brand-logo" src="/brand/hilston-park-logo.webp" alt="Hilston Park Tickets" /></Link><Link className="account-link" href="/events">Browse events <span aria-hidden="true">↗</span></Link></header><section className="content-section auth-layout"><p className="eyebrow">Customer account</p><h1>Come back to your bookings.</h1><p className="lead-copy">Enter your email address and we will send a one-time verification code. Your account will only become active after the code is confirmed.</p>{submitted ? <div className="account-panel"><h2>Check your inbox</h2><p>In the live system, a verification code will be sent to <strong>{email}</strong>. The email OTP service is awaiting Supabase configuration.</p><button className="primary-button" type="button" onClick={() => setSubmitted(false)}>Use a different email <span aria-hidden="true">↗</span></button></div> : <form className="enquiry-form auth-form" onSubmit={submit}><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><button className="primary-button" type="submit">Send verification code <span aria-hidden="true">→</span></button></form>}<p className="form-note">No account is activated until email verification succeeds.</p></section><footer className="footer"><Link href="/events">Browse events</Link><Link href="/">Back to ticketing</Link></footer></main>;
}
