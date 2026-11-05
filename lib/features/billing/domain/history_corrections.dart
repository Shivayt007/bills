import 'dart:convert';
import '../../../core/constants.dart';
import 'billing_calculator.dart';

/// Finds one entry even when older bills have no payment_id/rid/aid.
/// The index is its position in the original, unreversed Firestore list.
int historyIndex(List<Map<String, dynamic>> rows, Map selected, int originalIndex,
    String idField) {
  final id = '${selected[idField] ?? ''}';
  if (id.isNotEmpty) {
    final matches = <int>[];
    for (var i = 0; i < rows.length; i++) {
      if ('${rows[i][idField] ?? ''}' == id) matches.add(i);
    }
    if (matches.length != 1) throw StateError('History changed. Refresh the bill.');
    return matches.single;
  }
  if (originalIndex < 0 || originalIndex >= rows.length ||
      jsonEncode(rows[originalIndex], toEncodable: (x) => x.toString()) !=
      jsonEncode(selected, toEncodable: (x) => x.toString())) {
    throw StateError('History changed. Refresh the bill.');
  }
  return originalIndex;
}

List<Map<String, dynamic>> historyRows(Object? raw) =>
    (raw as List? ?? const []).map((item) => Map<String, dynamic>.from(item as Map)).toList();

/// Editing an earlier addition or return must not make a later return
/// exceed what was on rent at the start of that cycle.
void validateMaterialLedger(Map<String, dynamic> bill) {
  final additions = historyRows(bill['additional_history']);
  final returns = historyRows(bill['return_history']);
  final relevant = [...additions, ...returns];
  final indexes = <int>{1};
  for (final row in relevant) {
    indexes.add(((row['effective_from_cycle'] as num?)?.toInt() ?? 1).clamp(1, 500));
  }
  for (final index in indexes) {
    for (final spec in materialCatalog) {
      var available = billQuantities(bill)[spec.key] ?? 0;
      for (final row in additions) {
        if (((row['effective_from_cycle'] as num?)?.toInt() ?? 999999) <= index) {
          available += ((row['items'] as Map?)?[spec.key] as num?)?.toInt() ?? 0;
        }
      }
      for (final row in returns) {
        if (((row['effective_from_cycle'] as num?)?.toInt() ?? 999999) <= index) {
          available -= ((row['items'] as Map?)?[spec.key] as num?)?.toInt() ?? 0;
        }
      }
      if (available < 0) throw StateError('A later return exceeds ${spec.label} on rent.');
    }
    for (final spec in woodCatalog) {
      final available = Map<String, int>.from(parseBillWood(bill)[spec.key] ?? {});
      for (final row in additions) {
        if (((row['effective_from_cycle'] as num?)?.toInt() ?? 999999) <= index) {
          final sizes = (row['wood'] as Map?)?[spec.key] as Map? ?? const {};
          for (final item in sizes.entries) {
            final size = '${item.key}';
            available[size] = (available[size] ?? 0) + (item.value as num).toInt();
          }
        }
      }
      for (final row in returns) {
        if (((row['effective_from_cycle'] as num?)?.toInt() ?? 999999) <= index) {
          final sizes = (row['wood'] as Map?)?[spec.key] as Map? ?? const {};
          for (final item in sizes.entries) {
            final size = '${item.key}';
            available[size] = (available[size] ?? 0) - (item.value as num).toInt();
          }
        }
      }
      if (available.values.any((count) => count < 0)) {
        throw StateError('A later return exceeds ${spec.label} pieces on rent.');
      }
    }
  }
}
