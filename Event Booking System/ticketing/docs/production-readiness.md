# Hilston Park Ticketing Production Readiness

This document is the repository execution brief for the attached production-readiness specification. Work one phase at a time, verify every change, keep production data safe, use UK English and formats, and never commit secrets.

## Phase 1 closeout

Before Phase 2:

1. Production cleanup must be dry-run by default and require `--apply` plus `CONFIRM=prod`. Never run it without Nav reviewing the list.
2. Booking status must be centralized in `src/lib/booking-status.ts`, including paid, pending payment, cancelled, refunded, partially refunded, expired, and test states. Revenue counts paid bookings only. Currency uses `formatGBP`.
3. Runtime DDL must not exist in request paths. Numbered, reversible migrations live in `database/migrations/`; run migrations before deploying. Existing production columns are handled with idempotent SQL or `--baseline`.
4. Down migrations are destructive and require explicit confirmation in production.
5. Staff, login, check-in, and storefront APIs require server-side permissions or rate limits as appropriate. Security headers must remain strict.
6. Phase 1 acceptance requires lint, TypeScript, build, and the tests available at that phase. Record failures rather than disabling rules.

## Phase 2

Add Vitest and Playwright before feature work. Use local seeded credentials and test databases only. Cover desktop, iPhone, Pixel, iPad, WebKit, no horizontal scroll, accessible names, touch target sizes, input sizes, network/console errors, and serious or critical axe violations. Add CI for lint, TypeScript, build, unit tests, and E2E tests.

## Phase 3

Implement real Stripe checkout with a 15-minute pending-payment hold, server-side prices, conditional seat reservation, idempotent webhook processing, paid/expired/refunded transitions, ticket issuance only after payment confirmation, hold release cron, email logging, confirmation delivery, and Stripe refunds. Mock payment is allowed only in demo or staging. Use Resend and `tickets@hilstonpark.com` unless Nav chooses otherwise. Allow admin-only partial refunds for unused tickets by default.

## Phase 4

Production mode removes preview wording, provides legal/contact/main-site links, uses `/events` for public root traffic, replaces `/account` with Find my booking, handles unavailable payments and sold-out/low-availability states, and provides successful/cancelled booking return routes. Add route metadata, event JSON-LD, Open Graph data, sitemap filtering, and robots exclusions.

## Phase 5

Unify staff design tokens and shared controls. Use accessible dialogs/drawers, transform/opacity motion only, reduced-motion support, stable loading states, keyboard-complete menus and comboboxes, consistent dates/currency/pluralisation, and no native confirm/alert for application flows.

## Phase 6

Test 320px through 1440px in both orientations. Remove sideways scroll, use safe-area insets and dynamic viewport units, maintain 44px touch targets and 16px touch inputs, make staff navigation usable on phones, turn tables into responsive cards, and add manifest/offline tolerance where specified.

## Phase 7

Meet WCAG 2.2 AA: one page heading, unique titles, labelled fields, readable permissions, focus-managed dialogs, complete combobox semantics, live validation summaries, contrast, visible focus, skip link, accessible charts, and zero serious or critical axe findings.

## Phase 8

Polish dashboard, reports, empty states, audit copy, trends, activity filtering, sentence case, and staff identity display.

## Phase 9

Configure production environment variables, Stripe webhooks, monitoring, protected health checks, backups/restore drill, custom domain, legal coverage, Lighthouse budgets, real-device smoke tests, and rollback procedures.

## Decisions and defaults

- Email: Resend, `tickets@hilstonpark.com`.
- Partial refunds: allowed for unused tickets, admin only.
- Account: replace with Find my booking and a secure one-time link.
- Wrong-session override: managers/admins, audited.
- Public Staff sign-in link: removed.
- SOON navigation: hidden in production, available in staging.
- Help: mailto support link.
- Domain: `tickets.hilstonpark.com`.
- Hold: 15 minutes.
- Booking fee: none; displayed price includes everything.
