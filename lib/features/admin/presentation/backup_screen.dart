import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/common.dart';
import '../../billing/domain/billing_calculator.dart';
import '../../column_box/data/column_box_repository.dart';
import '../domain/backup_codec.dart';

class BackupScreen extends ConsumerStatefulWidget {
  const BackupScreen({super.key});
  @override ConsumerState<BackupScreen> createState() => _BackupScreenState();
}

class _BackupScreenState extends ConsumerState<BackupScreen> {
  bool busy = false;
  String? message;

  void _show(String text) {
    if (!mounted) return;
    setState(() => message = text);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  Future<void> _export() async {
    setState(() { busy = true; message = null; });
    try {
      final data = <String, List<Map<String, dynamic>>>{};
      for (final collection in storeKeys.keys) {
        data[collection] = await ref.read(billingRepositoryProvider).all(collection);
      }
      final now = DateTime.now();
      final bytes = Uint8List.fromList(utf8.encode(BackupCodec.encode(data, now)));
      final fileName = 'SA-Traders-backup-${dateKey(now)}.json';
      final saved = await FilePicker.saveFile(fileName: fileName,
        dialogTitle: 'Save S.A Traders backup', bytes: bytes);
      if (saved != null) _show('Backup saved: $fileName');
    } catch (error) {
      _show('Could not export backup: $error');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _import() async {
    setState(() { busy = true; message = null; });
    try {
      final selection = await FilePicker.pickFiles(type: FileType.custom,
        allowedExtensions: ['json'], allowMultiple: false, withData: true);
      if (selection == null || selection.files.isEmpty) return;
      final file = selection.files.single;
      final bytes = file.bytes ?? (file.path == null ? null : await File(file.path!).readAsBytes());
      if (bytes == null) throw const FormatException('Could not read the selected file.');
      final stores = BackupCodec.decode(bytes);
      if (!mounted) return;
      final count = stores.values.fold<int>(0, (total, rows) => total + rows.length);
      final approved = await showDialog<bool>(context: context, builder: (dialog) =>
        AlertDialog(
          title: const Text('Restore backup file?'),
          content: Text('File: ${file.name}\n\n$count records in '
            '${stores.length} collections. Existing records in these collections '
            'will be replaced. Export a current backup first if you need it.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialog, false),
              child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(dialog, true),
              child: const Text('Restore records')),
          ]));
      if (approved != true) return;
      await ref.read(billingRepositoryProvider).replaceAll(stores);
      ref.invalidate(billsProvider);
      ref.invalidate(customBillsProvider);
      ref.invalidate(columnBoxBillsProvider);
      ref.invalidate(customersProvider);
      ref.invalidate(inventoryProvider);
      ref.invalidate(slipsProvider);
      ref.invalidate(challansProvider);
      ref.invalidate(settingsProvider);
      _show('Backup restored: $count records');
    } catch (error) {
      _show('Could not restore backup: $error');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Backup & restore')),
    body: AppPageWidth(child: ListView(padding: const EdgeInsets.all(18),
      children: [
        Text('Keep a copy of your business data',
          style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 10),
        Text('Save a JSON backup file to your phone or cloud storage. '
          'Select that file later to restore the same Firestore records.',
          style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 22),
        Card(child: Padding(padding: const EdgeInsets.all(18),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Export file', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            const Text('Includes rental and column box bills, customers, custom bills, slips, '
              'challans, inventory, and settings.'),
            const SizedBox(height: 16),
            FilledButton.icon(onPressed: busy ? null : _export,
              icon: const Icon(Icons.download_outlined),
              label: const Text('Save backup file')),
          ]))),
        const SizedBox(height: 12),
        Card(child: Padding(padding: const EdgeInsets.all(18),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('Import file', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            const Text('Choose a S.A Traders .json backup. The app checks '
              'its records and shows a confirmation before replacing data.'),
            const SizedBox(height: 16),
            OutlinedButton.icon(onPressed: busy ? null : _import,
              icon: const Icon(Icons.upload_file_outlined),
              label: const Text('Choose backup file')),
          ]))),
        if (busy) const Padding(padding: EdgeInsets.all(18),
          child: Center(child: CircularProgressIndicator())),
        if (message != null) Padding(padding: const EdgeInsets.only(top: 16),
          child: Text(message!)),
      ])));
}
