# S.A Traders — React Native v0.3.0

Fully native Expo/React Native Android client, extended from `feature/react-native-redesign` and audited against the original `app.js`. Separate package `com.satraders.billing.preview` keeps the original installed ledger available during acceptance testing. No production credentials are embedded.

## Run and verify

Node 22+, Java 17. `npm ci`, `npm run typecheck`, `npm run check`, `npm test`. `npx expo prebuild --platform android --clean`, then `cd android && ./gradlew :app:assembleRelease`. GitHub Actions builds the standalone APK and uploads it as `S-A-Traders-React-Native-v0.3.0-APK`.

## Workflows

- Rental bills, customers, custom rates, 15/20/30-day inclusive cycles, first-cycle handling, security deposits, material and variable-length wood returns/additions, physical outstanding, bill closure/deletion.
- Native Custom Shop bills with automatic advance and one-time professional conversion.
- Cycle-specific Cash/UPI/Bank payments, legacy unassigned payments preserved, intentional duplicate confirmation, visible overpayments, PIN-protected audited payment deletion.
- Detected payment review and split receipts across customer bills/cycles. Two-step review, integer paise validation, remainder credit, receipt correction and audit. No detected payment is automatically recorded.
- JSON document picker, import preview, merge/replace, safety copy and full export preserving original collection and nested field names.
- Standard/cycle/next-cycle/customer/custom PDF generation, native print, Android file sharing including WhatsApp. Next cycle is an estimate, not a saved charge.
- Android notification listener and original daily WorkManager reminder engine; access and notification permissions are user granted. Recomputed projections sync after local changes. Use More → Reminders to enable. The worker uses the last synced ledger; another device's changes require a cloud pull.
- Optional Firebase email/password sign-in and explicit pull/publish. Publishing compares touched documents with the last cloud snapshot in a transaction; conflicts abort. At most 400 changed records. Cloud deletions are intentionally disabled. Use a test project and deploy authenticated role rules before live use. No automatic production connection.
- Existing WhatsApp reminder service setup, status/pairing and message review. Bearer token in SecureStore; API acceptance does not establish delivery. Keep the same request ID after uncertain sends.

## First use

Set a 6–12 digit admin PIN under More. Import a copy of the existing JSON backup. Reconcile bills, physical quantities, deposits and payments with the original app. Test printing, notification access and reminders on your phone. Export backups before clearing app storage or uninstalling. PIN is device-local and is not a substitute for Firebase security rules.

## Verification boundaries

Automated financial comparisons cover 450 synthetic bills across all cycle lengths (3,168 comparison/assertion checks), including history snapshots, custom totals, conversions, rounding and split receipt operations. This does not certify every historical customer record or device integration. Physical-device notification, pairing, printing, signed upgrade and live Firebase tests remain required.

Current limitations: issued PDFs/images recalculate from current history; there is no immutable invoice archive. Delivery/return slips and challans have native forms with original field names. Firebase users/roles are managed server-side, not through the original fixed client-password login. No background live cloud synchronization; pull/publish is explicit. Local backup merge uses incoming fields for matching identifiers—review before import. Firebase sign-in uses an in-memory session; sign in again after an app restart. See `docs/REACT_NATIVE_VERIFICATION_20261025.md` and the baseline source audit for the full risk and parity notes.
