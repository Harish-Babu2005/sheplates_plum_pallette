# ShePlates v4.6.0 — Agentic Marketplace Release

This release restructures the customer experience around a clean marketplace and upgrades She Agent into an OpenAI-first, Supabase-grounded commerce copilot with controlled durable preference memory.

## Customer marketplace

- Removed the permanent customer sidebar. Customer navigation is now marketplace-first.
- Account / Profile & Food, Orders, My Schedule, Monthly Requirement and Ticket Centre are grouped under the customer account menu in the top bar.
- My Quotations, Notifications and Cart are top-bar icons with counters.
- Replaced the large marketplace hero banner with a dismissible recommendation panel.
- The recommendation panel asks She Agent for grounded OpenAI recommendations and revalidates returned product IDs against the currently serviceable marketplace before display. If OpenAI is unavailable, a deterministic grounded fallback is used.
- Marketplace KPIs were removed from the shopping screen and customer order KPIs are kept in Orders.
- Search now supports product, category, vendor and dietary terms.
- Filters include planning start date, planning period (1 / 7 / 14 / 30 days), max budget, max calories per pack, minimum protein, dietary tags and sorting by recommendation, price, protein, calories or distance.
- Product cards expose price, serving pack, nutrition, distance, cart and scheduling actions.
- Super Admin featured products can appear before algorithmic recommendations.

## She Agent / OpenAI grounding

- Natural-language shopping is OpenAI-first for recommendations and planning.
- Live requests are grounded from the signed-in user's RLS-authorised Supabase context rather than trusting browser-supplied tenant data.
- Customer context includes profile preferences, durable She Agent memory, schedules, orders, RFQs and the live `marketplace_menu_nearby` catalogue.
- Vendor context includes only the signed-in vendor, its catalogue, fulfilments, delivery staff and RLS-visible RFQ opportunities.
- Operations / Super Admin context remains platform-authorised.
- Model-selected product IDs are revalidated in the browser against current marketplace availability and budget before they are shown or added.
- Financial, cancellation, refund, verification and other sensitive actions remain human-confirmed.

## Controlled preference memory (MCP-ready memory control plane)

- Added `customer_ai_memory` with RLS ownership by the customer.
- She Agent can write only whitelisted, non-sensitive durable commerce preferences such as typical budget, dietary preference, favourite categories/products, calorie target, protein preference and delivery window.
- One-off prompts are not intended to become durable memory unless the user clearly states a stable preference.
- Sensitive attributes, payment data and precise location are explicitly excluded from learned memory.
- Customers can inspect the currently learned memory from Profile & Food and clear it at any time.
- This is implemented as a controlled Supabase memory layer that is ready to be exposed through an MCP server later if external agents/tools need the same governed memory interface. This package does **not** claim to run a standalone MCP protocol server.

## AI across the portfolio

- Customer: personalised marketplace recommendations + natural She Agent.
- Vendor: new **AI insights** workspace for stock, fulfilment, delivery and RFQ priorities.
- Vendor catalogue: OpenAI nutrition estimation remains vendor-reviewed.
- Vendor product media: upload a real product photo, optionally use OpenAI image enhancement, review the result, then publish it.
- Operations: AI insights across authorised operational signals.
- Super Admin: executive AI insights, homepage merchandising and AI-assisted campaign strategy.

## Vendor product image flow

- Added product image upload support.
- Added `/api/image-enhance` for vendor/admin-authorised OpenAI image enhancement.
- Enhancement prompt is constrained to preserve actual product identity, pack, visible quantity and truthfulness; it should improve only presentation such as lighting, framing and background.
- In live mode the selected/enhanced image is uploaded into a `product-images` Supabase Storage bucket and only the URL is stored on `vendor_menu_items.image_url`.
- The vendor must review the image before publishing.

## Super Admin merchandising & campaigns

- New **Homepage & campaigns** workspace.
- Super Admin chooses featured customer-marketplace products and enables/disables the recommendation popup.
- Super Admin can create campaign drafts manually.
- AI can analyse authorised commerce behaviour and suggest responsible campaign concepts.
- Campaign segmentation is instructed to use non-sensitive commerce behaviour only (category affinity, recency, frequency, budget band, inactivity, etc.).
- Campaigns remain Draft / Active / Paused under explicit human control. This package does not automatically message customers or charge anything.

## Required Supabase upgrade

For an existing ShePlates database, run this file once in the Supabase SQL Editor after the prior packaged migrations:

`supabase/V4_6_AGENTIC_COMMERCE.sql`

It adds:

- `customer_ai_memory`
- `platform_settings`
- `marketing_campaigns`
- `vendor_menu_items.image_url`
- `product-images` Storage bucket and policies
- RLS policies for the new tables / storage workflow

## Environment variables

For full live AI behaviour:

```env
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-mini
OPENAI_IMAGE_MODEL=gpt-image-2
```

Do not expose `SUPABASE_SERVICE_ROLE_KEY` or `OPENAI_API_KEY` to browser code.

## Validation performed in this environment

- Parsed all project TypeScript / TSX source files with TypeScript transpile diagnostics: zero syntax errors.
- Ran the existing ShePlates contract suite, natural-language agent regression test and the new v4.6 agentic-marketplace regression tests: 17 / 17 passed.
- A full dependency-backed Vite production build was not run in this sandbox because `node_modules` is not installed here. Run `npm ci` and `npm run build` on your development / CI machine before production deployment.
