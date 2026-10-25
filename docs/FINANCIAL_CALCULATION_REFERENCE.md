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
