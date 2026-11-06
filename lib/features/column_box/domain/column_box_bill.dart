import 'package:intl/intl.dart';

double boxMoney(num value) => (value.toDouble() * 100).round() / 100;
String boxCurrency(num value) => NumberFormat.currency(
  locale: 'en_IN', symbol: '₹', decimalDigits: value % 1 == 0 ? 0 : 2,
).format(value);

class ColumnBoxItem {
  const ColumnBoxItem({required this.type, required this.qty,
    required this.ratePerDay, this.width = 0, this.depth = 0, this.height = 0,
    required this.amount});
  final String type;
  final double width, depth, height, ratePerDay, amount;
  final int qty;

  factory ColumnBoxItem.calculate({required String type, required int qty,
      required double ratePerDay, required int days,
      double width = 0, double depth = 0, double height = 0}) {
    if (!['centring', 'column_box'].contains(type) || qty < 0 ||
        ratePerDay < 0 || days < 1 || width < 0 || depth < 0 || height < 0) {
      throw const FormatException('Invalid Column Box item.');
    }
    if (type == 'column_box' && qty > 0 &&
        (width <= 0 || depth <= 0 || height <= 0)) {
      throw const FormatException('Enter width, depth and height for each column size.');
    }
    return ColumnBoxItem(type: type, qty: qty, ratePerDay: ratePerDay,
      width: width, depth: depth, height: height,
      amount: boxMoney(qty * ratePerDay * days));
  }

  factory ColumnBoxItem.fromMap(Map data) => ColumnBoxItem(
    type: '${data['type']}', qty: (data['qty'] as num).toInt(),
    ratePerDay: (data['ratePerDay'] as num).toDouble(),
    width: (data['width'] as num? ?? 0).toDouble(),
    depth: (data['depth'] as num? ?? 0).toDouble(),
    height: (data['height'] as num? ?? 0).toDouble(),
    amount: (data['amount'] as num).toDouble());

  Map<String, dynamic> toMap() => {'type':type,'width':width,'depth':depth,
    'height':height,'qty':qty,'ratePerDay':ratePerDay,'amount':amount};
  String get name => type == 'centring' ? 'Centring' : 'Column box';
  String get size => type == 'centring' ? '' :
    '${boxDimension(width)}" × ${boxDimension(depth)}" × ${boxDimension(height)} ft';
}

String boxDimension(double v) => v % 1 == 0 ? v.toInt().toString() : '$v';

class ColumnBoxBill {
  const ColumnBoxBill({required this.id, required this.invoiceNo,
    required this.createdAt, required this.customerName,required this.phone,
    required this.place,required this.days,required this.transport,
    required this.labourUp,required this.labourDown,
    required this.advancePaid,required this.amountPaid,
    required this.items,required this.itemsTotal,required this.grandTotal,
    required this.balanceDue,required this.status});
  final String id,invoiceNo,createdAt,customerName,phone,place,status;
  final int days;
  final double transport,labourUp,labourDown,advancePaid,amountPaid;
  final List<ColumnBoxItem> items;
  final double itemsTotal,grandTotal,balanceDue;

  factory ColumnBoxBill.create({required String id,required String invoiceNo,
      required String createdAt,required String customerName,
      required String phone,required String place,required int days,
      required double transport,required double labourUp,
      required double labourDown,required double advancePaid,
      double amountPaid = 0,required List<ColumnBoxItem> items}) {
    if (customerName.trim().isEmpty || days < 1 ||
        [transport,labourUp,labourDown,advancePaid,amountPaid].any((v) => v < 0) ||
        !items.any((item) => item.qty > 0)) {
      throw const FormatException('Enter a customer and at least one rented item; amounts cannot be negative.');
    }
    final itemTotal = boxMoney(items.fold<double>(0, (sum,item) => sum + item.amount));
    final grand = boxMoney(itemTotal + transport + labourUp + labourDown);
    if (advancePaid + amountPaid > grand + .001) {
      throw const FormatException('Payments cannot exceed the bill total.');
    }
    final due = boxMoney((grand - advancePaid - amountPaid).clamp(0, double.infinity));
    return ColumnBoxBill(id:id,invoiceNo:invoiceNo,createdAt:createdAt,
      customerName:customerName.trim(),phone:phone.trim(),place:place.trim(),
      days:days,transport:transport,labourUp:labourUp,labourDown:labourDown,
      advancePaid:advancePaid,amountPaid:amountPaid,items:items,
      itemsTotal:itemTotal,grandTotal:grand,balanceDue:due,
      status:due == 0 ? 'paid' : 'unpaid');
  }

  factory ColumnBoxBill.fromMap(Map<String,dynamic> map) => ColumnBoxBill(
    id:'${map['id']}',invoiceNo:'${map['invoiceNo']}',
    createdAt:'${map['createdAt']}',customerName:'${map['customerName']}',
    phone:'${map['phone'] ?? ''}',place:'${map['place'] ?? ''}',
    days:(map['days'] as num).toInt(),
    transport:(map['transport'] as num? ?? 0).toDouble(),
    labourUp:(map['labourUp'] as num? ?? 0).toDouble(),
    labourDown:(map['labourDown'] as num? ?? 0).toDouble(),
    advancePaid:(map['advancePaid'] as num? ?? 0).toDouble(),
    amountPaid:(map['amountPaid'] as num? ?? 0).toDouble(),
    items:(map['items'] as List).map((item) => ColumnBoxItem.fromMap(item as Map)).toList(),
    itemsTotal:(map['itemsTotal'] as num).toDouble(),
    grandTotal:(map['grandTotal'] as num).toDouble(),
    balanceDue:(map['balanceDue'] as num).toDouble(),status:'${map['status']}');

  Map<String,dynamic> toMap() => {'id':id,'invoiceNo':invoiceNo,
    'createdAt':createdAt,'customerName':customerName,'phone':phone,'place':place,
    'days':days,'transport':transport,'labourUp':labourUp,'labourDown':labourDown,
    'advancePaid':advancePaid,'amountPaid':amountPaid,
    'items':items.map((item) => item.toMap()).toList(),
    'itemsTotal':itemsTotal,'grandTotal':grandTotal,
    'balanceDue':balanceDue,'status':status};

  ColumnBoxBill markPaid() => ColumnBoxBill.create(id:id,invoiceNo:invoiceNo,
    createdAt:createdAt,customerName:customerName,phone:phone,place:place,
    days:days,transport:transport,labourUp:labourUp,labourDown:labourDown,
    advancePaid:advancePaid,amountPaid:boxMoney(amountPaid + balanceDue),items:items);
}
