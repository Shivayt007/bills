import 'package:flutter/material.dart';

abstract final class AppColors {
  static const teal = Color(0xFF05637F);
  static const paleBlue = Color(0xFFA2BBCF);
  static const navy = Color(0xFF102F45);
  static const deepTeal = Color(0xFF07445B);
  static const gray = Color(0xFF586B78);
  static const softGray = Color(0xFFAAAAAA);
  static const ink = Color(0xFF16272E);
  static const canvas = Color(0xFFF3F7FA);
  static const surface = Colors.white;
  static const surfaceTint = Color(0xFFE8F3F6);
  static const border = Color(0xFFDCE7EC);
  static const green = Color(0xFF087655);
  static const amber = Color(0xFF9A5718);
  static const red = Color(0xFFB4233B);
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

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: AppColors.teal, brightness: Brightness.light)
      .copyWith(primary: AppColors.teal, onPrimary: Colors.white, secondary: AppColors.deepTeal,
        surface: AppColors.surface, onSurface: AppColors.ink, error: AppColors.red, outline: AppColors.border);
  final type = Typography.material2021().black.copyWith(
    headlineLarge: const TextStyle(fontSize: 34, height: 1.1, fontWeight: FontWeight.w900, color: AppColors.ink),
    headlineMedium: const TextStyle(fontSize: 28, height: 1.15, fontWeight: FontWeight.w800, color: AppColors.ink),
    titleLarge: const TextStyle(fontSize: 21, height: 1.2, fontWeight: FontWeight.w800, color: AppColors.ink),
    titleMedium: const TextStyle(fontSize: 17, height: 1.25, fontWeight: FontWeight.w700, color: AppColors.ink),
    bodyLarge: const TextStyle(fontSize: 16, height: 1.4, color: AppColors.ink),
    bodyMedium: const TextStyle(fontSize: 14, height: 1.4, color: AppColors.ink),
    bodySmall: const TextStyle(fontSize: 12, height: 1.35, color: AppColors.gray),
    labelLarge: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
  );
  return ThemeData(
    useMaterial3: true,
    fontFamily: 'Roboto',
    colorScheme: scheme,
    textTheme: type,
    scaffoldBackgroundColor: AppColors.canvas,
    appBarTheme: const AppBarTheme(backgroundColor: AppColors.canvas, foregroundColor: AppColors.ink, elevation: 0, centerTitle: false, surfaceTintColor: Colors.transparent,
      titleTextStyle: TextStyle(fontSize: 21, fontWeight: FontWeight.w800, color: AppColors.ink)),
    cardTheme: CardThemeData(color: AppColors.surface, surfaceTintColor: Colors.transparent, elevation: 0, margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadius.card), side: const BorderSide(color: AppColors.border))),
    navigationBarTheme: NavigationBarThemeData(backgroundColor: AppColors.surface, surfaceTintColor: Colors.transparent,
      indicatorColor: AppColors.surfaceTint, height: 72,
      labelTextStyle: WidgetStateProperty.resolveWith((states) => TextStyle(fontSize: 11,
        fontWeight: states.contains(WidgetState.selected) ? FontWeight.w800 : FontWeight.w600,
        color: states.contains(WidgetState.selected) ? AppColors.teal : AppColors.gray))),
    inputDecorationTheme: InputDecorationTheme(filled: true, fillColor: AppColors.surface, contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadius.control), borderSide: const BorderSide(color: AppColors.border)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadius.control), borderSide: const BorderSide(color: AppColors.border)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppRadius.control), borderSide: const BorderSide(color: AppColors.teal, width: 2))),
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(minimumSize: const Size(48, 48), shape: const StadiumBorder(), padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13), textStyle: const TextStyle(fontWeight: FontWeight.w800))),
    outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(minimumSize: const Size(48, 48), shape: const StadiumBorder(), padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12))),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(backgroundColor: AppColors.teal, foregroundColor: Colors.white),
    chipTheme: ChipThemeData(shape: const StadiumBorder(), side: const BorderSide(color: AppColors.border), selectedColor: AppColors.surfaceTint,
      backgroundColor: AppColors.surface, labelStyle: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.ink)),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}
