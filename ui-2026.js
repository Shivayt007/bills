/* S.A Traders 2026 mobile UI overrides. Business/data functions remain in app.js. */
(function(){
  const glyph={home:'⌂',bills:'▤',plus:'+',reports:'⌁',more:'•••',search:'⌕',user:'♙',box:'◇',doc:'▧',shield:'♢',logout:'↪',print:'▣',back:'‹'};
  const pct=(paid,due)=>due>0?Math.max(0,Math.min(100,Math.round((paid/due)*100))):0;
  const initial=s=>String(s||'S').trim().charAt(0).toUpperCase()||'S';

  topbar=function(){
    if(!currentUser) return '';
    return `<header class="ux-topbar no-print"><div class="container"><a class="ux-brand" href="#/dashboard"><div class="ux-logo">SA</div><div><strong>S.A Traders</strong><small>● Offline mode</small></div></a><button class="ux-icon-btn" onclick="SA.openMenu()">☰</button></div></header>`;
  };
  function bottom(active='home'){
    return `<nav class="ux-bottom no-print"><button class="${active==='home'?'active':''}" onclick="SA.go('dashboard')"><b>${glyph.home}</b>Home</button><button class="${active==='bills'?'active':''}" onclick="SA.go('bills')"><b>${glyph.bills}</b>Bills</button><button class="plus" onclick="SA.go('edit/new')">+</button><button class="${active==='reports'?'active':''}" onclick="SA.go('reports')"><b>${glyph.reports}</b>Reports</button><button onclick="SA.openMenu()"><b>${glyph.more}</b>More</button></nav>`;
  }
  shell=function(html,active='home'){
    const mapped=active==='dashboard'?'home':active;
    $('#app').innerHTML=topbar()+`<main class="page"><div class="container">${html}</div></main>`+bottom(mapped);
    window.scrollTo(0,0);
  };

  SA.openMenu=function(){
    let m=document.getElementById('uxMenu');
    if(!m){m=document.createElement('div');m.id='uxMenu';m.className='ux-menu';document.body.appendChild(m)}
    m.innerHTML=`<div class="container"><div class="ux-menu-head"><h1>Menu</h1><button class="ux-icon-btn" onclick="SA.closeMenu()">×</button></div><div class="ux-profile"><div class="ux-avatar">${initial(currentUser?.username)}</div><div class="grow"><strong>${esc(currentUser?.username||'admin')}</strong><small>S.A Traders · ${isAdmin()?'Administrator':'User'}</small></div><span class="ux-pill">Offline</span></div><div class="ux-menu-grid"><button class="ux-menu-tile active" onclick="SA.closeMenu();SA.go('dashboard')"><b>⌘</b>Dashboard</button><button class="ux-menu-tile" onclick="SA.closeMenu();SA.go('home')"><b>⌂</b>Home</button><button class="ux-menu-tile" onclick="SA.closeMenu();SA.go('custom')"><b>▧</b>Custom Bill</button><button class="ux-menu-tile" onclick="SA.closeMenu();SA.go('reports')"><b>⌁</b>Reports</button><button class="ux-menu-tile" onclick="SA.closeMenu();SA.go('inventory')"><b>◇</b>Inventory</button><button class="ux-menu-tile" onclick="SA.closeMenu();SA.go('slips')"><b>▤</b>Slips</button>${isAdmin()?`<button class="ux-menu-tile" onclick="SA.closeMenu();SA.go('admin')"><b>♢</b>Admin</button>`:''}<button class="ux-menu-tile logout" onclick="SA.closeMenu();SA.logout()"><b>↪</b>Logout</button></div></div>`;
    m.classList.add('open');
  };
  SA.closeMenu=function(){document.getElementById('uxMenu')?.classList.remove('open')};

  function dashCard(b,isCustom=false){
    const due=n(b.total_due), paid=n(b.total_paid), pending=n(b.pending), progress=pct(paid,due);
    const route=isCustom?`custom-view/${encodeURIComponent(b.bill_no)}`:`bill/${encodeURIComponent(b.bill_no)}`;
    return `<div class="ux-bill-card" onclick="SA.go('${route}')"><div class="ux-bill-row"><div class="ux-avatar">${initial(b.name)}</div><div class="ux-bill-main"><strong>${esc(b.name||'Unnamed')}</strong><small>Bill #${esc(b.bill_no)} · ${esc(b.mobile||'-')} · ${esc(b.place||'-')}</small></div><div class="ux-bill-money">${money(due)}<small>due</small></div></div><div class="ux-progress"><i style="width:${progress}%"></i></div><div class="ux-bill-foot"><span>${money(paid)} paid · ${money(pending)} left</span><span class="ux-pill">${esc((b.status||'open').replace(/^./,x=>x.toUpperCase()))}${!isCustom&&b.current_cycle_index?` · Cycle #${i(b.current_cycle_index)}`:''}</span></div></div>`;
  }

  renderDashboard=async function(){
    const bills=await allHydratedBills();
    const custom=(await DB.all('customBills')).filter(x=>x.dashboard_visible).map(x=>({bill:hydrateCustom(x).bill,isCustom:true}));
    const wrapped=[...bills.map(b=>({bill:b,isCustom:false})),...custom];
    const active=wrapped.filter(x=>x.bill.status!=='closed');
    const due=sum(active.map(x=>n(x.bill.total_due))),paid=sum(active.map(x=>n(x.bill.total_paid))),pending=sum(active.map(x=>n(x.bill.pending)));
    const progress=pct(paid,due);
    shell(`<div class="ux-dashboard-head"><div class="ux-shop"><div class="logo">SA</div><div><strong>S.A Traders</strong><span>● Offline mode</span></div></div><button class="ux-icon-btn" onclick="document.getElementById('dashSearch')?.focus()">${glyph.search}</button></div>
    <section class="ux-hero"><div class="ux-hero-grid"><div><div class="label">Total due</div><div class="amount">${money(due)}</div></div><div class="ux-ring">${progress}%</div></div><div class="ux-hero-stats"><div><span>Paid</span><strong>${money(paid)}</strong></div><div><span>Pending</span><strong>${money(pending)}</strong></div><div><span>Active bills</span><strong>${active.length}</strong></div></div></section>
    <div class="ux-quick"><button onclick="SA.go('edit/new')"><span class="ico">▧</span>New Bill</button><button onclick="SA.go('customers')"><span class="ico">♙</span>Customers</button><button onclick="SA.go('reports')"><span class="ico">⌁</span>Reports</button><button onclick="SA.go('inventory')"><span class="ico">◇</span>Inventory</button></div>
    <div class="ux-tabs" id="dashTabs"><button class="active" data-f="open">Open · ${active.length}</button><button data-f="closed">Closed</button><button data-f="all">All</button></div>
    <input id="dashSearch" class="sa-input mb-3" placeholder="Search bill / customer / mobile" style="width:100%">
    <div class="ux-bill-list" id="uxBillList">${active.length?active.map(x=>dashCard(x.bill,x.isCustom)).join(''):`<div class="empty"><strong>No active bills</strong>Create your first bill.</div>`}</div>`, 'home');
    const search=$('#dashSearch'),tabs=[...document.querySelectorAll('#dashTabs button')];
    async function refresh(filter){
      const q=(search.value||'').toLowerCase().trim();
      let arr=wrapped.filter(x=>filter==='all'||(filter==='open'?x.bill.status!=='closed':x.bill.status==='closed'));
      if(q) arr=arr.filter(x=>`${x.bill.bill_no} ${x.bill.name} ${x.bill.mobile} ${x.bill.place}`.toLowerCase().includes(q));
      $('#uxBillList').innerHTML=arr.length?arr.map(x=>dashCard(x.bill,x.isCustom)).join(''):`<div class="empty">No matching bills.</div>`;
    }
    tabs.forEach(t=>t.onclick=()=>{tabs.forEach(x=>x.classList.remove('active'));t.classList.add('active');refresh(t.dataset.f)});
    search.oninput=()=>refresh(document.querySelector('#dashTabs .active')?.dataset.f||'open');
  };

  function woodMatrix(b){
    const groups=WOODS.map(([k,label,rf])=>{const entries=Object.entries(b.balance_wood?.[k]||{}).map(([ft,pcs])=>({ft:n(ft),pcs:i(pcs)})).filter(x=>x.ft>0&&x.pcs>0).sort((a,z)=>a.ft-z.ft);const feet=round2(sum(entries.map(x=>x.ft*x.pcs)));const rate=n(b.rates?.[rf],DEFAULT_RATES[rf]);return{label,entries,feet,amount:round2(feet*rate)}});
    const rows=Math.max(1,...groups.map(g=>g.entries.length));
    const body=Array.from({length:rows},(_,r)=>`<tr>${groups.map(g=>{const x=g.entries[r];return `<td>${x?`${x.ft}×${x.pcs}`:'&nbsp;'}</td>`}).join('')}</tr>`).join('');
    return `<div class="ux-wood"><table><thead><tr>${groups.map(g=>`<th>${esc(g.label).toUpperCase()}</th>`).join('')}</tr></thead><tbody>${body}</tbody><tfoot><tr>${groups.map(g=>`<td>${g.feet} ft<small>${money(g.amount)}</small></td>`).join('')}</tr></tfoot></table></div>`;
  }
  SA.uxTab=function(name){document.querySelectorAll('.ux-tabpane').forEach(x=>x.classList.toggle('active',x.dataset.pane===name));document.querySelectorAll('#billUxTabs button').forEach(x=>x.classList.toggle('active',x.dataset.tab===name))};

  renderBill=async function(id){
    const raw=await DB.get('bills',id); if(!raw){shell(`<div class="sa-alert danger">Bill not found.</div>`);return}
    const b=hydrateBill(raw), due=n(b.total_due),paid=n(b.total_paid),pending=n(b.pending),progress=pct(paid,due),cycle=Math.max(i(b.current_cycle_index,1),1);
    const materials=MATERIALS.map(([k,l])=>`<div class="ux-material-row"><strong>${esc(l)}</strong><span class="ux-qty ${nonneg(b.balance_qty?.[k])>0?'has':''}">${nonneg(b.balance_qty?.[k])}</span></div>`).join('');
    const lastCycle=b.cycles?.[b.cycles.length-1];const currentRent=n(lastCycle?.rent,0);
    const pays=(b.payments||[]).slice().reverse().map(p=>`<div class="ux-material-row"><span>${esc(p.payment_date||p.date||'-')}<small style="display:block;color:var(--ux-muted)">${esc([p.method,p.note].filter(Boolean).join(' · '))}</small></span><strong>${money(p.amount)}</strong></div>`).join('')||'<div class="empty">No payments recorded.</div>';
    const cycles=(b.cycles||[]).slice().reverse().map(c=>`<div class="ux-material-row"><span>Cycle #${c.index}<small style="display:block;color:var(--ux-muted)">${esc(c.start_date)} → ${esc(c.end_date)}</small></span><strong>${money(c.total)}</strong></div>`).join('')||'<div class="empty">No cycles.</div>';
    shell(`<div class="ux-detail-head"><button class="ux-icon-btn" onclick="SA.back()">‹</button><h2>Bill #${esc(b.bill_no)}</h2><div><button class="ux-icon-btn" onclick="SA.go('print-invoice/${encodeURIComponent(b.bill_no)}')">▣</button> <button class="sa-btn outline" onclick="SA.go('edit/${encodeURIComponent(b.bill_no)}')">Edit</button></div></div>
    <div class="ux-detail-person"><div class="ux-avatar">${initial(b.name)}</div><div class="meta"><strong>${esc(b.name||'-')}</strong><span>${esc(b.mobile||'-')} · ${esc(b.place||'-')}</span></div><span class="ux-pill">${b.status==='closed'?'Closed':'Open'}</span></div>
    <section class="ux-summary"><div class="ux-summary-top"><div><span style="color:var(--ux-muted)">Total due</span><div class="due">${money(due)}</div></div><div class="cycle">Cycle #${cycle}<br>${i(b.cycle_days)} days</div></div><div class="bar"><i style="width:${progress}%"></i></div><div class="ux-summary-stats"><div><span>Paid</span><strong>${money(paid)}</strong></div><div><span>Pending</span><strong class="pending">${money(pending)}</strong></div><div><span>Advance</span><strong>${money(b.advance_locked)}</strong></div></div><div style="color:var(--ux-muted);margin-top:16px">Started ${esc(b.start_date||'-')}</div></section>
    <div class="ux-tabs" id="billUxTabs"><button class="active" data-tab="materials" onclick="SA.uxTab('materials')">Materials</button><button data-tab="payments" onclick="SA.uxTab('payments')">Payments</button><button data-tab="details" onclick="SA.uxTab('details')">Details</button></div>
    <div class="ux-tabpane active" data-pane="materials"><section class="ux-section"><h3>Current materials</h3>${materials}<div class="ux-actions2"><button class="ux-outline" onclick="SA.openAdditional('${esc(b.bill_no)}')">＋ Add</button><button class="ux-outline" onclick="SA.openReturn('${esc(b.bill_no)}')">↶ Return</button></div></section><section class="ux-section"><h3>Wood materials</h3>${woodMatrix(b)}<div class="ux-rent-total"><span>RENT TOTAL</span><strong>${money(currentRent)}</strong></div></section></div>
    <div class="ux-tabpane" data-pane="payments"><section class="ux-section"><h3>Payment history</h3>${pays}</section></div>
    <div class="ux-tabpane" data-pane="details"><section class="ux-section"><h3>Customer details</h3><div class="ux-material-row"><span>Name</span><strong>${esc(b.name||'-')}</strong></div><div class="ux-material-row"><span>Mobile</span><strong>${esc(b.mobile||'-')}</strong></div><div class="ux-material-row"><span>Place</span><strong>${esc(b.place||'-')}</strong></div><div class="ux-material-row"><span>Start date</span><strong>${esc(b.start_date||'-')}</strong></div><div class="ux-material-row"><span>Cycle</span><strong>${i(b.cycle_days)} days</strong></div></section><section class="ux-section"><h3>Rental cycles</h3>${cycles}</section></div>
    <div class="ux-paybar no-print"><button class="pay" onclick="SA.quickPayment('${esc(b.bill_no)}',false)">▤ &nbsp; Record Payment</button><button class="more" onclick="SA.openMenu()">•••</button></div>`, 'bills');
  };
})();

