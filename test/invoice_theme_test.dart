import 'dart:typed_data';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sa_traders_billing/core/theme/app_theme.dart';
import 'package:sa_traders_billing/features/billing/domain/billing_calculator.dart';
import 'package:sa_traders_billing/features/invoice/presentation/invoice_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    final font = File('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
    if (await font.exists()) {
      await (FontLoader('Roboto')..addFont(font.readAsBytes().then(
        (bytes) => ByteData.sublistView(bytes)))).load();
    }
  });
  final sample = <String, dynamic>{
    'bill_no': '2703', 'name': 'Max Homes', 'mobile': '9600463988',
    'place': 'Seruseri', 'start_date': '2026-09-17', 'cycle_days': 30,
    'jackey_qty': 100, 'sheet_qty': 5, 'jackey_rate': 65, 'sheet_rate': 35,
    'payments': <Map<String, dynamic>>[
      {'payment_date': '2026-09-26', 'amount': 3141, 'method': 'UPI'},
    ],
  };
  test('invoice uses hydrated cycle totals and the original rent calculation', () {
    final bill = hydrateRentalBill(sample, today: DateTime.utc(2026, 11, 4));
    final data = InvoiceData(bill);
    expect(data.rent.rentTotal, 6675);
    expect(data.cycles.length, 2);
    expect(data.total, 13350);
    expect(data.paid, 3141);
    expect(data.pending, 10209);
    expect(data.lines.map((l) => l.first), containsAll(['Jackey', 'Sheet']));
  });
  testWidgets('dark theme keeps surfaces, ink, and primary button contrasting', (tester) async {
    final theme = buildTheme(Brightness.dark);
    final palette = theme.extension<AppPalette>()!;
    expect(palette.ink.computeLuminance(), greaterThan(palette.surface.computeLuminance()));
    expect(theme.colorScheme.onPrimary.computeLuminance(),
      lessThan(theme.colorScheme.primary.computeLuminance()));
    await tester.pumpWidget(MaterialApp(theme: theme, home: Scaffold(
      body: Column(children: [
        Text('Billing', style: theme.textTheme.headlineMedium),
        TextField(decoration: const InputDecoration(labelText: 'Amount')),
        const FilledButton(onPressed: null, child: Text('Save')),
      ]))));
    expect(find.text('Billing'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('invoice stays printable in dark mode and creates PDF', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final bill = hydrateRentalBill(sample, today: DateTime.utc(2026, 11, 4));
    final data = InvoiceData(bill);
    final boundary = GlobalKey();
    await tester.pumpWidget(MaterialApp(theme: buildTheme(Brightness.dark),
      home: Scaffold(body: SingleChildScrollView(child:
        RepaintBoundary(key: boundary, child: InvoicePaper(data: data))))));
    expect(find.text('RENTAL CYCLES'), findsOneWidget);
    expect(find.text('PENDING'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.runAsync(() async {
      final image = await (boundary.currentContext!.findRenderObject()
        as RenderRepaintBoundary).toImage(pixelRatio: 2);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      await Directory('build/previews').create(recursive: true);
      await File('build/previews/invoice-dark.png')
        .writeAsBytes(bytes!.buffer.asUint8List());
      image.dispose();
    });
    final logo = await rootBundle.load('assets/sa-traders-logo.jpg');
    final pdf = await buildInvoicePdf(data, Uint8List.view(logo.buffer));
    expect(pdf.length, greaterThan(1000));
    await tester.runAsync(() async {
      await File('build/previews/invoice.pdf').writeAsBytes(pdf);
    });
  });
}
