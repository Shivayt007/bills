# Android v1.2.0 — Payment sheet and invoice images

- Record Payment now opens a dark in-app sheet rather than window.prompt.
- Amount, Full/Half, Cash/UPI/Bank, local date and optional note.
- Invalid amounts/dates produce inline errors. Duplicate amount/date requires explicit acknowledgement in the sheet.
- Each save is one IndexedDB transaction; repeated submit taps are ignored until completion.
- Existing payment fields and bill calculation functions are preserved; method is an additional optional field. Older records still work.
- Payment method is shown in rental payment history.
- Android back closes the modal/menu before navigating. Modal focus stays inside the payment sheet.
- Invoice, customer bill, next-cycle bill and legacy print views have Share image actions. Print / Save PDF remains.
- html2canvas 1.4.1 is bundled locally with its MIT license. PNG capture includes all invoice content, expanded terms and cycle summary, excluding app buttons. Long images are bounded for memory use and offer PDF on overflow.
- Android FileProvider exposes only shared-invoices cache files with temporary read permission. The user selects WhatsApp or another app and the recipient; nothing is sent automatically. No storage or internet permission is needed to generate/share the file.
- APK versionCode 3 / versionName 1.2.0.

Local checks: JS syntax checks; Chromium with external network blocked; saved payments and methods persist after reload; invalid amount rejection; duplicate confirmation; repeated-submit protection; cancellation; separate custom/rental payment stores; real PNG output at 780px width; long invoice beyond the viewport; native-bridge failure recovery. The Android bridge is tested by compilation and code inspection, with a mock bridge in browser tests. Actual WhatsApp delivery needs an Android device test.

The earlier DESIGN-NOTES.md documents the v1.1 CSS-only work. Its statements that the payment sheet is only a concept and still uses prompts are superseded by this release. No database migration is part of v1.2.
