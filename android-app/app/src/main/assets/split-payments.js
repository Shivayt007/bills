/* One detected bank receipt, explicitly allocated across bills and rental cycles. */
(function(){
  const cents=value=>{const s=String(value??'').trim();if(!s)return 0;if(!/^\d+(\.\d{1,2})?$/.test(s))throw new Error('Use positive amounts with at most two decimal places.');const v=Math.round(Number(s)*100);if(!Number.isSafeInteger(v))throw new Error('Amount is too large.');return v};
  const phone=value=>{let s=String(value||'').replace(/\D/g,'');return s.length===12&&s.startsWith('91')?s.slice(2):s};
  const customerKey=b=>phone(b.mobile)?'phone:'+phone(b.mobile):'bill:'+b.store+':'+b.bill_no;
  const refKey=item=>item.reference?'payment_receipt:ref:'+String(item.reference).trim().toUpperCase().replace(/\s+/g,''):'payment_receipt:id:'+item.id;
  const idKey=item=>'payment_receipt:id:'+item.id;
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const moneyC=value=>money(value/100);
  const blankError=(el,error)=>{el.textContent=error.message||String(error);el.hidden=false};
  SA.splitMoneyCents=cents;
  SA.splitReceiptKey=refKey;
  SA.validateSplit=(received,rows,values,creditAllowed)=>{
    const total=cents(received),perBill=new Map(),allocations=[];
    if(total<=0)throw new Error('Receipt amount must be greater than zero.');
    rows.forEach((row,index)=>{
      const amount=cents(values[index]);if(!amount)return;
      if(amount>row.capacity)throw new Error('Allocation exceeds the selected cycle balance.');
      perBill.set(row.billKey,(perBill.get(row.billKey)||0)+amount);
      if(perBill.get(row.billKey)>row.billPending)throw new Error('Allocation exceeds the bill’s pending amount.');
      allocations.push({row,amount});
    });
    const allocated=allocations.reduce((v,a)=>v+a.amount,0),credit=total-allocated;
    if(credit<0)throw new Error('Allocated amount exceeds the received payment.');
    if(credit&&!creditAllowed)throw new Error('Allocate the remaining amount or choose customer credit.');
    return{allocations,allocated,credit,total};
  };
  async function records(){
    const [bills,custom]=await Promise.all([DB.all('bills'),DB.all('customBills')]);
    return [...bills.map(b=>({...b,store:'bills'})),...custom.filter(b=>!b.converted_to_professional).map(b=>({...b,store:'customBills'}))];
  }
  function withoutReceipt(raw,receiptKey){
    const b=structuredClone(raw);delete b.store;
    b.payments=(b.payments||[]).filter(p=>p.receipt_key!==receiptKey);return b;
  }
  function hydrate(raw){return raw.store==='customBills'?hydrateCustom(raw).bill:hydrateBill(raw)}
  const identity=b=>b.store+':'+b.bill_no;
  function receiptHistoryButton(key,label){return '<button class="sa-btn outline" data-receipt="'+esc(key)+'">'+label+'</button>'}
  async function alreadyRecorded(item,except){
    for(const b of await records())for(const p of b.payments||[]){
      if(p.receipt_key===except)continue;
      if(p.detected_payment_id===item.id||(item.reference&&String(p.transaction_reference||'').trim().toUpperCase()===String(item.reference).trim().toUpperCase()))return true;
    }
    return false;
  }
  SA.openSplitDetectedPayment=async(id,edit=null)=>{
    try{
      if(!currentUser)throw new Error('Sign in required.');
      const item=edit?.item||JSON.parse(window.Android?.paymentCandidates?.()||'[]').find(p=>p.id===id&&!p.dismissed);
      if(!item)throw new Error('Detected payment is no longer available.');
      const key=edit?.key||refKey(item),existing=await DB.get('settings',key);
      if(existing&&!edit){await SA.manageSplitReceipt(key);return}
      if(await alreadyRecorded(item,edit?key:null))throw new Error('This transaction is already assigned to a bill.');
      const all=await records(),customers=new Map();
      for(const raw of all){
        const b=hydrate({...withoutReceipt(raw,edit?key:'__none__'),store:raw.store});
        if((b.status==='closed'&&!edit)||n(b.pending)<=0)continue;
        const cid=customerKey(raw);
        if(edit&&cid!==edit.customerKey)continue;
        if(!customers.has(cid))customers.set(cid,{key:cid,name:raw.name||'Customer',mobile:phone(raw.mobile),bills:[]});
        customers.get(cid).bills.push({raw,b});
      }
      modal('Split detected payment','<div class="split-receipt-header"><strong>'+money(item.amount)+'</strong><span>'+esc(item.source||'UPI')+' · '+esc(item.reference||item.id)+'</span></div><label class="sa-label" for="splitCustomerSearch">Select customer</label><input id="splitCustomerSearch" class="sa-input w-100" placeholder="Search name or mobile"><div id="splitCustomers" class="split-customers"></div><div id="splitCustomerError" role="alert" hidden></div>');
      const draw=()=>{
        const q=$('#splitCustomerSearch').value.toLowerCase().trim();
        const list=[...customers.values()].filter(c=>(c.name+' '+c.mobile+' '+c.bills.map(x=>x.raw.name).join(' ')).toLowerCase().includes(q));
        $('#splitCustomers').innerHTML=list.map((c,index)=>'<button class="sa-btn outline" data-customer-index="'+index+'"><strong>'+esc(c.name)+'</strong><small>'+esc(c.mobile||'No mobile recorded')+' · '+c.bills.length+' bills · '+money(sum(c.bills.map(x=>x.b.pending)))+'</small></button>').join('')||'<p>No open bills with a pending balance.</p>';
        $('#splitCustomers').querySelectorAll('button').forEach(button=>button.onclick=()=>allocationForm(item,list[Number(button.dataset.customerIndex)],all,key,existing,edit));
      };$('#splitCustomerSearch').oninput=draw;draw();
    }catch(e){toast(e.message||'Could not open split payment.','danger')}
  };
  function allocationForm(item,customer,all,key,existing,edit){
    const rows=[],billSections=[];
    const bills=customer.bills.slice().sort((a,b)=>String(a.b.start_date).localeCompare(String(b.b.start_date)));
    for(const {raw,b} of bills){
      const billKey=identity(raw),billPending=Math.round(n(b.pending)*100),indexes=[];
      const cycles=raw.store==='customBills'?[{index:0,start_date:b.start_date,end_date:b.start_date,total:b.pending}]:b.cycles||[];
      for(const cycle of cycles){
        const paid=sum((b.payments||[]).filter(p=>p.cycle_index===cycle.index&&p.cycle_start_date===cycle.start_date&&p.cycle_end_date===cycle.end_date).map(p=>p.amount));
        const capacity=Math.min(billPending,Math.max(0,Math.round((n(cycle.total)-paid)*100)));if(!capacity)continue;
        indexes.push(rows.length);rows.push({billKey,raw,cycle,capacity,billPending});
      }
      if(indexes.length)billSections.push({raw,b,billKey,indexes});
    }
    const received=cents(item.amount),values=rows.map(()=>''),oldAlloc=existing?.value?.allocations||[];
    if(edit)rows.forEach((row,index)=>{const old=oldAlloc.filter(a=>a.store===row.raw.store&&String(a.bill_no)===String(row.raw.bill_no)&&Number(a.cycle_index||0)===row.cycle.index);if(old.length)values[index]=(sum(old.map(a=>a.amount))).toFixed(2)});
    modal(edit?'Correct receipt split':'Allocate payment','<form id="splitPaymentForm"><div class="split-receipt-header"><strong>'+money(item.amount)+'</strong><span>'+esc(customer.name)+' · '+esc(customer.mobile)+'</span></div><div class="split-tools"><button type="button" id="splitSelectAll" class="sa-btn outline">Select all bills</button><button type="button" id="splitOldest" class="sa-btn outline">Fill oldest dues first</button></div><div id="splitBillList">'+billSections.map((bill,bi)=>'<section class="split-bill"><label class="split-bill-heading"><input type="checkbox" data-bill-select="'+bi+'" '+(edit&&bill.indexes.some(i=>values[i])?'checked':'')+'><span><strong>'+esc(bill.raw.store==='customBills'?'Custom #':'Bill #')+esc(bill.raw.bill_no)+'</strong><small>Pending '+money(bill.b.pending)+'</small></span></label><div class="split-cycle-inputs" data-bill-inputs="'+bi+'">'+bill.indexes.map(index=>{const row=rows[index];return '<label class="split-cycle-row"><span>'+(row.cycle.index?'Cycle #'+row.cycle.index:'Custom bill')+'<small>'+esc(row.cycle.start_date||'—')+' → '+esc(row.cycle.end_date||'—')+'</small><small>Up to '+moneyC(row.capacity)+'</small></span><input class="sa-input" aria-label="Allocate '+esc(bill.raw.bill_no)+' cycle '+row.cycle.index+'" data-allocation="'+index+'" inputmode="decimal" placeholder="0.00" value="'+values[index]+'"></label>'}).join('')+'</div></section>').join('')+'</div><label class="split-credit-choice"><input type="checkbox" id="splitKeepCredit" '+(edit&&existing?.value?.credit>0?'checked':'')+' '+(!customer.mobile?'disabled':'')+'>Keep any remainder as customer credit</label>'+(!customer.mobile?'<p class="split-note">Customer credit requires a mobile number on the bill.</p>':'')+'<div class="split-totals"><div><span>Received</span><strong>'+moneyC(received)+'</strong></div><div><span>Allocated</span><strong id="splitAllocated"></strong></div><div><span>Remaining</span><strong id="splitRemaining"></strong></div></div><div id="splitReview" hidden></div><div id="splitPaymentError" class="payment-error" role="alert" hidden></div><div class="bill-action-buttons"><button type="button" id="splitBack" class="sa-btn outline">Back</button><button type="submit" id="splitSubmit" class="sa-btn primary">Review split</button></div></form>');
    const form=$('#splitPaymentForm'),error=$('#splitPaymentError');let reviewed=false,saving=false;
    const invalidate=()=>{reviewed=false;$('#splitReview').hidden=true;$('#splitSubmit').textContent='Review split';error.hidden=true;let total=0;try{for(const v of values)total+=cents(v)}catch(e){}$('#splitAllocated').textContent=moneyC(total);$('#splitRemaining').textContent=moneyC(received-total)};
    const toggles=[...form.querySelectorAll('[data-bill-select]')];
    function toggleBill(bi){const selected=toggles[bi].checked;$('#splitBillList').querySelector('[data-bill-inputs="'+bi+'"]').hidden=!selected;for(const index of billSections[bi].indexes){const input=form.querySelector('[data-allocation="'+index+'"]');input.disabled=!selected;if(!selected){values[index]='';input.value=''}}invalidate()}
    toggles.forEach((button,bi)=>{button.onchange=()=>toggleBill(bi);toggleBill(bi)});
    form.querySelectorAll('[data-allocation]').forEach(input=>input.oninput=()=>{values[Number(input.dataset.allocation)]=input.value;invalidate()});
    $('#splitKeepCredit').onchange=invalidate;
    $('#splitSelectAll').onclick=()=>{toggles.forEach((toggle,bi)=>{toggle.checked=true;toggleBill(bi)})};
    $('#splitOldest').onclick=()=>{
      let left=received;const billLeft=new Map();
      rows.forEach((row,index)=>{const bi=billSections.findIndex(b=>b.billKey===row.billKey);if(!toggles[bi].checked)return;const available=billLeft.has(row.billKey)?billLeft.get(row.billKey):row.billPending;const amount=Math.min(left,row.capacity,available);values[index]=amount?(amount/100).toFixed(2):'';form.querySelector('[data-allocation="'+index+'"]').value=values[index];left-=amount;billLeft.set(row.billKey,available-amount)});invalidate();
    };
    $('#splitBack').onclick=()=>{if(reviewed){invalidate();return}SA.openSplitDetectedPayment(item.id,edit)};
    form.onsubmit=async event=>{
      event.preventDefault();if(saving)return;error.hidden=true;
      try{
        const result=SA.validateSplit(item.amount,rows,values,$('#splitKeepCredit').checked&&!!customer.mobile);
        if(!result.allocations.length&&!result.credit)throw new Error('Choose at least one bill.');
        if(!reviewed){
          $('#splitReview').innerHTML='<h3>Confirm receipt</h3>'+result.allocations.map(a=>'<div><span>'+esc(a.row.raw.store==='customBills'?'Custom #':'Bill #')+esc(a.row.raw.bill_no)+(a.row.cycle.index?' · Cycle #'+a.row.cycle.index:'')+'</span><strong>'+moneyC(a.amount)+'</strong></div>').join('')+(result.credit?'<div><span>Customer credit</span><strong>'+moneyC(result.credit)+'</strong></div>':'')+'<label class="split-credit-choice"><input id="splitReceiptConfirmed" type="checkbox">I verified receipt of this payment and this split.</label>';
          $('#splitReview').hidden=false;reviewed=true;$('#splitSubmit').textContent='Confirm and save';return;
        }
        if(!$('#splitReceiptConfirmed').checked)throw new Error('Confirm receipt and allocation before saving.');
        saving=true;SA.paymentSaving=true;form.querySelectorAll('button,input').forEach(el=>el.disabled=true);
        const allocations=result.allocations.map(a=>({store:a.row.raw.store,bill_no:String(a.row.raw.bill_no),cycle_index:a.row.cycle.index||null,cycle_start_date:a.row.cycle.start_date||'',cycle_end_date:a.row.cycle.end_date||'',amount:a.amount/100,payment_id:uid('pay')}));
        const receipt={kind:'split_payment_receipt',receipt_key:key,item:structuredClone(item),payment_date:existing?.value?.payment_date||today(),amount:result.total/100,allocations,credit:result.credit/100,customerKey:customer.key,customer_mobile:customer.mobile,customer_name:customer.name,version:(existing?.value?.version||0)+1,status:'active',created_at:existing?.value?.created_at||nowIso(),updated_at:nowIso(),updated_by:currentUser.username,audit:[...(existing?.value?.audit||[]),...(edit?[{action:'reallocated',reason:edit.reason,at:nowIso(),by:currentUser.username,previous_allocations:existing?.value?.allocations||[],previous_credit:existing?.value?.credit||0}]:[])]};
        const ops=await buildOperations(all,receipt,existing,edit?.reason||'');
        if(await alreadyRecorded(item,edit?key:null))throw new Error('This transaction is already assigned.');
        await DB.guardedBatch(ops);
        // The receipt and allocations are durable before the device notification is dismissed.
        try{window.Android?.dismissPaymentCandidate(item.id)}catch(e){console.warn('Receipt saved; notification will be checked on next review',e)}
        SA.paymentSaving=false;SA.closeModal();SA.syncReminders?.();toast('Receipt saved across '+new Set(allocations.map(a=>a.store+':'+a.bill_no)).size+' bills.');await renderRoute();
      }catch(e){blankError(error,e)}finally{saving=false;SA.paymentSaving=false;if(form.isConnected)form.querySelectorAll('button,input').forEach(el=>el.disabled=false)}
    };
    invalidate();
  }
  async function buildOperations(all,receipt,existing,reason){
    const ops=[],key=receipt.receipt_key,prior=existing?.value;
    const touched=new Set([...(prior?.allocations||[]),...receipt.allocations].map(a=>a.store+':'+a.bill_no));
    for(const billKey of touched){
      const raw=all.find(b=>identity(b)===billKey);if(!raw)throw new Error('A linked bill was removed. Reopen this receipt.');
      const expected=structuredClone(raw);delete expected.store;
      const b=withoutReceipt(raw,key),removed=(raw.payments||[]).filter(p=>p.receipt_key===key);
      b.payment_audit=b.payment_audit||[];
      for(const p of removed)b.payment_audit.push({action:'receipt_corrected',payment:structuredClone(p),amount:p.amount,reason,deleted_by:currentUser.username,deleted_at:nowIso()});
      for(const a of receipt.allocations.filter(a=>a.store===raw.store&&String(a.bill_no)===String(raw.bill_no))){
        b.payments.push({payment_id:a.payment_id,receipt_key:key,amount:a.amount,payment_date:receipt.payment_date,method:'UPI',note:'Split receipt · '+(receipt.item.source||'UPI'),detected_payment_id:receipt.item.id,transaction_reference:receipt.item.reference||'',payment_source:receipt.item.source||'',...(a.cycle_index?{cycle_index:a.cycle_index,cycle_start_date:a.cycle_start_date,cycle_end_date:a.cycle_end_date}:{}),created_at:nowIso(),created_by:currentUser.username});
      }
      b.updated_at=nowIso();b.updated_by=currentUser.username;ops.push({store:raw.store,expected,document:b});
    }
    if(receipt.customer_mobile){
      const customers=await DB.all('customers'),old=customers.find(c=>phone(c.mobile)===receipt.customer_mobile)||null;
      const customer=old?structuredClone(old):{mobile:receipt.customer_mobile,name:receipt.customer_name};
      customer.payment_credit_receipts=(customer.payment_credit_receipts||[]).filter(c=>c.receipt_key!==key);
      if(receipt.credit>0)customer.payment_credit_receipts.push({receipt_key:key,amount:receipt.credit,created_at:nowIso()});
      customer.payment_credit_balance=sum(customer.payment_credit_receipts.map(c=>c.amount));
      ops.push({store:'customers',expected:old,document:customer});
    }
    ops.push({store:'settings',expected:existing||null,document:{key,value:receipt}});
    const alias=idKey(receipt.item);
    if(alias!==key){
      const old=await DB.get('settings',alias);
      if(old&&old.value?.receipt_key!==key)throw new Error('Detected transaction is already recorded.');
      ops.push({store:'settings',expected:old,document:{key:alias,value:{kind:'split_receipt_alias',receipt_key:key}}});
    }
    if(ops.length>100)throw new Error('Select fewer bills in one receipt.');
    return ops;
  }
  SA.manageSplitReceipt=async key=>{
    try{
      if(!isAdmin())throw new Error('Admin access required.');
      let record=await DB.get('settings',key);
      if(record?.value?.kind==='split_receipt_alias'){key=record.value.receipt_key;record=await DB.get('settings',key)}
      const receipt=record?.value;if(receipt?.kind!=='split_payment_receipt')throw new Error('Receipt not found.');
      modal('Manage receipt','<form id="manageSplitReceipt"><div class="split-receipt-header"><strong>'+money(receipt.amount)+'</strong><span>'+esc(receipt.customer_name)+' · '+esc(receipt.item.reference||receipt.item.id)+'</span></div><div class="split-review-list">'+receipt.allocations.map(a=>'<div><span>'+esc(a.store==='customBills'?'Custom #':'Bill #')+esc(a.bill_no)+(a.cycle_index?' · Cycle #'+a.cycle_index:'')+'</span><strong>'+money(a.amount)+'</strong></div>').join('')+(receipt.credit?'<div><span>Customer credit</span><strong>'+money(receipt.credit)+'</strong></div>':'')+'</div><p>Correct the complete receipt split. Changes are saved together.</p><label class="sa-label" for="splitAdminPassword">Admin password</label><input class="sa-input w-100" id="splitAdminPassword" type="password" autocomplete="current-password" required><label class="sa-label" for="splitCorrectionReason">Reason</label><input class="sa-input w-100" id="splitCorrectionReason" required maxlength="300"><div id="manageSplitError" class="payment-error" role="alert" hidden></div><button type="submit" class="sa-btn primary w-100">Correct split</button></form>');
      $('#manageSplitReceipt').onsubmit=async event=>{event.preventDefault();const error=$('#manageSplitError');error.hidden=true;try{const reason=$('#splitCorrectionReason').value.trim();if(!reason)throw new Error('Enter the correction reason.');await SAFirebase.login('admin',$('#splitAdminPassword').value);await SA.openSplitDetectedPayment(receipt.item.id,{item:receipt.item,key,customerKey:receipt.customerKey,reason})}catch(e){blankError(error,e)}};
    }catch(e){toast(e.message,'danger')}
  };
  const originalNotifications=SA.renderNotifications;
  SA.renderNotifications=async()=>{
    await originalNotifications();
    const panel=$('#nt-payments');if(!panel)return;
    const receipts=(await DB.all('settings')).filter(x=>x.value?.kind==='split_payment_receipt').sort((a,b)=>String(b.value.updated_at).localeCompare(String(a.value.updated_at)));
    if(!panel.isConnected)return;
    const list=document.createElement('section');list.className='split-saved-receipts';
    list.innerHTML='<h3>Saved receipts</h3>'+receipts.slice(0,30).map(x=>'<article class="nt-card"><strong>'+esc(x.value.customer_name)+' · '+money(x.value.amount)+'</strong><p>'+x.value.allocations.length+' cycle allocations'+(x.value.credit?' · Credit '+money(x.value.credit):'')+'</p>'+receiptHistoryButton(x.key,'Manage receipt')+'</article>').join('');
    list.onclick=event=>{const button=event.target.closest('[data-receipt]');if(button)SA.manageSplitReceipt(button.dataset.receipt)};panel.appendChild(list);
  };
})();
