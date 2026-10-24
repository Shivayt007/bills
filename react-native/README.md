# S.A Traders — full-function hybrid React Native branch

This branch combines a **native React Native launcher / navigation interface** with the **existing production Java + Android WebView business engine**. This is an integration migration, **not** a full rewrite of every billing screen into React Native views.

## Why this approach
The production S.A Traders 1.8.2 includes rental-cycle invoices, customer workflows, Firebase Firestore synchronization, guarded writes, payment detection, notifications, backups, printing, WhatsApp sharing, slips, challans, and more. Blindly rewriting this mature logic risks changing accounting results.

The GitHub build runs Expo prebuild and then \`scripts/integrate-existing-app.cjs\`, which copies the original Java sources and production web assets into the new Android binary. Native shortcuts open the original Java WebView activity on its existing hash routes. The original JavaScript login/authentication gate and existing buttons remain in place.

## Implementation details
- React Native 0.81.5 / Expo SDK 54
- React Native navigation/launch page, ~16 shortcuts, with no fabricated demo bills
- The full production WebView app and original Java bridge (Firebase, payments, WhatsApp, print/export/backup and background reminders)
- Same Firestore project and schema; generated Firebase client entry is adapted to preview Android application ID
- Preview APK ID \`com.satraders.billing.preview\`, distinct from original \`com.satraders.billing\`; it can install alongside production
- Existing \`main\` branch, Android app, HTML/JS, production signing and Firebase collections are not modified

**Data caution:** Because the hybrid version connects to the existing Firestore project, creating/editing/deleting actual bills from the preview can affect real data. Back up your data before using it and do parity tests before production rollout.

## Build
\`\`\`
cd react-native
npm install
npm run check
npm run typecheck
npx expo prebuild --platform android --no-install --clean
node scripts/integrate-existing-app.cjs
cd android && ./gradlew :app:assembleRelease
\`\`\`
The GitHub Action produces an installable release-mode APK using the generated Android signing config. It **does not use the production release signing identity** and does not directly update the existing production installation.

## Migration status
| Capability | Current approach |
| --- | --- |
| All existing web app screens and JS workflows | Bundled from production verbatim |
| Java Firebase/notification/payment/WhatsApp/print/backup bridge | Bundled into new Android package |
| React Native home + shortcuts | Native |
| Full screen-by-screen RN replacement | Not completed |
| Live device parity testing of all interactions | Not completed |
| Replacement for production signed APK | No |

## Before release
Test login, create/edit/return invoices, custom bills, guarded payments, printing and WhatsApp, offline and online Firestore, file sharing and restore, material movements, notification access, reminders, settings, and app restart. Make backups. Firestore project access restrictions and payment-listener permissions may behave differently under the new package and signing certificate.

This hybrid build prioritizes **preserving functionality** over prematurely claiming a fully native migration.
