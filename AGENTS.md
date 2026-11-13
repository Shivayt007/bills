# S.A Traders repository instructions

Before modifying a feature, read `README.md` and relevant source/tests. `lib/` and `android/` are the current Flutter Android product; the JavaScript web app, `android-app/` and `whatsapp-reminders/` are separate runtimes.

For **every repository update**, update `README.md` in the same change. Keep shipped status, screen flow, Firestore collections/fields, financial rules, setup/build steps, roadmap and documentation changelog consistent with code. For maintenance-only changes, add a short changelog note and adjust any affected setup instructions. Never label a planned feature as shipped before implementation and verification.

Preserve old Firestore compatibility and calculation parity unless a request explicitly changes a business rule. Add focused tests for money, dates, inventory and cross-bill behavior as appropriate. Verify format, analysis, tests and any requested signed APK build. Never commit passwords, signing keys, service tokens or private customer records.
