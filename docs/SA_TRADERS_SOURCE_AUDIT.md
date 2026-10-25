# S.A Traders — Source Code and Functional Migration Audit

**Audit date:** 2026-10-25 · **Repository:** [Shivayt007/bills](https://github.com/Shivayt007/bills) · **Status:** source-grounded baseline / not feature-complete certification

**Scope and evidence:** Read source and recursive file trees of four branches. Relevant source paths and 1-based line references below refer to \`main\` unless the branch is specified. The source may change after this audit. GitHub CI is evidence of compilation/tests that ran, *not* proof of end-to-end business equivalence. No physical Android device was available. A user-provided \`sa-traders-firebase-v1\` sample dated 2026-10-24 was inspected locally for field shapes; customer identities and sensitive receipt data are intentionally omitted from this document. The React Native work described here is an **isolated native test build, not a full replacement of production**.

## 1. Executive Summary

The operational Android package is a **Java/Android WebView shell around a JavaScript accounting application**, backed by Firestore via a native JavaScript bridge, with native notification detection, background reminders, file sharing, and a separately deployed WhatsApp service. Branch \`main\` is the reference for billing behavior. A modern React Native launcher is not functional parity; native reimplementation requires faithfully reproducing every financial transformation, native bridge, source record and button transition. Several React Native interfaces are now native but advanced production functions remain missing.

**Release blockers:** Firestore rules currently allow unauthenticated reads and writes; app login is enforced only client-side. Backup restore clears collections before re-uploading records and is not atomic. The native rewrite does not support guarded split receipts, full cycle attribution, secure Firebase auth, printable production invoices or reminder services. **Do not use its financial output for live billing**.

## 2. Repository and Branch Inventory

Discovered branch heads when inspected:

| Branch | SHA prefix | Distinguishing content |
|---|---|---|
| \`main\` | \`0a739664\` | Original Android/WebView v1.8.2, 15 source web assets, Java bridges, WhatsApp service and production tests |
| \`feature/sa-traders-v1.8.0\` | \`a70c08b1\` | Older app lacking latest split-payment and WhatsApp server sources |
| \`feature/react-native-redesign\` | \`35b3c794\` before this audit's new commits | Expo/React Native interface, isolated AsyncStorage, TypeScript rental calculator, native UI components |
| \`feature/native-json-backup-import\` | \`14ab036c\` | React Native JSON import/export via document picker and file sharing; not a substitute for production persistence |

All four recursively returned non-truncated repository trees; no additional branches found. The root web assets and Android bundled assets are duplicated. For modern builds, \`android-app/app/build.gradle:67–89\` syncs root web assets into generated Android assets. **Do not edit only the older bundled copy and assume the APK will use it.**

### Important file inventory and dependency map

| Path | Role / callers / migration |
|---|---|
| \`app.js\` | Core web routes, financial calculations, CRUD, reports, admin, backup and invoice views; called by \`index.html\`, UI overrides, invoice and notification modules. **Financial source of truth.** |
| \`firebase-db.js\` | \`SAFirebase.DB\` API and cache, called throughout web code and \`split-payments.js\`; calls Android \`FirebaseDB\` bridge. Preserve store identifiers and callback semantics. |
| \`split-payments.js\` | Validates paise allocations, creates/reassigns receipt operations; calls \`DB.guardedBatch\` and native detected-payment candidates. Requires transactional native implementation. |
| \`ui-2026.js\`, \`ui-fixes.js\`, \`reference-ui.js\` | Replaces shell/navigation and enriches UI/cycle presentation; review before porting, not just base \`app.js\`. |
| \`invoice-2026.js\`, \`next-cycle-2026.js\`, \`invoice-share.js\` | Cycle-specific invoice data, payment attribution, next cycle, HTML rendering/image sharing. |
| \`notifications-2026.js\` | Upcoming/due/overdue buckets, notification settings, detected-payment review and sync to native worker. |
| \`whatsapp-reminders.js\` | Web setup, pairing status, editable reminder preview and dispatch via \`WhatsAppService\`. |
| \`app.bundle.min.css\` | Production responsive web styling; **not reusable as React Native styles**. |
| \`index.html\`, \`vendor/html2canvas.min.js\`, \`sa-traders-logo.jpg\` | Web boot scripts, rendering vendor asset, brand image. |
| \`android-app/app/src/main/java/com/satraders/billing/MainActivity.java\` | WebView, Android JS bridges, backup selection, file exports/sharing, notification permission/routes, print and lifecycle. |
| \`.../FirebaseBridge.java\` | Firestore operations, batched writes, guarded updates, stores and listeners. |
| \`.../PaymentNotificationService.java\`, \`.../PaymentParser.java\` | Android notification listener and payment SMS/app-notification parsing; notification permission/access is user controlled. |
| \`.../BillingReminderWorker.java\` | WorkManager 24-hour reminders, daily history/pagination. |
| \`.../WhatsAppBridge.java\` | HTTPS API client; Android-keystore-encrypted bearer token; JS receives only status/results, not secret. |
| \`.../InvoiceFileProvider.java\`, \`res/xml/invoice_paths.xml\` | Scoped file URI sharing for invoices and backup JSON. |
| \`android-app/app/src/main/AndroidManifest.xml\` | Activity, listener service, FileProvider and permissions. |
| \`android-app/app/build.gradle\` | App ID \`com.satraders.billing\`, Java 17, min SDK 26, target/compile SDK 35, v1.8.2, full/website flavors, signed release. |
| \`firestore.rules\` | Security policy. **CRITICAL**: \`allow read, write: if true\`. |
| \`whatsapp-reminders/src/{server,api,whatsapp}.js\`, \`Dockerfile\` | Separate Node.js WhatsApp pairing and reminder API; SQLite idempotency ledger. |
| \`tests/{ui,rental-cycle,split-payments,notifications,whatsapp-reminders}-test.cjs\` | JS regression checks, not full device acceptance. |
| \`tests/payment-parser-test.java\`, \`whatsapp-reminders/test/api.test.js\` | Parser and server API checks. |
| \`react-native/src/App.tsx\` | Native screens, user actions, local persistence. Not equal to web feature parity. |
| \`react-native/src/ProfessionalUI.tsx\` | Native styled fast billing, materials, cycles and customer-summary components. |
| \`react-native/src/domain.ts\` | Separate TypeScript rental computation; compare golden outputs to \`app.js\` before production. |
| \`react-native/src/{localStore,legacyBackup}.ts\` | Isolated AsyncStorage with typed JSON backup import/export. No Firestore writes. |
| \`react-native/scripts/{check-preview,domain-parity-check}.cjs\` | Build-time source/smoke checks; scope limited. |
| \`.github/workflows/build-react-native-preview.yml\` | Expo prebuild, typecheck, domain checks, Gradle assemble and APK artifact. |
| \`.github/workflows/{build-apk,build-release,whatsapp-reminders}.yml\` | Java Android/tested signed production builds and WhatsApp subsystem CI. |

Resources: Android icons in \`res/mipmap-*\`; colors, styles and splash drawables in \`res/values*\` and \`res/drawable*\`; scoped sharing and backups in \`res/xml\`. \`.github/workflows/enhance-bill-view.yml\` and \`fix-*.yml\` are automation/edit workflows, **not** app routes. Non-text binary assets were inventoried but not exhaustively decoded.

## 3. Technology Stack

Main: HTML/CSS/vanilla JavaScript SPA loaded in Android WebView; Java activity/services; AndroidX WebKit 1.12.1, WorkManager 2.9.1; Firebase Firestore BoM 33.16.0; Gradle Android plugin 8.7.3; Google Services plugin 4.4.2, Java 17. \`full\` flavor enables payment detection; \`website\` disables it via \`BuildConfig.PAYMENT_DETECTION_ENABLED\`. Server: Node 24, \`berryprotocol\` 0.1.10, \`qrcode\` 1.5.4 and \`node:sqlite\`. Native lab: Expo SDK 54, React Native 0.81.5, React 19.1, TypeScript 5.9, AsyncStorage 2.2.0.

## 4. System Architecture

\`UI click → SA.* handler → app.js validation / hydrate* → SAFirebase.DB → Android FirebaseBridge → Firestore\`. Firestore change listeners feed \`SADataCache\`; route rendering responds to store updates. Native \`MainActivity\` also receives \`window.Android.*\` calls for printing, sharing, backup, notification access and app actions; \`WhatsAppBridge\` forwards to the independent HTTPS reminder server. Financial logic **must not be independently guessed from UI labels**.

## 5. Complete Feature Inventory

Verified production modules: login/app lock, dashboard and filtering, rental bill creation/edit/close/delete, financial hydration, cycle payments and payment deletion audit, material/wood return and additional history, customer directory/history/materials, custom shop creation and conversion, inventory, total/active-rent/payment/customer reports, delivery/return slips, challans, print invoice/customer/next-cycle/custom/slip/challan/material reports, detected UPI payment review, split multi-bill receipt management, due reminders, WhatsApp setup/reminders, backup/import/reset, terms/admin and settings.

Native lab currently implements: native dashboard, invoices, quantity controls, customers, basic inventory, local payment entry, material quantity returns/additions, billing cycle screen, basic reports, slips/challan notes, text share, isolated JSON backup; other production features remain missing or partial.

## 6. Screen-by-Screen Analysis

\`app.js:192–208\` route dispatcher:
\`login\`, \`home\`, \`dashboard\`, \`about\`, \`notifications\`, \`bills\`, \`bill/{id}\`, \`edit/{id}\`,
\`custom\`, \`custom-new\`, \`custom-edit/{id}\`, \`custom-view/{id}\`,
\`reports\`, \`payment-report\`, \`material-rent-report\`, \`customer-materials/{mobile}\`,
\`customers\`, \`customer/{mobile}\`, \`inventory\`, \`slips\`, \`slip-new/{delivery|return}\`,
\`slip-view/{id}\`, \`challans\`, \`challan-new\`, \`challan-view/{id}\`,
\`admin\`, \`admin-users\`, \`admin-terms\`, \`admin-backup\`, \`open-bills\`,
\`materials\`, \`totals\`, \`return-bill\`,
and print routes \`print-invoice\`, \`print-customer\`, \`print-next-cycle\`,
\`print-custom\`, \`print-slip\`, \`print-challan\`, \`print-material-rent\`, \`print-customer-materials\`.
The dispatcher guards non-login screens with client login and shows \`Page not found\` for unmatched routes.

Additional UI lives in overrides \`ui-2026.js\`, \`ui-fixes.js\`, \`reference-ui.js\` and notifications/split modules. The complete route/button coverage must be derived from all four, not from a screenshot of \`app.js\` alone.

## 7. Every Button: Working Process Reference

| Visible action | Production handler and observed effect |
|---|---|
| New Bill | \`SA.go('edit/new')\` → \`renderBillForm\` → populate defaults, reserve suggested number, enter fields |
| Save rental bill | \`renderBillForm\`, \`billFromForm\`; duplicate check, create bill and optionally customer via \`DB.batch\`, refresh reminders |
| View/Edit bill | \`renderBill\` / \`renderBillForm(id)\`; load/hydrate record, update via \`DB.batch\` |
| Record Payment | \`SA.quickPayment\` → cycle select, amount/date/method/notes, duplicate guard; append payment |
| Delete Payment | \`SA.deletePayment\` → admin password + reason + checkbox, re-read/compare, append \`payment_audit\` deletion entry |
| Close/Delete Bill | \`SA.confirmBillAction\` → admin password + confirmation; set \`closed_at\` or delete the record |
| Return Material | \`SA.openReturn\` → \`saveHistory\`, validate against material/wood balance, append return event |
| Additional Material | \`SA.openAdditional\` → \`saveHistory\`, append future-effective additions |
| Delete return/addition | \`SA.deleteHistory\` → admin role + confirmation, removes matching history event, rehydrates on next render |
| Next Cycle / Customer / Standard Print | \`renderPrintNextCycle\`, \`renderPrintInvoice\`, customer print modes; native print or web print |
| Customer list/detail | \`renderCustomers\` / \`renderCustomer\`; search, open bills, history and material summary |
| Custom Shop / Convert | \`renderCustomForm\`, \`renderCustomView\`, \`SA.convertCustom\`; one-time custom price, then conversion |
| Inventory | \`renderInventory\`; change master quantity/wood size map, save to Firestore |
| Delivery/Return Slip | \`renderSlipForm\` and \`renderSlipView\`; create/view/print slip |
| Challan | \`renderChallanForm\` / \`renderChallanView\`; create/view/print |
| Reports / CSV | \`renderReports\`, \`renderPaymentReport\`, \`SA.exportPaymentCsv\` and material/customer report routes |
| Notifications | \`SA.renderNotifications\`; overdue/today/upcoming, payment candidate review |
| WhatsApp Reminder | \`SA.openWhatsAppReminder\` → verify bill & phone, preview/edit message, API send |
| WhatsApp Setup | \`SA.openWhatsAppSetup\`; server URL/token, pairing QR or phone code, status |
| Export/Share Backup | \`SA.exportBackup\` / \`SA.shareBackup\`; \`fullBackup\` over all seven collections |
| Choose Backup / Restore | \`SA.importBackup\` → \`normalizeBackup\` → user confirm → clear+batch import |
| Reset Data | \`SA.resetData\`; admin confirmation then clears business collections |
| Terms/User Settings | \`renderAdminTerms\`, \`renderAdminUsers\`; client-side admin role gate, settings saves |

This is the **business-action map**; dynamic per-input icons and every generated modal element require instrumented UI enumeration for full clickable-element certification.

## 8. Customer Management

Source: \`app.js:547–548\`; data keyed by \`mobile\`, optional \`customer_id\` and \`place\`, display \`name\`. Customers can have multiple bills, grouped by exact \`mobile\`; related bills determine customer pending and materials. Bills can also contain names and locations independently. Search uses normalized lowercase display strings, but stored mobile normalization requires additional testing. Avoid using \`customer_id\` as the sole migration merge key; original Firestore uses **mobile**.

Workflow: create bill/customer → customer record stored with mobile and sequential ID → view history → additional cycles/payments/returns → optional closure → customer remains. Beware changing mobile and orphaning historical bill associations.

## 9. Rental Billing Engine

Source \`app.js:99–149,281–305\`. Bill fields: \`bill_no\`, \`start_date\`, \`cycle_days\`, \`name\`, \`mobile\`, \`place\`, material \`*_qty\` and \`*_rate\`, wood expression and rate fields, trips/rates/loading/unloading, \`advance_amount\`, payments/history/status. \`billFromForm\` clamps material counts with \`nonneg\` and defaults rates through \`n\`. Bill number blank/duplicate rejected at save. Cycle dropdown offers 15/20/30 in web UI; \`billFromForm\` itself uses positive \`cycle_days\` rather than a hard allowlist.

## 10. Material Calculations

Definitions \`app.js:14–31\`; \`round2\` line 45, \`ratesOf\` 107, \`calcRent\` 111–115.

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

Rate override \`ratesOf(b)[key]=n(b[key],DEFAULT_RATES[key])\`: valid finite bill-specific rate wins; source default is fallback. Existing bills store their own rate fields on form save, so changing code defaults **normally** should not change stored old rates. However malformed/missing rates fall back to code defaults. Money is rounded to 2 decimals after each material amount and wood bucket: \`Math.round((n(v)+Number.EPSILON)*100)/100\`; note floating-point tie/negative behavior differs from proper integer paise arithmetic.

**Worked example:** 2 Jackey = 2×65 = ₹130; 8-ft wood, 2 pieces at ₹18/foot = 8×2×18 = ₹288; one-way transport ₹150. First-cycle billed = **₹568**; later unchanged cycles ₹418.

## 11. Wood Calculations

\`parseComboSizes\` \`app.js:99–103\` reads repeated \`feet × pieces\` segments separated by punctuation/newlines/spaces, accepting \`x\`, \`X\`, \`*\` and \`×\`; decimal feet accepted, fractional pieces truncated. Duplicate lengths combine. Invalid terms not matching regex are **silently ignored**; this must be replaced by a visible validation error in a production rewrite. \`woodStats\` line 110 sums \`pieces\`, \`total_feet=Σ(length×pieces)\`, \`amount=round2(total_feet×rate)\`.

Examples: \`8×5\` at 18 → 40ft / ₹720; \`8×5+10×2\` at 18 → 60ft / ₹1,080; \`8×2+8×3\` → 40ft / ₹720; \`7.5×4\` → 30ft / ₹540; \`10x1+8*2\` at 15 → 26ft / ₹390. Wood returns/additions use maps keyed by exact length, and \`subtractMaps\` prunes zero/negative entries (\`app.js:105–106\`).

## 12. Transport and Handling

\`transport\` line 116:
\`up=nonneg(up_trips)*n(up_charge)\`,
\`down=nonneg(down_trips)*n(down_charge)\`,
\`total=round2(up+down+loading+unloading)\`.
Normal \`hydrateBill\` line 139 includes transport only if \`idx===1\`. This includes loading/unloading in the first cycle. No automatic repeated transport on later cycles. Custom Shop includes transport vehicle amount plus loading and unloading once. Negative transport rates/handling are not universally rejected by \`n\`.

## 13. Rental Cycle Calculations

\`cycleIndex(start,days,date)\` line 117 returns 1 when date is on/before start, otherwise \`floor(dayDiff(start,date)/max(days,1))+1\`; \`effectiveCycle(...)=cycleIndex(...)+1\` line 118. \`hydrateBill\` lines 136–140: start at \`start_date\`, loop while \`cur<=today()\`, terminate at index <500; cycle end = \`addDays(cur,cycle_days-1)\`, next cycle begins previous end+1. **Each entered cycle is charged in full**, no proration for return/closure in mid-cycle.

Example: 15-day bill from 2026-01-01 with rent ₹418 and first transport ₹150: cycles **Jan 1–15 ₹568**, **Jan 16–30 ₹418**, **Jan 31–Feb 14 ₹418**, **Feb 15–Mar 1 ₹418**; accrued by Feb 15 = **₹1,822**. A valid return of one Jackey after cycle 1 is effective at cycle 2: later rent drops ₹65/cycle → **₹1,627** across four cycles (₹568+₹353×3).

Time issues: \`today()\` uses UTC ISO string while \`parseDate\` makes local-midnight objects; \`dayDiff\` uses fixed 86,400,000 ms while \`addDays\` is local calendar arithmetic. The UTC/local mismatch can cause boundary effects, and DST zones can alter \`dayDiff\`. Leap/month/year boundaries need dedicated parity cases. Invalid start yields empty cycles/due 0; future starts yield zero currently accrued cycles. Closed bills use \`closed_at\` when parseable. Computed current index is the last produced cycle, with 499 maximum.

## 14. Material Returns and Additions

\`historyTotals\` lines 119–123 accumulates per-material counts and per-length wood maps; \`snapshotForCycle\` lines 124–129 uses
\`balance=max(base + additions_effective - returns_effective,0)\`.
Effective events only apply when \`effective_from_cycle<=idx\`. The UI \`saveHistory\` (\`app.js:524–530\`) rejects empty entry, closed bill, returns exceeding **current physical balance**, or wood return exceeding its precise length count; dates are stored and effective cycles derived. If an item is returned during cycle 1, charges for cycle 1 remain unchanged and cycle 2 onward sees the reduction. Deleting history (\`app.js:500\`) removes matching events; rebuilding invoice state changes thereafter. **Historical cycle snapshots are derived, not immutable signed invoices**.

Example: base 10 sheets @₹35 ⇒ ₹350 each cycle; return 4 during cycle 1 ⇒ cycle 1 ₹350, cycle 2 ₹210; add 2 to become effective cycle 3 ⇒ cycle 3 ₹280. Independent return validation must include wood lengths and concurrency.

## 15. Advance and Deposit Logic

Normal rental: \`advance_locked=round2(advance_amount)\`, while \`total_due=Σ(cycle.total)\`, \`total_paid=Σ(payment.amount)\`, \`pending=max(total_due-total_paid,0)\`: **advance is separate and does not automatically reduce rental due** (\`app.js:140\`). There is no basis to claim automatic advance refund on closure. For Custom Shop the advance is **equal to the material+wood amount** and is included in the one-time grand total (\`app.js:142–147\`). Customer credit in split payment is a separate stored remainder, not interchangeable with advance.

## 16. Payments and Pending

\`app.js:351–475\`: payment form includes cycle selection (professional bills), amount, shortcut Full/Half, method Cash/UPI/Bank, date, note and duplicate confirmation. Validation: positive amount, at most 2 decimal digits, safe cents integer, valid date, known method, valid selected cycle and no duplicates unless explicitly confirmed. New payment append records \`payment_id, amount, payment_date, note, method\` plus \`cycle_index, cycle_start_date, cycle_end_date\` where applicable. **The regular payment handler does not explicitly cap every manually typed amount at bill pending**; determine operational overpayment behavior from tested application before porting. Pending displays floor at zero, hiding surplus from bill-level pending. Admin deletion requires password/confirmation/reason and adds \`payment_audit\`. Manual optimistic \`DB.put\` may resolve before server persistence.

## 17. Split Payment Engine

\`split-payments.js:3–26,46–155\`; \`SA.validateSplit\` converts amounts to integer cents, rejects invalid decimals, excessive cycle capacity, excessive total bill pending, total allocations > received, and leftover credit without explicit opt-in. It can allocate across distinct bills and cycles, bind one detected receipt to a customer, and persist \`settings\` receipt records, receipt aliases, bill payments, optional customer credit. Receipt editing first removes/replaces prior entries for touched bills. \`FirebaseBridge.guardedBatch\` is required for protected multi-record updates. Dedup keys use normalized reference or detected candidate ID.

Example ₹5,000: Bill A ₹2,000; B ₹1,500; C ₹1,000; remainder ₹500 → require credit choice and valid customer mobile; otherwise reject. When allocating full ₹5,000 (e.g., 2,000+1,500+1,500), no credit. Never represent a 200 OK from WhatsApp or Firestore as proof of bank payment.

## 18. Custom Shop Billing

\`hydrateCustom\` \`app.js:142–144\`: \`material=Σ(piece qty×rate)\`, \`wood=Σ(feet×rate)\`, \`materialRent=material+wood\`, \`advance=materialRent\`, \`grand=materialRent+up/down transport+loading+unloading+advance\`. One-time bill; \`pending=max(grand-Σpayments,0)\`.

Example: 10 Jackey × ₹65 = ₹650; 8ft ×5 wood at ₹18 = ₹720; material total ₹1,370; up/down vehicle ₹200; loading ₹80; unloading ₹50; advance ₹1,370 ⇒ grand = **₹3,070**. With ₹1,500 received, pending = **₹1,570**. Conversion \`hydrateConvertedCustom\` line 145–147 creates one professional cycle with \`rent=materialRent+advance\` and \`transport=all transport\`, total same as Custom Shop; may mark open/closed depending on balance. Do not replace conversion with ordinary ongoing rental calculation.

## 19. Invoice Generation

Sources: \`app.js:676–681\`, \`invoice-2026.js:4–71\`, \`next-cycle-2026.js\`, \`invoice-share.js\`, \`MainActivity.java\`. Types: standard invoice, customer bill, selected rental-cycle invoice, next cycle, custom bill, material report, slip, challan. Invoice-2026 selects exact cycle snapshot and \`calcRent(snapshot_qty,snapshot_wood,b.rates)\`; cycle payment inclusion requires matching index **and exact start/end dates**; old unassigned payments are reported separately (lines 16–18,35–44). Sharing can render invoice image via \`html2canvas\`, then Android file share; PDF/printing via WebView print or Android print. An invoice re-rendered after history edits is **not an immutable accounting archive**; archive rendered output, calculation version and event timestamps if historical invariance is mandatory.

## 20. Notifications and Reminders

\`notifications-2026.js:7–46\`: builds rental due rows, categorizes as \`pending\` (already-started outstanding earlier cycle), \`today\` (cycle start date equals today) and \`upcoming\` (future cycles in seven-day window meeting payable criteria). \`SA.syncReminders\` debounces 1.5 seconds and forwards to Android. Native \`BillingReminderWorker.java:28–69\` schedules unique 24-hour WorkManager periodic work, optional immediate run after first enable, checks notification permission Android 13+, suppresses same-day repeat using last run, paginates customer notifications and records bounded history. Android may defer periodic work; exact trigger time is not guaranteed. Due day is based on cycle start; do not equate upcoming with an Android alarm at exact midnight.

## 21. WhatsApp Integration

Three distinct things:

1. Manual share sheet/open WhatsApp from \`invoice-share.js\`/Android intent: user chooses sending app/contact.
2. Automated reminder UI: \`whatsapp-reminders.js\` builds, previews, optionally edits recipient/message; revalidates bill before send.
3. Separate Node server \`whatsapp-reminders/src/api.js\`, \`src/whatsapp.js\`: bearer-token HTTPS client through native \`WhatsAppBridge.java\`, QR/phone-code pairing, connection status, saved auth folder, idempotent request IDs in SQLite. Returns accepted or uncertain response; server does not prove delivery to recipient. A timed-out send stays \`UNKNOWN\`; repeat needs manual investigation. \`normalizePhone\` handles India default and international length bounds.

## 22. Android Native Components

Manifest \`android-app/app/src/main/AndroidManifest.xml:1–42\`: INTERNET, ACCESS_NETWORK_STATE, POST_NOTIFICATIONS, WAKE_LOCK, RECEIVE_BOOT_COMPLETED; exported launcher Activity, exported NotificationListenerService protected by \`BIND_NOTIFICATION_LISTENER_SERVICE\`, non-exported FileProvider. No \`READ_SMS\` in the manifest; payment detection uses **notification listener**, not unrestricted SMS inbox. Java services implement payment parsing, 24h background reminders, native sharing/printing, file picker and HTTPS WhatsApp. Source \`app/build.gradle:5–32\`: API 26 minimum, API 35 target, Java 17, v1.8.2. Production release signing relies on environment variables and is different from Expo preview debug signing.

## 23. Firebase and Database Schema

\`firebase-db.js:3–4\` defines seven **collections and primary keys**:

| Store | Document key | Important data fields |
|---|---|---|
| \`bills\` | \`bill_no\` | name/mobile/place, start_date/cycle_days, all material quantities/rates, wood maps as expressions/rates, transport charges, advance, status, payments, return/addition history, audit, closed_at |
| \`customers\` | \`mobile\` | name, mobile, customer_id, optional place, created_at |
| \`customBills\` | \`bill_no\` | custom shop fields, one-time grand total, payments, conversion metadata |
| \`slips\` | \`slip_no\` | delivery/return content, created/date and customer details |
| \`challans\` | \`challan_no\` | customer/material delivery and notes |
| \`inventory\` | \`item\` | \`stock_qty\` for piece materials; \`stock_map\` for wood lengths |
| \`settings\` | \`key\` | \`value\` terms, counters, detected receipt records and aliases |

Payment is **nested on bill**, not a separate top-level \`payments\` collection. Cycles are principally **derived** by \`hydrateBill\`. Return/addition history are nested. Some derived fields are not physically persisted. \`FirebaseBridge.java:76–130\` implements \`all,get,put,batchPut,guardedBatch\`; JavaScript cache read, optimistic updates and asynchronous write rollbacks are in \`firebase-db.js:30–44\`.

Sample backup (anonymized counts): **26 bills, 18 customers, 1 custom bill, 10 inventory items, 5 settings**; no slips/challans. Nested payment keys include \`payment_id/payment_date\`, optional \`cycle_index/start/end\`, \`receipt_key\`, \`transaction_reference\`. Never rename these fields to native-only \`id/date\` without a reversible transformation. **Server rules currently lack Firebase-auth enforcement.**

## 24. JSON Backup and Restore

Production schema \`sa-traders-firebase-v1\` with \`schema, exported_at, business, data:{bills,customers,customBills,slips,challans,inventory,settings}\` (\`app.js:604\`). \`normalizeBackup\` lines 610–641 accepts some older aliases and fills legacy payment IDs; verifies primary keys, duplicate records and nested array types. \`restoreBackupText\` lines 643–659 **clears each selected store before uploading records in 100-record batches**; no all-store transaction/rollback. A failure halfway can leave partial restored data. Run an independent backup first, preview counts, stage in isolated storage, and verify hashes/counts before swapping.

React Native \`feature/native-json-backup-import\` adds local document picker/import/export/merge. The audited redesign branch now adds a safer local copy, collection-key validation, mobile-based customer merging and an explicit replacement confirmation. All local imports are disconnected from live Firebase.

## 25. Security Audit

| ID | Severity | Evidence | Correction |
|---|---|---|---|
| SEC-01 | **Critical** | \`firestore.rules:7–8\` allows all unauthenticated read/write | Add Firebase Authentication, enforce roles per document and test deny-by-default rules before connecting native app |
| SEC-02 | **Critical** | \`firebase-db.js:44–47\` uses client-only fixed login verification | Remove fixed secret, use server-backed identities and authorization checks |
| SEC-03 | High | \`app.js:643–659\` clears cloud store before completing restore | Stage/validate then atomically reconcile or use transactional versioned restore and rollback |
| SEC-04 | High | \`firebase-db.js:31–40\` optimistic writes, some resolve before cloud commit | Await acknowledgements for financial writes; durable pending state/retry queue |
| SEC-05 | High | \`app.js:83–88\` counters/number discovery can race | Server transaction for unique number allocation |
| SEC-06 | Medium | \`MainActivity\` supports shared backups; Android backup configuration includes root; data may include payments | Restrict backups, encrypt sensitive files and ensure secure scoped URIs |
| SEC-07 | Medium | Separate reminder service has bearer token and saved session | Rotate, rate-limit, TLS-only, monitor failures, protect pairing endpoints and session disk |
| SEC-08 | Medium | Client admin prompts in UI | Apply rules on server, log immutable admin actions and enforce least privilege |

Do not reveal or hardcode login passwords, tokens, keystores, private Firebase keys or actual customer data in released reports.

## 26. UI/UX Analysis

Earlier reference screens require: clear bill identity; customer details; full 15/20/30 cycle badge; separate material/wood/transport rows; visible **due, paid, pending and advance**; one-tap payment action; cycles; all-customer material summary; history tabs; native quantity \`+\`/\`−\` controls; accessible confirmation dialogs. Responsive issues include dense lists, small amount text, too many equally prominent buttons and inconsistent placement. Native \`ProfessionalUI.tsx\` improves structure but is not yet device-tested. UI simplification must **not delete** financial or administrative actions. All icons need labels and 44–48dp touch targets; provide keyboard-safe form flow, focus management, loading/saving/failed states and clear offline status.

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

\`main\` is the source of truth for financials/Android, \`feature/native-json-backup-import\` for native JSON workflow reference, \`feature/react-native-redesign\` for UI, and server folder on \`main\` for WhatsApp.

## 28. Bugs and Risks

| Issue | Evidence | Status | Reproduction and correction |
|---|---|---|---|
| CALC-01 | \`app.js:49,51–54\` UTC today/local dates | **Suspected** boundary mismatch | Simulate 23:30 IST near UTC day boundary; use consistent zone-aware date-only arithmetic |
| CALC-02 | \`parseComboSizes:99–103\` drops malformed tokens | **Confirmed parsing behavior** | Input \`8×2 nonsense\`; detect unconsumed text and block save |
| CALC-03 | \`quickPayment:395–425\` does not explicitly cap manual amount at pending | **Confirmed missing check** | Type more than pending; enforce policy or explicitly represent credit |
| CALC-04 | \`round2:45\` floating-point | **Potential precision risk** | Compare fractional paise/tie cases; use integer minor units |
| DATA-01 | \`restoreBackupText:650–655\` clear then batches | **Confirmed partial-restore risk** | Fail mid-batch, observe partially populated store; stage and reconcile |
| DATA-02 | \`DB.put\` optimistic asynchronous writes | **Confirmed async behavior** | Offline after click; require confirmed save semantics |
| RN-01 | \`react-native/src/domain.ts\` separate math | **Parity incomplete** | Compare hundreds of historical bill snapshots against \`hydrateBill\`; golden tests |
| RN-02 | RN app lacks full custom/notification/WhatsApp workflows | **Confirmed missing** | Route/function inventory diff; implement each with tests |
| RN-03 | Legacy receipt \`payment_id/payment_date\` versus native \`id/date\` | **Confirmed model mismatch** | Load sample backup; use dual-key compatibility and preserve original fields |
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

Existing repository smoke checks: \`tests/rental-cycle-test.cjs\` checks cycle payment attribution and unassigned payments; \`tests/split-payments-test.cjs\` checks cents and split limits. Run them and verify CI logs before marking even these as passed in a release report.

## 30. React Native Migration Reference

Recommended domain-separated TypeScript architecture:
\`features/billing/{rentalEngine,rateEngine,historyEngine}.ts\`,
\`features/customer/{repository,screen}.ts\`,
\`features/payment/{paymentService,splitReceiptService}.ts\`,
\`features/invoice/{model,renderer,archive,printer}.ts\`,
\`features/notification/{reminders,detectedPayments}.ts\`,
\`features/whatsapp/{reminderComposer,serviceClient}.ts\`,
\`features/backup/{parser,validator,restoreCoordinator}.ts\`,
\`auth/{session,roles}.ts\`,
\`data/{firestoreRepository,offlineQueue,migrations}.ts\`,
\`native/android/{notificationListener,backgroundWorker,fileShare,print}.kt\`.

Port equations from **\`app.js\` and \`split-payments.js\` first** with golden fixtures. Keep raw record field names, doc keys, invoice numbering, cycle attribution and server-side guard invariants. Modernize UI and rendering independently; never silently rewrite business rules while redesigning visuals.

Acceptance: every source route/action mapped to a native button or documented capability; zero unverified financial discrepancies across representative historical backups; verified offline and conflict semantics; secure Firestore access; all signed APK upgrades and backup restore tests passed; error paths, Android permissions, notifications and WhatsApp manually verified on target devices.

## 31. Missing or Incomplete Functionality

Current native rewrite lacks: production Firebase auth and live sync, cloud guarded transactions, complete custom shop conversion, lossless wood return/addition UI, precise historic payment/cycle accounting, native signed invoice archive/PDF/image, automated reminders/payment listener, WhatsApp service controls, production-grade backup restore, native admin privileges/audits and full feature parity. The isolated JSON importer preserves raw fields but does not by itself implement those operations.

## 32. Final Findings and Recommendations

1. **Protect live business data first.** Introduce authenticated Firestore rules and role checks before production native access.
2. **Freeze the business contract.** Use \`main\` and verified backup fixtures to build golden-master tests for every rental/payment operation.
3. **Prioritize payment integrity and backups.** Replace optimistic financial confirmation and clear-before-write restore.
4. **Port feature by feature.** Keep the existing v1.8.2 production app available; the React Native APK remains a separate test package.
5. **Verify actual buttons and devices.** Compile success is not evidence of semantic accuracy, print correctness, notification access, or WhatsApp delivery.
6. **Only ship a replacement after an exhaustive parity checklist** covering all 30 scenarios, security, recovery and signed upgrade.

### Calculation portability template (TypeScript-like pseudocode)

\`\`\`ts
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
\`\`\`

**Accuracy note:** This pseudocode is an explanatory porting guide, not a complete reimplementation. Confirm differences in rounding, timezone, customer credit and custom conversion against original tests before deployment.
