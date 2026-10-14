package com.satraders.billing;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FirebaseFirestoreSettings;

import java.io.File;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.io.FileOutputStream;

public class MainActivity extends Activity {
    private static final String HOME = "https://appassets.androidplatform.net/assets/index.html";
    private static boolean firestoreConfigured;
    private WebView webView;
    private static final int IMPORT_BACKUP = 1402;
    private static final int EXPORT_BACKUP = 1403;
    private File pendingExport;
    private volatile String pendingRoute;
    @Override protected void onResume(){super.onResume();
        if(android.os.Build.VERSION.SDK_INT>=33&&NotificationManagerCompatAccess()&&!getPreferences(MODE_PRIVATE).getBoolean("payment_notification_permission_asked",false)&&ContextCompat.checkSelfPermission(this,android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED){getPreferences(MODE_PRIVATE).edit().putBoolean("payment_notification_permission_asked",true).apply();ActivityCompat.requestPermissions(this,new String[]{android.Manifest.permission.POST_NOTIFICATIONS},1401);}
        if(webView!=null)webView.evaluateJavascript("window.dispatchEvent(new Event('sa:native-resume'))",null);}
    private boolean NotificationManagerCompatAccess(){return androidx.core.app.NotificationManagerCompat.getEnabledListenerPackages(this).contains(getPackageName());}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);acceptRoute(intent);if(webView!=null)webView.evaluateJavascript("window.dispatchEvent(new Event('sa:native-resume'))",null);}
    private void acceptRoute(Intent intent){if(intent!=null&&"notifications".equals(intent.getStringExtra("screen")))pendingRoute="notifications";}

    private static final int MAX_BACKUP_BYTES = 20 * 1024 * 1024;

    private static synchronized void configureFirestore() {
        if (firestoreConfigured) return;
        FirebaseFirestore firestore=FirebaseFirestore.getInstance();
        try { firestore.setFirestoreSettings(new FirebaseFirestoreSettings.Builder().setPersistenceEnabled(true).setCacheSizeBytes(FirebaseFirestoreSettings.CACHE_SIZE_UNLIMITED).build()); }
        catch (IllegalStateException ignored) { /* Already started with Android's persistent cache. */ }
        firestoreConfigured=true;
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(244,248,252));getWindow().setNavigationBarColor(Color.WHITE);getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        acceptRoute(getIntent());
        if(savedInstanceState!=null){String exportPath=savedInstanceState.getString("pending_export_path");if(exportPath!=null){File restored=new File(exportPath);if(new File(getCacheDir(),"shared-backups").equals(restored.getParentFile()))pendingExport=restored;}}
        configureFirestore();
        webView=new WebView(this);webView.setBackgroundColor(Color.WHITE);webView.setLayerType(View.LAYER_TYPE_HARDWARE,null);setContentView(webView);
        WebSettings settings=webView.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setDatabaseEnabled(true);settings.setCacheMode(WebSettings.LOAD_DEFAULT);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setSupportZoom(false);settings.setBuiltInZoomControls(false);settings.setDisplayZoomControls(false);settings.setMediaPlaybackRequiresUserGesture(true);
        WebViewAssetLoader loader=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
        webView.setWebViewClient(new WebViewClientCompat(){@Override public boolean shouldOverrideUrlLoading(WebView view,android.webkit.WebResourceRequest request){Uri uri=request.getUrl();return !"https".equals(uri.getScheme())||!"appassets.androidplatform.net".equals(uri.getHost());}@Override public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view,android.webkit.WebResourceRequest request){return loader.shouldInterceptRequest(request.getUrl());}});
        webView.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onJsConfirm(WebView view,String url,String message,JsResult result){
                new AlertDialog.Builder(MainActivity.this).setTitle("S.A Traders")
                    .setMessage(message).setPositiveButton("Confirm",(dialog,which)->result.confirm())
                    .setNegativeButton("Cancel",(dialog,which)->result.cancel())
                    .setOnCancelListener(dialog->result.cancel()).show();
                return true;
            }
        });webView.addJavascriptInterface(new AndroidBridge(this),"Android");webView.addJavascriptInterface(new FirebaseBridge(this,webView),"FirebaseDB");BillingReminderWorker.restoreSchedule(this);
        if(savedInstanceState==null)webView.loadUrl(HOME);else webView.restoreState(savedInstanceState);
    }
    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode==EXPORT_BACKUP){
            File file=pendingExport;pendingExport=null;
            if(resultCode!=RESULT_OK||data==null||data.getData()==null||file==null){if(file!=null)file.delete();return;}
            Uri target=data.getData();
            new Thread(()->{try(java.io.OutputStream output=getContentResolver().openOutputStream(target,"wt");InputStream input=new java.io.FileInputStream(file)){
                if(output==null)throw new IllegalArgumentException("Could not write to this location.");
                byte[] buffer=new byte[8192];int count;while((count=input.read(buffer))!=-1)output.write(buffer,0,count);
                runOnUiThread(()->Toast.makeText(this,"Backup saved",Toast.LENGTH_LONG).show());
            }catch(Exception error){runOnUiThread(()->Toast.makeText(this,"Backup save failed: "+error.getMessage(),Toast.LENGTH_LONG).show());}finally{file.delete();}},"backup-writer").start();return;
        }
        if(requestCode!=IMPORT_BACKUP||resultCode!=RESULT_OK||data==null||data.getData()==null)return;
        Uri uri=data.getData();
        new Thread(()->{
            try(InputStream input=getContentResolver().openInputStream(uri);
                ByteArrayOutputStream output=new ByteArrayOutputStream()){
                if(input==null)throw new IllegalArgumentException("Could not open this backup.");
                byte[] buffer=new byte[8192];int count;
                while((count=input.read(buffer))!=-1){
                    if(output.size()+count>MAX_BACKUP_BYTES)throw new IllegalArgumentException("Backup exceeds the 20 MB limit.");
                    output.write(buffer,0,count);
                }
                if(output.size()==0)throw new IllegalArgumentException("The selected backup is empty.");
                String base64=Base64.encodeToString(output.toByteArray(),Base64.NO_WRAP);
                runOnUiThread(()->{if(!isFinishing()&&!isDestroyed())webView.evaluateJavascript("SA.receiveBackupBase64('"+base64+"')",null);});
            }catch(Exception error){runOnUiThread(()->Toast.makeText(this,"Backup read failed: "+error.getMessage(),Toast.LENGTH_LONG).show());}
        },"backup-reader").start();
    }
    @Override protected void onSaveInstanceState(Bundle out){webView.saveState(out);if(pendingExport!=null)out.putString("pending_export_path",pendingExport.getAbsolutePath());super.onSaveInstanceState(out);}
    @Override public void onBackPressed(){if(webView==null){super.onBackPressed();return;}webView.evaluateJavascript("(function(){if(document.querySelector('#modal.show')){SA.closeModal();return true;}if(document.querySelector('#uxMenu.open')){SA.closeMenu();return true;}return false;})()",handled->{if(!"true".equals(handled)){if(webView.canGoBack())webView.goBack();else super.onBackPressed();}});}

    private final class AndroidBridge {
        private final Context context;AndroidBridge(Context context){this.context=context;}
        @JavascriptInterface public String consumeNotificationRoute(){String route=pendingRoute;pendingRoute=null;return route==null?"":route;}
        @JavascriptInterface public String paymentCandidates(){return PaymentNotificationService.readCandidates(context).toString();}
        @JavascriptInterface public void dismissPaymentCandidate(String id){PaymentNotificationService.dismiss(context,id);}
        @JavascriptInterface public boolean paymentAccessEnabled(){return androidx.core.app.NotificationManagerCompat.getEnabledListenerPackages(context).contains(getPackageName());}
        @JavascriptInterface public void openPaymentAccess(){runOnUiThread(()->new AlertDialog.Builder(MainActivity.this).setTitle("Payment detection")
            .setMessage("Allow Notification Access in Android settings to detect incoming GPay, Paytm, PhonePe and bank payment alerts. Android grants broad notification access; S.A Traders processes only supported payment sources. Suggestions stay on this phone until you confirm a payment. Notification text is not bank verification.")
            .setPositiveButton("Open settings",(d,w)->{try{startActivity(new Intent(android.provider.Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));}catch(Exception e){Toast.makeText(context,"Notification Access settings unavailable",Toast.LENGTH_LONG).show();}}).setNegativeButton("Cancel",null).show());}
        @JavascriptInterface public String reminderHistory(){return getSharedPreferences("billing_reminders",MODE_PRIVATE).getString("history","[]");}
        private File backupFile(String name,String text)throws Exception{
            if(text==null||text.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>MAX_BACKUP_BYTES)throw new IllegalArgumentException("Backup exceeds the 20 MB limit.");
            File dir=new File(getCacheDir(),"shared-backups");if(!dir.exists()&&!dir.mkdirs())throw new java.io.IOException("Could not prepare backup");
            File[] old=dir.listFiles();if(old!=null)for(File f:old)if(f.lastModified()<System.currentTimeMillis()-86400000L)f.delete();
            String safe=(name==null?"backup.json":name).replaceAll("[^a-zA-Z0-9._-]","-");
            File file=File.createTempFile("sa-","-"+safe,dir);try(FileOutputStream out=new FileOutputStream(file)){out.write(text.getBytes(java.nio.charset.StandardCharsets.UTF_8));}return file;
        }
        @JavascriptInterface public void exportText(String name,String mime,String text){try{
            File file=backupFile(name,text);runOnUiThread(()->{if(pendingExport!=null){file.delete();Toast.makeText(context,"Finish the current save first",Toast.LENGTH_LONG).show();return;}pendingExport=file;
                try{Intent save=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime);save.putExtra(Intent.EXTRA_TITLE,name);startActivityForResult(save,EXPORT_BACKUP);}
                catch(Exception e){pendingExport=null;file.delete();Toast.makeText(context,"Could not open Save file",Toast.LENGTH_LONG).show();}});
        }catch(Exception e){toast("Backup save failed: "+e.getMessage());}}
        @JavascriptInterface public void shareText(String name,String mime,String text){try{
            File file=backupFile(name+".json",text);Uri uri=FileProvider.getUriForFile(MainActivity.this,getPackageName()+".invoicefiles",file);
            runOnUiThread(()->{try{Intent share=new Intent(Intent.ACTION_SEND).setType(mime);share.putExtra(Intent.EXTRA_STREAM,uri);share.setClipData(ClipData.newUri(getContentResolver(),"Backup",uri));share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);startActivity(Intent.createChooser(share,"Share backup JSON"));}catch(Exception e){toast("No app available to share this backup");}});
        }catch(Exception e){toast("Backup share failed: "+e.getMessage());}}
        @JavascriptInterface public void importBackup(){runOnUiThread(()->{
            try{
                Intent picker=new Intent(Intent.ACTION_OPEN_DOCUMENT);
                picker.addCategory(Intent.CATEGORY_OPENABLE);
                // JSON backups are often labelled text/plain or octet-stream by storage providers.
                picker.setType("*/*");picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                startActivityForResult(picker,IMPORT_BACKUP);
            }catch(Exception error){Toast.makeText(context,"Could not open the file picker.",Toast.LENGTH_LONG).show();}
        });}
        @JavascriptInterface public void toast(String message){runOnUiThread(()->Toast.makeText(context,message,Toast.LENGTH_SHORT).show());}
        @JavascriptInterface public void printPage(String jobName){runOnUiThread(()->{String name=jobName==null||jobName.trim().isEmpty()?"S.A Traders Invoice":jobName.trim();((PrintManager)getSystemService(Context.PRINT_SERVICE)).print(name,webView.createPrintDocumentAdapter(name),new PrintAttributes.Builder().build());});}
        private String normalizeIndianMobile(String mobile){if(mobile==null)return null;String value=mobile.replaceAll("\\D","");if(value.length()==10)value="91"+value;return value.length()==12&&value.startsWith("91")?value:null;}
        private String installedWhatsAppPackage(){for(String name:new String[]{"com.whatsapp","com.whatsapp.w4b"})try{getPackageManager().getPackageInfo(name,0);return name;}catch(Exception ignored){}return null;}
        @JavascriptInterface public String openWhatsAppChat(String mobile){String value=normalizeIndianMobile(mobile),pkg=installedWhatsAppPackage();if(value==null)return "Enter a valid 10-digit customer mobile number.";if(pkg==null)return "WhatsApp is not installed on this phone.";runOnUiThread(()->{try{Intent i=new Intent(Intent.ACTION_VIEW,Uri.parse("https://wa.me/"+value));i.setPackage(pkg);startActivity(i);}catch(Exception e){Toast.makeText(context,"This customer could not be opened in WhatsApp.",Toast.LENGTH_LONG).show();}});return "ok";}
        @JavascriptInterface public void callCustomer(String mobile){String value=mobile==null?"":mobile.replaceAll("[^0-9+]","");if(!value.isEmpty())runOnUiThread(()->startActivity(new Intent(Intent.ACTION_DIAL,Uri.parse("tel:"+value))));}
        private Uri cacheInvoiceImage(String data,String name)throws Exception{if(data==null||!data.startsWith("data:image/png;base64,")||data.length()>16*1024*1024)throw new IllegalArgumentException("Invalid or oversized invoice image.");byte[] bytes=Base64.decode(data.substring("data:image/png;base64,".length()),Base64.DEFAULT);if(bytes.length<8||bytes[0]!=(byte)137||bytes[1]!=80||bytes[2]!=78||bytes[3]!=71)throw new IllegalArgumentException("Invalid invoice image.");BitmapFactory.Options o=new BitmapFactory.Options();o.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(bytes,0,bytes.length,o);if(o.outWidth<=0||o.outHeight<=0||(long)o.outWidth*o.outHeight>16_000_000L)throw new IllegalArgumentException("Invoice image is too large. Use Print / Save PDF.");File dir=new File(getCacheDir(),"shared-invoices");if(!dir.exists()&&!dir.mkdirs())throw new IllegalArgumentException("Could not prepare invoice sharing.");File[] oldFiles=dir.listFiles();if(oldFiles!=null)for(File old:oldFiles)if(old.isFile()&&old.lastModified()<System.currentTimeMillis()-86_400_000L)old.delete();String safe=(name==null?"SA-Traders-Invoice":name).replaceAll("[^a-zA-Z0-9_-]","-");if(safe.length()<3)safe="SA-"+safe;if(safe.length()>80)safe=safe.substring(0,80);File file=File.createTempFile(safe+"-",".png",dir);try(FileOutputStream out=new FileOutputStream(file)){out.write(bytes);}return FileProvider.getUriForFile(MainActivity.this,getPackageName()+".invoicefiles",file);}
        private Intent imageIntent(Uri uri){Intent i=new Intent(Intent.ACTION_SEND);i.setType("image/png");i.putExtra(Intent.EXTRA_STREAM,uri);i.putExtra(Intent.EXTRA_TITLE,"S.A Traders invoice");i.setClipData(ClipData.newUri(getContentResolver(),"Invoice",uri));i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);return i;}
        @JavascriptInterface public String shareInvoiceImage(String data,String name){try{Uri uri=cacheInvoiceImage(data,name);runOnUiThread(()->startActivity(Intent.createChooser(imageIntent(uri),"Share invoice image")));return "ok";}catch(Exception e){return e.getMessage()==null?"Could not prepare the invoice image. Please retry.":e.getMessage();}}
        @JavascriptInterface public String shareInvoiceToWhatsApp(String data,String name,String mobile){String value=normalizeIndianMobile(mobile),pkg=installedWhatsAppPackage();if(value==null)return "Enter a valid 10-digit customer mobile number.";if(pkg==null)return "WhatsApp is not installed on this phone.";try{Uri uri=cacheInvoiceImage(data,name);runOnUiThread(()->{Intent i=imageIntent(uri);i.setPackage(pkg);i.putExtra("jid",value+"@s.whatsapp.net");i.putExtra(Intent.EXTRA_TEXT,"S.A Traders rental bill");startActivity(i);});return "ok";}catch(Exception e){return e.getMessage()==null?"Could not prepare the WhatsApp invoice.":e.getMessage();}}
        @JavascriptInterface public void syncBillReminders(String json,boolean enabled,int days){if(json==null||json.length()>8*1024*1024){toast("Reminder list is too large to sync on this phone.");return;}int interval=days==3?3:days==7?7:1;BillingReminderWorker.saveAndSchedule(context,json,enabled,interval);if(enabled&&android.os.Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(MainActivity.this,android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED)runOnUiThread(()->ActivityCompat.requestPermissions(MainActivity.this,new String[]{android.Manifest.permission.POST_NOTIFICATIONS},1401));}
    }
}
