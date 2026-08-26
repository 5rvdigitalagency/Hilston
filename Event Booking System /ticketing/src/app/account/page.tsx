import Link from "next/link";

export default function AccountPage() {
  return <main className="page-shell"><header className="subbar"><Link className="brand" href="/"><span className="brand-mark">HP</span><span>Hilston Park <em>Tickets</em></span></Link><span className="status-pill">Account</span></header><section className="content-section account-layout"><p className="eyebrow">Your account</p><h1>Bookings, in one place.</h1><div className="account-panel"><h2>Sign in or create an account</h2><p>Email verification is required before account access is activated. Your bookings and private ticket downloads will appear here after sign-in.</p><Link className="primary-button" href="/account/sign-in">Continue with email <span aria-hidden="true">→</span></Link></div></section><footer className="footer"><Link href="/events">Browse events</Link><Link href="/">Back to ticketing</Link></footer></main>;
}
