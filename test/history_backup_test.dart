import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sa_traders_billing/features/admin/domain/backup_codec.dart';
import 'package:sa_traders_billing/features/billing/domain/history_corrections.dart';

void main() {
  test('legacy payments without IDs select exactly one original entry', () {
    final rows = [
      <String, dynamic>{'amount': 100, 'payment_date': '2026-01-01'},
      <String, dynamic>{'amount': 100, 'payment_date': '2026-01-01'},
    ];
    expect(historyIndex(rows, rows[1], 1, 'payment_id'), 1);
    rows.removeAt(0);
    expect(() => historyIndex(rows, rows[0], 1, 'payment_id'),
      throwsStateError);
  });
  test('material edit rejects a later return exceeding amended addition', () {
    final bill = <String, dynamic>{
      'jackey_qty': 2,
      'additional_history': [
        {'effective_from_cycle': 2, 'items': {'jackey': 2}},
      ],
      'return_history': [
        {'effective_from_cycle': 3, 'items': {'jackey': 4}},
      ],
    };
    expect(() => validateMaterialLedger(bill), returnsNormally);
    (bill['additional_history'] as List).first['items']['jackey'] = 1;
    expect(() => validateMaterialLedger(bill), throwsStateError);
  });
  test('backup file round trips timestamps and validates collection keys', () {
    final when = Timestamp.fromDate(DateTime.utc(2026, 11, 5));
    final data = <String, List<Map<String, dynamic>>>{
      'bills': [
        {'bill_no': '2504', 'name': 'Suriya', 'created_at': when,
          'payments': [{'amount': 300.0}]},
      ],
      'settings': [],
    };
    final encoded = BackupCodec.encode(data, DateTime.utc(2026, 11, 5));
    final result = BackupCodec.decode(utf8.encode(encoded));
    expect(result['bills']!.single['bill_no'], '2504');
    expect(result['bills']!.single['created_at'], when);
    expect(result['settings'], isEmpty);
    final invalid = jsonDecode(encoded) as Map<String, dynamic>;
    (invalid['data'] as Map)['bills'] = [
      {'bill_no': '2504'}, {'bill_no': '2504'},
    ];
    expect(() => BackupCodec.decode(utf8.encode(jsonEncode(invalid))),
      throwsFormatException);
  });
}
