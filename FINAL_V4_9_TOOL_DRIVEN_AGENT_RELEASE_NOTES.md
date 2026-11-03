# ShePlates v4.9.0 — Tool-Driven She Agent

## Why this release exists
The previous one-shot commerce agent could sometimes return an incomplete structured response even when a model request succeeded. The UI then showed a generic retry message for natural questions such as “what low calorie food is available near me?”.

This release restores the architecture that made the earlier private agentic-commerce prototype effective: the model interprets the customer naturally and chooses role-scoped ShePlates business capabilities at runtime.

## Commerce agent flow
1. Verify the signed-in account and role.
2. Give the model only business capabilities allowed for that role.
3. Let the model decide which capability it needs from the user’s natural wording.
4. Execute the capability against the already-authorised live ShePlates data for that request.
5. Return the result to the model.
6. Repeat for additional tool calls if needed.
7. Return a structured, grounded customer response and validated product IDs.

There is no keyword/regex intent router for customer language.

## Customer business capabilities
- `search_catalogue`
- `get_customer_context`
- `get_current_cart`
- `build_cart`
- `get_order_history`
- `get_order_status`
- `get_schedules`
- `get_quotations`

`build_cart` is read-only: it validates current availability/prices and calculates a proposal. Checkout/payment remain customer-confirmed.

## Other roles
Vendor receives tools scoped only to its own store/catalogue/orders/RFQs/payouts. Operations receives authorised operational tools. Super Admin receives the Operations set plus governance/campaign tools.

## Concrete bug fixed
The app calls the model endpoint through raw HTTP. The old code relied primarily on a convenience `output_text` field. This release also parses the canonical response `output` message/content items and handles refusals/incomplete output explicitly.

## Model configuration resilience
The configured model remains controlled through the server environment. If an older configured model rejects the modern tool/structured-output request, the commerce runtime can retry with the current low-cost compatible default.

## Database changes
No new migration is required for v4.9.0. It uses the existing ShePlates schema and the v4.6/v4.8 security/memory migrations.

## Validation performed
- 92 TS/TSX files syntax-parsed successfully.
- 28 targeted regression/contract tests passed.
- Tests cover natural-language routing, role isolation, business-tool chaining, raw response extraction, marketplace grounding, memory controls, and existing V4 contracts.

Before production deployment, run the normal dependency install and full build on the deployment machine.
