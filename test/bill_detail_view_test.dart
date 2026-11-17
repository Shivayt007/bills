import 'package:flutter_test/flutter_test.dart';
import 'package:sa_traders_billing/features/billing/domain/bill_detail_view.dart';
import 'package:sa_traders_billing/features/billing/domain/billing_calculator.dart';

void main() {
  final today=DateTime.utc(2026,11,17);
  Map<String,dynamic> bill({List<Map<String,dynamic>> payments=const []}) =>
    hydrateRentalBill({
      'bill_no':'2502','name':'Max Homes','start_date':'2026-09-17',
      'cycle_days':30,'jackey_qty':100,'jackey_rate':65,
      'sheet_qty':5,'sheet_rate':35,
      'transport_up_trips':1,'transport_up_charge':500,
      'return_history':[{'date':'2026-11-17',
        'effective_from_cycle':3,'items':{'jackey':20}}],
      'payments':payments,
    },today:today);

  test('shows three period balances, partial status and unchanged bill totals', () {
    final hydrated=bill(payments:[
      {'amount':7000.0,'cycle_index':1,
        'cycle_start_date':'2026-09-17','cycle_end_date':'2026-10-16'},
      {'amount':175.0}, // Legacy payment fills the oldest cycle.
      {'amount':3000.0,'cycle_index':2,
        'cycle_start_date':'2026-10-17','cycle_end_date':'2026-11-15'},
    ]);
    final originalDue=hydrated['total_due'], originalPaid=hydrated['total_paid'];
    final overview=billCycleOverview(hydrated);
    expect(overview.cycles.map((view)=>view.status),
      ['Paid','Partly paid','Pending']);
    expect(overview.cycles.map((view)=>view.paid),[7175,3000,0]);
    expect(overview.pendingCycles.map((view)=>view.index),[2,3]);
    expect(overview.pendingCycles.map((view)=>view.pending),[3675,5375]);
    expect(hydrated['total_due'],19225);
    expect(hydrated['total_paid'],10175);
    expect(hydrated['pending'],9050);
    expect(hydrated['total_due'],originalDue);
    expect(hydrated['total_paid'],originalPaid);
    expect((hydrated['payments'] as List)[1]['cycle_index'],isNull);
  });

  test('does not mislabel unmatched cycle-tagged payments as paid', () {
    final hydrated=bill(payments:[
      {'amount':200.0,'cycle_index':9,
        'cycle_start_date':'2027-05-01','cycle_end_date':'2027-05-30'},
    ]);
    final overview=billCycleOverview(hydrated);
    expect(overview.unallocatedCredit,200);
    expect(overview.cycles.map((view)=>view.status),
      ['Pending','Pending','Pending']);
    expect(hydrated['pending'],19025);
  });

  test('return rent explanation excludes transport and leaves bill untouched', () {
    final hydrated=bill();
    final due=hydrated['total_due'];
    expect(materialEventRentChange(hydrated,isReturn:true,originalIndex:0),-1300);
    expect((hydrated['cycles'] as List)[0]['transport'],500);
    expect(hydrated['total_due'],due);
    expect((hydrated['return_history'] as List).length,1);
  });
}
