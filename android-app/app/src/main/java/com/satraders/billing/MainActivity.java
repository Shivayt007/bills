package com.satraders.billing;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.ClipData;
import android.net.Uri;
import android.util.Base64;
import android.graphics.BitmapFactory;
import java.io.File;
import java.io.FileOutputStream;
import androidx.core.content.FileProvider;
import android.graphics.Color;
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

        getWindow().setStatusBarColor(Color.rgb(11, 13, 18));
        getWindow().setNavigationBarColor(Color.rgb(11, 13, 18));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(11, 13, 18));
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
            final String prefix = "data:image/png;base64,";
            if (dataUrl == null || !dataUrl.startsWith(prefix) || dataUrl.length() > 16 * 1024 * 1024) {
                return "Invalid or oversized invoice image.";
            }
            try {
                byte[] bytes = Base64.decode(dataUrl.substring(prefix.length()), Base64.DEFAULT);
                if (bytes.length < 8 || bytes[0] != (byte)137 || bytes[1] != 80 || bytes[2] != 78 || bytes[3] != 71) {
                    return "Invalid invoice image.";
                }
                BitmapFactory.Options options = new BitmapFactory.Options();
                options.inJustDecodeBounds = true;
                BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
                if (options.outWidth <= 0 || options.outHeight <= 0 ||
                        (long) options.outWidth * options.outHeight > 16000000L) {
                    return "Invoice image is too large. Use Print / Save PDF.";
                }
                File directory = new File(getCacheDir(), "shared-invoices");
                if (!directory.exists() && !directory.mkdirs()) return "Could not prepare invoice sharing.";
                File[] oldFiles = directory.listFiles();
                if (oldFiles != null) for (File old : oldFiles) {
                    if (old.isFile() && old.lastModified() < System.currentTimeMillis() - 86400000L) old.delete();
                }
                String name = proposedName == null ? "SA-Traders-Invoice" : proposedName;
                name = name.replaceAll("[^a-zA-Z0-9_-]", "-");
                if (name.length() > 80) name = name.substring(0, 80);
                File image = File.createTempFile(name + "-", ".png", directory);
                try (FileOutputStream output = new FileOutputStream(image)) { output.write(bytes); }
                Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".invoicefiles", image);
                runOnUiThread(() -> {
                    try {
                        Intent send = new Intent(Intent.ACTION_SEND);
                        send.setType("image/png");
                        send.putExtra(Intent.EXTRA_STREAM, uri);
                        send.putExtra(Intent.EXTRA_TITLE, "S.A Traders invoice");
                        send.setClipData(ClipData.newUri(getContentResolver(), "Invoice", uri));
                        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        Intent chooser = Intent.createChooser(send, "Share invoice image — choose WhatsApp");
                        chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(chooser);
                    } catch (Exception e) {
                        Toast.makeText(context, "Could not open sharing. Please try again.", Toast.LENGTH_LONG).show();
                    }
                });
                return "ok";
            } catch (Exception e) {
                return "Could not prepare the invoice image. Please retry.";
            }
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

