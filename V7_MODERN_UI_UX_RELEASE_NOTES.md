# ShePlates v7.0 — Modern UI/UX Refresh

This release is intentionally visual-only. Commerce flows, Supabase calls, She Agent tools, role permissions, payment behavior, schedules, orders, cart state and business rules are unchanged.

## Design direction

- Modern hyperlocal-commerce visual language inspired by current delivery and quick-commerce interaction patterns without copying another brand's trade dress.
- Warm orange is now the primary action color; green remains a trust/health/serviceability accent.
- Cleaner white/neutral surfaces, lighter borders, reduced shadow noise, consistent 14–22 px radii, and stronger information hierarchy.
- Customer mobile navigation is now a light floating tab bar with persistent labels and a distinct She Agent entry.
- Marketplace uses compact category chips, denser discovery/search, clearer product cards, and a stronger Add/Plan action hierarchy.
- Vendor, Operations and Super Admin keep their existing information architecture but use a cleaner modern dark rail, refined metrics, forms, tables and status treatments.
- Dialogs, sheets, authentication, notifications and She Agent share the same visual system and preserve the v6.2.1 viewport fixes.
- Touch targets are kept at 44 px minimum on mobile.
- Reduced-motion users get transitions effectively disabled.

## Logic safety

No files under `lib/`, `app/api/`, `supabase/`, `db/`, or `worker/` were modified for this visual release.
