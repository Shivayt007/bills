import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../core/constants.dart';

class BillingRepository {
  BillingRepository(this.firestore);
  final FirebaseFirestore firestore;
  CollectionReference<Map<String,dynamic>> _store(String store) => firestore.collection(businessFirestorePath).doc('business').collection(store);

  Stream<List<Map<String,dynamic>>> watch(String store) => _store(store).snapshots().map((s)=>s.docs.map((d)=>d.data()).toList());
  Future<List<Map<String,dynamic>>> all(String store) async => (await _store(store).get()).docs.map((d)=>d.data()).toList();
  Future<Map<String,dynamic>?> get(String store, String key) async => (await _store(store).doc(key).get()).data();
  Future<void> put(String store, Map<String,dynamic> data) async {
    final key=storeKeys[store]; if(key==null) throw ArgumentError('Unsupported store: $store');
    final id='${data[key]??''}'.trim(); if(id.isEmpty) throw ArgumentError('Missing $key for $store');
    await _store(store).doc(id).set(data);
  }
  Future<void> delete(String store, String key) => _store(store).doc(key).delete();
  Future<void> batch(List<({String store, Map<String,dynamic> data})> operations) async {
    final batch=firestore.batch();
    for(final op in operations){final key=storeKeys[op.store];if(key==null)throw ArgumentError('Unsupported store: ${op.store}');final id='${op.data[key]??''}'.trim();if(id.isEmpty)throw ArgumentError('Missing $key for ${op.store}');batch.set(_store(op.store).doc(id),op.data);}
    await batch.commit();
  }
  Future<int> nextSequence(String key) async {
    final ref=_store('settings').doc(key);var next=1;
    await firestore.runTransaction((tx)async{final s=await tx.get(ref);next=((s.data()?['value'] as num?)?.toInt()??0)+1;tx.set(ref,{'key':key,'value':next});});
    return next;
  }
  Future<void> replaceAll(Map<String,List<Map<String,dynamic>>> stores) async {
    for(final entry in stores.entries){await _store(entry.key).get().then((snapshot)async{for(final doc in snapshot.docs){await doc.reference.delete();}});for(var i=0;i<entry.value.length;i+=400){final batch=firestore.batch();for(final row in entry.value.skip(i).take(400)){final key=storeKeys[entry.key]!;batch.set(_store(entry.key).doc('${row[key]}'),row);}await batch.commit();}}
  }
}
