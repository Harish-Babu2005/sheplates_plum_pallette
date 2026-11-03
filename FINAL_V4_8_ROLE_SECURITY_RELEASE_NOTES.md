# ShePlates v4.8.0 — Final Role-Secured She Agent

This release hardens She Agent around the signed-in role. Natural conversation remains model-driven; role permissions are enforced before authorised data is supplied to the assistant.

## Role boundaries

- **Customer** — only the signed-in customer's preferences, learned shopping preferences, basket, schedules, orders, requirements, published quotations, tickets, and serviceable marketplace products.
- **Vendor** — only the signed-in vendor's store, catalogue, stock, own orders, delivery staff, invited RFQs, submitted quotations, payouts, and tickets.
- **Operations** — authorised cross-platform operational data for customers, vendors, products, orders, fulfilment, requirements, cancellations, payments, payouts, and tickets. Governance-only campaign/settings/audit context is excluded from She Agent.
- **Super Admin** — the Operations scope plus governance context such as campaigns, platform merchandising settings, vendor plans, audit history, and assistant-action history.

## Security changes

1. The server verifies the current authenticated user and reads the actual role from the account profile. A role sent from the browser is ignored in live mode.
2. Production She Agent requires a verified session. Browser-provided role/context is accepted only when explicit demo mode is enabled.
3. Customer queries use explicit customer-id filters in addition to data-level access policies.
4. Vendor RFQ opportunities are built from invitations for that exact vendor rather than from a broad requirements query.
5. Vendor product/order/payout/ticket context is explicitly filtered to the vendor account.
6. Operations and Super Admin now receive different assistant scopes.
7. Super Admin-only campaign strategy is blocked for every other role at the server endpoint.
8. Non-customer roles cannot return customer basket/product-action arrays even if a model response attempts to do so.
9. Quality-review context no longer trusts arbitrary order details sent by the browser. The requested order must match an order in the role's authorised records.
10. Customer memory writes remain restricted to an allow-list of non-sensitive commerce preferences.

## Database migration

For an existing v4.6/v4.7 database, run:

`supabase/V4_8_ROLE_AGENT_SECURITY.sql`

It narrows platform-setting reads to marketplace merchandising for normal signed-in users and makes campaign records Super Admin-readable only.

## Production configuration

Keep demo mode disabled in production. A production session must be authenticated before She Agent will return account data.

## Validation

The package includes a regression test that checks role verification, scope separation, vendor RFQ filtering, task permissions, production session enforcement, and customer-only commerce actions.
