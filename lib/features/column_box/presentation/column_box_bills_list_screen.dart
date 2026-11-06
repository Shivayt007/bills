import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/glass_design.dart';
import '../data/column_box_repository.dart';
import '../domain/column_box_bill.dart';
import 'column_box_invoice_screen.dart';
import 'create_column_box_bill_screen.dart';

class ColumnBoxBillsListScreen extends ConsumerStatefulWidget {
  const ColumnBoxBillsListScreen({super.key});
  @override ConsumerState<ColumnBoxBillsListScreen> createState()=>_ListState();
}

class _ListState extends ConsumerState<ColumnBoxBillsListScreen> {
  final search=TextEditingController();
  @override void dispose() { search.dispose();super.dispose(); }

  Future<void> _delete(ColumnBoxBill bill) async {
    final confirm=await showDialog<bool>(context:context,builder:(dialog)=>AlertDialog(
      title:Text('Delete bill ${bill.invoiceNo}?'),
      content:Text('Delete bill ${bill.invoiceNo}? This cannot be undone after 5 seconds.'),
      actions:[TextButton(onPressed:()=>Navigator.pop(dialog,false),child:const Text('Cancel')),
        FilledButton(onPressed:()=>Navigator.pop(dialog,true),child:const Text('Delete bill'))]));
    if (confirm!=true) return;
    try {
      await ref.read(columnBoxRepositoryProvider).delete(bill.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(duration:const Duration(seconds:5),
        content:Text('${bill.invoiceNo} deleted'),
        action:SnackBarAction(label:'Undo',onPressed:() async {
          try { await ref.read(columnBoxRepositoryProvider).save(bill); }
          catch (_) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content:Text('Could not restore bill'))); }
        })));
    } catch(e) { if(mounted) ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content:Text('Could not delete bill: $e'))); }
  }

  @override Widget build(BuildContext context) {
    final bills=ref.watch(columnBoxBillsProvider);
    return GlassBackdrop(child:Scaffold(backgroundColor:Colors.transparent,
      appBar:AppBar(backgroundColor:Colors.transparent,title:const Text('Column box bills'),
        actions:[IconButton(tooltip:'New column box bill',icon:const Icon(Icons.add),
          onPressed:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>
            const CreateColumnBoxBillScreen())))]),
      body:Column(children:[Padding(padding:const EdgeInsets.all(16),
        child:TextField(controller:search,onChanged:(_)=>setState((){}),
          decoration:const InputDecoration(labelText:'Search by name or phone',
            prefixIcon:Icon(Icons.search)))),
        Expanded(child:bills.when(loading:()=>const Center(child:CircularProgressIndicator()),
          error:(e,_)=>Center(child:Text('Could not load Column Box bills: $e')),
          data:(rows) {
            final q=search.text.trim().toLowerCase();
            final filtered=rows.where((b)=>('${b.customerName} ${b.phone}')
              .toLowerCase().contains(q)).toList();
            if(filtered.isEmpty) return const Center(child:Text('No Column Box bills found'));
            return ListView.separated(padding:const EdgeInsets.fromLTRB(16,0,16,100),
              itemCount:filtered.length,separatorBuilder:(_,_)=>const SizedBox(height:10),
              itemBuilder:(context,index) {
                final bill=filtered[index];
                return Dismissible(key:ValueKey(bill.id),direction:DismissDirection.endToStart,
                  background:Container(alignment:Alignment.centerRight,
                    padding:const EdgeInsets.only(right:24),color:AppPalette.of(context).danger,
                    child:const Icon(Icons.delete_outline,color:Colors.white)),
                  confirmDismiss:(_) async { await _delete(bill);return false; },
                  child:GlassCard(onTap:()=>Navigator.push(context,MaterialPageRoute(
                    builder:(_)=>ColumnBoxInvoiceScreen(billId:bill.id))),
                    child:Row(children:[Expanded(child:Column(
                      crossAxisAlignment:CrossAxisAlignment.start,children:[
                        Text(bill.invoiceNo,style:Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height:4),Text(bill.customerName),
                        Text('${bill.phone} · ${DateFormat('dd MMM yyyy').format(DateTime.parse(bill.createdAt).toLocal())}',
                          style:Theme.of(context).textTheme.bodySmall),
                      ])),const SizedBox(width:8),Column(
                        crossAxisAlignment:CrossAxisAlignment.end,children:[
                          Text(boxCurrency(bill.grandTotal),style:const TextStyle(fontWeight:FontWeight.w900)),
                          const SizedBox(height:4),Text(bill.status.toUpperCase(),
                            style:TextStyle(fontSize:11,fontWeight:FontWeight.w800,
                              color:bill.status=='paid'?AppPalette.of(context).positive:
                                AppPalette.of(context).danger)),
                        ])])));
              });
          }))]),
      floatingActionButton:FloatingActionButton.extended(
        onPressed:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>
          const CreateColumnBoxBillScreen())),icon:const Icon(Icons.add),
        label:const Text('New bill'))));
  }
}
