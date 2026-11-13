import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../../core/constants.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../billing/domain/grouped_returns.dart';
import '../domain/material_holdings.dart';

/// Opens from Bill Details so the wide table never crowds the bill itself.
/// The paper sits inside both scroll views but outside their clip in the
/// RepaintBoundary: the shared PNG includes every column and every row.
class CustomerMaterialStatementScreen extends ConsumerStatefulWidget {
  const CustomerMaterialStatementScreen({super.key, required this.customerBill});

  final Map<String, dynamic> customerBill;

  @override
  ConsumerState<CustomerMaterialStatementScreen> createState() =>
      _CustomerMaterialStatementScreenState();
}

class _CustomerMaterialStatementScreenState
    extends ConsumerState<CustomerMaterialStatementScreen> {
  final capture = GlobalKey();
  bool sharing = false;

  Future<void> shareImage() async {
    setState(() => sharing = true);
    try {
      await WidgetsBinding.instance.endOfFrame;
      final boundary =
          capture.currentContext!.findRenderObject() as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 2);
      try {
        final png = await image.toByteData(format: ui.ImageByteFormat.png);
        if (png == null) throw StateError('Could not capture material statement.');
        final name = '${widget.customerBill['name'] ?? 'Customer'}'
            .replaceAll(RegExp(r'[^a-zA-Z0-9_-]+'), '-');
        await SharePlus.instance.share(ShareParams(files: [
          XFile.fromData(png.buffer.asUint8List(),
              mimeType: 'image/png',
              name: 'SA-Traders-Materials-$name.png'),
        ]));
      } finally {
        image.dispose();
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not share image: $error')));
      }
    } finally {
      if (mounted) setState(() => sharing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final source = ref.watch(billsProvider);
    if (source.isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (source.hasError) {
      return Scaffold(appBar: AppBar(title: const Text('Customer materials')),
        body: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('Could not load customer bills.'),
          TextButton(onPressed: () => ref.invalidate(billsProvider),
            child: const Text('Retry')),
        ])));
    }
    final all = ref.watch(hydratedBillsProvider);
    final rows = materialHoldings([
      ...all,
      if (!all.any((bill) =>
          '${bill['bill_no']}' == '${widget.customerBill['bill_no']}'))
        widget.customerBill,
    ]).where((row) => sameRentalCustomer(row.bill, widget.customerBill)).toList();
    final customer = '${widget.customerBill['name'] ?? 'Customer'}'.trim();
    final phone = '${widget.customerBill['mobile'] ?? ''}'.trim();

    return Scaffold(
      appBar: AppBar(title: const Text('Customer materials')),
      body: Column(children: [
        Expanded(child: SingleChildScrollView(
          child: Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(customer, style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 4),
              Text('${rows.length} open bills · Current material balance',
                  style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 14),
              const Text('Swipe sideways to preview the full statement. '
                  'The shared image includes every column.',
                  style: TextStyle(fontSize: 12)),
              const SizedBox(height: 12),
              SingleChildScrollView(scrollDirection: Axis.horizontal,
                child: RepaintBoundary(key: capture,
                  child: MaterialStatementPaper(
                    customer: customer, phone: phone, rows: rows,
                    asOf: DateTime.now()))),
            ])))),
        SafeArea(top: false, child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
          child: SizedBox(width: double.infinity,
            child: FilledButton.icon(
              onPressed: sharing ? null : shareImage,
              icon: Icon(sharing ? Icons.hourglass_top : Icons.ios_share_outlined),
              label: Text(sharing ? 'Preparing image…' : 'Share as photo'))))),
      ]),
    );
  }
}

/// White, invoice-like document independent of the app's light/dark theme.
/// Only the six non-wood material counts are part of this statement.
class MaterialStatementPaper extends StatelessWidget {
  const MaterialStatementPaper({super.key, required this.customer,
      required this.phone, required this.rows, required this.asOf});

  final String customer, phone;
  final List<MaterialHolding> rows;
  final DateTime asOf;

  static const widths = <double>[104, 140, 208, 95, 95, 90, 115, 90, 105];
  static const paperWidth = 1100.0;
  static const ink = Color(0xFF15232C);
  static const muted = Color(0xFF566977);
  static const line = Color(0xFFDDE7EB);
  static const tint = Color(0xFFEDF5F8);

  Widget _cell(String text, double width, {bool bold = false,
      Alignment alignment = Alignment.centerLeft, Color color = ink}) =>
    SizedBox(width: width, child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 13),
      child: Align(alignment: alignment, child: Text(text,
        maxLines: 2, overflow: TextOverflow.ellipsis,
        style: TextStyle(color: color, fontSize: 13,
          fontWeight: bold ? FontWeight.w800 : FontWeight.w500)))));

  Widget _row(List<String> values, {bool header = false, bool alternate = false}) =>
    Container(
      decoration: BoxDecoration(
        color: header ? tint : alternate ? const Color(0xFFF8FBFC) : Colors.white,
        border: const Border(bottom: BorderSide(color: line))),
      child: Row(children: [
        for (var i = 0; i < widths.length; i++)
          _cell(values[i], widths[i], bold: header || i == 0,
            alignment: i >= 3 ? Alignment.center : Alignment.centerLeft,
            color: header ? AppColors.teal : ink),
      ]),
    );

  @override
  Widget build(BuildContext context) {
    final totals = materialHoldingTotals(rows);
    return Container(
      width: paperWidth,
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(color: Colors.white,
        border: Border.all(color: line),
        boxShadow: const [BoxShadow(color: Color(0x160D3447),
          blurRadius: 18, offset: Offset(0, 5))]),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(width: 58, height: 58, alignment: Alignment.center,
            decoration: BoxDecoration(color: AppColors.teal,
              borderRadius: BorderRadius.circular(12)),
            child: const Text('SA', style: TextStyle(color: Colors.white,
              fontSize: 22, fontWeight: FontWeight.w900))),
          const SizedBox(width: 14),
          const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(businessName, style: TextStyle(color: ink, fontSize: 25,
                fontWeight: FontWeight.w900)),
              Text('SCAFFOLDING & CONSTRUCTION MATERIALS',
                style: TextStyle(color: AppColors.teal, fontSize: 11,
                  fontWeight: FontWeight.w800, letterSpacing: 1)),
              SizedBox(height: 5),
              Text('$businessAddress · Ph: $businessPhones',
                style: TextStyle(color: muted, fontSize: 12)),
            ])),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            const Text('MATERIAL STATEMENT', style: TextStyle(
              color: AppColors.teal, fontWeight: FontWeight.w900,
              letterSpacing: 1.1, fontSize: 13)),
            const SizedBox(height: 8),
            Text('As of ${displayDate(asOf)}',
              style: const TextStyle(color: muted, fontSize: 12)),
          ]),
        ]),
        const SizedBox(height: 20),
        Container(height: 3, color: AppColors.teal),
        const SizedBox(height: 16),
        Row(children: [
          const Text('CUSTOMER', style: TextStyle(color: muted,
            fontSize: 11, letterSpacing: 1, fontWeight: FontWeight.w800)),
          const SizedBox(width: 12),
          Text(customer, style: const TextStyle(color: ink,
            fontSize: 17, fontWeight: FontWeight.w800)),
          if (phone.isNotEmpty) ...[
            const SizedBox(width: 24),
            Text('Mobile: $phone', style: const TextStyle(color: muted)),
          ],
          const Spacer(),
          Text('${rows.length} open bills', style: const TextStyle(
            color: AppColors.teal, fontWeight: FontWeight.w700)),
        ]),
        const SizedBox(height: 18),
        _row(['BILL NO', 'START DATE', 'LOCATION',
          ...materialCatalog.map((spec) => spec.label.toUpperCase())], header: true),
        for (var i = 0; i < rows.length; i++)
          _row(['#${rows[i].billNo}', displayDate(rows[i].bill['start_date']),
            '${rows[i].bill['place'] ?? '—'}',
            ...materialCatalog.map((spec) =>
              '${rows[i].quantities[spec.key] ?? 0}')], alternate: i.isOdd),
        if (rows.isEmpty)
          const Padding(padding: EdgeInsets.all(16),
            child: Text('No open rental bills for this customer.',
              style: TextStyle(color: muted))),
        Container(color: const Color(0xFFDDEFF4),
          child: Row(children: [
            SizedBox(width: widths[0] + widths[1] + widths[2],
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 10, vertical: 16),
                child: Text('TOTAL MATERIAL PRESENT', style: TextStyle(
                  color: ink, fontSize: 14, fontWeight: FontWeight.w900)))),
            for (var i = 0; i < materialCatalog.length; i++)
              _cell('${totals[materialCatalog[i].key]}', widths[i + 3],
                bold: true, alignment: Alignment.center),
          ])),
        const SizedBox(height: 20),
        const Text('Current quantity held across the open rental bills above. '
          'Wood materials are excluded from this statement.',
          style: TextStyle(color: muted, fontSize: 12)),
      ]),
    );
  }
}
