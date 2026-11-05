import 'package:flutter/material.dart';
import 'package:notification_listener_service/notification_listener_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/glass_design.dart';
import '../../../core/widgets/common.dart';
import '../../admin/presentation/admin_screen.dart';
import '../../billing/presentation/bill_form_screen.dart';
import '../../billing/presentation/bills_screen.dart';
import '../../custom_bills/presentation/custom_bill_screen.dart';
import '../../inventory/presentation/inventory_screen.dart';
import '../../notifications/presentation/notifications_screen.dart';
import '../../notifications/data/reminder_service.dart';
import '../../reports/presentation/reports_screen.dart';
import '../../slips/presentation/slips_screen.dart';
import 'home_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int index = 0;
  void select(int destination) => setState(() => index = destination);

  @override Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 840;
    final screens = [HomeScreen(onNavigate: select), const BillsScreen(),
      const ReportsScreen(), const MoreScreen()];
    final pages = IndexedStack(index: index, children: screens);
    final create = index < 2 ? GlassPillButton(onPressed: () => _chooseCreate(context),
      icon: Icons.add, label: 'New bill') : null;
    if (wide) {
      return Scaffold(body: SafeArea(child: Row(children: [
        NavigationRail(selectedIndex: index, onDestinationSelected: select,
          labelType: NavigationRailLabelType.all, backgroundColor: AppPalette.of(context).surface,
          destinations: const [
            NavigationRailDestination(icon: Icon(Icons.home_outlined),
              selectedIcon: Icon(Icons.home), label: Text('Home')),
            NavigationRailDestination(icon: Icon(Icons.receipt_long_outlined),
              selectedIcon: Icon(Icons.receipt_long), label: Text('Bills')),
            NavigationRailDestination(icon: Icon(Icons.bar_chart_outlined),
              selectedIcon: Icon(Icons.bar_chart), label: Text('Reports')),
            NavigationRailDestination(icon: Icon(Icons.grid_view_outlined),
              selectedIcon: Icon(Icons.grid_view), label: Text('More')),
          ]),
        VerticalDivider(width: 1, color: AppPalette.of(context).border),
        Expanded(child: Scaffold(body: pages, floatingActionButton: create)),
      ])));
    }
    return Scaffold(body: pages, floatingActionButton: create,
      bottomNavigationBar: GlassBottomNavigation(index: index, onSelected: select));
  }
}

Future<void> _chooseCreate(BuildContext context) async {
  final type = await showModalBottomSheet<String>(context: context,
    showDragHandle: true, builder: (sheet) => SafeArea(child: Padding(
      padding: const EdgeInsets.only(bottom: AppSpace.md),
      child: Wrap(children: [
        ListTile(leading: const Icon(Icons.construction_outlined),
          title: const Text('Rental bill'), subtitle: const Text('Cycle based material rent'),
          onTap: () => Navigator.pop(sheet, 'rental')),
        ListTile(leading: const Icon(Icons.shopping_bag_outlined),
          title: const Text('Custom shop bill'), subtitle: const Text('Materials and one time charges'),
          onTap: () => Navigator.pop(sheet, 'custom')),
      ]))));
  if (type == null || !context.mounted) return;
  await Navigator.push(context, MaterialPageRoute(builder: (_) =>
    type == 'rental' ? const BillFormScreen() : const CustomBillFormScreen()));
}

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});
  @override Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Workspace')),
    body: AppPageWidth(child: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
      children: [
        Text('TOOLS & RECORDS', style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: AppPalette.of(context).accent, letterSpacing: 1.3, fontWeight: FontWeight.w800)),
        const SizedBox(height: AppSpace.xs),
        Text('Run the business', style: Theme.of(context).textTheme.headlineMedium),
        const SectionTitle('Billing & finance'),
        _tile(context, 'Custom bills', 'One time shop invoices', Icons.shopping_bag_outlined,
          () => _open(context, const CustomBillScreen())),
        _tile(context, 'Reports', 'Collections and material rent', Icons.query_stats,
          () => _open(context, const ReportsScreen())),
        _tile(context, 'Notifications', 'Overdue, due today and upcoming bills',
          Icons.notifications_outlined, () => _open(context, const NotificationsScreen())),
        const SectionTitle('Operations'),
        _tile(context, 'Inventory', 'Stock and material on rent', Icons.inventory_2_outlined,
          () => _open(context, const InventoryScreen())),
        _tile(context, 'Delivery slips & challans', 'Track material movement',
          Icons.local_shipping_outlined, () => _open(context, const SlipsScreen())),
        const SectionTitle('Reminders & payments'),
        const _ReminderControls(),
        const SectionTitle('Business'),
        const _ThemeSelector(),
        _tile(context, 'Administration', 'Terms, backup and account',
          Icons.admin_panel_settings_outlined, () => _open(context, const AdminScreen())),
        const SizedBox(height: AppSpace.lg),
        Text('S.A Traders · Scaffolding & centring rentals', textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall),
      ])));

  void _open(BuildContext context, Widget screen) => Navigator.push(context,
    MaterialPageRoute(builder: (_) => screen));

  Widget _tile(BuildContext context, String title, String subtitle,
    IconData icon, VoidCallback onTap) => Padding(
      padding: const EdgeInsets.only(bottom: AppSpace.xs),
      child: AppSurface(child: InkWell(onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.card),
        child: Row(children: [
          CircleAvatar(backgroundColor: AppPalette.of(context).subtle,
            child: Icon(icon, color: AppPalette.of(context).accent)),
          const SizedBox(width: AppSpace.sm),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: AppSpace.xxs),
            Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
          ])),
          Icon(Icons.chevron_right, color: AppPalette.of(context).muted),
        ]))));
}

class _ReminderControls extends StatefulWidget {
  const _ReminderControls();
  @override State<_ReminderControls> createState() => _ReminderControlsState();
}
class _ReminderControlsState extends State<_ReminderControls> {
  bool loading = true, enabled = false, paymentAccess = false;
  String? error;
  @override void initState() {
    super.initState();
    _load();
  }
  Future<void> _load() async {
    try {
      final results = await Future.wait([
        ReminderService.remindersEnabled(),
        ReminderService.paymentPermission(),
      ]);
      if (mounted) setState(() {
        enabled = results[0];
        paymentAccess = results[1];
        loading = false;
        error = null;
      });
    } catch (cause) {
      if (mounted) setState(() {
        loading = false;
        error = 'Could not read reminder settings: $cause';
      });
    }
  }
  Future<void> _setReminder(bool value) async {
    setState(() => loading = true);
    try {
      await ReminderService.setReminders(value);
      await _load();
    } catch (cause) {
      if (mounted) setState(() {
        loading = false;
        error = 'Could not update reminders: $cause';
      });
    }
  }
  Future<void> _manageAccess() async {
    try {
      await NotificationListenerService.requestPermission();
      await _load();
    } catch (cause) {
      if (mounted) setState(() => error = 'Could not open notification access: $cause');
    }
  }
  @override Widget build(BuildContext context) => Column(children: [
    Card(child: SwitchListTile(
      title: const Text('Daily reminders'),
      subtitle: const Text('Send a local notification for pending rental bills each day'),
      secondary: const Icon(Icons.alarm_outlined),
      value: enabled, onChanged: loading ? null : _setReminder)),
    const SizedBox(height: 8),
    Card(child: ListTile(
      title: const Text('Payment detection'),
      subtitle: Text(paymentAccess
        ? 'Notification access enabled · review detected receipts in Alerts'
        : 'Allow access to bank and UPI payment notifications'),
      leading: const Icon(Icons.account_balance_wallet_outlined),
      trailing: OutlinedButton(onPressed: loading ? null : _manageAccess,
        child: Text(paymentAccess ? 'Manage' : 'Enable')))),
    if (error != null) Padding(padding: const EdgeInsets.all(8),
      child: Text(error!, style: TextStyle(color: AppPalette.of(context).danger))),
  ]);
}

class _ThemeSelector extends StatelessWidget {
  const _ThemeSelector();
  @override Widget build(BuildContext context) => AppSurface(
    child: Row(children: [
      Icon(Icons.brightness_6_outlined, color: AppPalette.of(context).accent),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Appearance', style: Theme.of(context).textTheme.titleMedium),
        Text('Choose system, light or dark', style: Theme.of(context).textTheme.bodySmall),
      ])),
      ValueListenableBuilder<ThemeMode>(valueListenable: appThemeController,
        builder: (context, mode, _) => DropdownButton<ThemeMode>(
          value: mode, underline: const SizedBox.shrink(),
          items: const [
            DropdownMenuItem(value: ThemeMode.system, child: Text('System')),
            DropdownMenuItem(value: ThemeMode.light, child: Text('Light')),
            DropdownMenuItem(value: ThemeMode.dark, child: Text('Dark')),
          ],
          onChanged: (next) { if (next != null) appThemeController.setMode(next); },
        )),
    ]));
}
