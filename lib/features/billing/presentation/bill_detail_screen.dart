import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../domain/billing_calculator.dart';
import '../../invoice/presentation/invoice_screen.dart';
import 'bill_entry_sheets.dart';
import 'bill_form_screen.dart';
import '../domain/history_corrections.dart';
import '../domain/grouped_returns.dart';
import '../domain/return_service.dart';
import '../../inventory/domain/material_holdings.dart';
import '../../inventory/presentation/customer_material_statement_screen.dart';

final billDetailProvider = FutureProvider.autoDispose.family<Map<String,dynamic>?, String>((ref, id) => ref.watch(billingRepositoryProvider).get('bills', id));

class BillDetailScreen extends ConsumerStatefulWidget {
  const BillDetailScreen({super.key, required this.billNo});
  final String billNo;
  @override ConsumerState<BillDetailScreen> createState() => _BillDetailScreenState();
}
class _BillDetailScreenState extends ConsumerState<BillDetailScreen> {
  String _money(num value)=>NumberFormat.currency(locale:'en_IN',symbol:'₹',decimalDigits:value%1==0?0:2).format(value);
  String get billNo => widget.billNo;
  int tab = 0, activity = 0;
  static const navy = Color(0xff061d3b), emerald = Color(0xff009f65);
  @override
  Widget build(BuildContext context) {
    final rows = ref.watch(billsProvider).asData?.value;
    final cached = rows?.where((item) => '${item['bill_no']}' == billNo).firstOrNull;
    final fetched = ref.watch(billDetailProvider(billNo));
    final raw = cached ?? fetched.asData?.value;
    if (raw == null) return Scaffold(
      appBar: AppBar(title: Text('Bill #$billNo')),
      body: Center(child: fetched.isLoading ? const CircularProgressIndicator() :
        Column(mainAxisSize: MainAxisSize.min, children: [
          Text(fetched.hasError ? 'Could not load bill' : 'Bill not found'),
          TextButton(onPressed: () => ref.invalidate(billDetailProvider(billNo)),
            child: const Text('Retry')),
        ])));
    final now = DateTime.now().toUtc();
    final b = hydrateRentalBill(raw, today: DateTime.utc(now.year, now.month, now.day));
    final cycles = (b['cycles'] as List).cast<Map>();
    final payments = (b['payments'] as List).cast<Map>();
    final returns = (b['return_history'] as List).cast<Map>().reversed.toList();
    final additions = (b['additional_history'] as List).cast<Map>().reversed.toList();
    final active = cycles.lastOrNull;
    final customerBills = materialHoldings([
      ...ref.watch(hydratedBillsProvider),
      if (rows == null || !rows.any((item) => '${item['bill_no']}' == billNo)) b,
    ]).where((row) => sameRentalCustomer(row.bill, b)).toList();
    final p = AppPalette.of(context);
    return Scaffold(
      appBar: AppBar(title: Text('Bill #$billNo'), actions: [
        IconButton(tooltip: 'View invoice', onPressed: () => _invoice(context,b),
          icon: const Icon(Icons.description_outlined)),
      ]),
      body: Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 720),
        child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 28), children: [
          Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
            decoration: BoxDecoration(color: p.subtle, borderRadius: BorderRadius.circular(16)),
            child: Text('${b['status']=='closed'?'● CLOSED':'● OPEN'}  ·  Cycle ${b['current_cycle_index']??0}',
              style: TextStyle(color:p.accent,fontWeight:FontWeight.w800))),
          const SizedBox(height: 14),
          Container(padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(color: AppColors.teal,
              borderRadius: BorderRadius.circular(AppRadius.hero)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Amount due',style:TextStyle(color:Colors.white70,fontSize:16)),
              const SizedBox(height:5),
              FittedBox(fit:BoxFit.scaleDown,child:Text(_money(b['pending'] as num),
                style:const TextStyle(color:Colors.white,fontSize:42,fontWeight:FontWeight.w900))),
              const SizedBox(height:10),
              Text('Total ${_money(b['total_due'] as num)}  ·  Paid ${_money(b['total_paid'] as num)}',
                style:const TextStyle(color:Colors.white,fontWeight:FontWeight.w700)),
              if ((b['advance_locked'] as num? ?? 0)>0) Padding(
                padding:const EdgeInsets.only(top:7),
                child:Text('Advance deposit ${_money(b['advance_locked'] as num)}',
                  style:const TextStyle(color:Colors.white70))),
            ])),
          const SizedBox(height:14),
          _designCard('Customer details',Icons.person_outline,[
            _pair('Name','${b['name']??'—'}'),
            _pair('Mobile','${b['mobile']??'—'}'),
            _pair('Place','${b['place']??'—'}'),
            Divider(color:p.border,height:24),
            Wrap(spacing:24,runSpacing:8,children:[
              Text('Start  ${displayDate(b['start_date'])}',style:const TextStyle(fontWeight:FontWeight.w700)),
              Text('Cycle  ${b['cycle_days']??30} days',style:const TextStyle(fontWeight:FontWeight.w700)),
            ]),
          ]),
          const SizedBox(height:14),
          Wrap(spacing:8,runSpacing:8,children:[
            OutlinedButton.icon(onPressed:() async {
              final updated=await Navigator.push<bool>(context,MaterialPageRoute(
                builder:(_)=>BillFormScreen(initialBill:raw)));
              if (updated == true) ref.invalidate(billDetailProvider(billNo));
            },icon:const Icon(Icons.edit_outlined),label:const Text('Edit bill')),
            FilledButton.icon(onPressed:()=>_recordPayment(context,ref,b,cycles),
              icon:const Icon(Icons.payments_outlined),label:const Text('Record payment')),
            OutlinedButton.icon(onPressed:()=>_invoice(context,b),
              icon:const Icon(Icons.share_outlined),label:const Text('Invoice')),
            if (b['status'] != 'closed') OutlinedButton.icon(
              onPressed:()=>_invoice(context,b,cycles.length+1),
              icon:const Icon(Icons.calendar_today_outlined),
              label:const Text('Upcoming cycle bill')),
            if (b['status'] != 'closed') OutlinedButton.icon(
              onPressed:()=>_close(context,ref,b),
              icon:const Icon(Icons.lock_outline),label:const Text('Close bill')),
            TextButton.icon(onPressed:()=>_deleteBill(context,ref),
              icon:const Icon(Icons.delete_outline),label:const Text('Delete bill')),
          ]),
          const SizedBox(height:16),
          _designCard('Current cycle rent',Icons.layers_outlined,[
            Text(active == null ? 'No active cycle' :
              '${displayDate(active['start_date'])} – ${displayDate(active['end_date'])}  ·  Cycle ${active['index']}',
              style:Theme.of(context).textTheme.bodySmall),
            const SizedBox(height:12),
            if (active != null) ..._rentRows(b,active),
          ]),
          const SizedBox(height:14),
          _designCard('Customer material details',Icons.table_chart_outlined,[
            Text('Current material balance for each bill · ${customerBills.length} open bills',
              style:Theme.of(context).textTheme.bodySmall),
            const SizedBox(height:12),
            FilledButton.icon(onPressed:()=>Navigator.push(context,MaterialPageRoute(
              builder:(_)=>CustomerMaterialStatementScreen(customerBill:b))),
              icon:const Icon(Icons.open_in_new_outlined),
              label:const Text('View & share material statement')),
          ]),
          const SizedBox(height:14),
          _designCard('Rental cycles',Icons.calendar_month_outlined,[
            if (cycles.isEmpty) const Text('No rental cycles yet')
            else ...cycles.map((cycle)=>_cycle(cycle,payments,b)),
          ]),
          const SizedBox(height:14),
          _designCard('Payment history',Icons.account_balance_wallet_outlined,[
            if (payments.isEmpty) const Text('No payments recorded')
            else ...payments.asMap().entries.toList().reversed.map((item) {
              final payment=item.value;
              return ListTile(contentPadding:EdgeInsets.zero,
                title:Text(_money(payment['amount'] as num? ?? 0),
                  style:TextStyle(color:p.positive,fontWeight:FontWeight.w800)),
                subtitle:Text('${displayDate(payment['payment_date']??payment['date'])} · ${payment['method']??'Cash'}'),
                trailing:Row(mainAxisSize:MainAxisSize.min,children:[
                  IconButton(tooltip:'Edit payment',onPressed:()=>_editPayment(context,ref,payment,item.key),
                    icon:const Icon(Icons.edit_outlined)),
                  IconButton(tooltip:'Delete payment',onPressed:()=>_deletePayment(context,ref,payment,item.key),
                    icon:Icon(Icons.delete_outline,color:p.danger)),
                ]));
            }),
          ]),
          const SizedBox(height:14),
          _designCard('Return history',Icons.keyboard_return_outlined,[
            Align(alignment:Alignment.centerRight,child:OutlinedButton.icon(
              onPressed:()=>_materialChange(context,ref,b,isReturn:true),
              icon:const Icon(Icons.keyboard_return),label:const Text('Record return'))),
            const SizedBox(height:8),
            if (returns.isEmpty) const Text('No returns recorded')
            else ...returns.asMap().entries.map((item)=>_historyCard(context,ref,item.value,
              isReturn:true,originalIndex:returns.length-1-item.key)),
          ]),
          const SizedBox(height:14),
          _designCard('Additional material',Icons.inventory_2_outlined,[
            Align(alignment:Alignment.centerRight,child:FilledButton.icon(
              onPressed:()=>_materialChange(context,ref,b,isReturn:false),
              icon:const Icon(Icons.add),label:const Text('Add material'))),
            const SizedBox(height:8),
            if (additions.isEmpty) const Text('No additional materials')
            else ...additions.asMap().entries.map((item)=>_historyCard(context,ref,item.value,
              isReturn:false,originalIndex:additions.length-1-item.key)),
          ]),
        ]))));
  }

  Widget _designCard(String title, IconData icon, List<Widget> children) {
    final p=AppPalette.of(context);
    return Card(child:Padding(padding:const EdgeInsets.all(18),
      child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
        Row(children:[Container(padding:const EdgeInsets.all(9),
          decoration:BoxDecoration(color:p.subtle,borderRadius:BorderRadius.circular(12)),
          child:Icon(icon,color:p.accent)),const SizedBox(width:12),
          Expanded(child:Text(title,style:Theme.of(context).textTheme.titleLarge))]),
        const SizedBox(height:14),...children,
      ])));
  }
  Widget _pair(String label,String value)=>Padding(padding:const EdgeInsets.symmetric(vertical:3),
    child:Row(children:[SizedBox(width:76,child:Text(label,
      style:TextStyle(color:AppPalette.of(context).muted))),
      Expanded(child:Text(value,style:const TextStyle(fontWeight:FontWeight.w700)))]));

  List<Widget> _rentRows(Map<String,dynamic> bill, Map cycle) {
    final woods=Map<String,Map<String,int>>.from((cycle['snapshot_wood'] as Map).map(
      (key,value)=>MapEntry('$key',Map<String,int>.from(value as Map))));
    final rent=calculateRent(Map<String,int>.from(cycle['snapshot_qty'] as Map),woods,bill);
    final lines=rent.materialLines.where((line)=>(line['qty'] as num)>0).toList();
    return [
      Container(padding:const EdgeInsets.symmetric(horizontal:10,vertical:9),
        decoration:BoxDecoration(color:AppPalette.of(context).subtle,
          borderRadius:BorderRadius.circular(9)),
        child:const Row(children:[Expanded(flex:3,child:Text('MATERIAL')),
          Expanded(child:Text('QTY')),Text('AMOUNT')])),
      ...lines.map((line)=>Padding(padding:const EdgeInsets.symmetric(horizontal:10,vertical:9),
        child:Row(children:[Expanded(flex:3,child:Text('${line['label']}',
          style:const TextStyle(fontWeight:FontWeight.w600))),
          Expanded(child:Text('${line['qty']}')),
          Text(_money(line['amount'] as num))]))),
      if (lines.isEmpty && !woods.values.any((sizes)=>sizes.values.any((count)=>count>0)))
        const Padding(padding:EdgeInsets.all(12),child:Text('No materials in this cycle')),
      Divider(color:AppPalette.of(context).border),
      _totalLine('Materials total',rent.materialTotal),
      if (woods.values.any((sizes)=>sizes.values.any((count)=>count>0))) ...[
        const SizedBox(height:16),
        Text('WOOD MATERIALS',style:TextStyle(fontSize:12,fontWeight:FontWeight.w800,
          color:AppPalette.of(context).muted)),
        const SizedBox(height:8),
        _woodTable(woods,rent),
        const SizedBox(height:10),
        _totalLine('Wood total',rent.woodTotal),
      ],
      if ((cycle['transport'] as num? ?? 0)>0) _totalLine('Transport & handling',cycle['transport'] as num),
      Container(margin:const EdgeInsets.only(top:10),padding:const EdgeInsets.all(12),
        decoration:BoxDecoration(color:AppPalette.of(context).subtle,
          borderRadius:BorderRadius.circular(12)),
        child:_totalLine('Cycle rent',cycle['total'] as num,bold:true)),
    ];
  }
  Widget _woodTable(Map<String,Map<String,int>> woods,RentBreakdown rent) {
    final p=AppPalette.of(context);
    final columns=woodCatalog.map((spec) {
      final entries=(woods[spec.key]??const <String,int>{}).entries
        .where((entry)=>entry.value>0).toList()
        ..sort((a,b)=>(double.tryParse(a.key)??0).compareTo(double.tryParse(b.key)??0));
      final line=rent.woodLines.firstWhere((row)=>row['key']==spec.key);
      return (label:spec.label,entries:entries,feet:line['total_feet'] as num,
        amount:line['amount'] as num);
    }).toList();
    final count=columns.map((column)=>column.entries.length).fold<int>(0,(a,b)=>a>b?a:b);
    Widget cell(String value,{bool bold=false,Color? color})=>Padding(
      padding:const EdgeInsets.symmetric(horizontal:2,vertical:7),
      child:FittedBox(fit:BoxFit.scaleDown,child:Text(value,textAlign:TextAlign.center,
        style:TextStyle(fontSize:11,fontWeight:bold?FontWeight.w800:FontWeight.w500,
          color:color??p.ink))));
    Widget row(List<Widget> cells,{Color? background})=>Container(
      color:background,child:Row(children:[for(final item in cells) Expanded(child:item)]));
    return ClipRRect(borderRadius:BorderRadius.circular(10),child:Container(
      decoration:BoxDecoration(border:Border.all(color:p.border)),
      child:Column(children:[
        row([for(final column in columns) cell(column.label.toUpperCase(),bold:true)],
          background:p.subtle),
        for(var i=0;i<count;i++) row([for(final column in columns)
          cell(i<column.entries.length
            ? '${column.entries[i].key}×${column.entries[i].value}' : '')]),
        row([for(final column in columns) Column(children:[
          cell('${column.feet} ft',bold:true),
          cell(_money(column.amount),bold:true),
        ])],background:p.subtle),
      ])));
  }
  Widget _totalLine(String label,num amount,{bool bold=false})=>Row(children:[
    Expanded(child:Text(label,style:TextStyle(fontWeight:bold?FontWeight.w800:FontWeight.w600))),
    Text(_money(amount),style:TextStyle(fontWeight:FontWeight.w900,
      color:bold?AppPalette.of(context).accent:AppPalette.of(context).ink)),
  ]);
  void _invoice(BuildContext context,Map<String,dynamic> b,[int? cycle])=>Navigator.push(context,MaterialPageRoute(builder:(_)=>InvoiceScreen(bill:b,initialCycle:cycle)));
  Widget _summary(String label,Object? amount)=>Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text(label,style:const TextStyle(color:Colors.white70)),FittedBox(child:Text(_money(amount is num ? amount : 0),style:const TextStyle(color:Colors.white,fontWeight:FontWeight.w900,fontSize:24)))]));
  Widget _tabs(List<String> labels,int selected,ValueChanged<int> change)=>Container(padding:const EdgeInsets.all(4),decoration:BoxDecoration(color:AppPalette.of(context).subtle,borderRadius:BorderRadius.circular(14)),child:Row(children:List.generate(labels.length,(i)=>Expanded(child:TextButton(style:TextButton.styleFrom(backgroundColor:i==selected?navy:Colors.transparent,foregroundColor:i==selected?Colors.white:AppPalette.of(context).ink,padding:const EdgeInsets.symmetric(vertical:12,horizontal:3)),onPressed:()=>change(i),child:Text(labels[i],textAlign:TextAlign.center,style:const TextStyle(fontSize:12,fontWeight:FontWeight.w800)))))));
  Widget _panel(String title,IconData icon,List<Widget> children)=>Card(margin:EdgeInsets.zero,child:Padding(padding:const EdgeInsets.all(14),child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[Row(children:[Icon(icon,color:AppPalette.of(context).accent),const SizedBox(width:8),Expanded(child:Text(title,style:TextStyle(fontWeight:FontWeight.w900,fontSize:18,color:AppPalette.of(context).ink)))]),const SizedBox(height:14),...children])));
  Widget _materials(Map b){final qty=b['balance_qty'] as Map;final wood=b['balance_wood'] as Map;final items=<({String name,int count,String detail})>[...materialCatalog.map((s)=>(name:s.label,count:(qty[s.key] as num? ?? 0).toInt(),detail:'')),...woodCatalog.map((s){final m=Map<String,int>.from(wood[s.key] as Map);return (name:s.label,count:m.values.fold<int>(0,(a,v)=>a+v),detail:woodToText(m));})];items.sort((a,b)=>b.count.compareTo(a.count));final primary=items.where((x)=>x.count>0).toList();final rest=items.where((x)=>x.count==0).toList();return _panel('Materials out · ${items.fold<int>(0,(n,x)=>n+x.count)} units',Icons.construction_outlined,[Wrap(spacing:8,runSpacing:8,children:primary.map((x)=>Container(width:(MediaQuery.sizeOf(context).width-76)/3,padding:const EdgeInsets.all(12),decoration:BoxDecoration(color:AppPalette.of(context).subtle,borderRadius:BorderRadius.circular(14)),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Icon(x.name.toLowerCase().contains('sheet')?Icons.layers_outlined:x.name.toLowerCase().contains('span')?Icons.view_agenda_outlined:Icons.construction_outlined,color:AppPalette.of(context).accent),Text(x.name,style:const TextStyle(fontWeight:FontWeight.w800)),Text('${x.count}',style:const TextStyle(fontWeight:FontWeight.w900,fontSize:28)),if(x.detail.isNotEmpty)Text(x.detail)]))).toList()),ExpansionTile(tilePadding:EdgeInsets.zero,title:Text('Other materials · ${rest.length} items',style:const TextStyle(fontWeight:FontWeight.w700)),children:rest.map((x)=>_quantityRow(x.name,x.count)).toList())]);}
  Widget _cycle(Map c,List<Map> payments,Map<String,dynamic> bill){final paid=payments.where((p)=>p['cycle_index']==c['index']&&p['cycle_start_date']==c['start_date']&&p['cycle_end_date']==c['end_date']).fold<double>(0,(v,p)=>v+((p['amount'] as num?)?.toDouble()??0));final due=((c['total'] as num).toDouble()-paid).clamp(0,double.infinity);return Container(padding:const EdgeInsets.symmetric(vertical:12),decoration:BoxDecoration(border:Border(bottom:BorderSide(color:AppPalette.of(context).border))),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Row(children:[Expanded(child:Text('Cycle ${c['index']}',style:const TextStyle(fontWeight:FontWeight.w900))),TextButton.icon(onPressed:()=>_invoice(context,bill,(c['index'] as num).toInt()),icon:const Icon(Icons.receipt_long_outlined,size:17),label:const Text('Invoice'))]),Text('${displayDate(c['start_date'])} – ${displayDate(c['end_date'])}',style:const TextStyle(fontSize:12)),const SizedBox(height:8),Wrap(spacing:18,runSpacing:6,children:[Text('Charge ${_money(c['total'])}'),Text('Paid ${_money(paid)}'),Text('Due ${_money(due)}',style:TextStyle(fontWeight:FontWeight.w800,color:due>0?AppPalette.of(context).danger:AppPalette.of(context).positive))])]));}
  Widget _personCard(BuildContext c,Map<String,dynamic>b){
    final name='${b['name']??'Customer'}'.trim();final closed=b['status']=='closed';
    return Card(child:Padding(padding:const EdgeInsets.all(14),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Row(crossAxisAlignment:CrossAxisAlignment.start,children:[CircleAvatar(radius:24,backgroundColor:const Color(0xffcfe6f7),child:Text(name.isEmpty?'S':name[0].toUpperCase(),style:const TextStyle(color:navy,fontWeight:FontWeight.w900,fontSize:24))),const SizedBox(width:12),Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text(name,style:TextStyle(fontWeight:FontWeight.w900,fontSize:22,color:AppPalette.of(context).ink)),Text('${b['mobile']??'—'}',style:const TextStyle(fontWeight:FontWeight.w700)),Text('${b['place']??'—'}')])),const SizedBox(width:6),Container(padding:const EdgeInsets.symmetric(horizontal:10,vertical:7),decoration:BoxDecoration(color:closed?const Color(0xffe4eaf0):const Color(0xffbef2c4),borderRadius:BorderRadius.circular(12)),child:Text(closed?'CLOSED':'OPEN',style:TextStyle(color:closed?navy:const Color(0xff115c24),fontWeight:FontWeight.w900,fontSize:12)))]),const SizedBox(height:10),Text('Started ${displayDate(b['start_date'])} · ${b['cycle_days']??30}-day cycle',style:TextStyle(color:AppPalette.of(context).muted,fontSize:12))])));
  }
  Widget _quantityRow(String label,Object value)=>Padding(padding:const EdgeInsets.symmetric(vertical:7),child:Row(children:[Expanded(child:Text(label)),Text('$value',style:const TextStyle(fontWeight:FontWeight.w700))]));
  Widget _historyCard(BuildContext context,WidgetRef ref,Map entry,{required bool isReturn,required int originalIndex}){
    final items=(entry['items'] as Map?)??const {};
    final wood=(entry['wood'] as Map?)??const {};
    final parts=<String>[];
    for(final spec in materialCatalog){final quantity=(items[spec.key] as num?)?.toInt()??0;if(quantity>0)parts.add('${spec.label}: $quantity');}
    for(final spec in woodCatalog){final raw=wood[spec.key];if(raw is Map&&raw.isNotEmpty){final normalized=raw.map<String,int>((key,value)=>MapEntry('$key',(value as num).toInt()));parts.add('${spec.label}: ${woodToText(normalized)}');}}
    return Card(margin:const EdgeInsets.only(bottom:9),child:Padding(padding:const EdgeInsets.all(15),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Row(children:[Expanded(child:Text('${displayDate(entry['date'])} · Cycle #${entry['effective_from_cycle']??'—'}${entry['return_group_id']!=null?' · Linked return':''}',style:const TextStyle(fontWeight:FontWeight.w800))),IconButton(tooltip:isReturn?'Edit return':'Edit addition',
      onPressed:()=>_editHistory(context,ref,entry,originalIndex,isReturn),
      icon:const Icon(Icons.edit_outlined)),
      IconButton(tooltip:isReturn?'Delete return':'Delete addition',
      onPressed:()=>_deleteHistory(context,ref,entry,originalIndex,isReturn),
      icon:Icon(Icons.delete_outline,color:AppPalette.of(context).danger))]),Text(parts.isEmpty?'No material quantities':parts.join('  •  ')),if('${entry['note']??''}'.isNotEmpty)Padding(padding:const EdgeInsets.only(top:6),child:Text('Note: ${entry['note']}')),Text('Recorded by ${entry['created_by']??'—'}',style:Theme.of(context).textTheme.bodySmall?.copyWith(color:AppPalette.of(context).muted))])));
  }
  Future<void> _recordPayment(BuildContext context, WidgetRef ref, Map bill, List<Map> cycles) async {
    final entry = await showPaymentEntry(context, bill, cycles);
    if (entry == null) return;
    try {
      final repository = ref.read(billingRepositoryProvider);
      final raw = await repository.get('bills', '${bill['bill_no']}');
      if (raw == null) throw StateError('Bill no longer exists. Refresh and try again.');
      final now = DateTime.now().toUtc();
      final refreshed = hydrateRentalBill(raw, today: DateTime.utc(now.year, now.month, now.day));
      final freshCycles = (refreshed['cycles'] as List).cast<Map>();
      final freshCycle = freshCycles.where((c) =>
        c['index'] == entry.cycle['index'] &&
        c['start_date'] == entry.cycle['start_date'] &&
        c['end_date'] == entry.cycle['end_date']).firstOrNull;
      if (freshCycle == null) throw StateError('The rental cycle changed. Reopen the payment sheet.');
      if (entry.amount > (refreshed['pending'] as num).toDouble() + .001) {
        throw StateError('The payment exceeds the current pending balance.');
      }
      final payments = (raw['payments'] as List? ?? const [])
        .map((p) => Map<String, dynamic>.from(p as Map)).toList();
      final duplicate = payments.any((p) =>
        (p['amount'] as num?)?.toDouble() == moneyRound(entry.amount) &&
        (p['payment_date'] ?? p['date']) == entry.date);
      if (duplicate) {
        if (!context.mounted) return;
        final confirmed = await _confirm(context,
          'A payment of ${moneyLabel(entry.amount)} already exists for ${entry.date}. Save another?');
        if (!confirmed) return;
      }
      payments.add({
        'payment_id': 'pay-${DateTime.now().microsecondsSinceEpoch}',
        'amount': moneyRound(entry.amount),
        'payment_date': entry.date,
        'note': entry.note,
        'method': entry.method,
        'cycle_index': freshCycle['index'],
        'cycle_start_date': freshCycle['start_date'],
        'cycle_end_date': freshCycle['end_date'],
        'created_by': ref.read(authRepositoryProvider).currentUser?.email ?? 'unknown',
        'created_at': DateTime.now().toUtc().toIso8601String(),
      });
      await repository.put('bills', {...raw, 'payments': payments});
      ref.invalidate(billDetailProvider(billNo));
      if (context.mounted) _toast(context, 'Payment recorded');
    } catch (error) {
      if (context.mounted) _toast(context, 'Payment not saved: $error');
    }
  }

  Future<void> _materialChange(BuildContext context, WidgetRef ref, Map bill,
      {required bool isReturn}) async {
    final start = parseBillingDate(bill['start_date']);
    if (start == null) { _toast(context, 'Bill start date is missing'); return; }
    if (isReturn) {
      await _saveReturn(context, ref, bill);
      return;
    }
    final entry = await showMaterialEntry(context, bill, isReturn: isReturn);
    if (entry == null) return;
    try {
      final repository = ref.read(billingRepositoryProvider);
      final raw = await repository.get('bills', '${bill['bill_no']}');
      if (raw == null) throw StateError('Bill no longer exists. Refresh and try again.');
      final now = DateTime.now().toUtc();
      final latest = hydrateRentalBill(raw, today: DateTime.utc(now.year, now.month, now.day));
      if (isReturn) {
        final balances = latest['balance_qty'] as Map;
        for (final spec in materialCatalog) {
          if (entry.items[spec.key]! > (balances[spec.key] as num).toInt()) {
            throw StateError('Return exceeds outstanding ${spec.label}.');
          }
        }
        final currentWood = latest['balance_wood'] as Map;
        for (final spec in woodCatalog) {
          final available = currentWood[spec.key] as Map? ?? const {};
          for (final size in entry.wood[spec.key]!.entries) {
            if (size.value > ((available[size.key] as num?)?.toInt() ?? 0)) {
              throw StateError('Return exceeds outstanding ${spec.label} ${size.key} ft.');
            }
          }
        }
      }
      final days = (raw['cycle_days'] as num?)?.toInt() ?? 30;
      final effective = cycleIndex(start, days, parseBillingDate(entry.date)!) + 1;
      final field = isReturn ? 'return_history' : 'additional_history';
      final entries = (raw[field] as List? ?? const [])
        .map((item) => Map<String, dynamic>.from(item as Map)).toList();
      entries.add({
        isReturn ? 'rid' : 'aid': '${isReturn ? 'ret' : 'add'}-${DateTime.now().microsecondsSinceEpoch}',
        'date': entry.date,
        'note': entry.note,
        'effective_from_cycle': effective,
        'items': entry.items,
        'wood': entry.wood,
        'created_by': ref.read(authRepositoryProvider).currentUser?.email ?? 'unknown',
        'created_at': DateTime.now().toUtc().toIso8601String(),
      });
      await repository.put('bills', {...raw, field: entries});
      ref.invalidate(billDetailProvider(billNo));
      if (context.mounted) _toast(context, 'Saved; applies from cycle #$effective');
    } catch (error) {
      if (context.mounted) _toast(context, 'Material change not saved: $error');
    }
  }

  Future<List<ReturnAllocation>?> _confirmReturn(BuildContext context,
      List<ReturnAllocation> initial, Map<String, Map<String, dynamic>> bills,
      ReturnDraft draft) async {
    final chosen = Map<String, int>.from(draft.effectiveCycles);
    var split = initial;
    String? error;
    final date = DateTime.now().toUtc();
    return showDialog<List<ReturnAllocation>>(context: context, builder: (dialog) =>
      StatefulBuilder(builder: (dialog, refresh) {
        final preview = <Widget>[];
        for (final original in bills.values) {
          final id = '${original['bill_no']}';
          final allocation = split.where((a) => a.billNo == id).firstOrNull;
          final rows = withoutReturnGroup(original, groupId: draft.oldGroupId,
            id: id == draft.billNo ? draft.oldId : null);
          if (allocation == null && rows.length == historyRows(original['return_history']).length) continue;
          final before = hydrateRentalBill(original, today: date);
          final after = hydrateRentalBill({...original, 'return_history': [...rows,
            if (allocation != null) {
              'effective_from_cycle': allocation.effectiveCycle,
              'items': allocation.items, 'wood': allocation.wood,
            }]}, today: date);
          final parts = <String>[
            if (allocation != null) ...[
              for (final s in materialCatalog) if ((allocation.items[s.key] ?? 0) > 0)
                '${s.label} ${allocation.items[s.key]}',
              for (final s in woodCatalog) if (allocation.wood[s.key]!.isNotEmpty)
                '${s.label} ${woodToText(allocation.wood[s.key])}',
            ],
          ];
          final start = parseBillingDate(original['start_date']);
          final days = (original['cycle_days'] as num?)?.toInt() ?? 30;
          final maxCycle = start == null ? 1 : cycleIndex(start, days, parseBillingDate(draft.date)!) + 1;
          preview.add(Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Column(
            crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Bill #$id', style: const TextStyle(fontWeight: FontWeight.w800)),
              if (allocation != null) DropdownButtonFormField<int>(
                value: allocation.effectiveCycle, isExpanded: true,
                decoration: const InputDecoration(labelText: 'Charge stops from cycle'),
                items: [for (var i = 1; i <= maxCycle; i++) DropdownMenuItem(
                  value: i, child: Text('Cycle #$i · ${displayDate(start!.add(Duration(days: (i - 1) * days)))}'))],
                onChanged: (value) {
                  if (value == null) return;
                  final proposed = {...chosen, id: value};
                  try {
                    final candidate = ReturnDraft(billNo: draft.billNo, date: draft.date,
                      note: draft.note, items: draft.items, wood: draft.wood,
                      applyToCurrentCycle: draft.applyToCurrentCycle,
                      effectiveCycles: proposed, oldId: draft.oldId,
                      oldGroupId: draft.oldGroupId);
                    final updated = ReturnService(ref.read(billingRepositoryProvider))
                      .preview(candidate, bills.values.toList());
                    refresh(() { chosen..clear()..addAll(proposed); split = updated; error = null; });
                  } catch (e) {
                    refresh(() => error = '$e');
                  }
                }),
              Text(parts.isEmpty ? 'Return removed from this bill' : parts.join(' · ')),
              Text('Due ${_money(before['pending'] as num)} → ${_money(after['pending'] as num)}',
                style: TextStyle(color: AppPalette.of(context).accent)),
            ])));
        }
        return AlertDialog(title: const Text('Review material return'),
          content: SizedBox(width: 430, child: SingleChildScrollView(child: Column(
            mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start,
            children: [Text('Return date ${draft.date}. Choose the cycle for each bill:'),
              const SizedBox(height: 10), ...preview,
              if (error != null) Text(error!, style: TextStyle(color: AppPalette.of(dialog).danger))]))),
          actions: [TextButton(onPressed: () => Navigator.pop(dialog),
            child: const Text('Back')), FilledButton(onPressed: error == null ? () =>
              Navigator.pop(dialog, split) : null,
            child: const Text('Confirm return'))]);
      }));
  }

  Future<void> _saveReturn(BuildContext context, WidgetRef ref, Map bill,
      {Map? selected}) async {
    try {
      final service = ReturnService(ref.read(billingRepositoryProvider));
      final groupId = selected?['return_group_id'] as String?;
      final related = await service.customerBills(billNo);
      final linked = selected == null ? <Map<String, dynamic>>[] :
        await service.groupBills(billNo, groupId);
      final byId = <String, Map<String, dynamic>>{
        for (final b in [...related, ...linked]) '${b['bill_no']}': b,
      };
      if (selected != null && groupId == null && selected['rid'] == null) {
        throw StateError('This older return has no ID. Refresh and use the bill’s existing edit option.');
      }
      final oldRows = <Map<String, dynamic>>[];
      if (selected != null) {
        for (final b in byId.values) {
          oldRows.addAll(historyRows(b['return_history']).where((row) =>
            belongsToReturnGroup(row, groupId: groupId,
              id: '${b['bill_no']}' == billNo ? '${selected['rid']}' : null)));
        }
      }
      final initial = selected == null ? null : <String, dynamic>{
        ...selected,
        'items': {for (final s in materialCatalog) s.key: oldRows.fold<int>(0, (n, r) =>
          n + (((r['items'] as Map?)?[s.key] as num?)?.toInt() ?? 0))},
        'wood': {for (final s in woodCatalog) s.key: <String, int>{
          for (final r in oldRows)
            for (final e in ((r['wood'] as Map?)?[s.key] as Map? ?? const {}).entries)
              '${e.key}': oldRows.fold<int>(0, (n, row) => n +
                (((row['wood'] as Map?)?[s.key] as Map?)?['${e.key}'] as num? ?? 0).toInt()),
        }},
      };
      final now = DateTime.now().toUtc();
      final today = DateTime.utc(now.year, now.month, now.day);
      final usable = byId.values.map((b) => hydrateRentalBill({
        ...b, 'return_history': withoutReturnGroup(b, groupId: groupId,
          id: '${b['bill_no']}' == billNo ? (selected == null ? null : selected['rid'] as String?) : null),
      }, today: today)).toList();
      final primary = usable.firstWhere((b) => '${b['bill_no']}' == billNo);
      if (!context.mounted) return;
      final entry = await showMaterialEntry(context, primary, isReturn: true,
        initial: initial, otherBills: usable.where((b) =>
          '${b['bill_no']}' != billNo && b['status'] != 'closed' &&
          sameRentalCustomer(primary, b)).toList());
      if (entry == null) return;
      final draft = ReturnDraft(billNo: billNo, date: entry.date, note: entry.note,
        items: entry.items, wood: entry.wood,
        applyToCurrentCycle: entry.applyToCurrentCycle,
        effectiveCycles: {
          for (final b in byId.values)
            if (selected != null)
              for (final row in historyRows(b['return_history']))
                if (belongsToReturnGroup(row, groupId: groupId,
                  id: '${b['bill_no']}' == billNo ? selected['rid'] as String? : null))
                  if (parseBillingDate(b['start_date']) != null &&
                    (row['effective_from_cycle'] as num).toInt() <= cycleIndex(
                      parseBillingDate(b['start_date'])!,
                      (b['cycle_days'] as num?)?.toInt() ?? 30,
                      parseBillingDate(entry.date)!) + 1)
                    '${b['bill_no']}': (row['effective_from_cycle'] as num).toInt(),
          billNo: entry.effectiveCycle!,
        },
        oldId: selected == null ? null : selected['rid'] as String?, oldGroupId: groupId);
      final split = service.preview(draft, byId.values.toList());
      if (!context.mounted) return;
      final confirmed = await _confirmReturn(context, split, byId, draft);
      if (confirmed == null) return;
      final finalDraft = ReturnDraft(billNo: draft.billNo, date: draft.date,
        note: draft.note, items: draft.items, wood: draft.wood,
        applyToCurrentCycle: draft.applyToCurrentCycle,
        effectiveCycles: {for (final a in confirmed) a.billNo: a.effectiveCycle},
        oldId: draft.oldId, oldGroupId: draft.oldGroupId);
      await service.save(finalDraft, confirmed, byId.values.toList(),
        ref.read(authRepositoryProvider).currentUser?.email ?? 'unknown');
      ref.invalidate(billDetailProvider(billNo));
      if (context.mounted) _toast(context, 'Return saved across ${confirmed.length} bill(s)');
    } catch (error) {
      if (context.mounted) _toast(context, 'Return not saved: $error');
    }
  }
  Future<bool> _verifyDelete(BuildContext context, String title) async {
    final password = TextEditingController();
    try {
      return await showDialog<bool>(context: context, builder: (dialog) {
        bool busy = false;
        String? error;
        return StatefulBuilder(builder: (dialog, update) => AlertDialog(
          title: Text(title),
          content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('This removes one entry and recalculates the bill. Enter your Firebase account password to confirm.'),
              const SizedBox(height: 12),
              TextField(controller: password, obscureText: true, autofocus: true,
                decoration: const InputDecoration(labelText: 'Account password'),
                onSubmitted: (_) {}),
              if (error != null) Padding(padding: const EdgeInsets.only(top: 10),
                child: Text(error!, style: TextStyle(color: AppPalette.of(dialog).danger))),
            ]),
          actions: [
            TextButton(onPressed: busy ? null : () => Navigator.pop(dialog, false),
              child: const Text('Cancel')),
            FilledButton(onPressed: busy ? null : () async {
              if (password.text.isEmpty) {
                update(() => error = 'Enter your password.');
                return;
              }
              update(() { busy = true; error = null; });
              try {
                await ref.read(authRepositoryProvider).verifyPassword(password.text);
                if (dialog.mounted) Navigator.pop(dialog, true);
              } catch (_) {
                if (dialog.mounted) update(() {
                  busy = false;
                  error = 'Password verification failed. Check your account password.';
                });
              }
            }, child: const Text('Verify & delete')),
          ]));
      }) ?? false;
    } finally {
      password.dispose();
    }
  }

  Future<void> _deleteHistory(BuildContext context, WidgetRef ref, Map entry,
      int originalIndex, bool isReturn) async {
    if (!await _verifyDelete(context, isReturn ? 'Delete return?' : 'Delete addition?')) return;
    if (isReturn && entry['rid'] != null) {
      try {
        await ReturnService(ref.read(billingRepositoryProvider)).delete(billNo, entry,
          ref.read(authRepositoryProvider).currentUser?.email ?? 'unknown');
        ref.invalidate(billDetailProvider(billNo));
        if (context.mounted) _toast(context, 'Return deleted from all linked bills');
      } catch (error) {
        if (context.mounted) _toast(context, 'Could not delete return: $error');
      }
      return;
    }
    try {
      final repository = ref.read(billingRepositoryProvider);
      final raw = await repository.get('bills', billNo);
      if (raw == null) throw StateError('Bill not found.');
      final field = isReturn ? 'return_history' : 'additional_history';
      final rows = historyRows(raw[field]);
      final index = historyIndex(rows, entry, originalIndex, isReturn ? 'rid' : 'aid');
      final removed = rows.removeAt(index);
      final audit = historyRows(raw['history_audit'])..add({
        'action': 'deleted', 'type': field, 'entry': removed,
        'by': ref.read(authRepositoryProvider).currentUser?.email,
        'at': DateTime.now().toUtc().toIso8601String(),
      });
      final updated = {...raw, field: rows, 'history_audit': audit};
      validateMaterialLedger(updated);
      await repository.put('bills', updated);
      ref.invalidate(billDetailProvider(billNo));
      if (context.mounted) _toast(context, 'Entry deleted');
    } catch (error) {
      if (context.mounted) _toast(context, 'Could not delete entry: $error');
    }
  }

  Future<void> _editHistory(BuildContext context, WidgetRef ref, Map selected,
      int originalIndex, bool isReturn) async {
    if (isReturn && selected['rid'] != null) {
      await _saveReturn(context, ref, const {}, selected: selected);
      return;
    }
    try {
      final repository = ref.read(billingRepositoryProvider);
      final raw = await repository.get('bills', billNo);
      if (raw == null) throw StateError('Bill not found.');
      final field = isReturn ? 'return_history' : 'additional_history';
      final rows = historyRows(raw[field]);
      final index = historyIndex(rows, selected, originalIndex, isReturn ? 'rid' : 'aid');
      final previous = rows.removeAt(index);
      final now = DateTime.now().toUtc();
      final without = hydrateRentalBill({...raw, field: rows},
        today: DateTime.utc(now.year, now.month, now.day));
      if (!context.mounted) return;
      final entry = await showMaterialEntry(context, without,
        isReturn: isReturn, initial: previous);
      if (entry == null) return;
      final start = parseBillingDate(raw['start_date']);
      if (start == null) throw StateError('Bill start date is missing.');
      final fresh = await repository.get('bills', billNo);
      if (fresh == null) throw StateError('Bill no longer exists.');
      final latest = historyRows(fresh[field]);
      final position = historyIndex(latest, selected, originalIndex,
        isReturn ? 'rid' : 'aid');
      final old = latest[position];
      latest[position] = {...old, 'date': entry.date, 'note': entry.note,
        'items': entry.items, 'wood': entry.wood,
        'effective_from_cycle': isReturn ? entry.effectiveCycle! :
          cycleIndex(start, (fresh['cycle_days'] as num?)?.toInt() ?? 30,
            parseBillingDate(entry.date)!) + 1,
        'edited_by': ref.read(authRepositoryProvider).currentUser?.email,
        'edited_at': DateTime.now().toUtc().toIso8601String()};
      final audit = historyRows(fresh['history_audit'])..add({
        'action': 'edited', 'type': field, 'before': old, 'after': latest[position],
        'by': ref.read(authRepositoryProvider).currentUser?.email,
        'at': DateTime.now().toUtc().toIso8601String(),
      });
      final updated = {...fresh, field: latest, 'history_audit': audit};
      validateMaterialLedger(updated);
      await repository.put('bills', updated);
      ref.invalidate(billDetailProvider(billNo));
      if (context.mounted) _toast(context, 'Material entry updated');
    } catch (error) {
      if (context.mounted) _toast(context, 'Could not edit entry: $error');
    }
  }

  Future<void> _deletePayment(BuildContext context, WidgetRef ref,
      Map selected, int originalIndex) async {
    if (!await _verifyDelete(context, 'Delete payment?')) return;
    try {
      final repository = ref.read(billingRepositoryProvider);
      final raw = await repository.get('bills', billNo);
      if (raw == null) throw StateError('Bill not found.');
      final payments = historyRows(raw['payments']);
      final index = historyIndex(payments, selected, originalIndex, 'payment_id');
      final removed = payments.removeAt(index);
      final audit = historyRows(raw['payment_audit'])..add({
        'action': 'deleted', 'payment': removed,
        'deleted_by': ref.read(authRepositoryProvider).currentUser?.email,
        'deleted_at': DateTime.now().toUtc().toIso8601String(),
      });
      await repository.put('bills', {...raw, 'payments': payments, 'payment_audit': audit});
      ref.invalidate(billDetailProvider(billNo));
      if (context.mounted) _toast(context, 'Payment deleted');
    } catch (error) {
      if (context.mounted) _toast(context, 'Could not delete payment: $error');
    }
  }

  Future<void> _editPayment(BuildContext context, WidgetRef ref,
      Map selected, int originalIndex) async {
    try {
      final repository = ref.read(billingRepositoryProvider);
      final raw = await repository.get('bills', billNo);
      if (raw == null) throw StateError('Bill not found.');
      final payments = historyRows(raw['payments']);
      final index = historyIndex(payments, selected, originalIndex, 'payment_id');
      final previous = payments.removeAt(index);
      final now = DateTime.now().toUtc();
      final without = hydrateRentalBill({...raw, 'payments': payments},
        today: DateTime.utc(now.year, now.month, now.day));
      if (!context.mounted) return;
      final entry = await showPaymentEntry(context, without,
        (without['cycles'] as List).cast<Map>(), initial: previous);
      if (entry == null) return;
      final fresh = await repository.get('bills', billNo);
      if (fresh == null) throw StateError('Bill no longer exists.');
      final latest = historyRows(fresh['payments']);
      final position = historyIndex(latest, selected, originalIndex, 'payment_id');
      final old = latest.removeAt(position);
      final remaining = hydrateRentalBill({...fresh, 'payments': latest},
        today: DateTime.utc(now.year, now.month, now.day));
      if (entry.amount > (remaining['pending'] as num).toDouble() + .001) {
        throw StateError('Amount exceeds the updated pending balance.');
      }
      final cycle = (remaining['cycles'] as List).cast<Map>().where((item) =>
        item['index'] == entry.cycle['index'] &&
        item['start_date'] == entry.cycle['start_date'] &&
        item['end_date'] == entry.cycle['end_date']).firstOrNull;
      if (cycle == null) throw StateError('Rental cycle changed. Reopen and try again.');
      final edited = {...old, 'amount': moneyRound(entry.amount),
        'payment_date': entry.date, 'method': entry.method, 'note': entry.note,
        'cycle_index': cycle['index'], 'cycle_start_date': cycle['start_date'],
        'cycle_end_date': cycle['end_date'],
        'edited_by': ref.read(authRepositoryProvider).currentUser?.email,
        'edited_at': DateTime.now().toUtc().toIso8601String()};
      latest.insert(position, edited);
      final audit = historyRows(fresh['payment_audit'])..add({
        'action': 'edited', 'before': old, 'after': edited,
        'by': ref.read(authRepositoryProvider).currentUser?.email,
        'at': DateTime.now().toUtc().toIso8601String(),
      });
      await repository.put('bills', {...fresh, 'payments': latest, 'payment_audit': audit});
      ref.invalidate(billDetailProvider(billNo));
      if (context.mounted) _toast(context, 'Payment updated');
    } catch (error) {
      if (context.mounted) _toast(context, 'Could not edit payment: $error');
    }
  }
  Future<bool> _verifyBillAction(BuildContext context,String title,String detail) async {
    final password=TextEditingController();
    try {
      return await showDialog<bool>(context:context,builder:(dialog) {
        var busy=false;String? error;
        return StatefulBuilder(builder:(dialog,update)=>AlertDialog(
          title:Text(title),content:Column(mainAxisSize:MainAxisSize.min,
            crossAxisAlignment:CrossAxisAlignment.start,children:[
              Text(detail),const SizedBox(height:14),
              TextField(controller:password,obscureText:true,autofocus:true,
                decoration:const InputDecoration(labelText:'Firebase account password')),
              if(error!=null) Padding(padding:const EdgeInsets.only(top:10),
                child:Text(error!,style:TextStyle(color:AppPalette.of(dialog).danger))),
            ]),actions:[TextButton(onPressed:busy?null:()=>Navigator.pop(dialog,false),
              child:const Text('Cancel')),
              FilledButton(onPressed:busy?null:() async {
                if(password.text.isEmpty) {update(()=>error='Enter your password.');return;}
                update(() {busy=true;error=null;});
                try {
                  await ref.read(authRepositoryProvider).verifyPassword(password.text);
                  if(dialog.mounted) Navigator.pop(dialog,true);
                } catch(_) {if(dialog.mounted) update(() {
                  busy=false;error='Password verification failed.';
                });}
              },child:Text(title))]));
      }) ?? false;
    } finally {password.dispose();}
  }
  Future<void> _close(BuildContext context,WidgetRef ref,Map bill) async {
    if(!await _verifyBillAction(context,'Close bill',
      'Close bill #$billNo? Rental cycles stop from the closure date.')) return;
    try {
      final repo=ref.read(billingRepositoryProvider);
      final raw=await repo.get('bills',billNo);
      if(raw==null) throw StateError('Bill no longer exists.');
      final now=DateTime.now().toUtc();
      await repo.put('bills',{...raw,'status':'closed','closed_at':dateKey(now),
        'closed_by':ref.read(authRepositoryProvider).currentUser?.email,
        'closed_at_iso':now.toIso8601String()});
      ref.invalidate(billDetailProvider(billNo));
      if(context.mounted) _toast(context,'Bill closed');
    } catch(error) {if(context.mounted) _toast(context,'Could not close bill: $error');}
  }
  Future<void> _deleteBill(BuildContext context,WidgetRef ref) async {
    if(!await _verifyBillAction(context,'Delete bill',
      'Permanently delete bill #$billNo? This cannot be undone.')) return;
    try {await ref.read(billingRepositoryProvider).delete('bills',billNo);
      if(context.mounted) Navigator.pop(context);
    } catch(error) {if(context.mounted) _toast(context,'Could not delete bill: $error');}
  }
  Future<bool> _confirm(BuildContext context,String text) async =>
    await showDialog<bool>(context:context,builder:(dialog)=>AlertDialog(
      content:Text(text),actions:[
        TextButton(onPressed:()=>Navigator.pop(dialog,false),child:const Text('Cancel')),
        FilledButton(onPressed:()=>Navigator.pop(dialog,true),child:const Text('Confirm')),
      ])) ?? false;
  void _toast(BuildContext context,String text)=>ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(text)));
}
