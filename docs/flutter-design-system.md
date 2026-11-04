# S.A Traders mobile design system

## Product direction

S.A Traders is a working rental ledger. The main path is **pending balance → bill → cycle/payment or material return**. Show the amount first, the customer second, and supporting data only when needed. Use a calm financial interface with the existing teal brand, strong figures, and plainly labeled actions.

## Tokens

The source of truth is `lib/core/theme/app_theme.dart`.

| Role | Token | Value | Usage |
| --- | --- | --- | --- |
| Primary | `AppColors.teal` | `#05637F` | Main actions, focus, selected navigation |
| Secondary | `AppColors.deepTeal` | `#07445B` | Supporting brand emphasis |
| Heading ink | `AppColors.navy` | `#102F45` | Strong financial headings and hero depth |
| Background | `AppColors.canvas` | `#F3F7FA` | Page canvas |
| Surface | `AppColors.surface` | `#FFFFFF` | Cards, menus, form controls |
| Soft surface | `AppColors.surfaceTint` | `#E8F3F6` | Selected items and icon surfaces |
| Border | `AppColors.border` | `#DCE7EC` | Dividers, controls, cards |
| Body text | `AppColors.ink` | `#16272E` | Primary reading text |
| Muted text | `AppColors.gray` | `#586B78` | Supporting descriptions |
| Positive | `AppColors.green` | `#087655` | Received and paid states |
| Warning | `AppColors.amber` | `#9A5718` | Upcoming actions |
| Error | `AppColors.red` | `#B4233B` | Due balances and destructive actions |
| Legacy brand gray | `AppColors.softGray` | `#AAAAAA` | Decoration only; too pale for small text |

## Type and layout

Use the Android/Flutter Roboto family already available on device. Headline 34/28, title 21/17, body 16/14, captions 12. Amounts use bold, single line where practical, and scale down inside constrained cards. Text labels stay visible at larger system text sizes; don't encode status with color alone.

Spacing: 4, 8, 12, 16, 24, 32 logical pixels. Card radius 22, hero 28, input 16, pill actions fully rounded. Controls are at least 48 pixels tall. A light one layer shadow is reserved for the main balance card. Cards use a subtle border to stay clear on the pale canvas.

The phone shell has four destinations: Home, Bills, Alerts, More. At 840 pixels and wider it uses a navigation rail and centered content capped at 760 pixels. Scroll content has room for the floating action and system gesture area. No key task depends on a horizontal grid fitting a narrow phone.

## Interaction and states

Animated balance changes use 260 ms; reduced motion disables the transition. Touch feedback comes from Material ink and Material 3 controls. Empty lists explain the next action. Pull to refresh remains on Home. Destructive operations and business dialogs keep their existing confirmation flow. Firebase, Riverpod, bill formulas, and Firestore field names are outside the visual system.

## Rollout

The shared theme/components are applied first. Home, Bills, and the workspace shell use them directly. Bill Details keeps its recent purpose built layout and the remaining business pages inherit the new Material 3 theme while their layouts can be updated screen by screen.
