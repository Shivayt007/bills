import 'dart:convert';
import 'features/billing/presentation/bill_navigation.dart';
import 'features/notifications/data/reminder_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/providers.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/home/presentation/home_shell.dart';

class SATradersApp extends ConsumerWidget {
  const SATradersApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth=ref.watch(authStateProvider);
    if(auth.asData?.value!=null){
      ReminderService.onBillTap=(payload){WidgetsBinding.instance.addPostFrameCallback((_){
        final context=billNavigatorKey.currentContext;
        if(context==null)return;
        try{final row=jsonDecode(payload) as Map;ReminderService.pendingBillPayload=null;openBill(context,'${row['billNo']}',isCustom:row['isCustom']==true);}catch(_){}
      });WidgetsBinding.instance.scheduleFrame();};
      final pending=ReminderService.pendingBillPayload;
      if(pending!=null)ReminderService.onBillTap!(pending);
    }else{ReminderService.onBillTap=null;}
    return ValueListenableBuilder<ThemeMode>(valueListenable: appThemeController,
      builder: (context, mode, _) => MaterialApp(
      navigatorKey:billNavigatorKey,title:'S.A Traders', debugShowCheckedModeBanner:false, theme:buildTheme(),
      darkTheme: buildTheme(Brightness.dark), themeMode: mode,
      home:auth.when(data:(user)=>user==null?const LoginScreen():const HomeShell(),loading:()=>const _Loading(),error:(e,_)=>_Error(message:'Authentication could not start: $e'))));
  }
}
class _Loading extends StatelessWidget { const _Loading(); @override Widget build(BuildContext context)=>const Scaffold(body:Center(child:CircularProgressIndicator())); }
class _Error extends StatelessWidget { const _Error({required this.message}); final String message; @override Widget build(BuildContext context)=>Scaffold(body:Center(child:Padding(padding:const EdgeInsets.all(24),child:Text(message,textAlign:TextAlign.center)))); }
