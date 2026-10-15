/* Reminder and payment review features use the existing rental/payment engine. */
(function(){
  const KEY='sa_reminder_settings_v1';
  const read=()=>{try{return{enabled:false,days:1,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch(e){return{enabled:false,days:1}}};
  SA.bellIcon=()=>'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>';
  let timer,running=false,rerun=false,lastSync=0;
  async function reminderData(){
    const bills=await allHydratedBills();
    const custom=(await DB.all('customBills')).map(raw=>({...hydrateCustom(raw).bill,isCustom:true}));
    return [...bills,...custom].filter(b=>b.status!=='closed').map(b=>{
      const cycles=b.isCustom?[{start:b.start_date||today(),end:b.start_date||today(),total:b.total_due,index:1}]:(b.cycles||[]).map(c=>({start:c.start_date,end:c.end_date,total:c.total,index:c.index}));
      // Project using the unchanged snapshot/rent functions; never save projections to bills.
      if(!b.isCustom&&b.calculation_type!=='customshop_professional'&&parseDate(b.start_date)){
        const start=parseDate(b.start_date),days=Math.max(i(b.cycle_days,30),1),first=cycles.length+1;
        for(let index=first;index<Math.min(first+26,500);index++){
          const snap=snapshotForCycle(b,index),rent=calcRent(snap.qty,snap.wood,b.rates).rent_total;
          if(rent<=0)break;
          const date=addDays(start,(index-1)*days);cycles.push({start:ymd(date),end:ymd(addDays(date,days-1)),total:round2(rent+(index===1?transport(b).total:0)),index});
        }
      }
      return{billNo:String(b.bill_no),name:String(b.name||'Customer'),mobile:String(b.mobile||''),isCustom:!!b.isCustom,balance:round2(b.pending),paid:round2(b.total_paid),total:round2(b.total_due),start:b.start_date||'',cycles};
    });
  }
  SA.reminderData=reminderData;
  function categories(rows,date=today()){
    const result={pending:[],today:[],upcoming:[]},limit=ymd(addDays(parseDate(date),7));
    for(const row of rows){
      const started=row.cycles.filter(c=>c.start<=date),future=row.cycles.filter(c=>c.start>date),current=started.at(-1);
      const total=row.isCustom?row.total:sum(started.map(c=>c.total));
      const balance=Math.max(0,round2(total-row.paid));
      if(balance>0)result.pending.push({...row,balance,date:current?.start||row.start,category:'pending'});
      const due=row.cycles.find(c=>c.start===date);
      if(due&&Math.max(0,round2(sum(started.map(c=>c.total))-row.paid))>0)result.today.push({...row,balance,date:date,category:'today'});
      const next=future.find(c=>c.start<=limit&&c.total>0&&sum(row.cycles.filter(x=>x.start<=c.start).map(x=>x.total))>row.paid);
      if(next)result.upcoming.push({...row,balance:round2(next.total),date:next.start,category:'upcoming'});
    }
    return result;
  }
  SA.reminderCategories=categories;
  async function syncNow(){
    if(!currentUser)return;
    if(running){rerun=true;return}running=true;
    try{const settings=read(),rows=await reminderData();if(window.Android?.syncBillReminders)Android.syncBillReminders(JSON.stringify(rows),!!settings.enabled,Number(settings.days)||1);lastSync=Date.now()}
    catch(e){console.warn('Reminder sync failed',e)}finally{running=false;if(rerun){rerun=false;SA.syncReminders()}}
  }
  SA.syncReminders=()=>{clearTimeout(timer);timer=setTimeout(syncNow,1500)};
  SA.openNotificationSettings=()=>{
    const settings=read();
    modal('Daily reminders',`<form id="reminderForm"><label class="reminder-toggle"><span><strong>Customer notifications</strong><small>Separate reminders for each customer: pending, due today and the next 7 days.</small></span><input type="checkbox" name="enabled" ${settings.enabled?'checked':''}></label><p class="reminder-note">Daily reminders use the last synced bills on this phone. Open the app to sync changes from other devices. Android battery settings may delay delivery.</p><button class="sa-btn gold lg w-100" type="submit">Save reminders</button></form>`);
    $('#reminderForm').onsubmit=ev=>{ev.preventDefault();const enabled=ev.target.elements.enabled.checked;localStorage.setItem(KEY,JSON.stringify({enabled,days:1}));SA.syncReminders();SA.closeModal();toast(enabled?'Daily reminders enabled':'Daily reminders disabled')};
  };
  function paymentDetectionAvailable(){return window.Android?.paymentDetectionAvailable?.()??!!window.Android?.paymentCandidates;}
  function candidates(){if(!paymentDetectionAvailable())return[];try{return JSON.parse(window.Android?.paymentCandidates?.()||'[]').filter(x=>!x.dismissed)}catch(e){return[]}}
  SA.ignoreDetectedPayment=id=>{window.Android?.dismissPaymentCandidate(id);SA.renderNotifications()};
  SA.reviewDetectedPayment=async id=>{
    const item=candidates().find(x=>x.id===id);if(!item)return;
    const rental=(await allHydratedBills()).map(b=>({...b,isCustom:false}));
    const custom=(await DB.all('customBills')).map(b=>({...hydrateCustom(b).bill,isCustom:true}));
    const bills=[...rental,...custom].filter(b=>b.status!=='closed');
    modal('Assign detected payment',`<p><strong>${money(item.amount)} · ${esc(item.source)}</strong></p><p>${esc(item.text)}</p><label class="sa-label" for="detectedSearch">Search customer, mobile or bill</label><input class="sa-input w-100" id="detectedSearch" placeholder="Search customer / bill"><div id="detectedBills" class="detected-bill-list"></div>`);
    const draw=()=>{const q=$('#detectedSearch').value.toLowerCase(),found=bills.filter(b=>`${b.name} ${b.mobile} ${b.bill_no}`.toLowerCase().includes(q));$('#detectedBills').innerHTML=found.map((b,index)=>`<button class="sa-btn outline w-100" data-choice="${index}">${esc(b.name)} · ${b.isCustom?'Custom':'Bill'} #${esc(b.bill_no)} · ${money(b.pending)}</button>`).join('')||'<p>No matching open bills.</p>';$('#detectedBills').querySelectorAll('button').forEach(button=>button.onclick=()=>{const b=found[Number(button.dataset.choice)];SA.closeModal();SA.quickPayment(b.bill_no,b.isCustom,item)})};$('#detectedSearch').oninput=draw;draw();
  };
  let notificationTab='reminders',reminderCategory='pending';
  SA.renderNotifications=async()=>{
    const groups=categories(await reminderData()),items=candidates();
    let history=[];try{history=JSON.parse(window.Android?.reminderHistory?.()||'[]')}catch(e){}
    // Keep reminder calculations unchanged; the overdue view excludes today's rows.
    const overdue=groups.pending.filter(row=>row.date&&row.date<today());
    const viewGroups={pending:overdue,today:groups.today,upcoming:groups.upcoming};
    const labels={pending:'Overdue',upcoming:'Upcoming',today:'Due today'};
    const daysLate=row=>Math.max(0,Math.round((parseDate(today())-parseDate(row.date))/86400000));
    const shortDate=value=>{const date=parseDate(value);return date?date.toLocaleDateString('en-IN',{day:'numeric',month:'short'}):value||'—'};
    const empty=text=>'<div class="nt-empty">'+text+'</div>';
    shell('<div class="notification-screen">'+
      '<header class="nt-hero"><div class="nt-heading"><button class="nt-round" aria-label="Back" onclick="SA.back()">←</button><h1>Notifications</h1><button class="nt-round nt-settings" aria-label="Daily reminders" onclick="SA.openNotificationSettings()">⏰</button></div>'+
      '<div class="nt-summary"><div><span>Overdue to collect</span><strong>'+money(sum(overdue.map(row=>row.balance)))+'</strong></div><div><span>Due today / Upcoming</span><strong>'+groups.today.length+' / '+groups.upcoming.length+'</strong></div></div></header>'+
      '<div class="nt-body"><div class="nt-tabs" role="tablist" aria-label="Notifications">'+
      '<button id="nt-tab-reminders" role="tab" data-notification-tab="reminders" aria-controls="nt-reminders">Reminders <span>'+overdue.length+'</span></button>'+
      (paymentDetectionAvailable()?'<button id="nt-tab-payments" role="tab" data-notification-tab="payments" aria-controls="nt-payments">Payments <span class="nt-payment-count">'+items.length+'</span></button>':'')+
      '<button id="nt-tab-history" role="tab" data-notification-tab="history" aria-controls="nt-history">History</button></div>'+
      '<section id="nt-reminders" role="tabpanel" aria-labelledby="nt-tab-reminders"><div class="nt-filters" aria-label="Reminder status">'+
      Object.entries(labels).map(([key,label])=>'<button data-category="'+key+'">'+label+' <span>'+viewGroups[key].length+'</span></button>').join('')+
      '</div><div id="reminderItems" class="nt-list"></div></section>'+
      (paymentDetectionAvailable()?'<section id="nt-payments" role="tabpanel" aria-labelledby="nt-tab-payments" hidden><div class="nt-panel-head"><h2>Detected payments</h2><button class="nt-small-button" onclick="window.Android?.openPaymentAccess()">'+(window.Android?.paymentAccessEnabled?.()?'Manage':'Enable')+' payment detection</button></div><p class="nt-note">Verify receipt before saving a detected payment.</p><div id="detectedItems"></div></section>':'')+
      '<section id="nt-history" role="tabpanel" aria-labelledby="nt-tab-history" hidden><div class="nt-panel-head"><h2>Notification history</h2></div><div id="notificationHistory"></div></section></div></div>','');
    // Scope the screen treatment to this render; normal navigation creates a fresh shell.
    $('#app').classList.add('nt-host');
    const page=$('#app .page');page?.classList.add('nt-page');
    const nav=$('#app .ux-bottom');nav?.classList.add('nt-bottom');
    $('#app .ux-topbar')?.setAttribute('hidden','');
    const card=row=>{
      const late=daysLate(row),phone=String(row.mobile||'').replace(/[^0-9+]/g,'');
      const dueText=reminderCategory==='pending'?late+' day'+(late===1?'':'s')+' late':reminderCategory==='today'?'Due today':shortDate(row.date);
      return '<article class="nt-card '+reminderCategory+'"><div class="nt-card-top"><span class="nt-avatar" aria-hidden="true">'+esc(String(row.name||'C').trim().charAt(0).toUpperCase())+'</span><div class="nt-customer"><strong>'+esc(row.name)+'</strong><span>'+(row.isCustom?'Custom':'Bill')+' #'+esc(row.billNo)+' · due '+esc(shortDate(row.date))+'</span></div><div class="nt-amount"><strong>'+money(row.balance)+'</strong><span>'+esc(dueText)+'</span></div></div><div class="nt-actions">'+
      (phone?'<button data-call="'+esc(phone)+'">☎ Call</button><button data-whatsapp="'+esc(phone)+'">☏ WhatsApp</button>':'')+
      '<button class="nt-view" data-bill="'+esc(row.billNo)+'" data-custom="'+row.isCustom+'">View bill</button></div></article>';
    };
    const choose=key=>{
      reminderCategory=key;
      document.querySelectorAll('[data-category]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.category===key)));
      const rows=viewGroups[key].slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
      // Use the existing chunked list so a large customer list stays responsive.
      mountChunked($('#reminderItems'),rows,(row,index)=>{
        let heading='';
        if(key==='pending'){
          const bucket=r=>daysLate(r)>=20?'20+ days late':daysLate(r)>=10?'10–19 days late':'1–9 days late';
          const label=bucket(row);
          if(index===0||bucket(rows[index-1])!==label)heading='<div class="nt-group"><span><i></i>'+label+'</span><b>'+rows.filter(r=>bucket(r)===label).length+'</b></div>';
        }else if(index===0)heading='<div class="nt-group '+key+'"><span><i></i>'+(key==='today'?'Due today':'Upcoming · next 7 days')+'</span><b>'+rows.length+'</b></div>';
        return heading+card(row);
      },empty('No '+(key==='pending'?'overdue bills':key==='today'?'bills due today':'upcoming bills')+'.'));
    };
    $('#reminderItems').onclick=e=>{
      const button=e.target.closest('button');if(!button)return;
      if(button.dataset.bill)SA.go((button.dataset.custom==='true'?'custom-view/':'bill/')+encodeURIComponent(button.dataset.bill));
      if(button.dataset.call)SA.callCustomer(button.dataset.call);
      if(button.dataset.whatsapp)SA.openCustomerWhatsApp(button.dataset.whatsapp);
    };
    document.querySelectorAll('[data-category]').forEach(el=>el.onclick=()=>choose(el.dataset.category));
    choose(reminderCategory);
    const selectTab=key=>{
      if(key==='payments'&&!paymentDetectionAvailable())key='reminders';
      notificationTab=key;
      document.querySelectorAll('[data-notification-tab]').forEach(el=>{
        const active=el.dataset.notificationTab===key;el.setAttribute('aria-selected',String(active));el.tabIndex=active?0:-1;
        $('#nt-'+el.dataset.notificationTab).hidden=!active;
      });
    };
    const tabs=[...document.querySelectorAll('[data-notification-tab]')];
    tabs.forEach((el,index)=>{
      el.onclick=()=>selectTab(el.dataset.notificationTab);
      el.onkeydown=e=>{let target;if(e.key==='ArrowRight')target=tabs[(index+1)%tabs.length];if(e.key==='ArrowLeft')target=tabs[(index+tabs.length-1)%tabs.length];if(e.key==='Home')target=tabs[0];if(e.key==='End')target=tabs.at(-1);if(target){e.preventDefault();target.click();target.focus()}};
    });
    selectTab(notificationTab);
    if($('#detectedItems')){
      mountChunked($('#detectedItems'),items.slice().reverse(),item=>'<article class="nt-card nt-detected"><div class="nt-panel-head"><strong>'+money(item.amount)+'</strong><span>'+esc(item.source)+'</span></div><small>'+esc(new Date(item.receivedAt).toLocaleString())+'</small><p>'+esc(item.text)+'</p><div class="nt-actions"><button class="nt-view" data-review="'+esc(item.id)+'">Choose bill</button><button data-ignore="'+esc(item.id)+'">Ignore</button></div></article>',empty('No unassigned payments.'));
      $('#detectedItems').onclick=e=>{const button=e.target.closest('button');if(!button)return;if(button.dataset.review)SA.reviewDetectedPayment(button.dataset.review);if(button.dataset.ignore)SA.ignoreDetectedPayment(button.dataset.ignore)};
    }
    mountChunked($('#notificationHistory'),history.slice().reverse(),item=>'<article class="nt-card nt-history-card"><strong>'+esc(item.name)+'</strong><span>'+esc(item.date)+'</span><p>'+esc(item.text)+'</p></article>',empty('Your delivered reminder history will appear here.'));
    SA.syncReminders();
  };
  window.SAFirebase?.DB?.onChange?.((store)=>{if(['bills','customBills'].includes(store))SA.syncReminders()});
  function resume(){if(!currentUser)return;if(window.Android?.consumeNotificationRoute?.()==='notifications')SA.go('notifications');else if(routeParts()[0]==='notifications')SA.renderNotifications();if(Date.now()-lastSync>60000)SA.syncReminders()}
  window.addEventListener('sa:native-resume',resume);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)resume()});
  window.addEventListener('DOMContentLoaded',()=>setTimeout(resume,2000));
})();

