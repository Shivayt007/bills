# React Native implementation and verification — 25 October 2026

This document supplements `SA_TRADERS_SOURCE_AUDIT.md`. That 32-chapter file is the **pre-change baseline**, not an up-to-date statement that the new branch is complete. No claim of 100% device-tested parity is made.

## Branch evidence

| Reference | Inspected head |
|---|---|
| main | 0a73966434e05199910a1a351ff0b84b86d3a09d |
| feature/sa-traders-v1.8.0 | a70c08b1dd30808de938389cadc06a5053d3a042 |
| feature/react-native-redesign | 1b1420ab5668686b947137ddd7b6d79a13b040ef |
| feature/native-json-backup-import | 14ab036c5205516dc33222ca2afff9c555940e56 |

All four refs fetched. No additional branches returned by discovery. Root `app.js`, `firebase-db.js`, `split-payments.js` and security rules on the redesign baseline match main. No original production file or deployed Firestore rule was modified.

## Financial contract

Original evidence: `app.js:99–149`. Six material lines each round quantity × rate to two decimals before their sum is rounded. Four wood lines each sum raw length × truncated pieces and round feet × rate; their sum is rounded. This **per-line rounding** replaces the old RN sum-then-round implementation. Normal deposit stays separate; pending is max(due − sum(payments), 0). Manual overpayment is allowed by the original `SA.quickPayment` and is now visible as overpaid, rather than silently capped. Split allocation remains capped at cycle and bill pending.

`cycleIndex = max(1, floor(dateDifference / cycleDays) + 1)`. Return/addition effective cycle = selected date's cycle index + 1. History totals are summed before clamping. Returns are checked against physical outstanding, including wood by exact length. A full cycle is charged once its first day begins. The end date is start + days − 1. 499-cycle limit preserved. New date-only UTC arithmetic avoids daylight-saving duration shifts; the UI's today uses local date. This intentionally fixes the original UTC-today/local-date mismatch; test timezone boundaries before live adoption.

Custom Shop: material + wood = R; advance = R; grand = 2R + transport + loading + unloading. Converted professional bills keep exactly one cycle, including the automatic advance, with no ongoing recurring charges. No refund is invented at closure.

## Source module map

| Subsystem | New source | Reference |
|---|---|---|
| Rates, wood, rent, dates, history, cycles | react-native/src/domain.ts | app.js:99–149 |
| Manual payment, material changes, receipt/credit correction | react-native/src/ledger.ts | app.js:351–528; split-payments.js |
| Payment/return/addition forms, history deletion | react-native/src/WorkflowForms.tsx | original action forms |
| Custom/receipt/reminder/cloud/document/service UI | react-native/src/OperationsHub.tsx | original routes and modules |
| PDF/print/customer/cycle invoices | react-native/src/invoices.ts | invoice-2026.js and next-cycle-2026.js |
| Reminder date buckets / projected rows | react-native/src/reminders.ts | notifications-2026.js:7–38 |
| Native listener/parser/worker | react-native/plugins/native | exact original Java source with package substitution |
| Native registration/permissions | react-native/plugins/withPaymentDetection.cjs | original manifest + RN package |
| Optional authenticated sync | react-native/src/cloud.ts | seven original collections, new acknowledged transaction semantics |
| PIN protection | react-native/src/admin.tsx | replaces fixed client password for local destructive actions |
| WhatsApp HTTPS requests | react-native/src/whatsapp.ts | existing service API; service not redeployed |
| Backup roundtrip | react-native/src/legacyBackup.ts | sa-traders-firebase-v1 schema |

## Feature parity and verification matrix

I = implemented in source; P = partial; U = integration unverified. Main baseline behavior is described in the 32-chapter audit.

| Feature | RN baseline | New branch | Verification / remaining limit |
|---|---|---|---|
| Rental financial engine | P | I | 450 synthetic original-source comparisons; real ledger reconciliation still needed |
| Wood/material return and additions | P | I | physical validation and next-cycle tests |
| Custom Shop and conversion | Missing | I | formula tests; phone form acceptance U |
| Cycle payment dates/indices | P | I | source matching; device U |
| Payment deletion audit | Missing | I | code inspection; PIN integration U |
| Split receipt / credit / correction | Missing | I | ₹5,000 across three bills; correction and duplicate rejection tests |
| Android payment notification listener | Missing | I/U | original parser/listener wired through legacy RN native module; device permission U |
| Background daily reminders | Missing | I/U | original WorkManager worker; device scheduling/reboot U |
| PDF/print/cycle/customer sharing | Text only | I/U | renderer and share API; physical print/recipient U |
| Immutable image invoice archive | Missing | Missing | not implied by current PDFs |
| Invoice image sharing | Missing | P | PDF complete; screenshot image route still under review |
| Firebase auth / conflict protection | Missing | I/U | optional explicit authenticated connector; no live account tested |
| Automatic cloud listeners/offline cloud queue | Missing | P | local offline ledger; explicit sync instead of continuous cloud updates |
| JSON import/export | I local | I local | parser/roundtrip tests; merge conflict policy needs careful review |
| Inventory | P | P | material/wood UI parity tracked in follow-up changes |
| Slips/challans | Notes only | P | original structured records retained/editable, generic PDF; native form parity incomplete |
| WhatsApp service | Missing | I/U | existing API client; service test suite passed with mocks; actual pairing/delivery U |
| Original user/role administration | Missing | P | local PIN; server Auth roles require deployment/administration |
| Full reports/CSV | P | P | core totals; detailed reporting tracked in follow-up changes |

## Executed validation

- `npm run typecheck`: passed.
- `npm run check`: passed native-only integration checks.
- `npm test`: passed existing rental smoke, JSON roundtrip/validation and new source comparison suite.
- Golden suite: **3,166 checks**, 450 synthetic bills, 15/20/30-day cycles, fractional rates, decimal wood, transport, returns/additions, closures and custom conversion. Also rejection checks for malformed wood, excessive returns, duplicate receipts, overallocations and duplicate manual entries. Re-run with Asia/Kolkata timezone passed.
- Original `tests/rental-cycle-test.cjs`, `split-payments-test.cjs`, `notifications-test.cjs`, `whatsapp-reminders-test.cjs`: passed.
- `node --test whatsapp-reminders/test/api.test.js`: 6 tests passed (mock service, idempotency and uncertain-send handling).
- Expo prebuild: passed; injected Java sources, ReactPackage and Android WorkManager dependency inspected.
- Android Metro/Hermes export: passed at first integration checkpoint; final APK CI is the final build authority.
- Physical device, live Firestore, real WhatsApp pairing/customer delivery and printing: **not executed**.

## Risks / acceptance gates

1. Original deployed Firestore rules are open. New connector sign-in alone cannot secure the old database. Deploy server authorization before live use; no rule deployment was attempted.
2. Cloud writes compare full touched documents with the last pull. Conflict aborts, rather than silently overwriting another client's payment. Deletes and >400 changed records rejected. A cloud pull replaces local records after safety backup; export local work first.
3. Local AsyncStorage writes serialize a full ledger. Save failures retain the previous in-memory record; concurrent UI writes are blocked. This does not replace a database transaction across devices.
4. PIN is device protection, not server authorization. SecureStore stores only a salted digest and WhatsApp token; credentials are not exported in JSON.
5. Original `parseComboSizes` tolerates malformed text for imported historical records. New form writes reject unparsed text. Date and nonnegative validation are stricter than original permissive form parsing; formulas on accepted records are preserved.
6. Historical PDFs are generated from current records. Deleting old material events can change earlier/future statements; archive issued invoices if immutable evidence is required.
7. Notification listener sees only allowed payment-app/message notifications, never the entire SMS inbox. User access is required, and OEM restrictions may suppress callbacks.
8. Reminder worker uses last synced projections and may be delayed by Android. The receipt amount must still be independently verified before posting.
9. Separate preview application ID avoids replacing the original ledger. It is not an upgrade signed with the original production keystore.

## Required phone acceptance

Import an anonymized backup; compare every bill's due/paid/pending/deposit with the original app at the same date. Create and restart after a rental and Custom Shop bill. Return different wood lengths and verify next four cycles. Record and delete a cycle payment; split ₹5,000 across three bills and correct it to ₹3,000 + ₹2,000 credit. Grant notification access, receive an actual incoming-payment notification, verify duplicate suppression, then enable reminders and test restart/reboot. Generate and share all invoice types. Test Firebase in a dedicated project with deny-by-default rules, including simultaneous conflicting payments, network failure and a >400-record refusal. Test actual WhatsApp service authentication/pairing and uncertain-send retry. None of these device/service scenarios are marked passed here.
