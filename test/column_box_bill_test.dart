import 'package:flutter_test/flutter_test.dart';
import '../lib/features/column_box/domain/column_box_bill.dart';
import '../lib/features/column_box/presentation/column_box_invoice_screen.dart';

void main() {
  final items=[
    ColumnBoxItem.calculate(type:'centring',qty:10,ratePerDay:65,days:30),
    ColumnBoxItem.calculate(type:'column_box',width:9,depth:12,height:10,
      qty:4,ratePerDay:120,days:30),
    ColumnBoxItem.calculate(type:'column_box',width:12,depth:12,height:10,
      qty:2,ratePerDay:150,days:30),
  ];
  final bill=ColumnBoxBill.create(id:'CB-0001',invoiceNo:'CB-0001',
    createdAt:'2026-11-06T00:00:00Z',customerName:'Max Homes',
    phone:'9600463988',place:'Seruseri',days:30,items:items,
    transport:1000,labourUp:300,labourDown:200,advancePaid:5000);

  test('three independently priced sizes yield exact daily totals',() {
    expect(items.map((i)=>i.amount),[19500,14400,9000]);
    expect(items[1].size,'9" × 12" × 10 ft');
    expect(bill.itemsTotal,42900);
    expect(bill.grandTotal,44400);
    expect(bill.balanceDue,39400);
    expect(bill.status,'unpaid');
    expect(boxCurrency(125000),'₹1,25,000');
  });
  test('paid state preserves advance and records the remaining payment',() {
    final paid=bill.markPaid();
    expect(paid.advancePaid,5000);
    expect(paid.amountPaid,39400);
    expect(paid.balanceDue,0);
    expect(paid.status,'paid');
    expect(ColumnBoxBill.fromMap(paid.toMap()).toMap(),paid.toMap());
  });
  test('requires positive dimensions only for a rented column box',() {
    expect(()=>ColumnBoxItem.calculate(type:'column_box',qty:1,
      ratePerDay:100,days:1),throwsFormatException);
    expect(()=>ColumnBoxBill.create(id:'x',invoiceNo:'x',createdAt:'now',
      customerName:' ',phone:'',place:'',days:1,transport:0,
      labourUp:0,labourDown:0,advancePaid:0,items:items),throwsFormatException);
  });
  test('PDF is generated for a Column Box invoice',() async {
    final bytes=await buildColumnBoxPdf(bill);
    expect(bytes.length,greaterThan(1000));
    expect(String.fromCharCodes(bytes.take(5)),'%PDF-');
  });
}
