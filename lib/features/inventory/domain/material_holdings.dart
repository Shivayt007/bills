import '../../../core/constants.dart';

/// A read-only view of current non-wood quantities. The billing engine has
/// already applied additions and returns to `balance_qty` for each bill.
class MaterialHolding {
  const MaterialHolding(this.bill, this.quantities);
  final Map<String, dynamic> bill;
  final Map<String, int> quantities;

  String get billNo => '${bill['bill_no'] ?? '—'}';
  String get customerName => '${bill['name'] ?? 'Customer'}'.trim();
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
