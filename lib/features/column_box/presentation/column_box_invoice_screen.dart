import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';
import '../../../core/constants.dart';
import '../../../core/theme/app_theme.dart';
import '../data/column_box_repository.dart';
import '../domain/column_box_bill.dart';
import 'create_column_box_bill_screen.dart';

final columnBoxBillProvider=FutureProvider.autoDispose.family<ColumnBoxBill?,String>(
  (ref,id)=>ref.watch(columnBoxRepositoryProvider).get(id));

Future<Uint8List> buildColumnBoxPdf(ColumnBoxBill bill) async {
  final doc=pw.Document();
  final navy=PdfColor.fromHex('#102F45');
  String cash(num amount) => 'Rs ${NumberFormat('#,##,##0.##','en_IN').format(amount)}';
  pw.Widget total(String label,num amount,{bool bold=false}) => pw.Padding(
    padding:const pw.EdgeInsets.symmetric(vertical:4),child:pw.Row(children:[
      pw.Expanded(child:pw.Text(label,style:pw.TextStyle(
        fontWeight:bold?pw.FontWeight.bold:null))),
      pw.Text(cash(amount),style:pw.TextStyle(fontWeight:bold?pw.FontWeight.bold:null)),
    ]));
  pw.Widget cell(String text,int flex,{bool heading=false,bool left=false}) =>
    pw.Expanded(flex:flex,child:pw.Text(text,textAlign:left?pw.TextAlign.left:pw.TextAlign.right,
      style:pw.TextStyle(fontSize:9,color:heading?PdfColors.white:PdfColors.black,
        fontWeight:heading?pw.FontWeight.bold:null)));
  doc.addPage(pw.MultiPage(pageFormat:PdfPageFormat.a4,
    margin:const pw.EdgeInsets.all(36),build:(_)=>[
      pw.Text(businessName,style:pw.TextStyle(fontSize:20,color:navy,
        fontWeight:pw.FontWeight.bold)),
      pw.Text(businessAddress,style:const pw.TextStyle(fontSize:9)),
      pw.Text('Mobile: $businessPhones',style:const pw.TextStyle(fontSize:9)),
      pw.SizedBox(height:18),
      pw.Text('COLUMN BOX RENTAL INVOICE',style:pw.TextStyle(color:navy,
        fontSize:12,fontWeight:pw.FontWeight.bold)),
      pw.SizedBox(height:8),
      pw.Text('Invoice ${bill.invoiceNo}  |  ${DateFormat('dd MMM yyyy').format(DateTime.parse(bill.createdAt).toLocal())}'),
      pw.Divider(),pw.Text('BILL TO',style:pw.TextStyle(fontWeight:pw.FontWeight.bold)),
      pw.Text(bill.customerName),pw.Text(bill.phone),pw.Text(bill.place),
      pw.SizedBox(height:8),pw.Text('Rental period: ${bill.days} days'),
      pw.SizedBox(height:16),
      pw.Container(color:navy,padding:const pw.EdgeInsets.all(8),
        child:pw.Row(children:[cell('ITEM',5,heading:true,left:true),
          cell('QTY',1,heading:true),cell('AMOUNT',3,heading:true)])),
      ...bill.items.map((i)=>pw.Container(
        padding:const pw.EdgeInsets.symmetric(horizontal:8,vertical:9),
        decoration:const pw.BoxDecoration(border:pw.Border(
          bottom:pw.BorderSide(color:PdfColors.grey300))),
        child:pw.Row(children:[
          pw.Expanded(flex:5,child:pw.Column(
            crossAxisAlignment:pw.CrossAxisAlignment.start,children:[
              pw.Text(i.name,style:pw.TextStyle(fontSize:9,
                fontWeight:pw.FontWeight.bold)),
              if (i.size.isNotEmpty) pw.Text(i.size.replaceAll('×','x'),
                style:const pw.TextStyle(fontSize:8)),
            ])),cell('${i.qty}',1),cell(cash(i.amount),3),
        ]))),
      pw.SizedBox(height:14),total('Items total',bill.itemsTotal),
      total('Transport',bill.transport),total('Labour up',bill.labourUp),
      total('Labour down',bill.labourDown),pw.Divider(),
      total('Total',bill.grandTotal,bold:true),
      total('Advance paid',bill.advancePaid),
      if (bill.amountPaid>0) total('Other payments',bill.amountPaid),
      pw.Container(color:navy,padding:const pw.EdgeInsets.all(8),child:pw.Row(children:[
        pw.Expanded(child:pw.Text('BALANCE DUE',style:pw.TextStyle(
          color:PdfColors.white,fontWeight:pw.FontWeight.bold))),
        pw.Text(cash(bill.balanceDue),style:pw.TextStyle(
          color:PdfColors.white,fontWeight:pw.FontWeight.bold)),
      ])),
    ]));
  return doc.save();
}

class ColumnBoxInvoiceScreen extends ConsumerWidget {
  const ColumnBoxInvoiceScreen({super.key,required this.billId});
  final String billId;

  Future<void> _share(ColumnBoxBill bill,BuildContext context) async {
    try {
      final bytes=await buildColumnBoxPdf(bill);
      if (!context.mounted) return;
      await SharePlus.instance.share(ShareParams(files:[XFile.fromData(bytes,
        mimeType:'application/pdf',name:'${bill.invoiceNo}.pdf')],
        text:'${businessName} · Column Box invoice ${bill.invoiceNo}'));
    } catch (e) {
      if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content:Text('Could not share invoice: $e')));
    }
  }

  Future<void> _print(ColumnBoxBill bill,BuildContext context) async {
    try { final bytes=await buildColumnBoxPdf(bill);
      await Printing.layoutPdf(onLayout:(_)=>bytes,name:'${bill.invoiceNo}.pdf');
    } catch (e) { if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content:Text('Could not print invoice: $e'))); }
  }

  Future<void> _paid(ColumnBoxBill bill,BuildContext context,WidgetRef ref) async {
    final yes=await showDialog<bool>(context:context,builder:(dialog)=>AlertDialog(
      title:const Text('Mark as paid?'),
      content:Text('Record the remaining ${boxCurrency(bill.balanceDue)} as paid for ${bill.invoiceNo}?'),
      actions:[TextButton(onPressed:()=>Navigator.pop(dialog,false),child:const Text('Cancel')),
        FilledButton(onPressed:()=>Navigator.pop(dialog,true),child:const Text('Mark paid'))]));
    if (yes!=true) return;
    try { await ref.read(columnBoxRepositoryProvider).save(bill.markPaid());
      ref.invalidate(columnBoxBillProvider(bill.id));
    } catch(e) { if(context.mounted) ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content:Text('Could not mark paid: $e'))); }
  }

  Future<void> _delete(ColumnBoxBill bill,BuildContext context,WidgetRef ref) async {
    final yes=await showDialog<bool>(context:context,builder:(dialog)=>AlertDialog(
      title:Text('Delete bill ${bill.invoiceNo}?'),
      content:Text('Delete bill ${bill.invoiceNo}? This cannot be undone after 5 seconds.'),
      actions:[TextButton(onPressed:()=>Navigator.pop(dialog,false),child:const Text('Cancel')),
        FilledButton(onPressed:()=>Navigator.pop(dialog,true),
          child:const Text('Delete bill'))]));
    if(yes!=true) return;
    try {
      final repo=ref.read(columnBoxRepositoryProvider);
      await repo.delete(bill.id);
      if (!context.mounted) return;
      final messenger=ScaffoldMessenger.of(context);
      Navigator.pop(context);
      messenger.showSnackBar(SnackBar(duration:const Duration(seconds:5),
        content:Text('${bill.invoiceNo} deleted'),action:SnackBarAction(label:'Undo',onPressed:() async {
          try { await repo.save(bill); }
          catch (_) { messenger.showSnackBar(const SnackBar(content:Text('Could not restore bill'))); }
        })));
    } catch(e) { if(context.mounted) ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content:Text('Could not delete bill: $e'))); }
  }

  Widget _line(BuildContext context,String label,num amount,{bool strong=false}) =>
    Padding(padding:const EdgeInsets.symmetric(vertical:5),child:Row(children:[
      Expanded(child:Text(label,style:TextStyle(fontWeight:strong?FontWeight.w800:null))),
      Text(boxCurrency(amount),style:TextStyle(fontWeight:strong?FontWeight.w900:null)),
    ]));

  @override Widget build(BuildContext context,WidgetRef ref) {
    final asyncBill=ref.watch(columnBoxBillProvider(billId));
    return asyncBill.when(loading:()=>Scaffold(appBar:AppBar(title:const Text('Column Box invoice')),
      body:const Center(child:CircularProgressIndicator())),
      error:(e,_)=>Scaffold(appBar:AppBar(title:const Text('Column Box invoice')),
        body:Center(child:Text('Could not load bill: $e'))),
      data:(bill) {
        if (bill==null) return Scaffold(appBar:AppBar(title:const Text('Column Box invoice')),
          body:const Center(child:Text('Bill not found')));
        const navy=Color(0xFF102F45);
        return Scaffold(appBar:AppBar(title:Text(bill.invoiceNo),actions:[
          IconButton(tooltip:'Edit bill',icon:const Icon(Icons.edit_outlined),onPressed:() async {
            await Navigator.push(context,MaterialPageRoute(builder:(_)=>
              CreateColumnBoxBillScreen(initialBill:bill)));
            ref.invalidate(columnBoxBillProvider(bill.id));
          }),
          IconButton(tooltip:'Delete bill',icon:const Icon(Icons.delete_outline),
            onPressed:()=>_delete(bill,context,ref))]),
          body:Center(child:ConstrainedBox(constraints:const BoxConstraints(maxWidth:650),
            child:ListView(padding:const EdgeInsets.fromLTRB(14,12,14,22),children:[
              Container(padding:const EdgeInsets.all(18),decoration:BoxDecoration(
                color:Colors.white,borderRadius:BorderRadius.circular(18)),
                child:DefaultTextStyle(style:const TextStyle(color:navy,fontSize:13),
                  child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
                    Row(children:[Expanded(child:Text(businessName,style:const TextStyle(
                      fontSize:24,fontWeight:FontWeight.w900,color:Color(0xFF05637F)))),
                      Text(bill.status.toUpperCase(),style:TextStyle(fontWeight:FontWeight.w800,
                        color:bill.status=='paid'?const Color(0xFF087655):const Color(0xFFB4233B)))]),
                    Text(businessAddress,style:const TextStyle(fontSize:10,color:navy)),
                    Text('Mobile: $businessPhones',style:const TextStyle(fontSize:10,color:navy)),
                    const SizedBox(height:14),Container(padding:const EdgeInsets.all(9),
                      color:const Color(0xFFE8F3F6),child:const Text('COLUMN BOX RENTAL INVOICE',
                        textAlign:TextAlign.center,style:TextStyle(fontWeight:FontWeight.w900))),
                    const SizedBox(height:12),Row(children:[
                      Expanded(child:Text('Invoice No: ${bill.invoiceNo}')),
                      Text(DateFormat('dd MMM yyyy').format(DateTime.parse(bill.createdAt).toLocal()))]),
                    const Divider(height:22),Text('BILL TO',style:TextStyle(fontSize:10,
                      color:navy.withValues(alpha:.7),fontWeight:FontWeight.w800)),
                    Text(bill.customerName,style:const TextStyle(fontWeight:FontWeight.w800,fontSize:16)),
                    Text(bill.phone),Text(bill.place),const SizedBox(height:9),
                    Text('Rental period: ${bill.days} days'),const SizedBox(height:14),
                    Container(color:navy,padding:const EdgeInsets.all(8),child:const Row(children:[
                      Expanded(flex:5,child:Text('ITEM',style:TextStyle(color:Colors.white,
                        fontWeight:FontWeight.w800))),
                      Expanded(child:Text('QTY',textAlign:TextAlign.right,
                        style:TextStyle(color:Colors.white,fontWeight:FontWeight.w800))),
                      Expanded(flex:3,child:Text('AMOUNT',textAlign:TextAlign.right,
                        style:TextStyle(color:Colors.white,fontWeight:FontWeight.w800)))])),
                    for(final item in bill.items) Padding(padding:const EdgeInsets.symmetric(vertical:8),
                      child:Row(children:[Expanded(flex:5,child:Column(
                        crossAxisAlignment:CrossAxisAlignment.start,children:[
                          Text(item.name,style:const TextStyle(fontWeight:FontWeight.w800)),
                          if(item.size.isNotEmpty) Text(item.size,style:const TextStyle(fontSize:10)),
                        ])),Expanded(child:Text('${item.qty}',textAlign:TextAlign.right)),
                        Expanded(flex:3,child:Text(boxCurrency(item.amount),
                          textAlign:TextAlign.right))])),
                    const Divider(),_line(context,'Items total',bill.itemsTotal),
                    _line(context,'Transport',bill.transport),
                    _line(context,'Labour up',bill.labourUp),
                    _line(context,'Labour down',bill.labourDown),
                    const Divider(),_line(context,'Total',bill.grandTotal,strong:true),
                    _line(context,'Advance paid',bill.advancePaid),
                    if(bill.amountPaid>0) _line(context,'Other payments',bill.amountPaid),
                    Container(padding:const EdgeInsets.all(11),color:const Color(0xFF05637F),
                      child:Row(children:[const Expanded(child:Text('BALANCE DUE',
                        style:TextStyle(color:Colors.white,fontWeight:FontWeight.w800))),
                        Text(boxCurrency(bill.balanceDue),style:const TextStyle(
                          color:Colors.white,fontSize:18,fontWeight:FontWeight.w900))])),
                  ]))),
              const SizedBox(height:14),Wrap(spacing:8,runSpacing:8,children:[
                OutlinedButton.icon(onPressed:()=>_share(bill,context),
                  icon:const Icon(Icons.chat_outlined),label:const Text('WhatsApp')),
                OutlinedButton.icon(onPressed:()=>_share(bill,context),
                  icon:const Icon(Icons.picture_as_pdf_outlined),label:const Text('Share PDF')),
                OutlinedButton.icon(onPressed:()=>_print(bill,context),
                  icon:const Icon(Icons.print_outlined),label:const Text('Print')),
                if(bill.balanceDue>0) FilledButton.icon(onPressed:()=>_paid(bill,context,ref),
                  icon:const Icon(Icons.check),label:const Text('Mark paid')),
              ]),
            ]))));
      });
  }
}
