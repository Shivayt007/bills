import 'billing_calculator.dart';

/// Read-only cycle balances for the bill screen. The authoritative bill total
/// remains hydrateRentalBill's total_due/total_paid/pending values.
class CyclePaymentView {
  const CyclePaymentView(this.cycle, this.paid);

  final Map cycle;
  final double paid;

  int get index => (cycle['index'] as num).toInt();
  double get charge => (cycle['total'] as num).toDouble();
  double get pending => moneyRound((charge - paid).clamp(0, double.infinity));
  String get status => pending <= 0 ? 'Paid' : paid > 0 ? 'Partly paid' : 'Pending';
}

class BillCycleOverview {
  const BillCycleOverview(this.cycles, this.unallocatedCredit);

  final List<CyclePaymentView> cycles;
  final double unallocatedCredit;

  List<CyclePaymentView> get pendingCycles =>
      cycles.where((cycle) => cycle.pending > 0).toList();
}

/// Explicit cycle payments go to their recorded period. Legacy payments with
/// no cycle are assigned oldest-first for display, as on the rental invoice.
/// No Firestore payment or bill calculation is changed by this projection.
BillCycleOverview billCycleOverview(Map<String, dynamic> bill) {
  final cycles = (bill['cycles'] as List? ?? const []).cast<Map>();
  final payments = (bill['payments'] as List? ?? const []).cast<Map>();
  final allocated = List<double>.filled(cycles.length, 0);
  var unallocated = 0.0;

  for (final payment in payments.where((payment) => payment['cycle_index'] != null)) {
    var amount = ((payment['amount'] as num?)?.toDouble() ?? 0).clamp(0, double.infinity).toDouble();
    final index = cycles.indexWhere((cycle) =>
        cycle['index'] == payment['cycle_index'] &&
        (payment['cycle_start_date'] == null ||
            payment['cycle_start_date'] == cycle['start_date']) &&
        (payment['cycle_end_date'] == null ||
            payment['cycle_end_date'] == cycle['end_date']));
    if (index >= 0) {
      final room = ((cycles[index]['total'] as num).toDouble() - allocated[index])
          .clamp(0, double.infinity).toDouble();
      final applied = amount.clamp(0, room).toDouble();
      allocated[index] += applied;
      amount -= applied;
    }
    unallocated += amount;
  }

  for (final payment in payments.where((payment) => payment['cycle_index'] == null)) {
    var amount = ((payment['amount'] as num?)?.toDouble() ?? 0).clamp(0, double.infinity).toDouble();
    for (var index = 0; index < cycles.length && amount > 0; index++) {
      final room = ((cycles[index]['total'] as num).toDouble() - allocated[index])
          .clamp(0, double.infinity).toDouble();
      final applied = amount.clamp(0, room).toDouble();
      allocated[index] += applied;
      amount -= applied;
    }
    unallocated += amount;
  }

  return BillCycleOverview([
    for (var i = 0; i < cycles.length; i++)
      CyclePaymentView(cycles[i], moneyRound(allocated[i])),
  ], moneyRound(unallocated));
}

/// Difference in one cycle's rent with/without this event. Transport is never
/// included; this is only explanatory text in the material activity timeline.
double? materialEventRentChange(Map<String, dynamic> bill,
    {required bool isReturn, required int originalIndex}) {
  final field = isReturn ? 'return_history' : 'additional_history';
  final history = (bill[field] as List? ?? const []).cast<Map>();
  if (originalIndex < 0 || originalIndex >= history.length) return null;
  final effective = (history[originalIndex]['effective_from_cycle'] as num?)?.toInt();
  if (effective == null || effective < 1) return null;
  final without = <Map>[...history]..removeAt(originalIndex);
  final before = {...bill, field: without};

  double rent(Map source) {
    final snapshot = snapshotForCycle(source.cast<String, dynamic>(), effective);
    final quantities = Map<String, int>.from(snapshot['qty'] as Map);
    final woods = (snapshot['wood'] as Map).map<String, Map<String, int>>(
      (key, value) => MapEntry('$key', Map<String, int>.from(value as Map)));
    return calculateRent(quantities, woods, source.cast<String, dynamic>()).rentTotal;
  }

  return moneyRound(rent(bill) - rent(before));
}
