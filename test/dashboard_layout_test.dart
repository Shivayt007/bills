import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import '../lib/core/providers.dart';
import '../lib/core/theme/app_theme.dart';
import '../lib/features/home/presentation/home_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    final fontFile = File('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
    if (await fontFile.exists()) {
      await (FontLoader('PreviewSans')
        ..addFont(fontFile.readAsBytes().then((bytes) => ByteData.sublistView(bytes)))).load();
    }
    final iconFile = File('${Platform.environment['FLUTTER_ROOT']}/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
    if (await iconFile.exists()) {
      await (FontLoader('MaterialIcons')
        ..addFont(iconFile.readAsBytes().then((bytes) => ByteData.sublistView(bytes)))).load();
    }
  });

  final sample = <String, dynamic>{
    'bill_no': '2504', 'name': 'Suriya', 'mobile': '9361354349',
    'status': 'open', 'total_due': 12600.0, 'total_paid': 5400.0, 'pending': 7200.0,
  };
  for (final width in [320.0, 390.0, 768.0]) {
    testWidgets('Dashboard fits $width without overflow', (tester) async {
      tester.view.physicalSize = Size(width, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final boundary = GlobalKey();
      await tester.pumpWidget(ProviderScope(overrides: [
        billsProvider.overrideWith((ref) => const Stream.empty()),
        hydratedBillsProvider.overrideWith((ref) => [sample]),
      ], child: MaterialApp(theme: buildTheme().copyWith(
        textTheme: buildTheme().textTheme.apply(fontFamily: 'PreviewSans')),
        home: RepaintBoundary(key: boundary,
          child: HomeScreen(onNavigate: (_) {})))));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Rental overview'), findsOneWidget);
      expect(find.text('₹7200.00'), findsWidgets);
      if (width == 390) {
        await tester.runAsync(() async {
          final image = await (boundary.currentContext!.findRenderObject()
            as RenderRepaintBoundary).toImage(pixelRatio: 2);
          final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
          await Directory('build/previews').create(recursive: true);
          await File('build/previews/dashboard.png')
            .writeAsBytes(bytes!.buffer.asUint8List());
          image.dispose();
        });
      }
    });
  }
  testWidgets('Dark dashboard keeps cards and labels visible', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final boundary = GlobalKey();
    final dark = buildTheme(Brightness.dark);
    await tester.pumpWidget(ProviderScope(overrides: [
      billsProvider.overrideWith((ref) => const Stream.empty()),
      hydratedBillsProvider.overrideWith((ref) => [sample]),
    ], child: MaterialApp(theme: dark.copyWith(
      textTheme: dark.textTheme.apply(fontFamily: 'PreviewSans')),
      home: RepaintBoundary(key: boundary,
        child: HomeScreen(onNavigate: (_) {})))));
    await tester.pumpAndSettle();
    expect(find.text('Rental overview'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.runAsync(() async {
      final image = await (boundary.currentContext!.findRenderObject()
        as RenderRepaintBoundary).toImage(pixelRatio: 2);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      await Directory('build/previews').create(recursive: true);
      await File('build/previews/dashboard-dark.png')
        .writeAsBytes(bytes!.buffer.asUint8List());
      image.dispose();
    });
  });
}
