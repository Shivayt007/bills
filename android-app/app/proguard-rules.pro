# JavaScript calls these methods by their original Java names.
-keepattributes RuntimeVisibleAnnotations,RuntimeInvisibleAnnotations,AnnotationDefault,Signature,InnerClasses,EnclosingMethod

-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keep class com.satraders.billing.FirebaseBridge {
    @android.webkit.JavascriptInterface <methods>;
}

-keep class com.satraders.billing.MainActivity$AndroidBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# WorkManager reconstructs workers by class name after the process restarts.
-keep class com.satraders.billing.BillingReminderWorker {
    public <init>(android.content.Context, androidx.work.WorkerParameters);
}

# Firestore uses Maps and org.json in this project, not reflective POJO models.
# Firebase, AndroidX and Guava provide their own consumer shrinker rules.
# No MongoDB, Retrofit, Gson or OkHttp dependency is present in this app.
