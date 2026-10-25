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
