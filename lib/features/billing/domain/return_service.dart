import '../data/billing_repository.dart';
import 'billing_calculator.dart';
import 'grouped_returns.dart';
import 'history_corrections.dart';

class ReturnDraft {
  const ReturnDraft({required this.billNo, required this.date, required this.note,
    required this.items, required this.wood, required this.applyToCurrentCycle,
    this.oldId, this.oldGroupId});
  final String billNo, date, note;
  final Map<String, int> items;
  final Map<String, Map<String, int>> wood;
  final bool applyToCurrentCycle;
  final String? oldId, oldGroupId;
}

bool belongsToReturnGroup(Map row, {String? groupId, String? id}) =>
  groupId != null && groupId.isNotEmpty
    ? row['return_group_id'] == groupId
    : id != null && row['rid'] == id;

List<Map<String, dynamic>> withoutReturnGroup(Map bill,
    {String? groupId, String? id}) => historyRows(bill['return_history'])
      .where((row) => !belongsToReturnGroup(row, groupId: groupId, id: id)).toList();

class ReturnService {
  const ReturnService(this.repository);
  final BillingRepository repository;

  Future<List<Map<String, dynamic>>> customerBills(String billNo) async {
    final all = await repository.all('bills');
    final primary = all.where((b) => '${b['bill_no']}' == billNo).firstOrNull;
    if (primary == null) throw StateError('Bill not found. Refresh and try again.');
    return [primary, ...all.where((b) => '${b['bill_no']}' != billNo &&
      b['status'] != 'closed' && sameRentalCustomer(primary, b))];
  }

  Future<List<Map<String, dynamic>>> groupBills(String billNo, String? groupId) async {
    final all = await repository.all('bills');
    return all.where((b) => '${b['bill_no']}' == billNo ||
      groupId != null && historyRows(b['return_history']).any((row) =>
        row['return_group_id'] == groupId)).toList();
  }

  List<ReturnAllocation> preview(ReturnDraft draft, List<Map<String, dynamic>> bills) {
    final candidates = bills.map((b) => {...b,
      'return_history': withoutReturnGroup(b,
        groupId: draft.oldGroupId,
        id: '${b['bill_no']}' == draft.billNo ? draft.oldId : null)}).toList();
    final primary = candidates.where((b) => '${b['bill_no']}' == draft.billNo).first;
    return allocateReturn(primary: primary, bills: candidates,
      items: draft.items, wood: draft.wood, date: parseBillingDate(draft.date)!,
      applyToCurrentCycle: draft.applyToCurrentCycle);
  }

  /// All affected bills are re-read and written atomically, with the preview
  /// checked again against the latest quantities before committing.
  Future<void> save(ReturnDraft draft, List<ReturnAllocation> expected,
      List<Map<String, dynamic>> bills, String actor) async {
    final ids = bills.map((b) => '${b['bill_no']}').toList();
    final groupId = draft.oldGroupId ?? 'retgroup-${DateTime.now().microsecondsSinceEpoch}';
    final now = DateTime.now().toUtc().toIso8601String();
    await repository.changeBills(ids, (latest) {
      if (draft.oldId != null &&
          !historyRows(latest[draft.billNo]?['return_history']).any((row) =>
            belongsToReturnGroup(row, groupId: draft.oldGroupId, id: draft.oldId))) {
        throw StateError('Return history changed. Refresh and try again.');
      }
      final allocations = preview(draft, latest.values.toList());
      String signature(List<ReturnAllocation> list) => list.map((a) =>
        '${a.billNo}:${a.effectiveCycle}:${a.items}:${a.wood}').join('|');
      if (signature(allocations) != signature(expected)) {
        throw StateError('Material balances changed. Review the return split again.');
      }
      final updates = <String, Map<String, dynamic>>{};
      for (final bill in latest.values) {
        final id = '${bill['bill_no']}';
        final old = historyRows(bill['return_history']);
        final remaining = withoutReturnGroup(bill,
          groupId: draft.oldGroupId,
          id: id == draft.billNo ? draft.oldId : null);
        final allocation = allocations.where((a) => a.billNo == id).firstOrNull;
        if (old.length == remaining.length && allocation == null) continue;
        final updatedRows = [...remaining];
        if (allocation != null) updatedRows.add({
          'rid': 'ret-${DateTime.now().microsecondsSinceEpoch}-$id',
          'return_group_id': groupId,
          'date': draft.date, 'note': draft.note,
          'effective_from_cycle': allocation.effectiveCycle,
          'items': allocation.items, 'wood': allocation.wood,
          'created_by': actor, 'created_at': now,
        });
        final updated = {...bill, 'return_history': updatedRows,
          'history_audit': [...historyRows(bill['history_audit']), {
            'action': draft.oldId == null ? 'created' : 'edited',
            'type': 'return_history', 'group_id': groupId,
            'before': old.where((row) => belongsToReturnGroup(row,
              groupId: draft.oldGroupId,
              id: id == draft.billNo ? draft.oldId : null)).toList(),
            'after': allocation == null ? null : updatedRows.last,
            'by': actor, 'at': now,
          }]};
        validateMaterialLedger(updated);
        updates[id] = updated;
      }
      return updates;
    });
  }

  Future<void> delete(String billNo, Map selected, String actor) async {
    final groupId = selected['return_group_id'] as String?;
    final id = selected['rid'] as String?;
    final involved = await groupBills(billNo, groupId);
    await repository.changeBills(involved.map((b) => '${b['bill_no']}').toList(), (latest) {
      if (!historyRows(latest[billNo]?['return_history']).any((row) =>
          belongsToReturnGroup(row, groupId: groupId, id: id))) {
        throw StateError('Return history changed. Refresh and try again.');
      }
      final updates = <String, Map<String, dynamic>>{};
      for (final bill in latest.values) {
        final billId = '${bill['bill_no']}';
        final old = historyRows(bill['return_history']);
        final rows = withoutReturnGroup(bill,
          groupId: groupId, id: billId == billNo ? id : null);
        if (rows.length == old.length) continue;
        final updated = {...bill, 'return_history': rows,
          'history_audit': [...historyRows(bill['history_audit']), {
            'action': 'deleted', 'type': 'return_history',
            'group_id': groupId, 'before': old.where((row) =>
              belongsToReturnGroup(row, groupId: groupId,
                id: billId == billNo ? id : null)).toList(), 'by': actor,
            'at': DateTime.now().toUtc().toIso8601String(),
          }]};
        validateMaterialLedger(updated);
        updates[billId] = updated;
      }
      return updates;
    });
  }
}
