# ShePlates V4.2.0 — Agentic Commerce UI

## What changed

- Rebuilt She Agent as a floating, mobile-first commerce copilot instead of a standard side drawer.
- Added meal/budget/category intent matching and preference-aware recommendation ranking.
- Recommendations now render as product cards with vendor, pack, customer price, protein and one-tap Add.
- Added Add suggested basket, live basket count/value and direct View Cart navigation.
- Added public She Agent preview using the same visual language.
- Live authenticated customer-agent context now includes the serviceable nearby marketplace via `marketplace_menu_nearby`.
- Preserved explicit customer/operations approval for checkout, payments, refunds and other sensitive actions.

## Suggested customer tests

1. `Plan a healthy breakfast basket under ₹300`
2. `Recommend groceries under ₹500`
3. `Suggest milk, eggs and vegetables for this week`
4. Tap `+ Add` on a recommendation and confirm the basket value updates.
5. Tap `Add suggested basket`, then `View` to open Cart.
6. `Add milk`
7. `Track my next order`
8. Raise a food-quality complaint and attach a photo to confirm Operations review remains the final step.

## Validation performed

- TypeScript transpile syntax check: zero syntax errors for the modified TSX/API files.
- `node --test tests/v2-contract.test.mjs`: 12/12 tests passing.
- Full dependency build was not executed in the sandbox because dependency installation timed out; run `npm ci` and `npm run build` in your normal development environment before deployment.
