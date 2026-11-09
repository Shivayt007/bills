import 'package:flutter_test/flutter_test.dart';
import 'package:sa_traders_billing/features/billing/domain/billing_calculator.dart';
import 'package:sa_traders_billing/features/billing/domain/grouped_returns.dart';
import 'package:sa_traders_billing/features/billing/domain/return_service.dart';

Map<String, dynamic> bill(String number, int jackey, {String name = 'Suriya',
    String phone = '9876543210', String status = 'open'}) => {
  'bill_no': number, 'name': name, 'mobile': phone, 'place': 'Site',
  'start_date': '2026-10-01', 'cycle_days': 30, 'status': status,
  'jackey_qty': jackey, 'jackey_rate': 65,
  'return_history': <Map<String, dynamic>>[],
};

void main() {
  final date = DateTime.utc(2026, 11, 2); // cycle #2, three days in
  test('return in new cycle can reduce rent for that cycle', () {
    final primary = bill('A', 100);
    final split = allocateReturn(primary: primary, bills: [primary],
      items: {'jackey': 20}, wood: {}, date: date,
      applyToCurrentCycle: true);
    expect(split.single.effectiveCycle, 2);
    final changed = hydrateRentalBill({...primary, 'return_history': [
      {'effective_from_cycle': split.single.effectiveCycle,
        'items': split.single.items, 'wood': split.single.wood},
    ]}, today: date);
    expect((changed['cycles'] as List)[0]['rent'], 6500);
    expect((changed['cycles'] as List)[1]['rent'], 5200);
    expect(changed['total_due'], 11700);
    final next = allocateReturn(primary: primary, bills: [primary],
      items: {'jackey': 20}, wood: {}, date: date,
      applyToCurrentCycle: false);
    expect(next.single.effectiveCycle, 3);
    final earliest = allocateReturn(primary: primary, bills: [primary],
      items: {'jackey': 20}, wood: {}, date: date,
      applyToCurrentCycle: false, effectiveCycles: {'A': 1});
    expect(earliest.single.effectiveCycle, 1);
    expect(() => allocateReturn(primary: primary, bills: [primary],
      items: {'jackey': 20}, wood: {}, date: date,
      applyToCurrentCycle: false, effectiveCycles: {'A': 4}), throwsStateError);
  });

  test('single return splits across matching open bills, including absent material', () {
    final a = bill('A', 100), b = bill('B', 50), outsider = bill('C', 999, phone: '1111111111');
    final split = allocateReturn(primary: a, bills: [a, b, outsider],
      items: {'jackey': 120}, wood: {}, date: date,
      applyToCurrentCycle: true);
    expect(split.map((x) => x.billNo), ['A', 'B']);
    expect(split.map((x) => x.items['jackey']), [100, 20]);
    final independent = allocateReturn(primary: a, bills: [a, b],
      items: {'jackey': 120}, wood: {}, date: date,
      applyToCurrentCycle: false, effectiveCycles: {'A': 1, 'B': 2});
    expect(independent.map((x) => x.effectiveCycle), [1, 2]);
    expect(() => allocateReturn(primary: a, bills: [a, b],
      items: {'jackey': 151}, wood: {}, date: date,
      applyToCurrentCycle: true), throwsStateError);
  });

  test('rejects other customer and closed bills; checks wood by size', () {
    final a = {...bill('A', 0), 'wood_12': '8×1'};
    final b = {...bill('B', 0), 'wood_12': '8×2'};
    final split = allocateReturn(primary: a, bills: [a, b], items: {},
      wood: {'wood_12': {'8': 3}}, date: date,
      applyToCurrentCycle: true);
    expect(split.map((x) => x.wood['wood_12']?['8']), [1, 2]);
    expect(() => allocateReturn(primary: a, bills: [a, {...b, 'status': 'closed'}],
      items: {}, wood: {'wood_12': {'8': 2}}, date: date,
      applyToCurrentCycle: true), throwsStateError);
  });

  test('editing a grouped return removes the old allocation before reallocating', () {
    final a = {...bill('A', 100), 'return_history': [
      {'rid': 'r1', 'return_group_id': 'g', 'effective_from_cycle': 2,
        'items': {'jackey': 100}, 'wood': {}},
    ]};
    final b = {...bill('B', 50), 'return_history': [
      {'rid': 'r2', 'return_group_id': 'g', 'effective_from_cycle': 2,
        'items': {'jackey': 20}, 'wood': {}},
    ]};
    final draft = ReturnDraft(billNo: 'A', date: '2026-11-02', note: '',
      items: {'jackey': 130}, wood: {}, applyToCurrentCycle: true,
      oldId: 'r1', oldGroupId: 'g');
    final cleared = [a, b].map((bill) => {...bill,
      'return_history': withoutReturnGroup(bill, groupId: draft.oldGroupId)}).toList();
    final split = allocateReturn(primary: cleared.first, bills: cleared,
      items: draft.items, wood: draft.wood, date: parseBillingDate(draft.date)!,
      applyToCurrentCycle: draft.applyToCurrentCycle);
    expect(split.map((x) => x.items['jackey']), [100, 30]);
    expect(withoutReturnGroup(b, groupId: 'g'), isEmpty);
  });
}
