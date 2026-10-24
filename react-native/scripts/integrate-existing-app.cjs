'use strict';
/**
 * Generated native Android integration for an existing S.A Traders Java app.
 * Does not mutate the checked-in production android-app/, app.js, or HTML.
 * The output is the Expo-generated react-native/android/ directory.
 */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const preview=path.resolve(__dirname,'..');
const repo=path.resolve(preview,'..');
const app=path.join(preview,'android','app');
const generatedManifest=path.join(app,'src','main','AndroidManifest.xml');
const originalJava=path.join(repo,'android-app','app','src','main','java','com','satraders','billing');
const destJava=path.join(app,'src','main','java','com','satraders','billing');
const originalRes=path.join(repo,'android-app','app','src','main','res');
const destRes=path.join(app,'src','main','res');
const assets=path.join(app,'src','main','assets');
const requiredJava=[
  'MainActivity.java','BillingReminderWorker.java','FirebaseBridge.java',
  'InvoiceFileProvider.java','PaymentNotificationService.java',
  'PaymentParser.java','WhatsAppBridge.java'
];
const assetNames=[
  'index.html','firebase-db.js','app.js','app.bundle.min.css',
  'ui-2026.js','ui-fixes.js','reference-ui.js',
  'invoice-2026.js','next-cycle-2026.js','invoice-share.js',
  'notifications-2026.js','whatsapp-reminders.js','split-payments.js',
  'sa-traders-logo.jpg','vendor/html2canvas.min.js'
];
function exists(p){assert(fs.existsSync(p),'Missing original application file: '+p);}
function copy(source,destination){exists(source);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(source,destination);}
function replaceOne(file,oldValue,newValue){
  const original=fs.readFileSync(file,'utf8');
  assert(original.includes(oldValue),'Generated project has changed: '+file+' expected '+oldValue);
  fs.writeFileSync(file,original.replace(oldValue,newValue));
}
exists(generatedManifest);
for(const name of requiredJava)copy(path.join(originalJava,name),path.join(destJava,name));
for(const name of assetNames)copy(path.join(repo,name),path.join(assets,name));
for(const name of ['invoice_paths.xml','backup_rules.xml','data_extraction_rules.xml']){
  copy(path.join(originalRes,'xml',name),path.join(destRes,'xml',name));
}
// The original screen expects the historical package-local BuildConfig flag.
// The Expo application ID is intentionally different so this is a separate install.
fs.writeFileSync(path.join(destJava,'BuildConfig.java'),
 'package com.satraders.billing;\npublic final class BuildConfig { private BuildConfig(){} public static final boolean PAYMENT_DETECTION_ENABLED=true; }\n');
// Retain the original legacy theme name without colliding with the Expo splash resources.
fs.mkdirSync(path.join(destRes,'values'),{recursive:true});
fs.writeFileSync(path.join(destRes,'values','sa_traders_legacy_theme.xml'),
 '<resources><style name="Theme.SATraders" parent="android:style/Theme.Material.Light.NoActionBar">'+
 '<item name="android:fontFamily">sans</item><item name="android:windowActionModeOverlay">true</item>'+
 '<item name="android:navigationBarColor">#FFFFFF</item><item name="android:statusBarColor">#F4F8FC</item>'+
 '<item name="android:windowLightStatusBar">true</item><item name="android:colorAccent">#1684D6</item>'+
 '<item name="android:windowBackground">@android:color/white</item></style></resources>');
// Native React Native shortcuts go straight to the original routes.
// The authentication gate, all route handlers, and existing JS remain unchanged.
const originalMain=path.join(destJava,'MainActivity.java');
replaceOne(originalMain,'if(savedInstanceState==null)webView.loadUrl(HOME);else webView.restoreState(savedInstanceState);',
 'if(savedInstanceState==null)webView.loadUrl(HOME+requestedNativeFragment());else webView.restoreState(savedInstanceState);');
replaceOne(originalMain,
 'setIntent(intent);acceptRoute(intent);if(webView!=null)webView.evaluateJavascript("window.dispatchEvent(new Event(\'sa:native-resume\'))",null);',
 'setIntent(intent);acceptRoute(intent);if(webView!=null){if(!requestedNativeFragment().isEmpty())webView.loadUrl(HOME+requestedNativeFragment());webView.evaluateJavascript("window.dispatchEvent(new Event(\'sa:native-resume\'))",null);}');
// Only allow routes that actually exist. Parameters are not accepted in native links.
const routeWhitelist=[
 'dashboard','home','bills','customers','inventory','payment-report',
 'custom','slips','challans','reports','notifications','open-bills',
 'materials','totals','material-rent-report','return-bill','admin','admin-backup',
 'admin-users','admin-terms','about'
];
const routeFn=
 '    private String requestedNativeFragment(){\n'+
 '      android.content.Intent source=getIntent();\n'+
 '      android.net.Uri uri=source==null?null:source.getData();\n'+
 '      if(uri==null || !"satradersbilling".equals(uri.getScheme()) || !"open".equals(uri.getHost())) return "";\n'+
 '      String page=uri.getQueryParameter("screen");\n'+
 '      java.util.List<String> allowed=java.util.Arrays.asList('+routeWhitelist.map(x=>'"'+x+'"').join(',')+');\n'+
 '      return allowed.contains(page) ? "#/"+page : "#/dashboard";\n'+
 '    }\n';
replaceOne(originalMain,'    private static final int MAX_BACKUP_BYTES = 20 * 1024 * 1024;',routeFn+'    private static final int MAX_BACKUP_BYTES = 20 * 1024 * 1024;');
// Retain all original manifest-level Android permissions, notification services and file provider.
const prodManifest=fs.readFileSync(path.join(repo,'android-app','app','src','main','AndroidManifest.xml'),'utf8');
const permissions=[...prodManifest.matchAll(/<uses-permission\b[^>]*\/>/g)].map(x=>x[0]).join('\n    ');
const queries=prodManifest.match(/<queries>[\s\S]*?<\/queries>/)?.[0]||'';
const service=prodManifest.match(/<service\b[\s\S]*?<\/service>/)?.[0];
const provider=prodManifest.match(/<provider\b[\s\S]*?<\/provider>/)?.[0];
assert(service && provider && permissions && queries,'Original Android components missing');
const fullComponents=(service+' \n'+provider)
  .replaceAll('android:name=".PaymentNotificationService"','android:name="com.satraders.billing.PaymentNotificationService"')
  .replaceAll('android:name=".InvoiceFileProvider"','android:name="com.satraders.billing.InvoiceFileProvider"');
let manifest=fs.readFileSync(generatedManifest,'utf8');
assert(manifest.includes('<application') && manifest.includes('</application>'),'Expo manifest changed');
manifest=manifest.replace('<application',permissions+'\n    '+queries+'\n    <application');
manifest=manifest.replace('</application>',
 '<activity android:name="com.satraders.billing.MainActivity" android:exported="true" android:theme="@style/Theme.SATraders" android:launchMode="singleTop" android:windowSoftInputMode="adjustResize">'+
 '<intent-filter><action android:name="android.intent.action.VIEW"/>'+
 '<category android:name="android.intent.category.DEFAULT"/>'+
 '<category android:name="android.intent.category.BROWSABLE"/>'+
 '<data android:scheme="satradersbilling" android:host="open"/></intent-filter>'+
 '</activity>\n'+fullComponents+'\n</application>');
// Preserve backup and privacy policies as in production.
manifest=manifest.replace('<application','<application android:fullBackupContent="@xml/backup_rules" android:dataExtractionRules="@xml/data_extraction_rules"');
fs.writeFileSync(generatedManifest,manifest);
// Firestore configuration remains from the original repository, but the
// Android package field has to match the isolated React Native test package.
const originalFirebase=JSON.parse(fs.readFileSync(path.join(repo,'android-app','app','google-services.json'),'utf8'));
let found=0;
for(const client of originalFirebase.client||[]){
  if(client.client_info?.android_client_info?.package_name==='com.satraders.billing'){
    client.client_info.android_client_info.package_name='com.satraders.billing.preview';found++;
  }
}
assert(found>0,'Original Firebase Android client not found: cannot safely configure preview');
fs.writeFileSync(path.join(app,'google-services.json'),JSON.stringify(originalFirebase));
const rootGradle=path.join(preview,'android','build.gradle');
replaceOne(rootGradle,'dependencies {','dependencies {\n    classpath("com.google.gms:google-services:4.4.2")');
const gradle=path.join(app,'build.gradle');
replaceOne(gradle,'apply plugin: "com.android.application"',
 'apply plugin: "com.android.application"\napply plugin: "com.google.gms.google-services"');
replaceOne(gradle,'dependencies {','dependencies {\n'+
 "    implementation 'androidx.webkit:webkit:1.12.1'\n"+
 "    implementation 'androidx.core:core:1.13.1'\n"+
 "    implementation 'androidx.work:work-runtime:2.9.1'\n"+
 "    implementation 'com.google.guava:guava:33.2.1-android'\n"+
 "    implementation platform('com.google.firebase:firebase-bom:33.16.0')\n"+
 "    implementation 'com.google.firebase:firebase-firestore'\n");
for(const name of requiredJava)exists(path.join(destJava,name));
for(const name of assetNames)exists(path.join(assets,name));
for(const route of routeWhitelist)assert(
  fs.readFileSync(path.join(repo,'app.js'),'utf8').includes(route),
  'Unverified legacy route: '+route);
console.log('Integrated '+requiredJava.length+' native Java sources, '+assetNames.length+' original web assets and preserved all Android services.');
console.log('Original production files unchanged; React Native preview uses its own application ID.');
