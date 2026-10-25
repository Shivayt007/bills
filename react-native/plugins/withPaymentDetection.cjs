const {withAndroidManifest,withDangerousMod,withMainApplication,withAppBuildGradle}=require('@expo/config-plugins');
const fs=require('node:fs'),path=require('node:path');
module.exports=function(config){
 config=withAndroidManifest(config,c=>{
  const manifest=c.modResults.manifest,app=manifest.application[0];
  const permissions=manifest['uses-permission']||=[];
  for(const name of ['android.permission.POST_NOTIFICATIONS','android.permission.RECEIVE_BOOT_COMPLETED'])if(!permissions.some(p=>p.$['android:name']===name))permissions.push({$:{'android:name':name}});
  app.$['android:allowBackup']='false';
  app.service=app.service||[];if(!app.service.some(s=>s.$['android:name']==='.PaymentNotificationService'))app.service.push({$:{'android:name':'.PaymentNotificationService','android:label':'S.A Traders payment review','android:permission':'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE','android:exported':'true'},'intent-filter':[ {action:[{$:{'android:name':'android.service.notification.NotificationListenerService'}}]}]});
  return c;
 });
 config=withAppBuildGradle(config,c=>{if(!c.modResults.contents.includes('androidx.work:work-runtime:2.9.1'))c.modResults.contents=c.modResults.contents.replace('dependencies {','dependencies {\n    implementation("androidx.work:work-runtime:2.9.1")');return c;});
 config=withMainApplication(config,c=>{if(!c.modResults.contents.includes('add(SATradersPaymentsPackage())'))c.modResults.contents=c.modResults.contents.replace('PackageList(this).packages.apply {','PackageList(this).packages.apply {\n              add(SATradersPaymentsPackage())');return c;});
 return withDangerousMod(config,['android',async c=>{const pkg=c.android.package,dir=path.join(c.modRequest.platformProjectRoot,'app/src/main/java',...pkg.split('.'));fs.mkdirSync(dir,{recursive:true});for(const file of fs.readdirSync(path.join(__dirname,'native')))fs.writeFileSync(path.join(dir,file),fs.readFileSync(path.join(__dirname,'native',file),'utf8').replaceAll('package com.satraders.billing;','package '+pkg+';'));return c;}]);
};
