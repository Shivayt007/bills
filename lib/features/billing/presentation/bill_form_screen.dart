import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
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
      bool decimal = false, String? hint, bool readOnly = false}) =>
    TextFormField(
      controller: c[key], readOnly: readOnly,
      keyboardType: number ? TextInputType.numberWithOptions(decimal: decimal) : TextInputType.text,
      decoration: InputDecoration(labelText: label, hintText: hint),
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

  Widget _section(String title, String subtitle, IconData icon, List<Widget> children) {
    final p = AppPalette.of(context);
    return Card(child: Padding(padding: const EdgeInsets.all(18),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [Container(padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: p.subtle, borderRadius: BorderRadius.circular(12)),
          child: Icon(icon, color: p.accent)), const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
          ]))]),
        const SizedBox(height: 18), ...children,
      ])));
  }

  Widget _spaced(Widget child) => Padding(padding: const EdgeInsets.only(bottom: 14), child: child);

  @override
  Widget build(BuildContext context) {
    final p = AppPalette.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(editing ? 'Edit bill #${widget.initialBill!['bill_no']}' : 'New rental bill')),
      bottomNavigationBar: SafeArea(top: false, child: Container(
        padding: const EdgeInsets.fromLTRB(18, 10, 18, 12),
        decoration: BoxDecoration(color: p.surface,
          border: Border(top: BorderSide(color: p.border))),
        child: FilledButton.icon(onPressed: saving ? null : save,
          icon: saving ? const SizedBox(width: 18, height: 18,
            child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.check),
          label: Text(saving ? 'Saving…' : editing ? 'Save changes' : 'Create bill')))),
      body: Form(key: form, child: ListView(padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
        children: [
          Text(editing ? 'Correct bill details' : 'Create a rental bill',
            style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 5),
          Text(editing ? 'Payment and material history will be preserved.'
            : 'Enter the customer and rental details below.',
            style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 22),
          _section('Bill & customer', 'Identity and site', Icons.receipt_long_outlined, [
            _spaced(_field('bill_no', 'Bill number', readOnly: editing)),
            if (editing) _spaced(Text('The bill number stays fixed so payments and old invoices remain linked.',
              style: Theme.of(context).textTheme.bodySmall)),
            _spaced(_field('name', 'Customer name')),
            _spaced(_field('mobile', 'Mobile number')),
            _field('place', 'Site / place'),
          ]),
          const SizedBox(height: 14),
          _section('Rental period', 'Start date and cycle', Icons.calendar_month_outlined, [
            _spaced(OutlinedButton.icon(
              onPressed: hasHistory ? null : () async {
                final date = await showDatePicker(context: context,
                  initialDate: start, firstDate: DateTime(2000), lastDate: DateTime(2100));
                if (date != null) setState(() => start = date);
              },
              icon: const Icon(Icons.calendar_today_outlined),
              label: Text('Start date  ·  ${dateKey(start)}'))),
            DropdownButtonFormField<int>(initialValue: [15,20,30].contains(days) ? days : null,
              decoration: const InputDecoration(labelText: 'Rental cycle length'),
              items: [15,20,30, if (![15,20,30].contains(days)) days]
                .map((d) => DropdownMenuItem(value: d, child: Text('$d days'))).toList(),
              onChanged: hasHistory ? null : (v) => setState(() => days = v ?? days)),
            if (hasHistory) Padding(padding: const EdgeInsets.only(top: 10),
              child: Text('Dates and cycle length are locked after a payment or material entry to preserve its cycle.',
                style: Theme.of(context).textTheme.bodySmall)),
          ]),
          const SizedBox(height: 14),
          _section('Materials', 'Quantity and rate per cycle', Icons.inventory_2_outlined, [
            ...materialCatalog.map((s) => _spaced(LayoutBuilder(builder: (context, constraints) =>
              constraints.maxWidth < 290
                ? Column(children: [_spaced(_field(s.quantityField, '${s.label} quantity', number: true)),
                    _field(s.rateField, 'Rate (₹)', number: true, decimal: true)])
                : Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Expanded(flex: 3, child: _field(s.quantityField, '${s.label} quantity', number: true)),
                    const SizedBox(width: 10),
                    Expanded(flex: 2, child: _field(s.rateField, 'Rate (₹)', number: true, decimal: true)),
                  ])))),
          ]),
          const SizedBox(height: 14),
          _section('Wood', 'Sizes and per-foot rate', Icons.handyman_outlined, [
            ...woodCatalog.map((s) => _spaced(Column(children: [
              _spaced(_field(s.key, s.label, hint: 'Sizes, e.g. 8×5+10×2')),
              _field(s.rateField, 'Rate per foot (₹)', number: true, decimal: true),
            ]))),
          ]),
          const SizedBox(height: 14),
          _section('Transport & deposit', 'Transport is billed in the first cycle only',
            Icons.local_shipping_outlined, [
              ...['transport_up_trips','transport_up_charge','transport_down_trips',
                  'transport_down_charge','loading_charge','unloading_charge','advance_amount']
                .map((key) => _spaced(_field(key, const {
                  'transport_up_trips':'Up trips', 'transport_up_charge':'Up charge per trip (₹)',
                  'transport_down_trips':'Down trips', 'transport_down_charge':'Down charge per trip (₹)',
                  'loading_charge':'Loading (₹)', 'unloading_charge':'Unloading (₹)',
                  'advance_amount':'Advance deposit (₹)',
                }[key]!, number: true, decimal: !key.endsWith('_trips')))),
            ]),
        ])),
    );
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
