import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers.dart';
import '../../custom_bills/presentation/custom_bill_screen.dart';
import 'bill_detail_screen.dart';

final billNavigatorKey = GlobalKey<NavigatorState>();
Future<void> openBill(BuildContext context, String id, {bool isCustom=false}) async {
  await Navigator.of(context).push(MaterialPageRoute<void>(builder:(_)=>isCustom ? _CustomBillLink(id:id) : BillDetailScreen(billNo:id)));
}
final customBillLinkProvider=FutureProvider.autoDispose.family<Map<String,dynamic>?,String>((ref,id)=>ref.watch(billingRepositoryProvider).get('customBills',id));
class _CustomBillLink extends ConsumerWidget {
  const _CustomBillLink({required this.id});
  final String id;
  @override Widget build(BuildContext context,WidgetRef ref)=>ref.watch(customBillLinkProvider(id)).when(
    loading:()=>Scaffold(appBar:AppBar(title:Text('Custom bill #$id')),body:const Center(child:CircularProgressIndicator())),
    error:(e,st)=>Scaffold(appBar:AppBar(),body:Center(child:TextButton(onPressed:()=>ref.invalidate(customBillLinkProvider(id)),child:const Text('Could not load bill. Retry')))),
    data:(b)=>b==null?Scaffold(appBar:AppBar(),body:const Center(child:Text('Bill not found'))):CustomBillScreen(focusedBill:id,focusedData:b));
}

class ViewBillButton extends StatelessWidget {
  const ViewBillButton({super.key,required this.billNo,this.isCustom=false});
  final String billNo;
  final bool isCustom;
  @override Widget build(BuildContext context)=>FilledButton.tonalIcon(onPressed:()=>openBill(context,billNo,isCustom:isCustom),icon:const Icon(Icons.receipt_long_outlined),label:const Text('View bill'));
}
