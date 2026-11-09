import '../../../core/constants.dart';
import 'billing_calculator.dart';
import 'history_corrections.dart';

String _phone(Object? value) {
  final digits = '$value'.replaceAll(RegExp(r'\D'), '');
  return digits.length >= 10 ? digits.substring(digits.length - 10) : digits;
}
String _identity(Object? value) => '$value'.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');

/// Only link bills with the same phone; when both phones are absent, require
/// both the exact customer name and place to avoid combining namesakes.
bool sameRentalCustomer(Map a, Map b) {
  final pa = _phone(a['mobile']), pb = _phone(b['mobile']);
  if (pa.isNotEmpty || pb.isNotEmpty) return pa.length >= 10 && pa == pb;
  final name = _identity(a['name']), place = _identity(a['place']);
  return name.isNotEmpty && place.isNotEmpty &&
      name == _identity(b['name']) && place == _identity(b['place']);
}

class ReturnAllocation {
  const ReturnAllocation(this.billNo, this.items, this.wood, this.effectiveCycle);
  final String billNo;
  final Map<String, int> items;
  final Map<String, Map<String, int>> wood;
  final int effectiveCycle;
}

/// Allocate the selected bill first, then other open bills belonging to that
/// customer. The whole operation is rejected if any piece cannot be assigned.
List<ReturnAllocation> allocateReturn({
  required Map<String, dynamic> primary,
  required List<Map<String, dynamic>> bills,
  required Map<String, int> items,
  required Map<String, Map<String, int>> wood,
  required DateTime date,
  required bool applyToCurrentCycle,
}) {
  final candidates = [primary, ...bills.where((b) =>
    '${b['bill_no']}' != '${primary['bill_no']}' && b['status'] != 'closed' &&
    sameRentalCustomer(primary, b))];
  final left = {for (final spec in materialCatalog) spec.key: items[spec.key] ?? 0};
  final woodLeft = {for (final spec in woodCatalog)
    spec.key: Map<String, int>.from(wood[spec.key] ?? {})};
  if (left.values.any((n) => n < 0) || woodLeft.values.any((m) => m.values.any((n) => n < 0))) {
    throw StateError('Return quantities cannot be negative.');
  }
  final result = <ReturnAllocation>[];
  for (final bill in candidates) {
    final start = parseBillingDate(bill['start_date']);
    if (start == null || start.isAfter(date)) continue;
    final days = (bill['cycle_days'] as num?)?.toInt() ?? 30;
    final cycle = cycleIndex(start, days, date);
    final effective = cycle + (applyToCurrentCycle && cycle > 1 ? 0 : 1);
    // A return cannot precede its own material addition. Ledger validation
    // catches such cases instead of silently clamping the snapshot.
    final refreshed = hydrateRentalBill(bill, today: date);
    final available = refreshed['balance_qty'] as Map;
    final out = {for (final spec in materialCatalog)
      spec.key: left[spec.key]!.clamp(0, (available[spec.key] as num).toInt()).toInt()};
    final availableWood = refreshed['balance_wood'] as Map;
    final woodOut = <String, Map<String, int>>{};
    for (final spec in woodCatalog) {
      final held = availableWood[spec.key] as Map? ?? const {};
      woodOut[spec.key] = {for (final e in woodLeft[spec.key]!.entries)
        if (e.value > 0 && ((held[e.key] as num?)?.toInt() ?? 0) > 0)
          e.key: e.value.clamp(0, (held[e.key] as num).toInt()).toInt()};
    }
    if (out.values.every((v) => v == 0) &&
        woodOut.values.every((v) => v.isEmpty)) continue;
    for (final e in out.entries) left[e.key] = left[e.key]! - e.value;
    for (final spec in woodCatalog) {
      for (final e in woodOut[spec.key]!.entries) {
        woodLeft[spec.key]![e.key] = woodLeft[spec.key]![e.key]! - e.value;
      }
    }
    result.add(ReturnAllocation('${bill['bill_no']}', out, woodOut, effective));
  }
  if (result.isEmpty || left.values.any((v) => v > 0) ||
      woodLeft.values.any((m) => m.values.any((v) => v > 0))) {
    throw StateError('The customer’s open bills do not have enough of this material or wood size.');
  }
  for (final allocation in result) {
    final bill = candidates.firstWhere((b) => '${b['bill_no']}' == allocation.billNo);
    validateMaterialLedger({...bill, 'return_history': [
      ...historyRows(bill['return_history']),
      {'effective_from_cycle': allocation.effectiveCycle,
       'items': allocation.items, 'wood': allocation.wood},
    ]});
  }
  return result;
}
