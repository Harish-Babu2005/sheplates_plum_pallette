# ShePlates — Production Revamp Delivery Summary

**Base version:** v7.2.0 "TRUE_DESIGN_MATCH" (as supplied)
**Delivered:** 2026-09-11, updated 2026-09-17 with a second round (§0)
**Git history:** 9 commits on top of a `d4add8f` baseline commit of the original ZIP (see `git log`). Nothing was squashed or rewritten — every commit is a real, reviewable step.

This is a revamp of the existing application, not a rebuild. No business logic, database schema (beyond the five additive migrations below), authentication, or role/permission model was replaced. Every change is scoped to what's described in this document.

---

## 0. Round 2 (2026-09-17) — interactive map, vendor QR codes, faster agent replies

This section covers what changed after the original delivery below (§1–§10 are otherwise unchanged and describe round 1). Confirmed at the start of this round: all four round-1 migrations (`V4_6_AGENTIC_COMMERCE.sql`, `V7_3`, `V7_4`, `V7_5`) had been applied to the live database in the interim — verified by direct query, not assumed.

### 0.1 Interactive nearby-vendors map
Customers can now see every vendor in their marketplace on a live Leaflet map, centred on their own location, with a green radius circle they can resize by **dragging a handle marker** or using **+/− stepper buttons**. Vendor pins are colour/size-coded (closest vendor highlighted, out-of-range pins dimmed), and tapping one filters the product list to that vendor. Opens from a new "Map" toggle next to the existing Filters button in the Marketplace toolbar.

- **File:** `components/nearby-vendors-map.tsx` (new).
- Built with `react-leaflet` v5 (React 19-compatible). Loaded through a manual client-only wrapper in `components/sheplates-v3.tsx` (plain `useState`+`useEffect`+dynamic `import()`) rather than `next/dynamic` — this app's Next-compatible layer (vinext) doesn't support `next/dynamic` correctly, and Leaflet touches `window` at module-eval time, which breaks the framework's server-render pass if imported eagerly.
- **Bug fixed during QA:** on mobile viewports the map's own radius-circle overlay sat above the +/− buttons and swallowed their clicks, because neither the toolbar nor Leaflet's container established a CSS stacking context, so Leaflet's internal panes (explicit `z-index` up to ~700) won regardless of DOM order. Fixed by giving the toolbar an explicit `z-[1000]`. Caught by the mobile Playwright run, not manual QA — see §7.1.
- **Requires `supabase/V7_6_MARKETPLACE_NEARBY_RETURN_COORDS.sql`** (new, listed in §5) to plot vendor pins — it adds `vendor_lat`/`vendor_lng` to the existing `marketplace_menu_nearby()` RPC's return columns. Without it the map still renders (customer location, radius circle, controls) but vendor pins are omitted, since the RPC doesn't return coordinates yet.

### 0.2 Vendor QR code → shop deep link
Every vendor's "Online shop & POS" page now shows a generated QR code (client-side, via the `qrcode` package) encoding a link straight to their storefront, plus a "Download QR" link for printing. Scanning it:
- **Signed-in customer:** lands directly filtered to that vendor's shop (a dismissible "Viewing {Vendor}" chip appears; clicking it clears the filter).
- **Signed-out visitor:** is prompted to sign in first; the vendor filter is preserved through login and applied automatically afterward.

**Files:** `components/vendor-qr-code.tsx` (new), `components/sheplates-entry.tsx` (pre-login `?vendor=` handling), `components/sheplates-v3.tsx` (post-login filter + QR render in `StorefrontPos`). Pure query-param deep-linking — this app has no client-side router.

### 0.3 Faster She Agent chat responses
Each agent turn was fetching the customer's marketplace, cart, and quotation-comparison data from Supabase **sequentially** before calling the OpenAI Responses API — three independent round trips run one after another for no reason (none of the three depends on another's result). Changed to run them concurrently via `Promise.all`, removing roughly two full network round trips of latency from every message.
**File:** `app/api/agent/route.ts`.

This is a real, measured-category fix (fewer sequential round trips), not a claim that the agent is now "instant" — the underlying OpenAI tool-calling loop (up to 6 rounds) is unchanged and still the dominant cost on turns that need several tool calls. Streaming the response was considered and intentionally not implemented this round: the agent's output is structured JSON (not freeform prose) consumed by the UI in specific typed shapes, and retrofitting token-level streaming onto a multi-round structured tool-calling loop is a meaningfully larger, riskier change than this pass's scope — flagged here rather than silently skipped.

### 0.4 UI/UX simplification pass
Folded into the map and QR work rather than a separate redesign: the Marketplace toolbar keeps the map/radius/vendor-filter controls as small dismissible chips rather than permanent UI, so the default (no-filter) view stays exactly as simple as before — the new power-user capability doesn't add visual weight for customers who don't use it.

### 0.5 Testing this round
Two new Playwright specs (`nearby-vendors-map.spec.ts`, `vendor-qr-code.spec.ts`), plus a `resetTourCompletion()` test helper added after confirming the round-1 tour-persistence migration is live in the database (demo accounts had genuinely already dismissed their tours from earlier manual testing, so the tour specs needed a deterministic DB reset rather than assuming a fresh account). Full current pass count in §7.1.

### 0.6 Still not done as of round 2 — addressed in round 3 below (§0b)
- RFQ/Monthly Requirement/Quotations, Ticket Centre, and Vendor Payments/Settlements/Reports had no dedicated E2E coverage.
- The map's vendor pins need `V7_6` applied (§5) to show real coordinates — code-complete and tested for the no-migration-yet degrade path, but pins won't appear live until it's run.
- Payments/WhatsApp remain simulated per the original instruction to leave them that way.

---

## 0b. Round 3 (2026-09-18) — sleeker UI, a real production bug fix, and the last E2E coverage

### 0b.1 Typography and icons — "sleek", not a marketing splash page
Requested directly: no big fonts, a more app-like feel, and unique icons in the spirit of (not copying) polished food-delivery apps. Two changes:

- **Type scale cut down everywhere.** The public landing page's hero title was rendering at up to `6.3rem` (~100px) desktop / `4.8rem` mobile — a marketing-site headline, not an app screen. Every heading class above `text-xl` across both the app (`components/sheplates-v3.tsx`) and the landing page (`components/sheplates-entry.tsx`, `app/globals.css`) was brought down to a compact `text-lg`–`text-2xl` range: the shared `Heading` component used on every page title, all dialog titles, the onboarding wizard, and the landing hero/section titles.
- **Emoji replaced with a real icon system.** Every product/category "icon" in the shipped app was a raw browser emoji (🍱, 🥛, 🛍️…) rendered as oversized text — inconsistent across OS/browser font rendering, and exactly the kind of thing that would look different again once wrapped as a native app. Added `categoryVisual()` in `lib/sheplates-data.ts`: a small map from each of the 8 product categories to a `lucide-react` icon and a distinct accent colour (blues/ambers/violets/greens — a varied palette, not Zomato-red or Swiggy-orange), reused by both the marketplace (`ProductGlyph`/`CategoryBadge` in `sheplates-v3.tsx`) and the landing page's category tiles and plan cards. Renders identically everywhere, no OS emoji-font dependency.

Verified live in-browser before/after on desktop and mobile (375px) — see conversation for screenshots; not re-captured into `qa-screenshots/` this round.

### 0b.2 Real bug found while testing RFQ: vendor plans never actually saved
While building E2E coverage for Monthly Requirement (RFQ), manual testing surfaced a genuine production-blocking bug, not a testing gap: Super Admin's **Vendor plans** page lets you assign a vendor Launch/Growth/Premium, and it looked like it worked (a success toast, the table updates) — but the write only ever touched local React state. Nothing was persisted to Supabase. Every vendor session reloads its plan hardcoded to `"Launch"` regardless of what Super Admin picked, and the customer-facing RFQ eligibility check requires `plan === "Premium"` — so **no vendor could ever receive an RFQ in a real production deployment.** The database side of this was already fully built (`vendor_plans` catalogue table, `vendors.plan_id`, RLS restricting the assignment to admin/operations) and simply never wired into the client.

Fixed:
- `lib/supabase.ts`: new `saveLiveVendorPlan()` writes `vendors.plan_id`; the vendor's own workspace load and the operations/admin vendor-list load both now embed `vendor_plans(code,name)` instead of ignoring it.
- `components/sheplates-v3.tsx`: every place a `Vendor` is built from live data now reads the real plan (`planFromCode()`); the admin "All vendors" plan selector calls `saveLiveVendorPlan` with optimistic UI and rollback on failure.
- **`supabase/V7_7_MARKETPLACE_NEARBY_RETURN_PLAN.sql`** (new, not yet applied): adds the vendor's plan code to `marketplace_menu_nearby()`'s return columns, so a *customer's* RFQ eligibility check can see the real plan too (the admin/vendor-side fix above needs no migration — it's a plain foreign-key read — but the customer's own vendor list is built from this RPC).

Verified live: granted "Murugan Daily Foods" (the `vendor@sheplates.demo` account) Premium as Super Admin, reloaded, signed in as that vendor, and confirmed the Premium-only "Quote opportunities" panel unlocked — where before this fix it would have shown "Quotation access is on Premium" forever, for every vendor, no matter what Super Admin did.

### 0b.3 E2E coverage for the last four untested modules
Four new specs close out the modules named explicitly in the original brief:

| Spec | Covers |
|---|---|
| `rfq-quotations.spec.ts` | Customer publishes an RFQ, it appears under My quotations; the vendor-plan bug fix above (§0b.2) as a persistence regression guard; the vendor's own dashboard reflects a real, saved plan |
| `ticket-centre.spec.ts` | Customer raises a ticket → Operations resolves it → Admin's read-only oversight view reflects the resolution, across all three roles in one continuous flow |
| `vendor-payments-settlements.spec.ts` | A real customer payment creates a transaction; Operations sees it with a "Mark payout paid" action correctly **disabled** (same-day payment, not yet at its scheduled payout date — a direct regression guard for the `PAYOUT_CYCLE_DAYS` logic); Admin sees the same data strictly read-only |
| `reports.spec.ts` | The default "Orders" report (real Supabase-backed data) previews and downloads as a genuine `.xlsx` file; the full 7-report catalogue is present for both Operations and Admin |

These four modules' own *records* (RFQs, tickets, transactions/payouts) remain local-browser-mock state, not Supabase-backed — see §0b.4. The tests exercise the real UI and real logic (including now-real vendor plans) against that mock state, exactly as a user actually experiences the app today.

A new `switchTo()` test helper (`tests/e2e/helpers.ts`) enables this: unlike `loginAsCustomer`/`loginAsStaff`, it signs out and back in via the in-app buttons without clearing `localStorage`, so a piece of data created as one role (an RFQ, a ticket) stays visible when the test switches to another role to react to it — needed because RFQ/tickets/payments all live in one shared local state blob, not per-role Supabase rows.

**Full suite: 18 specs × 2 projects (desktop Chrome, mobile Pixel 7) = 36 tests, 36 passed, 0 failed** (last run: 2026-09-18).

### 0b.4 Important scope note: RFQ/Tickets/Settlements are not Supabase-backed
Discovered during this round's investigation, worth stating plainly for the production verdict (§9 has the full list): **`customer_requirements`, `rfq_vendor_invitations`, `vendor_quotes`, `support_tickets`, and `vendor_payouts` all have complete table schemas already migrated into Supabase — and the app's UI never reads or writes any of them.** Every RFQ, every ticket, every transaction/payout lives entirely in one `localStorage` blob (`sheplates-v3-state`) per browser. `supabase/V4_2_VENDOR_PAYOUTS.sql`'s own comment says as much: *"The shipped app keeps this ledger in browser local state... it is not required for local/demo use."* This was true before this round and remains true after it — the vendor-plan fix in §0b.2 is a narrower, different bug (a *field* that was silently discarded, not a *feature* that was never wired up). Wiring these three features to real Supabase tables is a real, scoped follow-on project, not a quick fix; flagging it clearly rather than leaving it implicit.

---

## 1. How to read this delivery

- **Source of truth for what changed:** `git log` and `git diff d4add8f..HEAD` in the delivered project folder.
- **Screenshots:** `qa-screenshots/` (desktop + mobile, before/after context in the commit messages).
- **Playwright report:** `playwright-report/index.html` (open in a browser) plus the raw pass/fail log in §7.
- **This file** is the narrative summary the checklist below expects — bugs found, fixes made, what's still open.

---

## 2. UI/UX redesign — what actually changed and why

The delivered v7.2.0 codebase already contained **four stacked visual eras** layered into `app/globals.css` (labelled in the file's own comments as v6, v7, v7.1 "glass", v7.2 "TRUE_DESIGN_MATCH"). The v7.2 layer had *already* been authored with a green/ivory palette matching this brief's direction — but it wasn't rendering, because several of its CSS rules were missing `!important` while an earlier, orange-era rule for the same selector had it. Per CSS cascade rules, `!important` wins regardless of source order, so the live app kept showing the old orange/Swiggy-style theme even though the "correct" CSS was sitting right there in the file.

**What was done:**
- Fixed the specificity bug on `.sp-entry-hero`, the `bg-[#ef3d3d]` brand-color normalizer, and the She Agent orb gradient so the intended v7.2 rules actually win.
- Swept every remaining hardcoded orange/coral hex and `rgba()` literal across all four CSS eras and replaced them with the brand palette below — including three spots invisible to a `bg-[#hex]` search because they were Tailwind gradient utilities (`from-/via-/to-[#hex]`) or literal `rgba()` triples, not the `--sp7-orange` variable.
- Removed every remaining `<Bot/>` (robot) icon — used across five different AI-insight panels in the live component — and replaced it with the same `Activity` (waveform) mark already used for the She Agent launcher, for a single consistent, non-robot agent identity throughout the app.
- No component structure, JSX composition, or business logic was touched to do this — it is a resolved color-cascade layer, not a rewrite.

**Palette actually shipped** (aligned to the brief's suggested values):

| Token | Value |
|---|---|
| Background | `#F8F8F4` |
| Surface | `#FFFFFF` |
| Deep Green (primary, pressed/strong states) | `#153D2A` |
| Brand Green (primary actions) | `#237A45` |
| Soft Green (chips, subtle fills) | `#E8F2EA` |
| Primary text | `#171917` (near-black, existing token) |
| Secondary text | existing warm grey tokens, unchanged |

Glass/blur material, the mobile floating navigation dock, the Apple-like popup treatment, and the light staff-portal shell were **already implemented** in the v7.1/v7.2 layers of the supplied codebase and needed no rework — only the color-cascade fix above to actually render as designed.

---

## 3. Functional bugs found and fixed

All four were reproduced against the live database before being fixed — none are assumptions.

### 3.1 Schedule payment-gating (confirmed via reproduction)
`product_schedules` rows were created with `status:'active'` at the moment `create_schedule` ran — before any payment. Fixed: schedules now start `awaiting_payment` and only flip to `active` inside the `mark_paid` action.
**Files:** `app/api/commerce/route.ts`, `components/sheplates-v3.tsx` (status type/label), `supabase/V7_3_SCHEDULE_PAYMENT_GATING.sql`.

### 3.2 Fulfilment mode not validated server-side
`checkout_cart` and `create_schedule` each computed the delivery/pickup mode differently, and neither actually validated the requested mode against the vendor's `delivery_enabled`/`pickup_enabled` flags — a schedule could be created for a fulfilment mode the vendor doesn't support. Fixed with one shared `resolveFulfilmentMode()` helper used by both actions; both now return a `409` if the vendor supports neither mode.
**File:** `app/api/commerce/route.ts`.

### 3.3 Super Admin "Homepage & Campaigns" — reproduced and root-caused
The `V4_6_AGENTIC_COMMERCE.sql` migration (which creates `platform_settings` and `marketing_campaigns`) had never been run against this database. Two compounding bugs made this invisible:
1. `loadLiveMarketplace()`/`loadLiveOperationsWorkspace()` silently treated the resulting Postgres error ("table not found") the same as "no data yet."
2. The "feature a product" UI applied its optimistic success state **before** confirming the save succeeded, so clicking "+" always showed a green checkmark — even though nothing was written and a refresh reverted it with no explanation.

Fixed: both load functions now surface the real error; the UI now waits for a confirmed save before showing success, and displays a clear, actionable banner (naming the exact missing migration and the underlying Postgres error) when the tables are unreachable — a real fix, not a suppressed error. **Requires `V4_6_AGENTIC_COMMERCE.sql` to be run** for the underlying feature to work; the code fix ensures it can never again *look* like it's working when it isn't.
**Files:** `lib/supabase.ts`, `components/sheplates-v3.tsx`.

### 3.4 Vendor verification — Operations/Admin could never actually verify a vendor
Found during manual QA of the Verification queue. `review_vendor_and_notify()` (a Postgres function from `V4_UPGRADE.sql`) assigns its `decision` parameter — a plain `text` value — directly to `vendors.verification_status`, a custom Postgres enum column, with no cast:

```
42804: column "verification_status" is of type verification_status but expression is of type text
```

Every "Verify"/"Reject"/"Request changes" click has always failed in this database, behind a generic "Verification decision could not be saved" toast. Fixed with explicit casts in a new migration; behavior (notifications, audit log, authorization) is otherwise unchanged.
**File:** `supabase/V7_5_FIX_VENDOR_VERIFICATION_RPC.sql`.

### 3.5 Critical mobile bug: sign-in dialog rendered off-screen
On any viewport under 640px, the customer/vendor sign-in dialog rendered with roughly half its box pushed off the top-left of the screen — effectively blocking mobile sign-in and sign-up entirely. Root cause: Tailwind v4 compiles `translate-x-[-50%] translate-y-[-50%]` (used for desktop centering) to the standalone CSS `translate` property, not `transform`. The existing mobile CSS override correctly reset `transform: none !important` to reposition the dialog near the screen edges, but never reset the separate `translate` property — so the dialog was still additionally shifted by half its own box size on top of its intended position. Confirmed via `getBoundingClientRect()`: the offset exactly matched `intended_position − box_size / 2`.
**File:** `app/globals.css` (two occurrences).

---

## 4. Enhancements implemented

### 4.1 Location — GPS + typed autocomplete (no new API key)
The app already had free reverse/forward geocoding via OpenStreetMap Nominatim (`app/api/geocode/route.ts`) — it just wasn't used for live suggestions. Added:
- A `suggest=1` mode on the existing endpoint returning up to 5 ranked results.
- A `LocationSuggestions` component: debounced (300 ms, 3-character minimum), shows primary/secondary address text with a location pin icon, wired into all five GPS/address-entry surfaces (customer onboarding, vendor onboarding, delivery-location dialog, customer profile default address, vendor daily-service store pin).
- Selecting a suggestion stores `latitude`/`longitude` as the source of truth, exactly like the existing GPS and manual-search paths — coordinates were already authoritative for marketplace matching; this only adds the missing UI.

No `MAPS_API_KEY` or other new environment variable was needed or added.

### 4.2 Product tours — customer and vendor
A real contextual coach-mark system (not a static modal): a fixed-position spotlight ring tracks an actual DOM element (via `getBoundingClientRect`, re-measured on scroll/resize), with a dark backdrop and a glass tooltip carrying Back/Next/Skip. Portalled to `document.body` so its positioning can't be broken by an ancestor's `transform`/`backdrop-filter` — the same class of bug fixed in §3.5.

- **Customer tour (10 steps):** location, search, categories, filters, Add/Schedule, She Agent, Cart, Orders, My Quotations, Account (Profile & Food / My Schedule / Monthly Requirement / My Quotations / Tickets).
- **Vendor tour (10 steps):** Dashboard, Store open/close & radius, Verification, Catalog, Quote opportunities, Orders, Delivery team, Settlements, AI insights, Tickets.
- Shows once per user, replayable anytime from **Help · Product tour** (customer account menu — desktop dropdown and mobile sheet; vendor sidebar). On a narrow viewport the vendor tour automatically opens the staff sidebar drawer first, since its targets live there.
- Completion is tracked per user via a new `profiles.tours_completed` column (`V7_4_PRODUCT_TOURS.sql`) and degrades gracefully (falls back to session-only state) if that migration hasn't been run yet — verified.

### 4.3 Add-to-Cart / Schedule — confirmed already independent
The brief called for these as two independent actions; they already were in the supplied codebase (`Add` / `Plan` buttons on every product card, each calling separate APIs). No change was needed here beyond the payment-gating and fulfilment-validation fixes in §3.1–3.2.

---

## 5. Database migrations — run in this order

I do not have direct SQL-execution access to your Supabase project (only the app's own anon/service-role REST keys, which cannot run DDL) — every migration below must be run manually in the **Supabase SQL Editor**, in this order:

1. **`supabase/V4_6_AGENTIC_COMMERCE.sql`** *(pre-existing file, not authored this round — was simply never applied)* — creates `platform_settings` and `marketing_campaigns`. Fixes §3.3. **Confirmed applied** (verified live, 2026-09-17).
2. **`supabase/V7_3_SCHEDULE_PAYMENT_GATING.sql`** *(new)* — widens the `product_schedules.status` check constraint to allow `'awaiting_payment'`. Fixes §3.1. **Confirmed applied.**
3. **`supabase/V7_4_PRODUCT_TOURS.sql`** *(new)* — adds `profiles.tours_completed text[]`. Enables §4.2's cross-device persistence (the tour already works without it, using session-only state). **Confirmed applied.**
4. **`supabase/V7_5_FIX_VENDOR_VERIFICATION_RPC.sql`** *(new)* — re-creates `review_vendor_and_notify()` with correct enum casts. Fixes §3.4. **Confirmed applied** — direct RPC testing shows all vendors verified cleanly.
5. **`supabase/V7_6_MARKETPLACE_NEARBY_RETURN_COORDS.sql`** *(new, round 2)* — re-creates `marketplace_menu_nearby()` adding `vendor_lat`/`vendor_lng` to its return columns. Enables §0.1's vendor map pins. **Not yet applied** — confirmed via a live RPC call still lacking these columns as of 2026-09-17. The map works without it (customer location + radius circle + controls all render); only the vendor pins are missing until this runs.
6. **`supabase/V7_7_MARKETPLACE_NEARBY_RETURN_PLAN.sql`** *(new, round 3)* — re-creates `marketplace_menu_nearby()` again, this time adding `vendor_plan_code`. Fixes the customer-side half of §0b.2's vendor-plan bug (the admin/vendor-side half needs no migration). **Not yet applied.** Supersedes V7_6's function body, so applying this one alone (after or instead of V7_6) gets you both the coordinates and the plan code — it's a strict superset.

None of these are destructive: 1, 3, 5 and 6 are additive (new tables / new column / new return columns on an existing function), 2 widens an existing constraint, 4 replaces a function definition with equivalent-but-corrected logic. No existing data is modified or dropped.

Also fixed as a **data issue**, not a schema change: the README's documented test identity `vendor@sheplates.demo` had a `profiles.vendor_id` of `null` in this database (never linked to a vendor), so it always hit first-time onboarding instead of the vendor dashboard. It's now linked to a real vendor row ("Murugan Daily Foods", submitted/pending verification) so the documented credential is actually usable, and I subsequently submitted it for verification through the real Operations UI (which is what surfaced bug §3.4).

---

## 6. Environment changes

**None required.** No new environment variables were added. `MAPS_API_KEY` remains unused and can stay blank — the location features use the app's existing free Nominatim integration.

`Razorpay`/`WhatsApp` env vars remain unset in this delivery per your instruction to leave payments/WhatsApp simulated for this pass; the schedule payment-gating fix (§3.1) works correctly against the existing simulated "Pay now" flow and needs no code change when real keys are added later.

---

## 7. Automated testing

### 7.1 Playwright E2E
`playwright.config.ts` + `tests/e2e/*.spec.ts`. Targets the app's own dev server, live against your Supabase project (not mocked).

**18 specs × 2 projects (Desktop Chrome, mobile Pixel 7) = 36 tests, 36 passed, 0 failed** (last full run: 2026-09-18).

| Spec | Covers |
|---|---|
| `auth.spec.ts` | Valid sign-in, invalid-password error, and a regression test pinning the sign-in dialog inside a 375px viewport (§3.5) |
| `location-autocomplete.spec.ts` | Typing "Ganapathy" returns ranked suggestions; selecting one produces an exact lat/lng pin |
| `marketplace-cart-schedule.spec.ts` | Add/Plan are independent actions; Add updates the cart badge; the schedule dialog states the payment-gating rule (§3.1) |
| `product-tour.spec.ts` / `vendor-tour.spec.ts` | Tour auto-opens once, Back/Next/Skip work, does not reopen, replays from Help — including the mobile-drawer fix |
| `admin-homepage-campaigns.spec.ts` | Regression guard for §3.3 — never shows a false "saved" state |
| `nearby-vendors-map.spec.ts` *(round 2)* | Map opens from the toolbar; the +/− radius stepper updates the in-range vendor count; customer marker renders |
| `vendor-qr-code.spec.ts` *(round 2)* | Vendor sees a generated, downloadable QR code; a signed-in customer's QR link filters to that vendor; a signed-out visitor is prompted to sign in |
| `rfq-quotations.spec.ts` *(round 3)* | Customer publishes an RFQ; the vendor-plan persistence bug fix (§0b.2) as a regression guard; vendor's dashboard reflects the real saved plan |
| `ticket-centre.spec.ts` *(round 3)* | Customer → Operations resolve → Admin oversight, across all three roles in one flow |
| `vendor-payments-settlements.spec.ts` *(round 3)* | A real payment creates a transaction; "Mark payout paid" is correctly disabled same-day; Admin is read-only |
| `reports.spec.ts` *(round 3)* | Default "Orders" report (real data) previews and downloads a genuine `.xlsx`; full report catalogue present |

Every module named in the original brief now has E2E coverage. See §0b.4 for the important caveat that RFQ/Tickets/Settlements records themselves are local-mock state, not Supabase-backed — the tests correctly exercise that as today's real behaviour.

### 7.2 Existing unit/contract tests
The project's pre-existing `npm test` (`node --test tests/*.test.mjs`) was not modified and was not the focus of this pass; it was not re-run as part of this delivery beyond confirming `npm run build` (which it depends on) succeeds.

### 7.3 Production build
`vinext build` (the project's own build tool, invoked directly since this machine doesn't have GNU `timeout`, which `scripts/build-verified.sh` requires) completes cleanly with no errors after every change in this delivery.

---

## 8. Manual visual QA performed

Verified live in-browser (not just code review) across customer, vendor, operations and super admin roles, at desktop (1280–1440px) and mobile (375–390px):

- Public landing page, customer/vendor sign-in dialogs
- Marketplace (search, categories, filters, product cards, She Agent "for you" picks)
- Cart, My Schedule (calendar view)
- She Agent panel (desktop side panel + mobile bottom sheet)
- Customer account menu (desktop dropdown + mobile glass sheet) and mobile floating nav dock
- Vendor Dashboard, Verification, Store & Radius
- Operations Command Centre, Verification queue
- Super Admin Executive View, Homepage & Campaigns, Reports

See `qa-screenshots/` for saved captures of the above.

**Not exhaustively covered** (see §9): Monthly Requirement/RFQ/Quotations flow, Delivery Team, Settlements, Ticket Centre, Vendor Payments, Audit Log, and the full 9-breakpoint matrix the original brief specifies were not individually walked through pixel-by-pixel this round — spot checks found no issues, but they were not given the same depth as the screens above.

---

## 9. Known remaining limitations — read before assuming "done"

Being direct about scope: the original brief describes a multi-week program (full per-role redesign polish, a Playwright suite across ~15 flows, visual QA at 9 breakpoints × ~19 screens, RFQ/quotation/ticket E2E coverage, final packaging). This delivery is a real, verified foundation, not a claim of finishing that entire list:

- **RFQ/Monthly Requirement, Ticket Centre, and Vendor Payments/Settlements are not Supabase-backed** (§0b.4). Every RFQ, ticket, and transaction/payout lives only in one browser's `localStorage`, even though the full schema for all of them (`customer_requirements`, `rfq_vendor_invitations`, `vendor_quotes`, `support_tickets`, `vendor_payouts`) already exists in Supabase, migrated and unused. This is the single biggest gap between "the app works in this browser session" and "this is a real multi-user production backend" — see the verdict below.
- **WhatsApp reminder delivery** is not built; payments/WhatsApp remain intentionally simulated per your instruction.
- **Delivery Team visual QA** and the full 9-breakpoint (320/375/390/430/768/1024/1280/1440/1600) screenshot matrix were not run across every screen — only the breakpoints and screens in §8 were checked, plus targeted mobile/desktop checks during rounds 2–3.
- **Cart/test-data residue:** the `customer@sheplates.demo` account's cart, schedules, RFQs and tickets now hold leftover items from three rounds of manual and automated testing against the live Supabase project (harmless, but worth clearing — or resetting via `V3_RESET_TEST_DATA.sql` — before a demo).
- **Six SQL migrations (§5)** must be run for their corresponding fixes to take effect in your live database — the code is correct and degrades gracefully without them, but the underlying features stay broken until they're applied. Two (`V7_6`, `V7_7`) are still pending as of this delivery.

---

## 10. Deployment notes — GitHub + Render

This delivery is a local git repository (not yet pushed anywhere) with 11 commits on top of the original ZIP's baseline commit.

**GitHub:**
```bash
git remote add origin <your-repo-url>
git push -u origin main
```

**Render (or any Node host):**
- Build command: `npm run install:ci && npm run build` (or `npm install && npm run build` if `install:ci`'s coreutils requirement isn't available on the target — this delivery's build was verified with `./node_modules/.bin/vinext build` directly for that reason; confirm `timeout`/`gtimeout` is available on your deploy image, or adjust `scripts/build-verified.sh` if not).
- Start command: `npm run start` (`vinext start`).
- Environment variables: copy your existing `.env.local` values (Supabase URL/anon/service-role keys, `OPENAI_API_KEY`) into Render's environment settings. No new variables are required by this delivery.
- Run the six migrations in §5 against your production Supabase project **before or immediately after** deploying — the app degrades gracefully without them, but the fixed features won't actually work until they're applied.

---

## 11. Production readiness verdict

You asked directly: is this production ready? Honest answer — **conditionally yes for the core commerce loop, no for RFQ/Tickets/Payments as a real multi-user backend.** Specifically:

**Ready for production, verified across three rounds of testing:**
- Customer discovery, search, filters, the interactive nearby-vendors map, categories, She Agent recommendations.
- Add-to-cart, scheduling, payment-gating (a schedule cannot activate before payment — the original bug is fixed and tested).
- Vendor onboarding, verification (Operations/Admin can actually approve vendors now — this was completely broken before round 1), catalogue management, vendor QR deep links.
- Product tours, location autocomplete, Super Admin homepage merchandising.
- The agent chat's data-fetching is measurably faster (parallelized Supabase calls); the underlying multi-round tool-calling loop is unchanged and is the dominant remaining cost on complex questions.
- All of the above: 36/36 Playwright tests green on desktop and mobile, `vinext build` clean, six migrations documented with exact apply-order and current status.

**Not ready as-is — needs a decision from you before launch:**
- **RFQ/Monthly Requirement, Ticket Centre, and Vendor Payments/Settlements are single-browser mock features, not a real backend.** They work perfectly in a demo (which is likely why this wasn't caught earlier) but two different customers, or a customer and a vendor on different devices, cannot actually see each other's RFQs, tickets, or payments — everything lives in one `localStorage` blob. This is not a bug I introduced or need to "fix a symptom of" — it's a scoped feature that was never connected to the already-built Supabase schema for it. Wiring it up is a real, bounded project (the tables, RLS, and even a UI-facing plan-entitlement system are already there — see §0b.2 for the one piece I did wire up this round), not a rewrite.
- **The vendor Premium-plan bug (§0b.2)** — found and fixed this round — means every vendor plan assignment made before this fix, if any exist in your production data, was never actually saved. Worth a quick check of your live `vendors.plan_id` column after deploying this delivery.
- **Two pending migrations** (`V7_6`, `V7_7`) — apply `V7_7` alone (it's a superset of `V7_6`) to get vendor map pins and correct RFQ eligibility working from day one.
- **Payments and WhatsApp remain simulated** per your own instruction from round 1 — this was a deliberate scope decision, not an oversight, but it means no real money moves and no real WhatsApp messages send until those integrations are built.

**Bottom line:** ship the marketplace/ordering/vendor-management core with confidence. Treat RFQ/Tickets/Settlements as a beta/internal feature until it's connected to real, multi-user storage — the current implementation will mislead any two people trying to use it together.
