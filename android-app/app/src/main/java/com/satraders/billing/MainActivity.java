package com.satraders.billing;

import android.annotation.SuppressLint;
import android.app.Activity;
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
import java.io.FileOutputStream;

public class MainActivity extends Activity {
    private static final String HOME = "https://appassets.androidplatform.net/assets/index.html";
    private static boolean firestoreConfigured;
    private WebView webView;

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
        configureFirestore();
        webView=new WebView(this);webView.setBackgroundColor(Color.WHITE);webView.setLayerType(View.LAYER_TYPE_HARDWARE,null);setContentView(webView);
        WebSettings settings=webView.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setDatabaseEnabled(true);settings.setCacheMode(WebSettings.LOAD_DEFAULT);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setSupportZoom(false);settings.setBuiltInZoomControls(false);settings.setDisplayZoomControls(false);settings.setMediaPlaybackRequiresUserGesture(true);
        WebViewAssetLoader loader=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
        webView.setWebViewClient(new WebViewClientCompat(){@Override public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view,android.webkit.WebResourceRequest request){return loader.shouldInterceptRequest(request.getUrl());}});
        webView.setWebChromeClient(new WebChromeClient());webView.addJavascriptInterface(new AndroidBridge(this),"Android");webView.addJavascriptInterface(new FirebaseBridge(this,webView),"FirebaseDB");BillingReminderWorker.restoreSchedule(this);
        if(savedInstanceState==null)webView.loadUrl(HOME);else webView.restoreState(savedInstanceState);
    }
    @Override protected void onSaveInstanceState(Bundle out){webView.saveState(out);super.onSaveInstanceState(out);}
    @Override public void onBackPressed(){if(webView==null){super.onBackPressed();return;}webView.evaluateJavascript("(function(){if(document.querySelector('#modal.show')){SA.closeModal();return true;}if(document.querySelector('#uxMenu.open')){SA.closeMenu();return true;}return false;})()",handled->{if(!"true".equals(handled)){if(webView.canGoBack())webView.goBack();else super.onBackPressed();}});}

    private final class AndroidBridge {
        private final Context context;AndroidBridge(Context context){this.context=context;}
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
        @JavascriptInterface public void syncBillReminders(String json,boolean enabled,int days){if(json==null||json.length()>1024*1024)return;int interval=days==3?3:days==7?7:1;BillingReminderWorker.saveAndSchedule(context,json,enabled,interval);if(enabled&&android.os.Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(MainActivity.this,android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED)runOnUiThread(()->ActivityCompat.requestPermissions(MainActivity.this,new String[]{android.Manifest.permission.POST_NOTIFICATIONS},1401));}
    }
}
