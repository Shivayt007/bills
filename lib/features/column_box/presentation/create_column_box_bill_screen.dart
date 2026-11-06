import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/glass_design.dart';
import '../data/column_box_repository.dart';
import '../domain/column_box_bill.dart';
import 'column_box_invoice_screen.dart';

class CreateColumnBoxBillScreen extends ConsumerStatefulWidget {
  const CreateColumnBoxBillScreen({super.key,this.initialBill});
  final ColumnBoxBill? initialBill;
  @override ConsumerState<CreateColumnBoxBillScreen> createState() => _CreateState();
}

class _BoxEntry {
  _BoxEntry([ColumnBoxItem? item])
    : width=TextEditingController(text:item == null ? '' : boxDimension(item.width)),
      depth=TextEditingController(text:item == null ? '' : boxDimension(item.depth)),
      height=TextEditingController(text:item == null ? '' : boxDimension(item.height)),
      qty=TextEditingController(text:item == null ? '0' : '${item.qty}'),
      rate=TextEditingController(text:item == null ? '0' : '${item.ratePerDay}');
  final TextEditingController width,depth,height,qty,rate;
  Iterable<TextEditingController> get controls => [width,depth,height,qty,rate];
  void dispose() { for (final item in controls) { item.dispose(); } }
}

class _CreateState extends ConsumerState<CreateColumnBoxBillScreen> {
  final form=GlobalKey<FormState>();
  late final TextEditingController name,phone,place,centringQty,centringRate,
    transport,labourUp,labourDown,advance;
  final boxes=<_BoxEntry>[];
  int days=1;
  bool busy=false;
  bool get editing => widget.initialBill != null;

  @override void initState() {
    super.initState();
    final b=widget.initialBill;
    days=b?.days ?? 1;
    name=TextEditingController(text:b?.customerName ?? '');
    phone=TextEditingController(text:b?.phone ?? '');
    place=TextEditingController(text:b?.place ?? '');
    final centring=b?.items.where((i)=>i.type=='centring').firstOrNull;
    centringQty=TextEditingController(text:'${centring?.qty ?? 0}');
    centringRate=TextEditingController(text:'${centring?.ratePerDay ?? 0}');
    transport=TextEditingController(text:'${b?.transport ?? 0}');
    labourUp=TextEditingController(text:'${b?.labourUp ?? 0}');
    labourDown=TextEditingController(text:'${b?.labourDown ?? 0}');
    advance=TextEditingController(text:'${b?.advancePaid ?? 0}');
    boxes.addAll(b?.items.where((i)=>i.type=='column_box').map(_BoxEntry.new) ?? []);
    if (boxes.isEmpty) boxes.add(_BoxEntry());
    for (final c in [name,phone,place,centringQty,centringRate,transport,
        labourUp,labourDown,advance]) { c.addListener(_refresh); }
    for (final box in boxes) { _listen(box); }
  }
  void _refresh() { if (mounted) setState((){}); }
  void _listen(_BoxEntry box) { for (final c in box.controls) { c.addListener(_refresh); } }
  @override void dispose() {
    for (final c in [name,phone,place,centringQty,centringRate,transport,
        labourUp,labourDown,advance]) { c.dispose(); }
    for (final box in boxes) { box.dispose(); }
    super.dispose();
  }

  double _num(TextEditingController c) => double.tryParse(c.text.trim()) ?? 0;
  int _qty(TextEditingController c) => int.tryParse(c.text.trim()) ?? 0;
  double get estimatedItems => boxMoney(days *
    (_qty(centringQty)*_num(centringRate) + boxes.fold<double>(0,
      (sum,b)=>sum+_qty(b.qty)*_num(b.rate))));
  double get estimatedTotal => boxMoney(estimatedItems + _num(transport) +
    _num(labourUp) + _num(labourDown));

  Widget _field(String label,TextEditingController c,{bool integer=false,
      bool required=false,bool optional=false,String? suffix}) => TextFormField(
    controller:c,keyboardType:integer ? TextInputType.number :
      suffix == null ? TextInputType.text : const TextInputType.numberWithOptions(decimal:true),
    decoration:InputDecoration(labelText:label,suffixText:suffix),
    validator:(value) {
      final text=value?.trim() ?? '';
      if (required && text.isEmpty) return 'Required';
      if (optional && text.isEmpty) return null;
      if (suffix == null && !integer) return null;
      final parsed=integer ? int.tryParse(text) : double.tryParse(text);
      return parsed == null || parsed < 0 ? 'Enter a non-negative number' : null;
    });

  Widget _card(String title,IconData icon,List<Widget> children) {
    final p=AppPalette.of(context);
    return GlassCard(child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
      Row(children:[Icon(icon,color:p.accent),const SizedBox(width:10),
        Expanded(child:Text(title,style:Theme.of(context).textTheme.titleLarge))]),
      const SizedBox(height:16),...children,
    ]));
  }

  Widget _boxCard(_BoxEntry box,int index) {
    final p=AppPalette.of(context);
    return Padding(padding:const EdgeInsets.only(bottom:12),child:Container(
      padding:const EdgeInsets.all(14),decoration:BoxDecoration(color:p.subtle,
        borderRadius:BorderRadius.circular(18),border:Border.all(color:p.border)),
      child:Column(crossAxisAlignment:CrossAxisAlignment.stretch,children:[
        Row(children:[Expanded(child:Text('Column size ${index+1}',
          style:Theme.of(context).textTheme.titleMedium)),
          TextButton.icon(onPressed:()=>setState(() {
            boxes.removeAt(index);
            WidgetsBinding.instance.addPostFrameCallback((_)=>box.dispose());
          }),icon:const Icon(Icons.close,size:17),label:const Text('Remove'))]),
        const SizedBox(height:8),
        Row(children:[Expanded(child:_field('Width',box.width,suffix:'in',optional:true)),
          const SizedBox(width:8),Expanded(child:_field('Depth',box.depth,suffix:'in',optional:true))]),
        const SizedBox(height:10),_field('Height',box.height,suffix:'ft',optional:true),
        const SizedBox(height:10),
        Row(children:[Expanded(child:_field('Qty',box.qty,integer:true)),
          const SizedBox(width:8),Expanded(child:_field('Rate / day',box.rate,suffix:'₹'))]),
        const SizedBox(height:9),Align(alignment:Alignment.centerRight,
          child:Text('Amount ${boxCurrency(boxMoney(_qty(box.qty)*_num(box.rate)*days))}',
            style:TextStyle(color:p.accent,fontWeight:FontWeight.w800))),
      ])));
  }

  Future<void> _save() async {
    if (!form.currentState!.validate()) return;
    if (boxes.any((b)=>_qty(b.qty)>0 &&
        (_num(b.width)<=0 || _num(b.depth)<=0 || _num(b.height)<=0))) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:
        Text('Enter width, depth and height for each rented column size.')));
      return;
    }
    if (_qty(centringQty)==0 && !boxes.any((b)=>_qty(b.qty)>0)) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:
        Text('Add at least one item with quantity above zero.')));
      return;
    }
    setState(()=>busy=true);
    try {
      final repo=ref.read(columnBoxRepositoryProvider);
      final number=widget.initialBill?.invoiceNo ?? await repo.nextInvoiceNo();
      final items=<ColumnBoxItem>[
        if (_qty(centringQty)>0) ColumnBoxItem.calculate(type:'centring',
          qty:_qty(centringQty),ratePerDay:_num(centringRate),days:days),
        for (final b in boxes) if (_qty(b.qty)>0) ColumnBoxItem.calculate(
          type:'column_box',qty:_qty(b.qty),ratePerDay:_num(b.rate),days:days,
          width:_num(b.width),depth:_num(b.depth),height:_num(b.height)),
      ];
      final previous=widget.initialBill;
      final bill=ColumnBoxBill.create(id:previous?.id ?? number,
        invoiceNo:number,createdAt:previous?.createdAt ??
          DateTime.now().toUtc().toIso8601String(),customerName:name.text,
        phone:phone.text,place:place.text,days:days,transport:_num(transport),
        labourUp:_num(labourUp),labourDown:_num(labourDown),
        advancePaid:_num(advance),amountPaid:previous?.amountPaid ?? 0,items:items);
      await repo.save(bill);
      if (!mounted) return;
      if (editing) { Navigator.pop(context,true);return; }
      Navigator.pushReplacement(context,MaterialPageRoute(
        builder:(_)=>ColumnBoxInvoiceScreen(billId:bill.id)));
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content:Text('Could not save Column Box bill: $error')));
    } finally { if (mounted) setState(()=>busy=false); }
  }

  @override Widget build(BuildContext context) {
    final p=AppPalette.of(context);
    return GlassBackdrop(child:Scaffold(backgroundColor:Colors.transparent,
      appBar:AppBar(backgroundColor:Colors.transparent,
        title:Text(editing?'Edit column box bill':'New column box bill')),
      bottomNavigationBar:SafeArea(top:false,child:Container(
        padding:const EdgeInsets.fromLTRB(16,9,16,12),
        decoration:BoxDecoration(color:p.surface,border:Border(top:BorderSide(color:p.border))),
        child:Row(children:[Expanded(child:Column(mainAxisSize:MainAxisSize.min,
          crossAxisAlignment:CrossAxisAlignment.start,children:[
            Text('TOTAL',style:Theme.of(context).textTheme.labelSmall),
            Text(boxCurrency(estimatedTotal),style:Theme.of(context).textTheme.titleLarge),
          ])),const SizedBox(width:8),GlassPillButton(
            label:busy?'Saving…':editing?'Save bill':'Create bill',
            icon:Icons.arrow_forward,onPressed:busy?null:_save)]))),
      body:Form(key:form,child:ListView(padding:const EdgeInsets.fromLTRB(16,12,16,24),
        children:[Text('Column box rental',style:Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height:4),Text('Sized for each job. Charged by the day.',
            style:Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height:16),_card('Customer',Icons.person_outline,[
            _field('Customer name',name,required:true),const SizedBox(height:10),
            _field('Phone',phone),const SizedBox(height:10),_field('Place / site',place)]),
          const SizedBox(height:14),_card('Rental days',Icons.calendar_today_outlined,[
            Row(children:[IconButton(tooltip:'Remove one day',
                onPressed:days>1?()=>setState(()=>days--):null,
                icon:const Icon(Icons.remove_circle_outline)),
              Expanded(child:Text('$days days',textAlign:TextAlign.center,
                style:Theme.of(context).textTheme.titleLarge)),
              IconButton(tooltip:'Add one day',onPressed:()=>setState(()=>days++),
                icon:const Icon(Icons.add_circle_outline))])]),
          const SizedBox(height:14),_card('Centring',Icons.grid_on_outlined,[
            Row(children:[Expanded(child:_field('Qty',centringQty,integer:true)),
              const SizedBox(width:9),Expanded(child:_field('Rate / day',centringRate,suffix:'₹'))]),
            const SizedBox(height:8),Align(alignment:Alignment.centerRight,
              child:Text('Amount ${boxCurrency(boxMoney(_qty(centringQty)*_num(centringRate)*days))}',
                style:TextStyle(color:p.accent,fontWeight:FontWeight.w800)))]),
          const SizedBox(height:14),_card('Column boxes',Icons.view_in_ar_outlined,[
            for (var i=0;i<boxes.length;i++) _boxCard(boxes[i],i),
            OutlinedButton.icon(onPressed:()=>setState(() {
              final box=_BoxEntry();_listen(box);boxes.add(box);
            }),icon:const Icon(Icons.add),label:const Text('Add column size'))]),
          const SizedBox(height:14),_card('Transport & labour',Icons.local_shipping_outlined,[
            _field('Transport',transport,suffix:'₹'),const SizedBox(height:10),
            _field('Labour up',labourUp,suffix:'₹'),const SizedBox(height:10),
            _field('Labour down',labourDown,suffix:'₹'),const SizedBox(height:10),
            _field('Advance paid',advance,suffix:'₹')]),
        ]))));
  }
}
