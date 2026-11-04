import 'package:flutter_test/flutter_test.dart';
import '../lib/features/billing/domain/billing_calculator.dart';

// Reference expectations are transcribed from app.js calcRent/transport/
// hydrateBill/snapshotForCycle rather than recalculated by the Dart code.
void main(){
  group('JavaScript billing-engine parity fixtures',(){
    final bill=<String,dynamic>{'bill_no':'101','name':'Kumar','mobile':'9876543210','place':'Site A','start_date':'2026-11-03','cycle_days':30,'jackey_qty':2,'jackey_rate':65,'sheet_qty':3,'sheet_rate':35,'wood_12':'8×5+10×2','wood_12_rate':18,'runner':'6×2','runner_rate':7,'transport_up_trips':2,'transport_up_charge':50,'transport_down_trips':1,'transport_down_charge':60,'loading_charge':10,'unloading_charge':20,'advance_amount':1000,'status':'open','payments':[{'payment_id':'p1','amount':500,'payment_date':'2026-11-10'}],'return_history':<Map<String,dynamic>>[],'additional_history':<Map<String,dynamic>>[]};
    test('material, wood and first-cycle transport totals match app.js',(){
      final rent=calculateRent(billQuantities(bill),parseBillWood(bill),bill);
      expect(rent.materialTotal,235.00);
      expect(rent.woodTotal,1164.00);
      expect(rent.rentTotal,1399.00);
      expect(transportTotal(bill),190.00);
    });
    test('cycle totals, first-cycle transport and pending balance match app.js',(){
      final result=hydrateRentalBill(bill,today:DateTime.utc(2026,12,5));
      expect(result['current_cycle_index'],2);
      expect(result['cycles'].length,2);
      expect(result['cycles'][0]['total'],1589.00);
      expect(result['cycles'][1]['total'],1399.00);
      expect(result['total_due'],2988.00);
      expect(result['total_paid'],500.00);
      expect(result['pending'],2488.00);
      expect(result['advance_locked'],1000.00);
    });
    test('return becomes effective only from the next indexed cycle',(){
      final withReturn=<String,dynamic>{...bill,'return_history':[{'rid':'r1','date':'2026-12-02','effective_from_cycle':2,'items':{'jackey':1},'wood':{'wood_12':{'8':1}}}]};
      final first=snapshotForCycle(withReturn,1),second=snapshotForCycle(withReturn,2);
      expect((first['qty'] as Map)['jackey'],2);
      expect((second['qty'] as Map)['jackey'],1);
      expect((first['wood'] as Map)['wood_12'],{'8':5,'10':2});
      expect((second['wood'] as Map)['wood_12'],{'8':4,'10':2});
      final result=hydrateRentalBill(withReturn,today:DateTime.utc(2026,12,5));
      expect(result['cycles'][0]['rent'],1399.00);
      expect(result['cycles'][1]['rent'],1190.00);
      expect(result['total_due'],2779.00);
    });
    test('wood sizes, fractional feet and piece truncation use legacy rules',(){
      expect(parseWoodSizes('8x2.9 + 4.5×3'),{'8':2,'4.5':3});
      expect(woodToText({'10':2,'8':4}), '8×4+10×2');
    });
    test('date and cycle boundary match legacy 1-based cycle indexing',(){
      final start=parseBillingDate('2026-11-03')!;
      expect(cycleIndex(start,30,DateTime.utc(2026,11,3)),1);
      expect(cycleIndex(start,30,DateTime.utc(2026,12,2)),1);
      expect(cycleIndex(start,30,DateTime.utc(2026,12,3)),2);
    });
    test('overdue, due-today and upcoming reminder categories use cycle start dates',(){
      final rows=[{'billNo':'A','name':'A','mobile':'1','paid':0,'start':'2026-11-03','cycles':[{'start':'2026-11-03','end':'2026-12-02','total':100},{'start':'2026-12-03','end':'2027-01-01','total':100}]}];
      final groups=reminderCategories(rows,DateTime.utc(2026,12,3));
      expect(groups['pending']!.single['balance'],200.00);
      expect(groups['today']!.single['date'],'2026-12-03');
      expect(groups['upcoming'],isEmpty);
    });
  });
}
