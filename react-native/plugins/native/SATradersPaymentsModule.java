package com.satraders.billing;
import android.content.Intent;
import android.provider.Settings;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
public class SATradersPaymentsModule extends ReactContextBaseJavaModule {
 public SATradersPaymentsModule(ReactApplicationContext c){super(c);}
 @Override public String getName(){return "SATradersPayments";}
 @ReactMethod public void candidates(Promise p){p.resolve(PaymentNotificationService.readCandidates(getReactApplicationContext()).toString());}
 @ReactMethod public void dismiss(String id,Promise p){PaymentNotificationService.dismiss(getReactApplicationContext(),id);p.resolve(true);}
 @ReactMethod public void syncReminders(String json,boolean enabled,Promise p){BillingReminderWorker.saveAndSchedule(getReactApplicationContext(),json,enabled,1);p.resolve(true);}
 @ReactMethod public void reminderHistory(Promise p){p.resolve(getReactApplicationContext().getSharedPreferences("billing_reminders",0).getString("history","[]"));}
 @ReactMethod public void launchScreen(Promise p){android.app.Activity a=getCurrentActivity();String screen=a!=null?a.getIntent().getStringExtra("screen"):null;if(a!=null)a.getIntent().removeExtra("screen");p.resolve(screen);}
 @ReactMethod public void openSettings(){Intent i=new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);getReactApplicationContext().startActivity(i);}
}
