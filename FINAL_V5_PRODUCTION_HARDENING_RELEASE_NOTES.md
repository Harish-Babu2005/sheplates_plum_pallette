# ShePlates v5.0.0 — Production Hardening

This release is based on the live production observations from app.sheplates.com.

## Fixed / improved

- Product image upload no longer depends on a pre-existing browser-accessible bucket. A server-side upload route prepares the product image bucket if required and uploads safely.
- Vendor/customer entry is visible on narrow mobile screens without rotating the phone.
- Forced light colour scheme and mobile form contrast prevent white-on-white fields/text.
- Vendor navigation is scrollable on mobile and remains collapsible on desktop so lower tabs stay reachable.
- Vendor delivery team supports add, edit, activate/deactivate and delete, with live persistence.
- Delivery assignment is persisted and validated against the vendor that owns the order.
- Vendor verification details can be edited and resubmitted; a new certificate can be uploaded.
- Outlet/POS certification columns are added for separate outlet compliance records.
- Product list upload can use She Agent to structure a CSV/TXT/TSV list into catalogue drafts, with deterministic fallback. Human review and approval are always required.
- Optional catalogue product-image generation is available per draft row.
- New paid orders and other important account events are refreshed from the live account every 15 seconds and produce in-app popups/sound when browser permissions allow.
- Customer scheduling now enters checkout first. An unpaid schedule is not exposed to the vendor.
- Completing payment confirms the schedule and creates the future delivery orders for the schedule horizon, so vendor Today/Tomorrow/All/Date views show individual delivery dates and daily values.
- A payment reminder is queued for an unpaid checkout and cancelled after payment.
- Vendor/Operations order view now supports Today, Tomorrow, All dates and a custom date picker, with value metrics.
- Customer Orders shows paid/confirmed deliveries; pending checkout remains in Cart.
- Super Admin Reports includes a Zoho Books-oriented paid daily order export.
- Live commerce orders, schedules, delivery team and assignments are refreshed from the shared account data, rather than depending only on one browser's local state.

## Required one-time database update

Run in the database SQL editor after the earlier migrations:

`supabase/V5_PRODUCTION_HARDENING.sql`

It adds outlet certification metadata, indexes, product-image storage configuration, tighter unpaid-order vendor visibility, and a service-only paid-order export view.

## Email code verification

The application now uses a six-digit email OTP flow instead of depending on a clickable signup confirmation URL.

In the authentication email template used for OTP / magic-link sign-in, include the token placeholder so the email visibly contains the six-digit code. Also set the production Site URL to `https://app.sheplates.com` for any other authentication redirects.

## Payment note

The current payment dialog records/advances the application payment workflow but is not a real card/UPI charge unless a production payment gateway is connected. Do not represent the simulated checkout as a live payment gateway until provider integration and webhook verification are enabled.

## Deployment

After applying the database migration, push these files to the existing GitHub `main` branch. Render's auto-deploy can then rebuild the app.

Recommended Render build command:

`npm ci --include=dev && npm run build`

Recommended start command:

`npm start`

## Validation

- 97 TypeScript / TSX source files inspected by syntax-only TypeScript validation with no parser-level errors.
- 34 targeted regression/contract tests passed.
