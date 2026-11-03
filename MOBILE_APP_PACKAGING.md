# ShePlates mobile-store path

The v6 UI is intentionally structured so the current responsive web application can become the basis of the Android and iOS apps instead of creating a second UI codebase.

## Recommended later path

1. Keep the web application as the single product UI and API surface.
2. Wrap the production web build with a native container such as Capacitor when store packaging begins.
3. Replace browser-only notification handling with native push notification integrations inside the mobile wrapper.
4. Configure native deep links for order, payment, notification, and support destinations.
5. Configure native permission descriptions for camera/photo upload, location, and notifications.
6. Generate store-specific adaptive icons, splash assets, screenshots, privacy declarations, and signing credentials.
7. Test payment behavior against Apple/Google store rules before submission; physical-goods commerce can generally continue to use the business payment flow, but the final implementation should be reviewed at submission time.

## Already prepared in v6

- Mobile-safe responsive layout
- Bottom navigation for customer workflows
- Full-screen mobile She Agent
- Off-canvas staff navigation
- Safe-area padding
- Standalone PWA metadata
- App icons and maskable icon
- File/camera-friendly upload controls
- Location-aware layouts
- Touch targets sized for phones

No Capacitor dependency is added in this release so the existing Render deployment remains unchanged. Add the native wrapper only when you are ready to produce Android/iOS binaries.
