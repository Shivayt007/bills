/* Explicit, previewed bill reminders through the standalone YouPI-derived WhatsApp transport. */
(function(){
  const pending=new Map();
  let counter=0;
  const native=()=>window.WhatsAppService;
  window.SAWhatsAppResult=(id,ok,result)=>{const entry=pending.get(id);if(!entry)return;clearTimeout(entry.timer);pending.delete(id);ok?entry.resolve(result):entry.reject(new Error(result.error||'WhatsApp request failed.'));};
  function request(action,data={}){
    if(!native())return Promise.reject(new Error('Install the updated Android app to use the linked WhatsApp service.'));
    return new Promise((resolve,reject)=>{
      const id='wa_'+Date.now()+'_'+(++counter),timer=setTimeout(()=>{pending.delete(id);reject(new Error('Request timed out. Check the WhatsApp chat before retrying a send.'));},40000);
      pending.set(id,{resolve,reject,timer});
      try{native().request(id,action,JSON.stringify(data));}catch(error){clearTimeout(timer);pending.delete(id);reject(error);}
    });
  }
  function phone(value){let number=String(value||'').trim();if(!/^[+\d ()-]+$/.test(number))throw new Error('Enter a valid customer mobile number.');number=number.replace(/\D/g,'');if(number.length===11&&number[0]==='0')number=number.slice(1);if(number.length===10)number='91'+number;if(!/^[1-9]\d{9,14}$/.test(number))throw new Error('Enter a valid customer mobile number.');return number;}
  function message(row){
    const upcoming=row.category==='upcoming';
    return 'Hello '+row.name+',\n\n'+(BUSINESS.name||'S.A Traders')+' rental bill reminder.\n'+(row.isCustom?'Custom bill':'Bill')+' #'+row.billNo+'\n'+(upcoming?'Upcoming cycle date: ':'Due date: ')+row.date+'\n'+(upcoming?'Expected cycle amount: ':'Pending amount: ')+money(row.balance)+'\n\n'+(upcoming?'This is an advance reminder for your upcoming rental cycle.':'Please arrange payment. If you have already paid, please share the payment details so we can update your bill.')+'\n\nThank you.\n'+(BUSINESS.name||'S.A Traders')+(BUSINESS.phone?'\n'+BUSINESS.phone:'');
  }
  SA.whatsappReminderMessage=message;
  SA.whatsappReminderPhone=phone;
  SA.openWhatsAppSetup=()=>{
    if(!roleGuard())return;
    if(!native()){toast('Install the updated Android app for WhatsApp setup.','warning');return;}
    let config={};try{config=JSON.parse(native().config())}catch(e){}
    modal('WhatsApp setup',`<form id="waConfig"><p>Connect the shop’s WhatsApp account to send bill reminders from this app.</p><label class="sa-label" for="waUrl">Reminder service HTTPS URL</label><input class="sa-input w-100" id="waUrl" type="url" placeholder="https://your-reminders.easypanel.host" value="${esc(config.url||'')}" required><label class="sa-label" for="waToken">API token</label><input class="sa-input w-100" id="waToken" type="password" autocomplete="new-password" placeholder="${config.configured?'Saved — leave blank to keep':'Token from your reminder service'}"><p class="reminder-note">Setup is saved securely on this phone. Use the standalone reminder service deployed from your bills repository.</p><button class="sa-btn gold w-100" type="submit">Save setup</button></form><hr><div id="waStatus" role="status">Refresh status to check the connection.</div><div id="waPairing" style="overflow-wrap:anywhere"></div><div class="actions mt-3"><button class="sa-btn outline" id="waRefresh">Refresh status</button><button class="sa-btn outline" id="waQr">Get linking QR</button></div><label class="sa-label" for="waPhone">Shop WhatsApp number</label><input class="sa-input w-100" id="waPhone" type="tel" placeholder="10-digit number or country code + number"><button class="sa-btn primary w-100 mt-3" id="waLink">Get phone linking code</button><p class="reminder-note">In WhatsApp: Settings → Linked devices → Link a device → Link with phone number instead. Enter the code here shown by the service. For QR, scan it from another screen.</p><button class="sa-btn danger w-100" id="waDisconnect">Disconnect linked WhatsApp</button>`);
    const status=$('#waStatus'),pairing=$('#waPairing');
    const show=data=>{
      status.textContent=data.connected?'WhatsApp connected — ready to send reminders.':'WhatsApp: '+data.status;
      pairing.replaceChildren();
      if(data.pairingCode){const code=document.createElement('strong');code.textContent=data.pairingCode;code.style.fontSize='28px';pairing.append(code);}
      if(data.qr&&/^data:image\/png;base64,/.test(data.qr)){const image=document.createElement('img');image.src=data.qr;image.alt='WhatsApp linking QR';image.style.cssText='max-width:100%;width:280px;display:block';pairing.append(image);}
    };
    const run=async(button,action,data)=>{button.disabled=true;try{show(await request(action,data))}catch(e){status.textContent=e.message}finally{button.disabled=false}};
    $('#waConfig').onsubmit=ev=>{ev.preventDefault();const token=$('#waToken'),result=native().save($('#waUrl').value,token.value);token.value='';status.textContent=result==='ok'?'Setup saved. Refresh status, or link your shop WhatsApp.':result;};
    $('#waRefresh').onclick=ev=>run(ev.target,'status');
    $('#waQr').onclick=ev=>run(ev.target,'link');
    $('#waLink').onclick=ev=>{try{run(ev.target,'link',{phone:phone($('#waPhone').value)})}catch(e){status.textContent=e.message}};
    $('#waDisconnect').onclick=ev=>{if(confirm('Disconnect the shop WhatsApp account from the reminder service?'))run(ev.target,'logout');};
    if(config.configured)run($('#waRefresh'),'status');
  };
  SA.openWhatsAppReminder=async(billNo,isCustom,category)=>{
    if(!requireAuth())return;
    if(!native()){toast('Install the updated Android app to send linked WhatsApp reminders.','warning');return;}
    try{
      // Re-read the engine's current reminders rather than using the card's stale amount.
      const groups=SA.reminderCategories(await SA.reminderData());
      const row=(groups[category]||[]).find(r=>r.billNo===String(billNo)&&!!r.isCustom===!!isCustom);
      if(!row||row.balance<=0)throw new Error('This bill is no longer due in this category. Refresh the reminder list.');
      const to=phone(row.mobile),original=message(row);
      const config=JSON.parse(native().config());if(!config.configured)throw new Error('An admin must complete WhatsApp setup first.');
      const requestId='reminder_'+crypto.randomUUID();
      modal('Send bill reminder',`<form id="waReminderForm"><p><strong>${esc(row.name)}</strong><br>WhatsApp: +${esc(to)}<br>${row.isCustom?'Custom bill':'Bill'} #${esc(row.billNo)}</p><label class="sa-label" for="waMessage">Message</label><textarea class="sa-input w-100" id="waMessage" rows="11" maxlength="4000" required>${esc(original)}</textarea><p class="reminder-note">Review the recipient and amount before sending. A sent reminder does not record a payment.</p><div id="waSendStatus" role="status"></div><div class="actions"><button type="button" class="sa-btn outline" onclick="SA.closeModal()">Cancel</button><button class="sa-btn primary" type="submit">Send WhatsApp reminder</button></div></form>`);
      const form=$('#waReminderForm'),status=$('#waSendStatus');let inFlight=false,frozen=null;
      form.onsubmit=async ev=>{
        ev.preventDefault();if(inFlight)return;
        if(!currentUser){status.textContent='Sign in again before sending.';return;}
        const button=form.querySelector('[type=submit]'),text=$('#waMessage');
        if(!text.value.trim())return;
        inFlight=true;button.disabled=true;text.readOnly=true;
        // The same payload + ID is retained for a retry after a network timeout.
        frozen=frozen||{requestId,to,message:text.value,billNo:String(billNo)};
        status.textContent='Sending…';
        try{
          // Refuse a send when payment, bill status, recipient or amount changed during the preview.
          const latest=(SA.reminderCategories(await SA.reminderData())[category]||[]).find(r=>r.billNo===String(billNo)&&!!r.isCustom===!!isCustom);
          if(!latest||latest.balance!==row.balance||phone(latest.mobile)!==to||latest.date!==row.date)throw new Error('Bill details changed. Close this preview and open the reminder again.');
          const result=await request('send',frozen);
          if(!result.accepted)throw new Error('The server did not confirm the send. Check WhatsApp before retrying.');
          status.textContent='Reminder submitted to WhatsApp. Delivery and read status are not confirmed.';
          button.textContent='Submitted';form.onsubmit=ev=>ev.preventDefault();
        }catch(e){status.textContent=e.message;button.disabled=false;button.textContent='Retry same reminder';inFlight=false;}
      };
    }catch(e){toast(e.message,'warning');}
  };
})();
