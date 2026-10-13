# S.A Traders v1.7.0 performance update

This release keeps the existing screens, routes, invoice layouts, and billing/material calculations while replacing navigation-time database reads with a warm local data layer.

## Changed files

- `app/src/main/assets/firebase-db.js` — app-wide store cache, optimistic writes, manual refresh, Base64 bridge payloads, and Firestore timing logs.
- `app/src/main/assets/app.js` — startup cache load, per-bill hydration cache, skeleton state, chunked dashboard/customer lists, batch bill saves, refresh controls, and render timing logs.
- `app/src/main/assets/reference-ui.js` — chunked Bills list without changing search or status filters.
- `app/src/main/assets/ui-2026.js` — chunked Dashboard list and cached bill details.
- `app/src/main/assets/ui-fixes.js` — cached hydrated bill details.
- `app/src/main/assets/invoice-2026.js` — cached bill data for invoice rendering.
- `app/src/main/assets/next-cycle-2026.js` — cached bill data for next-cycle invoices.
- `app/src/main/assets/notifications-2026.js` — debounced, event-driven reminder syncing; navigation and visibility triggers removed.
- `app/src/main/assets/invoice-share.js` — loads html2canvas only when image sharing is requested.
- `app/src/main/assets/index.html` — one bundled stylesheet and no eager html2canvas load.
- `app/src/main/assets/app.bundle.min.css` — merged/minified styles with expensive blur, stacked shadows, and `transition: all` removed; content containment added.
- `app/src/main/java/com/satraders/billing/FirebaseBridge.java` — cache-first Firestore reads, background server refresh, change-only JS pushes, off-main-thread conversion, compact payloads, and batch writes.
- `app/src/main/java/com/satraders/billing/MainActivity.java` — Firestore offline persistence, unlimited disk cache, WebView hardware acceleration, and `LOAD_DEFAULT` cache mode.
- `app/src/main/java/com/satraders/billing/BillingReminderWorker.java` — restores Android background reminder delivery.
- `app/src/main/java/com/satraders/billing/InvoiceFileProvider.java` — preserves secure invoice image sharing.
- `app/src/main/AndroidManifest.xml` and `app/src/main/res/xml/invoice_paths.xml` — hardware acceleration, reminder permissions, WhatsApp visibility, and secure cached invoice files.
- `app/src/main/res/values/styles.xml` — preserves the current light app/window theme.
- `app/build.gradle` and root `build.gradle` — v1.7.0, Firebase/Work/WebView dependencies, Google Services, and packaging only the single CSS bundle plus required scripts.
- `app/google-services.json` — Firebase project configuration for `com.satraders.billing`.

## Verification

- All JavaScript files pass `node --check`.
- Normal route rendering calls only the in-memory cache after startup.
- Hydration fingerprints reuse unchanged bill calculations and recalculate changed bills only.
- Reminder syncing occurs after startup cache load, bill/payment writes, and reminder setting changes.
- The GitHub Actions Android build produces the debug APK with Java 17 and Android SDK 35.
