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
  function candidates(){try{return JSON.parse(window.Android?.paymentCandidates?.()||'[]').filter(x=>!x.dismissed)}catch(e){return[]}}
  SA.ignoreDetectedPayment=id=>{window.Android?.dismissPaymentCandidate(id);SA.renderNotifications()};
  SA.reviewDetectedPayment=async id=>{
    const item=candidates().find(x=>x.id===id);if(!item)return;
    const rental=(await allHydratedBills()).map(b=>({...b,isCustom:false}));
    const custom=(await DB.all('customBills')).map(b=>({...hydrateCustom(b).bill,isCustom:true}));
    const bills=[...rental,...custom].filter(b=>b.status!=='closed');
    modal('Assign detected payment',`<p><strong>${money(item.amount)} · ${esc(item.source)}</strong></p><p>${esc(item.text)}</p><label class="sa-label" for="detectedSearch">Search customer, mobile or bill</label><input class="sa-input w-100" id="detectedSearch" placeholder="Search customer / bill"><div id="detectedBills" class="detected-bill-list"></div>`);
    const draw=()=>{const q=$('#detectedSearch').value.toLowerCase(),found=bills.filter(b=>`${b.name} ${b.mobile} ${b.bill_no}`.toLowerCase().includes(q));$('#detectedBills').innerHTML=found.map((b,index)=>`<button class="sa-btn outline w-100" data-choice="${index}">${esc(b.name)} · ${b.isCustom?'Custom':'Bill'} #${esc(b.bill_no)} · ${money(b.pending)}</button>`).join('')||'<p>No matching open bills.</p>';$('#detectedBills').querySelectorAll('button').forEach(button=>button.onclick=()=>{const b=found[Number(button.dataset.choice)];SA.closeModal();SA.quickPayment(b.bill_no,b.isCustom,item)})};$('#detectedSearch').oninput=draw;draw();
  };
  SA.renderNotifications=async()=>{
    const groups=categories(await reminderData()),items=candidates();
    let history=[];try{history=JSON.parse(window.Android?.reminderHistory?.()||'[]')}catch(e){}
    const labels={pending:'Pending / Overdue',today:'Due today',upcoming:'Upcoming · 7 days'};
    shell(`<div class="ref-page-head notification-page-head"><div><button class="ux-icon-btn" onclick="SA.back()">‹</button><h1>Notifications</h1></div><button class="sa-btn outline" onclick="SA.openNotificationSettings()">Daily reminders</button></div>
      <div class="notification-tabs">${Object.entries(labels).map(([key,label])=>`<button class="notification-tab ${key}" data-category="${key}">${label}<strong>${groups[key].length}</strong></button>`).join('')}</div>
      <section id="reminderItems" class="notification-list"></section>
      <section class="ux-section"><h3>Detected payments · ${items.length}</h3><button class="sa-btn outline" onclick="window.Android?.openPaymentAccess()">${window.Android?.paymentAccessEnabled?.()?'Manage':'Enable'} payment detection</button><p class="reminder-note">GPay, Paytm, PhonePe and supported bank/message notifications. Verify receipt before saving.</p><div id="detectedItems"></div></section>
      <section class="ux-section"><h3>Notification history</h3><div id="notificationHistory"></div></section>`,'');
    const choose=key=>{document.querySelectorAll('[data-category]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.category===key)));const rows=groups[key].sort((a,b)=>String(a.date).localeCompare(String(b.date)));mountChunked($('#reminderItems'),rows,row=>`<article class="notification-card ${key}"><strong>${esc(row.name)}</strong><span>${row.isCustom?'Custom':'Bill'} #${esc(row.billNo)} · ${esc(row.date||'')}</span><b>${money(row.balance)}${key==='upcoming'?' expected rent':''}</b><button class="sa-btn outline" data-bill="${esc(row.billNo)}" data-custom="${row.isCustom}">View bill</button></article>`,'<div class="empty">No bills in this category.</div>');$('#reminderItems').onclick=e=>{const b=e.target.closest('[data-bill]');if(b)SA.go((b.dataset.custom==='true'?'custom-view/':'bill/')+encodeURIComponent(b.dataset.bill))}};
    document.querySelectorAll('[data-category]').forEach(el=>el.onclick=()=>choose(el.dataset.category));choose('pending');
    mountChunked($('#detectedItems'),items.slice().reverse(),item=>`<article class="notification-card detected"><strong>${money(item.amount)} · ${esc(item.source)}</strong><span>${esc(new Date(item.receivedAt).toLocaleString())}</span><p>${esc(item.text)}</p><div class="actions"><button class="sa-btn primary" data-review="${esc(item.id)}">Choose bill</button><button class="sa-btn outline" data-ignore="${esc(item.id)}">Ignore</button></div></article>`,'<p>No unassigned payments.</p>');
    $('#detectedItems').onclick=e=>{if(e.target.dataset.review)SA.reviewDetectedPayment(e.target.dataset.review);if(e.target.dataset.ignore)SA.ignoreDetectedPayment(e.target.dataset.ignore)};
    mountChunked($('#notificationHistory'),history.slice().reverse(),item=>`<article class="notification-card history"><strong>${esc(item.name)}</strong><span>${esc(item.date)}</span><p>${esc(item.text)}</p></article>`,'<p>Your delivered reminder history will appear here.</p>');
    SA.syncReminders();
  };
  window.SAFirebase?.DB?.onChange?.((store)=>{if(['bills','customBills'].includes(store))SA.syncReminders()});
  function resume(){if(!currentUser)return;if(window.Android?.consumeNotificationRoute?.()==='notifications')SA.go('notifications');else if(routeParts()[0]==='notifications')SA.renderNotifications();if(Date.now()-lastSync>60000)SA.syncReminders()}
  window.addEventListener('sa:native-resume',resume);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)resume()});
  window.addEventListener('DOMContentLoaded',()=>setTimeout(resume,2000));
})();
