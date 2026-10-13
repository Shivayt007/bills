/* Local Android reminder settings and IndexedDB-to-native reminder sync. */
(function(){
  const KEY='sa_reminder_settings_v1';
  const defaults={enabled:false,days:1};
  const read=()=>{try{return{...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch(_e){return{...defaults}}};
  const save=value=>localStorage.setItem(KEY,JSON.stringify(value));

  let timer=null,running=false;
  async function syncNow(){
    if(!window.Android?.syncBillReminders)return;
    if(running)return;running=true;
    try{
      const settings=read(),bills=await allHydratedBills();
      const reminders=bills.filter(b=>b.status!=='closed'&&Number(b.pending)>0).map(b=>{
        const cycle=b.cycles?.[b.cycles.length-1];
        const cyclePaid=sum((b.payments||[]).filter(p=>cycle&&Number(p.cycle_index)===cycle.index&&p.cycle_start_date===cycle.start_date&&p.cycle_end_date===cycle.end_date).map(p=>Number(p.amount)||0));
        return {billNo:String(b.bill_no),name:String(b.name||'Customer'),mobile:String(b.mobile||''),balance:round2(b.pending),cycle:cycle?.index||1,cycleStart:cycle?.start_date||b.start_date||'',cycleEnd:cycle?.end_date||'',cycleAmount:round2(cycle?.total||0),cyclePaid:round2(cyclePaid)};
      });
      Android.syncBillReminders(JSON.stringify(reminders),!!settings.enabled,Number(settings.days)||1);
    }catch(e){console.warn('Reminder sync failed',e)}finally{running=false}
  }
  SA.syncReminders=function(){clearTimeout(timer);timer=setTimeout(syncNow,2000)};

  SA.openNotificationSettings=function(){
    const settings=read();
    modal('Payment reminders',`<form id="reminderForm"><label class="reminder-toggle"><span><strong>Balance notifications</strong><small>Notify when a rental cycle starts and its payment is pending.</small></span><input type="checkbox" name="enabled" ${settings.enabled?'checked':''}></label><fieldset class="payment-method reminder-frequency"><legend class="sa-label">Repeat reminder</legend><div class="payment-segments">${[[1,'Daily'],[3,'3 days'],[7,'Weekly']].map(([days,label])=>`<label><input type="radio" name="days" value="${days}" ${Number(settings.days)===days?'checked':''}><span>${label}</span></label>`).join('')}</div></fieldset><p class="reminder-note">Reminders are calculated on this phone and work without internet. Android may deliver them later when battery saving is active.</p><div class="payment-submit"><button class="sa-btn gold lg w-100" type="submit">Save reminders</button></div></form>`);
    const form=$('#reminderForm');form.onsubmit=ev=>{ev.preventDefault();const value={enabled:form.elements.enabled.checked,days:Number(form.elements.days.value)||1};save(value);SA.syncReminders();SA.closeModal();toast(value.enabled?'Payment reminders enabled':'Payment reminders disabled')};
  };
  window.SAFirebase?.DB?.onChange?.((store,reason)=>{if(store==='bills'&&reason==='write')SA.syncReminders()});
})();
