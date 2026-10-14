package com.satraders.billing;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Locale;
import java.util.UUID;

public class PaymentNotificationService extends NotificationListenerService {
    private static final String PREFS="detected_payments",CHANNEL="detected_payments";
    public static synchronized JSONArray readCandidates(Context context){try{return new JSONArray(context.getSharedPreferences(PREFS,MODE_PRIVATE).getString("items","[]"));}catch(Exception e){return new JSONArray();}}
    public static synchronized void dismiss(Context context,String id){
        JSONArray rows=readCandidates(context);for(int i=0;i<rows.length();i++){JSONObject row=rows.optJSONObject(i);if(row!=null&&id.equals(row.optString("id")))try{row.put("dismissed",true);}catch(Exception ignored){}}
        context.getSharedPreferences(PREFS,MODE_PRIVATE).edit().putString("items",rows.toString()).apply();NotificationManagerCompat.from(context).cancel(id.hashCode());
    }
    private String source(String pkg){
        if(pkg.equals("com.google.android.apps.nbu.paisa.user"))return "GPay";
        if(pkg.equals("net.one97.paytm")||pkg.equals("com.paytm.business"))return "Paytm";
        if(pkg.equals("com.phonepe.app")||pkg.equals("com.phonepe.app.business"))return "PhonePe";
        if(pkg.equals("com.google.android.apps.messaging")||pkg.equals("com.samsung.android.messaging")||pkg.equals("com.android.mms"))return "SMS";
        if(pkg.equals("com.dreamplug.androidapp"))return "CRED";
        // Explicit source list; unrelated app notifications are never parsed or persisted.
        if(pkg.equals("com.pnbindia")||pkg.equals("com.Version1")||pkg.equals("com.snapwork.hdfc")||pkg.equals("com.csam.icici.bank.imobile")||pkg.equals("com.sbi.lotusintouch")||pkg.equals("com.sbi.SBIFreedomPlus")||pkg.equals("com.infrasoft.indianBank")||pkg.equals("com.axis.mobile"))return "Bank";
        return "";
    }
    @Override public void onNotificationPosted(StatusBarNotification sbn){
        String source=source(sbn.getPackageName());if(source.isEmpty())return;
        Notification n=sbn.getNotification();if((n.flags&Notification.FLAG_GROUP_SUMMARY)!=0)return;
        Bundle e=n.extras;if(e==null)return;
        String title=String.valueOf(e.getCharSequence(Notification.EXTRA_TITLE,""));
        String body=String.valueOf(e.getCharSequence(Notification.EXTRA_BIG_TEXT,e.getCharSequence(Notification.EXTRA_TEXT,"")));
        String text=title+" "+body;if(text.length()>6000)return;
        // SMS support uses visible message notifications, not inbox access.
        if(source.equals("SMS")&&!text.toLowerCase(Locale.ROOT).matches("(?s).*(?:\\bupi\\b|\\bacct\\b|\\ba/c\\b|\\baccount\\b).*(?:credited|received).*"))return;
        double amount=PaymentParser.amount(text);if(amount<=0)return;
        String reference=PaymentParser.reference(text);long now=System.currentTimeMillis();
        JSONObject candidate;
        synchronized(PaymentNotificationService.class){
            JSONArray items=readCandidates(this);
            for(int i=0;i<items.length();i++){
                JSONObject old=items.optJSONObject(i);if(old==null)continue;
                if(!reference.isEmpty()&&reference.equals(old.optString("reference")))return;
                if(sbn.getKey().equals(old.optString("notificationKey"))&&now-old.optLong("receivedAt")<86400000L)return;
                if(source.equals(old.optString("source"))&&text.equals(old.optString("text"))&&now-old.optLong("receivedAt")<120000L)return;
            }
            try{candidate=new JSONObject().put("id",UUID.randomUUID().toString()).put("amount",amount).put("source",source.equals("SMS")?"Bank":source).put("reference",reference).put("receivedAt",now).put("text",text).put("notificationKey",sbn.getKey()).put("dismissed",false);
                // Keep a bounded device-local review history, including duplicate markers.
                JSONArray next=new JSONArray();for(int i=Math.max(0,items.length()-999);i<items.length();i++)next.put(items.get(i));next.put(candidate);
                getSharedPreferences(PREFS,MODE_PRIVATE).edit().putString("items",next.toString()).apply();
            }catch(Exception ignored){return;}
        }
        if(Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(this,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
        try{
            NotificationManager manager=getSystemService(NotificationManager.class);manager.createNotificationChannel(new NotificationChannel(CHANNEL,"Detected payments",NotificationManager.IMPORTANCE_DEFAULT));
            Intent open=new Intent(this,MainActivity.class).putExtra("screen","notifications").addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent intent=PendingIntent.getActivity(this,7001,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            String id=candidate.optString("id");
            NotificationManagerCompat.from(this).notify(id.hashCode(),new NotificationCompat.Builder(this,CHANNEL).setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("Payment detected · ₹"+amount).setContentText(source+" · Tap to choose customer and bill").setContentIntent(intent).setAutoCancel(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).build());
        }catch(SecurityException ignored){}
    }
}
