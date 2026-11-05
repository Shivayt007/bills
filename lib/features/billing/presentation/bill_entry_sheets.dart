import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../core/constants.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../domain/billing_calculator.dart';

class PaymentEntry {
  const PaymentEntry(this.amount, this.date, this.method, this.note, this.cycle);
  final double amount;
  final String date, method, note;
  final Map cycle;
}

class MaterialEntry {
  const MaterialEntry(this.date, this.note, this.items, this.wood);
  final String date, note;
  final Map<String, int> items;
  final Map<String, Map<String, int>> wood;
}

Future<T?> _entrySheet<T>(BuildContext context, Widget child) =>
    showModalBottomSheet<T>(context: context, isScrollControlled: true,
      useSafeArea: true, showDragHandle: true, backgroundColor: AppPalette.of(context).canvas,
      builder: (sheet) {
        final available = MediaQuery.sizeOf(sheet).height - MediaQuery.viewInsetsOf(sheet).bottom;
        return Padding(padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(sheet).bottom),
          child: SizedBox(height: math.min(available - 30, 740).clamp(300.0, 740.0).toDouble(), child: child));
      });

Future<PaymentEntry?> showPaymentEntry(BuildContext context, Map bill, List<Map> cycles,
    {Map? initial}) =>
    _entrySheet<PaymentEntry>(context, _PaymentForm(bill: bill, cycles: cycles, initial: initial));

Future<MaterialEntry?> showMaterialEntry(BuildContext context, Map bill,
    {required bool isReturn, Map? initial}) =>
    _entrySheet<MaterialEntry>(context,
      _MaterialForm(bill: bill, isReturn: isReturn, initial: initial));

class _PaymentForm extends StatefulWidget {
  const _PaymentForm({required this.bill, required this.cycles, this.initial});
  final Map bill;
  final List<Map> cycles;
  final Map? initial;
  @override State<_PaymentForm> createState() => _PaymentFormState();
}

class _PaymentFormState extends State<_PaymentForm> {
  final amount = TextEditingController(), note = TextEditingController();
  String method = 'Cash';
  Map? cycle;
  DateTime date = DateTime.now();
  String? error;
  @override void initState() {
    super.initState();
    final previous = widget.initial;
    cycle = previous == null ? (widget.cycles.isEmpty ? null : widget.cycles.last) :
      widget.cycles.where((item) => item['index'] == previous['cycle_index'] &&
        item['start_date'] == previous['cycle_start_date'] &&
        item['end_date'] == previous['cycle_end_date']).firstOrNull;
    cycle ??= widget.cycles.isEmpty ? null : widget.cycles.last;
    if (previous != null) {
      amount.text = (previous['amount'] as num?)?.toString() ?? '';
      note.text = '${previous['note'] ?? ''}';
      method = '${previous['method'] ?? 'Cash'}';
      if (!['Cash', 'UPI', 'Bank'].contains(method)) method = 'Cash';
      date = parseBillingDate(previous['payment_date'] ?? previous['date']) ?? DateTime.now();
    }
  }
  @override void dispose() { amount.dispose(); note.dispose(); super.dispose(); }

  double get remaining => (widget.bill['pending'] as num?)?.toDouble() ?? 0;
  double get cycleRemaining {
    if (cycle == null) return 0;
    final paid = (widget.bill['payments'] as List? ?? const []).where((p) =>
      p['cycle_index'] == cycle!['index'] && p['cycle_start_date'] == cycle!['start_date'] &&
      p['cycle_end_date'] == cycle!['end_date']).fold<double>(0,
        (total, p) => total + ((p['amount'] as num?)?.toDouble() ?? 0));
    return math.min(remaining, math.max(0, (cycle!['total'] as num).toDouble() - paid));
  }
  void shortcut(double fraction) {
    amount.text = (cycleRemaining * fraction).toStringAsFixed(2);
    setState(() => error = null);
  }
  Future<void> chooseDate() async {
    final picked = await showDatePicker(context: context, initialDate: date,
      firstDate: DateTime(2000), lastDate: DateTime(2100));
    if (picked != null) setState(() => date = picked);
  }
  void submit() {
    final text = amount.text.trim();
    final value = double.tryParse(text);
    if (!RegExp(r'^(?:\d+|\d*\.\d{1,2})$').hasMatch(text) || value == null ||
        value <= 0 || value > remaining + .001) {
      setState(() => error = 'Enter an amount above ₹0, up to the pending balance.');
      return;
    }
    if (cycle == null) {
      setState(() => error = 'No rental cycle is available for this bill.');
      return;
    }
    Navigator.pop(context, PaymentEntry(value, dateKey(date), method, note.text.trim(), cycle!));
  }

  @override Widget build(BuildContext context) => Column(children: [
    Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(widget.initial == null ? 'Record payment' : 'Edit payment',
          style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 4),
        Text('Bill #${widget.bill['bill_no']} · ${widget.bill['name'] ?? 'Customer'}',
          style: Theme.of(context).textTheme.bodyMedium),
      ])),
    Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(20, 0, 20, 20), children: [
      AppSurface(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('PENDING ON BILL', style: TextStyle(fontSize: 11,
          color: AppPalette.of(context).muted, fontWeight: FontWeight.w800, letterSpacing: 1)),
        const SizedBox(height: 5),
        Text(moneyLabel(remaining), style: Theme.of(context).textTheme.headlineMedium),
      ])),
      const SizedBox(height: 16),
      DropdownButtonFormField<Map>(initialValue: cycle, isExpanded: true,
        decoration: const InputDecoration(labelText: 'Rental cycle'),
        items: widget.cycles.map((item) => DropdownMenuItem<Map>(value: item,
          child: Text('Cycle #${item['index']} · ${item['start_date']}',
            overflow: TextOverflow.ellipsis))).toList(),
        onChanged: (value) => setState(() { cycle = value; error = null; })),
      const SizedBox(height: 12),
      TextField(controller: amount, keyboardType: const TextInputType.numberWithOptions(decimal: true),
        decoration: const InputDecoration(labelText: 'Amount received', prefixText: '₹ '),
        onChanged: (_) => setState(() => error = null)),
      const SizedBox(height: 5),
      Text('${moneyLabel(cycleRemaining)} available in selected cycle',
        style: Theme.of(context).textTheme.bodySmall),
      const SizedBox(height: 8),
      Wrap(spacing: 8, children: [
        ActionChip(label: const Text('Full cycle'), onPressed: cycleRemaining > 0 ? () => shortcut(1) : null),
        ActionChip(label: const Text('Half cycle'), onPressed: cycleRemaining > 0 ? () => shortcut(.5) : null),
      ]),
      const SizedBox(height: 12),
      Text('Payment method', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height: 8),
      Wrap(spacing: 8, children: ['Cash', 'UPI', 'Bank'].map((item) => ChoiceChip(
        label: Text(item), selected: method == item,
        onSelected: (_) => setState(() => method = item))).toList()),
      const SizedBox(height: 12),
      OutlinedButton.icon(onPressed: chooseDate, icon: const Icon(Icons.calendar_today_outlined),
        label: Text('Payment date · ${dateKey(date)}')),
      const SizedBox(height: 12),
      TextField(controller: note, maxLength: 500,
        decoration: const InputDecoration(labelText: 'Note (optional)')),
      if (error != null) Padding(padding: const EdgeInsets.only(bottom: 12),
        child: Text(error!, style: TextStyle(color: AppPalette.of(context).danger))),
    ])),
    SafeArea(top: false, child: Padding(padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
      child: Row(children: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        const SizedBox(width: 12),
        Expanded(child: FilledButton(onPressed: submit,
          child: Text(widget.initial == null ? 'Save payment' : 'Save changes'))),
      ]))),
  ]);
}

class _MaterialForm extends StatefulWidget {
  const _MaterialForm({required this.bill, required this.isReturn, this.initial});
  final Map bill;
  final bool isReturn;
  final Map? initial;
  @override State<_MaterialForm> createState() => _MaterialFormState();
}

class _MaterialFormState extends State<_MaterialForm> {
  final qty = <String, int>{};
  final qtyInputs = <String, TextEditingController>{};
  final wood = <String, TextEditingController>{};
  final note = TextEditingController();
  DateTime date = DateTime.now();
  String? error;
  @override void initState() {
    super.initState();
    final previous = widget.initial;
    final initialItems = previous?['items'] as Map? ?? const {};
    final initialWood = previous?['wood'] as Map? ?? const {};
    for (final spec in materialCatalog) {
      qty[spec.key] = (initialItems[spec.key] as num?)?.toInt() ?? 0;
      qtyInputs[spec.key] = TextEditingController(text: '${qty[spec.key]}');
    }
    for (final spec in woodCatalog) {
      final raw = initialWood[spec.key] as Map? ?? const {};
      wood[spec.key] = TextEditingController(text: raw.isEmpty ? '' :
        woodToText(raw.map<String, int>((key, value) =>
          MapEntry('$key', (value as num).toInt()))));
    }
    if (previous != null) {
      date = parseBillingDate(previous['date']) ?? DateTime.now();
      note.text = '${previous['note'] ?? ''}';
    }
  }
  @override void dispose() {
    for (final controller in qtyInputs.values) { controller.dispose(); }
    for (final controller in wood.values) { controller.dispose(); }
    note.dispose(); super.dispose();
  }
  Future<void> chooseDate() async {
    final start = parseBillingDate(widget.bill['start_date']) ?? DateTime(2000);
    final first = start.isAfter(DateTime(2000)) ? start : DateTime(2000);
    final initial = date.isBefore(first) ? first : date;
    final picked = await showDatePicker(context: context, initialDate: initial,
      firstDate: first, lastDate: DateTime(2100));
    if (picked != null) setState(() => date = picked);
  }
  void submit() {
    for (final spec in materialCatalog) {
      if (int.tryParse(qtyInputs[spec.key]!.text.trim()) == null) {
        setState(() => error = 'Enter a valid quantity for ${spec.label}.');
        return;
      }
    }
    if (qty.values.any((value) => value < 0)) {
      setState(() => error = 'Quantities cannot be negative.');
      return;
    }
    final woods = <String, Map<String, int>>{};
    for (final spec in woodCatalog) {
      final value = wood[spec.key]!.text.trim();
      final parsed = parseWoodSizes(value);
      if (value.isNotEmpty && parsed.isEmpty) {
        setState(() => error = 'Check the ${spec.label} sizes. Example: 8×5+10×2.');
        return;
      }
      woods[spec.key] = parsed;
    }
    if (qty.values.every((value) => value == 0) && woods.values.every((value) => value.isEmpty)) {
      setState(() => error = 'Select at least one material or wood size.');
      return;
    }
    if (widget.isReturn) {
      final balances = widget.bill['balance_qty'] as Map? ?? const {};
      for (final spec in materialCatalog) {
        if (qty[spec.key]! > ((balances[spec.key] as num?)?.toInt() ?? 0)) {
          setState(() => error = '${spec.label} exceeds the outstanding quantity.');
          return;
        }
      }
      final currentWood = widget.bill['balance_wood'] as Map? ?? const {};
      for (final spec in woodCatalog) {
        final available = currentWood[spec.key] as Map? ?? const {};
        for (final entry in woods[spec.key]!.entries) {
          if (entry.value > ((available[entry.key] as num?)?.toInt() ?? 0)) {
            setState(() => error = '${spec.label} ${entry.key} ft exceeds the outstanding pieces.');
            return;
          }
        }
      }
    }
    Navigator.pop(context, MaterialEntry(dateKey(date), note.text.trim(), Map.of(qty), woods));
  }

  @override Widget build(BuildContext context) {
    final balances = widget.bill['balance_qty'] as Map? ?? const {};
    final currentWood = widget.bill['balance_wood'] as Map? ?? const {};
    final materials = materialCatalog.where((spec) => !widget.isReturn ||
      ((balances[spec.key] as num?)?.toInt() ?? 0) > 0).toList();
    final woods = woodCatalog.where((spec) => !widget.isReturn ||
      (currentWood[spec.key] as Map? ?? const {}).isNotEmpty).toList();
    return Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(widget.initial == null
            ? (widget.isReturn ? 'Return material' : 'Add material')
            : (widget.isReturn ? 'Edit return' : 'Edit addition'),
            style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 4),
          Text('Bill #${widget.bill['bill_no']} · ${widget.bill['name'] ?? 'Customer'}',
            style: Theme.of(context).textTheme.bodyMedium),
        ])),
      Expanded(child: ListView(padding: const EdgeInsets.fromLTRB(20, 0, 20, 20), children: [
        OutlinedButton.icon(onPressed: chooseDate, icon: const Icon(Icons.calendar_today_outlined),
          label: Text('${widget.isReturn ? 'Return' : 'Addition'} date · ${dateKey(date)}')),
        const SizedBox(height: 8),
        Text('Changes apply from the next rental cycle after this date.',
          style: Theme.of(context).textTheme.bodySmall),
        const SectionTitle('Materials'),
        if (materials.isEmpty && woods.isEmpty)
          const EmptyState(title: 'Nothing is out on rent',
            description: 'There are no materials available to return.'),
        ...materials.map((spec) => Padding(padding: const EdgeInsets.only(bottom: 8),
          child: AppSurface(child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(spec.label, style: Theme.of(context).textTheme.titleMedium),
              if (widget.isReturn) Text('${balances[spec.key]} currently out',
                style: Theme.of(context).textTheme.bodySmall),
            ])),
            IconButton(tooltip: 'Remove one ${spec.label}',
              onPressed: qty[spec.key] == 0 ? null : () => setState(() {
                qty[spec.key] = qty[spec.key]! - 1;
                qtyInputs[spec.key]!.text = '${qty[spec.key]}';
              }),
              icon: const Icon(Icons.remove_circle_outline)),
            SizedBox(width: 52, child: TextField(
              controller: qtyInputs[spec.key],
              keyboardType: TextInputType.number,
              textAlign: TextAlign.center,
              onTap: () => qtyInputs[spec.key]!.selection = TextSelection(
                baseOffset: 0, extentOffset: qtyInputs[spec.key]!.text.length),
              decoration: const InputDecoration(isDense: true,
                contentPadding: EdgeInsets.symmetric(vertical: 8, horizontal: 4)),
              onChanged: (value) => setState(() {
                qty[spec.key] = int.tryParse(value) ?? 0;
                error = null;
              }),
            )),
            IconButton(tooltip: 'Add one ${spec.label}',
              onPressed: widget.isReturn && qty[spec.key]! >= (balances[spec.key] as num).toInt()
                ? null : () => setState(() {
                    qty[spec.key] = qty[spec.key]! + 1;
                    qtyInputs[spec.key]!.text = '${qty[spec.key]}';
                  }),
              icon: Icon(Icons.add_circle_outline, color: AppPalette.of(context).accent)),
          ])))),
        if (woods.isNotEmpty) const SectionTitle('Wood by size'),
        ...woods.map((spec) => Padding(padding: const EdgeInsets.only(bottom: 12),
          child: TextField(controller: wood[spec.key],
            decoration: InputDecoration(labelText: spec.label,
              hintText: '8×5+10×2',
              helperText: widget.isReturn
                ? 'Out: ${woodToText(Map<String,int>.from((currentWood[spec.key] as Map).map(
                    (key, value) => MapEntry('$key', (value as num).toInt()))))}'
                : 'Enter length × pieces, separated by +'),
            onChanged: (_) => setState(() => error = null)))),
        const SectionTitle('Details'),
        TextField(controller: note, maxLines: 2,
          decoration: const InputDecoration(labelText: 'Note (optional)'),
          onChanged: (_) => setState(() => error = null)),
        if (error != null) Padding(padding: const EdgeInsets.only(top: 12),
          child: Text(error!, style: TextStyle(color: AppPalette.of(context).danger))),
      ])),
      SafeArea(top: false, child: Padding(padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
        child: Row(children: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          const SizedBox(width: 12),
          Expanded(child: FilledButton(onPressed: submit,
            child: Text(widget.initial != null ? 'Save changes' :
              (widget.isReturn ? 'Save return' : 'Add material')))),
        ]))),
    ]);
  }
}
