import 'dart:convert';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../core/constants.dart';

class BillingRepository {
  BillingRepository(this.firestore);
  final FirebaseFirestore firestore;
  CollectionReference<Map<String,dynamic>> _store(String store) => firestore.collection(businessFirestorePath).doc('business').collection(store);

  // FirebaseBridge.java used Base64.URL_SAFE | NO_WRAP | NO_PADDING for every
  // record ID. Keep that identity so old bills are updated in place.
  static String legacyDocumentId(String key) => base64Url.encode(utf8.encode(key)).replaceAll('=', '');

  Future<DocumentReference<Map<String,dynamic>>> _existingOrLegacy(String store, String key) async {
    final encoded = _store(store).doc(legacyDocumentId(key));
    if ((await encoded.get()).exists) return encoded;
    final plain = _store(store).doc(key);
    if ((await plain.get()).exists) return plain; // Flutter's first build wrote plain IDs.
    return encoded;
  }

  Stream<List<Map<String,dynamic>>> watch(String store) => _store(store).snapshots().map((s)=>s.docs.map((d)=>d.data()).toList());
  Future<List<Map<String,dynamic>>> all(String store) async => (await _store(store).get()).docs.map((d)=>d.data()).toList();
  Future<Map<String,dynamic>?> get(String store, String key) async =>
      (await (await _existingOrLegacy(store, key)).get()).data();
  Future<void> put(String store, Map<String,dynamic> data) async {
    final key=storeKeys[store]; if(key==null) throw ArgumentError('Unsupported store: $store');
    final id='${data[key]??''}'.trim(); if(id.isEmpty) throw ArgumentError('Missing $key for $store');
    await (await _existingOrLegacy(store, id)).set(data);
  }
  Future<void> delete(String store, String key) async =>
      (await _existingOrLegacy(store, key)).delete();
  Future<void> batch(List<({String store, Map<String,dynamic> data})> operations) async {
    final batch=firestore.batch();
    for(final op in operations){final key=storeKeys[op.store];if(key==null)throw ArgumentError('Unsupported store: ${op.store}');final id='${op.data[key]??''}'.trim();if(id.isEmpty)throw ArgumentError('Missing $key for ${op.store}');batch.set(await _existingOrLegacy(op.store,id),op.data);}
    await batch.commit();
  }
  /// Read every involved bill again inside the transaction so an intervening
  /// payment or return cannot be overwritten by a multi-bill correction.
  Future<void> changeBills(List<String> ids,
      Map<String, dynamic> Function(Map<String, Map<String, dynamic>>) change) async {
    final refs = <String, DocumentReference<Map<String, dynamic>>>{};
    for (final id in ids.toSet()) {
      refs[id] = await _existingOrLegacy('bills', id);
    }
    await firestore.runTransaction((tx) async {
      final originals = <String, Map<String, dynamic>>{};
      for (final entry in refs.entries) {
        final snap = await tx.get(entry.value);
        if (!snap.exists) throw StateError('Bill #${entry.key} no longer exists. Refresh and try again.');
        originals[entry.key] = snap.data()!;
      }
      final updates = change(originals);
      for (final entry in updates.entries) {
        final ref = refs[entry.key];
        if (ref == null) throw StateError('Bill #${entry.key} was not loaded.');
        tx.set(ref, entry.value);
      }
    });
  }
  Future<int> nextSequence(String key) async {
    final ref=await _existingOrLegacy('settings',key);var next=1;
    await firestore.runTransaction((tx)async{final s=await tx.get(ref);next=((s.data()?['value'] as num?)?.toInt()??0)+1;tx.set(ref,{'key':key,'value':next});});
    return next;
  }
  Future<void> replaceAll(Map<String,List<Map<String,dynamic>>> stores) async {
    for(final entry in stores.entries){await _store(entry.key).get().then((snapshot)async{for(final doc in snapshot.docs){await doc.reference.delete();}});for(var i=0;i<entry.value.length;i+=400){final batch=firestore.batch();for(final row in entry.value.skip(i).take(400)){final key=storeKeys[entry.key]!;batch.set(_store(entry.key).doc(legacyDocumentId('${row[key]}')),row);}await batch.commit();}}
  }
}
