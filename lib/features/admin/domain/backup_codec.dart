import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../core/constants.dart';

class BackupCodec {
  static const schema = 'sa-traders-firestore-v1';
  static const maxImportBytes = 100 * 1024 * 1024;

  static String encode(Map<String, List<Map<String, dynamic>>> data, DateTime now) =>
      const JsonEncoder.withIndent('  ').convert({
        'schema': schema,
        'exported_at': now.toUtc().toIso8601String(),
        'business': businessName,
        'data': _plain(data),
      });

  static Object? _plain(Object? value) {
    if (value is Timestamp) {
      return {'__firestore_timestamp_us': value.microsecondsSinceEpoch};
    }
    if (value is DateTime) {
      return {'__datetime_iso': value.toUtc().toIso8601String()};
    }
    if (value is GeoPoint) {
      return {'__firestore_geopoint': [value.latitude, value.longitude]};
    }
    if (value is Map) {
      return value.map<String, Object?>(
        (key, item) => MapEntry('$key', _plain(item)));
    }
    if (value is List) return value.map(_plain).toList();
    if (value == null || value is String || value is num || value is bool) return value;
    throw FormatException('Unsupported backup field type: ${value.runtimeType}');
  }

  static Object? _firestore(Object? value) {
    if (value is List) return value.map(_firestore).toList();
    if (value is Map) {
      if (value.length == 1 && value['__firestore_timestamp_us'] is num) {
        return Timestamp.fromMicrosecondsSinceEpoch(
          (value['__firestore_timestamp_us'] as num).toInt());
      }
      if (value.length == 1 && value['__datetime_iso'] is String) {
        return DateTime.parse(value['__datetime_iso'] as String);
      }
      if (value.length == 1 && value['__firestore_geopoint'] is List) {
        final pair = value['__firestore_geopoint'] as List;
        if (pair.length == 2 && pair[0] is num && pair[1] is num) {
          return GeoPoint((pair[0] as num).toDouble(), (pair[1] as num).toDouble());
        }
      }
      return value.map<String, Object?>(
        (key, item) => MapEntry('$key', _firestore(item)));
    }
    return value;
  }

  static Map<String, List<Map<String, dynamic>>> decode(List<int> bytes) {
    if (bytes.isEmpty || bytes.length > maxImportBytes) {
      throw const FormatException('Backup file is empty or too large.');
    }
    final decoded = jsonDecode(utf8.decode(bytes));
    if (decoded is! Map || decoded['schema'] != schema ||
        decoded['business'] != businessName || decoded['data'] is! Map) {
      throw const FormatException('This is not a S.A Traders Firestore backup file.');
    }
    final source = decoded['data'] as Map;
    final result = <String, List<Map<String, dynamic>>>{};
    for (final entry in source.entries) {
      final collection = '${entry.key}';
      final idField = storeKeys[collection];
      if (idField == null || entry.value is! List) {
        throw FormatException('Unsupported backup collection: $collection');
      }
      final keys = <String>{};
      final rows = <Map<String, dynamic>>[];
      for (final item in entry.value as List) {
        if (item is! Map) throw FormatException('Invalid $collection record.');
        final restored = _firestore(item);
        if (restored is! Map<String, Object?>) {
          throw FormatException('Invalid $collection record.');
        }
        final row = Map<String, dynamic>.from(restored);
        final id = '${row[idField] ?? ''}'.trim();
        if (id.isEmpty || !keys.add(id)) {
          throw FormatException('Missing or duplicate $idField in $collection.');
        }
        rows.add(row);
      }
      result[collection] = rows;
    }
    if (result.isEmpty) throw const FormatException('No business records found.');
    return result;
  }
}
