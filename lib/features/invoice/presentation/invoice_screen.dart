import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';
import '../../../core/constants.dart';
import '../../../core/widgets/common.dart';
import '../../billing/domain/billing_calculator.dart';

const invoiceNavy = Color(0xFF101827);
const invoiceGold = Color(0xFFC48A22);
const invoicePale = Color(0xFFF0F3F8);
const invoiceWarm = Color(0xFFFFF2C8);
const invoiceMuted = Color(0xFF536071);

class InvoiceData {
  InvoiceData(this.bill) {
    cycles = (bill['cycles'] as List? ?? const []).cast<Map>();
    payments = (bill['payments'] as List? ?? const []).cast<Map>();
    final last = cycles.isEmpty ? null : cycles.last;
    final snap = last == null ? snapshotForCycle(bill, 1) :
      {'qty': last['snapshot_qty'], 'wood': last['snapshot_wood']};
    final quantities = (snap['qty'] as Map).map<String, int>(
      (key, value) => MapEntry('$key', (value as num).toInt()));
    final wood = (snap['wood'] as Map).map<String, Map<String, int>>(
      (key, value) => MapEntry('$key', (value as Map).map<String, int>(
        (size, count) => MapEntry('$size', (count as num).toInt()))));
    rent = calculateRent(quantities, wood, bill);
    lines = [
      ...rent.materialLines.where((line) => (line['qty'] as int) > 0)
        .map((line) => [line['label'].toString(), line['qty'].toString(),
          moneyLabel(line['amount'] as num)]),
      ...rent.woodLines.where((line) => (line['total_feet'] as num) > 0)
        .map((line) => [line['label'].toString(),
          line['total_feet'].toString() + ' ft', moneyLabel(line['amount'] as num)]),
    ];
  }
  final Map<String, dynamic> bill;
  late final List<Map> cycles, payments;
  late final RentBreakdown rent;
  late final List<List<String>> lines;
  String get number => (bill['bill_no'] ?? '—').toString();
  num get total => (bill['total_due'] as num?) ?? cycles.fold<num>(0,
    (sum, c) => sum + ((c['total'] as num?) ?? 0));
  num get paid => (bill['total_paid'] as num?) ?? payments.fold<num>(0,
    (sum, p) => sum + ((p['amount'] as num?) ?? 0));
  num get pending => (bill['pending'] as num?) ?? (total - paid).clamp(0, double.infinity);
  num get advance => (bill['advance_locked'] as num?) ?? (bill['advance_amount'] as num?) ?? 0;
  List<List<String>> get cycleRows => cycles.map((c) => [
    c['index'].toString(), c['start_date'].toString() + ' – ' + c['end_date'].toString(),
    moneyLabel((c['rent'] as num?) ?? 0), moneyLabel((c['transport'] as num?) ?? 0),
    moneyLabel((c['total'] as num?) ?? 0),
  ]).toList();
  List<List<String>> get paymentRows => payments.map((p) => [
    (p['payment_date'] ?? p['date'] ?? '—').toString(),
    (p['method'] ?? 'Payment').toString() + (p['note'] == null ? '' : ' · ' + p['note'].toString()),
    moneyLabel((p['amount'] as num?) ?? 0),
  ]).toList();
}

class InvoiceScreen extends StatefulWidget {
  const InvoiceScreen({super.key, required this.bill});
  final Map<String, dynamic> bill;
  @override State<InvoiceScreen> createState() => _InvoiceScreenState();
}
class _InvoiceScreenState extends State<InvoiceScreen> {
  final capture = GlobalKey();
  bool working = false;
  @override Widget build(BuildContext context) {
    final data = InvoiceData(widget.bill);
    return Scaffold(appBar: AppBar(title: const Text('Rental invoice'), actions: [
      IconButton(onPressed: working ? null : shareImage, tooltip: 'Share as image',
        icon: const Icon(Icons.image_outlined)),
      IconButton(onPressed: working ? null : sharePdf, tooltip: 'Share as PDF',
        icon: const Icon(Icons.picture_as_pdf_outlined)),
    ]), body: Center(child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 650),
      child: ListView(padding: const EdgeInsets.all(12), children: [
        RepaintBoundary(key: capture, child: InvoicePaper(data: data)),
        const SizedBox(height: 16),
        Row(children: [
          Expanded(child: OutlinedButton.icon(onPressed: working ? null : sharePdf,
            icon: const Icon(Icons.picture_as_pdf_outlined), label: const Text('Share PDF'))),
          const SizedBox(width: 8),
          Expanded(child: FilledButton.icon(onPressed: working ? null : shareImage,
            icon: const Icon(Icons.share_outlined), label: const Text('Share image'))),
        ]),
      ]))));
  }
  Future<void> shareImage() async {
    setState(() => working = true);
    try {
      await WidgetsBinding.instance.endOfFrame;
      final boundary = capture.currentContext!.findRenderObject() as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 2);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();
      await SharePlus.instance.share(ShareParams(files: [
        XFile.fromData(bytes!.buffer.asUint8List(), mimeType: 'image/png',
          name: 'SA-Traders-' + widget.bill['bill_no'].toString() + '.png'),
      ]));
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not share image: $error')));
    } finally { if (mounted) setState(() => working = false); }
  }
  Future<void> sharePdf() async {
    setState(() => working = true);
    try {
      final logo = await rootBundle.load('assets/sa-traders-logo.jpg');
      final bytes = await buildInvoicePdf(InvoiceData(widget.bill), logo.buffer.asUint8List());
      await Printing.sharePdf(bytes: bytes, filename:
        'SA-Traders-' + widget.bill['bill_no'].toString() + '.pdf');
    } catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not create PDF: $error')));
    } finally { if (mounted) setState(() => working = false); }
  }
}

class InvoicePaper extends StatelessWidget {
  const InvoicePaper({super.key, required this.data});
  final InvoiceData data;
  @override Widget build(BuildContext context) {
    final b = data.bill;
    return Container(color: Colors.white, padding: const EdgeInsets.all(16),
      child: DefaultTextStyle(style: const TextStyle(fontFamily: 'Roboto',
        fontSize: 10, color: invoiceNavy),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text(businessName, style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900)),
              const Text('SCAFFOLDING & CONSTRUCTION MATERIALS', style:
                TextStyle(fontSize: 8, fontWeight: FontWeight.w800, color: invoiceGold)),
              const SizedBox(height: 4),
              const Text(businessAddress + ' · Ph: ' + businessPhones,
                style: TextStyle(fontSize: 8, color: invoiceMuted)),
            ])),
            const SizedBox(width: 8),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              const Text('RENTAL INVOICE', style: TextStyle(fontSize: 8, color: invoiceMuted)),
              const SizedBox(height: 4),
              Container(color: invoiceNavy, padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                child: Text(data.number, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900))),
              Text('Date: ' + dateKey(DateTime.now()), style: const TextStyle(fontSize: 8)),
              Text('Cycle: #' + (data.cycles.isEmpty ? '—' : data.cycles.last['index'].toString())
                + ' of ' + data.cycles.length.toString(), style: const TextStyle(fontSize: 8)),
            ]),
          ]),
          const SizedBox(height: 10), Container(height: 2, color: invoiceGold),
          const SizedBox(height: 8),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: _info('BILL TO', [
              (b['name'] ?? 'Customer').toString(), 'Mobile: ' + (b['mobile'] ?? '—').toString(),
              'Site: ' + (b['place'] ?? '—').toString()])),
            const SizedBox(width: 8),
            Expanded(child: _info('BILLING DETAILS', [
              'Start: ' + (b['start_date'] ?? '—').toString(),
              'Cycle: ' + (b['cycle_days'] ?? 30).toString() + ' days',
              'Status: ' + (b['status'] ?? 'OPEN').toString().toUpperCase()])),
          ]),
          _caption('MATERIALS'), _heading(const ['ITEM', 'QTY', 'AMOUNT (₹)'], const [4, 1, 2]),
          if (data.lines.isEmpty) _row(const ['No chargeable material', '', ''], const [4, 1, 2]),
          ...data.lines.map((line) => _row(line, const [4, 1, 2])),
          _row(['Materials total', '', moneyLabel(data.rent.rentTotal)], const [4, 1, 2], highlight: true),
          _caption('RENTAL CYCLES'),
          _heading(const ['#', 'PERIOD', 'RENT', 'TRANS', 'TOTAL'], const [1, 4, 2, 2, 2]),
          if (data.cycles.isEmpty) _row(const ['—', 'No cycles yet', '', '', ''], const [1, 4, 2, 2, 2]),
          ...data.cycleRows.asMap().entries.map((entry) =>
            _row(entry.value, const [1, 4, 2, 2, 2],
              highlight: entry.key == data.cycleRows.length - 1)),
          _caption('PAYMENTS RECEIVED'),
          _heading(const ['DATE', 'METHOD / NOTE', 'AMOUNT'], const [2, 4, 2]),
          if (data.payments.isEmpty) _row(const ['—', 'No payment recorded', '—'], const [2, 4, 2]),
          ...data.paymentRows.map((line) => _row(line, const [2, 4, 2])),
          const SizedBox(height: 12),
          Container(decoration: BoxDecoration(color: invoiceNavy,
            border: Border.all(color: invoiceGold), borderRadius: BorderRadius.circular(5)),
            child: Column(children: [
              Padding(padding: const EdgeInsets.all(10), child: Row(children: [
                _total('TOTAL DUE', data.total), _total('TOTAL PAID', data.paid),
                _total('PENDING', data.pending, gold: true),
              ])),
              Container(width: double.infinity, color: invoiceWarm, padding: const EdgeInsets.all(7),
                child: Text('Advance: ' + moneyLabel(data.advance) + ' (Refundable)  ·  '
                  + (b['cycle_days'] ?? 30).toString() + '-day cycle  ·  Transport Cycle #1 only',
                  style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w700))),
            ])),
          const SizedBox(height: 25),
          const Row(children: [
            Expanded(child: Text('CUSTOMER SIGNATURE', style: TextStyle(color: invoiceMuted, fontSize: 8))),
            Expanded(child: Text('FOR S.A TRADERS', textAlign: TextAlign.right,
              style: TextStyle(color: invoiceMuted, fontSize: 8))),
          ]),
        ])));
  }
  Widget _info(String label, List<String> values) => Container(
    color: invoicePale, padding: const EdgeInsets.all(8),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(color: invoiceMuted, fontSize: 8, fontWeight: FontWeight.w800)),
      const SizedBox(height: 3), ...values.map((v) => Text(v, style: const TextStyle(fontSize: 8))),
    ]));
  Widget _caption(String label) => Padding(padding: const EdgeInsets.only(top: 12, bottom: 5),
    child: Text(label, style: const TextStyle(color: invoiceGold, fontSize: 10,
      fontWeight: FontWeight.w900, letterSpacing: 1)));
  Widget _heading(List<String> values, List<int> widths) => Container(color: invoiceNavy,
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
    child: Row(children: List.generate(values.length, (i) => Expanded(flex: widths[i],
      child: Text(values[i], textAlign: i == 0 ? TextAlign.left : TextAlign.right,
        style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w800))))));
  Widget _row(List<String> values, List<int> widths, {bool highlight = false}) =>
    Container(color: highlight ? invoiceWarm : Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
      child: Row(children: List.generate(values.length, (i) => Expanded(flex: widths[i],
        child: Text(values[i], maxLines: 2, overflow: TextOverflow.ellipsis,
          textAlign: i == 0 ? TextAlign.left : TextAlign.right,
          style: TextStyle(fontSize: 9, fontWeight: highlight ? FontWeight.w800 : FontWeight.w500))))));
  Widget _total(String label, num value, {bool gold = false}) => Expanded(
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(color: Colors.white70, fontSize: 7)),
      FittedBox(child: Text(moneyLabel(value), style: TextStyle(
        color: gold ? invoiceGold : Colors.white, fontSize: 15, fontWeight: FontWeight.w900))),
    ]));
}

Future<Uint8List> buildInvoicePdf(InvoiceData data, Uint8List logo) async {
  final navy = PdfColor.fromHex('#101827'), gold = PdfColor.fromHex('#C48A22');
  final pale = PdfColor.fromHex('#F0F3F8'), warm = PdfColor.fromHex('#FFF2C8');
  final doc = pw.Document();
  String pdfMoney(num value) => 'Rs ' + value.toStringAsFixed(2);
  List<String> clean(List<String> row) => row.map((v) => v
    .replaceAll('₹', 'Rs ').replaceAll('—', '-').replaceAll('–', '-')
    .replaceAll('·', '-')).toList();
  pw.Widget heading(List<String> values, List<int> widths) => pw.Container(color: navy,
    padding: const pw.EdgeInsets.all(6), child: pw.Row(children: List.generate(values.length,
      (i) => pw.Expanded(flex: widths[i], child: pw.Text(values[i],
        textAlign: i == 0 ? pw.TextAlign.left : pw.TextAlign.right,
        style: pw.TextStyle(color: PdfColors.white, fontSize: 8, fontWeight: pw.FontWeight.bold))))));
  pw.Widget row(List<String> values, List<int> widths, {bool highlight = false}) =>
    pw.Container(color: highlight ? warm : PdfColors.white,
      padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 5),
      child: pw.Row(children: List.generate(values.length, (i) => pw.Expanded(
        flex: widths[i], child: pw.Text(clean(values)[i], textAlign: i == 0 ?
          pw.TextAlign.left : pw.TextAlign.right,
          style: pw.TextStyle(fontSize: 8, fontWeight: highlight ? pw.FontWeight.bold : null))))));
  pw.Widget title(String value) => pw.Padding(padding: const pw.EdgeInsets.only(top: 12, bottom: 5),
    child: pw.Text(value, style: pw.TextStyle(color: gold, fontWeight: pw.FontWeight.bold, fontSize: 9)));
  pw.Widget info(String label, List<String> lines) => pw.Expanded(child: pw.Container(
    color: pale, padding: const pw.EdgeInsets.all(9),
    child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
      pw.Text(label, style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold)),
      pw.SizedBox(height: 4), ...lines.map((v) => pw.Text(v, style: const pw.TextStyle(fontSize: 8))),
    ])));
  doc.addPage(pw.MultiPage(pageFormat: PdfPageFormat.a4, margin: const pw.EdgeInsets.all(30),
    build: (context) => [
      pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        pw.Image(pw.MemoryImage(logo), width: 36, height: 36), pw.SizedBox(width: 9),
        pw.Expanded(child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Text(businessName, style: pw.TextStyle(color: navy, fontSize: 18,
            fontWeight: pw.FontWeight.bold)),
          pw.Text('SCAFFOLDING & CONSTRUCTION MATERIALS',
            style: pw.TextStyle(color: gold, fontSize: 7)),
          pw.Text(businessAddress + ' - Ph: ' + businessPhones,
            style: const pw.TextStyle(fontSize: 7)),
        ])),
        pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
          pw.Text('RENTAL INVOICE', style: const pw.TextStyle(fontSize: 8)),
          pw.Container(color: navy, padding: const pw.EdgeInsets.all(5),
            child: pw.Text(data.number, style: pw.TextStyle(color: PdfColors.white,
              fontSize: 10, fontWeight: pw.FontWeight.bold))),
          pw.Text('Date: ' + dateKey(DateTime.now()), style: const pw.TextStyle(fontSize: 8)),
        ]),
      ]),
      pw.SizedBox(height: 8), pw.Container(height: 2, color: gold),
      pw.SizedBox(height: 8),
      pw.Row(children: [
        info('BILL TO', [(data.bill['name'] ?? 'Customer').toString(),
          'Mobile: ' + (data.bill['mobile'] ?? '—').toString(),
          'Site: ' + (data.bill['place'] ?? '—').toString()]),
        pw.SizedBox(width: 9),
        info('BILLING DETAILS', ['Start: ' + (data.bill['start_date'] ?? '—').toString(),
          'Cycle: ' + (data.bill['cycle_days'] ?? 30).toString() + ' days',
          'Status: ' + (data.bill['status'] ?? 'OPEN').toString()]),
      ]),
      title('MATERIALS'), heading(const ['ITEM', 'QTY', 'AMOUNT (Rs)'], const [4, 1, 2]),
      if (data.lines.isEmpty) row(const ['No chargeable material', '', ''], const [4, 1, 2]),
      ...data.lines.map((v) => row(v, const [4, 1, 2])),
      row(['Materials total', '', pdfMoney(data.rent.rentTotal)], const [4, 1, 2], highlight: true),
      title('RENTAL CYCLES'),
      heading(const ['#', 'PERIOD', 'RENT', 'TRANS', 'TOTAL'], const [1, 4, 2, 2, 2]),
      if (data.cycles.isEmpty) row(const ['—', 'No cycles yet', '', '', ''], const [1, 4, 2, 2, 2]),
      ...data.cycleRows.asMap().entries.map((entry) =>
        row(entry.value, const [1, 4, 2, 2, 2],
          highlight: entry.key == data.cycleRows.length - 1)),
      title('PAYMENTS RECEIVED'),
      heading(const ['DATE', 'METHOD / NOTE', 'AMOUNT (Rs)'], const [2, 4, 2]),
      if (data.payments.isEmpty) row(const ['—', 'No payment recorded', '—'], const [2, 4, 2]),
      ...data.paymentRows.map((v) => row(v, const [2, 4, 2])),
      pw.SizedBox(height: 12),
      pw.Container(color: navy, padding: const pw.EdgeInsets.all(12),
        child: pw.Row(children: [
          for (final item in [('TOTAL DUE', data.total, PdfColors.white),
            ('TOTAL PAID', data.paid, PdfColors.white), ('PENDING', data.pending, gold)])
            pw.Expanded(child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(item.$1, style: const pw.TextStyle(color: PdfColors.white, fontSize: 8)),
                pw.Text(pdfMoney(item.$2), style: pw.TextStyle(color: item.$3, fontSize: 14,
                  fontWeight: pw.FontWeight.bold)),
              ])),
        ])),
      pw.Container(width: double.infinity, color: warm, padding: const pw.EdgeInsets.all(8),
        child: pw.Text('Advance: ' + pdfMoney(data.advance) +
          ' (Refundable)     Transport Cycle #1 only', style: const pw.TextStyle(fontSize: 8))),
      pw.SizedBox(height: 30),
      pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
        pw.Text('CUSTOMER SIGNATURE', style: const pw.TextStyle(fontSize: 8)),
        pw.Text('FOR S.A TRADERS', style: const pw.TextStyle(fontSize: 8)),
      ]),
    ]));
  return doc.save();
}
