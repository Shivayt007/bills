import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../lib/core/theme/app_theme.dart';
import '../lib/features/billing/data/billing_repository.dart';
import '../lib/features/billing/presentation/bill_entry_sheets.dart';

void main() {
  test('Legacy Firestore IDs match FirebaseBridge URL safe Base64', () {
    expect(BillingRepository.legacyDocumentId('2504'), 'MjUwNA');
    expect(BillingRepository.legacyDocumentId('bill 1/2'), 'YmlsbCAxLzI');
  });

  final bill = <String, dynamic>{
    'bill_no': '2504', 'name': 'Suriya', 'pending': 7200.0,
    'start_date': '2026-10-01',
    'balance_qty': {'jackey': 5, 'sheet': 0, 'span': 2},
    'balance_wood': {
      'wood_12': <String, int>{'8': 3},
      'wood_9': <String, int>{}, 'wood_6': <String, int>{},
      'runner': <String, int>{},
    },
    'payments': <Map<String, dynamic>>[],
  };

  for (final width in [320.0, 390.0]) {
    testWidgets('Return sheet fits $width and records chosen quantities', (tester) async {
      tester.view.physicalSize = Size(width, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      MaterialEntry? result;
      await tester.pumpWidget(MaterialApp(theme: buildTheme(),
        home: Scaffold(body: Builder(builder: (context) => FilledButton(
          onPressed: () async { result = await showMaterialEntry(context, bill, isReturn: true); },
          child: const Text('Open return'))))));
      await tester.tap(find.text('Open return'));
      await tester.pumpAndSettle();
      expect(find.text('Return material'), findsOneWidget);
      expect(find.text('Jackey'), findsOneWidget);
      expect(find.text('Sheet'), findsNothing);
      expect(tester.takeException(), isNull);
      await tester.tap(find.byTooltip('Add one Jackey'));
      await tester.tap(find.text('Save return'));
      await tester.pumpAndSettle();
      expect(result?.items['jackey'], 1);
    });
  }

  testWidgets('Payment sheet returns a cycle payment only after valid amount', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    PaymentEntry? result;
    final cycles = <Map>[{'index': 1, 'start_date': '2026-10-01',
      'end_date': '2026-10-30', 'total': 7200.0}];
    await tester.pumpWidget(MaterialApp(theme: buildTheme(),
      home: Scaffold(body: Builder(builder: (context) => FilledButton(
        onPressed: () async { result = await showPaymentEntry(context, bill, cycles); },
        child: const Text('Open payment'))))));
    await tester.tap(find.text('Open payment'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save payment'));
    await tester.pumpAndSettle();
    expect(result, isNull);
    await tester.tap(find.text('Full cycle'));
    await tester.tap(find.text('Save payment'));
    await tester.pumpAndSettle();
    expect(result?.amount, 7200.0);
    expect(result?.cycle['index'], 1);
    expect(tester.takeException(), isNull);
  });
}
