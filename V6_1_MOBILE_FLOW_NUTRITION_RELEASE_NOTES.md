# ShePlates v6.1.0 — Mobile Flow + Nutrition Fixes

This release is a production bug-fix pass based on live mobile testing at `app.sheplates.com`.

## Customer mobile fixes

- Customer sign-in / sign-up modal now stays usable when the iOS/Android keyboard opens.
- Username, password, email and verification-code fields scroll into view on focus.
- Auth inputs use mobile-safe 16px text to prevent browser zoom and have explicit high-contrast backgrounds/text.
- On very narrow phones the marketplace changes to one product per row so Add / Plan actions no longer overlap or clip.
- Search/filter toolbar is compacted for mobile.
- Mobile bottom navigation is hidden while Notifications is open so the sheet no longer collides with navigation.
- Notification sheet uses mobile safe-area height/padding.

## Schedule / payment corrections

- A schedule is considered active only after its checkout payment is marked Paid.
- After successful payment the customer is sent directly to My Schedule.
- My Schedule uses paid delivery orders as the authoritative source, so a paid schedule remains visible even if the schedule definition is temporarily stale/missing from the client snapshot.
- Recurring schedules generate their real delivery dates. The displayed count, total cost and schedule calendar use those generated dates rather than fixed assumptions such as 30 days.
- The calendar aligns dates to actual weekdays and shows paid delivery occurrences on the correct dates.
- Pending schedules stay in Cart / awaiting-payment state and do not appear as active schedules.

## Nutrition workflow

Nutrition is no longer mandatory for publishing a product.

- Vendors may publish a valid sellable product even if nutrition has not been supplied or cannot be estimated reliably.
- Such products are marked **Nutrition pending** rather than displaying misleading `0 kcal` values.
- Operations receives a nutrition-review notification for a newly published product whose nutrition is missing or needs review.
- She Agent does not treat missing nutrition as zero calories and excludes pending-nutrition products from explicit low-calorie filtering/ranking.
- Nutrition calculation accepts optional package-label text, recipe/ingredient details, and a nutrition-label image.
- The assistant is instructed to estimate the exact selling pack only when the provided information supports a reasonable estimate.
- Generic hard-coded food nutrition fallbacks have been removed from the active product publishing path.
- If an estimate is unavailable, the vendor can continue publishing and Operations can review it later.

Nutrition states are:

- `verified` — vendor confirmed against package label / recipe.
- `estimated` — assisted estimate is internally consistent but not vendor-verified.
- `pending_review` — absent, inconsistent or insufficient information; product publication is still allowed.

## Database migration

Run after the existing v5 production hardening migration:

```sql
supabase/V6_1_MOBILE_NUTRITION_FLOW.sql
```

It adds the nutrition status, confidence and note fields used by the production review workflow.

## Deployment

This is an incremental release over v6.0.0. Existing application credentials and Render deployment settings remain unchanged.

Recommended Git commit:

```text
ShePlates v6.1 mobile flow and nutrition fixes
```

## Validation performed

- 90 TypeScript/TSX source files parsed with zero syntax diagnostics.
- 47/47 targeted regression / contract tests passed.
- Includes new regression coverage for mobile auth, marketplace action layout, paid-schedule visibility, actual recurring delivery dates, optional nutrition + Operations escalation, and low-calorie filtering of pending nutrition.

A full dependency-backed browser/e2e build was not run in this sandbox; run the normal production build in Render / your local environment after pushing.
