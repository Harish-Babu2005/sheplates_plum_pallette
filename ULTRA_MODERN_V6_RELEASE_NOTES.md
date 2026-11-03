# ShePlates v6.0.0 — Ultra Modern Mobile-First UI

This release is a design-system and responsive-experience upgrade built on top of the production-hardened v5 application. Business logic, role security, commerce tools, data model, and the existing production migrations are preserved.

## Experience direction

- Mobile-first application shell designed to feel like a native commerce app.
- Desktop remains spacious and operationally efficient rather than simply stretching the mobile design.
- Consistent visual language across Customer, Vendor, Operations, and Super Admin experiences.
- Warm premium food-commerce palette: ivory surfaces, deep ink navigation, fresh green primary actions, coral commerce accents.
- Stronger hierarchy, clearer typography, larger touch targets, safer contrast, and less visual noise.

## Customer experience

- Native-style five-item mobile bottom navigation: Explore, Orders, She Agent, Cart, Account.
- Customer account functions become an app-style bottom panel on mobile.
- Notifications remain immediately accessible from the compact top bar.
- Marketplace search/filter surface becomes sticky so discovery stays available while scrolling.
- Product browsing is two-column on phones and scales progressively to larger grids.
- Product cards use stronger image treatment, compact pricing, nutrition chips, and touch-friendly cart/schedule actions.
- AI recommendations become a horizontally scrollable mobile card rail and retain the dismiss/refine behavior.
- She Agent opens as a full-screen assistant on phones and a premium floating panel on larger screens.

## Vendor / Operations / Super Admin

- Mobile navigation is a proper off-canvas drawer with backdrop and close control.
- Opening the mobile drawer always restores labels even when the desktop sidebar had been collapsed.
- Desktop sidebar remains collapsible for high-density operational work.
- Shared cards, metrics, forms, select controls, dialogs, sheets, and tables receive one consistent visual system.
- Dialogs become bottom app sheets on mobile; large forms remain scroll-safe.
- Notifications become a mobile bottom sheet.
- Dense tables remain horizontally scrollable while preserving readable touch targets.

## Mobile application readiness

- Safe-area support for iPhone/Android devices with display cutouts.
- `100dvh` handling for mobile browser chrome and installed-app viewports.
- Updated standalone web-app manifest.
- Dedicated 192px, 512px and maskable application icons plus Apple touch icon.
- `viewport-fit=cover` metadata and standalone Apple web-app metadata.
- Updated service-worker shell cache and notification icons.

No new database migration is required specifically for this UI release. Keep all migrations required by v5.
