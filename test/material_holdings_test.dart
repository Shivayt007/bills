import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sa_traders_billing/core/theme/app_theme.dart';
import 'package:sa_traders_billing/features/billing/domain/billing_calculator.dart';
import 'package:sa_traders_billing/features/billing/domain/grouped_returns.dart';
import 'package:sa_traders_billing/features/inventory/domain/material_holdings.dart';
import 'package:sa_traders_billing/features/inventory/presentation/material_holdings_table.dart';
import 'package:sa_traders_billing/features/inventory/presentation/customer_material_statement_screen.dart';

void main() {
  final today = DateTime.utc(2026, 11, 13);
  Map<String, dynamic> bill(String number, String phone, int jackey,
      {int sheet = 0, int returned = 0, String status = 'open',
       String wood = '0', int transport = 0}) =>
    hydrateRentalBill({
      'bill_no': number, 'name': 'Max Homes', 'mobile': phone,
      'place': 'Seruseri', 'status': status,
      'start_date': '2026-09-17', 'cycle_days': 30,
      'jackey_qty': jackey, 'sheet_qty': sheet,
      'wood_12': wood, 'transport_up_trips': transport,
      'transport_up_charge': 300,
      'return_history': returned == 0 ? <Map>[] : [
        {'date': '2026-10-01', 'effective_from_cycle': 2,
          'items': {'jackey': returned}},
      ],
    }, today: today);

  test('keeps bills separate, subtracts returns and excludes closed bills', () {
    final first = bill('2703', '9600463988', 100, sheet: 5, returned: 10);
    final second = bill('2715', '9600463988', 30);
    final closed = bill('old', '9600463988', 200, status: 'closed');
    final other = bill('other', '9999999999', 9);
    final all = materialHoldings([second, closed, first, other]);
    final customer = all.where((row) => sameRentalCustomer(row.bill, first)).toList();
    expect(customer.map((row) => row.billNo), ['2703', '2715']);
    expect(customer.map((row) => row.quantities['jackey']), [90, 30]);
    expect(materialHoldingTotals(customer)['jackey'], 120);
    expect(materialHoldingTotals(all)['jackey'], 129);
    expect(materialHoldingTotals(customer)['sheet'], 5);
    expect(sameRentalCustomer(first, other), isFalse);
    expect(sameRentalCustomer(first, bill('plus91', '+91 9600463988', 0)), isTrue);
  });

  test('statement rent is one active cycle per bill without transport', () {
    final first = bill('2703', '9600463988', 100,
      sheet: 5, returned: 10, wood: '8×2', transport: 1);
    final second = bill('2715', '9600463988', 30);
    final rows = materialHoldings([first, second]);
    // Active cycle #2: (90 × 65) + (5 × 35) + (16 ft × 18).
    expect(rows[0].singleCycleRent, 6313);
    expect(rows[1].singleCycleRent, 1950);
    expect(materialHoldingCycleRentTotal(rows), 8263);
    expect((first['cycles'] as List).first['total'], 7263);
    expect(first['total_due'], greaterThan(rows[0].singleCycleRent));
  });

  testWidgets('spreadsheet scrolls horizontally on a narrow phone', (tester) async {
    tester.view.physicalSize = const Size(320, 750);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final rows = materialHoldings([bill('2703', '9600463988', 100)]);
    await tester.pumpWidget(MaterialApp(theme: buildTheme(), home: Scaffold(
      body: SingleChildScrollView(child: MaterialHoldingsTable(
        rows: rows, showCustomer: false, onOpenBill: (_) {})))));
    expect(find.text('#2703'), findsOneWidget);
    expect(find.text('TOTAL MATERIAL PRESENT'), findsOneWidget);
    expect(find.byType(Checkbox), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('shareable paper contains every bill and full-width totals in dark mode', (tester) async {
    tester.view.physicalSize = const Size(320, 750);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final rows = materialHoldings([
      bill('2703', '9600463988', 100, sheet: 5, returned: 10,
        wood: '8×2', transport: 1),
      bill('2715', '9600463988', 30),
    ]);
    await tester.pumpWidget(MaterialApp(theme: buildTheme(Brightness.dark),
      home: Scaffold(body: SingleChildScrollView(scrollDirection: Axis.horizontal,
        child: RepaintBoundary(child: MaterialStatementPaper(
          customer: 'Max Homes', phone: '9600463988', rows: rows, asOf: today))))));
    expect(find.text('#2703'), findsOneWidget);
    expect(find.text('#2715'), findsOneWidget);
    expect(find.text('TOTAL MATERIAL PRESENT'), findsOneWidget);
    expect(find.text('120'), findsOneWidget);
    expect(find.text('RENT / CYCLE (₹)'), findsOneWidget);
    expect(find.text('₹6313.00'), findsOneWidget);
    expect(find.text('₹1950.00'), findsOneWidget);
    expect(find.text('₹8263.00'), findsOneWidget);
    expect(find.text('WOOD'), findsNothing);
    expect(find.byType(MaterialStatementPaper).evaluate().single.size!.width, 1250);
    expect(tester.takeException(), isNull);
  });
}
