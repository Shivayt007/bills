import 'dart:ui' as ui;
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import '../lib/core/providers.dart';
import '../lib/features/billing/presentation/bill_detail_screen.dart';
import '../lib/features/billing/presentation/bill_navigation.dart';

void main() {
  final bill=<String,dynamic>{'bill_no':'2504','name':'Suriya','mobile':'9361354349','place':'Thanjavur','start_date':'2026-10-01','cycle_days':30,'status':'open','jackey_qty':100,'sheet_qty':100,'span_qty':100,'advance_amount':1000,'payments':<Map<String,dynamic>>[],'return_history':<Map<String,dynamic>>[],'additional_history':<Map<String,dynamic>>[]};
  Widget app(Widget home,{Map<String,dynamic>? fetched})=>ProviderScope(overrides:[billsProvider.overrideWith((ref)=>Stream.value(<Map<String,dynamic>>[])),billDetailProvider('2504').overrideWith((ref)async=>fetched),isAdminProvider.overrideWith((ref)async=>false)],child:MaterialApp(home:home));
  testWidgets('View bill fetches exact bill and back preserves the source route',(tester)async{
    await tester.pumpWidget(app(const Scaffold(body:ViewBillButton(billNo:'2504')),fetched:bill));
    await tester.tap(find.text('View bill'));await tester.pumpAndSettle();
    expect(find.text('Bill #2504'),findsOneWidget);expect(find.text('Suriya'),findsOneWidget);
    await tester.pageBack();await tester.pumpAndSettle();expect(find.text('View bill'),findsOneWidget);
  });
  testWidgets('Deleted bill ends loading and shows Bill not found',(tester)async{
    await tester.pumpWidget(app(const BillDetailScreen(billNo:'2504')));await tester.pumpAndSettle();expect(find.text('Bill not found'),findsOneWidget);
  });
  for(final width in [320.0,390.0]){
    testWidgets('Bill details fits $width and tabs show their content',(tester)async{
      tester.view.physicalSize=Size(width,844);tester.view.devicePixelRatio=1;
      addTearDown(tester.view.resetPhysicalSize);addTearDown(tester.view.resetDevicePixelRatio);
      final boundary=GlobalKey();
      await tester.pumpWidget(app(RepaintBoundary(key:boundary,child:const BillDetailScreen(billNo:'2504')),fetched:bill));await tester.pumpAndSettle();expect(tester.takeException(),isNull);
      if(width==390){
        final image=await (boundary.currentContext!.findRenderObject() as RenderRepaintBoundary).toImage(pixelRatio:2);
        final bytes=await image.toByteData(format:ui.ImageByteFormat.png);
        await tester.runAsync(()async{await Directory('build/previews').create(recursive:true);await File('build/previews/bill-details.png').writeAsBytes(bytes!.buffer.asUint8List());});image.dispose();
      }
      await tester.ensureVisible(find.text('Rental cycles'));await tester.tap(find.text('Rental cycles'));await tester.pumpAndSettle();expect(find.text('Materials out'),findsNothing);expect(tester.takeException(),isNull);
      await tester.ensureVisible(find.text('Activity'));await tester.tap(find.text('Activity'));await tester.pumpAndSettle();expect(find.text('Payment & material activity'),findsOneWidget);expect(tester.takeException(),isNull);
    });
  }
}
