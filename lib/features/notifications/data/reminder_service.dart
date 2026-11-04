import 'dart:convert';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:notification_listener_service/notification_listener_service.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';
import '../../../core/constants.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/common.dart';
import '../../billing/data/billing_repository.dart';
import '../../billing/domain/billing_calculator.dart';

const _enabledKey='sa_reminder_settings_v1';
const _rowsKey='sa_reminder_cached_rows_v1';
const _historyKey='sa_reminder_history_v1';
const _paymentsKey='sa_detected_payments_v1';
final _notifications=FlutterLocalNotificationsPlugin();

class ReminderService {
  static Future<void> initialize() async {
    await _notifications.initialize(settings:const InitializationSettings(android:AndroidInitializationSettings('@mipmap/ic_launcher')));
    await Workmanager().initialize(reminderCallbackDispatcher);
    final android=_notifications.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await android?.requestNotificationsPermission();
    NotificationListenerService.notificationsStream.listen((event) async {
      final pkg=event.packageName??'';
      const known={'com.google.android.apps.nbu.paisa.user':'GPay','net.one97.paytm':'Paytm','com.paytm.business':'Paytm','com.phonepe.app':'PhonePe','com.phonepe.app.business':'PhonePe','com.google.android.apps.messaging':'SMS','com.samsung.android.messaging':'SMS','com.android.mms':'SMS','com.dreamplug.androidapp':'CRED','com.pnbindia':'Bank','com.snapwork.hdfc':'Bank','com.csam.icici.bank.imobile':'Bank','com.sbi.lotusintouch':'Bank','com.axis.mobile':'Bank'};
      final source=known[pkg];if(source==null||event.hasRemoved==true)return;
      final text='${event.title??''} ${event.content??''}';
      final lower=text.toLowerCase();
      if(source=='SMS'&&!(lower.contains('credited')||lower.contains('received')))return;
      if(RegExp(r'\b(otp|verification code|collect request|refund|reversed|failed|declined|pending|processing|debited|you paid|you sent|paid to|sent to|cashback|offer)\b').hasMatch(lower))return;
      if(!(RegExp(r'\b(received|credited|paid you)\b').hasMatch(lower)))return;
      final matches=RegExp(r'(?:₹|\bINR\b|\bRs\.?)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)(?![0-9.])',caseSensitive:false).allMatches(text).toList();
      if(matches.length!=1)return;
      final amount=double.tryParse(matches.single.group(1)!.replaceAll(',',''));if(amount==null||amount<=0||amount>100000000)return;
      final ref=RegExp(r'(?:UPI\s*(?:ref(?:erence)?|txn|transaction)?|UTR|ref(?:erence)?(?:\s*(?:no|number))?|transaction\s*(?:id|no))\s*[:.#-]?\s*([0-9]{10,22})',caseSensitive:false).firstMatch(text)?.group(1)??'';
      final prefs=await SharedPreferences.getInstance();final list=(jsonDecode(prefs.getString(_paymentsKey)??'[]') as List).cast<Map>().map((m)=>Map<String,dynamic>.from(m)).toList();
      if(list.any((x)=>(ref.isNotEmpty&&x['reference']==ref)||(x['text']==text&&DateTime.now().millisecondsSinceEpoch-(x['receivedAt'] as int)<120000)))return;
      final item={'id':'${DateTime.now().microsecondsSinceEpoch}','amount':amount,'source':source=='SMS'?'Bank':source,'reference':ref,'receivedAt':DateTime.now().millisecondsSinceEpoch,'text':text,'dismissed':false};list.add(item);if(list.length>1000)list.removeRange(0,list.length-1000);await prefs.setString(_paymentsKey,jsonEncode(list));
      await _notifications.show(id:item['id'].hashCode,title:'Payment detected · ${moneyLabel(amount)}',body:'$source · Tap the app to assign it',notificationDetails:const NotificationDetails(android:AndroidNotificationDetails('detected_payments','Detected payments',importance:Importance.defaultImportance,priority:Priority.defaultPriority)));
    });
  }
  static Future<bool> paymentPermission() => NotificationListenerService.isPermissionGranted();
  static Future<bool> requestPaymentPermission() => NotificationListenerService.requestPermission();
  static Future<List<Map<String,dynamic>>> candidates() async {final p=await SharedPreferences.getInstance();return (jsonDecode(p.getString(_paymentsKey)??'[]') as List).cast<Map>().map((x)=>Map<String,dynamic>.from(x)).where((x)=>x['dismissed']!=true).toList();}
  static Future<void> dismiss(String id) async {final p=await SharedPreferences.getInstance();final list=(jsonDecode(p.getString(_paymentsKey)??'[]') as List).cast<Map>().map((x)=>Map<String,dynamic>.from(x)).toList();for(final x in list){if(x['id']==id)x['dismissed']=true;}await p.setString(_paymentsKey,jsonEncode(list));await _notifications.cancel(id:id.hashCode);}
  static Future<List<Map<String,dynamic>>> history() async {final p=await SharedPreferences.getInstance();return (jsonDecode(p.getString(_historyKey)??'[]') as List).cast<Map>().map((x)=>Map<String,dynamic>.from(x)).toList();}
  static Future<Map<String,List<Map<String,dynamic>>>> currentCategories() async {final p=await SharedPreferences.getInstance();final rows=(jsonDecode(p.getString(_rowsKey)??'[]') as List).cast<Map>().map((x)=>Map<String,dynamic>.from(x)).toList();final now=DateTime.now().toUtc();return reminderCategories(rows,DateTime.utc(now.year,now.month,now.day));}
  static Future<void> saveBillSnapshot(List<Map<String,dynamic>> rows) async {final p=await SharedPreferences.getInstance();await p.setString(_rowsKey,jsonEncode(rows));}
  static Future<bool> remindersEnabled() async {final p=await SharedPreferences.getInstance();return p.getBool(_enabledKey)??false;}
  static Future<void> setReminders(bool enabled) async {final p=await SharedPreferences.getInstance();await p.setBool(_enabledKey,enabled);if(enabled){await Workmanager().registerPeriodicTask('sa-traders-balance-reminders','dailyBillReminder',frequency:const Duration(days:1),existingWorkPolicy:ExistingPeriodicWorkPolicy.keep);await Workmanager().registerOneOffTask('sa-traders-immediate-reminder','dailyBillReminder',initialDelay:const Duration(seconds:5));}else{await Workmanager().cancelByUniqueName('sa-traders-balance-reminders');await Workmanager().cancelByUniqueName('sa-traders-immediate-reminder');}}
  static Future<void> refreshFromCloud() async {
    final repo=BillingRepository(FirebaseFirestore.instance);
    final [rawBills,rawCustom]=await Future.wait([repo.all('bills'),repo.all('customBills')]);
    final now=DateTime.now().toUtc();final today=DateTime.utc(now.year,now.month,now.day);
    final rows=<Map<String,dynamic>>[];
    for(final raw in rawBills){final b=hydrateRentalBill(raw,today:today);if(b['status']=='closed')continue;final cycles=(b['cycles'] as List).map((c)=>{'start':c['start_date'],'end':c['end_date'],'total':c['total'],'index':c['index']}).toList();final start=parseBillingDate(b['start_date']);final days=(b['cycle_days'] as num?)?.toInt()??30;if(start!=null){for(var index=cycles.length+1;index<cycles.length+27&&index<500;index++){final snap=snapshotForCycle(b,index);final rent=calculateRent(Map<String,int>.from(snap['qty']),Map<String,Map<String,int>>.from((snap['wood'] as Map).map((k,v)=>MapEntry('$k',Map<String,int>.from((v as Map).map((x,y)=>MapEntry('$x',(y as num).toInt())))))),b).rentTotal;if(rent<=0)break;final from=start.add(Duration(days:(index-1)*days));cycles.add({'start':dateKey(from),'end':dateKey(from.add(Duration(days:days-1))),'total':moneyRound(rent+(index==1?transportTotal(b):0)),'index':index});}}rows.add({'billNo':'${b['bill_no']}','name':b['name']??'Customer','mobile':b['mobile']??'','paid':b['total_paid'],'total':b['total_due'],'start':b['start_date']??'','cycles':cycles});}
    for(final raw in rawCustom){if(raw['status']=='closed')continue;final total=customBillTotal(raw);final paid=((raw['payments'] as List? ?? const []).fold<double>(0,(v,p)=>v+(((p as Map)['amount'] as num?)?.toDouble()??0)));rows.add({'billNo':'${raw['bill_no']}','name':raw['name']??'Customer','mobile':raw['mobile']??'','paid':paid,'total':total,'start':raw['start_date']??dateKey(today),'isCustom':true,'cycles':[{'start':raw['start_date']??dateKey(today),'end':raw['start_date']??dateKey(today),'total':total,'index':1}]});}
    await saveBillSnapshot(rows);
  }
}

// Workmanager callbacks run in a background isolate; keep all shared state local.
@pragma('vm:entry-point') void reminderCallbackDispatcher(){Workmanager().executeTask((task,inputData)async{await _notifications.initialize(settings:const InitializationSettings(android:AndroidInitializationSettings('@mipmap/ic_launcher')));final prefs=await SharedPreferences.getInstance();if(!(prefs.getBool(_enabledKey)??false))return true;final raw=(jsonDecode(prefs.getString(_rowsKey)??'[]') as List).cast<Map>().map((x)=>Map<String,dynamic>.from(x)).toList();final now=DateTime.now().toUtc();final today=DateTime.utc(now.year,now.month,now.day);final groups=reminderCategories(raw,today);final overdue=(groups['pending']??[]).where((x)=>'${x['date']??''}'.compareTo(dateKey(today))<0).toList();final todayDue=groups['today']??[];final upcoming=groups['upcoming']??[];final combined=[...overdue,...todayDue,...upcoming];final history=(jsonDecode(prefs.getString(_historyKey)??'[]') as List).cast<Map>().map((x)=>Map<String,dynamic>.from(x)).toList();final key='${dateKey(today)}:';final byCustomer=<String,List<Map<String,dynamic>>>{};for(final row in combined){final customer='${row['mobile']??''}'.replaceAll(RegExp(r'\D'),'');byCustomer.putIfAbsent(customer.isEmpty?'${row['billNo']}':customer,()=>[]).add(row);}for(final entry in byCustomer.entries){final id=entry.key;if(history.any((x)=>x['key']=='$key$id'))continue;final text=entry.value.map((row){final kind=row['category']=='upcoming'?'Upcoming':row['category']=='today'?'Due today':'Pending';return '$kind · ${row['name']} · Bill #${row['billNo']} · ${moneyLabel(row['balance'])}';}).join('\n');final name='${entry.value.first['name']}';await _notifications.show(id:id.hashCode,title:'$name · Payment reminder',body:text,notificationDetails:const NotificationDetails(android:AndroidNotificationDetails('rental_payment_reminders','Daily customer reminders',importance:Importance.defaultImportance,priority:Priority.defaultPriority)));history.add({'key':'$key$id','name':name,'text':text,'date':dateKey(today)});}if(history.length>2000)history.removeRange(0,history.length-2000);await prefs.setString(_historyKey,jsonEncode(history));return true;});}

// Workmanager task's isolate does not have Riverpod; this proxy prevents accidental use there.
