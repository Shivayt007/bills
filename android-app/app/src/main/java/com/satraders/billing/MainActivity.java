package com.satraders.billing;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.ClipData;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.util.Base64;
import android.graphics.BitmapFactory;
import java.io.File;
import java.io.FileOutputStream;
import androidx.core.app.ActivityCompat;
import androidx.core.content.FileProvider;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

public class MainActivity extends Activity {
    private WebView webView;
    private static final String HOME = "https://appassets.androidplatform.net/assets/index.html";

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(255, 249, 239));
        getWindow().setNavigationBarColor(Color.rgb(255, 249, 239));
        getWindow().getDecorView().setSystemUiVisibility(
                android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR |
                android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(255, 249, 239));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(true);

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClientCompat() {
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(
                    WebView view,
                    android.webkit.WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }
        });
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new AndroidBridge(this), "Android");
        BillingReminderWorker.restoreSchedule(this);

        if (savedInstanceState == null) {
            webView.loadUrl(HOME);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView == null) { super.onBackPressed(); return; }
        webView.evaluateJavascript("(function(){if(document.querySelector('#modal.show')){SA.closeModal();return true;}if(document.querySelector('#uxMenu.open')){SA.closeMenu();return true;}return false;})()", handled -> {
            if (!"true".equals(handled)) {
                if (webView.canGoBack()) webView.goBack();
                else MainActivity.super.onBackPressed();
            }
        });
    }

    private class AndroidBridge {
        private final Context context;
        AndroidBridge(Context context) { this.context = context; }

        @JavascriptInterface
        public void toast(String message) {
            runOnUiThread(() -> Toast.makeText(context, message, Toast.LENGTH_SHORT).show());
        }

        // Accept only a bounded PNG and share a private cache URI with temporary read access.
        @JavascriptInterface
        public String shareInvoiceImage(String dataUrl, String proposedName) {
            try {
                Uri uri = cacheInvoiceImage(dataUrl, proposedName);
                runOnUiThread(() -> {
                    try {
                        Intent send = imageSendIntent(uri);
                        Intent chooser = Intent.createChooser(send, "Share invoice image");
                        chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(chooser);
                    } catch (Exception e) {
                        Toast.makeText(context, "Could not open sharing. Please try again.", Toast.LENGTH_LONG).show();
                    }
                });
                return "ok";
            } catch (IllegalArgumentException e) {
                return e.getMessage();
            } catch (Exception e) {
                return "Could not prepare the invoice image. Please retry.";
            }
        }

        @JavascriptInterface
        public String shareInvoiceToWhatsApp(String dataUrl, String proposedName, String mobile) {
            String number = normalizeIndianMobile(mobile);
            if (number == null) return "Enter a valid 10-digit customer mobile number.";
            String target = installedWhatsAppPackage();
            if (target == null) return "WhatsApp is not installed on this phone.";
            try {
                Uri uri = cacheInvoiceImage(dataUrl, proposedName);
                runOnUiThread(() -> {
                    try {
                        Intent send = imageSendIntent(uri);
                        send.setPackage(target);
                        send.putExtra("jid", number + "@s.whatsapp.net");
                        send.putExtra(Intent.EXTRA_TEXT, "S.A Traders rental bill");
                        startActivity(send);
                    } catch (Exception e) {
                        Toast.makeText(context, "Could not open this customer in WhatsApp.", Toast.LENGTH_LONG).show();
                    }
                });
                return "ok";
            } catch (IllegalArgumentException e) {
                return e.getMessage();
            } catch (Exception e) {
                return "Could not prepare the WhatsApp invoice.";
            }
        }

        @JavascriptInterface
        public String openWhatsAppChat(String mobile) {
            String number = normalizeIndianMobile(mobile);
            if (number == null) return "Enter a valid 10-digit customer mobile number.";
            String target = installedWhatsAppPackage();
            if (target == null) return "WhatsApp is not installed on this phone.";
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/" + number));
                    intent.setPackage(target);
                    startActivity(intent);
                } catch (Exception e) {
                    Toast.makeText(context, "This customer could not be opened in WhatsApp.", Toast.LENGTH_LONG).show();
                }
            });
            return "ok";
        }

        @JavascriptInterface
        public void callCustomer(String mobile) {
            String clean = mobile == null ? "" : mobile.replaceAll("[^0-9+]", "");
            if (clean.isEmpty()) return;
            runOnUiThread(() -> startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + clean))));
        }

        @JavascriptInterface
        public void syncBillReminders(String json, boolean enabled, int intervalDays) {
            if (json == null || json.length() > 1024 * 1024) return;
            int safeDays = intervalDays == 3 ? 3 : intervalDays == 7 ? 7 : 1;
            BillingReminderWorker.saveAndSchedule(context, json, enabled, safeDays);
            if (enabled && Build.VERSION.SDK_INT >= 33 &&
                    ActivityCompat.checkSelfPermission(MainActivity.this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                runOnUiThread(() -> ActivityCompat.requestPermissions(MainActivity.this,
                        new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1401));
            }
        }

        private Intent imageSendIntent(Uri uri) {
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType("image/png");
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_TITLE, "S.A Traders invoice");
            send.setClipData(ClipData.newUri(getContentResolver(), "Invoice", uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            return send;
        }

        private Uri cacheInvoiceImage(String dataUrl, String proposedName) throws Exception {
            final String prefix = "data:image/png;base64,";
            if (dataUrl == null || !dataUrl.startsWith(prefix) || dataUrl.length() > 16 * 1024 * 1024) {
                throw new IllegalArgumentException("Invalid or oversized invoice image.");
            }
            byte[] bytes = Base64.decode(dataUrl.substring(prefix.length()), Base64.DEFAULT);
            if (bytes.length < 8 || bytes[0] != (byte)137 || bytes[1] != 80 || bytes[2] != 78 || bytes[3] != 71) {
                throw new IllegalArgumentException("Invalid invoice image.");
            }
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
            if (options.outWidth <= 0 || options.outHeight <= 0 || (long) options.outWidth * options.outHeight > 16000000L) {
                throw new IllegalArgumentException("Invoice image is too large. Use Print / Save PDF.");
            }
            File directory = new File(getCacheDir(), "shared-invoices");
            if (!directory.exists() && !directory.mkdirs()) throw new IllegalArgumentException("Could not prepare invoice sharing.");
            File[] oldFiles = directory.listFiles();
            if (oldFiles != null) for (File old : oldFiles) if (old.isFile() && old.lastModified() < System.currentTimeMillis() - 86400000L) old.delete();
            String name = proposedName == null ? "SA-Traders-Invoice" : proposedName;
            name = name.replaceAll("[^a-zA-Z0-9_-]", "-");
            if (name.length() > 80) name = name.substring(0, 80);
            File image = File.createTempFile(name + "-", ".png", directory);
            try (FileOutputStream output = new FileOutputStream(image)) { output.write(bytes); }
            return FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".invoicefiles", image);
        }

        private String normalizeIndianMobile(String mobile) {
            if (mobile == null) return null;
            String digits = mobile.replaceAll("\\D", "");
            if (digits.length() == 10) digits = "91" + digits;
            if (digits.length() == 12 && digits.startsWith("91")) return digits;
            return null;
        }

        private String installedWhatsAppPackage() {
            for (String packageName : new String[]{"com.whatsapp", "com.whatsapp.w4b"}) {
                try { getPackageManager().getPackageInfo(packageName, 0); return packageName; }
                catch (PackageManager.NameNotFoundException ignored) { }
            }
            return null;
        }

        @JavascriptInterface
        public void printPage(String jobName) {
            runOnUiThread(() -> {
                String safeName = (jobName == null || jobName.trim().isEmpty())
                        ? "S.A Traders Invoice" : jobName.trim();
                PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(safeName);
                printManager.print(safeName, adapter, new PrintAttributes.Builder().build());
            });
        }
    }
}

