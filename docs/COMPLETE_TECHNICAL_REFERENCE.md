# S.A Traders complete technical reference package

25 October 2026. Repository: Shivayt007/bills. This package contains the original 32-chapter source audit and the new React Native financial, integration and verification references. The baseline chapters describe the application before this implementation. The later verification and parity tables supersede baseline statements about missing native features. This is not a claim that every Android device/service integration was tested.

## Deliverable map

A. Functional analysis: original 32 chapters below, source inventory and static button/symbol CSV files.
B. Exact financial reference: appended financial contracts, formulas, examples and rounding caveat.
C. Database/integration reference: appended field dictionary and native/WhatsApp/Firebase/JSON contracts.
D. Parity matrix: verification appendix.
E. QA/risk report: 30 specified acceptance scenarios and separately identified executed tests.
F. Migration blueprint: baseline chapter30 and concrete native subsystem map in the verification appendix.

All four original branch file inventories are in REPOSITORY_FILE_INVENTORY.csv (375 branch/file entries), SOURCE_SYMBOL_INDEX.csv (1,657 static symbol entries) and BUTTON_BINDINGS.csv (1,314 static handler fragments). Static indexing does not certify runtime click coverage. No secrets, tokens or real customer details are reproduced.

---
# S.A Traders — Source Code and Functional Migration Audit

**Audit date:** 2026-10-25 · **Repository:** [Shivayt007/bills](https://github.com/Shivayt007/bills) · **Status:** source-grounded baseline / not feature-complete certification

**Scope and evidence:** Read source and recursive file trees of four branches. Relevant source paths and 1-based line references below refer to `main` unless the branch is specified. The source may change after this audit. GitHub CI is evidence of compilation/tests that ran, *not* proof of end-to-end business equivalence. No physical Android device was available. A user-provided `sa-traders-firebase-v1` sample dated 2026-10-24 was inspected locally for field shapes; customer identities and sensitive receipt data are intentionally omitted from this document. The React Native work described here is an **isolated native test build, not a full replacement of production**.

## 1. Executive Summary

The operational Android package is a **Java/Android WebView shell around a JavaScript accounting application**, backed by Firestore via a native JavaScript bridge, with native notification detection, background reminders, file sharing, and a separately deployed WhatsApp service. Branch `main` is the reference for billing behavior. A modern React Native launcher is not functional parity; native reimplementation requires faithfully reproducing every financial transformation, native bridge, source record and button transition. Several React Native interfaces are now native but advanced production functions remain missing.

**Release blockers:** Firestore rules currently allow unauthenticated reads and writes; app login is enforced only client-side. Backup restore clears collections before re-uploading records and is not atomic. The native rewrite does not support guarded split receipts, full cycle attribution, secure Firebase auth, printable production invoices or reminder services. **Do not use its financial output for live billing**.

## 2. Repository and Branch Inventory

Discovered branch heads when inspected:

| Branch | SHA prefix | Distinguishing content |
|---|---|---|
| `main` | `0a739664` | Original Android/WebView v1.8.2, 15 source web assets, Java bridges, WhatsApp service and production tests |
| `feature/sa-traders-v1.8.0` | `a70c08b1` | Older app lacking latest split-payment and WhatsApp server sources |
| `feature/react-native-redesign` | `35b3c794` before this audit's new commits | Expo/React Native interface, isolated AsyncStorage, TypeScript rental calculator, native UI components |
| `feature/native-json-backup-import` | `14ab036c` | React Native JSON import/export via document picker and file sharing; not a substitute for production persistence |

All four recursively returned non-truncated repository trees; no additional branches found. The root web assets and Android bundled assets are duplicated. For modern builds, `android-app/app/build.gradle:67–89` syncs root web assets into generated Android assets. **Do not edit only the older bundled copy and assume the APK will use it.**

### Important file inventory and dependency map

| Path | Role / callers / migration |
|---|---|
| `app.js` | Core web routes, financial calculations, CRUD, reports, admin, backup and invoice views; called by `index.html`, UI overrides, invoice and notification modules. **Financial source of truth.** |
| `firebase-db.js` | `SAFirebase.DB` API and cache, called throughout web code and `split-payments.js`; calls Android `FirebaseDB` bridge. Preserve store identifiers and callback semantics. |
| `split-payments.js` | Validates paise allocations, creates/reassigns receipt operations; calls `DB.guardedBatch` and native detected-payment candidates. Requires transactional native implementation. |
| `ui-2026.js`, `ui-fixes.js`, `reference-ui.js` | Replaces shell/navigation and enriches UI/cycle presentation; review before porting, not just base `app.js`. |
| `invoice-2026.js`, `next-cycle-2026.js`, `invoice-share.js` | Cycle-specific invoice data, payment attribution, next cycle, HTML rendering/image sharing. |
| `notifications-2026.js` | Upcoming/due/overdue buckets, notification settings, detected-payment review and sync to native worker. |
| `whatsapp-reminders.js` | Web setup, pairing status, editable reminder preview and dispatch via `WhatsAppService`. |
| `app.bundle.min.css` | Production responsive web styling; **not reusable as React Native styles**. |
| `index.html`, `vendor/html2canvas.min.js`, `sa-traders-logo.jpg` | Web boot scripts, rendering vendor asset, brand image. |
| `android-app/app/src/main/java/com/satraders/billing/MainActivity.java` | WebView, Android JS bridges, backup selection, file exports/sharing, notification permission/routes, print and lifecycle. |
| `.../FirebaseBridge.java` | Firestore operations, batched writes, guarded updates, stores and listeners. |
| `.../PaymentNotificationService.java`, `.../PaymentParser.java` | Android notification listener and payment SMS/app-notification parsing; notification permission/access is user controlled. |
| `.../BillingReminderWorker.java` | WorkManager 24-hour reminders, daily history/pagination. |
| `.../WhatsAppBridge.java` | HTTPS API client; Android-keystore-encrypted bearer token; JS receives only status/results, not secret. |
| `.../InvoiceFileProvider.java`, `res/xml/invoice_paths.xml` | Scoped file URI sharing for invoices and backup JSON. |
| `android-app/app/src/main/AndroidManifest.xml` | Activity, listener service, FileProvider and permissions. |
| `android-app/app/build.gradle` | App ID `com.satraders.billing`, Java 17, min SDK 26, target/compile SDK 35, v1.8.2, full/website flavors, signed release. |
| `firestore.rules` | Security policy. **CRITICAL**: `allow read, write: if true`. |
| `whatsapp-reminders/src/{server,api,whatsapp}.js`, `Dockerfile` | Separate Node.js WhatsApp pairing and reminder API; SQLite idempotency ledger. |
| `tests/{ui,rental-cycle,split-payments,notifications,whatsapp-reminders}-test.cjs` | JS regression checks, not full device acceptance. |
| `tests/payment-parser-test.java`, `whatsapp-reminders/test/api.test.js` | Parser and server API checks. |
| `react-native/src/App.tsx` | Native screens, user actions, local persistence. Not equal to web feature parity. |
| `react-native/src/ProfessionalUI.tsx` | Native styled fast billing, materials, cycles and customer-summary components. |
| `react-native/src/domain.ts` | Separate TypeScript rental computation; compare golden outputs to `app.js` before production. |
| `react-native/src/{localStore,legacyBackup}.ts` | Isolated AsyncStorage with typed JSON backup import/export. No Firestore writes. |
| `react-native/scripts/{check-preview,domain-parity-check}.cjs` | Build-time source/smoke checks; scope limited. |
| `.github/workflows/build-react-native-preview.yml` | Expo prebuild, typecheck, domain checks, Gradle assemble and APK artifact. |
| `.github/workflows/{build-apk,build-release,whatsapp-reminders}.yml` | Java Android/tested signed production builds and WhatsApp subsystem CI. |

Resources: Android icons in `res/mipmap-*`; colors, styles and splash drawables in `res/values*` and `res/drawable*`; scoped sharing and backups in `res/xml`. `.github/workflows/enhance-bill-view.yml` and `fix-*.yml` are automation/edit workflows, **not** app routes. Non-text binary assets were inventoried but not exhaustively decoded.

## 3. Technology Stack

Main: HTML/CSS/vanilla JavaScript SPA loaded in Android WebView; Java activity/services; AndroidX WebKit 1.12.1, WorkManager 2.9.1; Firebase Firestore BoM 33.16.0; Gradle Android plugin 8.7.3; Google Services plugin 4.4.2, Java 17. `full` flavor enables payment detection; `website` disables it via `BuildConfig.PAYMENT_DETECTION_ENABLED`. Server: Node 24, `berryprotocol` 0.1.10, `qrcode` 1.5.4 and `node:sqlite`. Native lab: Expo SDK 54, React Native 0.81.5, React 19.1, TypeScript 5.9, AsyncStorage 2.2.0.

## 4. System Architecture

`UI click → SA.* handler → app.js validation / hydrate* → SAFirebase.DB → Android FirebaseBridge → Firestore`. Firestore change listeners feed `SADataCache`; route rendering responds to store updates. Native `MainActivity` also receives `window.Android.*` calls for printing, sharing, backup, notification access and app actions; `WhatsAppBridge` forwards to the independent HTTPS reminder server. Financial logic **must not be independently guessed from UI labels**.

## 5. Complete Feature Inventory

Verified production modules: login/app lock, dashboard and filtering, rental bill creation/edit/close/delete, financial hydration, cycle payments and payment deletion audit, material/wood return and additional history, customer directory/history/materials, custom shop creation and conversion, inventory, total/active-rent/payment/customer reports, delivery/return slips, challans, print invoice/customer/next-cycle/custom/slip/challan/material reports, detected UPI payment review, split multi-bill receipt management, due reminders, WhatsApp setup/reminders, backup/import/reset, terms/admin and settings.

Native lab currently implements: native dashboard, invoices, quantity controls, customers, basic inventory, local payment entry, material quantity returns/additions, billing cycle screen, basic reports, slips/challan notes, text share, isolated JSON backup; other production features remain missing or partial.

## 6. Screen-by-Screen Analysis

`app.js:192–208` route dispatcher:
`login`, `home`, `dashboard`, `about`, `notifications`, `bills`, `bill/{id}`, `edit/{id}`,
`custom`, `custom-new`, `custom-edit/{id}`, `custom-view/{id}`,
`reports`, `payment-report`, `material-rent-report`, `customer-materials/{mobile}`,
`customers`, `customer/{mobile}`, `inventory`, `slips`, `slip-new/{delivery|return}`,
`slip-view/{id}`, `challans`, `challan-new`, `challan-view/{id}`,
`admin`, `admin-users`, `admin-terms`, `admin-backup`, `open-bills`,
`materials`, `totals`, `return-bill`,
and print routes `print-invoice`, `print-customer`, `print-next-cycle`,
`print-custom`, `print-slip`, `print-challan`, `print-material-rent`, `print-customer-materials`.
The dispatcher guards non-login screens with client login and shows `Page not found` for unmatched routes.

Additional UI lives in overrides `ui-2026.js`, `ui-fixes.js`, `reference-ui.js` and notifications/split modules. The complete route/button coverage must be derived from all four, not from a screenshot of `app.js` alone.

## 7. Every Button: Working Process Reference

| Visible action | Production handler and observed effect |
|---|---|
| New Bill | `SA.go('edit/new')` → `renderBillForm` → populate defaults, reserve suggested number, enter fields |
| Save rental bill | `renderBillForm`, `billFromForm`; duplicate check, create bill and optionally customer via `DB.batch`, refresh reminders |
| View/Edit bill | `renderBill` / `renderBillForm(id)`; load/hydrate record, update via `DB.batch` |
| Record Payment | `SA.quickPayment` → cycle select, amount/date/method/notes, duplicate guard; append payment |
| Delete Payment | `SA.deletePayment` → admin password + reason + checkbox, re-read/compare, append `payment_audit` deletion entry |
| Close/Delete Bill | `SA.confirmBillAction` → admin password + confirmation; set `closed_at` or delete the record |
| Return Material | `SA.openReturn` → `saveHistory`, validate against material/wood balance, append return event |
| Additional Material | `SA.openAdditional` → `saveHistory`, append future-effective additions |
| Delete return/addition | `SA.deleteHistory` → admin role + confirmation, removes matching history event, rehydrates on next render |
| Next Cycle / Customer / Standard Print | `renderPrintNextCycle`, `renderPrintInvoice`, customer print modes; native print or web print |
| Customer list/detail | `renderCustomers` / `renderCustomer`; search, open bills, history and material summary |
| Custom Shop / Convert | `renderCustomForm`, `renderCustomView`, `SA.convertCustom`; one-time custom price, then conversion |
| Inventory | `renderInventory`; change master quantity/wood size map, save to Firestore |
| Delivery/Return Slip | `renderSlipForm` and `renderSlipView`; create/view/print slip |
| Challan | `renderChallanForm` / `renderChallanView`; create/view/print |
| Reports / CSV | `renderReports`, `renderPaymentReport`, `SA.exportPaymentCsv` and material/customer report routes |
| Notifications | `SA.renderNotifications`; overdue/today/upcoming, payment candidate review |
| WhatsApp Reminder | `SA.openWhatsAppReminder` → verify bill & phone, preview/edit message, API send |
| WhatsApp Setup | `SA.openWhatsAppSetup`; server URL/token, pairing QR or phone code, status |
| Export/Share Backup | `SA.exportBackup` / `SA.shareBackup`; `fullBackup` over all seven collections |
| Choose Backup / Restore | `SA.importBackup` → `normalizeBackup` → user confirm → clear+batch import |
| Reset Data | `SA.resetData`; admin confirmation then clears business collections |
| Terms/User Settings | `renderAdminTerms`, `renderAdminUsers`; client-side admin role gate, settings saves |

This is the **business-action map**; dynamic per-input icons and every generated modal element require instrumented UI enumeration for full clickable-element certification.

## 8. Customer Management

Source: `app.js:547–548`; data keyed by `mobile`, optional `customer_id` and `place`, display `name`. Customers can have multiple bills, grouped by exact `mobile`; related bills determine customer pending and materials. Bills can also contain names and locations independently. Search uses normalized lowercase display strings, but stored mobile normalization requires additional testing. Avoid using `customer_id` as the sole migration merge key; original Firestore uses **mobile**.

Workflow: create bill/customer → customer record stored with mobile and sequential ID → view history → additional cycles/payments/returns → optional closure → customer remains. Beware changing mobile and orphaning historical bill associations.

## 9. Rental Billing Engine

Source `app.js:99–149,281–305`. Bill fields: `bill_no`, `start_date`, `cycle_days`, `name`, `mobile`, `place`, material `*_qty` and `*_rate`, wood expression and rate fields, trips/rates/loading/unloading, `advance_amount`, payments/history/status. `billFromForm` clamps material counts with `nonneg` and defaults rates through `n`. Bill number blank/duplicate rejected at save. Cycle dropdown offers 15/20/30 in web UI; `billFromForm` itself uses positive `cycle_days` rather than a hard allowlist.

## 10. Material Calculations

Definitions `app.js:14–31`; `round2` line 45, `ratesOf` 107, `calcRent` 111–115.

| Material | Default rate | Calculation |
|---|---:|---|
| Jackey | ₹65 | Quantity × rate (piece) |
| 9 Jackey | ₹100 | Quantity × rate (piece) |
| Sheet | ₹35 | Quantity × rate (piece) |
| Half Sheet | ₹30 | Quantity × rate (piece) |
| Span | ₹100 | Quantity × rate (piece) |
| 3M Inner | ₹60 | Quantity × rate (piece) |
| 12 ft Wood | ₹18 | Total measured feet × rate |
| 9 ft Wood | ₹18 | Total measured feet × rate |
| 6 ft Wood | ₹15 | Total measured feet × rate |
| Runner | ₹7 | Total measured feet × rate |

Rate override `ratesOf(b)[key]=n(b[key],DEFAULT_RATES[key])`: valid finite bill-specific rate wins; source default is fallback. Existing bills store their own rate fields on form save, so changing code defaults **normally** should not change stored old rates. However malformed/missing rates fall back to code defaults. Money is rounded to 2 decimals after each material amount and wood bucket: `Math.round((n(v)+Number.EPSILON)*100)/100`; note floating-point tie/negative behavior differs from proper integer paise arithmetic.

**Worked example:** 2 Jackey = 2×65 = ₹130; 8-ft wood, 2 pieces at ₹18/foot = 8×2×18 = ₹288; one-way transport ₹150. First-cycle billed = **₹568**; later unchanged cycles ₹418.

## 11. Wood Calculations

`parseComboSizes` `app.js:99–103` reads repeated `feet × pieces` segments separated by punctuation/newlines/spaces, accepting `x`, `X`, `*` and `×`; decimal feet accepted, fractional pieces truncated. Duplicate lengths combine. Invalid terms not matching regex are **silently ignored**; this must be replaced by a visible validation error in a production rewrite. `woodStats` line 110 sums `pieces`, `total_feet=Σ(length×pieces)`, `amount=round2(total_feet×rate)`.

Examples: `8×5` at 18 → 40ft / ₹720; `8×5+10×2` at 18 → 60ft / ₹1,080; `8×2+8×3` → 40ft / ₹720; `7.5×4` → 30ft / ₹540; `10x1+8*2` at 15 → 26ft / ₹390. Wood returns/additions use maps keyed by exact length, and `subtractMaps` prunes zero/negative entries (`app.js:105–106`).

## 12. Transport and Handling

`transport` line 116:
`up=nonneg(up_trips)*n(up_charge)`,
`down=nonneg(down_trips)*n(down_charge)`,
`total=round2(up+down+loading+unloading)`.
Normal `hydrateBill` line 139 includes transport only if `idx===1`. This includes loading/unloading in the first cycle. No automatic repeated transport on later cycles. Custom Shop includes transport vehicle amount plus loading and unloading once. Negative transport rates/handling are not universally rejected by `n`.

## 13. Rental Cycle Calculations

`cycleIndex(start,days,date)` line 117 returns 1 when date is on/before start, otherwise `floor(dayDiff(start,date)/max(days,1))+1`; `effectiveCycle(...)=cycleIndex(...)+1` line 118. `hydrateBill` lines 136–140: start at `start_date`, loop while `cur<=today()`, terminate at index <500; cycle end = `addDays(cur,cycle_days-1)`, next cycle begins previous end+1. **Each entered cycle is charged in full**, no proration for return/closure in mid-cycle.

Example: 15-day bill from 2026-01-01 with rent ₹418 and first transport ₹150: cycles **Jan 1–15 ₹568**, **Jan 16–30 ₹418**, **Jan 31–Feb 14 ₹418**, **Feb 15–Mar 1 ₹418**; accrued by Feb 15 = **₹1,822**. A valid return of one Jackey after cycle 1 is effective at cycle 2: later rent drops ₹65/cycle → **₹1,627** across four cycles (₹568+₹353×3).

Time issues: `today()` uses UTC ISO string while `parseDate` makes local-midnight objects; `dayDiff` uses fixed 86,400,000 ms while `addDays` is local calendar arithmetic. The UTC/local mismatch can cause boundary effects, and DST zones can alter `dayDiff`. Leap/month/year boundaries need dedicated parity cases. Invalid start yields empty cycles/due 0; future starts yield zero currently accrued cycles. Closed bills use `closed_at` when parseable. Computed current index is the last produced cycle, with 499 maximum.

## 14. Material Returns and Additions

`historyTotals` lines 119–123 accumulates per-material counts and per-length wood maps; `snapshotForCycle` lines 124–129 uses
`balance=max(base + additions_effective - returns_effective,0)`.
Effective events only apply when `effective_from_cycle<=idx`. The UI `saveHistory` (`app.js:524–530`) rejects empty entry, closed bill, returns exceeding **current physical balance**, or wood return exceeding its precise length count; dates are stored and effective cycles derived. If an item is returned during cycle 1, charges for cycle 1 remain unchanged and cycle 2 onward sees the reduction. Deleting history (`app.js:500`) removes matching events; rebuilding invoice state changes thereafter. **Historical cycle snapshots are derived, not immutable signed invoices**.

Example: base 10 sheets @₹35 ⇒ ₹350 each cycle; return 4 during cycle 1 ⇒ cycle 1 ₹350, cycle 2 ₹210; add 2 to become effective cycle 3 ⇒ cycle 3 ₹280. Independent return validation must include wood lengths and concurrency.

## 15. Advance and Deposit Logic

Normal rental: `advance_locked=round2(advance_amount)`, while `total_due=Σ(cycle.total)`, `total_paid=Σ(payment.amount)`, `pending=max(total_due-total_paid,0)`: **advance is separate and does not automatically reduce rental due** (`app.js:140`). There is no basis to claim automatic advance refund on closure. For Custom Shop the advance is **equal to the material+wood amount** and is included in the one-time grand total (`app.js:142–147`). Customer credit in split payment is a separate stored remainder, not interchangeable with advance.

## 16. Payments and Pending

`app.js:351–475`: payment form includes cycle selection (professional bills), amount, shortcut Full/Half, method Cash/UPI/Bank, date, note and duplicate confirmation. Validation: positive amount, at most 2 decimal digits, safe cents integer, valid date, known method, valid selected cycle and no duplicates unless explicitly confirmed. New payment append records `payment_id, amount, payment_date, note, method` plus `cycle_index, cycle_start_date, cycle_end_date` where applicable. **The regular payment handler does not explicitly cap every manually typed amount at bill pending**; determine operational overpayment behavior from tested application before porting. Pending displays floor at zero, hiding surplus from bill-level pending. Admin deletion requires password/confirmation/reason and adds `payment_audit`. Manual optimistic `DB.put` may resolve before server persistence.

## 17. Split Payment Engine

`split-payments.js:3–26,46–155`; `SA.validateSplit` converts amounts to integer cents, rejects invalid decimals, excessive cycle capacity, excessive total bill pending, total allocations > received, and leftover credit without explicit opt-in. It can allocate across distinct bills and cycles, bind one detected receipt to a customer, and persist `settings` receipt records, receipt aliases, bill payments, optional customer credit. Receipt editing first removes/replaces prior entries for touched bills. `FirebaseBridge.guardedBatch` is required for protected multi-record updates. Dedup keys use normalized reference or detected candidate ID.

Example ₹5,000: Bill A ₹2,000; B ₹1,500; C ₹1,000; remainder ₹500 → require credit choice and valid customer mobile; otherwise reject. When allocating full ₹5,000 (e.g., 2,000+1,500+1,500), no credit. Never represent a 200 OK from WhatsApp or Firestore as proof of bank payment.

## 18. Custom Shop Billing

`hydrateCustom` `app.js:142–144`: `material=Σ(piece qty×rate)`, `wood=Σ(feet×rate)`, `materialRent=material+wood`, `advance=materialRent`, `grand=materialRent+up/down transport+loading+unloading+advance`. One-time bill; `pending=max(grand-Σpayments,0)`.

Example: 10 Jackey × ₹65 = ₹650; 8ft ×5 wood at ₹18 = ₹720; material total ₹1,370; up/down vehicle ₹200; loading ₹80; unloading ₹50; advance ₹1,370 ⇒ grand = **₹3,070**. With ₹1,500 received, pending = **₹1,570**. Conversion `hydrateConvertedCustom` line 145–147 creates one professional cycle with `rent=materialRent+advance` and `transport=all transport`, total same as Custom Shop; may mark open/closed depending on balance. Do not replace conversion with ordinary ongoing rental calculation.

## 19. Invoice Generation

Sources: `app.js:676–681`, `invoice-2026.js:4–71`, `next-cycle-2026.js`, `invoice-share.js`, `MainActivity.java`. Types: standard invoice, customer bill, selected rental-cycle invoice, next cycle, custom bill, material report, slip, challan. Invoice-2026 selects exact cycle snapshot and `calcRent(snapshot_qty,snapshot_wood,b.rates)`; cycle payment inclusion requires matching index **and exact start/end dates**; old unassigned payments are reported separately (lines 16–18,35–44). Sharing can render invoice image via `html2canvas`, then Android file share; PDF/printing via WebView print or Android print. An invoice re-rendered after history edits is **not an immutable accounting archive**; archive rendered output, calculation version and event timestamps if historical invariance is mandatory.

## 20. Notifications and Reminders

`notifications-2026.js:7–46`: builds rental due rows, categorizes as `pending` (already-started outstanding earlier cycle), `today` (cycle start date equals today) and `upcoming` (future cycles in seven-day window meeting payable criteria). `SA.syncReminders` debounces 1.5 seconds and forwards to Android. Native `BillingReminderWorker.java:28–69` schedules unique 24-hour WorkManager periodic work, optional immediate run after first enable, checks notification permission Android 13+, suppresses same-day repeat using last run, paginates customer notifications and records bounded history. Android may defer periodic work; exact trigger time is not guaranteed. Due day is based on cycle start; do not equate upcoming with an Android alarm at exact midnight.

## 21. WhatsApp Integration

Three distinct things:

1. Manual share sheet/open WhatsApp from `invoice-share.js`/Android intent: user chooses sending app/contact.
2. Automated reminder UI: `whatsapp-reminders.js` builds, previews, optionally edits recipient/message; revalidates bill before send.
3. Separate Node server `whatsapp-reminders/src/api.js`, `src/whatsapp.js`: bearer-token HTTPS client through native `WhatsAppBridge.java`, QR/phone-code pairing, connection status, saved auth folder, idempotent request IDs in SQLite. Returns accepted or uncertain response; server does not prove delivery to recipient. A timed-out send stays `UNKNOWN`; repeat needs manual investigation. `normalizePhone` handles India default and international length bounds.

## 22. Android Native Components

Manifest `android-app/app/src/main/AndroidManifest.xml:1–42`: INTERNET, ACCESS_NETWORK_STATE, POST_NOTIFICATIONS, WAKE_LOCK, RECEIVE_BOOT_COMPLETED; exported launcher Activity, exported NotificationListenerService protected by `BIND_NOTIFICATION_LISTENER_SERVICE`, non-exported FileProvider. No `READ_SMS` in the manifest; payment detection uses **notification listener**, not unrestricted SMS inbox. Java services implement payment parsing, 24h background reminders, native sharing/printing, file picker and HTTPS WhatsApp. Source `app/build.gradle:5–32`: API 26 minimum, API 35 target, Java 17, v1.8.2. Production release signing relies on environment variables and is different from Expo preview debug signing.

## 23. Firebase and Database Schema

`firebase-db.js:3–4` defines seven **collections and primary keys**:

| Store | Document key | Important data fields |
|---|---|---|
| `bills` | `bill_no` | name/mobile/place, start_date/cycle_days, all material quantities/rates, wood maps as expressions/rates, transport charges, advance, status, payments, return/addition history, audit, closed_at |
| `customers` | `mobile` | name, mobile, customer_id, optional place, created_at |
| `customBills` | `bill_no` | custom shop fields, one-time grand total, payments, conversion metadata |
| `slips` | `slip_no` | delivery/return content, created/date and customer details |
| `challans` | `challan_no` | customer/material delivery and notes |
| `inventory` | `item` | `stock_qty` for piece materials; `stock_map` for wood lengths |
| `settings` | `key` | `value` terms, counters, detected receipt records and aliases |

Payment is **nested on bill**, not a separate top-level `payments` collection. Cycles are principally **derived** by `hydrateBill`. Return/addition history are nested. Some derived fields are not physically persisted. `FirebaseBridge.java:76–130` implements `all,get,put,batchPut,guardedBatch`; JavaScript cache read, optimistic updates and asynchronous write rollbacks are in `firebase-db.js:30–44`.

Sample backup (anonymized counts): **26 bills, 18 customers, 1 custom bill, 10 inventory items, 5 settings**; no slips/challans. Nested payment keys include `payment_id/payment_date`, optional `cycle_index/start/end`, `receipt_key`, `transaction_reference`. Never rename these fields to native-only `id/date` without a reversible transformation. **Server rules currently lack Firebase-auth enforcement.**

## 24. JSON Backup and Restore

Production schema `sa-traders-firebase-v1` with `schema, exported_at, business, data:{bills,customers,customBills,slips,challans,inventory,settings}` (`app.js:604`). `normalizeBackup` lines 610–641 accepts some older aliases and fills legacy payment IDs; verifies primary keys, duplicate records and nested array types. `restoreBackupText` lines 643–659 **clears each selected store before uploading records in 100-record batches**; no all-store transaction/rollback. A failure halfway can leave partial restored data. Run an independent backup first, preview counts, stage in isolated storage, and verify hashes/counts before swapping.

React Native `feature/native-json-backup-import` adds local document picker/import/export/merge. The audited redesign branch now adds a safer local copy, collection-key validation, mobile-based customer merging and an explicit replacement confirmation. All local imports are disconnected from live Firebase.

## 25. Security Audit

| ID | Severity | Evidence | Correction |
|---|---|---|---|
| SEC-01 | **Critical** | `firestore.rules:7–8` allows all unauthenticated read/write | Add Firebase Authentication, enforce roles per document and test deny-by-default rules before connecting native app |
| SEC-02 | **Critical** | `firebase-db.js:44–47` uses client-only fixed login verification | Remove fixed secret, use server-backed identities and authorization checks |
| SEC-03 | High | `app.js:643–659` clears cloud store before completing restore | Stage/validate then atomically reconcile or use transactional versioned restore and rollback |
| SEC-04 | High | `firebase-db.js:31–40` optimistic writes, some resolve before cloud commit | Await acknowledgements for financial writes; durable pending state/retry queue |
| SEC-05 | High | `app.js:83–88` counters/number discovery can race | Server transaction for unique number allocation |
| SEC-06 | Medium | `MainActivity` supports shared backups; Android backup configuration includes root; data may include payments | Restrict backups, encrypt sensitive files and ensure secure scoped URIs |
| SEC-07 | Medium | Separate reminder service has bearer token and saved session | Rotate, rate-limit, TLS-only, monitor failures, protect pairing endpoints and session disk |
| SEC-08 | Medium | Client admin prompts in UI | Apply rules on server, log immutable admin actions and enforce least privilege |

Do not reveal or hardcode login passwords, tokens, keystores, private Firebase keys or actual customer data in released reports.

## 26. UI/UX Analysis

Earlier reference screens require: clear bill identity; customer details; full 15/20/30 cycle badge; separate material/wood/transport rows; visible **due, paid, pending and advance**; one-tap payment action; cycles; all-customer material summary; history tabs; native quantity `+`/`−` controls; accessible confirmation dialogs. Responsive issues include dense lists, small amount text, too many equally prominent buttons and inconsistent placement. Native `ProfessionalUI.tsx` improves structure but is not yet device-tested. UI simplification must **not delete** financial or administrative actions. All icons need labels and 44–48dp touch targets; provide keyboard-safe form flow, focus management, loading/saving/failed states and clear offline status.

## 27. Branch Feature Comparison

Legend: **Y** implemented in source; **P** partial; **N** absent; **U** unverified.

| Feature | main | v1.8.0 | RN redesign | RN JSON branch |
|---|---|---|---|---|
| Rental cycle math + basic bill | Y | Y | P | P |
| Material/wood returns and additions | Y | Y | P | P |
| Professional custom conversion | Y | Y | N | N |
| Cycle-specific payment and deletion audit | Y | P | P | P |
| Split detected receipts across bills | Y | N | N | N |
| Native payment notification listener | Y | Y | N | N |
| 24h reminders + notifications | Y | Y | N | N |
| WhatsApp server and reminder UI | Y | N | N | N |
| Standard/next-cycle invoice/image share | Y | Y | P (text only) | P |
| Full Firebase cloud storage | Y (insecure rules) | Y | N | N |
| Full JSON cloud backup/restore | Y (risky restore) | P | P (local only) | P (local only) |
| Fully native React Native controls | N | N | Y for ported screens | Y for its screens |

`main` is the source of truth for financials/Android, `feature/native-json-backup-import` for native JSON workflow reference, `feature/react-native-redesign` for UI, and server folder on `main` for WhatsApp.

## 28. Bugs and Risks

| Issue | Evidence | Status | Reproduction and correction |
|---|---|---|---|
| CALC-01 | `app.js:49,51–54` UTC today/local dates | **Suspected** boundary mismatch | Simulate 23:30 IST near UTC day boundary; use consistent zone-aware date-only arithmetic |
| CALC-02 | `parseComboSizes:99–103` drops malformed tokens | **Confirmed parsing behavior** | Input `8×2 nonsense`; detect unconsumed text and block save |
| CALC-03 | `quickPayment:395–425` does not explicitly cap manual amount at pending | **Confirmed missing check** | Type more than pending; enforce policy or explicitly represent credit |
| CALC-04 | `round2:45` floating-point | **Potential precision risk** | Compare fractional paise/tie cases; use integer minor units |
| DATA-01 | `restoreBackupText:650–655` clear then batches | **Confirmed partial-restore risk** | Fail mid-batch, observe partially populated store; stage and reconcile |
| DATA-02 | `DB.put` optimistic asynchronous writes | **Confirmed async behavior** | Offline after click; require confirmed save semantics |
| RN-01 | `react-native/src/domain.ts` separate math | **Parity incomplete** | Compare hundreds of historical bill snapshots against `hydrateBill`; golden tests |
| RN-02 | RN app lacks full custom/notification/WhatsApp workflows | **Confirmed missing** | Route/function inventory diff; implement each with tests |
| RN-03 | Legacy receipt `payment_id/payment_date` versus native `id/date` | **Confirmed model mismatch** | Load sample backup; use dual-key compatibility and preserve original fields |
| SEC-01/02 | Open Firestore rules/client lock | **Confirmed vulnerabilities** | Test unauthorized reads in isolated project; deploy authenticated locked-down rules |

## 29. Complete Test Cases

All cases below are **specified, not executed against a physical device**. A few narrow existing Node tests cover parts of the calculations; these do **not** establish pass status for the integration tests.

| ID | Preconditions / steps | Expected result / financial invariant | Test status |
|---|---|---|---|
| T01 | Create customer with mobile, revisit | Exactly one mobile-keyed record, correct display | Not run |
| T02 | Create bill with new number | Store bill and link customer; reject duplicate | Not run |
| T03 | Qty 2 Jackey at ₹65 | Material = ₹130 | Not run |
| T04 | Wood 8×5+10×2 @₹18/ft | 60ft, ₹1,080 | Not run |
| T05 | 15-day cycle start Jan 1 | Jan 1–15, Jan 16–30 | Not run |
| T06 | 20-day cycle crossing month | Exactly 20 inclusive days, next starts next day | Not run |
| T07 | 30-day cycle crossing year | No gaps or overlapping charge days | Not run |
| T08 | First-cycle transport ₹150 | Due ₹568 for example bill | Not run |
| T09 | Second cycle unchanged example | Cumulative due ₹986 | Not run |
| T10 | Third cycle unchanged example | Cumulative due ₹1,404 | Not run |
| T11 | Return 1 Jackey effective cycle 2 | Second-cycle rent ₹353 | Not run |
| T12 | Additional material effective cycle 3 | No changes to cycles 1/2; next rent increases | Not run |
| T13 | Partial payment ₹100 after 2 cycles | Example pending ₹886 | Not run |
| T14 | Full payment | Pending ₹0 exactly | Not run |
| T15 | Normal advance ₹200 | Rent due unchanged; deposit separately shown | Not run |
| T16 | Split ₹5,000: A 2k, B 1.5k, C 1.5k | Accepted if capacity; zero credit | Not run |
| T17 | Re-submit same bank reference | Duplicate rejected/idempotent handling | Not run |
| T18 | Delete payment as admin | Audit added, total paid decreases | Not run |
| T19 | Custom Shop worked example | ₹3,070 grand, with ₹1,500 paid: ₹1,570 pending | Not run |
| T20 | Convert Custom Shop | Same initial total, single converted cycle | Not run |
| T21 | Close bill mid-cycle | Stop future cycles, current charged fully | Not run |
| T22 | Delete bill with password/confirm | Record deleted and audit/perms policy met | Not run |
| T23 | Render selected cycle invoice | Snapshot, cycle payment allocation consistent | Not run |
| T24 | WhatsApp share/image | Correct customer, URI access, user confirmation | Not run |
| T25 | Day before/today/overdue and reboot | Buckets, reminders and once-per-day behavior correct | Not run |
| T26 | Import backed-up JSON | Counts + nested payment IDs unchanged, local/cloud isolation | Not run |
| T27 | Two clients edit same bill | Guarded operation or explicit conflict; no lost updates | Not run |
| T28 | Disable network after save | Visible pending/failure; no false success | Not run |
| T29 | Restart after local import | Data survives, document picker safety backup remains | Not run |
| T30 | One customer, multiple bills | Correct per-customer history and totals | Not run |

Existing repository smoke checks: `tests/rental-cycle-test.cjs` checks cycle payment attribution and unassigned payments; `tests/split-payments-test.cjs` checks cents and split limits. Run them and verify CI logs before marking even these as passed in a release report.

## 30. React Native Migration Reference

Recommended domain-separated TypeScript architecture:
`features/billing/{rentalEngine,rateEngine,historyEngine}.ts`,
`features/customer/{repository,screen}.ts`,
`features/payment/{paymentService,splitReceiptService}.ts`,
`features/invoice/{model,renderer,archive,printer}.ts`,
`features/notification/{reminders,detectedPayments}.ts`,
`features/whatsapp/{reminderComposer,serviceClient}.ts`,
`features/backup/{parser,validator,restoreCoordinator}.ts`,
`auth/{session,roles}.ts`,
`data/{firestoreRepository,offlineQueue,migrations}.ts`,
`native/android/{notificationListener,backgroundWorker,fileShare,print}.kt`.

Port equations from **`app.js` and `split-payments.js` first** with golden fixtures. Keep raw record field names, doc keys, invoice numbering, cycle attribution and server-side guard invariants. Modernize UI and rendering independently; never silently rewrite business rules while redesigning visuals.

Acceptance: every source route/action mapped to a native button or documented capability; zero unverified financial discrepancies across representative historical backups; verified offline and conflict semantics; secure Firestore access; all signed APK upgrades and backup restore tests passed; error paths, Android permissions, notifications and WhatsApp manually verified on target devices.

## 31. Missing or Incomplete Functionality

Current native rewrite lacks: production Firebase auth and live sync, cloud guarded transactions, complete custom shop conversion, lossless wood return/addition UI, precise historic payment/cycle accounting, native signed invoice archive/PDF/image, automated reminders/payment listener, WhatsApp service controls, production-grade backup restore, native admin privileges/audits and full feature parity. The isolated JSON importer preserves raw fields but does not by itself implement those operations.

## 32. Final Findings and Recommendations

1. **Protect live business data first.** Introduce authenticated Firestore rules and role checks before production native access.
2. **Freeze the business contract.** Use `main` and verified backup fixtures to build golden-master tests for every rental/payment operation.
3. **Prioritize payment integrity and backups.** Replace optimistic financial confirmation and clear-before-write restore.
4. **Port feature by feature.** Keep the existing v1.8.2 production app available; the React Native APK remains a separate test package.
5. **Verify actual buttons and devices.** Compile success is not evidence of semantic accuracy, print correctness, notification access, or WhatsApp delivery.
6. **Only ship a replacement after an exhaustive parity checklist** covering all 30 scenarios, security, recovery and signed upgrade.

### Calculation portability template (TypeScript-like pseudocode)

```ts
function rent(snapshot, rates) {
  const material = sum(MATERIALS.map(m => round2(snapshot.qty[m] * rates[m.rateKey])));
  const wood = sum(WOODS.map(w => round2(
    sum(Object.entries(snapshot.wood[w.key])
      .map(([feet,pieces]) => Number(feet) * pieces)) * rates[w.rateKey]
  )));
  return round2(material + wood);
}
for (let idx = 1, start = bill.startDate; start <= asOf && idx < 500; idx++) {
  const snapshot = applyEffectiveAdditionsAndReturns(bill, idx);
  const charge = round2(rent(snapshot, ratesOf(bill)) + (idx === 1 ? transport(bill) : 0));
  cycles.push({idx, start, end: addCalendarDays(start, bill.cycle_days - 1), charge});
  start = addCalendarDays(start, bill.cycle_days);
}
const due = round2(sum(cycles.map(c => c.charge)));
const paid = round2(sum(bill.payments.map(p => p.amount)));
const pending = Math.max(round2(due - paid), 0);
```

**Accuracy note:** This pseudocode is an explanatory porting guide, not a complete reimplementation. Confirm differences in rounding, timezone, customer credit and custom conversion against original tests before deployment.


---

# S.A Traders financial calculation reference

Source of truth for historical behavior: original `app.js` at main commit `0a73966434e05199910a1a351ff0b84b86d3a09d`. New native equivalent: `react-native/src/domain.ts`; operational validation: `ledger.ts`. Values below use INR. All dates are YYYY-MM-DD. Source line numbers are 1-based. This is a financial behavior reference, not a certification of all customer data.

## Core function contracts

| Function / original source | Inputs, types and defaults | Exact rule / output | Callers and caveats |
|---|---|---|---|
| `round2`, app.js:45 | any numeric-coercible value; nonfinite → 0 | Math.round((Number(value)+Number.EPSILON)×100)/100 | All amounts. Binary floating point retained for parity. Not arbitrary precision decimal arithmetic. |
| `ratesOf`, :107 | bill object, optional rate fields | Number per rate field; default only when nonfinite. Undefined uses default; empty string/null coerce to zero. Returns 10-rate map. | hydration, forms, invoices. Bill rates override global constants; editing source defaults does not change stored rates. |
| `baseQty`, :108 | bill; six quantity fields | max(trunc(Number(qty) or 0),0) | source snapshots and physical balances; fractional counts truncate. New writes reject fractions. |
| `baseWood`, :109 | four expression strings, default '' | parseComboSizes for each | Original parser ignores unmatched text. New writes reject it, imported text keeps original parsing behavior. |
| `woodStats`, :110 | length→piece map; numeric rate | pieces=Σtrunc(p); raw feet=ΣNumber(length)×trunc(p); total_feet=round2(raw feet); amount=round2(raw feet×rate) | Do not calculate amount from the already rounded total_feet. No standalone validation here. |
| `calcRent`, :111–115 | qty map; wood maps; rate map | Each material line amount=round2(nonneg(qty)×rate). Each wood amount from woodStats. materials_total=round2(Σline amounts); wood_total=round2(Σwood amounts); rent_total=round2(material total+wood total). | hydration, custom, material report and all cycle invoices. Per-line rounding is material. Returns line metadata and wood totals. |
| `transport`, :116 | trips default0; charge/loading/unloading numeric default0 | up=nonneg(up trips)×up charge; down similarly; components rounded independently for display; total=round2(raw up+raw down+loading+unloading) | first cycle only for normal bill; all included once in custom/converted bill. Imported negative fees can reduce due because original helper does not clamp fees. New UI blocks them. |
| `cycleIndex`, :117 | Date start, integer days, Date d | if d≤start return1; else floor(floor((d−start)/86400000)/max(days,1))+1 | rental event dating. Native date-only arithmetic avoids DST duration changes. |
| `effectiveCycle`, :118 | same as cycleIndex | cycleIndex+1 | return/addition. Same-day start event affects cycle2, not cycle1. |
| `historyTotals`, :119–123 | list default[]; items map and wood map optional | Sum all nonnegative material pieces; merge wood maps by length; return `{mat,wood}` | physical outstanding ignores event dates/effective cycles. Future-dated history is included in physical balance immediately, as in source. |
| `snapshotForCycle`, :124–129 | bill; cycle index idx | Select history where trunc(effective_from_cycle, default999999)≤idx. Sum additions and returns separately. qty=max(base+plus−minus,0); wood=subtractMaps(addMaps(baseWood,plusWood),minusWood). | Do not clamp intermediate events sequentially. Missing effective cycle affects physical totals but not normal billed cycles. |
| `hydrateBill`, :130–141 | raw bill; dates/status; payments/history default[]; status defaultopen | clone; physical balances from all history. If converted, dispatch hydrateConvertedCustom. days=max(trunc(cycle_days, default30),1). Iterate starts through today or valid closed_at, idx<500. Every cycle charges full snapshot rent, plus transport only idx1. due=round2(sum cycle totals); paid=round2(sum payment amounts); advance_locked=round2(advance_amount); rent_paid=paid; pending=max(round2(due−paid),0). | UI, reports, invoices, reminders. Invalid start returns no cycles/due0 and pending0, while payments and advance remain. Future start has no cycles. No automatic deposit offset/refund. |
| `hydrateCustom`, :142–144 | base bill quantities/rates/transport/payments | R=round2(material+wood); advance=R; vehicle=round2(rounded up+rounded down); grand=round2(R+vehicle+rounded loading+rounded unloading+advance). paid sum; pending=max(round2(grand−paid),0). | One-time custom bill; arbitrary manual advance overwritten. See fractional transport distinction below. |
| `hydrateConvertedCustom`, :145–147 | custom-professional bill | R=calcRent(base).rent_total; advance=R; grand=round2(R+transport.total+advance). Exactly one cycle with rent=round2(R+advance), transport=transport.total. paid=sum; pending capped at0; derived status closed if pending0 (unless already explicitly closed). | Does not charge recurring cycles; ignores material history for pricing. Grand can differ from unconverted custom on fractional-paise handling components. |
| `physicalOutstanding`, :149 | hydrated bill | returns balance_qty and balance_wood | stock and reports; closure alone does not imply materials were returned. |

`parseComboSizes`, :99–103: replace comma/newline/+ with spaces; match positive decimal length × positive decimal quantity using x/X/×/*; quantity truncates; discard nonpositive; combine identical numeric lengths. `mapToText`, :104: numeric length ascending, positive whole quantities, joined with +. `addMaps`/:105 and `subtractMaps`/:106 remove entries ≤0.

## Rates and units

| Item | Default | Charged quantity |
|---|---:|---|
| Jackey | 65 | pieces per full rental cycle |
| 9 Jackey | 100 | pieces per full rental cycle |
| Sheet | 35 | pieces per full rental cycle |
| Half Sheet | 30 | pieces per full rental cycle |
| Span | 100 | pieces per full rental cycle |
| 3M Inner | 60 | pieces per full rental cycle |
| 12 Ft Wood | 18 | total measured feet per full cycle |
| 9 Ft Wood | 18 | total measured feet per full cycle |
| 6 Ft Wood | 15 | total measured feet per full cycle |
| Runner | 7 | total measured feet per full cycle |

The wood category name does not force the entered length. An 8-foot entry in wood_12 is charged as 8 feet. Rates live in each bill's *_rate fields. Default rate edits affect missing/new fields, while saved per-bill rates remain authoritative.

## Five wood examples

| Expression | Parsed map | Pieces | Feet | Rate | Amount |
|---|---|---:|---:|---:|---:|
| 8×5+10×2 | {8:5,10:2} | 7 | 60 | 18 | 1,080 |
| 8.5×3 | {8.5:3} | 3 | 25.5 | 18 | 459 |
| 8×2+8×3 | {8:5} | 5 | 40 | 18 | 720 |
| 6*10,9x2 | {6:10,9:2} | 12 | 78 | 15 | 1,170 |
| 12x0+4x2 | {4:2} | 2 | 8 | 7 | 56 |

Original edge examples: `8×2.9` gives 2 pieces; new form rejects fractional pieces. `nonsense 8×2` still gives16 feet in the legacy parser, while new entry validation rejects the whole expression. Decimal lengths are permitted. Returning 2 pieces of 8ft from 8×5+10×2 leaves 8×3+10×2=44ft; later cycles at18/ft charge792 instead of1,080. Returning a 9ft piece when no9ft piece remains is rejected even if enough total feet exist.

## Four-cycle chronological scenario

Bill starts 2026-01-01; 15-day cycles; 2 Jackey×65=130; wood8×2×18=288. Base rent418. First-cycle up transport150; security deposit200 is separate. Payment100 is recorded. Return1 Jackey dated January10 affects cycle2. Add2 Sheets dated January20 affects cycle3.

| Cycle | Dates inclusive | Snapshot / rent | Transport | Cycle due | Cumulative due | Pending after payment100 |
|---|---|---|---:|---:|---:|---:|
| 1 | Jan1–Jan15 | 2Jackey+16ft wood =418 | 150 | 568 | 568 | 468 |
| 2 | Jan16–Jan30 | 1Jackey+16ft wood =353 | 0 | 353 | 921 | 821 |
| 3 | Jan31–Feb14 | previous+2Sheets =423 | 0 | 423 | 1,344 | 1,244 |
| 4 | Feb15–Mar1 | unchanged423 | 0 | 423 | 1,767 | 1,667 |

A return on Jan15 still affects cycle2; a return on Jan16 affects cycle3. Close on Jan16 charges the full second cycle, with no proration. Closing on Jan15 charges only cycle1. For20 days starting Jan1, cycles end Jan20, Feb9, Mar1, Mar21. For30 days, Jan1–Jan30; Jan31–Mar1; Mar2–Mar31; Apr1–Apr30. Leap-year2028 Jan31+29 days reachesFeb29. Native strict date parsing rejects2026-02-30; original JS Date parsing can normalize it. The original499-cycle ceiling can truncate very old bills and must remain visible as a risk.

## Custom Shop complete example

10Jackey×65=650. Wood8×5×18=720. R=1,370. Up/down transport total200, loading80, unloading50. Automatic advance1,370. Grand=1,370+200+80+50+1,370=3,070. Pay1,500 → pending1,570. Convert → professional bill retains one cycle, rent2,740 and transport330, total3,070. Further calendar cycles do not increase this converted total. Normal rental with the same materials instead charges1,370 rent per full cycle, first-cycle handling330, and keeps any normal advance separately.

**Rounding caveat discovered during review:** unconverted `hydrateCustom` adds independently rounded transport components; converted custom adds `transport.total`, which rounds their unrounded sum. These can differ by ₹0.01 with fractions of a paise. The native implementation must reproduce each source formula separately rather than assuming their totals always match. Test each path with fractional charges; ordinary two-decimal user input normally avoids this distinction.

## Payment and split reference

Normal/converted total_paid=round2(Σpayment.amount), including legacy unassigned payments. pending=max(round2(due−paid),0). The normal advance never participates in this subtraction. Overpaid=max(round2(paid−due),0) is a native visibility field, not an invented bank refund. Deleting a manual payment removes the entire nested entry and adds its complete preimage to payment_audit. Receipt-linked payments are corrected together to keep credit/allocations consistent.

Cycle-paid sums only payments matching **index, start date and end date**. Legacy payments lacking this metadata reduce whole-bill pending but are not guessed into a cycle. Split capacity=min(whole-bill pending, max(cycle.total−cycle-assigned-paid,0)). Multiple selected cycles must also respect the same bill's remaining pending. The split engine uses integer paise, not float summation.

₹5,000 receipt across A/B/C: A2,000+B1,500+C1,500=5,000; credit0. Partial allocation A2,000+B1,000+C500=3,500 requires explicit customer credit1,500; it is not an unnamed unallocated cash balance. Correcting to A3,000 and credit2,000 removes the original linked payments/credit, records correction audit and stores the new set together. Receipt transaction ID/reference and customer cannot silently change during correction. Manual payments may exceed balance; split allocations may not.

## Native implementation boundaries

All exported functions are available as actual TypeScript in `react-native/src/domain.ts`, rather than an incomplete conceptual pseudocode replacement. `scripts/full-parity-check.cjs` evaluates the original functions in an isolated VM and compares golden outputs. Strict new-entry validation, date-only arithmetic, explicit overpaid display and guarded cloud acknowledgements are implementation improvements; no automatic discount, penalty, refund, deposit application or prorated rent was added.


---

# Database and integration reference

Original evidence: `firebase-db.js:3–4` (collection keys), `app.js` create/save handlers, `split-payments.js`, Android bridges and main Firestore rules. Native equivalent preserves the same keys and unknown properties in compatible JSON. Field types describe implemented record shapes; there is no deployed server schema validator enforcing all of them. R = needed for the workflow; O = optional/legacy/derived. Dates and examples below are synthetic.

## Top-level records

| Collection | Primary key | Relations / ownership |
|---|---|---|
| bills | bill_no string, R | customer mobile; nested payments and events; cycles derived |
| customers | mobile string, R | exact original string key; native receipt grouping normalizes country code |
| customBills | bill_no string, R | converted professional bill uses same number in bills; converted_to_professional suppresses duplicate listing |
| inventory | item string, R | six piece item names and four wood category keys |
| slips | slip_no string, R | proof record; no automatic rental/inventory mutation |
| challans | challan_no string, R | proof record; no automatic rental/inventory mutation |
| settings | key string, R | value may be terms, counters, split receipt, alias or other settings |

There are no separate original Firestore collections named payments, rentalCycles, returns, users or paymentReceipts. Payments/history are nested, cycles computed, receipt records in settings. The original users screen reports Firebase Authentication disabled; no real server role model exists in main. The new optional connector uses Firebase Auth, with an undeployed example claim rule in `react-native/firestore.authenticated.example.rules`.

## Bill dictionary

| Field(s) | Type / required / default | Meaning / validation / example |
|---|---|---|
| bill_no | string R | document key, nonblank unique per store; '2502' |
| name | string R for new native bill | customer display name; 'Sample Customer' |
| mobile | string O, '' | customer relationship key; leading zeros preserved in raw backup |
| place | string O, '' | construction site/location |
| start_date | date string R | strict valid date for new native entries; '2026-01-01' |
| cycle_days | number R,30 | UI15/20/30; original engine allows positive arbitrary number; native new form permits only listed values |
| jackey_qty, jackey9_qty, sheet_qty, half_sheet_qty, span_qty, inner3m_qty | number O,0 | original nonnegative truncated piece counts; native new writes require whole finite counts |
| corresponding *_rate | number O, defaults65/100/35/30/100/60 | per-piece full-cycle rates; stored per bill |
| wood_12, wood_9, wood_6, runner | string O,'' | length×pieces expressions, e.g. '8×5+10×2' |
| wood_12_rate, wood_9_rate, wood_6_rate, runner_rate | number O,18/18/15/7 | per-foot full-cycle rates |
| transport_up_trips, transport_down_trips | number O,0 | original clamps/truncates counts; new UI nonnegative |
| transport_up_charge, transport_down_charge | number O,0 | amount per trip |
| loading_charge, unloading_charge | number O,0 | one-time handling amounts |
| advance_amount | number O,0 | normal security deposit; custom automatically R=material+wood |
| status | string O,'open' | normal open/closed; old custom may use 'custom'; normalized regular imports open/closed |
| closed_at | date string O | end accrual date, if status closed and date valid |
| calculation_type | string O | 'customshop_professional' triggers single-cycle converted behavior |
| payments | Payment[] O,[] | full payment ledger, including legacy unallocated entries |
| return_history, additional_history | ItemChange[] O,[] | effective rental snapshot history |
| payment_audit | object[] O,[] | removed/corrected payments and reason/actor/time |
| created_at, updated_at, converted_at | ISO timestamp string O | metadata; retain unknown original metadata |
| created_by, updated_by, closed_by, converted_by | string O | source client actor label; not proof of authenticated server principal |
| print_rules, terms_conditions | string O | per-bill print override; fallback settings used when absent |
| converted_from_custom, converted_to_professional, dashboard_visible | boolean O | conversion linkage / suppression |

Hydrated derived fields include rates, base_qty, base_wood_maps, return_totals, additional_totals, balance_qty, balance_wood, balance_wood_text, transport_breakdown, cycles, total_due, total_paid, advance_locked, rent_paid, pending and current_cycle_index. They must be recomputed rather than trusted as persisted financial truth.

## Payment and history dictionary

| Record / field | Type / default | Meaning |
|---|---|---|
| payment_id | string O in legacy, generated in new | stable identity; legacy id is preserved |
| payment_date | date string O | legacy date accepted; native writes canonical payment_date |
| amount | number R | positive new payment, up to2 decimal input; zero historical entries preserved; invalid/negative import rejected |
| method | string O | Cash/UPI/Bank for manual forms |
| note | string O,'' | operator description |
| cycle_index | number O | assigned cycle, generally1-based; absent legacy remains unassigned |
| cycle_start_date, cycle_end_date | date strings O | both must exactly match selected cycle for cycle-paid reporting |
| receipt_key | string O | settings receipt identity; disallows individual deletion |
| detected_payment_id, transaction_reference, payment_source | string O | notification suggestion identity, bank/UPI reference and source |
| ItemChange.rid / aid | string O legacy, new generated | return/addition event identity |
| ItemChange.date | date string R for new | chosen operational date |
| ItemChange.effective_from_cycle | number O legacy | next cycle after date's cycle; missing defaults to999999 in pricing |
| ItemChange.items | item-key→number object, default{} | six nonnegative piece counts |
| ItemChange.wood | wood-key→length-map object, default{} | e.g. {wood_12:{'8':2}}; unlike bill expression strings |
| note, created_by, created_at | string O | event description/metadata |

Example event: `{rid:'ret-example',date:'2026-01-10',effective_from_cycle:2,items:{jackey:1},wood:{wood_12:{'8':2}}}`. Exact length availability is validated before new returns. Deleting an addition that would make total outstanding negative is blocked by the native workflow.

## Customers / inventory / documents

Customers: mobile string R (primary key); name string R; place string O; customer_id string O (not primary key); created_at O; payment_credit_receipts array O (receipt_key, amount, created_at); payment_credit_balance number O (sum of that array). Credit is not automatically deducted from rental due or treated as a refund.

Inventory: item R; stock_qty integer O for six materials; stock_map map O for wood. Available pieces = stock_qty − physical outstanding across open bills (can show shortage); wood subtracts exact length maps and drops nonpositive lengths, matching original behavior. Closing a bill does not add a return event.

Slips: slip_no R, type DELIVERY/RETURN, date, customer_name, mobile, place, trip_no default1, vehicle_no, driver_name, note, items map, wood map **of expression strings**, created_at/by. Challans: challan_no R, type, date, note, items map, wood expression map, created_at/by. Unlike rental event wood maps, document wood is stored as user expression text. Original prefixes SADL/SART/SACH and per-type counters are operational numbering conventions.

## Split receipt structure

Settings `{key:receipt_key,value:receipt}`. Receipt fields: kind='split_payment_receipt'; receipt_key; item `{id,reference,amount,source,...original detection}`; payment_date; amount; allocations[]; credit; customerKey; customer_mobile/name; version integer; status='active'; created_at/updated_at; audit[]. Allocation includes store, bill_no, cycle_index or null, cycle_start_date/end_date, amount and payment_id. Alias record key='payment_receipt:id:'+detectedID, value `{kind:'split_receipt_alias',receipt_key}` when primary reference key differs.

Normal receipt primary key: normalized reference prefixed payment_receipt:ref:, otherwise detected ID prefixed payment_receipt:id:. Referenced payments must point to the same primary receipt. New native local allocation writes a full ledger atomically in one AsyncStorage key. Cloud publish uses a Firestore transaction after baseline comparisons; original guardedBatch expected-record operation is not a generic merge.

## JSON backup contract

```
{schema:'sa-traders-firebase-v1',exported_at:ISO,
 business:{name,address,phone,...},
 data:{bills:[],customers:[],customBills:[],inventory:[],slips:[],challans:[],settings:[],nativeNotes?:[],...}}
```

Fields above illustrate shape, not literal strict JSON syntax. Unknown fields and nested legacy payment identities are retained. Native parser accepts this exact schema, BOM and missing optional collections; it rejects corrupt JSON, wrong arrays, duplicate primary keys, negative/nonfinite payments and malformed history objects. Original normalizeBackup supports additional historical aliases; the native importer is not certified for every pre-Firebase backup. Native Merge overwrites matching incoming fields; Replace replaces local data only after safety copy. No cross-store live cloud clearing is performed.

## Native integration boundary

`SATradersPayments.candidates()` returns local notification suggestions; `dismiss(id)` marks reviewed; `openSettings()` opens listener-access settings. `syncReminders(json,enabled)` schedules the original WorkManager engine; `reminderHistory()` returns bounded local notification history. The listener requires Android BIND_NOTIFICATION_LISTENER_SERVICE protection and user grant; POST_NOTIFICATIONS is separate on Android13+. It reads an allowlisted set of app notifications, not the full SMS inbox. Minimum AndroidAPI26. Main and website original flavors differ in payment-detection availability.

`expo-print` creates/prints HTML PDFs; `expo-sharing` uses Android share intents and scoped files. `react-native-view-shot` captures a native invoice PNG preview. No WebView renders the React Native app.

## Firebase / WhatsApp operational semantics

Cloud connector initializes only the project config entered by the operator and signs in email/password. Pull reads all seven stores and records full-document baselines; local safety backup precedes replacement. Publish checks every touched baseline in a transaction; conflict rejects all writes. New document creation expects absence. Omitted existing cloud records cannot be silently deleted. >400 changed documents rejected. No auto background sync and no live Firebase test are claimed. Source main open rules remain a Critical risk until explicitly replaced server-side.

WhatsApp client mirrors `/v1/status`, `/v1/link`, `/v1/logout`, `/v1/reminders`. Authenticated service token stays in SecureStore. QR or phone-code pairing depends on actual server connection events. Each send uses a stable requestId; retry preserves it, changed message/new request requires manual verification after uncertain outcomes. SQLite service ledger stores SUBMITTING/ACCEPTED/UNKNOWN to prevent blind repeats. ACCEPTED means service accepted, not a verified delivery/read receipt. No actual customer message was sent during this work.


---

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
| Invoice image sharing | Missing | I/U | Native view capture and Android PNG sharing; phone U |
| Firebase auth / conflict protection | Missing | I/U | optional explicit authenticated connector; no live account tested |
| Automatic cloud listeners/offline cloud queue | Missing | P | local offline ledger; explicit sync instead of continuous cloud updates |
| JSON import/export | I local | I local | parser/roundtrip tests; merge conflict policy needs careful review |
| Inventory | P | I/U | physical material and per-length wood availability; phone U |
| Slips/challans | Notes only | I/U | Native forms preserve original fields and generate material PDFs; phone U |
| WhatsApp service | Missing | I/U | existing API client; service test suite passed with mocks; actual pairing/delivery U |
| Original user/role administration | Missing | P | local PIN; server Auth roles require deployment/administration |
| Full reports/CSV | P | I/U | date-filtered payment CSV, physical tracker, active rental PDF; phone U |

## Executed validation

- `npm run typecheck`: passed.
- `npm run check`: passed native-only integration checks.
- `npm test`: passed existing rental smoke, JSON roundtrip/validation and new source comparison suite.
- Golden suite: **3,168 checks**, 450 synthetic bills, 15/20/30-day cycles, fractional rates, decimal wood, transport, returns/additions, closures and custom conversion. Also rejection checks for malformed wood, excessive returns, duplicate receipts, overallocations and duplicate manual entries. Re-run with Asia/Kolkata timezone passed.
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

Final review added native invoice PNG previews/sharing, per-length wood inventory, original delivery/return/challan forms, detailed payment CSV and active-material PDFs. Fractional transport component rounding is separately covered for Custom Shop and converted Custom Shop; see FINANCIAL_CALCULATION_REFERENCE.md. Customer physical material summaries include closed bills, matching the original behavior that closure does not automatically return stock. Android APK targets ARM64 and ARMv7 devices, API26+. Browser screenshot execution was unavailable because the browser download failed; no visual/device pass is claimed.


---

# QA and risk reference

All scenarios below are acceptance specifications. **None is marked as a physical-device end-to-end pass.** Automated math/receipt/backup checks are separately evidenced in REACT_NATIVE_VERIFICATION_20261025.md. The numeric rental fixture is 2 Jackey×65 + 8ft×2×18 =418 rent; first-cycle transport150; default15days from2026-01-01.

## T01 — New customer
- Preconditions: Empty customer list.
- Input: Name Sample; mobile 9000000000.
- Steps: Save; restart; open Customers.
- Expected result and financial totals: One mobile-keyed customer; zero financial totals.
- Related functions: `saveCustomer/localStore`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T02 — New rental bill
- Preconditions: New unique number; start Jan1.
- Input: 2 Jackey; 8×2 wood; 15 days; transport150.
- Steps: Save; view Jan10.
- Expected result and financial totals: Rent418; first due568; paid0; pending568; advance separate.
- Related functions: `validateBill/calculateBill`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T03 — Multiple materials
- Preconditions: Start Jan1.
- Input: 2 Jackey65; 3 Sheet35; 1 Span100.
- Steps: Save; view first cycle.
- Expected result and financial totals: Material335; wood0; due335.
- Related functions: `calcRent`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T04 — Multiple wood lengths
- Preconditions: No material/fees.
- Input: 8×5+10×2 at18/ft.
- Steps: Save; inspect table.
- Expected result and financial totals: 7pieces; 60ft; wood1080.
- Related functions: `sizes/woodStats`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T05 — 15-day rent
- Preconditions: Start Jan1.
- Input: 15-day cycle.
- Steps: Inspect Jan15 and Jan16.
- Expected result and financial totals: Jan15 due568; Jan16 due986 absent changes.
- Related functions: `cycleFor/calculateBill`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T06 — 20-day rent
- Preconditions: Start Jan1.
- Input: 20-day cycle; rent418; transport150.
- Steps: Inspect Jan20 and Jan21.
- Expected result and financial totals: Due568 then986.
- Related functions: `cycleFor/calculateBill`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T07 — 30-day rent
- Preconditions: Start Jan1.
- Input: 30-day cycle; rent418; transport150.
- Steps: Inspect Jan30 and Jan31.
- Expected result and financial totals: Due568 then986.
- Related functions: `cycleFor/calculateBill`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T08 — First-cycle transport
- Preconditions: Rent418.
- Input: Up1×150; no other handling.
- Steps: Open cycle1 and2.
- Expected result and financial totals: Cycle1 568; cycle2 418; cumulative986.
- Related functions: `transport/cycleFor`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T09 — Second-cycle calculation
- Preconditions: Unchanged original fixture.
- Input: As of Jan20 for15-day bill.
- Steps: View cycles.
- Expected result and financial totals: 2cycles; due986; deposit excluded.
- Related functions: `calculateBill`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T10 — Third-cycle calculation
- Preconditions: Unchanged original fixture.
- Input: As of Feb1.
- Steps: View cycles.
- Expected result and financial totals: 3cycles; due1404.
- Related functions: `calculateBill`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T11 — Mid-cycle material return
- Preconditions: 2Jackey base; no prior returns.
- Input: Return1 onJan10 effective2.
- Steps: Save; inspect cycles1/2.
- Expected result and financial totals: Cycle1 unchanged568; cycle2 353; cumulative921.
- Related functions: `changeMaterial/snapshotForCycle`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T12 — Additional material
- Preconditions: Previous return applied.
- Input: Add2Sheets onJan20 effective3.
- Steps: Inspect cycle3.
- Expected result and financial totals: Cycle3 423; cumulative1344.
- Related functions: `changeMaterial/snapshotForCycle`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T13 — Partial payment
- Preconditions: Unchanged fixture after2cycles.
- Input: Pay100; assigned cycle2.
- Steps: Save; inspect bill and cycle.
- Expected result and financial totals: Whole due986; paid100; pending886.
- Related functions: `recordPayment/cyclePaid`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T14 — Full payment
- Preconditions: Due986; paid100.
- Input: Pay886.
- Steps: Save; restart.
- Expected result and financial totals: Paid986; pending0.
- Related functions: `recordPayment/calculateBill`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T15 — Advance
- Preconditions: Due986; no payments.
- Input: Security deposit200.
- Steps: Save; close normally.
- Expected result and financial totals: Due986; pending986; deposit200; no automatic refund.
- Related functions: `calculateBill/confirmClose`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T16 — Split receipt
- Preconditions: Three eligible bills withcapacity≥2000/1500/1500.
- Input: Received5000 → A2000/B1500/C1500.
- Steps: Review; confirm; restart.
- Expected result and financial totals: Payments sum5000; credit0; receipt+aliases persist.
- Related functions: `allocateReceipt`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T17 — Duplicate transaction
- Preconditions: Saved receipt above.
- Input: Same bank reference and detectionID.
- Steps: Resubmit.
- Expected result and financial totals: Reject; no new payments; paid totals unchanged.
- Related functions: `allocateReceipt/cents`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T18 — Payment deletion
- Preconditions: Paid100; PIN configured.
- Input: Reason duplicate; correct PIN.
- Steps: Delete manual payment; inspect audit.
- Expected result and financial totals: Paid decreases100; pending increases100; complete preimage audited.
- Related functions: `HistoryActions/audit`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T19 — Custom Shop
- Preconditions: 10Jackey650; wood720.
- Input: Transport200; loading80; unloading50; paid1500.
- Steps: Create; inspect.
- Expected result and financial totals: R1370; advance1370; grand3070; pending1570.
- Related functions: `calculateCustom`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T20 — Custom conversion
- Preconditions: Custom case above; unique target number.
- Input: Convert.
- Steps: Confirm PIN; view future date.
- Expected result and financial totals: Single cycle3070; paid1500; pending1570; original custom suppressed.
- Related functions: `convertCustom/calculateBill`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T21 — Bill closure
- Preconditions: 15-day fixture; normal open bill.
- Input: CloseJan16.
- Steps: Confirm PIN; inspect March.
- Expected result and financial totals: 2full cycles; due986; no later cycles; no deposit refund.
- Related functions: `confirmClose/calculateBill`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T22 — Bill deletion
- Preconditions: Unlinked bill; backup exists.
- Input: Correct PIN and confirm.
- Steps: Delete; restart.
- Expected result and financial totals: Record absent; unrelated bills unchanged; linked receipt bill rejected.
- Related functions: `confirmDelete`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T23 — Invoice generation
- Preconditions: Cycle2payment100.
- Input: Print cycle2; PNG fullstatement; nextcycle.
- Steps: Compare PDF rows; share image.
- Expected result and financial totals: Cycle2 rent418; assignedpaid100; cyclepending318; wholepending886.
- Related functions: `billHtml/InvoiceImage/cyclePaid`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T24 — WhatsApp sharing
- Preconditions: Valid PDF; WhatsApp installed.
- Input: Select Android share target.
- Steps: Share; inspect recipient before sending.
- Expected result and financial totals: Correct file; no API delivery claim; no payment mutation.
- Related functions: `expo-sharing`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T25 — Notifications
- Preconditions: Projected open bills; permission granted.
- Input: Today Jan16; overdue/unpaid andfuture cycles.
- Steps: Enable; background; restart/reboot.
- Expected result and financial totals: Date categories match cycle start; once-per-day worker history; OS delay permitted.
- Related functions: `reminders/BillingReminderWorker`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T26 — JSON import
- Preconditions: Backup export with payments/history.
- Input: Valid file; duplicateIDs; malformedhistory.
- Steps: Preview valid; merge/replace; reject invalid.
- Expected result and financial totals: Counts/nestedIDs retained; safety copy; no livecloud write; invalid JSON leaves ledger unchanged.
- Related functions: `parseLegacyBackup/mergeBackup`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T27 — Firebase synchronization
- Preconditions: Authenticated isolated testproject.
- Input: Two clients update same bill aftersamepull.
- Steps: Publish first then second.
- Expected result and financial totals: First commits; second conflicts; transaction no partialreceipt commit.
- Related functions: `pullCloud/publishCloud`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T28 — Offline/network failure
- Preconditions: Local ledger with existing bill.
- Input: Disable network; recordpayment; attemptcloudpublish.
- Steps: Restart; inspect.
- Expected result and financial totals: Local payment persists; cloud errors visible; no fake server acknowledgment.
- Related functions: `localStore/cloud`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T29 — App restart
- Preconditions: Local records and PIN exist.
- Input: Force stop; relaunch; unlock.
- Steps: Inspect bill/payments/credit.
- Expected result and financial totals: Same financial totals; listener/worker system grants retained; sign-inagain for cloud.
- Related functions: `loadLocal/useAdmin`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## T30 — Existing customer history
- Preconditions: One mobile; threebills inclclosed.
- Input: Returns/additions/payments on all.
- Steps: Open customer; compare reports.
- Expected result and financial totals: Sum allbill pending; customerphysicalsummary includesclosed unresolvedmaterials; inventory usesopenbills.
- Related functions: `CustomerMaterialSummary/shareCustomerReport`.
- Status: **Not executed end to end on Android.** Consult the automated suite for narrower executed assertions.

## Unresolved risks and classification

| ID | Severity | Evidence | Reproduction / impact | Correction / acceptance |
|---|---|---|---|---|
| SEC-01 | Critical | main firestore.rules allows public reads/writes | Unauthenticated client can access business records; not probed against live database | Deploy tested server-auth rules and admin claims; sample provided but not deployed |
| AUTH-01 | High | original fixed client login; native PIN is local | Client app lock does not authorize server access | Native uses optional real Firebase Auth; live authorization still needs provisioning |
| RESTORE-01 | High | app.js restore clears stores before upload | Mid-restore network failure leaves partial cloud state | Native restore is local-first; explicit conflict-checked publish; original cloud restore unchanged |
| MERGE-01 | High | legacyBackup.mergeBackup matching IDs overwrite incoming fields | Older backup can replace newer payment arrays if operator chooses Merge | Safety backup and explicit preview; review differences, use dedicated reconciliation before live rollout |
| CLOUD-01 | Medium | cloud.ts baseline then per-touched-document transaction | Explicit sync; no realtime updates or cloud deletes; two users can still view stale totals until pull | Conflicts abort writes; test concurrency and operational pull policy |
| HIST-01 | Medium | snapshots are recalculated from history | Historical event deletion can change invoice outputs | Payment/event audit retained; archive issued invoices externally; no immutable archive claimed |
| DATE-01 | Medium | original UTC today vs local parseDate | Around India midnight, original and native local-today cycle count may differ | Native date-only/localtoday fix; midnight/timezone acceptance required |
| ROUND-01 | Medium | hydrateCustom vs hydrateConvertedCustom transport order | Fractional-paise component charges can change total by0.01 on conversion | Native preserves both exact formulas; dedicated assertions |
| NATIVE-01 | Medium | listener and WorkManager rely on grants/OEM scheduling | Detection/background reminder may be suppressed on a phone | Test permissiondenial, grant, reboot, OEM battery behavior |
| STORAGE-01 | Medium | AsyncStorage fullledger serialization | Large file can exceed platform storage/row limits; olddata corruption must not be overwritten silently | Save failures surfaced; corruptledger recovery blocksbilling; export regularbackups; capacity test before largeimports |
| DELIVERY-01 | Medium | service ACCEPTED/UNKNOWN only | API acceptance is not proof of customer delivery | Stable requestID, no automatic unknown resend, inspect chat |
| UI-01 | Unverified | no local browser/physicaldevice | Screenshot/accessibility checks notexecuted | Verify fontscaling, touch, keyboard, longlists andPDFs on targetphones |
