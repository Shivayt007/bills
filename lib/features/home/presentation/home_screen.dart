import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../billing/presentation/bill_detail_screen.dart';
import '../../notifications/data/reminder_service.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key, required this.onNavigate});
  final ValueChanged<int> onNavigate;

  @override Widget build(BuildContext context, WidgetRef ref) {
    ref.listen(billsProvider, (previous, next) {
      if (next.hasValue) ReminderService.refreshFromCloud();
    });
    final bills = ref.watch(hydratedBillsProvider);
    final active = bills.where((b) => b['status'] != 'closed').toList();
    final due = active.fold<double>(0, (v, b) => v + (b['total_due'] as num).toDouble());
    final paid = active.fold<double>(0, (v, b) => v + (b['total_paid'] as num).toDouble());
    final pending = active.fold<double>(0, (v, b) => v + (b['pending'] as num).toDouble());
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    return Scaffold(
      appBar: AppBar(
        title: Row(children: [
          ClipRRect(borderRadius: BorderRadius.circular(10),
            child: Image.asset('assets/sa-traders-logo.jpg', height: 38, width: 38, fit: BoxFit.cover)),
          const SizedBox(width: 10),
          const Flexible(child: Text('S.A Traders', maxLines: 1, overflow: TextOverflow.ellipsis)),
        ]),
        actions: [IconButton(tooltip: 'Notifications', onPressed: () => onNavigate(2),
          icon: const Icon(Icons.notifications_active_outlined))],
      ),
      body: AppPageWidth(child: RefreshIndicator(
        onRefresh: () async { await ref.refresh(billsProvider.future); },
        child: ListView(key: const PageStorageKey('dashboard-scroll'),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 110),
          children: [
            Text('YOUR BUSINESS TODAY', style: Theme.of(context).textTheme.labelMedium?.copyWith(
              color: AppColors.teal, letterSpacing: 1.5, fontWeight: FontWeight.w800)),
            const SizedBox(height: AppSpace.xs),
            Text('Rental overview', style: Theme.of(context).textTheme.headlineLarge),
            const SizedBox(height: AppSpace.md),
            _BalanceHero(pending: pending, activeCount: active.length,
              reduceMotion: reduceMotion, onViewBills: () => onNavigate(1)),
            const SizedBox(height: AppSpace.sm),
            LayoutBuilder(builder: (context, constraints) {
              final single = constraints.maxWidth < 350;
              final width = single ? constraints.maxWidth : (constraints.maxWidth - AppSpace.sm) / 2;
              return Wrap(spacing: AppSpace.sm, runSpacing: AppSpace.sm, children: [
                SizedBox(width: width, child: StatCard(label: 'Total rental charges',
                  value: moneyLabel(due), icon: Icons.receipt_long_outlined)),
                SizedBox(width: width, child: StatCard(label: 'Payments collected',
                  value: moneyLabel(paid), icon: Icons.check_circle_outline, color: AppColors.green)),
              ]);
            }),
            const SizedBox(height: AppSpace.lg),
            Wrap(spacing: AppSpace.xs, runSpacing: AppSpace.xs, children: [
              OutlinedButton.icon(onPressed: () => onNavigate(1),
                icon: const Icon(Icons.receipt_long_outlined), label: const Text('All bills')),
              OutlinedButton.icon(onPressed: () => onNavigate(2),
                icon: const Icon(Icons.notifications_outlined), label: const Text('Due reminders')),
            ]),
            SectionTitle('Active bills', trailing: TextButton(
              onPressed: () => onNavigate(1), child: const Text('See all'))),
            if (active.isEmpty)
              const AppSurface(child: EmptyState(title: 'No active bills yet',
                description: 'Create a rental bill to start tracking payments and cycles.'))
            else
              ...active.take(6).map((bill) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpace.xs),
                child: _BillTile(bill: bill, onTap: () => Navigator.push(context,
                  MaterialPageRoute(builder: (_) => BillDetailScreen(billNo: '${bill['bill_no']}')))))),
          ],
        ),
      )),
    );
  }
}

class _BalanceHero extends StatelessWidget {
  const _BalanceHero({required this.pending, required this.activeCount,
    required this.reduceMotion, required this.onViewBills});
  final double pending;
  final int activeCount;
  final bool reduceMotion;
  final VoidCallback onViewBills;

  @override Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(AppSpace.lg),
    decoration: BoxDecoration(
      gradient: const LinearGradient(colors: [AppColors.teal, AppColors.navy],
        begin: Alignment.topLeft, end: Alignment.bottomRight),
      borderRadius: BorderRadius.circular(AppRadius.hero), boxShadow: AppShadows.card),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('PAYMENTS PENDING', style: TextStyle(color: Color(0xFFE2F2F6),
        fontSize: 12, letterSpacing: 1.2, fontWeight: FontWeight.w800)),
      const SizedBox(height: AppSpace.sm),
      AnimatedSwitcher(duration: reduceMotion ? Duration.zero : AppMotion.standard,
        child: FittedBox(key: ValueKey(pending), fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(moneyLabel(pending), maxLines: 1,
            style: const TextStyle(color: Colors.white, fontSize: 38, fontWeight: FontWeight.w900)))),
      const SizedBox(height: AppSpace.lg),
      Row(children: [
        const Icon(Icons.inventory_2_outlined, size: 18, color: Colors.white),
        const SizedBox(width: 7),
        Expanded(child: Text('$activeCount active rental bills',
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700))),
        IconButton(onPressed: onViewBills, tooltip: 'View active bills',
          icon: const Icon(Icons.arrow_forward, color: Colors.white)),
      ]),
    ]),
  );
}

class _BillTile extends StatelessWidget {
  const _BillTile({required this.bill, required this.onTap});
  final Map<String, dynamic> bill;
  final VoidCallback onTap;
  @override Widget build(BuildContext context) {
    final name = '${bill['name'] ?? 'Customer'}'.trim();
    final display = name.isEmpty ? 'Customer' : name;
    return Semantics(button: true, label: 'Open bill ${bill['bill_no']} for $display',
      child: AppSurface(child: InkWell(
        onTap: onTap, borderRadius: BorderRadius.circular(AppRadius.card),
        child: Padding(padding: const EdgeInsets.symmetric(vertical: 2), child: Row(children: [
          CircleAvatar(backgroundColor: AppColors.surfaceTint,
            child: Text(display[0].toUpperCase(), style: const TextStyle(
              color: AppColors.teal, fontWeight: FontWeight.w800))),
          const SizedBox(width: AppSpace.sm),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(display, maxLines: 1, overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleMedium),
            Text('Bill #${bill['bill_no']} · ${bill['mobile'] ?? ''}',
              maxLines: 1, overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall),
          ])),
          const SizedBox(width: AppSpace.xs),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(moneyLabel(bill['pending'] ?? 0), maxLines: 1,
              style: const TextStyle(fontWeight: FontWeight.w900, color: AppColors.red)),
            const SizedBox(height: AppSpace.xxs),
            const StatusPill(label: 'PENDING', color: AppColors.red),
          ]),
        ]))),
      ));
  }
}
