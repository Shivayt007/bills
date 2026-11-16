import '../../../core/constants.dart';
import '../../billing/domain/billing_calculator.dart';

/// A read-only view of current non-wood quantities. The billing engine has
/// already applied additions and returns to `balance_qty` for each bill.
class MaterialHolding {
  const MaterialHolding(this.bill, this.quantities);
  final Map<String, dynamic> bill;
  final Map<String, int> quantities;

  String get billNo => '${bill['bill_no'] ?? '—'}';
  String get customerName => '${bill['name'] ?? 'Customer'}'.trim();

  /// The active cycle's rent already reflects additions and returns effective
  /// for that cycle. It excludes first-cycle transport, payments and deposit.
  double get singleCycleRent {
    final cycles = bill['cycles'] as List? ?? const [];
    if (cycles.isEmpty) return 0;
    return moneyRound((cycles.last as Map)['rent'] as num? ?? 0);
  }
}

List<MaterialHolding> materialHoldings(Iterable<Map<String, dynamic>> bills) {
  final rows = <MaterialHolding>[];
  for (final bill in bills) {
    if (bill['status'] == 'closed') continue;
    final balance = bill['balance_qty'] as Map? ?? const {};
    rows.add(MaterialHolding(bill, {
      for (final spec in materialCatalog)
        spec.key: ((balance[spec.key] as num?)?.toInt() ?? 0).clamp(0, 0x7fffffff).toInt(),
    }));
  }
  rows.sort((a, b) {
    final customer = a.customerName.toLowerCase().compareTo(b.customerName.toLowerCase());
    if (customer != 0) return customer;
    final start = '${a.bill['start_date'] ?? ''}'.compareTo('${b.bill['start_date'] ?? ''}');
    return start != 0 ? start : a.billNo.compareTo(b.billNo);
  });
  return rows;
}

Map<String, int> materialHoldingTotals(Iterable<MaterialHolding> rows) => {
  for (final spec in materialCatalog)
    spec.key: rows.fold<int>(0, (total, row) => total + (row.quantities[spec.key] ?? 0)),
};

double materialHoldingCycleRentTotal(Iterable<MaterialHolding> rows) =>
    moneyRound(rows.fold<double>(0, (sum, row) => sum + row.singleCycleRent));
