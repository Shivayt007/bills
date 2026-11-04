import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../features/auth/data/auth_repository.dart';
import '../features/billing/data/billing_repository.dart';
import '../features/billing/domain/billing_calculator.dart';

final authRepositoryProvider = Provider((ref)=>AuthRepository(FirebaseAuth.instance));
final authStateProvider = StreamProvider<User?>((ref)=>ref.watch(authRepositoryProvider).watchUser());
final billingRepositoryProvider = Provider((ref)=>BillingRepository(FirebaseFirestore.instance));
final billsProvider = StreamProvider((ref)=>ref.watch(billingRepositoryProvider).watch('bills'));
final customBillsProvider = StreamProvider((ref)=>ref.watch(billingRepositoryProvider).watch('customBills'));
final customersProvider = StreamProvider((ref)=>ref.watch(billingRepositoryProvider).watch('customers'));
final inventoryProvider = StreamProvider((ref)=>ref.watch(billingRepositoryProvider).watch('inventory'));
final slipsProvider = StreamProvider((ref)=>ref.watch(billingRepositoryProvider).watch('slips'));
final challansProvider = StreamProvider((ref)=>ref.watch(billingRepositoryProvider).watch('challans'));
final settingsProvider = StreamProvider((ref)=>ref.watch(billingRepositoryProvider).watch('settings'));
final isAdminProvider = FutureProvider((ref)=>ref.watch(authRepositoryProvider).isAdmin());
final hydratedBillsProvider = Provider((ref){
  final raw=ref.watch(billsProvider).valueOrNull??const <Map<String,dynamic>>[];
  final now=DateTime.now().toUtc();
  return raw.map((b)=>hydrateRentalBill(b,today:DateTime.utc(now.year,now.month,now.day))).toList();
});
