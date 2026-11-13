import 'package:flutter/material.dart';
import '../../../core/constants.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../domain/material_holdings.dart';

/// Spreadsheet-like read-only view. Each open rental bill remains its own row.
class MaterialHoldingsTable extends StatelessWidget {
  const MaterialHoldingsTable({super.key, required this.rows,
    required this.showCustomer, required this.onOpenBill});

  final List<MaterialHolding> rows;
  final bool showCustomer;
  final ValueChanged<String> onOpenBill;

  @override Widget build(BuildContext context) {
    final palette = AppPalette.of(context);
    final total = materialHoldingTotals(rows);
    final totalColor = Theme.of(context).brightness == Brightness.dark
      ? palette.subtle : const Color(0xFFFFF8E3);
    DataCell textCell(String text, {bool strong = false}) => DataCell(Text(text,
      maxLines: 1, style: TextStyle(fontWeight: strong ? FontWeight.w800 : FontWeight.w500,
        color: palette.ink)));
    final headers = <DataColumn>[
      if (showCustomer) const DataColumn(label: Text('CUSTOMER')),
      const DataColumn(label: Text('BILL NO')),
      const DataColumn(label: Text('START DATE')),
      const DataColumn(label: Text('LOCATION')),
      ...materialCatalog.map((spec) => DataColumn(label: Text(spec.label.toUpperCase()))),
    ];
    final body = <DataRow>[
      ...rows.map((row) => DataRow(
        onSelectChanged: (_) => onOpenBill(row.billNo),
        cells: [
          if (showCustomer) textCell(row.customerName),
          textCell('#${row.billNo}', strong: true),
          textCell(displayDate(row.bill['start_date'])),
          textCell('${row.bill['place'] ?? '—'}'),
          ...materialCatalog.map((spec) => textCell('${row.quantities[spec.key] ?? 0}')),
        ],
      )),
      DataRow(color: WidgetStatePropertyAll(totalColor), cells: [
        if (showCustomer) textCell('TOTAL ON RENT', strong: true),
        textCell(showCustomer ? '' : 'TOTAL MATERIAL PRESENT', strong: true),
        textCell(''), textCell(''),
        ...materialCatalog.map((spec) => textCell('${total[spec.key]}', strong: true)),
      ]),
    ];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Swipe sideways to see all material columns · Tap a bill to open it',
        style: Theme.of(context).textTheme.bodySmall),
      const SizedBox(height: 8),
      ClipRRect(borderRadius: BorderRadius.circular(12), child: Container(
        decoration: BoxDecoration(color: palette.surface,
          border: Border.all(color: palette.border)),
        child: SingleChildScrollView(scrollDirection: Axis.horizontal,
          child: DataTable(
            headingRowColor: WidgetStatePropertyAll(palette.subtle),
            columnSpacing: 22,
            horizontalMargin: 14,
            headingTextStyle: TextStyle(color: palette.ink,
              fontSize: 11, fontWeight: FontWeight.w800),
            dataTextStyle: TextStyle(color: palette.ink, fontSize: 13),
            columns: headers,
            rows: body,
          )),
      )),
    ]);
  }
}
