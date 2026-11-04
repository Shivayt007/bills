import 'package:flutter/material.dart';

abstract final class AppColors {
  static const teal = Color(0xFF05637F);
  static const paleBlue = Color(0xFFA2BBCF);
  static const gray = Color(0xFFAAAAAA);
  static const ink = Color(0xFF16272E);
  static const canvas = Color(0xFFF4F8FA);
  static const green = Color(0xFF21845B);
  static const amber = Color(0xFFB56814);
  static const red = Color(0xFFB84747);
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(seedColor: AppColors.teal, brightness: Brightness.light)
      .copyWith(primary: AppColors.teal, secondary: AppColors.paleBlue, surface: Colors.white, error: AppColors.red);
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: AppColors.canvas,
    appBarTheme: const AppBarTheme(backgroundColor: AppColors.canvas, foregroundColor: AppColors.ink, elevation: 0, centerTitle: false),
    cardTheme: CardThemeData(color: Colors.white, elevation: 0, margin: EdgeInsets.zero, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22), side: const BorderSide(color: Color(0xFFE7EEF1)))),
    inputDecorationTheme: InputDecorationTheme(filled: true, fillColor: const Color(0xFFF7FAFB), contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14), border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFDCE6EA))), enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFDCE6EA))), focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: AppColors.teal, width: 1.7))),
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(shape: const StadiumBorder(), padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14), textStyle: const TextStyle(fontWeight: FontWeight.w700))),
    outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(shape: const StadiumBorder(), padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 13))),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}
