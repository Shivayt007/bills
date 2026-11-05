import 'dart:ui' as ui;
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import '../lib/core/providers.dart';
import '../lib/core/theme/app_theme.dart';
import '../lib/features/billing/presentation/bill_detail_screen.dart';
import '../lib/features/billing/presentation/bill_form_screen.dart';
import '../lib/features/billing/presentation/bill_navigation.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(()async{
    final fontFile=File('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
    if(await fontFile.exists()){
      final font=FontLoader('PreviewSans')..addFont(fontFile.readAsBytes().then((b)=>ByteData.sublistView(b)));
      await font.load();
    }
    final iconFile=File('${Platform.environment['FLUTTER_ROOT']}/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
    if(await iconFile.exists()){
      final icons=FontLoader('MaterialIcons')..addFont(iconFile.readAsBytes().then((b)=>ByteData.sublistView(b)));
      await icons.load();
    }
  });
  final bill=<String,dynamic>{'bill_no':'2504','name':'Suriya','mobile':'9361354349','place':'Thanjavur','start_date':'2026-10-01','cycle_days':30,'status':'open','jackey_qty':100,'sheet_qty':100,'span_qty':100,'advance_amount':1000,'payments':<Map<String,dynamic>>[],'return_history':<Map<String,dynamic>>[],'additional_history':<Map<String,dynamic>>[]};
  Widget app(Widget home,{Map<String,dynamic>? fetched})=>ProviderScope(overrides:[billsProvider.overrideWith((ref)=>Stream.value(<Map<String,dynamic>>[])),billDetailProvider('2504').overrideWith((ref)async=>fetched),isAdminProvider.overrideWith((ref)async=>false)],child:MaterialApp(theme:buildTheme().copyWith(textTheme:buildTheme().textTheme.apply(fontFamily:'PreviewSans'),filledButtonTheme:FilledButtonThemeData(style:buildTheme().filledButtonTheme.style?.copyWith(textStyle:const WidgetStatePropertyAll(TextStyle(fontFamily:'PreviewSans',fontWeight:FontWeight.w700))))),home:home));
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
    testWidgets('Bill details fits $width and keeps bill actions visible',(tester)async{
      tester.view.physicalSize=Size(width,844);tester.view.devicePixelRatio=1;
      addTearDown(tester.view.resetPhysicalSize);addTearDown(tester.view.resetDevicePixelRatio);
      final boundary=GlobalKey();
      await tester.pumpWidget(app(RepaintBoundary(key:boundary,child:const BillDetailScreen(billNo:'2504')),fetched:bill));await tester.pumpAndSettle();expect(tester.takeException(),isNull);
      if(width==390){
        tester.view.physicalSize=Size(width,1800);
        await tester.pumpAndSettle();
        await tester.runAsync(()async{
          final image=await (boundary.currentContext!.findRenderObject() as RenderRepaintBoundary).toImage(pixelRatio:2);
          final bytes=await image.toByteData(format:ui.ImageByteFormat.png);
          await Directory('build/previews').create(recursive:true);
          await File('build/previews/bill-details.png').writeAsBytes(bytes!.buffer.asUint8List());
          image.dispose();
        });
      }
      tester.view.physicalSize=Size(width,844);await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.text('Rental cycles'),150);await tester.pumpAndSettle();
      expect(find.text('Rental cycles'),findsOneWidget);
      await tester.scrollUntilVisible(find.text('Record return'),150);
      await tester.pumpAndSettle();
      expect(find.text('Record return'),findsOneWidget);
      await tester.scrollUntilVisible(find.text('Add material'),150);
      await tester.pumpAndSettle();
      expect(find.text('Add material'),findsOneWidget);
      expect(tester.takeException(),isNull);
    });
  }
  testWidgets('Edit bill form fits a narrow screen and keeps bill number fixed',(tester)async{
    tester.view.physicalSize=const Size(320,844);
    tester.view.devicePixelRatio=1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(ProviderScope(child:MaterialApp(theme:buildTheme(),
      home:BillFormScreen(initialBill:bill))));
    await tester.pumpAndSettle();
    expect(find.text('Edit bill #2504'),findsOneWidget);
    expect(find.text('Bill number'),findsOneWidget);
    expect(find.text('Save changes'),findsOneWidget);
    await tester.scrollUntilVisible(find.text('Materials'),150);
    await tester.pumpAndSettle();
    expect(tester.takeException(),isNull);
  });
  testWidgets('Dark bill details keeps actions and totals readable',(tester)async{
    tester.view.physicalSize=const Size(390,1500);tester.view.devicePixelRatio=1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final boundary=GlobalKey();
    final dark=buildTheme(Brightness.dark);
    await tester.pumpWidget(ProviderScope(overrides:[
      billsProvider.overrideWith((ref)=>Stream.value(<Map<String,dynamic>>[])),
      billDetailProvider('2504').overrideWith((ref)async=>bill),
      isAdminProvider.overrideWith((ref)async=>false),
    ],child:MaterialApp(theme:dark.copyWith(
      textTheme:dark.textTheme.apply(fontFamily:'PreviewSans')),
      home:RepaintBoundary(key:boundary,
        child:const BillDetailScreen(billNo:'2504')))));
    await tester.pumpAndSettle();
    expect(find.text('Record payment'),findsOneWidget);
    expect(tester.takeException(),isNull);
    await tester.runAsync(()async{
      final image=await (boundary.currentContext!.findRenderObject()
        as RenderRepaintBoundary).toImage(pixelRatio:2);
      final bytes=await image.toByteData(format:ui.ImageByteFormat.png);
      await Directory('build/previews').create(recursive:true);
      await File('build/previews/bill-details-dark.png')
        .writeAsBytes(bytes!.buffer.asUint8List());
      image.dispose();
    });
  });
}
