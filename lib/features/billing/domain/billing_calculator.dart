import '../../../core/constants.dart';

typedef QtyMap = Map<String, int>;
typedef WoodMap = Map<String, Map<String, int>>;

double _num(Object? v, [double fallback = 0]) {
  if (v is num) return v.toDouble();
  return double.tryParse('$v') ?? fallback;
}

int _int(Object? v, [int fallback = 0]) => _num(v, fallback.toDouble()).truncate();
int _nonNegative(Object? v) => _int(v).clamp(0, 0x7fffffff);
double moneyRound(num value) => ((value.toDouble() + 2.220446049250313e-16) * 100).round() / 100;

DateTime? parseBillingDate(Object? value) {
  if (value == null || '$value'.isEmpty) return null;
  final s = '$value'.substring(0, '$value'.length >= 10 ? 10 : '$value'.length);
  final d = DateTime.tryParse('${s}T00:00:00Z');
  return d == null ? null : DateTime.utc(d.year, d.month, d.day);
}

String dateKey(DateTime date) => '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
int dayDifference(DateTime a, DateTime b) => b.difference(a).inDays;

Map<String, int> parseWoodSizes(Object? raw) {
  final out = <String, int>{};
  final text = '$raw'.replaceAll(RegExp(r'[,\n+]'), ' ');
  final re = RegExp(r'(\d+(?:\.\d+)?)\s*[\*x×]\s*(\d+(?:\.\d+)?)', caseSensitive: false);
  for (final match in re.allMatches(text)) {
    final feet = double.tryParse(match.group(1)!);
    final pieces = double.tryParse(match.group(2)!)?.toInt();
    if (feet != null && feet > 0 && pieces != null && pieces > 0) {
      final key = feet == feet.roundToDouble() ? feet.toInt().toString() : feet.toString();
      out[key] = (out[key] ?? 0) + pieces;
    }
  }
  return out;
}

String woodToText(Map<String, int>? map) {
  final entries = (map ?? {}).entries.where((e) => e.value > 0).toList()
    ..sort((a, b) => (double.tryParse(a.key) ?? 0).compareTo(double.tryParse(b.key) ?? 0));
  return entries.isEmpty ? '0' : entries.map((e) => '${e.key}×${e.value}').join('+');
}

Map<String, int> _addWood(Map<String, int> a, Map<String, int> b) {
  final out = Map<String, int>.from(a);
  for (final e in b.entries) {
    final n = (out[e.key] ?? 0) + e.value;
    if (n <= 0) { out.remove(e.key); } else { out[e.key] = n; }
  }
  return out;
}

Map<String, int> _subtractWood(Map<String, int> a, Map<String, int> b) {
  final out = Map<String, int>.from(a);
  for (final e in b.entries) {
    final n = (out[e.key] ?? 0) - e.value;
    if (n <= 0) { out.remove(e.key); } else { out[e.key] = n; }
  }
  return out;
}

Map<String, Map<String, int>> parseBillWood(Map<String, dynamic> bill) => {
  for (final spec in woodCatalog) spec.key: parseWoodSizes(bill[spec.key]),
};

QtyMap billQuantities(Map<String, dynamic> bill) => {
  for (final spec in materialCatalog) spec.key: _nonNegative(bill[spec.quantityField]),
};

double billRate(Map<String, dynamic> bill, MaterialSpec spec) => _num(bill[spec.rateField], spec.defaultRate);

class RentBreakdown {
  const RentBreakdown({required this.materialTotal, required this.woodTotal, required this.rentTotal, required this.materialLines, required this.woodLines});
  final double materialTotal, woodTotal, rentTotal;
  final List<Map<String, dynamic>> materialLines, woodLines;
}

RentBreakdown calculateRent(QtyMap quantities, WoodMap woods, Map<String, dynamic> bill) {
  var materialTotal = 0.0;
  final materialLines = <Map<String, dynamic>>[];
  for (final spec in materialCatalog) {
    final qty = quantities[spec.key] ?? 0;
    final rate = billRate(bill, spec);
    final amount = moneyRound(qty * rate);
    materialTotal += amount;
    materialLines.add({'key': spec.key, 'label': spec.label, 'qty': qty, 'rate': rate, 'amount': amount});
  }
  materialTotal = moneyRound(materialTotal);
  var woodTotal = 0.0;
  final woodLines = <Map<String, dynamic>>[];
  for (final spec in woodCatalog) {
    final sizes = woods[spec.key] ?? const <String, int>{};
    var feet = 0.0, pieces = 0;
    for (final entry in sizes.entries) {
      final f = double.tryParse(entry.key) ?? 0;
      pieces += entry.value;
      feet += f * entry.value;
    }
    final rate = billRate(bill, spec), amount = moneyRound(feet * rate);
    woodTotal += amount;
    woodLines.add({'key': spec.key, 'label': spec.label, 'pieces': pieces, 'total_feet': moneyRound(feet), 'rate': rate, 'amount': amount, 'text': woodToText(sizes)});
  }
  woodTotal = moneyRound(woodTotal);
  return RentBreakdown(materialTotal: materialTotal, woodTotal: woodTotal, rentTotal: moneyRound(materialTotal + woodTotal), materialLines: materialLines, woodLines: woodLines);
}

double transportTotal(Map<String, dynamic> bill) {
  final up = _nonNegative(bill['transport_up_trips']) * _num(bill['transport_up_charge']);
  final down = _nonNegative(bill['transport_down_trips']) * _num(bill['transport_down_charge']);
  return moneyRound(up + down + _num(bill['loading_charge']) + _num(bill['unloading_charge']));
}

int cycleIndex(DateTime start, int days, DateTime date) {
  if (!date.isAfter(start)) return 1;
  return dayDifference(start, date) ~/ (days < 1 ? 1 : days) + 1;
}

Map<String, dynamic> snapshotForCycle(Map<String, dynamic> bill, int index) {
  final quantities = billQuantities(bill);
  final baseWood = parseBillWood(bill);
  final minus = {for (final s in materialCatalog) s.key: 0};
  final plus = {for (final s in materialCatalog) s.key: 0};
  final lessWood = {for (final s in woodCatalog) s.key: <String, int>{}};
  final moreWood = {for (final s in woodCatalog) s.key: <String, int>{}};
  for (final raw in (bill['return_history'] as List? ?? const [])) {
    final entry = Map<String, dynamic>.from(raw as Map);
    if (_int(entry['effective_from_cycle'], 999999) <= index) {
      for (final s in materialCatalog) minus[s.key] = minus[s.key]! + _nonNegative((entry['items'] as Map?)?[s.key]);
      for (final s in woodCatalog) lessWood[s.key] = _addWood(lessWood[s.key]!, Map<String, int>.from((entry['wood'] as Map?)?[s.key] is Map ? ((entry['wood'] as Map)[s.key] as Map).map((k,v)=>MapEntry('$k',_int(v))) : {}));
    }
  }
  for (final raw in (bill['additional_history'] as List? ?? const [])) {
    final entry = Map<String, dynamic>.from(raw as Map);
    if (_int(entry['effective_from_cycle'], 999999) <= index) {
      for (final s in materialCatalog) plus[s.key] = plus[s.key]! + _nonNegative((entry['items'] as Map?)?[s.key]);
      for (final s in woodCatalog) moreWood[s.key] = _addWood(moreWood[s.key]!, Map<String, int>.from((entry['wood'] as Map?)?[s.key] is Map ? ((entry['wood'] as Map)[s.key] as Map).map((k,v)=>MapEntry('$k',_int(v))) : {}));
    }
  }
  final q = {for (final s in materialCatalog) s.key: (quantities[s.key]! + plus[s.key]! - minus[s.key]!).clamp(0, 0x7fffffff)};
  final w = {for (final s in woodCatalog) s.key: _subtractWood(_addWood(baseWood[s.key]!, moreWood[s.key]!), lessWood[s.key]!)};
  return {'qty': q, 'wood': w};
}

Map<String, dynamic> hydrateRentalBill(Map<String, dynamic> raw, {required DateTime today}) {
  final bill = Map<String, dynamic>.from(raw);
  final start = parseBillingDate(bill['start_date']);
  final days = _int(bill['cycle_days'], 30).clamp(1, 3650);
  final payments = (bill['payments'] as List? ?? const []).cast<Map>();
  final totalPaid = moneyRound(payments.fold<double>(0, (v,p)=>v+_num(p['amount'])));
  final returns = (bill['return_history'] as List? ?? const []).cast<Map>();
  final additions = (bill['additional_history'] as List? ?? const []).cast<Map>();
  final balanceQty = billQuantities(bill), balanceWood = parseBillWood(bill);
  for (final h in additions) {
    final items = h['items'] as Map? ?? {};
    for (final s in materialCatalog) balanceQty[s.key] = balanceQty[s.key]! + _nonNegative(items[s.key]);
    final wood = h['wood'] as Map? ?? {};
    for (final s in woodCatalog) {
      final rawMap = wood[s.key] as Map? ?? {};
      balanceWood[s.key] = _addWood(balanceWood[s.key]!, rawMap.map((k,v)=>MapEntry('$k',_int(v))));
    }
  }
  for (final h in returns) {
    final items = h['items'] as Map? ?? {};
    for (final s in materialCatalog) balanceQty[s.key] = (balanceQty[s.key]! - _nonNegative(items[s.key])).clamp(0, 0x7fffffff);
    final wood = h['wood'] as Map? ?? {};
    for (final s in woodCatalog) {
      final rawMap = wood[s.key] as Map? ?? {};
      balanceWood[s.key] = _subtractWood(balanceWood[s.key]!, rawMap.map((k,v)=>MapEntry('$k',_int(v))));
    }
  }
  final cycles = <Map<String, dynamic>>[];
  if (start != null) {
    var endOn = today;
    if (bill['status'] == 'closed') endOn = parseBillingDate(bill['closed_at']) ?? today;
    var cursor = start, index = 1;
    while (!cursor.isAfter(endOn) && index < 500) {
      final end = cursor.add(Duration(days: days - 1));
      final snap = snapshotForCycle(bill, index);
      final rent = calculateRent(Map<String,int>.from(snap['qty']), Map<String,Map<String,int>>.from(snap['wood']), bill).rentTotal;
      final transport = index == 1 ? transportTotal(bill) : 0.0;
      cycles.add({'index':index,'start_date':dateKey(cursor),'end_date':dateKey(end),'rent':rent,'transport':transport,'total':moneyRound(rent+transport),'snapshot_qty':snap['qty'],'snapshot_wood':snap['wood']});
      cursor = end.add(const Duration(days:1)); index++;
    }
  }
  final due = moneyRound(cycles.fold<double>(0,(v,c)=>v+_num(c['total'])));
  return {...bill,'payments':payments,'payment_audit':bill['payment_audit']??[],'return_history':returns,'additional_history':additions,'cycles':cycles,'balance_qty':balanceQty,'balance_wood':balanceWood,'total_due':due,'total_paid':totalPaid,'advance_locked':moneyRound(_num(bill['advance_amount'])),'rent_paid':totalPaid,'pending':moneyRound((due-totalPaid).clamp(0, double.infinity)),'current_cycle_index':cycles.isEmpty?0:cycles.last['index']};
}

Map<String, List<Map<String, dynamic>>> reminderCategories(List<Map<String, dynamic>> rows, DateTime date) {
  final result = {'pending': <Map<String,dynamic>>[], 'today': <Map<String,dynamic>>[], 'upcoming': <Map<String,dynamic>>[]};
  final todayKey = dateKey(date), limit = dateKey(date.add(const Duration(days:7)));
  for (final row in rows) {
    final cycles = (row['cycles'] as List? ?? const []).cast<Map>();
    final started = cycles.where((c)=>'${c['start']??c['start_date']}'<=todayKey).toList();
    final future = cycles.where((c)=>'${c['start']??c['start_date']}'>todayKey).toList();
    final current = started.isEmpty ? null : started.last;
    final total = row['isCustom']==true ? _num(row['total']) : moneyRound(started.fold<double>(0,(v,c)=>v+_num(c['total'])));
    final paid = _num(row['paid']);
    final balance = (total-paid).clamp(0,double.infinity);
    final base = Map<String,dynamic>.from(row);
    if (balance>0) result['pending']!.add({...base,'balance':moneyRound(balance),'date':current?['start']??current?['start_date']??row['start'],'category':'pending'});
    final due = cycles.where((c)=>'${c['start']??c['start_date']}'==todayKey).firstOrNull;
    if (due!=null && balance>0) result['today']!.add({...base,'balance':moneyRound(balance),'date':todayKey,'category':'today'});
    for(final next in future){
      final nextDate='${next['start']??next['start_date']}';
      if(nextDate.compareTo(limit)>0 || _num(next['total'])<=0) continue;
      final through = cycles.where((c)=>'${c['start']??c['start_date']}'.compareTo(nextDate)<=0).fold<double>(0,(v,c)=>v+_num(c['total']));
      if(through>paid){result['upcoming']!.add({...base,'balance':moneyRound(_num(next['total'])),'date':nextDate,'category':'upcoming'});break;}
    }
  }
  return result;
}

double customBillTotal(Map<String,dynamic> bill) {
  final rent=calculateRent(billQuantities(bill),parseBillWood(bill),bill).rentTotal;
  final up=_nonNegative(bill['transport_up_trips'])*_num(bill['transport_up_charge']);
  final down=_nonNegative(bill['transport_down_trips'])*_num(bill['transport_down_charge']);
  return moneyRound(rent+up+down+_num(bill['loading_charge'])+_num(bill['unloading_charge'])+rent);
}
