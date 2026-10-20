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
 // Mock transport only: no live messages leave this UI test.
 await page.evaluate(()=>{
   window.__waCalls=[];
   window.WhatsAppService={config:()=>JSON.stringify({url:'https://reminders.example.test',configured:true}),save:()=> 'ok',request:(id,action,json)=>{__waCalls.push({action,data:JSON.parse(json)});setTimeout(()=>SAWhatsAppResult(id,true,action==='send'?{accepted:true,messageId:'mock-only'}:{status:'CONNECTED',connected:true}),0)}};
 });
 await page.getByRole('button',{name:'WhatsApp setup',exact:true}).click();
 await page.getByText('WhatsApp connected — ready to send reminders.',{exact:true}).waitFor();
 assert.equal(await page.locator('#waToken').inputValue(),'');
 await page.locator('.modal-close').click();
 await page.locator('[data-category="today"]').click();
 await page.locator('[data-wa-reminder="101"]').click();
 await page.locator('#waMessage').waitFor();
 assert.match(await page.locator('#waMessage').inputValue(),/Bill #101/);
 assert.match(await page.locator('#waReminderForm').innerText(),/919000000001/);
 assert.equal(await page.evaluate(()=>__waCalls.filter(c=>c.action==='send').length),0);
 await page.screenshot({path:'/tmp/sa-notifications-whatsapp-preview.png',fullPage:true});
 await page.getByRole('button',{name:'Send WhatsApp reminder',exact:true}).click();
 await page.getByText('Reminder submitted to WhatsApp. Delivery and read status are not confirmed.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>__waCalls.filter(c=>c.action==='send').length),1);
 assert.equal(await page.evaluate(()=>__records.bills[0].payments.length),0);
 assert.equal(await page.getByRole('button',{name:'Submitted',exact:true}).isDisabled(),true);
 await page.locator('.modal-close').click();
 await page.locator('[data-wa-reminder="101"]').click();
 await page.locator('#waMessage').waitFor();
 await page.evaluate(()=>{window.__originalReminderData=SA.reminderData;SA.reminderData=async()=> (await __originalReminderData()).map(row=>row.billNo==='101'?{...row,paid:row.paid+1}:row)});
 await page.getByRole('button',{name:'Send WhatsApp reminder',exact:true}).click();
 await page.getByText('Bill details changed. Close this preview and open the reminder again.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>__waCalls.filter(c=>c.action==='send').length),1);
 await page.evaluate(()=>{SA.reminderData=__originalReminderData});
 await page.locator('.modal-close').click();
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
 // Password-protected payment correction: cancel and wrong password never write.
 await page.getByRole('button',{name:'Payments',exact:true}).click();
 await page.locator('.payment-delete-button').first().click();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 assert.equal(await page.evaluate(()=>__records.bills.find(b=>b.bill_no==='103').payments.length),3);
 await page.locator('.payment-delete-button').first().click();
 await page.locator('#deletePaymentPassword').fill('wrong-password');
 await page.locator('#deletePaymentReason').fill('Wrong amount entered');
 await page.locator('#deletePaymentForm input[name="confirmed"]').check();
 await page.getByRole('button',{name:'Delete payment',exact:true}).click();
 await page.getByText('Incorrect admin password.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>__records.bills.find(b=>b.bill_no==='103').payments.length),3);
 await page.locator('#deletePaymentPassword').fill('shiva');
 await page.getByRole('button',{name:'Delete payment',exact:true}).click();
 await page.waitForFunction(()=>__records.bills.find(b=>b.bill_no==='103').payments.length===2);
 await page.waitForFunction(()=>!document.querySelector('#deletePaymentForm'));
 assert.equal(await page.evaluate(()=>__records.bills.find(b=>b.bill_no==='103').payment_audit[0].payment.amount),40);
 assert.equal(await page.evaluate(()=>__records.bills.find(b=>b.bill_no==='103').payment_audit[0].reason),'Wrong amount entered');
 await page.locator('.rental-bill-summary .pending').waitFor();
 assert.match(await page.locator('.rental-bill-summary .pending').innerText(),/1,750\.00/);
 // Dashboard card and Pending filter exclude settled bills.
 await page.evaluate(async()=>{await DB.put('bills',{bill_no:'104',name:'Settled Customer',start_date:today(),cycle_days:30,jackey_qty:1,payments:[{payment_id:'settled',amount:65,payment_date:today()}],status:'open'});SA.go('dashboard')});
 await page.locator('.home-pending-card').waitFor();
 await page.waitForTimeout(300);
 await page.locator('.home-pending-card').click();
 await page.waitForFunction(()=>document.querySelector('#dashTabs [data-f="pending"]')?.classList.contains('active'));
 assert.ok(!(await page.locator('#uxBillList').innerText()).includes('Settled Customer'));
 assert.match(await page.locator('#uxBillList').innerText(),/Cycle Table Customer/);
 await page.screenshot({path:'/tmp/sa-notifications-payment-pending.png',fullPage:true});
 await page.evaluate(()=>SA.go('home'));await page.locator('.home-pending-card').waitFor();
 await page.locator('.home-pending-card').click();
 await page.waitForFunction(()=>document.querySelector('#dashTabs [data-f="pending"]')?.classList.contains('active'));
 // Custom bill entries use the same password confirmation and audit.
 await page.evaluate(async()=>{await DB.put('customBills',{bill_no:'C105',name:'Custom Payment Customer',start_date:today(),jackey_qty:1,payments:[{payment_id:'custom-pay',amount:20,payment_date:today()}]});SA.go('custom-view/C105')});
 await page.locator('.payment-delete-button').waitFor();await page.waitForTimeout(300);
 await page.locator('.payment-delete-button').click();
 await page.locator('#deletePaymentPassword').fill('shiva');
 await page.locator('#deletePaymentReason').fill('Duplicate custom payment');
 await page.locator('#deletePaymentForm input[name="confirmed"]').check();
 await page.getByRole('button',{name:'Delete payment',exact:true}).click();
 await page.waitForFunction(()=>__records.customBills.find(b=>b.bill_no==='C105').payments.length===0);
 assert.equal(await page.evaluate(()=>__records.customBills.find(b=>b.bill_no==='C105').payment_audit[0].payment.payment_id),'custom-pay');
 // Atomic split receipt with two bills, three cycles and customer credit.
 await page.waitForFunction(()=>!document.querySelector('#deletePaymentForm'));
 await page.evaluate(async()=>{
   const old=ymd(addDays(parseDate(today()),-35));
   await DB.batch([
    {store:'bills',document:{bill_no:'S201',name:'Split Customer',mobile:'9990000001',start_date:today(),cycle_days:30,jackey_qty:1,payments:[],status:'open'}},
    {store:'bills',document:{bill_no:'S202',name:'Split Customer',mobile:'9990000001',start_date:old,cycle_days:30,jackey_qty:1,payments:[],status:'open'}}
   ],{waitForServer:true});
   window.__splitDone=false;window.__splitFailOnce=true;window.__splitCommits=0;
   const candidate={id:'split-detection',reference:'SPLITREF123',source:'GPay',amount:150,receivedAt:Date.now(),text:'Received ₹150 from Split Customer'};
   Android.paymentDetectionAvailable=()=>true;
   Android.paymentCandidates=()=>JSON.stringify(__splitDone?[]:[candidate]);
   Android.dismissPaymentCandidate=id=>{if(id==='split-detection')__splitDone=true};
   FirebaseDB.guardedBatch=(id,json)=>{
     const ops=JSON.parse(json);window.__lastSplitOps=structuredClone(ops);
     const reply=(ok,data)=>setTimeout(()=>__firebaseResult(id,ok,btoa(unescape(encodeURIComponent(JSON.stringify(data))))),0);
     if(__splitFailOnce){__splitFailOnce=false;reply(false,{message:'Simulated save failure'});return}
     const keyFields={bills:'bill_no',customBills:'bill_no',customers:'mobile',settings:'key'};
     const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
     for(const op of ops){const actual=__records[op.store].find(r=>String(r[keyFields[op.store]])===String(op.key))||null;if(stable(actual)!==stable(op.expected)){reply(false,{message:'Records changed or receipt already saved'});return}}
     for(const op of ops){const rows=__records[op.store],idx=rows.findIndex(r=>String(r[keyFields[op.store]])===String(op.key));if(idx<0)rows.push(op.document);else rows[idx]=op.document}
     __splitCommits++;reply(true,{written:ops.length});
   };
   SA.go('notifications');
 });
 await page.getByRole('heading',{name:'Notifications',exact:true}).waitFor();
 await page.getByRole('tab',{name:/Payments/}).click();
 await page.getByRole('button',{name:'Choose bill',exact:true}).click();
 await page.getByRole('button',{name:'Split across bills',exact:true}).click();
 await page.locator('#splitCustomerSearch').fill('9990000001');
 await page.locator('#splitCustomers button').click();
 await page.getByRole('button',{name:'Select all bills',exact:true}).click();
 await page.locator('[aria-label="Allocate S201 cycle 1"]').fill('65');
 await page.locator('[aria-label="Allocate S202 cycle 1"]').fill('60');
 await page.locator('[aria-label="Allocate S202 cycle 2"]').fill('50');
 await page.getByRole('button',{name:'Review split',exact:true}).click();
 assert.match(await page.locator('#splitPaymentError').innerText(),/exceeds the received/);
 await page.locator('[aria-label="Allocate S201 cycle 1"]').fill('50');
 await page.locator('[aria-label="Allocate S202 cycle 1"]').fill('60');
 await page.locator('[aria-label="Allocate S202 cycle 2"]').fill('20');
 await page.locator('#splitKeepCredit').check();
 await page.getByRole('button',{name:'Review split',exact:true}).click();
 await page.locator('#splitReceiptConfirmed').check();
 await page.screenshot({path:'/tmp/sa-notifications-split-payment.png',fullPage:true});
 await page.getByRole('button',{name:'Confirm and save',exact:true}).click();
 await page.getByText('Simulated save failure',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>__records.bills.find(b=>b.bill_no==='S201').payments.length),0);
 assert.equal(await page.evaluate(()=>__splitDone),false);
 await page.getByRole('button',{name:'Confirm and save',exact:true}).click();
 await page.waitForFunction(()=>__splitDone);
 assert.equal(await page.evaluate(()=>__splitCommits),1);
 assert.equal(await page.evaluate(()=>__records.bills.find(b=>b.bill_no==='S201').payments[0].amount),50);
 assert.equal(await page.evaluate(()=>__records.bills.find(b=>b.bill_no==='S202').payments.reduce((a,p)=>a+p.amount,0)),80);
 assert.equal(await page.evaluate(()=>__records.customers.find(c=>c.mobile==='9990000001').payment_credit_balance),20);
 assert.equal(await page.evaluate(()=>__records.settings.filter(s=>s.value?.kind==='split_payment_receipt').length),1);
 const retry=await page.evaluate(async()=>{try{await DB.guardedBatch(__lastSplitOps);return 'saved twice'}catch(e){return e.message}});
 assert.match(retry,/already saved|changed/);
 assert.equal(await page.evaluate(()=>__splitCommits),1);
 // Individual split payments open the complete receipt for password-confirmed correction.
 await page.evaluate(()=>SA.go('bill/S201'));await page.locator('#billUxTabs').waitFor();
 await page.getByRole('button',{name:'Payments',exact:true}).click();
 await page.getByRole('button',{name:'Manage receipt',exact:true}).click();
 await page.locator('#splitAdminPassword').fill('wrong');
 await page.locator('#splitCorrectionReason').fill('Change bill allocation');
 await page.getByRole('button',{name:'Correct split',exact:true}).click();
 await page.getByText('Incorrect username or password',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>__splitCommits),1);
 await page.locator('#splitAdminPassword').fill('shiva');
 await page.getByRole('button',{name:'Correct split',exact:true}).click();
 await page.locator('#splitCustomerSearch').fill('9990000001');
 await page.locator('#splitCustomers button').click();
 await page.getByRole('button',{name:'Select all bills',exact:true}).click();
 await page.getByRole('button',{name:'Fill oldest dues first',exact:true}).click();
 assert.equal(await page.locator('#splitRemaining').innerText(),'₹0.00');
 await page.getByRole('button',{name:'Review split',exact:true}).click();
 await page.locator('#splitReceiptConfirmed').check();
 await page.getByRole('button',{name:'Confirm and save',exact:true}).click();
 await page.waitForFunction(()=>__splitCommits===2);
 assert.equal(await page.evaluate(()=>__records.customers.find(c=>c.mobile==='9990000001').payment_credit_balance),0);
 assert.equal(await page.evaluate(()=>__records.settings.find(s=>s.value?.kind==='split_payment_receipt').value.version),2);
 assert.equal(await page.evaluate(()=>__records.bills.find(b=>b.bill_no==='S202').payments.reduce((a,p)=>a+p.amount,0)),130);
 assert.equal(await page.evaluate(()=>__records.bills.find(b=>b.bill_no==='S201').payments[0].amount),20);

 assert.deepEqual(errors,[]);console.log('Mobile/desktop notification UI, payment confirmation, cloud save, backup bridge and About passed');
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});


