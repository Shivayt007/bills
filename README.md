# S.A Traders billing system

S.A Traders manages scaffolding and construction-material rentals for one shop. The current Android app is **native Flutter/Dart**, using Firebase Authentication, Cloud Firestore and Riverpod. This repository also retains the older browser/JavaScript app, a separate legacy Android wrapper and an optional Node WhatsApp reminder service. New mobile features belong in `lib/` and `android/`, not the legacy `android-app/`.

This README is the project handoff and a platform-neutral behavior specification. Read the source and tests for final details, especially before changing monetary calculations or historical Firestore records. **Update this README in the same change as every feature, field, calculation, screen or release-process change**; see `AGENTS.md`.

## Shipped features and screens

| Area | Current behavior | Source |
| --- | --- | --- |
| Home | Active rental outstanding, received, due today, recent bills and direct bill navigation | `lib/features/home/` |
| Bills | Search and status filters; create rental, custom shop or Column Box bill | `lib/features/billing/presentation/bills_screen.dart`, `home_shell.dart` |
| Rental form | Editable bill number, customer/site, start date, cycle length, material quantities/rates, wood sizes/per-foot rates, transport/handling, refundable advance, review before save | `lib/features/billing/presentation/bill_form_screen.dart` |
| Bill details | Due/paid/pending, cycles and their invoices, payments, returns, additions, correction history, edit/close/delete | `lib/features/billing/presentation/bill_detail_screen.dart` |
| Customer materials | Bill Details shows a button opening a separate white material statement: one row for each open bill of the same customer, six current non-wood balances, a total row and full-width photo sharing | `lib/features/inventory/domain/material_holdings.dart`, `presentation/customer_material_statement_screen.dart` |
| Inventory | One row for every open rental bill across customers, with customer, bill no, date, site, six non-wood quantities and total; separate stock editors, including wood | `lib/features/inventory/` |
| Rental invoice | Choose any accrued cycle or preview the next cycle; share PDF/image; customer/shop details, terms, item/qty/amount, due/paid/pending; no rate column or wood size breakdown | `lib/features/invoice/presentation/invoice_screen.dart` |
| Column Box | Separate list, create/edit, centring and manually sized boxes, day-based totals, invoice/PDF/print, mark paid, delete with five-second Undo | `lib/features/column_box/` |
| Other records | Custom one-time shop bills and payments, delivery/return slips and challans, reports and payment CSV sharing | `lib/features/custom_bills/`, `slips/`, `reports/` |
| Alerts | Overdue, due today, upcoming seven days, detected-payment suggestions and reminder history; links to exact bills | `lib/features/notifications/` |
| More/Admin | Daily-reminder and payment-detection controls, appearance, inventory, invoice terms, file backup/restore, account and admin-only reset | `lib/features/home/presentation/home_shell.dart`, `admin/` |

Phone navigation: **Home / Bills / Reports / More**. Notifications, Inventory, Slips and Admin open from More. Wider layouts use a navigation rail. Appearance supports system, light and dark themes.

## Repository map

| Path | Responsibility |
| --- | --- |
| `lib/main.dart`, `lib/app.dart` | Firebase/theme/reminder startup and auth-gated app |
| `lib/core/constants.dart` | Shop identity, material/wood catalogs and collection keys |
| `lib/core/providers.dart` | Riverpod repositories, auth/Firestore streams and hydrated rental bills |
| `lib/core/theme/`, `lib/core/widgets/` | Material 3 tokens, glass components and reusable controls |
| `lib/features/<feature>/{data,domain,presentation}/` | Persistence, pure calculations/models and screens, where applicable |
| `android/` | Current Flutter Android runner and Firebase/signing configuration |
| `test/` | Flutter domain and widget tests, including legacy calculation parity fixtures |
| `docs/flutter-design-system.md` | Detailed visual tokens and UI behavior |
| `.github/workflows/flutter-native.yml` | Flutter analysis, tests and signed APK artifact |
| `firestore.rules` | Current Firestore access rule; deploy separately |
| Root `index.html`, `app.js`, `*-2026.js`, `firebase-db.js`, `tests/` | Older web implementation/tests; parity reference, not Flutter runtime |
| `android-app/` | Older Java/WebView Android implementation; not the native Flutter app |
| `whatsapp-reminders/` | Optional external Node reminder service with its own README/tests |

## Setup, authentication and release

1. Install Flutter **3.47.0**, its bundled Dart SDK, Android SDK and JDK 17. Run `flutter pub get` at the repository root.
2. Keep the Android application ID `com.satraders.billing`. `android/app/google-services.json` identifies the existing Firebase Android app. Configure Firebase for your own deployment; never commit Auth passwords or release signing material.
3. Enable **Email/Password** in Firebase Authentication and provision the shop account. The old local `admin / shiva` lock is not the Flutter login. Set a trusted Firebase Auth custom claim `admin: true` for admin-only UI actions if needed.
4. Review and deploy `firestore.rules`. The current rule allows **any authenticated user** to read/write the single business account's subcollections. The admin claim gates UI, not Firestore writes. Harden rules before adding staff or multiple shops.
5. Run `dart format lib test`, `flutter analyze --no-fatal-infos --no-fatal-warnings`, `flutter test` and `flutter run` for a development device.
6. Push to `flutter-native-port` or dispatch **Flutter native billing app** in GitHub Actions. CI pins Flutter 3.47.0, formats/analyzes/tests, builds a signed APK, verifies its signature and uploads `sa-traders-flutter-release-apk`. Set GitHub secrets `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` for the **existing signing key**. Extract and install `app-release.apk`, not the artifact ZIP. A `[preview]` commit skips signing/APK.

The current Flutter release targets Android. The old wrapper has other workflows; do not confuse their artifacts. `pubspec.yaml` and `android/app/build.gradle` have separate version metadata; inspect both for releases.

## Firestore layout and schema

Every collection lives at `sa_traders/business/<collection>/<document>` (`sa_traders` collection, `business` document, then a subcollection). `BillingRepository` looks first for legacy Base64 URL-safe, unpadded IDs derived from natural keys, then plain IDs from an early Flutter build. Updates preserve the found ID. Old records require no migration. Hydrated cycles, totals and balances are derived in memory, not written back to old bills.

| Collection | Natural key | Main stored fields |
| --- | --- | --- |
| `bills` | `bill_no` | `name`, `mobile`, `place`, `start_date` (`yyyy-MM-dd`), `cycle_days`, `status` (`open`/`closed`), quantity/rate and wood/rate fields below, transport fields, `advance_amount`, `payments[]`, `return_history[]`, `additional_history[]`, creation/closure timestamps and actors; optional `payment_audit[]`, `history_audit[]`, `bill_audit[]` |
| `customers` | `mobile` | `customer_id`, `name`, `place`, `created_at` |
| `customBills` | `bill_no` | Customer/site, material/wood/rates, transport fields, `status`, `dashboard_visible`, `payments[]`, return/addition history, timestamps; separate one-time calculation |
| `column_box_bills` | `id` | `invoiceNo` (`CB-0001` sequence), `createdAt`, `customerName`, `phone`, `place`, `days`, `transport`, `labourUp`, `labourDown`, `advancePaid`, optional `amountPaid` (old records default to 0), `items[]`, `itemsTotal`, `grandTotal`, `balanceDue`, `status` (`unpaid`/`paid`) |
| `slips` | `slip_no` | `type` (`DELIVERY`/`RETURN`), `date`, customer/contact/site, trip/vehicle/driver/note, `items`, `wood`, creation metadata |
| `challans` | `challan_no` | `type` (`DELIVERY`), `date`, `note`, `items`, `wood`, creation metadata |
| `inventory` | `item` | Material `stock_qty` or wood `stock_map`; holdings are computed from bills |
| `settings` | `key` | `value`; includes `terms_invoice` and sequences such as `column_box_invoice_seq`, `customer_seq` and slip/challan counters |

### Material catalog

| Key | Label | Quantity field | Rate field | Default per-cycle rent |
| --- | --- | --- | --- | ---: |
| `jackey` | Jackey | `jackey_qty` | `jackey_rate` | ₹65 |
| `jackey9` | 9 Jackey | `jackey9_qty` | `jackey9_rate` | ₹100 |
| `sheet` | Sheet | `sheet_qty` | `sheet_rate` | ₹35 |
| `half_sheet` | Half Sheet | `half_sheet_qty` | `half_sheet_rate` | ₹30 |
| `span` | Span | `span_qty` | `span_rate` | ₹100 |
| `inner3m` | 3M Inner | `inner3m_qty` | `inner3m_rate` | ₹60 |

Wood size strings are stored in `wood_12`, `wood_9`, `wood_6`, `runner`; their rate fields are `wood_12_rate` (₹18/ft), `wood_9_rate` (₹18/ft), `wood_6_rate` (₹15/ft), `runner_rate` (₹7/ft). Example `8×5+10×2` means five eight-foot pieces plus two ten-foot pieces. In history, wood is a nested `wood key → size in feet → piece count` map. First-cycle charges use `transport_up_trips`, `transport_up_charge`, `transport_down_trips`, `transport_down_charge`, `loading_charge`, `unloading_charge`.

### Nested records

- Rental payment: `payment_id`, `amount`, `payment_date`, `method`, `note`, `cycle_index`, `cycle_start_date`, `cycle_end_date`, `created_by`, `created_at`. Legacy payments can lack IDs/cycles; correction matches original position/content, and invoice display allocates uncategorized credits oldest-first without changing Firestore.
- Return: `rid`, shared `return_group_id` when one physical return spans bills, `date`, `note`, `effective_from_cycle`, `items` (six keyed counts), `wood` (wood key → size → count), creation actor/time. Additions have analogous `aid`, date, note, effective cycle and item/wood maps. Corrections retain audit rows where implemented.
- Column Box item: `type` (`centring`/`column_box`), `width` and `depth` in inches, `height` in feet, `qty`, `ratePerDay`, `amount`. Centring has no meaningful size. Rates are stored and visible on create/edit only, never on invoice/PDF.

Backup/restore selects a **`.json` file** with `schema: sa-traders-firestore-v1`, `exported_at`, `business`, `data` for these eight collections. It validates record keys and preserves Firestore timestamps, dates and geopoints. Restore **replaces existing records in each included collection**, after a count-and-confirm dialog; it is not a merge or an atomic all-collection transaction. Maximum import size: 100 MiB. Export a current backup first.

## Billing rules: portable implementation contract

The authoritative code is `lib/features/billing/domain/billing_calculator.dart`; parity fixtures are in `test/billing_calculator_test.dart`. Do not change money or date semantics during a UI redesign.

1. **Rounding and rent:** `moneyRound(x)` rounds to two decimal places with the Dart implementation. A material line is `round2(qty × rate per cycle)`; material total is `round2(sum of lines)`. A wood category is `round2(sum(size feet × pieces) × per-foot rate)`; wood total is `round2(sum of categories)`. Cycle rent is `round2(material total + wood total)`.
2. **Transport and deposit:** `round2(up trips × up rate + down trips × down rate + loading + unloading)` is charged in **cycle 1 only**. Refundable `advance_amount` is shown separately, not included in rent or applied to the payment balance.
3. **Dates/cycles:** Normalize at UTC midnight and store `yyyy-MM-dd`. Cycle 1 starts at `start_date`; a `D`-day cycle ends at start + `D−1` days; the next begins the following day. Event on/before start → cycle 1; otherwise `floor(days_between(start,event)/D)+1`. Cycle length clamps to 1–3650. Closed bills stop at `closed_at`; open bills accrue through today's UTC date, capped at 499 generated cycles.
4. **Material timeline:** For cycle `n`, start with original quantities/wood; apply additions and returns with `effective_from_cycle <= n`. Snapshots clamp quantities to zero and omit nonpositive wood sizes. A return dated after a new cycle begins can deliberately apply from **any valid cycle 1 through current cycle + 1** and recalculate prior rent. Additions normally apply in the cycle after their date. Ledger validation rejects corrections that make a later balance negative.
5. **Totals/payments:** `total_due = round2(sum(generated cycle totals))`; `total_paid = round2(sum(payment amounts))`; `pending = round2(max(0,total_due−total_paid))`. Payment selects a cycle, checks its remaining amount and current bill balance, and reloads the bill before save. Duplicate amount/date asks for confirmation.
6. **Cross-bill return:** Match another open bill by normalized last-ten-digit phone. If both phones are absent, require normalized name **and** site. Allocate to selected bill first, then other matching open bills; never exceed available material/wood-size balance. Reject the entire entry if any piece cannot be allocated. Preview bill split/effective cycles; re-read and update all affected bills atomically via Firestore transaction. Grouped edit/delete touches all affected bills.
7. **Spreadsheet holdings:** Use each open bill's **current** hydrated `balance_qty` (original + additions − returns), not an invoice-cycle snapshot. Inventory shows one row per open rental bill across customers. Bill Details has a button to a separate statement filtered to the same customer. Sum all six non-wood columns in the final row; intentionally omit wood from these two tables. The photo share captures the whole statement paper at its full width, independent of the horizontally scrolled phone preview.
8. **Custom shop bill:** The current legacy-compatible `customBillTotal()` calculates `round2(rent + up/down transport + loading + unloading + rent)`. **It adds rent twice.** Preserve this exact result for parity until a separately reviewed business-rule change; do not silently fix it in another frontend.
9. **Column Box:** Each line `round2(qty × ratePerDay × days)`; `itemsTotal = round2(sum(lines))`; `grandTotal = round2(itemsTotal + transport + labourUp + labourDown)`; `balanceDue = round2(max(0,grandTotal−advancePaid−amountPaid))`; `status = paid` iff balance is zero. Require days ≥ 1, no negative amounts, customer name, at least one item with qty > 0 and positive width/depth/height for a nonzero box. Indian currency grouping (e.g. ₹1,25,000). Allocate `CB-0001` via a transaction on the settings sequence.

### Implementing the same feature in another app or website

Reuse the stored field names and behavior, not Flutter widgets:

```text
load sa_traders/business/bills
for each bill, hydrate through the requested date:
  for each cycle, snapshot original + effective additions − effective returns
  rent = rounded material lines + rounded wood categories
  add transport to cycle 1 only
  due = sum(cycle totals); paid = sum(payments); pending = max(0, due − paid)
for customer holdings, match open bills by phone or name + place fallback
show each open bill's current six non-wood balances in one row; sum columns
for a cross-bill return, preview split, validate every ledger, commit atomically
```

Port the exact rounding points, event ordering, cycle boundaries and field defaults. Use `test/` fixture values to compare a second frontend field-for-field against Dart. The older web code supplies additional historical cases but is not the current runtime.

## Notifications, payment detection, WhatsApp

- `ReminderService.refreshFromCloud()` hydrates open rental/custom bills and caches an on-device reminder snapshot with future cycles. `reminderCategories()` yields pending, due today and next-seven-days entries when charges are uncovered. Overdue means pending with a date before today.
- Optional Workmanager/local notifications use that **last cached snapshot**, group by phone/customer, suppress duplicates once per calendar day and keep up to 2,000 device-history records. The background isolate does not fetch live Firestore data; foreground activity refreshes the snapshot. Android permission and scheduling affect delivery.
- Optional Android notification-listener access recognizes selected bank/UPI/SMS apps, excludes outgoing/failed/OTP/offer-like text, accepts exactly one positive currency amount, deduplicates by reference or recent text and keeps up to 1,000 local suggestions. **Detection never records a payment automatically**; a user reviews and assigns it. Controls live in More; suggestions/history in Notifications.
- WhatsApp cards preview editable text and open `wa.me` via `url_launcher`; the user sends it. The Flutter app does not embed a bearer token or silently send. `whatsapp-reminders/` is a separately deployable Node service.

## UI, invoices and shop identity

`lib/core/theme/app_theme.dart` defines primary teal `#05637F`, pale blue `#A2BBCF`, light canvas `#F3F7FA`, dark canvas `#0C141D`, Roboto, Material 3, spacing 4/8/12/16/24/32, 16-pixel control and 22-pixel card radii. `glass_design.dart` provides restrained glass surfaces and pill controls. Maintain contrast in both themes and horizontal scrolling for spreadsheet tables; see `docs/flutter-design-system.md`.

Rental invoices display S.A Traders, `Vijayanagaram, Gandhi Street, Medavakkam, Chennai`, phones `7904846694 / 9790894776`, customer/site, selected cycle dates, item/qty/amount, payments, pending and configurable terms (`settings/terms_invoice`). An upcoming cycle is an **advance preview** and is not added to due until it starts. PDF/image export uses the selected cycle. Column Box invoices show item/qty/amount, size beneath box names, transport/labour/advance/balance; no per-piece rates.

## Tests and safe changes

- `test/billing_calculator_test.dart`: legacy parity for rates, dates, cycles, transport, pending, returns.
- `test/grouped_returns_test.dart`, `test/history_backup_test.dart`: cross-bill allocation, correction/ledger and backup behavior.
- `test/material_holdings_test.dart`: separate bill rows, returns, closed-bill exclusion, customer grouping, narrow-screen table and full-width shareable paper.
- `test/column_box_bill_test.dart`: Column Box calculations/models. Other `test/` files cover navigation, entry sheets, invoice styling, dates and dashboard.
- Legacy `tests/` and `whatsapp-reminders/test/` cover those separate runtimes.

For every feature: update schema/formulas and screen behavior here; add focused financial parity tests where needed; move roadmap status only after implementation; run format/analyze/tests; verify the signed APK when requested. Never overwrite an existing bill number or turn file restore into an undocumented merge. Keep credentials, signing keys and customer data out of commits.

## Roadmap and open decisions

These are **proposed follow-ups, not shipped features or release promises**. Update their status when a request is completed.

| Priority | Follow-up | Acceptance direction |
| --- | --- | --- |
| High | Harden Firestore authorization | Define and enforce per-role/tenant rules before adding staff or multiple shops; current authenticated-user rule is broad. |
| High | Safer large backup restore | Current file restore replaces included collections sequentially; design staging/rollback or tested recovery before treating it as atomic. |
| Medium | Combined customer payment allocation | Specify how one received amount is split across several rental bills/cycles, with a reviewable allocation and correction audit. The current Flutter payment entry records against one selected bill/cycle. |
| Medium | Fresh background reminder data | Define safe refresh/sync when offline or a bill changes on another phone; current task uses cached data. |
| Medium | Second-frontend parity dataset | Add anonymized historical bills, split returns, edits and legacy payments for website/other-app output comparison. |
| Medium | Review custom-bill rent formula | Current total adds rent twice; agree a business rule and compatibility plan before changing money. |
| Medium | Column Box dated partial-payment history | Current model has advance and aggregate `amountPaid` plus mark-paid; add installments/audit only after defining behavior. |
| Later | Additional native platforms | iOS/web are not scaffolded; register Firebase apps, adapt permissions/sharing/printing and test before claiming support. |

**Default documentation rule:** Every future project update must update this README in the same commit/PR: shipped feature status, affected screens, Firestore fields, calculations, tests, setup/build and roadmap. For maintenance-only work add a changelog entry explaining the change. `AGENTS.md` makes this the default for coding agents. This is a living specification, not an automatic reflection of uncommitted code.

## Documentation changelog

- 2026-11-13: Moved customer material details from the Bill Details page to a button and shareable statement screen; removed table selection boxes in Inventory.
- 2026-11-13: Replaced the short Flutter note with the full handoff, including per-bill customer/Inventory tables, Column Box, returns, schema, calculations, reminders, UI, release and roadmap.
