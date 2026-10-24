const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),repo=path.join(root,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const cfg=JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8'));
const ui=fs.readFileSync(path.join(root,'src','App.tsx'),'utf8');
const bridge=fs.readFileSync(path.join(root,'scripts','integrate-existing-app.cjs'),'utf8');
assert.equal(pkg.dependencies['react-native'],'0.81.5');
assert.equal(cfg.expo.android.package,'com.satraders.billing.preview');
assert.notEqual(cfg.expo.android.package,'com.satraders.billing');
assert(ui.includes('Open complete billing app'));
assert(ui.includes('satradersbilling://open?screen='));
assert(!ui.includes('DEMO_BILLS')&&!ui.includes('SAMPLE DATA ONLY'));
for(const required of ['MainActivity.java','FirebaseBridge.java','WhatsAppBridge.java','PaymentNotificationService.java','BillingReminderWorker.java']){
 assert(bridge.includes(required),'Missing legacy Java integration '+required);
}
for(const required of ['invoice-2026.js','split-payments.js','notifications-2026.js','sa-traders-logo.jpg']){
 assert(bridge.includes(required),'Missing critical legacy asset '+required);
 assert(fs.existsSync(path.join(repo,required)),'Cannot find production asset '+required);
}
console.log('Full-workspace shell and Java/JS integration checks passed.');
