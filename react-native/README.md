# S.A Traders — Native Lab (React Native, no WebView)

This branch now runs **real native React Native components** for the UI, using its own TypeScript rental calculations and persistent on-device test data. It does **not** launch the original Java WebView app, show a website, or reuse the old Android Activity.

## Implemented in React Native
- Interactive native dashboard based on local invoices and collections
- Create/edit rental bills with the original material fields and rates, wood size syntax, transport, 15/20/30-day cycles, advance deposit
- Accrued cycle calculation, basic rental return/addition (material quantity), payment entry, close bill
- Local customer add/edit and directory search
- Local master inventory entry and a **rough** rented-stock view
- Basic on-device reports, local payment history, plain-text invoice sharing
- Delivery slips and challan local notes, local JSON export through Android share sheet
- On-device persistence with AsyncStorage 2.2.0
- Basic static CI checks and TypeScript validation

## Deliberately not represented as complete
Do **not** deploy this build to replace the operational v1.8.2 app. It does **not** yet match every original route, calculation edge case or button. Not migrated: authenticated Firestore synchronization/guarded writes, split receipts, multi-cycle payment allocations, production PDF/image invoice printing, local backup import, notification listener, WhatsApp reminders, native notification routes, advanced custom shop bill rules, wood returns/additions, full admin/roles and parity-verified inventory. The new local storage is not the production database.

**Security:** The original repository Firestore rules allow unauthenticated reads and writes. The earlier client-only app lock is not adequate security for a live production app; implement server-enforced Firebase Authentication and Firestore rules before enabling live data in this new client.

## Build / install
The application ID is \`com.satraders.billing.preview\` to avoid replacing the production app.

\`\`\`sh
cd react-native
npm install
npm run check
npm run typecheck
npx expo prebuild --platform android --no-install --clean
cd android && ./gradlew :app:assembleRelease
\`\`\`

Build workflow: \`.github/workflows/build-react-native-preview.yml\` publishes \`S-A-Traders-Pure-React-Native-Lab-APK\`.

## Production migration checklist
- Port and test EVERY feature/route against \`main\`, including the latest JS overrides.
- Parity-test real and synthetic rental-cycle scenarios and historical transactions.
- Add secure user auth and server-side permission rules.
- Migrate the original Firestore data and audit identifiers safely.
- Port native services to Expo modules/React Native Android modules.
- Test real devices, Android 8+ through 16, backup restore, offline/online, and repeatability.
- Keep release signing and applicationId the same **only after** the app passes parity, security, and upgrade tests.
