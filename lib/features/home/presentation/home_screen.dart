import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/glass_design.dart';
import '../../../core/widgets/common.dart';
import '../../billing/domain/billing_calculator.dart';
import '../../billing/presentation/bill_detail_screen.dart';
import '../../notifications/data/reminder_service.dart';
import '../../notifications/presentation/notifications_screen.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key,required this.onNavigate});
  final ValueChanged<int> onNavigate;

  @override Widget build(BuildContext context,WidgetRef ref) {
    ref.listen(billsProvider,(previous,next) {
      if(next.hasValue) ReminderService.refreshFromCloud();
    });
    final bills=ref.watch(hydratedBillsProvider);
    final active=bills.where((b)=>b['status']!='closed').toList();
    final paid=active.fold<double>(0,(v,b)=>v+(b['total_paid'] as num).toDouble());
    final pending=active.fold<double>(0,(v,b)=>v+(b['pending'] as num).toDouble());
    final today=DateTime.now().toUtc();
    final todayKey=dateKey(today);
    final reminderRows=active.map((b)=><String,dynamic>{
      'billNo':'${b['bill_no']}','name':b['name']??'Customer',
      'start':b['start_date']??'','paid':b['total_paid'],
      'cycles':b['cycles'],
    }).toList();
    final todayItems=reminderCategories(reminderRows,
      DateTime.utc(today.year,today.month,today.day))['today']??[];
    final dueToday=todayItems.fold<double>(0,(v,row)=>v+((row['balance'] as num?)?.toDouble()??0));
    final dueNumbers=todayItems.map((item)=>'${item['billNo']}').toSet();
    final reduceMotion=MediaQuery.disableAnimationsOf(context);
    final p=AppPalette.of(context);
    void openAlerts()=>Navigator.push(context,
      MaterialPageRoute(builder:(_)=>const NotificationsScreen()));
    return GlassBackdrop(child:Scaffold(backgroundColor:Colors.transparent,
      appBar:AppBar(backgroundColor:Colors.transparent,
        title:Row(children:[
          ClipRRect(borderRadius:BorderRadius.circular(10),
            child:Image.asset('assets/sa-traders-logo.jpg',height:38,width:38,fit:BoxFit.cover)),
          const SizedBox(width:10),
          const Flexible(child:Text('S.A Traders',maxLines:1,overflow:TextOverflow.ellipsis)),
        ]),
        actions:[IconButton(tooltip:'Notifications',onPressed:openAlerts,
          icon:const Icon(Icons.notifications_active_outlined))]),
      body:AppPageWidth(child:RefreshIndicator(onRefresh:() async {
        await ref.refresh(billsProvider.future);
      },child:ListView(key:const PageStorageKey('dashboard-scroll'),
        padding:const EdgeInsets.fromLTRB(16,8,16,110),children:[
          Text('YOUR BUSINESS TODAY',style:Theme.of(context).textTheme.labelMedium?.copyWith(
            color:p.accent,letterSpacing:1.3,fontWeight:FontWeight.w800)),
          const SizedBox(height:8),
          Text('Rental overview',style:Theme.of(context).textTheme.headlineLarge),
          const SizedBox(height:18),
          _OutstandingCard(amount:pending,count:active.length,
            reduceMotion:reduceMotion,onViewBills:()=>onNavigate(1)),
          const SizedBox(height:12),
          LayoutBuilder(builder:(context,constraints) {
            final narrow=constraints.maxWidth<345;
            final width=narrow ? constraints.maxWidth : (constraints.maxWidth-12)/2;
            return Wrap(spacing:12,runSpacing:12,children:[
              SizedBox(width:width,child:_MetricCard(label:'Received',value:moneyLabel(paid),
                icon:Icons.south_west_rounded,tint:p.positive,onTap:()=>onNavigate(1))),
              SizedBox(width:width,child:_MetricCard(label:'Due Today',value:moneyLabel(dueToday),
                icon:Icons.calendar_today_outlined,tint:p.warning,onTap:openAlerts)),
            ]);
          }),
          const SizedBox(height:23),
          Row(children:[Expanded(child:Text('Recent Bills',
            style:Theme.of(context).textTheme.titleLarge)),
            TextButton(onPressed:()=>onNavigate(1),child:const Text('View all'))]),
          const SizedBox(height:8),
          if(active.isEmpty)
            const GlassCard(child:EmptyState(title:'No active bills yet',
              description:'Create a rental bill to start tracking payments and cycles.'))
          else ...active.take(6).map((bill)=>Padding(
            padding:const EdgeInsets.only(bottom:9),
            child:_BillTile(bill:bill,dueToday:dueNumbers.contains('${bill['bill_no']}'),
              onTap:()=>Navigator.push(context,MaterialPageRoute(
                builder:(_)=>BillDetailScreen(billNo:'${bill['bill_no']}')))))),
        ])))),
    );
  }
}

class _OutstandingCard extends StatelessWidget {
  const _OutstandingCard({required this.amount,required this.count,
    required this.reduceMotion,required this.onViewBills});
  final double amount;
  final int count;
  final bool reduceMotion;
  final VoidCallback onViewBills;
  @override Widget build(BuildContext context)=>ClipRRect(
    borderRadius:BorderRadius.circular(24),child:BackdropFilter(
      filter:ImageFilter.blur(sigmaX:8,sigmaY:8),
      child:Container(
        decoration:BoxDecoration(borderRadius:BorderRadius.circular(24),
          gradient:const LinearGradient(begin:Alignment.topLeft,end:Alignment.bottomRight,
            colors:[Color(0xDC1994AE),Color(0xE705637F),Color(0xF0084D66)]),
          border:Border.all(color:const Color(0xD7C6F7FC),width:1.3),
          boxShadow:const [BoxShadow(color:Color(0x393D8094),blurRadius:20,offset:Offset(0,8))]),
        child:Stack(clipBehavior:Clip.hardEdge,children:[
          Positioned(top:-88,right:-36,width:230,height:230,
            child:IgnorePointer(child:Container(decoration:BoxDecoration(
              shape:BoxShape.circle,border:Border.all(color:const Color(0x44FFFFFF)),
              gradient:const RadialGradient(colors:[Color(0x66E6FFFF),
                Color(0x20FFFFFF),Color(0x00FFFFFF)]))))),
          Positioned(top:19,right:21,width:35,height:35,
            child:IgnorePointer(child:Container(decoration:BoxDecoration(
              shape:BoxShape.circle,border:Border.all(color:const Color(0x77FFFFFF)),
              gradient:const LinearGradient(colors:[Color(0x88FFFFFF),
                Color(0x13FFFFFF)]))))),
          Positioned(bottom:-100,left:-70,width:210,height:210,
            child:IgnorePointer(child:Container(decoration:const BoxDecoration(
              shape:BoxShape.circle,gradient:RadialGradient(colors:[
                Color(0x33C3FAFF),Color(0x00FFFFFF)]))))),
          Padding(padding:const EdgeInsets.all(22),child:Column(
            crossAxisAlignment:CrossAxisAlignment.start,children:[
              const Text('Total Outstanding',style:TextStyle(color:Colors.white,
                fontSize:16,fontWeight:FontWeight.w700)),
              const SizedBox(height:7),
              AnimatedSwitcher(duration:reduceMotion?Duration.zero:AppMotion.standard,
                child:FittedBox(key:ValueKey(amount),fit:BoxFit.scaleDown,
                  alignment:Alignment.centerLeft,
                  child:Text(moneyLabel(amount),maxLines:1,
                    style:const TextStyle(color:Colors.white,fontSize:39,fontWeight:FontWeight.w900)))),
              const SizedBox(height:16),
              Row(children:[const Icon(Icons.receipt_long_outlined,color:Colors.white,size:18),
                const SizedBox(width:7),Expanded(child:Text('$count active rental bills',
                  style:const TextStyle(color:Colors.white,fontWeight:FontWeight.w700))),
                IconButton(onPressed:onViewBills,tooltip:'View active bills',
                  icon:const Icon(Icons.arrow_forward,color:Colors.white))]),
            ])),
        ]))));
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.label,required this.value,required this.icon,
    required this.tint,required this.onTap});
  final String label,value;
  final IconData icon;
  final Color tint;
  final VoidCallback onTap;
  @override Widget build(BuildContext context)=>GlassCard(onTap:onTap,padding:const EdgeInsets.all(16),
    child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
      Icon(icon,color:tint,size:22),
      const SizedBox(height:10),
      FittedBox(fit:BoxFit.scaleDown,alignment:Alignment.centerLeft,
        child:Text(value,maxLines:1,style:Theme.of(context).textTheme.titleLarge?.copyWith(
          color:AppPalette.of(context).ink,fontWeight:FontWeight.w900))),
      const SizedBox(height:4),
      Text(label,maxLines:1,style:Theme.of(context).textTheme.bodyMedium?.copyWith(
        color:AppPalette.of(context).ink,fontWeight:FontWeight.w700)),
    ]));
}

class _BillTile extends StatelessWidget {
  const _BillTile({required this.bill,required this.dueToday,required this.onTap});
  final Map<String,dynamic> bill;
  final bool dueToday;
  final VoidCallback onTap;
  @override Widget build(BuildContext context) {
    final name='${bill['name']??'Customer'}'.trim();
    final display=name.isEmpty?'Customer':name;
    final pending=(bill['pending'] as num? ?? 0).toDouble();
    final state=pending<=0?GlassStatus.received:
      dueToday?GlassStatus.dueToday:GlassStatus.pending;
    final p=AppPalette.of(context);
    return Semantics(button:true,label:'Open bill ${bill['bill_no']} for $display',
      child:GlassCard(onTap:onTap,padding:const EdgeInsets.symmetric(horizontal:15,vertical:13),
        child:Row(children:[
          Container(width:38,height:38,decoration:BoxDecoration(color:p.subtle,
            borderRadius:BorderRadius.circular(12)),
            child:Icon(Icons.receipt_long_outlined,color:p.accent,size:20)),
          const SizedBox(width:10),
          Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            Text('Bill #${bill['bill_no']}',maxLines:1,overflow:TextOverflow.ellipsis,
              style:Theme.of(context).textTheme.titleMedium),
            Text(display,maxLines:1,overflow:TextOverflow.ellipsis,
              style:Theme.of(context).textTheme.bodySmall),
          ])),
          const SizedBox(width:6),
          Column(crossAxisAlignment:CrossAxisAlignment.end,children:[
            Text(moneyLabel(pending),maxLines:1,
              style:TextStyle(fontWeight:FontWeight.w900,color:p.ink)),
            const SizedBox(height:4),
            GlassStatusChip(status:state),
          ]),
          const SizedBox(width:5),Icon(Icons.chevron_right,color:p.muted,size:18),
        ])));
  }
}
