 # Hilston Park Tickets

 Standalone event ticketing and operations application. This directory is deployed as the independent Vercel project `hilston-park-ticketing`; it is not part of the Hilston Park marketing-site deployment.

 ## Local testing

 ```bash
 npm install
 npm run dev -- --hostname 127.0.0.1 --port 3001
 ```

 Open `http://127.0.0.1:3001/manage` and use the development-only credentials from `.env.example`. Change them before any shared deployment. Without `DATABASE_URL`, data is held in process memory for local flow testing only.

 ## Persistent setup

1. Create a PostgreSQL database and run `database/schema.sql`.
2. Run `database/srs-v1-additions.sql` after the base schema succeeds. This migration is additive and creates the remaining SRS tables, indexes, locked permission keys, and deny-by-default RLS posture.
3. Create an `organizations` row and set `ORGANIZATION_ID` to its UUID.
4. Create a private Supabase Storage bucket named by `SUPABASE_STORAGE_BUCKET` for ticket PDFs.
5. Configure `DATABASE_URL` with the Supabase transaction pooler, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ORGANIZATION_ID`, and `APP_SESSION_SECRET` in the standalone Vercel project. Service-role values are server-only.
6. Configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` only as server-side Vercel environment variables.
7. Point Stripe webhooks to `/api/webhooks/stripe` and enable `payment_intent.succeeded`.
8. Do not promote public sales until the webhook transaction confirms bookings, issues tickets, and enqueues notifications idempotently.

## Event publication gate

Event publication is disabled by default at the server boundary. Keep these values split between Vercel environments:

- Live website: `EVENT_DEPLOYMENT_ROLE=live`, `EVENT_PUBLISHING_ENABLED=false`, and `LIVE_EVENT_PUBLISHING_AUTHORIZED=false`
- Ticketing staging (`https://hilston-park-ticketing.vercel.app`): `EVENT_DEPLOYMENT_ROLE=staging` and `EVENT_PUBLISHING_ENABLED=true`
- Staging browser feed: `EVENTS_PUBLIC_ORIGIN=https://hilston-park.vercel.app`

When the gate is disabled, staff can still save drafts and take events down, but attempts to create or update a published event return `403`. The public events API returns an empty catalogue. A live deployment requires both `EVENT_PUBLISHING_ENABLED=true` and `LIVE_EVENT_PUBLISHING_AUTHORIZED=true`, so staging settings cannot unlock live publishing by accident. Do not set either live authorisation flag to `true` until the team explicitly authorises live publishing.

## Main-site event feed authorisation

The public events API is not a browser feed. It remains empty unless
`EVENTS_PUBLIC_FEED_ENABLED=true` and a request supplies the matching
`Authorization: Bearer` value from `TICKETING_EVENTS_FEED_KEY`. Configure the
same randomly generated key only in the approved main-site Vercel project.

The main site must also set all of the following before it can display events:

- `EVENTS_DISPLAY_ENABLED=true`
- `TICKETING_EVENTS_API_URL` to the approved ticketing API URL
- `TICKETING_EVENTS_FEED_KEY` to the matching ticketing value

Leave `EVENTS_DISPLAY_ENABLED` and `EVENTS_PUBLIC_FEED_ENABLED` unset or false
for every unapproved preview, staging, or production deployment. This pair of
server-side checks prevents a published ticketing event from appearing on a
website unless both deployments have been deliberately authorised together.

 ## Current routes

 - `/events` public event catalogue
 - `/apply` guest application flow
 - `/account` buyer account entry point
 - `/manage` staff login, event creation, publication, and attendance metrics
 - `/private-enquiry` private event enquiry flow
 - `/api/events` catalogue read and staff event creation
 - `/api/events/[eventId]/attendees` attendee/application records
 - `/api/auth/login` staff session creation
 - `/api/checkout` server-side Stripe PaymentIntent boundary
 - `/api/webhooks/stripe` signed Stripe webhook boundary

 ## Production completion checklist

 - Replace the development auth adapter with database-backed OTP verification and permission-key RBAC.
 - Add transactional booking holds, expiry jobs, ticket types, inventory, refunds, PDF generation, signed downloads, email queues, QR check-in, reports, audit logs, and GDPR export/erase workflows.
 - Add automated tests for concurrent inventory, webhook replay, capacity, authorization, consent, and refund calculations.
 - Configure Vercel preview/production environment variables separately and verify the original `hilstonpark.com` project is never linked to this directory.
