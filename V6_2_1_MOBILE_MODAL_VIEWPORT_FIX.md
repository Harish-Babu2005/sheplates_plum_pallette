# ShePlates v6.2.1 — Mobile modal viewport fix

This patch fixes portrait-mobile popups that could render partly outside the visible viewport and only become usable after rotating the phone.

## Fixes
- Dialogs are anchored directly to the mobile visual viewport (`inset: auto 0 0 0`) rather than depending on 50% translation on small screens.
- Mobile dialog width now comes from left/right viewport edges rather than `width: 100%`, avoiding WebKit/Chromium resize edge cases.
- Dialogs and sheets use explicit mobile z-index 90/91, above the customer bottom navigation (z-index 58).
- Payment, sign-in, schedule, location, product and admin dialogs can scroll vertically inside the visible `100dvh` area.
- Sheets use the same viewport-safe horizontal anchoring.
- The authentication dialog keeps its keyboard-friendly top layout while using viewport edge anchoring.

No database migration is required.
