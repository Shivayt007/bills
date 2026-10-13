# S.A Traders — Native Dark CSS

Paste the complete contents of `sa-traders-native.css` at the END of your existing `premium-theme.css`. This requires no HTML, ID, class or JavaScript changes. Keep earlier CSS in place: this is an override, not a replacement for the base styles. Rebuild the APK to bundle the updated CSS. The original repository and APK source have not been modified.

Designed against the current screen templates in Shivayt007/bills, main, inspected 12 October 2026. It is not intended for the separate single-screen `sa_traders_android_ui.html` mockup.

The stylesheet uses the requested violet/lime/coral palette, 390px maximum mobile width, rounded cards, bottom navigation, fixed payment bar, compact invoice, vertical menu and large touch targets. No CDN, JavaScript, external images or network font imports. It uses Sora only when already available, otherwise system-ui. Embedded SVG masks provide the navigation and quick-action icons offline.

## What CSS cannot add to this version

- Record payment currently runs three `window.prompt` dialogs. Web CSS cannot style those into a bottom sheet. The payment-sheet preview is a visual concept only, not a working replacement. Full/Half, Cash/UPI/Bank and payment-mode persistence require HTML/JS work.
- Existing bottom destinations remain Home, Bills, New Bill, Reports and More. Customers is available through the existing quick action. Renaming a tab cannot change its onclick destination.
- The bill “more” action currently opens the app menu. Moving Return/Additional/Next Cycle/Close/Delete into that action requires JS/markup. Existing permissions and available actions are untouched.
- The home hero keeps the existing percentage ring; CSS cannot derive a truthful progress width from text. Existing bill progress bars keep their calculated widths.
- Bill material rows currently expose quantity, not rate. This stylesheet does not invent a rate or inject customer/financial text.
- The invoice renderer already filters out zero-quantity / zero-amount lines. That existing rule is unchanged. The one-item sample is compact; extra rows, expanded terms, larger system text and smaller screens can scroll. No financial content is clipped to force a one-screen result.
- A drag handle is decorative. Existing modal opening/closing remains unchanged; drag-to-dismiss is not added.
- Web safe-area variables are supported, but Android status/navigation bar colours, keyboard resizing and back gestures belong to the native wrapper.

The app contains pre-existing `maximum-scale=1` in its viewport meta tag; CSS cannot remove that restriction. No claim of a complete accessibility audit or device APK test is made.

## Main styled classes

| Area | Existing classes / IDs |
|---|---|
| Foundation | `.container`, `.page`, `.muted`, `.text-green`, `.text-red`, `.text-gold`, `#app` |
| App bar | `.ux-topbar`, `.ux-brand`, `.ux-logo`, `.ux-icon-btn` |
| Navigation | `.ux-bottom`, `.active`, `.plus` |
| Home | `.ux-dashboard-head`, `.ux-shop`, `.logo`, `.ux-hero`, `.ux-hero-grid`, `.label`, `.amount`, `.ux-ring`, `.ux-hero-stats`, `.ux-quick`, `.ico` |
| Bill list | `.ux-bill-card`, `.ux-bill-row`, `.ux-avatar`, `.ux-bill-main`, `.ux-bill-money`, `.ux-bill-foot`, `.ux-progress`, `.ux-pill` |
| Bill details | `.ux-detail-head`, `.ux-detail-person`, `.meta`, `.ux-summary`, `.ux-summary-top`, `.due`, `.cycle`, `.bar`, `.ux-summary-stats`, `.pending`, `.ux-section`, `.ux-material-row`, `.ux-qty`, `.has`, `.ux-actions2`, `.ux-outline`, `.ux-paybar`, `.pay`, `.more` |
| Bill tools / cycles | `.ux-action-scroll`, `.ux-action-chip`, `.ux-wood`, `.ux-rent-total`, `.ux-cycle-card`, `.ux-cycle-card-head`, `.ux-cycle-dates`, `.ux-cycle-money` |
| Segments | `.ux-tabs`, `.tabbar`, `.tab`, `.active` |
| Forms | `.sa-input`, `.sa-label`, `.field`, `.form-grid`, `.two`, `.three`, `.form-section`, `.form-section-head`, `.form-section-body`, `.section-title`, `.actions`, `#billForm`, `#invForm` |
| Buttons | `.sa-btn`, `.primary`, `.gold`, `.success`, `.outline`, `.blue`, `.danger`, `.lg` |
| Cards / reports | `.sa-card`, `.sa-card-header`, `.sa-card-body`, `.sa-card-subtitle`, `.sa-stat`, `.sa-stat-grid`, `.sa-stat-label`, `.sa-stat-value`, `.summary-strip`, `.summary-box`, `.value`, `.money-big`, `.quick-grid`, `.quick-card`, `.bill-card` |
| Customers / inventory | `.sa-table`, `#custSearch`, `#invForm` (scoped visual-row rules) |
| Login | `.login-wrap`, `.login-card`, `.login-logo`, `.sa-alert` |
| Existing sheets | `.modal`, `.modal-card`, `.modal-head`, `.modal-body`, `.modal-close` |
| Drawer menu | `.ux-menu`, `.ux-menu-head`, `.ux-profile`, `.ux-menu-grid`, `.ux-menu-tile`, `.logout` |
| Invoice | `.print-sheet`, `.invoice-page`, `.invoice-toolbar`, `.invoice-circle`, `.invoice-sheet`, `.invoice-brand`, `.invoice-no`, `.invoice-body`, `.invoice-customer`, `.invoice-field`, `.invoice-cyclebar`, `.invoice-materials`, `.invoice-breakdown`, `.invoice-breakdown-row`, `.invoice-total`, `.invoice-pay-grid`, `.invoice-paybox`, `.paid`, `.pending`, `.invoice-cycle-section`, `.invoice-cycle-list`, `.invoice-cycle-card`, `.invoice-cycle-index`, `.invoice-cycle-dates`, `.invoice-cycle-money`, `.invoice-terms`, `.invoice-terms-body`, `.invoice-actions`, `.print`, `.back` |
| States | `.sa-badge`, `.open`, `.closed`, `.cycle`, `.toast`, `.warning`, `.no-print` |

Some nested classes above are context selectors rather than standalone global rules. Search `sa-traders-native.css` for the exact scope. No new class is required by the production CSS. Structural refinements using `:has()` degrade to the original layout on older WebViews.

## Validation

Rendered the nine existing screens at 390 × 844 in headless Chromium with the supplied sample bill. All had 390px document width; no horizontal overflow or JavaScript errors were observed. The sample invoice document height was exactly 844px. Inspected the screen captures. Payment-sheet preview is separate concept markup, not a tested payment implementation. No actual device/APK validation was performed.
