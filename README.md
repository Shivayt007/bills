# S.A Traders Flutter Billing App

This branch replaces the JavaScript/WebView application with a native Flutter UI. Screens, billing calculations, persistence, reminders, invoice generation, and sharing are implemented in Dart. The Android Kotlin `MainActivity` is only Flutter's standard launcher host; it contains no billing logic.

## Preserved Firestore layout

The app reads and writes the existing path `sa_traders/business/{collection}/{document}` and retains the existing collections and key fields: `bills/bill_no`, `customers/mobile`, `customBills/bill_no`, `slips/slip_no`, `challans/challan_no`, `inventory/item`, and `settings/key`. Existing Firestore records are not migrated or renamed. The Dart hydrator derives cycle totals and balances using the same source formulas; it does not write those derived values back into existing bills.

## Firebase setup

1. The Android package stays `com.satraders.billing`; the existing Firebase project configuration is included at `android/app/google-services.json`.
2. In Firebase Console, enable **Email/Password** under Authentication and create the shop account. The old local `admin / shiva` app lock is intentionally replaced by Firebase Authentication.
3. For administrator-only UI actions, set the Firebase Auth custom claim `admin: true` for the shop user with a trusted Firebase Admin SDK environment.
4. Review and deploy `firestore.rules`. It blocks unauthenticated access while preserving the existing business path. This is a single-business account boundary; use stricter rules before adding multiple shops or roles.
5. Run `flutter pub get`, then `flutter run` or `flutter build apk --release`.

The repository's existing Google Services file configures Android only. iOS has intentionally not been scaffolded because the source app and existing Firebase registration are Android-focused.

## Background reminders and payment detection

Daily reminders use Workmanager and `flutter_local_notifications`. The app refreshes the on-device reminder snapshot while signed in; background reminders use the last snapshot available on this phone. Android notification permission is requested by the app. Payment detection is optional and requires the user to enable notification access in Android settings; parsed payment notices remain suggestions and are never recorded without manual confirmation.

WhatsApp reminders open WhatsApp with a previewed message using `url_launcher`. The user reviews and sends the message. The standalone `whatsapp-reminders/` Node service is left intact in the repository for users who prefer that transport; this Flutter build does not embed its bearer token or send messages silently.

## Tests and CI

`tests_flutter/billing_calculator_test.dart` contains parity fixtures based on the legacy JavaScript engine for rent totals, first-cycle transport, cycle dates, pending balance, and return effective-cycle behavior. `.github/workflows/flutter-native.yml` formats, analyzes, runs Flutter tests, and builds a release APK on the `flutter-native-port` branch.
