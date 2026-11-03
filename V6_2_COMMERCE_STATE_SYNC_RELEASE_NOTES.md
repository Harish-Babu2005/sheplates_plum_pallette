# ShePlates v6.2.0 — Commerce State Sync Fix

This release fixes the customer commerce-state split found during live testing.

## Fixed

- Cart is now account-backed in live mode instead of being only browser-local state.
- Marketplace Add, She Agent basket actions, Cart quantity changes and removals all persist to the same draft cart.
- She Agent now sees the same saved cart that the Cart screen displays.
- She Agent cannot claim an item was added without returning validated product IDs for the app to persist.
- Cart checkout now creates real pending live orders before payment instead of creating a browser-only placeholder order.
- Multi-vendor carts are separated into one pending order per vendor at checkout.
- Paid/confirmed historical orders remain visible even when older payment rows are incomplete; progressed order status is used as a safe compatibility signal.
- Payment status scanning checks all payment rows instead of assuming the first nested payment row is the latest.
- Previous-order context now includes ordered food names, quantities and prices so She Agent can answer purchase-history questions naturally.
- `next`, `latest`, and recent order lookups use proper date/history ordering.
- Paid recurring deliveries continue to drive My Schedule.
- One-time cart purchases go to Orders after payment; scheduled recurring purchases go to My Schedule.

## Database

No new migration is required. The release uses the existing `commerce_carts` and `commerce_cart_items` tables introduced in the V4 upgrade.

## Regression coverage

A new `tests/v6_2-commerce-sync.test.mjs` contract verifies saved-cart persistence, live checkout conversion, historical order restoration and She Agent/cart unification.
