import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import 'bill_detail_screen.dart';

class BillsScreen extends ConsumerStatefulWidget {
  const BillsScreen({super.key});
  @override ConsumerState<BillsScreen> createState() => _BillsScreenState();
}

class _BillsScreenState extends ConsumerState<BillsScreen> {
  final search = TextEditingController();
  String filter = 'Open';
  @override void dispose() { search.dispose(); super.dispose(); }

  @override Widget build(BuildContext context) {
    final bills = ref.watch(hydratedBillsProvider);
    final query = search.text.toLowerCase();
    final rows = bills.where((bill) {
      final status = bill['status'] == 'closed' ? 'Closed' : 'Open';
      return (filter == 'All' || filter == status) &&
        '${bill['bill_no']} ${bill['name']} ${bill['mobile']} ${bill['place']}'
          .toLowerCase().contains(query);
    }).toList()..sort((a, b) => '${b['created_at'] ?? ''}'.compareTo('${a['created_at'] ?? ''}'));
    return Scaffold(
      appBar: AppBar(title: const Text('Rental bills'), actions: [
        IconButton(tooltip: 'Refresh bills', onPressed: () { ref.invalidate(billsProvider); },
          icon: const Icon(Icons.refresh_outlined)),
      ]),
      body: AppPageWidth(child: Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(16, 8, 16, 12), child: Column(
          crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('FIND A BILL', style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: AppPalette.of(context).accent, letterSpacing: 1.2, fontWeight: FontWeight.w800)),
            const SizedBox(height: AppSpace.xs),
            TextField(controller: search, onChanged: (_) => setState(() {}),
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(labelText: 'Search bills',
                hintText: 'Bill number, customer, mobile or site',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: search.text.isEmpty ? null : IconButton(
                  tooltip: 'Clear search', onPressed: () { search.clear(); setState(() {}); },
                  icon: const Icon(Icons.close))),
              ),
            const SizedBox(height: AppSpace.sm),
            SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
              for (final item in ['Open', 'Closed', 'All']) Padding(
                padding: const EdgeInsets.only(right: AppSpace.xs),
                child: ChoiceChip(label: Text(item), selected: filter == item,
                  onSelected: (_) => setState(() => filter = item))),
            ])),
            const SizedBox(height: AppSpace.sm),
            Text('${rows.length} ${rows.length == 1 ? 'bill' : 'bills'}',
              style: Theme.of(context).textTheme.bodySmall),
          ])),
        Expanded(child: rows.isEmpty
          ? const Center(child: EmptyState(title: 'No matching bills',
              description: 'Try another search or filter, or create a rental bill.'))
          : ListView.separated(key: ValueKey(filter),
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 110),
              itemCount: rows.length,
              itemBuilder: (context, index) => _BillRow(bill: rows[index],
                onTap: () => Navigator.push(context, MaterialPageRoute(
                  builder: (_) => BillDetailScreen(billNo: '${rows[index]['bill_no']}')))),
              separatorBuilder: (_, _) => const SizedBox(height: AppSpace.xs))),
      ])),
    );
  }
}

class _BillRow extends StatelessWidget {
  const _BillRow({required this.bill, required this.onTap});
  final Map<String, dynamic> bill;
  final VoidCallback onTap;
  @override Widget build(BuildContext context) {
    final name = '${bill['name'] ?? 'Customer'}'.trim();
    final display = name.isEmpty ? 'Customer' : name;
    final closed = bill['status'] == 'closed';
    return Semantics(button: true, label: 'Open bill ${bill['bill_no']} for $display',
      child: AppSurface(child: InkWell(onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.card), child: Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpace.xxs),
          child: Row(children: [
            CircleAvatar(radius: 23, backgroundColor: AppPalette.of(context).subtle,
              child: Text(display[0].toUpperCase(), style: TextStyle(
                color: AppPalette.of(context).accent, fontWeight: FontWeight.w900))),
            const SizedBox(width: AppSpace.sm),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(display, maxLines: 1, overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppSpace.xxs),
              Text('Bill #${bill['bill_no']} · ${bill['place'] ?? '—'}',
                maxLines: 1, overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall),
            ])),
            const SizedBox(width: AppSpace.xs),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(moneyLabel(bill['pending'] ?? 0), maxLines: 1,
                style: TextStyle(fontWeight: FontWeight.w900,
                  color: closed ? AppPalette.of(context).muted : AppPalette.of(context).danger)),
              const SizedBox(height: AppSpace.xxs),
              StatusPill(label: closed ? 'CLOSED' : 'OPEN',
                color: closed ? AppColors.gray : AppColors.green),
            ]),
          ]),
        ))),
    );
  }
}
