package com.satraders.billing;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.work.*;
import org.json.JSONArray;
import org.json.JSONObject;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

public class BillingReminderWorker extends Worker {
    private static final String PREFS="billing_reminders",CHANNEL="rental_payment_reminders";
    private static final String PERIODIC="sa-traders-balance-reminders",IMMEDIATE="sa-traders-reminder-check";
    public BillingReminderWorker(@NonNull Context c,@NonNull WorkerParameters p){super(c,p);}
    public static void saveAndSchedule(Context c,String json,boolean enabled,int days){
        SharedPreferences p=c.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        boolean wasEnabled=p.getBoolean("enabled",false);
        p.edit().putString("open_bills_json",json).putBoolean("enabled",enabled).putInt("interval_days",1).putLong("synced_at",System.currentTimeMillis()).apply();
        if(enabled){schedule(c,!wasEnabled);}
        else{WorkManager.getInstance(c).cancelUniqueWork(PERIODIC);WorkManager.getInstance(c).cancelUniqueWork(IMMEDIATE);WorkManager.getInstance(c).cancelAllWorkByTag("reminder-pages");}
    }
    public static void restoreSchedule(Context c){if(c.getSharedPreferences(PREFS,Context.MODE_PRIVATE).getBoolean("enabled",false))schedule(c,false);}
    private static void schedule(Context c,boolean immediate){
        WorkManager.getInstance(c).enqueueUniquePeriodicWork(PERIODIC,ExistingPeriodicWorkPolicy.KEEP,new PeriodicWorkRequest.Builder(BillingReminderWorker.class,24,TimeUnit.HOURS).build());
        if(immediate)WorkManager.getInstance(c).enqueueUniqueWork(IMMEDIATE,ExistingWorkPolicy.KEEP,new OneTimeWorkRequest.Builder(BillingReminderWorker.class).setInitialDelay(5,TimeUnit.SECONDS).build());
    }
    @NonNull @Override public Result doWork(){
        Context c=getApplicationContext();SharedPreferences p=c.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        if(!p.getBoolean("enabled",false))return Result.success();
        if(Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(c,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return Result.success();
        if(!NotificationManagerCompat.from(c).areNotificationsEnabled())return Result.success();
        try{
            String today=LocalDate.now().toString(),token=getInputData().getString("date");int offset=getInputData().getInt("offset",0);
            if(token==null){if(today.equals(p.getString("last_date","")))return Result.success();token=today;}
            else if(!today.equals(token)||!token.equals(p.getString("last_date","")))return Result.success();
            JSONArray customers=buildCustomers(new JSONArray(p.getString("open_bills_json","[]")),LocalDate.now());
            NotificationManager manager=c.getSystemService(NotificationManager.class);
            manager.createNotificationChannel(new NotificationChannel(CHANNEL,"Daily customer reminders",NotificationManager.IMPORTANCE_DEFAULT));
            if(manager.getNotificationChannel(CHANNEL).getImportance()==NotificationManager.IMPORTANCE_NONE)return Result.success();
            JSONArray history=new JSONArray(p.getString("history","[]"));
            int end=Math.min(customers.length(),offset+20);
            for(int index=offset;index<end;index++){
                JSONObject customer=customers.getJSONObject(index);String key=token+":"+customer.getString("key");
                boolean delivered=false;for(int h=history.length()-1;h>=0;h--)if(key.equals(history.getJSONObject(h).optString("key"))){delivered=true;break;}
                if(delivered)continue;
                Intent open=new Intent(c,MainActivity.class).putExtra("screen","notifications").addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
                PendingIntent pending=PendingIntent.getActivity(c,7002,open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
                NotificationCompat.Builder n=new NotificationCompat.Builder(c,CHANNEL).setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle(customer.getString("name")+" · Payment reminder").setContentText(customer.getString("text")).setStyle(new NotificationCompat.BigTextStyle().bigText(customer.getString("text"))).setContentIntent(pending).setAutoCancel(true).setVisibility(NotificationCompat.VISIBILITY_PRIVATE).setGroup("sa-daily-reminders");
                // Large customer lists are paged to stay within Android notification limits.
                if(customers.length()>20)n.setTimeoutAfter(60000);
                NotificationManagerCompat.from(c).notify(("reminder:"+customer.getString("key")).hashCode(),n.build());
                history.put(new JSONObject().put("key",key).put("date",token).put("name",customer.getString("name")).put("text",customer.getString("text")));
            }
            JSONArray bounded=new JSONArray();for(int h=Math.max(0,history.length()-2000);h<history.length();h++)bounded.put(history.get(h));
            p.edit().putString("last_date",token).putString("history",bounded.toString()).apply();
            if(end<customers.length())WorkManager.getInstance(c).enqueue(new OneTimeWorkRequest.Builder(BillingReminderWorker.class).setInputData(new Data.Builder().putString("date",token).putInt("offset",end).build()).setInitialDelay(75,TimeUnit.SECONDS).addTag("reminder-pages").build());
            return Result.success();
        }catch(SecurityException ignored){return Result.success();}catch(Exception e){return Result.retry();}
    }
    static JSONArray buildCustomers(JSONArray bills,LocalDate date)throws Exception{
        Map<String,JSONObject> customers=new LinkedHashMap<>();String today=date.toString(),limit=date.plusDays(7).toString();
        for(int i=0;i<bills.length();i++){
            JSONObject b=bills.optJSONObject(i);if(b==null)continue;JSONArray cycles=b.optJSONArray("cycles");if(cycles==null)continue;
            double total=b.optBoolean("isCustom")?b.optDouble("total"):0;JSONObject due=null,next=null;
            for(int j=0;j<cycles.length();j++){JSONObject cycle=cycles.getJSONObject(j);String start=cycle.optString("start");if(start.compareTo(today)<=0){if(!b.optBoolean("isCustom"))total+=cycle.optDouble("total");if(start.equals(today))due=cycle;}else if(next==null&&start.compareTo(limit)<=0&&cycle.optDouble("total")>0)next=cycle;}
            if(next!=null){double dueThroughNext=0;for(int j=0;j<cycles.length();j++){JSONObject cycle=cycles.getJSONObject(j);if(cycle.optString("start").compareTo(next.optString("start"))<=0)dueThroughNext+=cycle.optDouble("total");}if(dueThroughNext<=b.optDouble("paid"))next=null;}
            double balance=Math.max(0,Math.round((total-b.optDouble("paid"))*100)/100.0);
            if(balance<=0&&next==null)continue;
            String mobile=b.optString("mobile").replaceAll("\\D","");if(mobile.length()==12&&mobile.startsWith("91"))mobile=mobile.substring(2);
            String key=!mobile.isEmpty()?mobile:(b.optBoolean("isCustom")?"custom:":"bill:")+b.optString("billNo");
            JSONObject customer=customers.get(key);if(customer==null){customer=new JSONObject().put("key",key).put("name",b.optString("name","Customer")).put("text","");customers.put(key,customer);}
            String text=(b.optBoolean("isCustom")?"Custom #":"Bill #")+b.optString("billNo")+": ";
            if(balance>0)text+=(due!=null?"Due today":"Pending")+" ₹"+String.format(java.util.Locale.US,"%.2f",balance)+". ";
            if(next!=null)text+="Upcoming "+next.optString("start")+" · ₹"+String.format(java.util.Locale.US,"%.2f",next.optDouble("total"))+". ";
            customer.put("text",customer.getString("text")+text+"\n");
        }
        JSONArray result=new JSONArray();for(JSONObject value:customers.values())result.put(value);return result;
    }
}
