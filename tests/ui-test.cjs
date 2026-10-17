const {chromium}=require(process.env.SA_PLAYWRIGHT||'/tmp/sa-ui/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error('Page error:',e.message)});
 await page.route('https://appassets.androidplatform.net/**',async route=>{
  const relative=new URL(route.request().url()).pathname.replace(/^\/assets\//,'');
  const file=path.join(process.cwd(),relative);if(!fs.existsSync(file)){await route.fulfill({status:404,body:''});return;}
  const type=relative.endsWith('.js')?'application/javascript':relative.endsWith('.css')?'text/css':relative.endsWith('.jpg')?'image/jpeg':'text/html';await route.fulfill({body:fs.readFileSync(file),contentType:type});
 });
 await page.addInitScript(()=>{
  localStorage.setItem('sa_firebase_app_lock','1');
  const date=new Date(),ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,today=ymd(date),old=ymd(new Date(date.getFullYear(),date.getMonth(),date.getDate()-27));
  window.__records={bills:[{bill_no:'101',name:'Test Customer',mobile:'9000000001',start_date:today,cycle_days:30,jackey_qty:10,status:'open',payments:[]},{bill_no:'102',name:'Upcoming Customer',mobile:'9000000002',start_date:old,cycle_days:30,sheet_qty:10,status:'open',payments:[]}],customBills:[],customers:[],inventory:[],settings:[],slips:[],challans:[]};
  const keys={bills:'bill_no',customBills:'bill_no',customers:'mobile',inventory:'item',settings:'key',slips:'slip_no',challans:'challan_no'};
  window.__calls=[];window.__dismissed=false;
  const candidate={id:'test-detection',source:'Paytm',amount:100,reference:'123456789012',receivedAt:Date.now(),text:'Received ₹100 from Test Customer UPI Ref 123456789012'};
  window.Android={paymentDetectionAvailable:()=>true,syncBillReminders(){},reminderHistory:()=>JSON.stringify([{name:'Test Customer',date:today,text:'Bill #101 pending'}]),paymentCandidates:()=>JSON.stringify(window.__dismissed?[]:[candidate]),paymentAccessEnabled:()=>true,consumeNotificationRoute:()=>'',dismissPaymentCandidate:id=>{window.__dismissed=true},exportText:(...a)=>__calls.push(['export',...a]),shareText:(...a)=>__calls.push(['share',...a]),importBackup:()=>__calls.push(['import']),toast(){}};
  function reply(id,data){setTimeout(()=>window.__firebaseResult(id,true,btoa(unescape(encodeURIComponent(JSON.stringify(data))))),0)}
  window.FirebaseDB={all(id,store){reply(id,__records[store]||[])},get(id,store,key){reply(id,__records[store].find(r=>String(r[keys[store]])===String(key))||null)},put(id,store,key,json){const row=JSON.parse(json),index=__records[store].findIndex(r=>String(r[keys[store]])===String(key));if(index<0)__records[store].push(row);else __records[store][index]=row;reply(id,{})},batchPut(id,json){for(const op of JSON.parse(json)){const rows=__records[op.store],index=rows.findIndex(r=>String(r[keys[op.store]])===String(op.key));if(index<0)rows.push(op.document);else rows[index]=op.document}reply(id,{})}};
 });
 page.on('dialog',dialog=>dialog.accept());
 await page.goto('https://appassets.androidplatform.net/assets/index.html#/dashboard');
 await page.locator('button[aria-label="Notification history"]:visible').first().click();
 await page.getByRole('heading',{name:'Notifications',exact:true}).waitFor();
 assert.equal(await page.locator('[data-category]').count(),3);
 assert.match(await page.locator('#reminderItems').innerText(),/Upcoming Customer/);
 assert.ok(!(await page.locator('#reminderItems').innerText()).includes('Test Customer'));
 await page.locator('[data-category="today"]').click();assert.match(await page.locator('#reminderItems').innerText(),/Test Customer/);
 await page.locator('[data-category="upcoming"]').click();assert.match(await page.locator('#reminderItems').innerText(),/Upcoming Customer/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'/tmp/sa-notifications-mobile.png',fullPage:true});
 await page.locator('[data-category="pending"]').click();
 await page.screenshot({path:'/tmp/sa-notifications-overdue.png',fullPage:true});
 assert.equal(await page.locator('.nt-actions button').evaluateAll(buttons=>buttons.every(b=>b.scrollWidth<=b.clientWidth)),true);
 await page.getByRole('tab',{name:'History',exact:true}).click();
 assert.match(await page.locator('#notificationHistory').innerText(),/Test Customer/);
 assert.equal(await page.locator('#nt-reminders').isVisible(),false);
 await page.getByRole('tab',{name:/Payments/}).click();
 await page.getByRole('button',{name:'Choose bill',exact:true}).click();
 await page.locator('#detectedSearch').fill('101');await page.locator('#detectedBills button').click();
 await page.locator('#paymentAmount').waitFor();assert.equal(await page.locator('#paymentAmount').inputValue(),'100.00');
 assert.equal(await page.evaluate(()=>__records.bills[0].payments.length),0);
 await page.getByRole('button',{name:'Save payment',exact:true}).click();
 await page.waitForFunction(()=>__dismissed===true);
 assert.equal(await page.evaluate(()=>__records.bills[0].payments[0].transaction_reference),'123456789012');
 await page.evaluate(()=>SA.go('admin-backup'));await page.getByRole('button',{name:'Download JSON',exact:true}).waitFor();
 await page.getByRole('button',{name:'Download JSON',exact:true}).click();await page.getByRole('button',{name:'Share Backup',exact:true}).click();await page.getByRole('button',{name:'Choose Backup',exact:true}).click();
 await page.waitForFunction(()=>__calls.length===3);assert.deepEqual(await page.evaluate(()=>__calls.map(x=>x[0])),['export','share','import']);
 await page.evaluate(()=>SA.go('about'));await page.getByText('Developed by Shiva',{exact:true}).waitFor();assert.ok(!(await page.locator('body').innerText()).toLowerCase().includes('offline'));
 await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>SA.go('notifications'));await page.getByRole('heading',{name:'Notifications',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByRole('tab',{name:/Reminders/}).click();
 await page.locator('[data-category="pending"]').click();
 await page.screenshot({path:'/tmp/sa-notifications-desktop.png',fullPage:true});
 assert.ok(await page.locator('.notification-screen').evaluate(el=>el.getBoundingClientRect().width)>700);
 await page.setViewportSize({width:320,height:740});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.getByRole('tab',{name:/Payments/}).click();
 await page.getByRole('tab',{name:/History/}).click();
 await page.getByRole('tab',{name:/Reminders/}).click();
 await page.getByRole('tab',{name:/Reminders/}).press('ArrowRight');
 assert.equal(await page.getByRole('tab',{name:/Payments/}).getAttribute('aria-selected'),'true');
 await page.evaluate(()=>{Android.paymentDetectionAvailable=()=>false;SA.renderNotifications()});
 await page.waitForFunction(()=>!document.querySelector('#detectedItems'));
 assert.equal(await page.getByRole('button',{name:/Enable payment detection|Manage payment detection/}).count(),0);
 assert.equal(await page.locator('[data-category]').count(),3);
 assert.equal(await page.getByRole('tab',{name:/Payments/}).count(),0);
 assert.equal(await page.locator('#nt-reminders').isVisible(),true);
 await page.evaluate(()=>SA.go('bills'));
 await page.getByRole('heading',{name:'Bills',exact:true}).waitFor();
 assert.equal(await page.locator('#app').evaluate(el=>el.classList.contains('nt-host')),false);
 assert.equal(await page.locator('.ux-topbar').isVisible(),true);
 // Rental cycle tab uses stored payment cycle identities and leaves legacy receipts unassigned.
 await page.evaluate(async()=>{
   const start=addDays(parseDate(today()),-61),second=addDays(start,30);
   await DB.put('bills',{bill_no:'103',name:'Cycle Table Customer',mobile:'9000000003',start_date:ymd(start),cycle_days:30,jackey_qty:10,status:'open',payments:[
     {amount:100,payment_date:today(),cycle_index:1,cycle_start_date:ymd(start),cycle_end_date:ymd(addDays(start,29))},
     {amount:100,payment_date:today(),cycle_index:2,cycle_start_date:ymd(second),cycle_end_date:ymd(addDays(second,29))},
     {amount:40,payment_date:today()}
   ]});
   SA.go('bill/103');
 });
 await page.locator('#billUxTabs').waitFor();
 await page.waitForTimeout(300);
 assert.equal(await page.locator('#billUxTabs button').count(),4);
 await page.getByRole('button',{name:'Rental cycle',exact:true}).click();
 await page.locator('.rental-cycle-table').waitFor({state:'visible'});
 assert.equal(await page.locator('.rental-cycle-table tbody tr').count(),3);
 const row=page.locator('.rental-cycle-table tbody tr').first();
 assert.match(await row.locator('td').nth(3).innerText(),/100\.00/);
 assert.match(await row.locator('td').nth(4).innerText(),/550\.00/);
 assert.match(await page.locator('.cycle-unassigned').innerText(),/40\.00/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.ok(await page.locator('.rental-bill-summary .due').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=30);
 assert.equal(await page.locator('.rental-bill-summary .pending').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'/tmp/sa-notifications-rental-cycle.png',fullPage:true});
 await page.locator('.rental-cycle-scroll').evaluate(el=>el.scrollLeft=el.scrollWidth);
 await page.screenshot({path:'/tmp/sa-notifications-rental-payments.png',fullPage:true});
 await page.getByRole('button',{name:'Materials',exact:true}).click();
 assert.equal(await page.locator('[data-pane="materials"]').isVisible(),true);
 await page.getByRole('button',{name:'Payments',exact:true}).click();
 assert.match(await page.locator('[data-pane="payments"]').innerText(),/Cycle #1/);
 await page.getByRole('button',{name:'Details',exact:true}).click();
 assert.match(await page.locator('[data-pane="details"]').innerText(),/Cycle Table Customer/);
 assert.deepEqual(errors,[]);console.log('Mobile/desktop notification UI, payment confirmation, cloud save, backup bridge and About passed');
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});

