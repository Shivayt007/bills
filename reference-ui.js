/* Warm mobile interface based on the supplied S.A Traders references. */
(function(){
  const initial=value=>String(value||'S').trim().charAt(0).toUpperCase()||'S';
  const phone=value=>String(value||'').replace(/[^0-9+]/g,'');

  renderLogin=async function(){
    if(currentUser){SA.go('dashboard');return}
    $('#app').innerHTML=`<div class="login-wrap ref-login"><div class="login-card">${brandLogo('login-brand-logo')}<h1>S.A Traders</h1><p>Firebase cloud billing</p><form id="loginForm"><div class="field mb-3"><label class="sa-label">Username</label><input class="sa-input" name="username" value="admin" autocomplete="username" required></div><div class="field mb-3"><label class="sa-label">Password</label><input class="sa-input" name="password" type="password" autocomplete="current-password" required></div><button class="sa-btn gold lg w-100" type="submit">Sign in</button></form><small class="ref-login-foot">Firestore cloud storage · admin / shiva</small></div></div>`;
    $('#loginForm').onsubmit=async ev=>{ev.preventDefault();const form=ev.target,btn=form.querySelector('button[type=submit]'),f=formObj(form);setBusy(btn,true,'Connecting…');try{currentUser=await SAFirebase.login(f.username.trim(),f.password);sessionStorage.setItem('sa_user',JSON.stringify(currentUser));await seedDb();SA.go('dashboard')}catch(e){toast(e.message||'Login failed','danger')}finally{setBusy(btn,false)}};
  };

  function billRow(b){
    const status=b.status==='closed'?'Paid':b.total_paid>0?'Part paid':'Due';
    return `<button class="ref-list-row" data-search="${esc(`${b.bill_no} ${b.name} ${b.mobile} ${b.place}`.toLowerCase())}" onclick="SA.go('bill/${encodeURIComponent(b.bill_no)}')"><span class="ux-avatar">${initial(b.name)}</span><span class="ref-list-main"><strong>${esc(b.name||'Unnamed')}</strong><small>Bill ${esc(b.bill_no)} · ${esc(b.place||'-')}</small></span><span class="ref-list-money"><strong>${money(b.pending)}</strong><small class="${b.status==='closed'?'paid':''}">${status}</small></span></button>`;
  }
  renderBills=async function(){
    const bills=await allHydratedBills();
    shell(`<div class="ref-page-head"><div><button class="ux-icon-btn" onclick="SA.back()">‹</button><h1>Bills</h1></div><div class="notification-top-actions"><button class="ux-icon-btn" aria-label="Notification history" onclick="SA.go('notifications')">${SA.bellIcon()}</button><button class="ux-icon-btn" onclick="document.getElementById('billSearch')?.focus()">⌕</button></div></div><div class="ref-search"><span>⌕</span><input id="billSearch" placeholder="Search bill, customer, mobile"></div><div class="ux-tabs ref-filter" id="refBillTabs"><button class="active" data-filter="open">Open ${bills.filter(b=>b.status!=='closed').length}</button><button data-filter="closed">Closed ${bills.filter(b=>b.status==='closed').length}</button><button data-filter="all">All</button></div><div id="refBillList" class="ref-list"></div><button class="ref-fab" onclick="SA.go('edit/new')">＋ &nbsp; New bill</button>`,'bills');
    const input=$('#billSearch'),tabs=[...document.querySelectorAll('#refBillTabs button')];let visible=20;
    const draw=()=>{const f=document.querySelector('#refBillTabs .active')?.dataset.filter||'open',q=input.value.toLowerCase().trim();const rows=bills.filter(b=>(f==='all'||(f==='open'?b.status!=='closed':b.status==='closed'))&&`${b.bill_no} ${b.name} ${b.mobile} ${b.place}`.toLowerCase().includes(q)),target=$('#refBillList');target.innerHTML=(rows.slice(0,visible).map(billRow).join('')||'<div class="empty">No matching bills.</div>')+(visible<rows.length?'<div class="load-more-wrap"><button class="sa-btn outline" id="refBillsMore">Load more</button></div>':'');$('#refBillsMore')?.addEventListener('click',()=>{visible+=20;draw()})};
    input.oninput=()=>{visible=20;draw()};tabs.forEach(t=>t.onclick=()=>{tabs.forEach(x=>x.classList.remove('active'));t.classList.add('active');visible=20;draw()});draw();
  };

  renderCustomer=async function(mobile){
    const c=await DB.get('customers',mobile),bills=(await allHydratedBills()).filter(b=>b.mobile===mobile);
    if(!c&&!bills.length){toast('Customer not found','danger');SA.go('customers');return}
    const name=c?.name||bills[0]?.name||'Customer',place=c?.place||bills[0]?.place||'-';
    const billed=sum(bills.map(b=>b.total_due)),paid=sum(bills.map(b=>b.total_paid)),pending=sum(bills.filter(b=>b.status!=='closed').map(b=>b.pending));
    const material=MATERIALS.map(([k,l])=>[l,sum(bills.map(b=>nonneg(b.balance_qty?.[k]))) ]).filter(x=>x[1]>0);
    shell(`<div class="ref-page-head"><div><button class="ux-icon-btn" onclick="SA.back()">‹</button><h1>Customer</h1></div></div><section class="ref-customer-hero"><div class="ref-customer-avatar">${initial(name)}</div><h2>${esc(name)}</h2><p>${esc(mobile)} · ${esc(place)}</p><div class="ref-customer-actions"><button onclick="SA.callCustomer('${esc(phone(mobile))}')"><b>⌕</b>Call</button><button onclick="SA.openCustomerWhatsApp('${esc(phone(mobile))}')"><b>◉</b>WhatsApp</button><button onclick="SA.go('edit/new')"><b>＋</b>New bill</button></div></section><div class="ref-money-grid"><div><span>Billed</span><strong>${money(billed)}</strong></div><div><span>Paid</span><strong>${money(paid)}</strong></div><div><span>Pending</span><strong>${money(pending)}</strong></div></div><section class="ux-section"><h3>Bills</h3>${bills.map(billRow).join('')||'<div class="empty">No bills.</div>'}</section><section class="ux-section"><h3>Materials held</h3>${material.map(x=>`<div class="ux-material-row"><span>${esc(x[0])}</span><strong>${x[1]}</strong></div>`).join('')||'<div class="empty">No materials held.</div>'}</section>`,'dashboard');
  };

  renderInventory=async function(){
    const inv=Object.fromEntries((await DB.all('inventory')).map(x=>[x.item,x])),out=await aggregateOutstanding();
    const rows=MATERIALS.map(([k,l])=>{const stock=nonneg(inv[k]?.stock_qty),rented=nonneg(out.q[k]),available=stock-rented,pct=stock?Math.max(0,Math.min(100,Math.round(rented/stock*100))):0;return `<div class="ref-stock-row"><div><strong>${esc(l)}</strong><span>${rented} rented · ${available} available</span></div><input class="sa-input" type="number" min="0" name="stock_${k}" value="${stock}" aria-label="${esc(l)} total stock"><i><b style="width:${pct}%"></b></i></div>`}).join('');
    const total=sum(MATERIALS.map(([k])=>nonneg(inv[k]?.stock_qty))),rented=sum(MATERIALS.map(([k])=>nonneg(out.q[k])));
    shell(`<div class="ref-page-head"><div><button class="ux-icon-btn" onclick="SA.back()">‹</button><h1>Inventory</h1></div></div><div class="ref-money-grid ref-stock-summary"><div><span>Total</span><strong>${total}</strong></div><div><span>On rent</span><strong>${rented}</strong></div><div><span>In yard</span><strong>${total-rented}</strong></div></div><form id="invForm"><section class="ux-section ref-stock-list"><h3>Material stock</h3>${rows}</section><section class="ux-section"><h3>Wood stock</h3>${WOODS.map(([k,l])=>`<label class="ref-wood-field"><span>${esc(l)}</span><input class="sa-input mono" name="stock_${k}" value="${esc(mapToText(inv[k]?.stock_map||{})==='0'?'':mapToText(inv[k]?.stock_map||{}))}" placeholder="8×20+10×10"></label>`).join('')}</section><div class="ref-sticky-save"><button class="sa-btn gold lg w-100" type="submit">Save inventory</button></div></form>`,'inventory');
    $('#invForm').onsubmit=async ev=>{ev.preventDefault();const f=formObj(ev.target);for(const [k] of MATERIALS)await DB.put('inventory',{item:k,stock_qty:nonneg(f[`stock_${k}`])});for(const [k] of WOODS)await DB.put('inventory',{item:k,stock_map:parseComboSizes(f[`stock_${k}`])});toast('Inventory updated');renderInventory()};
  };
})();
