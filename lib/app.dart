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
    return MaterialApp(
      title:'S.A Traders', debugShowCheckedModeBanner:false, theme:buildTheme(),
      home:auth.when(data:(user)=>user==null?const LoginScreen():const HomeShell(),loading:()=>const _Loading(),error:(e,_)=>_Error(message:'Authentication could not start: $e')),
    );
  }
}
class _Loading extends StatelessWidget { const _Loading(); @override Widget build(BuildContext context)=>const Scaffold(body:Center(child:CircularProgressIndicator())); }
class _Error extends StatelessWidget { const _Error({required this.message}); final String message; @override Widget build(BuildContext context)=>Scaffold(body:Center(child:Padding(padding:const EdgeInsets.all(24),child:Text(message,textAlign:TextAlign.center)))); }
