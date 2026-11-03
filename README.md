# ShePlates v6.0.0 — Ultra Modern Mobile-First

This build layers a new responsive design system and native-style mobile shell on top of the production-hardened commerce application. See `ULTRA_MODERN_V6_RELEASE_NOTES.md` for the UI changes and `MOBILE_APP_PACKAGING.md` for the later Android/iOS packaging path.

# ShePlates V4.1.1 — Agentic Hyperlocal Commerce

## V4.1.1 — She Agent: real intent detection, memory, and photo-backed quality complaints

She Agent no longer dead-ends with a generic "please rephrase" reply. It now:

- **Detects intent directly**, without asking the customer to repeat themselves: tracking an order, asking for a recommendation, adding an item to cart, or reporting a quality problem are all recognised from the message itself (fixed a regex-precedence bug that used to fire a blind "Other" ticket on almost any message containing the word "issue" or "complaint").
- **Remembers customer preferences**: a stated budget (e.g. "under ₹150") and the categories a customer orders from are saved to that customer's profile (`agentMemory`) and reused for future recommendations without asking again.
- **Handles "my food is spoiled" as an agentic, evidence-based flow**, the same shape used by mainstream food-delivery apps: She Agent asks the customer to attach a photo of the item, sends the photo and complaint to `/api/agent` (task `quality_complaint`) for an AI assessment, and forwards the AI's spoilage read plus a recommended refund percentage to Operations' Cancellations queue — where a human always makes the final refund decision and can edit the suggested amount before approving. With `OPENAI_API_KEY` configured, the photo is genuinely sent to the model for a vision-based assessment; without it, the deterministic fallback is explicit that no real image analysis happened and defers to manual Operations review. The photo is only used for that one assessment and is not stored for later viewing, consistent with how ticket attachments already worked in this build.
- Deterministic intents (tracking, recommending, adding to cart) are answered instantly from local state rather than round-tripping to an LLM, so they work identically with or without `OPENAI_API_KEY`.

## V4.1.0 — production hardening pass

- **Reschedule is now a real dialog**, not a browser `prompt()` — date, repeat pattern and delivery-day chips, with a live preview of every date it will actually fall on, for both product schedules and individual orders.
- **The calendar now shows every chosen delivery day.** Weekly/Custom schedules previously only marked the anchor start date; the calendar and schedule cards now compute every occurrence from the recurrence + weekday selection.
- **Orders can be paid.** A "Pay now" action on pending orders records a real transaction (`Vendor payments`/`Settlements`), splits the platform commission from the vendor payout, and schedules the payout date — this is what was leaving milk/grocery orders stuck on "Pending" indefinitely.
- **Vendor payments end-to-end**: every collected payment is recorded with the platform commission, the vendor's net payout and a scheduled payout date (`T+7` by default). Vendors see their own Settlements; Operations sees vendor-wise income, platform profit and can release payouts once due; Super Admin gets the same view read-only. Approved cancellations automatically void a payout that has not yet been paid out.
- **Ticket centre ownership clarified**: Operations remains the owning team that triages and resolves tickets from customers and vendors; Super Admin now gets a platform-wide oversight view (no resolve action) instead of a duplicate management surface.
- **Team access, Super-Admin-only**: a "Create user" flow lets Super Admin provision Operations (or additional Super Admin) logins from the Users screen. With Supabase configured it creates a real, confirmed Auth account + profile via a service-role API route that re-verifies the caller is an admin; without Supabase configured it creates a local test login so the flow is still fully testable.
- **Excel exports**: the Audit log, Vendor payments and a new customisable Reports centre (Orders, Vendor payments, Tickets, Vendor directory, Cancellations, Customers, optionally date-filtered) all download real `.xlsx` workbooks (via SheetJS) for Operations and Super Admin.
- **Automatic AI business health panel for Super Admin**: a heuristic "What's going well / Needs attention / Recovery & best practices" panel computes instantly from live platform data (no API key required), plus an optional "Generate narrative" button that asks She Agent (`/api/agent`, task `business_insights`) for a written summary when `OPENAI_API_KEY` is configured.
- Removed the "Clear local test data" sidebar control — a development-only reset button that had no place in a production build.

V4.0.1 packaging hotfix: the required `build/sites-vite-plugin.ts` source is included in the downloadable ZIP, so `npm run dev` starts correctly after a fresh Windows extraction.

V4 adds a customer cart controlled by explicit confirmation, calendar schedules with pause/reschedule/cancel, stage-based cancellation charges, vendor-start and live-location tracking, editable customer phone/addresses/preferences, monthly-list upload with RFQ closing dates and vendor participation, vendor logos/banners/multiple POS outlets, a role-scoped ticket centre, deeper Operations/Admin AI analytics, and a floating She Agent on every authenticated page.

Verification notifications are now durable in Supabase: Operations calls `review_vendor_and_notify`, which updates the vendor, inserts the private vendor notification and writes an audit record. Authenticated clients refresh their own RLS-filtered notifications every 15 seconds.

V3.3.4 isolates browser notifications by both recipient email and role, automatically drops ambiguous notification records saved by older builds, and hardens the Operations/Super Admin bootstrap so a missing `profiles` row is recreated and verified before the setup command reports success. Authentication errors now display the Supabase message instead of the generic “Unable to continue” fallback.

V3.3.1 hotfix: live Supabase synchronization is non-blocking for cached workspaces, has a 10-second timeout for first-time profiles, and provides Retry/Continue controls instead of leaving the application on an endless loading screen.

V3.3.2 adds a guarded full-development reset that clears all ShePlates tenant data, uploaded test files and Auth users, followed by a staff-only account bootstrap.

V3.3.3 adds an explicitly enabled, localhost-only customer/vendor signup route that auto-confirms test accounts without email. It is blocked on production hosts.

## Local signup without email confirmation

For local end-to-end testing only, add both flags below to `.env.local` and restart `npm run dev`:

```dotenv
NEXT_PUBLIC_TEST_AUTO_CONFIRM=true
SHEPLATES_TEST_AUTO_CONFIRM=true
```

The test route uses `SUPABASE_SERVICE_ROLE_KEY` only on the server, accepts only `customer` or `vendor`, and refuses production or non-local hosts. Remove the flags or set both to `false` before deployment. Existing test emails can be reused if they already have the same customer/vendor role; the route confirms the account, updates its password and signs it in immediately.

An end-to-end, multi-role product model for scheduled local food and grocery commerce. Customers do not buy a ShePlates subscription. Vendor subscriptions and entitlement tiers are included, while prices remain configurable for a later commercial decision.

V3 deliberately starts with **no seeded vendors, products, requirements, quotes, schedules, orders or notifications**. Create the data yourself and test the complete hand-off between roles.

## Included product flows

### Customer

- First-login profile setup for address/geolocation, household size, diet, allergies, dislikes and health goals
- Marketplace location, search, categories and verified/open-vendor filtering
- Nutrition and calorie display for the exact retail pack selected by the vendor
- Product-aware schedule planner with start/end dates, recurrence, weekdays, time window and whole-pack quantities
- Clear sellable pack sizes such as 250 ml pouch, 500 g pack, 1 kg pack and tray of 12 eggs
- Monthly household requirement builder and sealed local vendor quotations
- Quote selection, order creation, tracking, delivery-person contact and cancellation request
- In-app notifications and opt-in device notifications
- Persistent right-side **She Agent** chat on every authenticated page
- Agent-proposed cart with explicit customer confirmation before order/payment
- Calendar schedule view with pause, resume, reschedule and cancellation
- Editable WhatsApp phone number, default address, extra addresses and food preferences
- CSV/TXT monthly-list import, RFQ closing date and invited/accepted/waiting vendor counts
- Order-stage cancellation charge disclosure and live delivery map
- Account-scoped support tickets with document attachment metadata

### Vendor

- Self-onboarding with business owner, address/geolocation, a real OpenStreetMap preview and adjustable service radius
- Delivery, pickup and daily store-open/closed controls
- Private food certification upload and Operations verification state
- Catalogue creation with an exact pack size, price per pack and available pack count
- She Agent nutrition estimates scaled to the selected pack, with a calorie-to-macronutrient consistency check
- Scheduled-order fulfilment and status updates
- Delivery staff name/phone directory and per-order assignment
- Premium monthly-requirement quotation opportunities
- Vendor-scoped She Agent context: only that vendor's profile, products, staff and orders
- Brand logo/banner and customer-facing shop preview
- Multiple POS/outlet records
- Start/preparation notifications and delivery-device live-location updates
- Vendor-scoped support tickets; vendor A cannot read vendor B data under V4 RLS

### Operations

- Command centre metrics for vendor trust, open stores, active orders, GMV, cancellations, quote conversion and unassigned deliveries
- Assisted vendor onboarding with explicit ownership assignment to an existing vendor login
- Food-certificate verification, rejection and change requests
- Per-vendor, per-item operational percentage controls
- RFQ monitoring, all-order tracking and AI-assisted cancellation review
- Human-owned final cancellation and payment-reversal decision
- Platform-authorised She Agent context
- Durable vendor verification notification and audit transaction
- AI risk signals for fulfilment, inventory, assignments, RFQs and open tickets
- All-platform ticket triage and resolution

### Super admin

- Executive marketplace funnel, user, vendor, product, order and pricing metrics
- Vendor subscription-plan assignment
- Pricing-policy visibility and audit trail
- Platform-authorised She Agent context
- Executive AI signals for role/access governance, vendor concentration, plan adoption, policy impact and audit anomalies
- All-platform ticket oversight and storefront/POS governance

## Role-level She Agent boundaries

| Role | What She Agent can use | Allowed assisted actions | Never allowed automatically |
| --- | --- | --- | --- |
| Customer | That customer’s profile, addresses, preferences, cart, schedules, RFQs, quotes, orders and tickets | Recommend products, add a proposal to cart, explain nutrition, track orders, draft/open tickets | Confirm payment, award a quote, approve cancellation/refund |
| Vendor | Only that vendor’s storefront, outlets, catalogue, inventory, staff, invited RFQs, orders and tickets | Summarise fulfilment, inventory and eligible RFQs; draft/open tickets | Read another vendor, change Operations markup, self-verify |
| Operations | Authorised platform vendor/order/RFQ/cancellation/ticket data | Prioritise risks, explain exceptions, recommend verification/refund decisions | Execute payment reversal without human approval |
| Super admin | Authorised platform metrics, plans, roles, pricing and audit | Governance analysis, access/plan anomaly detection, commercial scenarios | Silent role escalation or destructive platform changes |

## Run locally on Windows

Requires Node.js 22.13 or later.

After extracting the ZIP, if the prompt already ends in the project folder, do not run `cd sheplates` again.

```powershell
npm install
npm run dev
```

Open the Vite URL, normally `http://localhost:5173/`.

## Test identities

The landing page has only **Customer login** and **Vendor / Team**. Operations and Super Admin use the Vendor / Team entry.

| Persona | Email | Password |
| --- | --- | --- |
| Customer | `customer@sheplates.demo` | `Customer@123` |
| Vendor | `vendor@sheplates.demo` | `Vendor@123` |
| Second vendor | `newvendor@sheplates.demo` | `NewVendor@123` |
| Operations | `operations@sheplates.demo` | `Operations@123` |
| Super admin | `admin@sheplates.demo` | `Admin@123` |

In demo mode, changes are shared between roles in the same browser using local storage. In live mode (`NEXT_PUBLIC_DEMO_MODE=false`), customer locations, vendors, verification, daily service controls, product packs and nearby marketplace results are shared through Supabase across logins and browser profiles.

If you already installed V3.2, run `supabase/V3_3_MARKETPLACE_VISIBILITY_FIX.sql` once before starting V3.3. The customer marketplace now calculates radius eligibility inside Supabase and displays the exact blocking stage when no product is visible.

## Recommended empty-data test sequence

1. Sign in as Vendor and complete onboarding, address, radius, fulfilment and certification.
2. Sign out; sign in as Operations and verify the vendor.
3. Sign out; return as Vendor, open the store for today, add delivery staff and create products.
4. Sign in as Operations and set item percentages.
5. Sign in as Customer, complete the food profile, search, schedule a product and create a monthly requirement.
6. In Super Admin, assign Premium to a vendor for quotation access.
7. As Vendor, submit a quote; as Customer, select it and track the created order.
8. Assign a delivery person as Vendor, update order status, then inspect the customer notification.
9. Request cancellation as Customer; approve or reject it as Operations.
10. Open She Agent on every role and verify the scope banner and role-specific answers.

## Supabase upgrade

If you already ran the V2.1 SQL, run these files in order in Supabase SQL Editor:

1. `supabase/V3_UPGRADE.sql`
2. `supabase/V3_3_MARKETPLACE_VISIBILITY_FIX.sql`
3. `supabase/V4_UPGRADE.sql`
4. `supabase/V3_RESET_TEST_DATA.sql` — optional but recommended for a clean start

`V4_UPGRADE.sql` is required for durable verification notifications, customer addresses, carts, outlets, live tracking, tickets and communication outbox records.

The reset keeps Auth users and profile roles, but deletes vendor and transaction test data. Then run:

```powershell
npm run supabase:create-users
```

V3's user script creates/updates only the five Auth/profile identities. It no longer seeds vendor records.

To create or reset **only Operations and Super Admin** credentials without changing either vendor or the customer, run:

```powershell
npm run supabase:create-staff-users
```

This uses the Supabase Admin API. Do not update `auth.users.encrypted_password` manually in SQL.

### Full development reset: staff accounts only

This is permanent. First verify that the correct development project is open in Supabase. Run `supabase/V3_FULL_DEVELOPMENT_RESET.sql` in SQL Editor. It deletes all profiles and dependent ShePlates data while preserving the schema, RLS policies, Storage buckets and vendor-plan configuration.

Then run these commands in PowerShell or Command Prompt from the extracted project folder:

```powershell
npm run supabase:delete-all-users -- --confirm=DELETE_ALL_SHEPLATES_DATA
npm run supabase:create-staff-users
```

The first command empties only the two ShePlates upload buckets and deletes every Supabase Auth user. The second command recreates only:

| Role | Email | Password |
| --- | --- | --- |
| Operations | `operations@sheplates.demo` | `Operations@123` |
| Super admin | `admin@sheplates.demo` | `Admin@123` |

To use custom credentials, add these optional values to `.env.local` before running the staff command:

```dotenv
SHEPLATES_OPERATIONS_EMAIL=operations@yourdomain.com
SHEPLATES_OPERATIONS_PASSWORD=replace-with-a-strong-password
SHEPLATES_OPERATIONS_NAME=Operations Team
SHEPLATES_ADMIN_EMAIL=admin@yourdomain.com
SHEPLATES_ADMIN_PASSWORD=replace-with-a-different-strong-password
SHEPLATES_ADMIN_NAME=Super Admin
```

See `supabase/SETUP.md` for environment variables and the RLS test matrix.

## OpenAI and She Agent

`app/api/agent/route.ts` uses the OpenAI Responses API when `OPENAI_API_KEY` is configured. In live Supabase mode, the endpoint validates the caller's bearer token, derives the role from `profiles`, and queries data through the caller's RLS session. It does not trust a role supplied by browser code. Without an OpenAI key it returns deterministic, testable recommendations.

Nutrition is an estimate and must be confirmed against a product label or recipe. V3.2 calculates against one exact selling pack. For example, the controlled whole-milk reference is approximately 153 kcal for a 250 ml pack and 610 kcal for a 1 litre pack. If an AI response has missing macros or calories that do not broadly agree with protein, carbohydrate and fat, the app rejects it and loads the controlled product reference instead. Exact values vary by product, recipe, density, fat percentage and brand. She Agent never approves payments, refunds, cancellations, verification, pricing or vendor reassignment.

## Maps, vendor association and marketplace visibility

- Customer and vendor onboarding now require a confirmed coordinate pin. Typed Indian addresses are geocoded and fresh browser GPS coordinates are reverse-geocoded through `app/api/geocode/route.ts`.
- The customer Marketplace location control can re-run fresh GPS detection. It displays the exact coordinates, an interactive OpenStreetMap preview and a Google Maps verification link.
- Vendor → Store & radius can correct the store address and GPS pin after onboarding. Customer-to-vendor distance is calculated from both saved coordinate pins and checked against the vendor radius.
- Placeholder text from older saved profiles is repaired on load; it is no longer treated as a real delivery address.
- Operations-assisted onboarding must assign the business to one of the actual vendor test logins. Existing records with a wrong owner can be reassigned from the Operations vendor table.
- A product appears to a customer only when the vendor is verified, the store is open today, the product is active, stock is above zero and the customer falls within the service radius.

The public Nominatim service is suitable for light local testing. Before production traffic, use a dedicated or commercial geocoding service and observe the provider's usage policy, caching and rate limits.

## PWA and notifications

The manifest and service worker make the project installable as a web app and support in-app/device notification testing. Mobile background push in production additionally requires HTTPS, VAPID keys, saving a browser push subscription, and a trusted server/queue that sends Web Push events. The database table and service-worker receiver are included; real provider delivery credentials are not embedded in the ZIP.

WhatsApp reminders use an auditable `communication_outbox`. The included `supabase/functions/send-communication-outbox` worker calls the WhatsApp Cloud API only after you deploy it, schedule it (normally every minute), configure an approved Meta template and add provider secrets. Without those provider credentials, the app can demonstrate the queue and in-app/device notifications but cannot deliver a real WhatsApp message.

## Validation

```powershell
npm run lint
npm test
```

## Important production boundary

The packaged UI is a testable product prototype. Local-mode business data (schedules, orders, cancellations, tickets, vendor payments/settlements, team users) uses browser storage to make cross-role testing simple end-to-end without any external service. Live mode centralizes the core discovery and identity path—Auth, customer location, vendor onboarding, verification, daily store controls, product creation, nearby marketplace reads and Super-Admin user provisioning—in Supabase under RLS.

Money in this build is a **simulated capture**: "Pay now" does not call a real payment gateway (no Razorpay/Stripe keys are wired), and the vendor payout ledger (`transactions` in local state) is not yet persisted to the `payments` table already defined in `supabase/schema.sql`. Before real money moves, wire "Pay now" to an actual gateway with webhook reconciliation, persist transactions/payouts to Supabase (see `supabase/V4_2_VENDOR_PAYOUTS.sql` for a starting schema) and add a scheduled job to auto-release payouts instead of the manual "Mark payout paid" action. Also finish: webhook reconciliation, Web Push delivery, production-grade geocoding capacity, malware scanning, rate limits and an independent security review before launch.


## V4.2.0 — She Agent commerce experience

- Replaced the old side-drawer chat with a floating, mobile-first commerce copilot.
- Added live recommendation cards with vendor, pack, customer price, protein and one-tap Add actions.
- Added budget-aware basket planning, meal/category intent matching, saved preference signals and basic allergy-term filtering.
- Added one-tap “Add suggested basket”, live basket value inside She Agent and direct navigation to Cart for customer confirmation.
- Expanded authenticated She Agent context to include the serviceable nearby marketplace for the customer’s saved pin.
- Preserved human confirmation for checkout, payments, refunds, verification and other sensitive actions.

---

## v4.6.0 — Agentic Marketplace

The v4.6 release moves the customer experience to a sidebar-free marketplace, adds top-bar Cart / Quotations / Notifications, dismissible OpenAI-grounded recommendations, advanced nutrition / budget / planning-period filters, controlled customer preference memory, vendor AI insights, AI-assisted product-image presentation, and Super Admin homepage / campaign controls.

**Database upgrade required:** run `supabase/V4_6_AGENTIC_COMMERCE.sql` once after the prior migrations. See `FINAL_V4_6_AGENTIC_MARKETPLACE_RELEASE_NOTES.md` for the full setup and guardrails.

## v4.8 role-secured She Agent

The production assistant now verifies the signed-in account before loading context and applies a separate data scope for Customer, Vendor, Operations, and Super Admin. Browser-supplied role claims are ignored when live authentication is active.

For an existing v4.6/v4.7 database, apply `supabase/V4_8_ROLE_AGENT_SECURITY.sql`. In production keep `NEXT_PUBLIC_DEMO_MODE=false`; demo mode is intended only for local testing.

See `FINAL_V4_8_ROLE_SECURITY_RELEASE_NOTES.md` for the exact role boundaries and validation coverage.


## v6.1 production mobile + nutrition migration

For v6.1, run `supabase/V6_1_MOBILE_NUTRITION_FLOW.sql` after the existing v5 production migrations. This release fixes paid-schedule visibility and mobile auth/layout issues and makes nutrition optional with an Operations review workflow. See `V6_1_MOBILE_FLOW_NUTRITION_RELEASE_NOTES.md`.
