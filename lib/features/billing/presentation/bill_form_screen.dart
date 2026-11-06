import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/glass_design.dart';
import '../../../core/widgets/common.dart';
import '../domain/billing_calculator.dart';
import '../domain/history_corrections.dart';

class BillFormScreen extends ConsumerStatefulWidget {
  const BillFormScreen({super.key, this.initialBill});
  final Map<String, dynamic>? initialBill;
  @override
  ConsumerState<BillFormScreen> createState() => _BillFormScreenState();
}

class _BillFormScreenState extends ConsumerState<BillFormScreen> {
  final form = GlobalKey<FormState>();
  final c = <String, TextEditingController>{};
  DateTime start = DateTime.now();
  int days = 30;
  bool saving = false;
  late final Listenable estimateChanges;
  bool get editing => widget.initialBill != null;
  bool get hasHistory {
    final b = widget.initialBill;
    return b != null && ['payments', 'return_history', 'additional_history']
      .any((key) => (b[key] as List? ?? const []).isNotEmpty);
  }

  @override
  void initState() {
    super.initState();
    final b = widget.initialBill ?? const <String, dynamic>{};
    start = parseBillingDate(b['start_date']) ?? DateTime.now();
    days = (b['cycle_days'] as num?)?.toInt() ?? 30;
    final keys = <String>[
      'bill_no', 'name', 'mobile', 'place', 'advance_amount',
      'transport_up_trips', 'transport_up_charge', 'transport_down_trips',
      'transport_down_charge', 'loading_charge', 'unloading_charge',
      ...materialCatalog.expand((s) => [s.quantityField, s.rateField]),
      ...woodCatalog.expand((s) => [s.key, s.rateField]),
    ];
    for (final key in keys) {
      final spec = [...materialCatalog, ...woodCatalog]
        .where((s) => s.rateField == key).firstOrNull;
      c[key] = TextEditingController(text: b[key] == null
        ? (spec == null ? (['bill_no', 'name', 'mobile', 'place'].contains(key) ||
            woodCatalog.any((s) => s.key == key) ? '' : '0') : '${spec.defaultRate}')
        : '${b[key]}');
    }
    estimateChanges = Listenable.merge(c.values);
    if (!editing) _suggestNumber();
  }

  Future<void> _suggestNumber() async {
    try {
      final all = await ref.read(billingRepositoryProvider).all('bills');
      if (!mounted || c['bill_no']!.text.isNotEmpty) return;
      final used = all.map((b) => '${b['bill_no']}').toSet();
      var next = all.map((b) => int.tryParse('${b['bill_no']}') ?? 0)
        .fold<int>(0, (a, b) => a > b ? a : b) + 1;
      while (used.contains('$next')) next++;
      c['bill_no']!.text = '$next';
    } catch (_) { /* The user can enter a number if offline. */ }
  }

  @override
  void dispose() {
    for (final controller in c.values) { controller.dispose(); }
    super.dispose();
  }

  Widget _field(String key, String label, {bool number = false,
      bool decimal = false, String? hint, bool readOnly = false,
      IconData? icon}) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final p = AppPalette.of(context);
    final border = OutlineInputBorder(borderRadius: BorderRadius.circular(16),
      borderSide: BorderSide(color: p.border));
    return TextFormField(
      controller: c[key], readOnly: readOnly,
      keyboardType: number ? TextInputType.numberWithOptions(decimal: decimal)
        : key == 'mobile' ? TextInputType.phone : TextInputType.text,
      decoration: InputDecoration(labelText: label, hintText: hint,
        prefixIcon: icon == null ? null : Icon(icon, color: p.accent, size: 20),
        filled: true, fillColor: dark ? const Color(0xAA243B49)
          : const Color(0xD8F8FDFE),
        border: border, enabledBorder: border,
        focusedBorder: border.copyWith(borderSide: BorderSide(color: p.accent,width: 2))),
      validator: (v) {
        final value = v?.trim() ?? '';
        if (['bill_no', 'name'].contains(key) && value.isEmpty) return 'Required';
        if (number && value.isNotEmpty) {
          final parsed = decimal ? double.tryParse(value) : int.tryParse(value);
          if (parsed == null || parsed < 0) return 'Enter a valid number';
        }
        return null;
      },
    );
  }

  Widget _space(Widget child) => Padding(
    padding: const EdgeInsets.only(bottom: 12), child: child);

  Widget _section(String title, String subtitle, IconData icon,
      List<Widget> children, {bool blur = false}) {
    final p = AppPalette.of(context);
    return GlassCard(blur: blur, padding: const EdgeInsets.all(18),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [Container(padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: p.subtle,
            borderRadius: BorderRadius.circular(13)),
          child: Icon(icon, color: p.accent)), const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
          ]))]),
        const SizedBox(height: 18), ...children,
      ]));
  }

  double get estimatedFirstCycle {
    final values = <String,dynamic>{};
    for (final spec in [...materialCatalog,...woodCatalog]) {
      values[spec.quantityField] = spec.key.startsWith('wood') || spec.key == 'runner'
        ? c[spec.key]!.text : int.tryParse(c[spec.quantityField]!.text) ?? 0;
      values[spec.rateField] = double.tryParse(c[spec.rateField]!.text) ?? spec.defaultRate;
    }
    for (final key in ['transport_up_trips','transport_down_trips']) {
      values[key] = int.tryParse(c[key]!.text) ?? 0;
    }
    for (final key in ['transport_up_charge','transport_down_charge',
        'loading_charge','unloading_charge']) {
      values[key] = double.tryParse(c[key]!.text) ?? 0;
    }
    return moneyRound(calculateRent(billQuantities(values),
      parseBillWood(values),values).rentTotal + transportTotal(values));
  }

  Future<void> _editRate(MaterialSpec spec) async {
    final controller = TextEditingController(text: c[spec.rateField]!.text);
    final value = await showDialog<String>(context: context,builder: (dialog) =>
      AlertDialog(title: Text('${spec.label} rate'),
        content: TextField(controller: controller,autofocus: true,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(labelText: spec.key.startsWith('wood') || spec.key == 'runner'
            ? 'Rate per foot (₹)' : 'Rate per cycle (₹)')),
        actions: [TextButton(onPressed: () => Navigator.pop(dialog),
          child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(dialog,controller.text.trim()),
            child: const Text('Save rate'))]));
    controller.dispose();
    if (!mounted || value == null) return;
    final parsed = double.tryParse(value);
    if (parsed == null || parsed < 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Enter a valid non-negative rate.')));
      return;
    }
    c[spec.rateField]!.text = value;
  }

  Widget _quantityControl(MaterialSpec spec) {
    final controller = c[spec.quantityField]!;
    final p = AppPalette.of(context);
    void change(int delta) {
      final current = int.tryParse(controller.text) ?? 0;
      controller.text = '${(current + delta).clamp(0, 0x7fffffff)}';
    }
    return Container(height: 48, width: 136,
      decoration: BoxDecoration(color: p.subtle.withValues(alpha: .8),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: p.border)),
      child: Row(children: [
        SizedBox(width: 43, child: IconButton(
          tooltip: 'Remove one ${spec.label}', onPressed: () => change(-1),
          icon: const Icon(Icons.remove,size: 18),padding: EdgeInsets.zero)),
        Expanded(child: TextFormField(controller: controller,
          textAlign: TextAlign.center,
          keyboardType: TextInputType.number,
          style: TextStyle(color: p.ink,fontWeight: FontWeight.w900,fontSize: 17),
          decoration: const InputDecoration(isDense: true, filled: false,
            contentPadding: EdgeInsets.symmetric(vertical: 11),
            border: InputBorder.none,enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none),
          validator: (value) {
            final number = int.tryParse(value?.trim() ?? '');
            return number == null || number < 0 ? 'Invalid' : null;
          })),
        SizedBox(width: 43, child: IconButton(
          tooltip: 'Add one ${spec.label}', onPressed: () => change(1),
          icon: const Icon(Icons.add,size: 18),padding: EdgeInsets.zero)),
      ]));
  }

  Widget _materialRow(MaterialSpec spec) {
    final p = AppPalette.of(context);
    final rate = AnimatedBuilder(animation: c[spec.rateField]!,
      builder: (context, _) => Text('₹${c[spec.rateField]!.text} per cycle',
        maxLines: 1, overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(color: p.muted)));
    final details = Column(crossAxisAlignment: CrossAxisAlignment.start,children: [
      Text(spec.label,maxLines:1,overflow:TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.titleMedium),
      InkWell(onTap: () => _editRate(spec),
        borderRadius: BorderRadius.circular(8),
        child: Padding(padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(mainAxisSize: MainAxisSize.min,children: [
            Flexible(child: rate),const SizedBox(width: 4),
            Icon(Icons.edit_outlined,size: 14,color: p.accent),
          ]))),
    ]);
    return Padding(padding: const EdgeInsets.only(bottom: 9),
      child: Container(padding: const EdgeInsets.symmetric(horizontal: 11,vertical: 9),
        decoration: BoxDecoration(color: p.subtle.withValues(alpha: .45),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: p.border.withValues(alpha: .8))),
        child: LayoutBuilder(builder: (context, constraints) =>
          constraints.maxWidth < 270
            ? Column(crossAxisAlignment: CrossAxisAlignment.start,children: [
                details,const SizedBox(height: 5),
                Align(alignment: Alignment.centerRight,child: _quantityControl(spec)),
              ])
            : Row(children: [
                Expanded(child: details),const SizedBox(width: 7),
                _quantityControl(spec),
              ]))));
  }

  Widget _expandSection(String title,String subtitle,IconData icon,
      List<Widget> children,{bool initiallyExpanded = false}) {
    final p = AppPalette.of(context);
    return GlassCard(padding: EdgeInsets.zero,
      child: Theme(data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(initiallyExpanded: initiallyExpanded,
          leading: Icon(icon,color: p.accent),
          title: Text(title,style: Theme.of(context).textTheme.titleMedium),
          subtitle: Text(subtitle,style: Theme.of(context).textTheme.bodySmall),
          childrenPadding: const EdgeInsets.fromLTRB(18,4,18,16),
          children: children)));
  }

  Widget _cycleChoices() => Wrap(spacing: 8,runSpacing: 8,
    children: [15,20,30,if (![15,20,30].contains(days)) days]
      .map((value) => ChoiceChip(label: Text('$value days'),
        selected: days == value,
        onSelected: hasHistory ? null : (_) => setState(() => days = value)))
      .toList());

  Widget _reviewSummary() {
    final p = AppPalette.of(context);
    return GlassCard(padding: const EdgeInsets.symmetric(horizontal: 17,vertical: 13),
      child: Row(children: [
        Expanded(child: Text('Estimated first cycle',
          style: Theme.of(context).textTheme.titleMedium)),
        AnimatedBuilder(animation: estimateChanges,
          builder: (context, _) => Text(moneyLabel(estimatedFirstCycle),
            style: Theme.of(context).textTheme.titleLarge?.copyWith(color: p.accent))),
      ]));
  }

  Future<void> _reviewAndSave() async {
    if (!form.currentState!.validate()) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Check the highlighted bill details before continuing.')));
      return;
    }
    final total = estimatedFirstCycle;
    final confirm = await showModalBottomSheet<bool>(context: context,
      showDragHandle: true,isScrollControlled: true,
      builder: (sheet) => SafeArea(child: Padding(
        padding: EdgeInsets.fromLTRB(22,10,22,
          MediaQuery.viewInsetsOf(sheet).bottom + 24),
        child: Column(mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,children: [
            Text(editing ? 'Review changes' : 'Review rental bill',
              style: Theme.of(sheet).textTheme.headlineMedium),
            const SizedBox(height: 17),
            Text('Bill #${c['bill_no']!.text.trim()}  ·  ${c['name']!.text.trim()}',
              style: Theme.of(sheet).textTheme.titleMedium),
            const SizedBox(height: 7),
            Text('Starts ${dateKey(start)}  ·  $days-day cycle'),
            const SizedBox(height: 7),
            Text('Estimated first cycle: ${moneyLabel(total)}',
              style: Theme.of(sheet).textTheme.titleLarge),
            const SizedBox(height: 13),
            Text('Payments, returns and additions stay attached to the bill when editing.',
              style: Theme.of(sheet).textTheme.bodySmall),
            const SizedBox(height: 20),
            GlassPillButton(label: editing ? 'Save changes' : 'Create bill',
              icon: Icons.check,onPressed: () => Navigator.pop(sheet,true)),
          ]))));
    if (confirm == true && mounted) await save();
  }

  @override
  Widget build(BuildContext context) {
    final p = AppPalette.of(context);
    return GlassBackdrop(child: Scaffold(backgroundColor: Colors.transparent,
      appBar: AppBar(backgroundColor: Colors.transparent,
        title: editing ? Text('Edit bill #${widget.initialBill!['bill_no']}')
          : Row(children: [ClipRRect(borderRadius: BorderRadius.circular(10),
              child: Image.asset('assets/sa-traders-logo.jpg',height:32,width:32,
                fit: BoxFit.cover)),
              const SizedBox(width: 10),
              const Text('S.A Traders')]),
        actions: [Padding(padding: const EdgeInsets.only(right: 16),
          child: Center(child: Text(editing ? 'EDIT BILL' : 'NEW BILL',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: p.accent,fontWeight: FontWeight.w800,
              letterSpacing: 1.1))))]),
      bottomNavigationBar: SafeArea(top: false,
        child: Container(padding: const EdgeInsets.fromLTRB(16,8,16,12),
          decoration: BoxDecoration(color: Theme.of(context).brightness == Brightness.dark
            ? const Color(0xEE0F2633) : const Color(0xEEF3FCFD),
            border: Border(top: BorderSide(color: p.border))),
          child: GlassPillButton(
            onPressed: saving ? null : _reviewAndSave,
            icon: saving ? Icons.hourglass_top : Icons.arrow_forward,
            label: saving ? 'Saving…' : editing ? 'Review changes'
              : 'Review & create bill'))),
      body: Form(key: form,child: ListView(
        padding: const EdgeInsets.fromLTRB(16,8,16,24),children: [
          Text(editing ? 'Correct bill details' : 'New rental bill',
            style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 4),
          Text(editing ? 'Payment and material history will be preserved.'
            : 'Customer, materials and rental terms in one place.',
            style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 15),
          _section('Bill & customer','Identity and site details',
            Icons.receipt_long_outlined,[
              _space(_field('bill_no','Bill number',readOnly: editing,
                icon: Icons.tag)),
              _space(_field('name','Customer name',icon: Icons.person_outline)),
              _space(_field('mobile','Mobile number',icon: Icons.call_outlined)),
              _field('place','Site / place',icon: Icons.location_on_outlined),
              if (editing) Padding(padding: const EdgeInsets.only(top: 9),
                child: Text('Bill number stays fixed so its payment history remains linked.',
                  style: Theme.of(context).textTheme.bodySmall)),
            ],blur: true),
          const SizedBox(height: 14),
          _section('Rental period','Start date and cycle',
            Icons.calendar_month_outlined,[
              _space(GlassPillButton(secondary: true,
                icon: Icons.calendar_today_outlined,
                label: 'Start date  ·  ${dateKey(start)}',
                onPressed: hasHistory ? null : () async {
                  final date = await showDatePicker(context: context,
                    initialDate: start,firstDate: DateTime(2000),lastDate: DateTime(2100));
                  if (date != null) setState(() => start = date);
                })),
              _cycleChoices(),
              if (hasHistory) Padding(padding: const EdgeInsets.only(top: 10),
                child: Text('Date and cycle are locked after payment or material activity.',
                  style: Theme.of(context).textTheme.bodySmall)),
            ]),
          const SizedBox(height: 14),
          _section('Materials on rent','Quantity and rate per cycle',
            Icons.layers_outlined,[
              ...materialCatalog.map(_materialRow),
            ],blur: true),
          const SizedBox(height: 14),
          _expandSection('Wood sizes & rates',
            '12 Ft, 9 Ft, 6 Ft Wood and Runner',Icons.handyman_outlined,[
              ...woodCatalog.map((spec) => _space(Column(children: [
                _space(_field(spec.key,spec.label,
                  hint: 'Sizes, e.g. 8×5+10×2')),
                _field(spec.rateField,'Rate per foot (₹)',
                  number: true,decimal: true),
              ]))),
            ],initiallyExpanded: editing && woodCatalog.any((s) =>
              c[s.key]!.text.trim().isNotEmpty)),
          const SizedBox(height: 14),
          _expandSection('Transport, handling & deposit',
            'First-cycle transport and refundable advance',
            Icons.local_shipping_outlined,[
              ...['transport_up_trips','transport_up_charge','transport_down_trips',
                  'transport_down_charge','loading_charge','unloading_charge','advance_amount']
                .map((key) => _space(_field(key,const {
                  'transport_up_trips':'Up trips',
                  'transport_up_charge':'Up charge per trip (₹)',
                  'transport_down_trips':'Down trips',
                  'transport_down_charge':'Down charge per trip (₹)',
                  'loading_charge':'Loading (₹)',
                  'unloading_charge':'Unloading (₹)',
                  'advance_amount':'Advance deposit (₹)',
                }[key]!,number: true,decimal: !key.endsWith('_trips')))),
            ],initiallyExpanded: editing && [
              'transport_up_trips','transport_up_charge','transport_down_trips',
              'transport_down_charge','loading_charge','unloading_charge','advance_amount'
            ].any((key) => (double.tryParse(c[key]!.text) ?? 0) > 0)),
          const SizedBox(height: 14),
          _reviewSummary(),
        ])),
    ));
  }

  Future<void> save() async {
    if (!form.currentState!.validate()) return;
    setState(() => saving = true);
    try {
      final repo = ref.read(billingRepositoryProvider);
      final number = c['bill_no']!.text.trim();
      final original = widget.initialBill;
      final existing = editing ? await repo.get('bills', '${original!['bill_no']}') : null;
      if (editing && existing == null) throw StateError('Bill no longer exists. Reopen it.');
      if (!editing) {
        final duplicate = await repo.get('bills', number);
        final inCollection = (await repo.all('bills'))
          .any((b) => '${b['bill_no']}'.trim() == number);
        if (duplicate != null || inCollection) throw StateError('Bill #$number already exists. Choose another number.');
      }
      final now = DateTime.now().toUtc();
      final bill = <String, dynamic>{
        ...?existing, 'bill_no': number, 'name': c['name']!.text.trim(),
        'mobile': c['mobile']!.text.trim(), 'place': c['place']!.text.trim(),
        'start_date': dateKey(DateTime.utc(start.year, start.month, start.day)),
        'cycle_days': days,
        for (final key in ['advance_amount','transport_up_charge','transport_down_charge',
            'loading_charge','unloading_charge']) key: double.tryParse(c[key]!.text) ?? 0,
        for (final key in ['transport_up_trips','transport_down_trips']) key: int.tryParse(c[key]!.text) ?? 0,
        if (!editing) ...{
          'status':'open', 'payments':<Map<String,dynamic>>[],
          'payment_audit':<Map<String,dynamic>>[],
          'return_history':<Map<String,dynamic>>[],
          'additional_history':<Map<String,dynamic>>[],
          'created_date':dateKey(now), 'created_at':now.toIso8601String(),
          'created_by':ref.read(authRepositoryProvider).currentUser?.email ?? '',
        },
      };
      for (final s in materialCatalog) {
        bill[s.quantityField] = int.tryParse(c[s.quantityField]!.text) ?? 0;
        bill[s.rateField] = double.tryParse(c[s.rateField]!.text) ?? s.defaultRate;
      }
      for (final s in woodCatalog) {
        bill[s.key] = c[s.key]!.text.trim();
        bill[s.rateField] = double.tryParse(c[s.rateField]!.text) ?? s.defaultRate;
      }
      if (editing) {
        final freshHasHistory = ['payments','return_history','additional_history']
          .any((key) => (existing![key] as List? ?? const []).isNotEmpty);
        if (freshHasHistory && (bill['start_date'] != existing!['start_date'] ||
            bill['cycle_days'] != existing['cycle_days'])) {
          throw StateError('Rental dates changed while this bill was open. Reopen and try again.');
        }
        validateMaterialLedger(bill);
        final hydrated = hydrateRentalBill(bill, today:DateTime.utc(now.year,now.month,now.day));
        if ((hydrated['total_paid'] as num) > (hydrated['total_due'] as num) + .001) {
          throw StateError('The updated bill total is below payments already received.');
        }
        bill['bill_audit'] = [...historyRows(existing!['bill_audit']), {
          'action':'edited', 'at':now.toIso8601String(),
          'by':ref.read(authRepositoryProvider).currentUser?.email ?? '',
        }];
      }
      await repo.put('bills', bill);
      if (!editing && bill['mobile'] != '') {
        await repo.put('customers', {
          'mobile':bill['mobile'],
          'customer_id':'CUST${(await repo.nextSequence('customer_seq')).toString().padLeft(5,'0')}',
          'name':bill['name'], 'place':bill['place'],
          'created_at':now.toIso8601String(),
        });
      }
      ref.invalidate(billsProvider);
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not save bill: $error')));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }
}
