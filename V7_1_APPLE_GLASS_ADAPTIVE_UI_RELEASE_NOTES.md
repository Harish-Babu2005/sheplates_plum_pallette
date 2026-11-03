# ShePlates v7.1.0 — Adaptive Glass UI

This is a **visual-only** release built on v7.0.0. No commerce, authentication, payment, Supabase, She Agent business logic, role permissions, navigation concepts, order flows, scheduling logic, or database behavior was changed.

## What changed

- Preserves the existing ShePlates logo asset exactly as-is.
- Adds an adaptive Apple-inspired glass material for dialogs, sheets, dropdowns, notifications and floating navigation.
- Keeps primary content cards more opaque for readability instead of applying glass everywhere.
- Refines web header, marketplace toolbar and staff navigation with lighter translucent materials.
- Converts the mobile customer navigation into a floating glass dock while retaining the same five navigation actions.
- Replaces the She Agent sparkle/bot-style launcher mark with a neutral **orbital line icon** and a floating glass launcher.
- Opens She Agent as a rounded floating glass workspace on mobile rather than a hard full-screen slab, while retaining the same prompts, messages, tools and actions.
- Keeps v6.2.1 portrait popup positioning and safe-area behavior, then applies glass styling on top.
- Adds graceful opaque fallbacks for browsers that do not support backdrop-filter.

## Responsive behavior

- **Phone:** 44px+ touch targets, portrait-safe bottom sheets, safe-area-aware bottom dock, single-column marketplace on narrow phones, floating She Agent sheet.
- **Tablet:** responsive customer/staff layouts and glass toolbar/navigation hierarchy.
- **Desktop/Web:** lighter app chrome, translucent marketplace toolbar, floating She Agent panel, readable solid commerce cards and tables.

## Deployment

No new SQL migration is required. Deploy exactly like v7.0/v6.2.1: copy the files over the existing Git-connected project (excluding `.git`, `node_modules`, build output and `.env.local`), commit and push.
