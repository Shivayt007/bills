import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sa_traders_billing/core/theme/app_theme.dart';
import 'package:sa_traders_billing/features/billing/domain/billing_calculator.dart';
import 'package:sa_traders_billing/features/billing/domain/grouped_returns.dart';
import 'package:sa_traders_billing/features/inventory/domain/material_holdings.dart';
import 'package:sa_traders_billing/features/inventory/presentation/material_holdings_table.dart';

void main() {
  final today = DateTime.utc(2026, 11, 13);
  Map<String, dynamic> bill(String number, String phone, int jackey,
      {int sheet = 0, int returned = 0, String status = 'open'}) =>
    hydrateRentalBill({
      'bill_no': number, 'name': 'Max Homes', 'mobile': phone,
      'place': 'Seruseri', 'status': status,
      'start_date': '2026-09-17', 'cycle_days': 30,
      'jackey_qty': jackey, 'sheet_qty': sheet,
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
    expect(tester.takeException(), isNull);
  });
}
