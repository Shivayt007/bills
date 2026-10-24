# S.A Traders — React Native UI Preview

This folder is a separately installable React Native (Expo SDK 54 / RN 0.81) **UI prototype** based on S.A Traders. It is not yet a production billing replacement.

## Guardrails
- The production S.A Traders 1.8.2 Java + WebView app remains under `android-app/` and is **not modified**.
- Unique Android application ID `com.satraders.billing.preview`; the preview cannot overwrite `com.satraders.billing`.
- The preview currently includes ONLY synthetic data. Customer and bill records displayed are not from Firebase.
- Bills can be searched and demo subtotals calculated, but **no live billing, rental-cycle, invoice export, WhatsApp reminders, notification reading, payment parsing, inventory writes or Firestore writes are connected**.
- Do not use the preview to create actual invoices or make financial decisions.

## Run locally
Node 22+, Java 17, and Android SDK needed for device builds.

```bash
cd react-native
npm install
npm run check
npm run typecheck
npx expo start
```

## APK
Push changes on `feature/react-native-redesign`; GitHub Actions `Build S.A Traders React Native preview APK` generates a **standalone release-mode APK**, signed with the generated development signing certificate (not the production S.A Traders signing key). Download from the run's `S-A-Traders-React-Native-Preview-APK` artifact (ZIP).

## Migration roadmap (before public use)
1. Inventory parity: inspect production JS billing rules, data models and edge cases; write golden-master tests for calculations.
2. Extract pure JS functions for totals, rental cycles, advances, part payments, charges, and invoices into a shared, tested TypeScript business module.
3. Adapt Firestore collection and document-key structure with read-only migration verification before enabling any writes.
4. Port Java payment notification services, background reminders, print/share and WhatsApp flows through dedicated React Native native modules.
5. Verify offline behavior, privacy/security, backup/import, invoicing, and Android permissions on real devices.
6. After equivalence testing, separately plan signed production upgrade. Do not change app ID or signing until approved.

The current preview is an intentionally safe first build, **not** a claim that migration is complete.
