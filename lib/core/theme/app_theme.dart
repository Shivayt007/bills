import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

abstract final class AppColors {
  static const teal = Color(0xFF05637F), paleBlue = Color(0xFFA2BBCF);
  static const navy = Color(0xFF102F45), deepTeal = Color(0xFF07445B);
  static const gray = Color(0xFF586B78), softGray = Color(0xFFAAAAAA);
  static const ink = Color(0xFF16272E), canvas = Color(0xFFF3F7FA);
  static const surface = Colors.white, surfaceTint = Color(0xFFE8F3F6);
  static const border = Color(0xFFDCE7EC), green = Color(0xFF087655);
  static const amber = Color(0xFF9A5718), red = Color(0xFFB4233B);
}
abstract final class AppSpace {
  static const xxs = 4.0, xs = 8.0, sm = 12.0, md = 16.0, lg = 24.0, xl = 32.0;
}
abstract final class AppRadius {
  static const control = 16.0, card = 22.0, hero = 28.0;
}
abstract final class AppMotion {
  static const quick = Duration(milliseconds: 180), standard = Duration(milliseconds: 260);
}
abstract final class AppShadows {
  static const card = [BoxShadow(color: Color(0x100D3447), blurRadius: 18, offset: Offset(0, 6))];
}

class AppPalette extends ThemeExtension<AppPalette> {
  const AppPalette({required this.canvas, required this.surface, required this.subtle,
    required this.border, required this.ink, required this.muted, required this.accent,
    required this.positive, required this.warning, required this.danger});
  final Color canvas, surface, subtle, border, ink, muted, accent, positive, warning, danger;
  static const light = AppPalette(canvas: AppColors.canvas, surface: AppColors.surface,
    subtle: AppColors.surfaceTint, border: AppColors.border, ink: AppColors.ink,
    muted: AppColors.gray, accent: AppColors.teal, positive: AppColors.green,
    warning: AppColors.amber, danger: AppColors.red);
  static const dark = AppPalette(canvas: Color(0xFF0C141D), surface: Color(0xFF172330),
    subtle: Color(0xFF223442), border: Color(0xFF354B5B), ink: Color(0xFFF0F5F7),
    muted: Color(0xFFB9C9D2), accent: Color(0xFF75D5EF), positive: Color(0xFF6DE2B4),
    warning: Color(0xFFFFC984), danger: Color(0xFFFF8296));
  static AppPalette of(BuildContext context) => Theme.of(context).extension<AppPalette>()!;
  @override AppPalette copyWith({Color? canvas, Color? surface, Color? subtle, Color? border,
      Color? ink, Color? muted, Color? accent, Color? positive, Color? warning, Color? danger}) =>
    AppPalette(canvas: canvas ?? this.canvas, surface: surface ?? this.surface,
      subtle: subtle ?? this.subtle, border: border ?? this.border, ink: ink ?? this.ink,
      muted: muted ?? this.muted, accent: accent ?? this.accent,
      positive: positive ?? this.positive, warning: warning ?? this.warning,
      danger: danger ?? this.danger);
  @override AppPalette lerp(ThemeExtension<AppPalette>? other, double t) {
    if (other is! AppPalette) return this;
    return AppPalette(canvas: Color.lerp(canvas, other.canvas, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      subtle: Color.lerp(subtle, other.subtle, t)!,
      border: Color.lerp(border, other.border, t)!,
      ink: Color.lerp(ink, other.ink, t)!,
      muted: Color.lerp(muted, other.muted, t)!,
      accent: Color.lerp(accent, other.accent, t)!,
      positive: Color.lerp(positive, other.positive, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      danger: Color.lerp(danger, other.danger, t)!);
  }
}
class AppThemeController extends ValueNotifier<ThemeMode> {
  AppThemeController() : super(ThemeMode.system);
  Future<void> load() async {
    final saved = (await SharedPreferences.getInstance()).getString('theme_mode');
    value = ThemeMode.values.where((mode) => mode.name == saved).firstOrNull ?? ThemeMode.system;
  }
  Future<void> setMode(ThemeMode mode) async {
    value = mode;
    await (await SharedPreferences.getInstance()).setString('theme_mode', mode.name);
  }
}
final appThemeController = AppThemeController();

ThemeData buildTheme([Brightness brightness = Brightness.light]) {
  final dark = brightness == Brightness.dark;
  final p = dark ? AppPalette.dark : AppPalette.light;
  final scheme = ColorScheme.fromSeed(seedColor: AppColors.teal, brightness: brightness)
    .copyWith(primary: p.accent, onPrimary: dark ? AppColors.navy : Colors.white,
      secondary: p.positive, onSecondary: dark ? AppColors.navy : Colors.white,
      surface: p.surface, onSurface: p.ink, error: p.danger,
      onError: dark ? AppColors.navy : Colors.white, outline: p.border);
  final type = (dark ? Typography.material2021().white : Typography.material2021().black).copyWith(
    headlineLarge: TextStyle(fontSize: 34, height: 1.1, fontWeight: FontWeight.w900, color: p.ink),
    headlineMedium: TextStyle(fontSize: 28, height: 1.15, fontWeight: FontWeight.w800, color: p.ink),
    titleLarge: TextStyle(fontSize: 21, height: 1.2, fontWeight: FontWeight.w800, color: p.ink),
    titleMedium: TextStyle(fontSize: 17, height: 1.25, fontWeight: FontWeight.w700, color: p.ink),
    bodyLarge: TextStyle(fontSize: 16, height: 1.4, color: p.ink),
    bodyMedium: TextStyle(fontSize: 14, height: 1.4, color: p.ink),
    bodySmall: TextStyle(fontSize: 12, height: 1.35, color: p.muted),
    labelLarge: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700));
  return ThemeData(useMaterial3: true, brightness: brightness, fontFamily: 'Roboto',
    colorScheme: scheme, extensions: [p], textTheme: type, scaffoldBackgroundColor: p.canvas,
    appBarTheme: AppBarTheme(backgroundColor: p.canvas, foregroundColor: p.ink,
      elevation: 0, centerTitle: false, surfaceTintColor: Colors.transparent,
      titleTextStyle: TextStyle(fontSize: 21, fontWeight: FontWeight.w800, color: p.ink)),
    cardTheme: CardThemeData(color: p.surface, surfaceTintColor: Colors.transparent,
      elevation: 0, margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.card),
        side: BorderSide(color: p.border))),
    navigationBarTheme: NavigationBarThemeData(backgroundColor: p.surface,
      surfaceTintColor: Colors.transparent, indicatorColor: p.subtle, height: 72,
      labelTextStyle: WidgetStateProperty.resolveWith((states) => TextStyle(fontSize: 11,
        fontWeight: states.contains(WidgetState.selected) ? FontWeight.w800 : FontWeight.w600,
        color: states.contains(WidgetState.selected) ? p.accent : p.muted))),
    inputDecorationTheme: InputDecorationTheme(filled: true, fillColor: p.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      labelStyle: TextStyle(color: p.muted), hintStyle: TextStyle(color: p.muted),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadius.control),
        borderSide: BorderSide(color: p.border)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadius.control),
        borderSide: BorderSide(color: p.border)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadius.control),
        borderSide: BorderSide(color: p.accent, width: 2))),
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(
      minimumSize: const Size(48, 48), shape: const StadiumBorder(),
      padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
      textStyle: const TextStyle(fontWeight: FontWeight.w800))),
    outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(
      minimumSize: const Size(48, 48), shape: const StadiumBorder(),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12))),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: p.accent, foregroundColor: scheme.onPrimary),
    chipTheme: ChipThemeData(shape: const StadiumBorder(), side: BorderSide(color: p.border),
      selectedColor: p.subtle, backgroundColor: p.surface,
      labelStyle: TextStyle(fontWeight: FontWeight.w700, color: p.ink)),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating));
}
