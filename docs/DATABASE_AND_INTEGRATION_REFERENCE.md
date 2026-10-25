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
