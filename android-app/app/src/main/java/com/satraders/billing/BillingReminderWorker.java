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
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.NumberFormat;
import java.time.LocalDate;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

public class BillingReminderWorker extends Worker {
    private static final String PREFS = "billing_reminders";
    private static final String KEY_JSON = "open_bills_json";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_DAYS = "interval_days";
    private static final String KEY_LAST = "last_notified_at";
    private static final String PERIODIC_WORK = "sa-traders-balance-reminders";
    private static final String IMMEDIATE_WORK = "sa-traders-reminder-check";
    private static final String CHANNEL = "rental_payment_reminders";

    public BillingReminderWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    public static void saveAndSchedule(Context context, String json, boolean enabled, int days) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(KEY_JSON, json)
                .putBoolean(KEY_ENABLED, enabled)
                .putInt(KEY_DAYS, days)
                .apply();
        if (enabled) {
            schedule(context, true);
        } else {
            WorkManager.getInstance(context).cancelUniqueWork(PERIODIC_WORK);
            WorkManager.getInstance(context).cancelUniqueWork(IMMEDIATE_WORK);
        }
    }

    public static void restoreSchedule(Context context) {
        if (context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_ENABLED, false)) {
            schedule(context, false);
        }
    }

    private static void schedule(Context context, boolean checkSoon) {
        PeriodicWorkRequest periodic = new PeriodicWorkRequest.Builder(
                BillingReminderWorker.class, 24, TimeUnit.HOURS, 2, TimeUnit.HOURS).build();
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                PERIODIC_WORK, ExistingPeriodicWorkPolicy.UPDATE, periodic);
        if (checkSoon) {
            OneTimeWorkRequest immediate = new OneTimeWorkRequest.Builder(BillingReminderWorker.class)
                    .setInitialDelay(15, TimeUnit.SECONDS).build();
            WorkManager.getInstance(context).enqueueUniqueWork(
                    IMMEDIATE_WORK, ExistingWorkPolicy.REPLACE, immediate);
        }
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!prefs.getBoolean(KEY_ENABLED, false)) return Result.success();
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(
                context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return Result.success();
        }
        int days = prefs.getInt(KEY_DAYS, 1);
        long now = System.currentTimeMillis();
        long last = prefs.getLong(KEY_LAST, 0L);
        if (last > 0 && now - last < TimeUnit.DAYS.toMillis(days) - TimeUnit.HOURS.toMillis(1)) {
            return Result.success();
        }
        try {
            JSONArray bills = new JSONArray(prefs.getString(KEY_JSON, "[]"));
            ensureChannel(context);
            int notified = 0;
            for (int index = 0; index < bills.length() && notified < 8; index++) {
                JSONObject bill = bills.optJSONObject(index);
                if (bill == null || bill.optDouble("balance", 0) <= 0 || !cycleStarted(bill)) continue;
                double cycleAmount = bill.optDouble("cycleAmount", 0);
                double cyclePaid = bill.optDouble("cyclePaid", 0);
                if (cycleAmount > 0 && cyclePaid + 0.005 >= cycleAmount) continue;
                notifyBill(context, bill);
                notified++;
            }
            if (notified > 0) prefs.edit().putLong(KEY_LAST, now).apply();
            return Result.success();
        } catch (Exception e) {
            return Result.failure();
        }
    }

    private boolean cycleStarted(JSONObject bill) {
        try {
            String start = bill.optString("cycleStart", "");
            return start.isEmpty() || !LocalDate.parse(start).isAfter(LocalDate.now());
        } catch (Exception ignored) {
            return true;
        }
    }

    private void notifyBill(Context context, JSONObject bill) {
        String name = bill.optString("name", "Customer");
        String billNo = bill.optString("billNo", "");
        int cycle = Math.max(1, bill.optInt("cycle", 1));
        double balance = bill.optDouble("balance", 0);
        String amount = NumberFormat.getCurrencyInstance(new Locale("en", "IN")).format(balance);
        Intent open = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(context, billNo.hashCode(), open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("Cycle #" + cycle + " payment pending")
                .setContentText(name + " · Balance " + amount)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(
                        name + " · Bill #" + billNo + " · Cycle #" + cycle + " has an unpaid balance of " + amount))
                .setContentIntent(pending)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setCategory(NotificationCompat.CATEGORY_REMINDER);
        NotificationManagerCompat.from(context).notify((billNo + "-" + cycle).hashCode(), notification.build());
    }

    private void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel channel = new NotificationChannel(CHANNEL,
                "Rental payment reminders", NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("Customer balance and unpaid rental-cycle reminders");
        manager.createNotificationChannel(channel);
    }
}
