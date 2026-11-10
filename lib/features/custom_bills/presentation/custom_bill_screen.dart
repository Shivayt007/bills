import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/common.dart';
import '../../../core/theme/app_theme.dart';
import '../../billing/domain/billing_calculator.dart';
import '../../billing/domain/history_corrections.dart';

class CustomBillScreen extends ConsumerWidget{const CustomBillScreen({super.key,this.focusedBill,this.focusedData});final String? focusedBill;final Map<String,dynamic>? focusedData;@override Widget build(BuildContext context,WidgetRef ref){final async=ref.watch(customBillsProvider);final rows=(async.asData?.value??(focusedData==null?const <Map<String,dynamic>>[]:[focusedData!])).where((b)=>focusedBill==null||'${b['bill_no']}'==focusedBill).toList();return Scaffold(appBar:AppBar(title:const Text('Custom shop bills')),floatingActionButton:FloatingActionButton.extended(onPressed:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const CustomBillFormScreen())),icon:const Icon(Icons.add),label:const Text('New custom bill')),body:async.isLoading&&focusedData==null?const Center(child:CircularProgressIndicator()):rows.isEmpty?const EmptyState(title:'No custom bills',description:'Create a one-time shop bill for materials and charges.',icon:Icons.shopping_bag_outlined):ListView.separated(padding:const EdgeInsets.all(16),itemCount:rows.length,itemBuilder:(context,index){final b=rows[index];final total=customBillTotal(b);final paid=((b['payments'] as List? ?? []).fold<double>(0,(v,p)=>v+((p['amount'] as num?)?.toDouble()??0)));final pending=(total-paid).clamp(0,double.infinity);return Card(child:Padding(padding:const EdgeInsets.all(16),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Row(children:[Expanded(child:Text('${b['name']??'Customer'}',style:Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight:FontWeight.w800))),Chip(label:Text('CUSTOM #${b['bill_no']}'))]),Text('${b['mobile']??''} · ${b['place']??''}'),const SizedBox(height:14),Row(children:[_value(context,'Grand total',total),_value(context,'Paid',paid),_value(context,'Pending',pending,color:AppPalette.of(context).danger)]),const SizedBox(height:12),Wrap(spacing:8,children:[OutlinedButton.icon(onPressed:()=>_details(context,ref,b,total,paid),icon:const Icon(Icons.visibility_outlined),label:const Text('Details')),FilledButton.tonalIcon(onPressed:()=>_payment(context,ref,b),icon:const Icon(Icons.payments_outlined),label:const Text('Record payment'))])])));},separatorBuilder:(_,__)=>const SizedBox(height:10)));}}
Widget _value(BuildContext context,String label,num n,{Color? color})=>Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[Text(label,style:TextStyle(fontSize:11,color:AppPalette.of(context).muted)),Text(moneyLabel(n),style:TextStyle(fontWeight:FontWeight.w800,color:color))]));
void _details(BuildContext context, WidgetRef ref, Map<String,dynamic> b, double total, double paid) => showModalBottomSheet(
  context:context, isScrollControlled:true,
  builder:(ctx)=>SafeArea(child:FractionallySizedBox(heightFactor:.82,child:ListView(padding:const EdgeInsets.all(22),children:[
    Text('Custom bill #${b['bill_no']}',style:Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight:FontWeight.w800)),
    Text('${b['name']??''} · ${b['mobile']??''}'),
    Text('Material + wood rent: ${moneyLabel(calculateRent(billQuantities(b),parseBillWood(b),b).rentTotal)}'),
    Text('Total: ${moneyLabel(total)} · Paid: ${moneyLabel(paid)} · Pending: ${moneyLabel((total-paid).clamp(0,double.infinity))}'),
    const SizedBox(height:12),...materialCatalog.map((s)=>Text('${s.label}: ${b[s.quantityField]??0}')),
    ...woodCatalog.map((s)=>Text('${s.label}: ${woodToText(parseWoodSizes(b[s.key]))}')),
    const Divider(),Text('Payment history',style:Theme.of(context).textTheme.titleMedium),
    ...historyRows(b['payments']).asMap().entries.map((e)=>ListTile(
      contentPadding:EdgeInsets.zero,
      title:Text(moneyLabel((e.value['amount'] as num?)??0)),
      subtitle:Text('${displayDate(e.value['payment_date'])} · ${e.value['method']??'Cash'}'),
      trailing:Row(mainAxisSize:MainAxisSize.min,children:[
        IconButton(tooltip:'Edit payment',icon:const Icon(Icons.edit_outlined),onPressed:(){Navigator.pop(ctx);_editCustomPayment(context,ref,b,e.value,e.key);}),
        IconButton(tooltip:'Delete payment',icon:const Icon(Icons.delete_outline),onPressed:(){Navigator.pop(ctx);_deleteCustomPayment(context,ref,b,e.value,e.key);})
      ]),
    )),
  ]))));
Future<void> _payment(BuildContext context,WidgetRef ref,Map<String,dynamic>b) async {
  final amount=TextEditingController();
  final ok=await showDialog<bool>(context:context,builder:(c)=>AlertDialog(title:const Text('Record custom bill payment'),content:TextField(controller:amount,keyboardType:const TextInputType.numberWithOptions(decimal:true),decoration:const InputDecoration(labelText:'Amount')),actions:[TextButton(onPressed:()=>Navigator.pop(c,false),child:const Text('Cancel')),FilledButton(onPressed:()=>Navigator.pop(c,true),child:const Text('Save'))]));
  final n=double.tryParse(amount.text);amount.dispose();
  if(ok!=true||n==null||n<=0)return;
  try {
    final repo=ref.read(billingRepositoryProvider),raw=await repo.get('customBills','${b['bill_no']}');
    if(raw==null)throw StateError('Bill not found');
    final list=historyRows(raw['payments'])..add({'payment_id':'pay-${DateTime.now().microsecondsSinceEpoch}','amount':moneyRound(n),'payment_date':DateTime.now().toIso8601String().substring(0,10),'method':'Cash','note':'','created_at':DateTime.now().toUtc().toIso8601String()});
    await repo.put('customBills',{...raw,'payments':list});
  }catch(e){if(context.mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('Could not save payment: $e')));}
}
Future<void> _editCustomPayment(BuildContext context,WidgetRef ref,Map<String,dynamic>b,Map<String,dynamic>original,int originalIndex) async {
  final amount=TextEditingController(text:'${original['amount']??''}');
  final result=await showDialog<double>(context:context,builder:(c)=>AlertDialog(
    title:const Text('Edit payment'),content:TextField(controller:amount,keyboardType:const TextInputType.numberWithOptions(decimal:true),decoration:const InputDecoration(labelText:'Amount (₹)')),
    actions:[TextButton(onPressed:()=>Navigator.pop(c),child:const Text('Cancel')),FilledButton(onPressed:()=>Navigator.pop(c,double.tryParse(amount.text)),child:const Text('Save'))]));
  amount.dispose();if(result==null||result<=0)return;
  try {
    final repo=ref.read(billingRepositoryProvider),raw=await repo.get('customBills','${b['bill_no']}');
    if(raw==null)throw StateError('Bill not found');
    final list=historyRows(raw['payments']),index=historyIndex(list,original,originalIndex,'payment_id');
    if(index<0)throw StateError('Payment has changed; reopen the bill');
    final updated={...list[index],'amount':moneyRound(result),'updated_at':DateTime.now().toUtc().toIso8601String()};
    list[index]=updated;
    await repo.put('customBills',{...raw,'payments':list,'payment_audit':[...historyRows(raw['payment_audit']),{'action':'edit','before':original,'after':updated,'at':DateTime.now().toUtc().toIso8601String(),'by':ref.read(authRepositoryProvider).currentUser?.email}]});
  }catch(e){if(context.mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('Could not edit payment: $e')));}
}
Future<void> _deleteCustomPayment(BuildContext context,WidgetRef ref,Map<String,dynamic>b,Map<String,dynamic>original,int originalIndex) async {
  final password=TextEditingController();
  final confirmed=await showDialog<bool>(context:context,builder:(c)=>AlertDialog(
    title:const Text('Delete payment?'),content:Column(mainAxisSize:MainAxisSize.min,crossAxisAlignment:CrossAxisAlignment.start,children:[const Text('This removes the payment from the bill and recalculates the pending amount. Enter your login password to confirm.'),const SizedBox(height:16),TextField(controller:password,obscureText:true,decoration:const InputDecoration(labelText:'Login password'))]),
    actions:[TextButton(onPressed:()=>Navigator.pop(c,false),child:const Text('Cancel')),FilledButton(onPressed:()=>Navigator.pop(c,true),child:const Text('Delete'))]));
  final secret=password.text;password.dispose();if(confirmed!=true||secret.isEmpty)return;
  try {
    await ref.read(authRepositoryProvider).verifyPassword(secret);
    final repo=ref.read(billingRepositoryProvider),raw=await repo.get('customBills','${b['bill_no']}');
    if(raw==null)throw StateError('Bill not found');
    final list=historyRows(raw['payments']),index=historyIndex(list,original,originalIndex,'payment_id');
    if(index<0)throw StateError('Payment has changed; reopen the bill');
    final removed=list.removeAt(index);
    await repo.put('customBills',{...raw,'payments':list,'payment_audit':[...historyRows(raw['payment_audit']),{'action':'delete','before':removed,'at':DateTime.now().toUtc().toIso8601String(),'by':ref.read(authRepositoryProvider).currentUser?.email}]});
  }catch(e){if(context.mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('Payment was not deleted: $e')));}
}

class CustomBillFormScreen extends ConsumerStatefulWidget{const CustomBillFormScreen({super.key});@override ConsumerState<CustomBillFormScreen> createState()=>_CustomBillFormScreenState();}
class _CustomBillFormScreenState extends ConsumerState<CustomBillFormScreen>{final c=<String,TextEditingController>{};bool saving=false;@override void initState(){super.initState();for(final k in ['name','mobile','place','transport_up_trips','transport_up_charge','transport_down_trips','transport_down_charge','loading_charge','unloading_charge',...materialCatalog.expand((s)=>[s.quantityField,s.rateField]),...woodCatalog.expand((s)=>[s.key,s.rateField])]){final spec=[...materialCatalog,...woodCatalog].where((s)=>s.rateField==k).firstOrNull;c[k]=TextEditingController(text:spec?.defaultRate.toString()??(k.endsWith('_qty')||k.endsWith('_trips')?'0':''));}}
@override void dispose(){for(final x in c.values)x.dispose();super.dispose();}
Widget field(String key,String label,{bool number=false,String? hint})=>Padding(padding:const EdgeInsets.only(bottom:9),child:TextField(controller:c[key],keyboardType:number?const TextInputType.numberWithOptions(decimal:true):TextInputType.text,maxLines:hint==null?1:2,decoration:InputDecoration(labelText:label,hintText:hint)));
@override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('New custom bill')),body:ListView(padding:const EdgeInsets.all(18),children:[field('name','Customer name'),field('mobile','Mobile number',number:true),field('place','Place / site'),const SectionTitle('Material quantity and rate'),...materialCatalog.map((s)=>Row(children:[Expanded(child:field(s.quantityField,'${s.label} qty',number:true)),const SizedBox(width:8),Expanded(child:field(s.rateField,'Rate (₹)',number:true))])),const SectionTitle('Wood sizes'),...woodCatalog.map((s)=>Column(children:[field(s.key,s.label,hint:'Example 8×5+10×2'),field(s.rateField,'${s.label} rate per foot',number:true)])),const SectionTitle('Transport and handling'),field('transport_up_trips','Up trips',number:true),field('transport_up_charge','Up charge / trip',number:true),field('transport_down_trips','Down trips',number:true),field('transport_down_charge','Down charge / trip',number:true),field('loading_charge','Loading',number:true),field('unloading_charge','Unloading',number:true),FilledButton(onPressed:saving?null:save,child:Text(saving?'Saving…':'Save custom bill'))]));
Future<void> save()async{setState(()=>saving=true);try{final repo=ref.read(billingRepositoryProvider),rows=await repo.all('customBills');final nums=rows.map((b)=>int.tryParse('${b['bill_no']}')??0).toList();var seq=(nums.isEmpty?0:nums.reduce((a,b)=>a>b?a:b))+1;final b=<String,dynamic>{'bill_no':'C$seq','name':c['name']!.text.trim(),'mobile':c['mobile']!.text.trim(),'place':c['place']!.text.trim(),'status':'custom','dashboard_visible':false,'payments':<Map<String,dynamic>>[],'return_history':<Map<String,dynamic>>[],'additional_history':<Map<String,dynamic>>[],'created_at':DateTime.now().toUtc().toIso8601String(),'created_by':ref.read(authRepositoryProvider).currentUser?.email??''};for(final s in materialCatalog){b[s.quantityField]=int.tryParse(c[s.quantityField]!.text)??0;b[s.rateField]=double.tryParse(c[s.rateField]!.text)??s.defaultRate;}for(final s in woodCatalog){b[s.key]=c[s.key]!.text.trim();b[s.rateField]=double.tryParse(c[s.rateField]!.text)??s.defaultRate;}for(final k in ['transport_up_trips','transport_down_trips'])b[k]=int.tryParse(c[k]!.text)??0;for(final k in ['transport_up_charge','transport_down_charge','loading_charge','unloading_charge'])b[k]=double.tryParse(c[k]!.text)??0;await repo.put('customBills',b);if(mounted)Navigator.pop(context);}catch(e){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text('Could not save: $e')));}finally{if(mounted)setState(()=>saving=false);}}
}
