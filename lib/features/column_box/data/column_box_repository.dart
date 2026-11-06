import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers.dart';
import '../../billing/data/billing_repository.dart';
import '../domain/column_box_bill.dart';

final columnBoxRepositoryProvider = Provider((ref) =>
  ColumnBoxRepository(ref.watch(billingRepositoryProvider)));
final columnBoxBillsProvider = StreamProvider((ref) =>
  ref.watch(columnBoxRepositoryProvider).watch());

class ColumnBoxRepository {
  const ColumnBoxRepository(this.storage);
  final BillingRepository storage;
  static const collection = 'column_box_bills';

  Stream<List<ColumnBoxBill>> watch() => storage.watch(collection).map((rows) =>
    rows.map(ColumnBoxBill.fromMap).toList()
      ..sort((a,b) => b.createdAt.compareTo(a.createdAt)));
  Future<ColumnBoxBill?> get(String id) async {
    final value = await storage.get(collection,id);
    return value == null ? null : ColumnBoxBill.fromMap(value);
  }
  Future<String> nextInvoiceNo() async {
    final number = await storage.nextSequence('column_box_invoice_seq');
    return 'CB-${number.toString().padLeft(4,'0')}';
  }
  Future<void> save(ColumnBoxBill bill) => storage.put(collection,bill.toMap());
  Future<void> delete(String id) => storage.delete(collection,id);
}
