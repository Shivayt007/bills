'use strict';

const SA = window.SA = {};
SA.cache=window.SADataCache;

// =========================================================
// CONSTANTS — ported from the original Flask application
// =========================================================
const BUSINESS = {
  name: 'S.A Traders',
  address: 'Vijayanagar, Gandhi Street, Medavakkam, Chennai',
  phone: '7904846694'
};
const DEFAULT_RATES = {
  jackey_rate: 65, jackey9_rate: 100, sheet_rate: 35, half_sheet_rate: 30,
  span_rate: 100, inner3m_rate: 60, wood_12_rate: 18, wood_9_rate: 18,
  wood_6_rate: 15, runner_rate: 7
};
const MATERIALS = [
  ['jackey','Jackey','jackey_qty','jackey_rate'],
  ['jackey9','9 Jackey','jackey9_qty','jackey9_rate'],
  ['sheet','Sheet','sheet_qty','sheet_rate'],
  ['half_sheet','Half Sheet','half_sheet_qty','half_sheet_rate'],
  ['span','Span','span_qty','span_rate'],
  ['inner3m','3M Inner','inner3m_qty','inner3m_rate']
];
const WOODS = [
  ['wood_12','12 Ft Wood','wood_12_rate'],
  ['wood_9','9 Ft Wood','wood_9_rate'],
  ['wood_6','6 Ft Wood','wood_6_rate'],
  ['runner','Runner','runner_rate']
];
const DEFAULT_TERMS = `1) Rent is cycle-based (15/20/30 days as per bill).\n2) Transport/Loading/Unloading applies only in first cycle.\n3) Advance is security deposit (refundable at bill close).\n4) Damages/missing materials will be charged separately.\n5) Payment due within agreed period; late payments may attract penalty.`;
const DEFAULT_CUSTOM_RULES = `1) Materials must be checked at the time of delivery.\n2) Damaged or missing materials will be charged separately.\n3) Transport, loading and unloading charges are non-refundable.\n4) Advance amount is calculated from material + wood only.`;
const DEFAULT_CUSTOM_TERMS = `1) This custom bill is prepared as a one-time shop bill.\n2) Grand total includes material, wood, transport, loading, unloading and advance amount.\n3) Payment and return conditions are subject to shop approval.`;

// =========================================================
// SMALL UTILITIES
// =========================================================
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => Array.from(root.querySelectorAll(s));
const n = (v,d=0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
const i = (v,d=0) => Math.trunc(n(v,d));
const nonneg = v => Math.max(i(v),0);
const round2 = v => Math.round((n(v)+Number.EPSILON)*100)/100;
const money = v => '₹' + round2(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc = v => String(v??'').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const uid = (p='id') => p + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,9);
const today = () => new Date().toISOString().slice(0,10);
const nowIso = () => new Date().toISOString();
const parseDate = s => { if(!s) return null; const d=new Date(String(s).slice(0,10)+'T00:00:00'); return Number.isNaN(d.getTime())?null:d; };
const ymd = d => { const z=new Date(d.getTime()-d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10); };
const addDays = (d,days) => { const x=new Date(d); x.setDate(x.getDate()+days); return x; };
const dayDiff = (a,b) => Math.floor((b-a)/86400000);
const sum = arr => round2(arr.reduce((a,b)=>a+n(b),0));
const formObj = form => Object.fromEntries(new FormData(form).entries());
const textToHtml = s => esc(s).replace(/\n/g,'<br>');
const BRAND_LOGO='sa-traders-logo.jpg';
function brandLogo(className='brand-logo',alt='S.A Traders'){return `<img class="${esc(className)}" src="${BRAND_LOGO}" alt="${esc(alt)}">`;}

function toast(msg,type='success'){
  const stack=$('#toasts'); if(!stack)return;
  const key=type+'|'+String(msg);
  for(const old of Array.from(stack.children)) if(old.dataset.toastKey===key) old.remove();
  const el=document.createElement('div'); el.className='toast '+type; el.textContent=msg; el.dataset.toastKey=key;
  stack.appendChild(el); while(stack.children.length>3) stack.firstElementChild?.remove();
  setTimeout(()=>el.remove(),3200);
  if(window.Android?.toast) try{ Android.toast(msg); }catch(_e){}
}
function confirmAction(msg){ return window.confirm(msg); }
function promptValue(msg,def=''){ const v=window.prompt(msg,def); return v===null?null:v.trim(); }
function statusBadge(s){ return `<span class="sa-badge ${s==='open'?'open':'closed'}">${esc((s||'open').toUpperCase())}</span>`; }
function setBusy(btn,on,label='Saving…'){ if(!btn)return; if(on){btn.dataset.old=btn.innerHTML;btn.disabled=true;btn.innerHTML=label}else{btn.disabled=false;btn.innerHTML=btn.dataset.old||btn.innerHTML} }

// =========================================================
// FIREBASE FIRESTORE — cloud business data
// =========================================================
const STORES=['bills','customers','customBills','slips','challans','inventory','settings'];
if(!window.SAFirebase) throw new Error('Firebase client failed to load');
const DB=window.SAFirebase.DB;
async function setting(key,def=null){ const x=await DB.get('settings',key); return x?x.value:def; }
async function setSetting(key,value){ await DB.put('settings',{key,value}); }
async function nextSeq(key){ const v=i(await setting(key,0))+1; await setSetting(key,v); return v; }
async function nextAvailableBillNo(){
  const bills=await DB.all('bills'); const used=new Set(bills.map(b=>String(b.bill_no??'').trim()).filter(Boolean));
  const nums=[...used].filter(x=>/^\d+$/.test(x)).map(Number); let x=nums.length?Math.max(...nums)+1:1;
  while(used.has(String(x)))x++; return String(x);
}
async function seedDb(){
  const defaults={terms_invoice:DEFAULT_TERMS,custom_rules:DEFAULT_CUSTOM_RULES,custom_terms:DEFAULT_CUSTOM_TERMS};
  for(const [k,v] of Object.entries(defaults)) if(await setting(k,null)===null) await setSetting(k,v);
  for(const [item] of MATERIALS){ if(!await DB.get('inventory',item)) await DB.put('inventory',{item,stock_qty:0}); }
  for(const [item] of WOODS){ if(!await DB.get('inventory',item)) await DB.put('inventory',{item,stock_map:{}}); }
}

// =========================================================
// BILLING ENGINE — translated from app.py helpers
// =========================================================
function parseComboSizes(s){
  const out={}; const text=String(s||'').replace(/[,\n+]/g,' '); const re=/(\d+(?:\.\d+)?)\s*[\*x×]\s*(\d+(?:\.\d+)?)/gi; let m;
  while((m=re.exec(text))){ const feet=n(m[1]); const pcs=i(m[2]); if(feet>0&&pcs>0) out[String(feet)]=(out[String(feet)]||0)+pcs; }
  return out;
}
function mapToText(m){ const keys=Object.keys(m||{}).map(Number).sort((a,b)=>a-b); return keys.length?keys.filter(k=>i(m[String(k)])>0).map(k=>`${k}×${i(m[String(k)])}`).join('+'):'0'; }
function addMaps(a,b){ const o={...(a||{})}; for(const [k,v] of Object.entries(b||{})) o[k]=i(o[k])+i(v); for(const k of Object.keys(o)) if(o[k]<=0) delete o[k]; return o; }
function subtractMaps(a,b){ const o={...(a||{})}; for(const [k,v] of Object.entries(b||{})){o[k]=i(o[k])-i(v); if(o[k]<=0) delete o[k];} return o; }
function ratesOf(b){ const r={}; for(const [k,v] of Object.entries(DEFAULT_RATES)) r[k]=n(b?.[k],v); return r; }
function baseQty(b){ const o={}; for(const [key,_label,qf] of MATERIALS) o[key]=nonneg(b?.[qf]); return o; }
function baseWood(b){ const o={}; for(const [key] of WOODS) o[key]=parseComboSizes(b?.[key]||''); return o; }
function woodStats(map,rate){ let feet=0,pieces=0; for(const [f,p] of Object.entries(map||{})){pieces+=i(p);feet+=n(f)*i(p)} return {pieces,total_feet:round2(feet),amount:round2(feet*n(rate))}; }
function calcRent(qty,wood,rates){
  const lines=[]; let mt=0; for(const [key,label,_qf,rf] of MATERIALS){ const q=nonneg(qty[key]); const amt=round2(q*n(rates[rf])); mt+=amt; lines.push({key,label,qty:q,rate:n(rates[rf]),amount:amt}); }
  const woods={}; let wt=0; for(const [key,label,rf] of WOODS){ const st=woodStats(wood[key]||{},rates[rf]); woods[key]={key,label,rate:n(rates[rf]),text:mapToText(wood[key]||{}),...st}; wt+=st.amount; }
  return {materials_total:round2(mt),wood_total:round2(wt),rent_total:round2(mt+wt),lines_materials:lines,wood_totals:woods};
}
function transport(b){ const up=nonneg(b.transport_up_trips)*n(b.transport_up_charge); const down=nonneg(b.transport_down_trips)*n(b.transport_down_charge); const loading=n(b.loading_charge); const unloading=n(b.unloading_charge); return {up:round2(up),down:round2(down),loading:round2(loading),unloading:round2(unloading),total:round2(up+down+loading+unloading)}; }
function cycleIndex(start,days,d){ if(d<=start)return 1; return Math.floor(dayDiff(start,d)/Math.max(days,1))+1; }
function effectiveCycle(start,days,d){ return cycleIndex(start,days,d)+1; }
function historyTotals(list){
  const mat=Object.fromEntries(MATERIALS.map(x=>[x[0],0])); const wood=Object.fromEntries(WOODS.map(x=>[x[0],{}]));
  for(const x of list||[]){ for(const k of Object.keys(mat)) mat[k]+=nonneg(x.items?.[k]); for(const k of Object.keys(wood)) wood[k]=addMaps(wood[k],x.wood?.[k]||{}); }
  return {mat,wood};
}
function snapshotForCycle(b,idx){
  const base=baseQty(b), bw=baseWood(b); const minus=Object.fromEntries(MATERIALS.map(x=>[x[0],0])); const plus=Object.fromEntries(MATERIALS.map(x=>[x[0],0])); const mw=Object.fromEntries(WOODS.map(x=>[x[0],{}])); const pw=Object.fromEntries(WOODS.map(x=>[x[0],{}]));
  for(const r of b.return_history||[]) if(i(r.effective_from_cycle,999999)<=idx){ for(const k of Object.keys(minus)) minus[k]+=nonneg(r.items?.[k]); for(const k of Object.keys(mw)) mw[k]=addMaps(mw[k],r.wood?.[k]||{}); }
  for(const a of b.additional_history||[]) if(i(a.effective_from_cycle,999999)<=idx){ for(const k of Object.keys(plus)) plus[k]+=nonneg(a.items?.[k]); for(const k of Object.keys(pw)) pw[k]=addMaps(pw[k],a.wood?.[k]||{}); }
  const q={}; const w={}; for(const k of Object.keys(base)) q[k]=Math.max(base[k]+plus[k]-minus[k],0); for(const k of Object.keys(bw)) w[k]=subtractMaps(addMaps(bw[k],pw[k]),mw[k]); return {qty:q,wood:w};
}
function hydrateBill(raw){
  const b=structuredClone(raw||{}); b.payments=b.payments||[]; b.payment_audit=b.payment_audit||[]; b.return_history=b.return_history||[]; b.additional_history=b.additional_history||[]; b.status=b.status||'open';
  const rates=ratesOf(b); b.rates=rates; b.base_qty=baseQty(b); b.base_wood_maps=baseWood(b);
  const rt=historyTotals(b.return_history), at=historyTotals(b.additional_history); b.return_totals=rt.mat; b.return_totals_wood=rt.wood; b.additional_totals=at.mat; b.additional_totals_wood=at.wood;
  b.balance_qty={}; b.balance_wood={}; for(const k of Object.keys(b.base_qty)) b.balance_qty[k]=Math.max(b.base_qty[k]+at.mat[k]-rt.mat[k],0); for(const k of Object.keys(b.base_wood_maps)) b.balance_wood[k]=subtractMaps(addMaps(b.base_wood_maps[k],at.wood[k]),rt.wood[k]); b.balance_wood_text=Object.fromEntries(Object.entries(b.balance_wood).map(([k,v])=>[k,mapToText(v)]));
  if(b.calculation_type==='customshop_professional') return hydrateConvertedCustom(b);
  const start=parseDate(b.start_date); const days=Math.max(i(b.cycle_days,30),1); b.transport_breakdown=transport(b);
  if(!start){ b.cycles=[]; b.total_due=0; b.total_paid=sum(b.payments.map(p=>p.amount)); b.advance_locked=round2(b.advance_amount); b.rent_paid=b.total_paid; b.pending=0; b.current_cycle_index=0; return b; }
  let until=parseDate(today()); if(b.status==='closed'&&parseDate(b.closed_at)) until=parseDate(b.closed_at); const cycles=[]; let idx=1,cur=new Date(start);
  while(cur<=until && idx<500){ const end=addDays(cur,days-1); const snap=snapshotForCycle(b,idx); const rb=calcRent(snap.qty,snap.wood,rates); const tr=idx===1?b.transport_breakdown.total:0; cycles.push({index:idx,start_date:ymd(cur),end_date:ymd(end),rent:rb.rent_total,transport:tr,total:round2(rb.rent_total+tr),snapshot_qty:snap.qty,snapshot_wood:snap.wood}); cur=addDays(end,1); idx++; }
  b.cycles=cycles; b.total_due=sum(cycles.map(c=>c.total)); b.total_paid=sum(b.payments.map(p=>p.amount)); b.advance_locked=round2(b.advance_amount); b.rent_paid=b.total_paid; b.pending=Math.max(round2(b.total_due-b.rent_paid),0); b.current_cycle_index=cycles.length?cycles[cycles.length-1].index:0; return b;
}
function hydrateCustom(raw){
  const b=structuredClone(raw||{}); b.payments=b.payments||[]; b.return_history=b.return_history||[]; b.additional_history=b.additional_history||[]; b.status=b.status||'custom'; const r=ratesOf(b); const br=calcRent(baseQty(b),baseWood(b),r); const tr=transport(b); const material=br.materials_total, wood=br.wood_total, materialRent=round2(material+wood); const advance=materialRent; const vehicle=round2(tr.up+tr.down); const grand=round2(materialRent+vehicle+tr.loading+tr.unloading+advance); const paid=sum(b.payments.map(p=>p.amount)); b.advance_amount=advance; b.total_due=grand; b.total_paid=paid; b.pending=Math.max(round2(grand-paid),0); return {bill:b,breakdown:br,transport:tr,calc:{material_total:material,wood_total:wood,material_rent_total:materialRent,transport_vehicle_total:vehicle,loading:tr.loading,unloading:tr.unloading,advance_amount:advance,grand_total:grand,payable_without_advance:round2(grand-advance)}};
}
function hydrateConvertedCustom(b){
  const r=ratesOf(b), br=calcRent(baseQty(b),baseWood(b),r), tr=transport(b), materialRent=br.rent_total, advance=materialRent, grand=round2(materialRent+tr.total+advance), paid=sum((b.payments||[]).map(p=>p.amount)); const start=parseDate(b.start_date)||parseDate(today()), days=Math.max(i(b.cycle_days,30),1), end=addDays(start,days-1);
  b.advance_amount=advance;b.advance_locked=advance;b.transport_breakdown=tr;b.cycles=[{index:1,start_date:ymd(start),end_date:ymd(end),rent:round2(materialRent+advance),transport:tr.total,total:grand,snapshot_qty:baseQty(b),snapshot_wood:baseWood(b)}];b.total_due=grand;b.total_paid=paid;b.rent_paid=paid;b.pending=Math.max(round2(grand-paid),0);b.current_cycle_index=1;b.custom_material_rent_total=materialRent;b.custom_transport_total=tr.total;b.custom_grand_total=grand;if(b.status!=='closed')b.status=b.pending<=0?'closed':'open';return b;
}
function physicalOutstanding(b){ return {qty:b.balance_qty,wood:b.balance_wood}; }

// =========================================================
// AUTH + ROUTING
// =========================================================
let currentUser=null;
function userRole(){return currentUser?.role||''}
function isAdmin(){return userRole()==='admin'}
function routeParts(){ const h=(location.hash||'#/login').replace(/^#\/?/,''); return h.split('/').filter(Boolean).map(decodeURIComponent); }
SA.go=(path)=>{ location.hash='#/'+path.replace(/^\//,''); };
SA.back=()=>{ if(history.length>1) history.back(); else SA.go('dashboard'); };
SA.logout=()=>{ SAFirebase.logout(); currentUser=null; SA.go('login'); };
function requireAuth(){ if(!currentUser){SA.go('login');return false} return true; }
function roleGuard(){ if(!isAdmin()){ toast('Admin access required','danger'); SA.go('dashboard'); return false;} return true; }

function topbar(active=''){
  if(!currentUser) return '';
  const nav=[['home','Home'],['dashboard','Dashboard'],['custom','Custom Bill'],['reports','Reports'],['inventory','Inventory'],['slips','Slips'],['admin','Admin']];
  return `<header class="sa-topbar no-print"><div class="container">
    <a class="sa-brand" href="#/home">${brandLogo('sa-brand-logo')}<div class="sa-brand-text">S.A Traders<small>Billing System · Firebase</small></div></a>
    <button class="sa-mobile-toggle" onclick="SA.toggleNav()">☰</button>
    <div class="sa-nav-wrap" id="navWrap"><nav class="sa-nav">${nav.map(([k,l])=>`<a class="${active===k?'active':''}" href="#/${k}">${l}</a>`).join('')}</nav><span class="sa-user-pill"><strong>${esc(currentUser.username)}</strong> · ${esc(currentUser.role)}</span><button class="sa-logout-btn" onclick="SA.logout()">Logout</button></div>
  </div></header>`;
}
SA.toggleNav=()=>$('#navWrap')?.classList.toggle('open');
function loadingShell(active=''){const app=$('#app');if(!app)return;app.innerHTML=topbar(active)+`<main class="page"><div class="container"><div class="sa-skeleton-grid" aria-label="Loading"><div></div><div></div><div></div><div></div></div></div></main>`;}
function shell(html,active=''){ $('#app').innerHTML=topbar(active)+`<main class="page"><div class="container">${html}</div></main>`; window.scrollTo(0,0); }
function printShell(html){ $('#app').innerHTML=`<main class="print-sheet">${html}</main>`; window.scrollTo(0,0); }
function headerBlock(title,sub='',actions=''){return `<div class="sa-card mb-3"><div class="hero"><div class="customer-line"><div><h2>${esc(title)}</h2>${sub?`<p>${esc(sub)}</p>`:''}</div><div class="actions no-print">${actions}</div></div></div></div>`}
function mountChunked(target,items,render,empty,searchInput,searchText){let visible=20,filtered=items;const draw=()=>{target.innerHTML=(filtered.slice(0,visible).map(render).join('')||empty)+(visible<filtered.length?'<div class="load-more-wrap"><button class="sa-btn outline" id="loadMore">Load more</button></div>':'');target.querySelector('#loadMore')?.addEventListener('click',()=>{visible+=20;draw()})};draw();if(searchInput)searchInput.oninput=e=>{const q=e.target.value.toLowerCase().trim();filtered=q?items.filter(x=>searchText(x).includes(q)):items;visible=20;draw()}}

window.addEventListener('hashchange',renderRoute);
let serverRenderTimer=null;
window.addEventListener('sa:store-update',()=>{if(!currentUser)return;clearTimeout(serverRenderTimer);serverRenderTimer=setTimeout(()=>renderRoute(),120)});
window.addEventListener('sa:write-error',event=>toast(`Cloud save failed: ${event.detail?.message||'Please retry.'}`,'danger'));
window.addEventListener('DOMContentLoaded',async()=>{
  if(SAFirebase.hasToken()){
    try{currentUser=await SAFirebase.me();sessionStorage.setItem('sa_user',JSON.stringify(currentUser));loadingShell();await DB.loadAll();await seedDb();setTimeout(()=>SA.syncReminders?.(),0)}
    catch(_e){SAFirebase.logout();currentUser=null}
  }
  if(!location.hash) SA.go(currentUser?'dashboard':'login'); else renderRoute();
});

async function renderRoute(){
  document.getElementById('brandSplash')?.remove();
  const p=routeParts(), page=p[0]||'login';
  if(page!=='login'&&!currentUser){SA.go('login');return}
  const timer=`render.${page}`;console.time(timer);
  try{
    const routes={
      login:renderLogin,home:renderHome,dashboard:renderDashboard,about:renderAbout,bills:renderBills,bill:()=>renderBill(p[1]),edit:()=>renderBillForm(p[1]),
      custom:renderCustomList,'custom-new':renderCustomForm,'custom-edit':()=>renderCustomForm(p[1]),'custom-view':()=>renderCustomView(p[1]),
      reports:renderReports,'payment-report':renderPaymentReport,'material-rent-report':renderMaterialRentReport,'customer-materials':()=>renderCustomerMaterials(p[1]),
      customers:renderCustomers,customer:()=>renderCustomer(p[1]),inventory:renderInventory,slips:renderSlips,'slip-new':()=>renderSlipForm(p[1]||'delivery'),'slip-view':()=>renderSlipView(p[1]),
      challans:renderChallans,'challan-new':renderChallanForm,'challan-view':()=>renderChallanView(p[1]),admin:renderAdmin,'admin-users':renderAdminUsers,'admin-terms':renderAdminTerms,'admin-backup':renderAdminBackup,
      'open-bills':renderOpenBills,materials:renderMaterialTracker,totals:renderTotals,'return-bill':renderReturnBill,
      'print-invoice':()=>renderPrintInvoice(p[1],'invoice'),'print-customer':()=>renderPrintInvoice(p[1],'customer'),'print-next-cycle':()=>renderPrintNextCycle(p[1]),
      'print-custom':()=>renderPrintCustom(p[1]),'print-slip':()=>renderSlipView(p[1],true),'print-challan':()=>renderChallanView(p[1],true),'print-material-rent':()=>renderMaterialRentReport(true),'print-customer-materials':()=>renderCustomerMaterials(p[1],true)
    };
    const fn=routes[page]; if(!fn){shell(`<div class="sa-alert danger">Page not found.</div>`);return} await fn();
  }catch(e){
    console.error(e);
    if(String(e.message).includes('Sign in required')){SAFirebase.logout();currentUser=null;SA.go('login');return}
    shell(`<div class="sa-alert danger"><strong>Connection error:</strong> ${esc(e.message||e)}</div><button class="sa-btn primary" onclick="renderRoute()">Retry</button>`);
  }finally{console.timeEnd(timer)}
}

// =========================================================
// LOGIN / HOME
// =========================================================
async function renderLogin(){
  if(currentUser){SA.go('dashboard');return}
  $('#app').innerHTML=`<div class="login-wrap"><div class="login-card">${brandLogo('login-brand-logo')}<h1>S.A Traders</h1><p>Firebase cloud billing</p>
    <form id="loginForm"><div class="field mb-3"><label class="sa-label">Username</label><input class="sa-input" name="username" value="admin" autocomplete="username" required></div><div class="field mb-3"><label class="sa-label">Password</label><input class="sa-input" name="password" type="password" autocomplete="current-password" required></div><button class="sa-btn gold lg w-100" type="submit">Sign In</button></form>
    <div class="sa-alert info mt-3"><span>Data is stored in Firebase Firestore. App login: admin / shiva.</span></div></div></div>`;
  $('#loginForm').onsubmit=async ev=>{ev.preventDefault();const form=ev.target,btn=form.querySelector('button[type=submit]'),f=formObj(form);setBusy(btn,true,'Connecting…');try{currentUser=await SAFirebase.login(f.username.trim(),f.password);sessionStorage.setItem('sa_user',JSON.stringify(currentUser));loadingShell();await DB.loadAll();await seedDb();setTimeout(()=>SA.syncReminders?.(),0);SA.go('dashboard')}catch(e){toast(e.message||'Login failed','danger')}finally{setBusy(btn,false)}};
}
async function renderHome(){
  if(!requireAuth())return;
  shell(`${headerBlock('Welcome back','S.A Traders · Professional Scaffolding Billing',`<button class="sa-btn gold" onclick="SA.go('edit/new')">+ Create New Bill</button>`)}
  <div class="sa-card"><div class="sa-card-body"><div class="quick-grid">
    <div class="quick-card"><h3>Bills</h3><p>Create & manage cycle-based rental bills</p><div class="d-grid mt-3"><button class="sa-btn gold" onclick="SA.go('edit/new')">+ Create New Bill</button><button class="sa-btn primary" onclick="SA.go('custom-new')">Custom Shop Bill</button><button class="sa-btn outline" onclick="SA.go('dashboard')">Open Dashboard</button></div></div>
    <div class="quick-card"><h3>Slips & Challans</h3><p>Delivery / return proof documents</p><div class="d-grid mt-3"><button class="sa-btn primary" onclick="SA.go('slip-new/delivery')">Delivery Slip</button><button class="sa-btn outline" onclick="SA.go('slip-new/return')">Return Slip</button><button class="sa-btn outline" onclick="SA.go('challan-new')">Challan</button></div></div>
    <div class="quick-card gold-soft"><h3 style="color:#92400e">Billing Rules</h3><ul class="small" style="color:#92400e;line-height:1.9;padding-left:18px"><li>Cycle-based rent (15/20/30 days)</li><li>Transport only in first cycle</li><li>Advance = refundable deposit</li><li>Returns reduce from next cycle</li></ul></div>
  </div></div></div>`, 'home');
}
async function renderAbout(){
  shell(`<section class="brand-profile"><div class="brand-profile-logo">${brandLogo('about-brand-logo')}</div><h1>S.A Traders</h1><p>Scaffolding &amp; Centring Material Rental</p><div class="brand-profile-details"><div><span>Business address</span><strong>${esc(BUSINESS.address)}</strong></div><div><span>Phone</span><strong>${esc(BUSINESS.phone)}</strong></div><div><span>Signed in as</span><strong>${esc(currentUser?.username||'admin')} · ${esc(currentUser?.role||'Administrator')}</strong></div><div><span>App version</span><strong>1.7.2</strong></div></div></section>`,'');
}

// =========================================================
// DASHBOARD + BILL LISTS
// =========================================================
async function allHydratedBills(){
  if(SA.cache.hydratedBills)return SA.cache.hydratedBills;
  const raw=await DB.all('bills'),previous=SA.cache.hydratedBillMap||new Map(),next=new Map();
  SA.cache.hydratedBills=raw.map(b=>{
    const key=String(b.bill_no),fingerprint=JSON.stringify(b),cached=previous.get(key);
    const value=cached?.fingerprint===fingerprint?cached.value:hydrateBill(b);
    next.set(key,{fingerprint,value});return value;
  }).sort((a,b)=>String(b.created_at||b.start_date||'').localeCompare(String(a.created_at||a.start_date||'')));
  SA.cache.hydratedBillMap=next;
  return SA.cache.hydratedBills;
}
async function hydratedBillByNo(no){return (await allHydratedBills()).find(b=>String(b.bill_no)===String(no))||null;}
async function renderDashboard(){
  const bills=await allHydratedBills(); const custom=(await DB.all('customBills')).filter(x=>x.dashboard_visible).map(x=>hydrateCustom(x).bill);
  const all=[...bills,...custom]; const active=all.filter(b=>b.status!=='closed'); const totalDue=sum(active.map(b=>b.total_due)); const totalPaid=sum(active.map(b=>b.total_paid)); const pending=sum(active.map(b=>b.pending));
  shell(`${headerBlock('Dashboard','Active rental bills and collections',`<button class="sa-btn gold" onclick="SA.go('edit/new')">+ New Bill</button><button class="sa-btn outline" onclick="SA.go('customers')">Customers</button><button class="sa-btn outline" onclick="SA.go('reports')">Reports</button>`)}
  <div class="sa-stat-grid mb-3"><div class="sa-stat blue"><div class="sa-stat-label">Active Bills</div><div class="sa-stat-value">${active.length}</div></div><div class="sa-stat gold"><div class="sa-stat-label">Total Due</div><div class="sa-stat-value">${money(totalDue)}</div></div><div class="sa-stat green"><div class="sa-stat-label">Total Paid</div><div class="sa-stat-value">${money(totalPaid)}</div></div><div class="sa-stat red"><div class="sa-stat-label">Total Pending</div><div class="sa-stat-value">${money(pending)}</div></div></div>
  <div class="sa-card"><div class="sa-card-header"><div><h3 class="sa-card-title">Pending Bills</h3><div class="sa-card-subtitle">Open bills sorted by latest activity</div></div><input id="dashSearch" class="sa-input" placeholder="Search bill / name / mobile" style="max-width:280px"></div><div class="sa-card-body" id="dashList"></div></div>
  <button class="fab no-print" onclick="SA.go('edit/new')">+</button>`, 'dashboard');
  mountChunked($('#dashList'),active,b=>dashboardBillCard(b,billIsCustomDashboard(b)),'<div class="empty"><strong>No active bills</strong>Create your first bill to start billing.</div>',$('#dashSearch'),b=>`${b.bill_no} ${b.name} ${b.mobile} ${b.place}`.toLowerCase());
}
function billIsCustomDashboard(b){return b.bill_type==='customshop'||b.status==='custom'||b.calculation_type==='customshop_dashboard'}
function dashboardBillCard(b,isCustom=false){
  const search=`${b.bill_no} ${b.name} ${b.mobile} ${b.place}`.toLowerCase();
  const view=isCustom?`custom-view/${encodeURIComponent(b.bill_no)}`:`bill/${encodeURIComponent(b.bill_no)}`;
  const print=isCustom?`print-custom/${encodeURIComponent(b.bill_no)}`:`print-invoice/${encodeURIComponent(b.bill_no)}`;
  return `<div class="bill-card" data-search="${esc(search)}"><div class="bill-head"><div><div class="bill-no">${esc(b.bill_no)}</div><div class="bill-meta">${esc(b.name||'-')} · ${esc(b.mobile||'-')} · ${esc(b.place||'-')}</div></div><div class="right">${statusBadge(b.status)}<div class="tiny muted mt-1">Cycle #${i(b.current_cycle_index||1)}</div></div></div>
  <div class="summary-strip mt-3"><div class="summary-box"><div class="label">Due</div><div class="value">${money(b.total_due)}</div></div><div class="summary-box green"><div class="label">Paid</div><div class="value">${money(b.total_paid)}</div></div><div class="summary-box red"><div class="label">Pending</div><div class="value">${money(b.pending)}</div></div><div class="summary-box gold"><div class="label">Advance</div><div class="value">${money(b.advance_amount||0)}</div></div></div>
  <div class="actions mt-3"><button class="sa-btn primary sm" onclick="SA.go('${view}')">View</button><button class="sa-btn outline sm" onclick="SA.go('${print}')">Print</button>${b.status!=='closed'?`<button class="sa-btn gold sm" onclick="SA.quickPayment('${esc(b.bill_no)}',${isCustom})">Record Payment</button>`:''}</div></div>`;
}
async function renderBills(){
  const bills=await allHydratedBills(); shell(`${headerBlock('All Bills','Open and closed professional rental bills',`<button class="sa-btn gold" onclick="SA.go('edit/new')">+ New Bill</button>`)}<div class="sa-card"><div class="sa-card-header"><h3 class="sa-card-title">Bills (${bills.length})</h3><input id="billSearch" class="sa-input" placeholder="Search" style="max-width:260px"></div><div class="sa-card-body" id="billList"></div></div>`,'dashboard');mountChunked($('#billList'),bills,b=>dashboardBillCard(b,false),'<div class="empty">No bills found.</div>',$('#billSearch'),b=>`${b.bill_no} ${b.name} ${b.mobile} ${b.place}`.toLowerCase());
}
async function renderOpenBills(){ const bills=(await allHydratedBills()).filter(b=>b.status==='open'); shell(`${headerBlock('Open Bills','Currently active rentals')}<div class="sa-card"><div class="sa-card-body">${bills.map(b=>dashboardBillCard(b,false)).join('')||'<div class="empty">No open bills.</div>'}</div></div>`,'dashboard'); }

// =========================================================
// BILL CREATE / EDIT — mirrors index.html and edit_bill.html
// =========================================================
function billFormHtml(b={},editing=false){
  const v=(k,d='')=>esc(b[k]??d); const r=ratesOf(b); const title=editing?'Edit Bill':'Create New Bill';
  return `${headerBlock(title,editing?`Bill ${b.bill_no}`:'Cycle-based rental calculation',`<button class="sa-btn outline" onclick="SA.go('${editing?'bill/'+encodeURIComponent(b.bill_no):'home'}')">Cancel</button>`)}
  <div class="sa-card"><div class="sa-card-header"><div><h3 class="sa-card-title">${title}</h3><div class="sa-card-subtitle">Same fields and billing rules as the original S.A Traders system</div></div><span class="sa-badge gold">${editing?'EDIT':'NEW'}</span></div><div class="sa-card-body"><form id="billForm">
    <div class="section-title">Bill Information</div><div class="form-grid mb-3">
      <div class="field"><label class="sa-label">Bill No *</label><input class="sa-input" name="bill_no" value="${v('bill_no')}" ${editing?'readonly':''} required placeholder="SA-1001"></div>
      <div class="field"><label class="sa-label">Start Date *</label><input class="sa-input" type="date" name="start_date" value="${v('start_date',today())}" required></div>
      <div class="field"><label class="sa-label">Cycle Days *</label><select class="sa-input" name="cycle_days">${[30,20,15].map(x=>`<option value="${x}" ${i(b.cycle_days||30)===x?'selected':''}>${x} Days</option>`).join('')}</select></div>
      <div class="field"><label class="sa-label">Advance Deposit</label><input class="sa-input" type="number" step="0.01" name="advance_amount" value="${v('advance_amount',0)}"></div>
    </div>
    <div class="section-title">Customer Details</div><div class="form-grid three mb-3"><div class="field"><label class="sa-label">Customer Name</label><input class="sa-input" name="name" value="${v('name')}" placeholder="Full name"></div><div class="field"><label class="sa-label">Mobile</label><input class="sa-input" name="mobile" value="${v('mobile')}" inputmode="tel" placeholder="10-digit mobile"></div><div class="field"><label class="sa-label">Place / Site</label><input class="sa-input" name="place" value="${v('place')}" placeholder="Work location"></div></div>
    ${materialFormSection(b,r)}${woodFormSection(b,r)}${transportFormSection(b)}
    <div class="actions"><button class="sa-btn gold lg" type="submit">${editing?'Save Changes':'Create Bill'}</button><button class="sa-btn outline lg" type="button" onclick="SA.go('dashboard')">Cancel</button></div>
  </form></div></div>`;
}
function materialFormSection(b,r){return `<div class="form-section"><div class="form-section-head"><span>Materials (Qty × Rate)</span><span class="sa-badge cycle">RENT</span></div><div class="form-section-body"><div class="sa-table-wrap"><table class="sa-table"><thead><tr><th>Material</th><th>Qty</th><th>Rate (₹)</th></tr></thead><tbody>${MATERIALS.map(([k,l,qf,rf])=>`<tr><td class="fw-700">${l}</td><td><input class="sa-input" name="${qf}" type="number" min="0" value="${esc(b[qf]??0)}"></td><td><input class="sa-input" name="${rf}" type="number" step="0.01" value="${esc(b[rf]??r[rf])}"></td></tr>`).join('')}</tbody></table></div></div></div>`}
function woodFormSection(b,r){return `<div class="form-section"><div class="form-section-head"><span>Wood (Feet × Pieces)</span><span class="sa-badge gold">Example 8×5+10×2</span></div><div class="form-section-body"><div class="form-grid two">${WOODS.map(([k,l,rf])=>`<div class="field"><label class="sa-label">${l}</label><textarea class="sa-input mono" rows="2" name="${k}" placeholder="8×5+10×2">${esc(b[k]||'')}</textarea></div><div class="field"><label class="sa-label">${l} Rate (per feet)</label><input class="sa-input" name="${rf}" type="number" step="0.01" value="${esc(b[rf]??r[rf])}"></div>`).join('')}</div></div></div>`}
function transportFormSection(b){return `<div class="form-section"><div class="form-section-head"><span>Transport & Charges</span><span class="sa-badge open">FIRST CYCLE ONLY</span></div><div class="form-section-body"><div class="form-grid"><div class="field"><label class="sa-label">Up Trips</label><input class="sa-input" name="transport_up_trips" type="number" min="0" value="${esc(b.transport_up_trips??0)}"></div><div class="field"><label class="sa-label">Up Charge / Trip</label><input class="sa-input" name="transport_up_charge" type="number" step="0.01" value="${esc(b.transport_up_charge??0)}"></div><div class="field"><label class="sa-label">Down Trips</label><input class="sa-input" name="transport_down_trips" type="number" min="0" value="${esc(b.transport_down_trips??0)}"></div><div class="field"><label class="sa-label">Down Charge / Trip</label><input class="sa-input" name="transport_down_charge" type="number" step="0.01" value="${esc(b.transport_down_charge??0)}"></div><div class="field"><label class="sa-label">Loading Charge</label><input class="sa-input" name="loading_charge" type="number" step="0.01" value="${esc(b.loading_charge??0)}"></div><div class="field"><label class="sa-label">Unloading Charge</label><input class="sa-input" name="unloading_charge" type="number" step="0.01" value="${esc(b.unloading_charge??0)}"></div></div></div></div>`}
function billFromForm(f,old={}){ const b={...old,...f}; for(const [_k,_l,qf,rf] of MATERIALS){b[qf]=nonneg(f[qf]);b[rf]=n(f[rf],DEFAULT_RATES[rf])} for(const [k,_l,rf] of WOODS){b[k]=(f[k]||'').trim();b[rf]=n(f[rf],DEFAULT_RATES[rf])} for(const k of ['transport_up_trips','transport_down_trips'])b[k]=nonneg(f[k]); for(const k of ['transport_up_charge','transport_down_charge','loading_charge','unloading_charge','advance_amount'])b[k]=n(f[k]); b.cycle_days=Math.max(i(f.cycle_days,30),1); b.bill_no=(f.bill_no||'').trim();b.name=(f.name||'').trim();b.mobile=(f.mobile||'').trim();b.place=(f.place||'').trim();b.start_date=f.start_date||today(); return b; }
async function renderBillForm(id){
  const editing=id&&id!=='new'; let old={}; if(editing){old=await DB.get('bills',id); if(!old){toast('Bill not found','danger');SA.go('dashboard');return}} else {old.bill_no=await nextAvailableBillNo();}
  shell(billFormHtml(old,editing),'home'); const form=$('#billForm'); form.onsubmit=async ev=>{ev.preventDefault();const btn=form.querySelector('button[type=submit]');setBusy(btn,true);try{const f=formObj(form); const b=billFromForm(f,old); if(!b.bill_no)throw new Error('Bill number is required'); if(!editing&&await DB.get('bills',b.bill_no)){const suggestion=await nextAvailableBillNo();form.elements.bill_no.value=suggestion;toast(`Bill number ${b.bill_no} already exists. Next available number is ${suggestion}.`,'danger');form.elements.bill_no.focus();return} if(!editing){b.payments=[];b.payment_audit=[];b.return_history=[];b.additional_history=[];b.status='open';b.created_date=today();b.created_at=nowIso();b.created_by=currentUser.username} else {b.updated_at=nowIso();b.updated_by=currentUser.username}
    const writes=[{store:'bills',document:b}];if(b.mobile){const cust=await DB.get('customers',b.mobile);writes.push({store:'customers',document:{mobile:b.mobile,customer_id:cust?.customer_id||`CUST${String(await nextSeq('customer_seq')).padStart(5,'0')}`,name:b.name||cust?.name||'',place:b.place||cust?.place||'',created_at:cust?.created_at||nowIso()}})}
    await DB.batch(writes);SA.syncReminders?.();toast(editing?'Bill updated':'Bill created');SA.go('bill/'+encodeURIComponent(b.bill_no));
  }catch(e){toast(e.message,'danger')}finally{setBusy(btn,false)}};
}

// =========================================================
// BILL DETAIL / PAYMENTS / RETURNS / ADDITIONAL MATERIALS
// =========================================================
function woodMaterialMatrix(b){
  const groups=WOODS.map(([k,label,rf])=>{
    const entries=Object.entries(b.balance_wood?.[k]||{}).map(([feet,pieces])=>({feet:n(feet),pieces:i(pieces)})).filter(x=>x.feet>0&&x.pieces>0).sort((a,b)=>a.feet-b.feet);
    const totalFeet=round2(entries.reduce((sum,x)=>sum+(x.feet*x.pieces),0));
    const rate=n(b.rates?.[rf],DEFAULT_RATES[rf]);
    return {label,entries,totalFeet,amount:round2(totalFeet*rate)};
  });
  const rows=Math.max(1,...groups.map(g=>g.entries.length));
  const body=Array.from({length:rows},(_,idx)=>`<tr>${groups.map(g=>{const x=g.entries[idx];return `<td>${x?`${x.feet}×${x.pieces}`:'&nbsp;'}</td>`}).join('')}</tr>`).join('');
  return `<div class="wood-matrix-wrap"><table class="wood-matrix"><thead><tr>${groups.map(g=>`<th>${esc(g.label).toUpperCase()}</th>`).join('')}</tr></thead><tbody>${body}</tbody><tfoot><tr>${groups.map(g=>`<td><strong>${g.totalFeet} ft</strong><span>${money(g.amount)}</span></td>`).join('')}</tr></tfoot></table></div>`;
}

async function renderBill(id){
  const b=await hydratedBillByNo(id); if(!b){shell(`<div class="sa-alert danger">Bill not found.</div>`,'dashboard');return}
  const cycleRows=(b.cycles||[]).map(c=>`<tr><td>#${c.index}</td><td>${c.start_date}</td><td>${c.end_date}</td><td>${money(c.rent)}</td><td>${money(c.transport)}</td><td class="fw-800">${money(c.total)}</td></tr>`).join('');
  const payRows=(b.payments||[]).slice().reverse().map(p=>`<tr><td>${esc(p.payment_date||p.date||'')}</td><td>${money(p.amount)}</td><td>${esc(p.note||'-')}</td><td>${esc(p.created_by||'-')}</td><td>${isAdmin()?`<button class="sa-btn danger sm no-print" onclick="SA.deletePayment('${esc(b.bill_no)}','${esc(p.payment_id)}')">Delete</button>`:''}</td></tr>`).join('');
  const returnRows=(b.return_history||[]).slice().reverse().map(r=>historyRow(r,'return',b.bill_no)).join('');
  const addRows=(b.additional_history||[]).slice().reverse().map(a=>historyRow(a,'additional',b.bill_no)).join('');
  const matBalance=MATERIALS.map(([k,l,_qf,rf])=>`<tr><td>${l}</td><td class="right fw-800">${nonneg(b.balance_qty[k])}</td><td class="right">${money(n(b.rates?.[rf],DEFAULT_RATES[rf]))}</td></tr>`).join('');
  const activeLabel=b.status==='closed'?'Closed':'Active';
  const cycleNo=Math.max(i(b.current_cycle_index,1),1);
  const liveSnap=b.start_date?snapshotForCycle(b,cycleNo):{qty:b.base_qty||{},wood:b.base_wood_maps||{}};
  const currentRent=calcRent(liveSnap.qty,liveSnap.wood,b.rates||ratesOf(b));
  const mobile=String(b.mobile||'').trim();
  const viewActions=`<button class="sa-btn outline" onclick="SA.back()">← Back</button><button class="sa-btn gold" onclick="window.scrollTo({top:0,behavior:'smooth'})">Pro View</button>${mobile?`<button class="sa-btn outline" onclick="SA.go('customer/${encodeURIComponent(mobile)}')">All Bills (${esc(mobile)})</button><button class="sa-btn outline" onclick="SA.go('customer-materials/${encodeURIComponent(mobile)}')">View All Material</button>`:''}<button class="sa-btn primary" onclick="SA.go('print-invoice/${encodeURIComponent(b.bill_no)}')">Print Invoice</button><button class="sa-btn gold" onclick="SA.go('print-customer/${encodeURIComponent(b.bill_no)}')">Customer Bill</button><button class="sa-btn primary" onclick="SA.go('print-next-cycle/${encodeURIComponent(b.bill_no)}')">Next Cycle Bill</button><button class="sa-btn outline" onclick="SA.go('edit/${encodeURIComponent(b.bill_no)}')">Edit</button>`;
  shell(`<div class="bill-view-head mb-3"><div class="bill-view-title"><div><div class="bill-number-row"><h1>${esc(b.bill_no)}</h1><span class="sa-badge ${b.status==='closed'?'closed':'open'}">${activeLabel}</span></div><p>${esc(b.name||'-')} · ${esc(b.mobile||'-')} · ${esc(b.place||'-')}</p></div></div><div class="view-action-grid no-print">${viewActions}</div></div>
  <div class="sa-card mb-3 customer-detail-card"><div class="sa-card-body"><div class="detail-eyebrow">CUSTOMER DETAILS</div><div class="customer-detail-lines"><div>Name: <strong>${esc(b.name||'-')}</strong></div><div>Mobile: <strong>${esc(b.mobile||'-')}</strong></div><div>Place: <strong>${esc(b.place||'-')}</strong></div></div>${mobile?`<button class="sa-btn outline mt-3 no-print" onclick="SA.go('customer/${encodeURIComponent(mobile)}')">View Customer History</button>`:''}<div class="customer-meta-grid"><div><span>START DATE</span><strong>${esc(b.start_date||'-')}</strong></div><div><span>CYCLE</span><strong>${i(b.cycle_days)} days</strong></div></div></div></div>
  <div class="sa-card mb-3"><div class="sa-card-header"><div><h3 class="sa-card-title">Smart Summary</h3><div class="sa-card-subtitle">${statusBadge(b.status)} · Current cycle #${cycleNo}</div></div></div><div class="sa-card-body"><div class="summary-strip"><div class="summary-box blue"><div class="label">Total Due</div><div class="value">${money(b.total_due)}</div></div><div class="summary-box green"><div class="label">Total Paid</div><div class="value">${money(b.total_paid)}</div></div><div class="summary-box red"><div class="label">Pending</div><div class="value">${money(b.pending)}</div></div><div class="summary-box gold"><div class="label">Advance Deposit</div><div class="value">${money(b.advance_locked)}</div></div></div><div class="actions mt-3 no-print">${b.status!=='closed'?`<button class="sa-btn gold" onclick="SA.quickPayment('${esc(b.bill_no)}',false)">Record Payment</button><button class="sa-btn outline" onclick="SA.openReturn('${esc(b.bill_no)}')">Return Material</button><button class="sa-btn outline" onclick="SA.openAdditional('${esc(b.bill_no)}')">Additional Material</button>`:''}${isAdmin()&&b.status!=='closed'?`<button class="sa-btn success" onclick="SA.closeBill('${esc(b.bill_no)}')">Close Bill</button>`:''}${isAdmin()?`<button class="sa-btn danger" onclick="SA.deleteBill('${esc(b.bill_no)}')">Delete</button>`:''}</div></div></div>
  <div class="sa-card mb-3"><div class="sa-card-header"><h3 class="sa-card-title">Current Materials</h3></div><div class="sa-card-body p-0"><div class="sa-table-wrap"><table class="sa-table"><thead><tr><th>Material</th><th class="right">Qty</th><th class="right">Rate</th></tr></thead><tbody>${matBalance}</tbody></table></div></div></div>
  <div class="sa-card mb-3"><div class="sa-card-body"><div class="detail-eyebrow mb-3">WOOD MATERIALS</div>${woodMaterialMatrix(b)}</div></div>
  <div class="rent-total-card mb-3"><span>RENT TOTAL</span><strong>${money(currentRent.rent_total)}</strong></div>
  <div class="sa-card mb-3"><div class="sa-card-header"><h3 class="sa-card-title">First Cycle Charges</h3></div><div class="sa-card-body"><div class="info-pair"><span class="k">Transport Up</span><span class="v">${money(b.transport_breakdown.up)}</span></div><div class="info-pair"><span class="k">Transport Down</span><span class="v">${money(b.transport_breakdown.down)}</span></div><div class="info-pair"><span class="k">Loading</span><span class="v">${money(b.transport_breakdown.loading)}</span></div><div class="info-pair"><span class="k">Unloading</span><span class="v">${money(b.transport_breakdown.unloading)}</span></div></div></div>
  <div class="sa-card mb-3"><div class="sa-card-header"><div><h3 class="sa-card-title">Rental Cycles</h3><div class="sa-card-subtitle">Returns and additions take effect from the next cycle</div></div></div><div class="sa-card-body p-0"><div class="sa-table-wrap"><table class="sa-table"><thead><tr><th>Cycle</th><th>From</th><th>To</th><th>Rent</th><th>Transport</th><th>Total</th></tr></thead><tbody>${cycleRows||'<tr><td colspan="6">No cycle data</td></tr>'}</tbody></table></div></div></div>
  <div class="sa-card mb-3"><div class="sa-card-header"><h3 class="sa-card-title">Payment History</h3></div><div class="sa-card-body p-0"><div class="sa-table-wrap"><table class="sa-table"><thead><tr><th>Date</th><th>Amount</th><th>Note</th><th>User</th><th></th></tr></thead><tbody>${payRows||'<tr><td colspan="5" class="muted">No payments recorded.</td></tr>'}</tbody></table></div></div></div>
  <div class="sa-card mb-3"><div class="sa-card-header"><h3 class="sa-card-title">Return History</h3></div><div class="sa-card-body">${returnRows||'<div class="empty">No return entries.</div>'}</div></div>
  <div class="sa-card"><div class="sa-card-header"><h3 class="sa-card-title">Additional Material History</h3></div><div class="sa-card-body">${addRows||'<div class="empty">No additional material entries.</div>'}</div></div>`, 'dashboard');
}
function historyRow(x,type,billNo){ const items=MATERIALS.filter(([k])=>nonneg(x.items?.[k])>0).map(([k,l])=>`${l}: ${nonneg(x.items[k])}`); const woods=WOODS.filter(([k])=>Object.keys(x.wood?.[k]||{}).length).map(([k,l])=>`${l}: ${mapToText(x.wood[k])}`); const del=isAdmin()?`<button class="sa-btn danger sm" onclick="SA.deleteHistory('${esc(billNo)}','${type}','${esc(x.rid||x.aid)}')">Delete</button>`:''; return `<div class="bill-card"><div class="bill-head"><div><div class="fw-800">${esc(x.date)} · Effective Cycle #${i(x.effective_from_cycle)}</div><div class="small muted">${esc(x.note||'')}</div></div>${del}</div><div class="pill-row mt-2">${[...items,...woods].map(z=>`<span class="sa-badge ${type==='return'?'pending':'open'}">${esc(z)}</span>`).join('')||'<span class="muted">No quantities</span>'}</div></div>`; }

// In-app payment sheet. Uses the existing payment records and billing calculations.
SA.quickPayment=async(billNo,isCustom=false)=>{
  if(!currentUser)return;
  try {
    const store=isCustom?'customBills':'bills';
    const raw=await DB.get(store,billNo);
    if(!raw){toast('Bill not found','danger');return}
    const bill=isCustom?hydrateCustom(raw).bill:hydrateBill(raw);
    const remaining=Math.max(0,round2(bill.pending));
    const paymentCycles=isCustom?[]:(bill.cycles||[]);
    const originFocus=document.activeElement;
    modal('Record payment',`<form id="paymentForm" novalidate>
      <div class="payment-person">Bill #${esc(billNo)} · ${esc(bill.name||'Customer')}</div>
      ${paymentCycles.length?`<div class="payment-cycle-field"><label class="sa-label" for="paymentCycle">Payment for rental cycle</label><select class="sa-input" id="paymentCycle" name="cycle">${paymentCycles.map(c=>`<option value="${c.index}" ${c.index===bill.current_cycle_index?'selected':''}>Cycle #${c.index} · ${c.start_date} to ${c.end_date}</option>`).join('')}</select><p class="payment-cycle-hint">Choose the cycle this payment belongs to. Split payments across cycles as separate entries.</p></div>`:''}
      <label class="sa-label" for="paymentAmount">Payment amount</label>
      <div class="payment-amount"><span aria-hidden="true">₹</span><input id="paymentAmount" name="amount" inputmode="decimal" type="text" autocomplete="off" placeholder="0.00" aria-describedby="paymentRemaining paymentError" required></div>
      <p id="paymentRemaining" class="payment-remaining">${money(remaining)} remaining on bill${paymentCycles.length?' · Full / Half uses the selected cycle, capped at bill balance':''}</p>
      <div class="payment-shortcuts"><button class="sa-btn outline" type="button" data-fraction="1" ${remaining<=0?'disabled':''}>Full</button><button class="sa-btn outline" type="button" data-fraction="0.5" ${remaining<=0?'disabled':''}>Half</button></div>
      <fieldset class="payment-method"><legend class="sa-label">Payment method</legend><div class="payment-segments">${['Cash','UPI','Bank'].map((method,idx)=>`<label><input type="radio" name="method" value="${method}" ${idx===0?'checked':''}><span>${method}</span></label>`).join('')}</div></fieldset>
      <div class="payment-fields"><div><label class="sa-label" for="paymentDate">Date</label><input class="sa-input" id="paymentDate" name="date" type="date" value="${ymd(new Date())}" required></div><div><label class="sa-label" for="paymentNote">Note · optional</label><input class="sa-input" id="paymentNote" name="note" maxlength="500" placeholder="Add a payment note"></div></div>
      <div id="paymentError" class="payment-error" role="alert" hidden></div>
      <label id="paymentDuplicate" class="payment-duplicate" hidden><input type="checkbox" name="duplicate">I checked: record another payment with this date and amount.</label>
      <div class="payment-submit"><button class="sa-btn gold lg w-100" type="submit">Save payment</button></div>
    </form>`);
    const m=$('#modal'),form=$('#paymentForm'),amount=$('#paymentAmount'),error=$('#paymentError');
    m.classList.add('payment-modal');m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-label','Record payment');
    $('#app').inert=true;
    SA.paymentOriginFocus=originFocus;
    SA.paymentPreviousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    SA.paymentSaving=false;
    const fail=message=>{error.textContent=message;error.hidden=false;};
    form.querySelectorAll('[data-fraction]').forEach(button=>button.onclick=()=>{
      const selected=paymentCycles.find(c=>c.index===Number(form.elements.cycle?.value));
      const allocated=selected?sum((bill.payments||[]).filter(p=>p.cycle_index===selected.index&&p.cycle_start_date===selected.start_date&&p.cycle_end_date===selected.end_date).map(p=>p.amount)):0;
      const shortcutAmount=selected?Math.min(remaining,Math.max(0,round2(selected.total-allocated))):remaining;
      amount.value=round2(shortcutAmount*Number(button.dataset.fraction)).toFixed(2);
      amount.dispatchEvent(new Event('input',{bubbles:true}));
    });
    const resetDuplicate=()=>{$('#paymentDuplicate').hidden=true;form.elements.duplicate.checked=false;error.hidden=true;};
    amount.oninput=resetDuplicate;form.elements.date.oninput=resetDuplicate;
    form.onsubmit=async ev=>{
      ev.preventDefault();if(SA.paymentSaving)return;
      const text=amount.value.trim(),val=Number(text),date=form.elements.date.value;
      if(!/^(?:\d+|\d*\.\d{1,2})$/.test(text)||!Number.isFinite(val)||val<=0||!Number.isSafeInteger(Math.round(val*100))){fail('Enter an amount above ₹0, with up to 2 decimal places.');amount.focus();return}
      const parsed=parseDate(date);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!parsed||ymd(parsed)!==date){fail('Choose a valid payment date.');form.elements.date.focus();return}
      const method=form.elements.method.value;
      if(!['Cash','UPI','Bank'].includes(method)){fail('Choose a payment method.');return}
      const cycleIndex=isCustom?null:Number(form.elements.cycle?.value);
      const selectedCycle=paymentCycles.find(c=>c.index===cycleIndex);
      if(!isCustom&&!selectedCycle){fail('Choose a valid rental cycle.');return}
      const note=form.elements.note.value.trim(),allowDuplicate=form.elements.duplicate.checked;
      const submit=form.querySelector('[type=submit]');SA.paymentSaving=true;setBusy(submit,true);
      try {
        // Re-read from Firestore before saving to catch duplicates and cycle changes.
        const b=await DB.get(store,billNo);
        if(!b)throw new Error('This bill no longer exists.');
        b.payments=b.payments||[];
        const duplicate=b.payments.some(p=>round2(p.amount)===round2(val)&&(p.payment_date||p.date)===date);
        if(duplicate&&!allowDuplicate){const problem=new Error('A payment with this date and amount already exists. Check below to record it again.');problem.duplicate=true;throw problem}
        const freshCycle=isCustom?null:hydrateBill(b).cycles.find(c=>c.index===cycleIndex);
        if(!isCustom&&(!freshCycle||freshCycle.start_date!==selectedCycle.start_date||freshCycle.end_date!==selectedCycle.end_date))throw new Error('The rental cycle changed. Reopen payment and choose its cycle again.');
        b.payments.push({payment_id:uid('pay'),amount:round2(val),payment_date:date,note,method,...(freshCycle?{cycle_index:freshCycle.index,cycle_start_date:freshCycle.start_date,cycle_end_date:freshCycle.end_date}:{}),created_by:currentUser.username,created_at:nowIso()});
        await DB.put(store,b);if(store==='bills')SA.syncReminders?.();
        SA.paymentSaving=false;SA.closeModal();toast('Payment recorded');await renderRoute();
      } catch(e) {
        fail(e.message||'Payment could not be saved. Please retry.');
        if(e.duplicate)$('#paymentDuplicate').hidden=false;
      } finally {SA.paymentSaving=false;setBusy(submit,false);}
    };
    // Keep focus inside the sheet; do not force the keyboard open before the user taps.
    m.querySelector('.modal-close').focus({preventScroll:true});
  } catch(e){toast('Could not open payment: '+(e.message||'Please retry'),'danger');}
};

SA.deletePayment=async(billNo,pid)=>{ if(!roleGuard())return; const reason=promptValue('Reason for deleting this payment'); if(!reason)return; const b=await DB.get('bills',billNo); if(!b)return; const idx=(b.payments||[]).findIndex(p=>p.payment_id===pid); if(idx<0)return; const removed=b.payments.splice(idx,1)[0]; b.payment_audit=b.payment_audit||[]; b.payment_audit.push({action:'deleted',payment_id:pid,amount:removed.amount,payment_date:removed.payment_date,note:removed.note,deleted_by:currentUser.username,deleted_at:nowIso(),reason}); await DB.put('bills',b);toast('Payment deleted','warning');renderRoute(); };
SA.confirmBillAction=async(billNo,action)=>{
  if(!roleGuard())return;
  const deleting=action==='delete',verb=deleting?'Delete':'Close';
  const warning=deleting?'This permanently removes the bill and cannot be undone.':'Rental cycles will stop on today\'s date.';
  modal(`${verb} bill #${billNo}`,`<form id="billActionForm" class="bill-action-form"><p class="bill-action-warning">${esc(warning)}</p><label class="sa-label" for="billActionPassword">Admin password</label><input class="sa-input" id="billActionPassword" name="password" type="password" autocomplete="current-password" required><label class="bill-action-confirm"><input type="checkbox" name="confirmed" required><span>I confirm that I want to ${verb.toLowerCase()} bill #${esc(billNo)}.</span></label><div id="billActionError" class="payment-error" role="alert" hidden></div><div class="bill-action-buttons"><button class="sa-btn outline lg" type="button" onclick="SA.closeModal()">Cancel</button><button class="sa-btn ${deleting?'danger':'success'} lg" type="submit">${verb} Bill</button></div></form>`);
  const form=$('#billActionForm'),error=$('#billActionError');
  form.onsubmit=async ev=>{
    ev.preventDefault();error.hidden=true;
    if(!form.elements.confirmed.checked){error.textContent='Confirm the action before continuing.';error.hidden=false;return}
    const submit=form.querySelector('[type=submit]');setBusy(submit,true,deleting?'Deleting…':'Closing…');
    try{
      await SAFirebase.login('admin',form.elements.password.value);
      const bill=await DB.get('bills',billNo);
      if(!bill)throw new Error('Bill not found. It may already have been deleted.');
      if(deleting){await DB.del('bills',billNo)}else{bill.status='closed';bill.closed_at=today();bill.closed_by=currentUser.username;bill.closed_at_iso=nowIso();await DB.put('bills',bill)}
      SA.closeModal();SA.syncReminders?.();toast(deleting?'Bill deleted':'Bill closed',deleting?'warning':'success');
      if(deleting)SA.go('dashboard');else await renderRoute();
    }catch(e){error.textContent=e.message==='Incorrect username or password'?'Incorrect admin password.':(e.message||`${verb} failed. Please retry.`);error.hidden=false}
    finally{setBusy(submit,false)}
  };
  setTimeout(()=>$('#billActionPassword')?.focus(),50);
};
SA.closeBill=billNo=>SA.confirmBillAction(billNo,'close');
SA.deleteBill=billNo=>SA.confirmBillAction(billNo,'delete');
SA.deleteHistory=async(billNo,type,id)=>{if(!roleGuard()||!confirmAction('Delete this history entry?'))return;const b=await DB.get('bills',billNo);if(!b)return;const key=type==='return'?'return_history':'additional_history',idKey=type==='return'?'rid':'aid';b[key]=(b[key]||[]).filter(x=>x[idKey]!==id);await DB.put('bills',b);toast('Entry deleted','warning');renderRoute();};

function modal(title,body){ const m=$('#modal'); m.innerHTML=`<div class="modal-card"><div class="modal-head"><div class="fw-800">${esc(title)}</div><button class="modal-close" onclick="SA.closeModal()">×</button></div><div class="modal-body">${body}</div></div>`;m.classList.add('show');}
SA.closeModal=()=>{
  if(SA.paymentSaving)return;
  const m=$('#modal');
  if(m.classList.contains('payment-modal')){
    $('#app').inert=false;document.body.style.overflow=SA.paymentPreviousOverflow||'';
    if(SA.paymentOriginFocus?.isConnected)SA.paymentOriginFocus.focus({preventScroll:true});
    SA.paymentOriginFocus=null;
  }
  m.classList.remove('show','payment-modal');m.innerHTML='';
  m.removeAttribute('role');m.removeAttribute('aria-modal');m.removeAttribute('aria-label');
};
document.addEventListener('keydown',ev=>{
  const m=$('#modal');if(!m?.classList.contains('payment-modal'))return;
  if(ev.key==='Escape'){ev.preventDefault();SA.closeModal();}
  if(ev.key==='Tab'){
    const fields=[...m.querySelectorAll('button,input,select,textarea,[tabindex]')].filter(x=>!x.disabled&&x.tabIndex>=0&&x.getClientRects().length);
    const first=fields[0],last=fields[fields.length-1];
    if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last?.focus();}
    else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first?.focus();}
  }
});
function historyForm(type,b){ const suff=type==='return'?'return':'add'; return `<form id="historyForm"><div class="form-grid two"><div><label class="sa-label">Date</label><input class="sa-input" name="date" type="date" value="${today()}"></div><div><label class="sa-label">Note</label><input class="sa-input" name="note" placeholder="Optional note"></div></div><div class="section-title mt-3">Materials</div><div class="form-grid three">${MATERIALS.map(([k,l])=>`<div><label class="sa-label">${l}</label><input class="sa-input" type="number" min="0" name="${k}" value="0"></div>`).join('')}</div><div class="section-title mt-3">Wood</div><div class="form-grid two">${WOODS.map(([k,l])=>`<div><label class="sa-label">${l}</label><input class="sa-input mono" name="${k}_${suff}" placeholder="8×5+10×2"></div>`).join('')}</div><button class="sa-btn ${type==='return'?'gold':'primary'} lg w-100 mt-3" type="submit">Save ${type==='return'?'Return':'Additional Material'}</button></form>`; }
SA.openReturn=async billNo=>{const raw=await DB.get('bills',billNo);if(!raw)return;modal('Return Material',historyForm('return',raw));$('#historyForm').onsubmit=ev=>saveHistory(ev,billNo,'return')};
SA.openAdditional=async billNo=>{const raw=await DB.get('bills',billNo);if(!raw)return;modal('Additional Material',historyForm('additional',raw));$('#historyForm').onsubmit=ev=>saveHistory(ev,billNo,'additional')};
async function saveHistory(ev,billNo,type){ev.preventDefault();const f=formObj(ev.target),raw=await DB.get('bills',billNo),h=hydrateBill(raw);if(h.status==='closed'){toast('Bill is closed','danger');return}const d=parseDate(f.date)||parseDate(today()),start=parseDate(h.start_date);if(!start){toast('Start date missing','danger');return}const items={};for(const [k] of MATERIALS)items[k]=nonneg(f[k]);const wood={};for(const [k] of WOODS)wood[k]=parseComboSizes(f[`${k}_${type==='return'?'return':'add'}`]);const any=Object.values(items).some(x=>x>0)||Object.values(wood).some(x=>Object.keys(x).length);if(!any){toast('Enter at least one quantity','danger');return}if(type==='return'){for(const k of Object.keys(items))if(items[k]>nonneg(h.balance_qty[k])){toast(`Invalid return: ${k} exceeds balance`,'danger');return}for(const k of Object.keys(wood))for(const [feet,pcs] of Object.entries(wood[k]))if(i(pcs)>i(h.balance_wood[k]?.[feet])){toast(`Invalid return: ${k} ${feet}ft exceeds balance`,'danger');return}}
const entry={date:f.date||today(),note:(f.note||'').trim(),effective_from_cycle:effectiveCycle(start,Math.max(i(h.cycle_days,30),1),d),items,wood,created_by:currentUser.username,created_at:nowIso()};if(type==='return'){entry.rid=uid('ret');raw.return_history=raw.return_history||[];raw.return_history.push(entry)}else{entry.aid=uid('add');raw.additional_history=raw.additional_history||[];raw.additional_history.push(entry)}await DB.put('bills',raw);SA.closeModal();toast(`${type==='return'?'Return':'Additional material'} saved. Applies from Cycle #${entry.effective_from_cycle}`);renderRoute();}

// =========================================================
// CUSTOM SHOP BILL — one-time custom calculation
// =========================================================
async function renderCustomList(){
  const rows=(await DB.all('customBills')).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''))).map(x=>hydrateCustom(x));
  shell(`${headerBlock('Custom Shop Bills','One-time shop bills using original custom calculation',`<button class="sa-btn gold" onclick="SA.go('custom-new')">+ New Custom Bill</button>`)}<div class="sa-card"><div class="sa-card-header"><h3 class="sa-card-title">Custom Bills (${rows.length})</h3><input id="customSearch" class="sa-input" placeholder="Search bill / customer" style="max-width:280px"></div><div class="sa-card-body" id="customList">${rows.map(({bill:b})=>`<div class="bill-card" data-search="${esc(`${b.bill_no} ${b.name} ${b.mobile} ${b.place}`.toLowerCase())}"><div class="bill-head"><div><div class="bill-no">${esc(b.bill_no)}</div><div class="bill-meta">${esc(b.name||'-')} · ${esc(b.mobile||'-')} · ${esc(b.place||'-')}</div></div><span class="sa-badge gold">CUSTOM</span></div><div class="summary-strip mt-3"><div class="summary-box blue"><div class="label">Grand Total</div><div class="value">${money(b.total_due)}</div></div><div class="summary-box green"><div class="label">Paid</div><div class="value">${money(b.total_paid)}</div></div><div class="summary-box red"><div class="label">Pending</div><div class="value">${money(b.pending)}</div></div><div class="summary-box gold"><div class="label">Advance</div><div class="value">${money(b.advance_amount)}</div></div></div><div class="actions mt-3"><button class="sa-btn primary sm" onclick="SA.go('custom-view/${encodeURIComponent(b.bill_no)}')">View</button><button class="sa-btn outline sm" onclick="SA.go('custom-edit/${encodeURIComponent(b.bill_no)}')">Edit</button><button class="sa-btn outline sm" onclick="SA.go('print-custom/${encodeURIComponent(b.bill_no)}')">Print</button></div></div>`).join('')||'<div class="empty">No custom shop bills.</div>'}</div></div>`,'custom');
  $('#customSearch').oninput=ev=>{const q=ev.target.value.toLowerCase();$$('#customList .bill-card').forEach(x=>x.style.display=x.dataset.search.includes(q)?'':'none')};
}
function customFormHtml(b={},editing=false){const r=ratesOf(b);return `${headerBlock(editing?'Edit Custom Shop Bill':'Create Custom Shop Bill','Custom total = material + wood + transport + loading + unloading + advance',`<button class="sa-btn outline" onclick="SA.go('custom')">Cancel</button>`)}<div class="sa-card"><div class="sa-card-body"><form id="customForm"><div class="section-title">Bill Information</div><div class="form-grid mb-3"><div><label class="sa-label">Bill No *</label><input class="sa-input" name="bill_no" value="${esc(b.bill_no||'')}" ${editing?'readonly':''} required></div><div><label class="sa-label">Date</label><input class="sa-input" type="date" name="start_date" value="${esc(b.start_date||today())}"></div><div><label class="sa-label">Cycle Days</label><select class="sa-input" name="cycle_days">${[30,20,15].map(x=>`<option value="${x}" ${i(b.cycle_days||30)===x?'selected':''}>${x} Days</option>`).join('')}</select></div><div><label class="sa-label">Advance</label><input class="sa-input" value="Auto = Materials + Wood" readonly></div></div><div class="section-title">Customer</div><div class="form-grid three mb-3"><div><label class="sa-label">Name</label><input class="sa-input" name="name" value="${esc(b.name||'')}"></div><div><label class="sa-label">Mobile</label><input class="sa-input" name="mobile" value="${esc(b.mobile||'')}"></div><div><label class="sa-label">Place</label><input class="sa-input" name="place" value="${esc(b.place||'')}"></div></div>${materialFormSection(b,r)}${woodFormSection(b,r)}${transportFormSection(b)}<div class="form-section"><div class="form-section-head">Print Rules & Terms</div><div class="form-section-body"><div class="form-grid two"><div><label class="sa-label">Rules</label><textarea class="sa-input" rows="6" name="print_rules">${esc(b.print_rules||DEFAULT_CUSTOM_RULES)}</textarea></div><div><label class="sa-label">Terms & Conditions</label><textarea class="sa-input" rows="6" name="terms_conditions">${esc(b.terms_conditions||DEFAULT_CUSTOM_TERMS)}</textarea></div></div></div></div><button class="sa-btn gold lg" type="submit">${editing?'Save Changes':'Create Custom Bill'}</button></form></div></div>`}
async function renderCustomForm(id){const editing=!!id;let old={};if(editing){old=await DB.get('customBills',id);if(!old){toast('Custom bill not found','danger');SA.go('custom');return}}shell(customFormHtml(old,editing),'custom');$('#customForm').onsubmit=async ev=>{ev.preventDefault();const f=formObj(ev.target),b=billFromForm({...f,advance_amount:0},old);if(!b.bill_no){toast('Bill number required','danger');return}if(!editing&&await DB.get('customBills',b.bill_no)){toast('Duplicate custom bill number','danger');return}b.print_rules=f.print_rules||DEFAULT_CUSTOM_RULES;b.terms_conditions=f.terms_conditions||DEFAULT_CUSTOM_TERMS;b.payments=old.payments||[];b.return_history=old.return_history||[];b.additional_history=old.additional_history||[];b.status=old.status||'custom';b.dashboard_visible=old.dashboard_visible||false;b.converted_to_professional=old.converted_to_professional||false;b.created_at=old.created_at||nowIso();b.created_by=old.created_by||currentUser.username;const h=hydrateCustom(b);b.advance_amount=h.calc.advance_amount;b.grand_total=h.calc.grand_total;await DB.put('customBills',b);toast(editing?'Custom bill updated':'Custom bill created');SA.go('custom-view/'+encodeURIComponent(b.bill_no));};}
async function renderCustomView(id){const raw=await DB.get('customBills',id);if(!raw){toast('Custom bill not found','danger');SA.go('custom');return}const {bill:b,breakdown:br,transport:tr,calc}=hydrateCustom(raw);shell(`${headerBlock(`Custom Bill ${b.bill_no}`,`${b.name||'-'} · ${b.mobile||'-'} · ${b.place||'-'}`,`<button class="sa-btn outline" onclick="SA.go('custom-edit/${encodeURIComponent(b.bill_no)}')">Edit</button><button class="sa-btn primary" onclick="SA.go('print-custom/${encodeURIComponent(b.bill_no)}')">Print</button>`)}<div class="sa-card mb-3"><div class="sa-card-body"><div class="summary-strip"><div class="summary-box blue"><div class="label">Material + Wood</div><div class="value">${money(calc.material_rent_total)}</div></div><div class="summary-box gold"><div class="label">Advance</div><div class="value">${money(calc.advance_amount)}</div></div><div class="summary-box green"><div class="label">Paid</div><div class="value">${money(b.total_paid)}</div></div><div class="summary-box red"><div class="label">Pending</div><div class="value">${money(b.pending)}</div></div></div><div class="hr"></div><div class="summary-strip"><div class="summary-box"><div class="label">Transport</div><div class="value">${money(calc.transport_vehicle_total)}</div></div><div class="summary-box"><div class="label">Loading</div><div class="value">${money(calc.loading)}</div></div><div class="summary-box"><div class="label">Unloading</div><div class="value">${money(calc.unloading)}</div></div><div class="summary-box gold"><div class="label">Grand Total</div><div class="value">${money(calc.grand_total)}</div></div></div><div class="actions mt-3"><button class="sa-btn gold" onclick="SA.quickPayment('${esc(b.bill_no)}',true)">Record Payment</button>${!b.converted_to_professional?`<button class="sa-btn primary" onclick="SA.convertCustom('${esc(b.bill_no)}')">Convert to Professional Bill</button>`:'<span class="sa-badge open">Converted</span>'}${isAdmin()?`<button class="sa-btn danger" onclick="SA.deleteCustom('${esc(b.bill_no)}')">Delete</button>`:''}</div></div></div><div class="sa-card"><div class="sa-card-header"><h3 class="sa-card-title">Payment History</h3></div><div class="sa-card-body p-0"><table class="sa-table"><thead><tr><th>Date</th><th>Amount</th><th>Note</th></tr></thead><tbody>${(b.payments||[]).map(p=>`<tr><td>${esc(p.payment_date)}</td><td>${money(p.amount)}</td><td>${esc(p.note||'-')}</td></tr>`).join('')||'<tr><td colspan="3">No payments.</td></tr>'}</tbody></table></div></div>`,'custom');}
SA.convertCustom=async billNo=>{if(!confirmAction('Convert this Custom Shop Bill to a professional dashboard bill?'))return;const c=await DB.get('customBills',billNo);if(!c)return;if(await DB.get('bills',billNo)){toast('A professional bill with this number already exists','danger');return}const p={...c,calculation_type:'customshop_professional',status:'open',converted_from_custom:true,converted_at:nowIso(),converted_by:currentUser.username};c.converted_to_professional=true;c.dashboard_visible=false;c.converted_at=nowIso();await DB.batch([{store:'bills',document:p},{store:'customBills',document:c}]);SA.syncReminders?.();toast('Converted to professional bill');SA.go('bill/'+encodeURIComponent(billNo));};
SA.deleteCustom=async billNo=>{if(!roleGuard()||!confirmAction(`Delete custom bill ${billNo}?`))return;await DB.del('customBills',billNo);toast('Custom bill deleted','warning');SA.go('custom');};

// =========================================================
// CUSTOMERS
// =========================================================
async function renderCustomers(){const cust=await DB.all('customers');const bills=await allHydratedBills();const rows=cust.map(c=>{const bs=bills.filter(b=>b.mobile===c.mobile),pending=sum(bs.filter(b=>b.status==='open').map(b=>b.pending));return {...c,count:bs.length,pending}}).sort((a,b)=>a.name.localeCompare(b.name));shell(`${headerBlock('Customers','Customer profiles and bill history')}<div class="sa-card"><div class="sa-card-header"><h3 class="sa-card-title">Customers (${rows.length})</h3><input id="custSearch" class="sa-input" placeholder="Search name / mobile" style="max-width:280px"></div><div class="sa-card-body p-0"><div class="sa-table-wrap"><table class="sa-table"><thead><tr><th>Name</th><th>Mobile</th><th>Place</th><th>Bills</th><th>Pending</th><th></th></tr></thead><tbody id="customerRows"></tbody></table></div><div id="customerMore"></div></div></div>`,'dashboard');let visible=20,filtered=rows;const draw=()=>{$('#customerRows').innerHTML=filtered.slice(0,visible).map(c=>`<tr><td class="fw-800">${esc(c.name||'-')}</td><td>${esc(c.mobile)}</td><td>${esc(c.place||'-')}</td><td>${c.count}</td><td>${money(c.pending)}</td><td><button class="sa-btn primary sm" onclick="SA.go('customer/${encodeURIComponent(c.mobile)}')">Open</button></td></tr>`).join('')||'<tr><td colspan="6">No customers yet.</td></tr>';$('#customerMore').innerHTML=visible<filtered.length?'<div class="load-more-wrap"><button class="sa-btn outline">Load more</button></div>':'';$('#customerMore button')?.addEventListener('click',()=>{visible+=20;draw()})};draw();$('#custSearch').oninput=ev=>{const q=ev.target.value.toLowerCase();filtered=rows.filter(c=>`${c.name} ${c.mobile}`.toLowerCase().includes(q));visible=20;draw()};}
async function renderCustomer(mobile){const c=await DB.get('customers',mobile);const bills=(await allHydratedBills()).filter(b=>b.mobile===mobile);if(!c&&!bills.length){toast('Customer not found','danger');SA.go('customers');return}const pending=sum(bills.filter(b=>b.status==='open').map(b=>b.pending));let last=null;for(const b of bills)for(const p of b.payments||[])if(!last||String(p.payment_date)>String(last.payment_date))last={...p,bill_no:b.bill_no};shell(`${headerBlock(c?.name||bills[0]?.name||'Customer',`${mobile} · ${c?.place||bills[0]?.place||'-'}`,`<button class="sa-btn outline" onclick="SA.go('customer-materials/${encodeURIComponent(mobile)}')">Material Summary</button>`)}<div class="sa-stat-grid mb-3"><div class="sa-stat blue"><div class="sa-stat-label">Bills</div><div class="sa-stat-value">${bills.length}</div></div><div class="sa-stat red"><div class="sa-stat-label">Pending</div><div class="sa-stat-value">${money(pending)}</div></div><div class="sa-stat green"><div class="sa-stat-label">Last Payment</div><div class="sa-stat-value">${last?money(last.amount):money(0)}</div></div><div class="sa-stat gold"><div class="sa-stat-label">Last Payment Date</div><div class="sa-stat-value" style="font-size:16px">${esc(last?.payment_date||'-')}</div></div></div><div class="sa-card"><div class="sa-card-header"><h3 class="sa-card-title">Bill History</h3></div><div class="sa-card-body">${bills.map(b=>dashboardBillCard(b,false)).join('')||'<div class="empty">No bills.</div>'}</div></div>`,'dashboard');}


// =========================================================
// REPORTS
// =========================================================
async function renderReports(){
  shell(`${headerBlock('Reports','Billing, payments, materials and customer summaries')}<div class="quick-grid"><div class="quick-card"><h3>Payment Report</h3><p>All payment entries with date and customer filters.</p><button class="sa-btn primary mt-3" onclick="SA.go('payment-report')">Open Report</button></div><div class="quick-card"><h3>Active Material Rent Report</h3><p>Current materials held by customers and available rent.</p><button class="sa-btn primary mt-3" onclick="SA.go('material-rent-report')">Open Report</button></div><div class="quick-card"><h3>Customer Material Summary</h3><p>Select a customer to view bill-wise material holdings.</p><button class="sa-btn primary mt-3" onclick="SA.go('customers')">Choose Customer</button></div><div class="quick-card"><h3>All Bills</h3><p>Open and closed bill history.</p><button class="sa-btn outline mt-3" onclick="SA.go('bills')">View Bills</button></div><div class="quick-card"><h3>Open Bills</h3><p>Only active rental bills.</p><button class="sa-btn outline mt-3" onclick="SA.go('open-bills')">Open Bills</button></div><div class="quick-card"><h3>Material Totals</h3><p>Jackey / Sheet / Span and complete material listing.</p><button class="sa-btn outline mt-3" onclick="SA.go('totals')">View Totals</button></div></div>`,'reports');
}
async function paymentRows(){
  const out=[]; for(const b of await DB.all('bills')) for(const p of b.payments||[]) out.push({bill_no:b.bill_no,name:b.name,mobile:b.mobile,place:b.place,type:'Rental',...p});
  for(const b of await DB.all('customBills')) for(const p of b.payments||[]) out.push({bill_no:b.bill_no,name:b.name,mobile:b.mobile,place:b.place,type:'Custom',...p});
  return out.sort((a,b)=>String(b.payment_date||'').localeCompare(String(a.payment_date||'')));
}
async function renderPaymentReport(){const rows=await paymentRows(); const total=sum(rows.map(r=>r.amount));shell(`${headerBlock('Payment Report',`${rows.length} payment entries`, `<button class="sa-btn outline" onclick="SA.exportPaymentCsv()">Export CSV</button>`)}<div class="sa-stat-grid mb-3"><div class="sa-stat green"><div class="sa-stat-label">Total Received</div><div class="sa-stat-value">${money(total)}</div></div><div class="sa-stat blue"><div class="sa-stat-label">Entries</div><div class="sa-stat-value">${rows.length}</div></div></div><div class="sa-card"><div class="sa-card-header"><div class="form-grid three" style="width:100%"><input id="payQ" class="sa-input" placeholder="Bill / name / mobile"><input id="payFrom" type="date" class="sa-input"><input id="payTo" type="date" class="sa-input"></div></div><div class="sa-card-body p-0"><div class="sa-table-wrap"><table class="sa-table"><thead><tr><th>Date</th><th>Bill</th><th>Type</th><th>Customer</th><th>Mobile</th><th>Amount</th><th>Note</th></tr></thead><tbody id="payRows">${rows.map(r=>`<tr data-q="${esc(`${r.bill_no} ${r.name} ${r.mobile}`.toLowerCase())}" data-date="${esc(r.payment_date||'')}"><td>${esc(r.payment_date||'')}</td><td class="fw-800">${esc(r.bill_no)}</td><td><span class="sa-badge ${r.type==='Custom'?'gold':'cycle'}">${r.type}</span></td><td>${esc(r.name||'-')}</td><td>${esc(r.mobile||'-')}</td><td class="fw-800">${money(r.amount)}</td><td>${esc(r.note||'-')}</td></tr>`).join('')||'<tr><td colspan="7">No payment entries.</td></tr>'}</tbody></table></div></div></div>`,'reports');const filter=()=>{const q=$('#payQ').value.toLowerCase().trim(),f=$('#payFrom').value,t=$('#payTo').value;$$('#payRows tr[data-q]').forEach(r=>{const d=r.dataset.date;r.style.display=r.dataset.q.includes(q)&&(!f||d>=f)&&(!t||d<=t)?'':'none'})};['payQ','payFrom','payTo'].forEach(id=>$('#'+id).oninput=filter);}
SA.exportPaymentCsv=async()=>{const rows=await paymentRows();const q=s=>`"${String(s??'').replace(/"/g,'""')}"`;const csv=['Date,Bill,Type,Customer,Mobile,Place,Amount,Note',...rows.map(r=>[r.payment_date,r.bill_no,r.type,r.name,r.mobile,r.place,r.amount,r.note].map(q).join(','))].join('\n');exportText(`payment-report-${today()}.csv`,'text/csv',csv)};

async function activeMaterialReportData(){
  const bills=(await allHydratedBills()).filter(b=>b.status==='open'); const rows=[]; const matTotals=Object.fromEntries(MATERIALS.map(x=>[x[0],0])); const woodMaps=Object.fromEntries(WOODS.map(x=>[x[0],{}])); let matRent=0,woodRent=0;
  for(const b of bills){const br=calcRent(b.balance_qty,b.balance_wood,b.rates);for(const k of Object.keys(matTotals))matTotals[k]+=nonneg(b.balance_qty[k]);for(const k of Object.keys(woodMaps))woodMaps[k]=addMaps(woodMaps[k],b.balance_wood[k]);matRent+=br.materials_total;woodRent+=br.wood_total;rows.push({bill:b,br});}
  return {bills,rows,matTotals,woodMaps,matRent:round2(matRent),woodRent:round2(woodRent),totalRent:round2(matRent+woodRent)};
}
async function renderMaterialRentReport(print=false){const d=await activeMaterialReportData();const content=`${print?printHeader('Active Material Rent Report'):headerBlock('Active Material Rent Report','Current outstanding material and current-cycle rental value',`<button class="sa-btn outline" onclick="SA.go('print-material-rent')">Print</button>`)}<div class="sa-stat-grid mb-3"><div class="sa-stat blue"><div class="sa-stat-label">Active Bills</div><div class="sa-stat-value">${d.bills.length}</div></div><div class="sa-stat gold"><div class="sa-stat-label">Material Rent</div><div class="sa-stat-value">${money(d.matRent)}</div></div><div class="sa-stat green"><div class="sa-stat-label">Wood Rent</div><div class="sa-stat-value">${money(d.woodRent)}</div></div><div class="sa-stat red"><div class="sa-stat-label">Available Rent</div><div class="sa-stat-value">${money(d.totalRent)}</div></div></div><div class="sa-card mb-3"><div class="sa-card-header"><h3 class="sa-card-title">Final Material Total</h3></div><div class="sa-card-body p-0"><table class="sa-table"><thead><tr>${MATERIALS.map(x=>`<th>${x[1]}</th>`).join('')}<th>Total</th></tr></thead><tbody><tr>${MATERIALS.map(([k])=>`<td class="fw-800">${d.matTotals[k]}</td>`).join('')}<td class="fw-900">${Object.values(d.matTotals).reduce((a,b)=>a+b,0)}</td></tr></tbody></table></div></div><div class="sa-card mb-3"><div class="sa-card-header"><h3 class="sa-card-title">Final Wood Material Total</h3></div><div class="sa-card-body p-0"><table class="sa-table"><thead><tr>${WOODS.map(x=>`<th>${x[1]}</th>`).join('')}</tr></thead><tbody><tr>${WOODS.map(([k])=>`<td class="mono fw-800">${esc(mapToText(d.woodMaps[k]))}</td>`).join('')}</tr></tbody></table></div></div><div class="sa-card"><div class="sa-card-header"><h3 class="sa-card-title">Material Details</h3></div><div class="sa-card-body">${d.rows.map(({bill:b,br})=>`<div class="bill-card"><div class="bill-head"><div><div class="bill-no">${esc(b.bill_no)} · ${esc(b.name||'-')}</div><div class="bill-meta">${esc(b.mobile||'-')} · ${esc(b.place||'-')}</div></div><div class="money-big">${money(br.rent_total)}</div></div><div class="pill-row mt-2">${MATERIALS.filter(([k])=>b.balance_qty[k]>0).map(([k,l])=>`<span class="sa-badge cycle">${l}: ${b.balance_qty[k]}</span>`).join('')}${WOODS.filter(([k])=>Object.keys(b.balance_wood[k]||{}).length).map(([k,l])=>`<span class="sa-badge gold">${l}: ${esc(mapToText(b.balance_wood[k]))}</span>`).join('')}</div></div>`).join('')||'<div class="empty">No active material.</div>'}</div></div>${print?printActions('Active Material Rent Report'):''}`;if(print)printShell(content);else shell(content,'reports');}
async function renderCustomerMaterials(mobile,print=false){const bills=(await allHydratedBills()).filter(b=>b.mobile===mobile);if(!bills.length){toast('No bills for this customer','danger');return}const mat=Object.fromEntries(MATERIALS.map(x=>[x[0],0]));const wood=Object.fromEntries(WOODS.map(x=>[x[0],{}]));for(const b of bills){for(const k of Object.keys(mat))mat[k]+=nonneg(b.balance_qty[k]);for(const k of Object.keys(wood))wood[k]=addMaps(wood[k],b.balance_wood[k])}const first=bills[0];const content=`${print?printHeader('Customer Materials Report'):headerBlock('Customer Material Summary',`${first.name||'-'} · ${mobile} · ${first.place||'-'}`,`<button class="sa-btn outline" onclick="SA.go('print-customer-materials/${encodeURIComponent(mobile)}')">Print</button>`)}<div class="sa-card mb-3"><div class="sa-card-header"><h3 class="sa-card-title">Present Materials</h3></div><div class="sa-card-body"><div class="summary-strip">${MATERIALS.slice(0,4).map(([k,l])=>`<div class="summary-box"><div class="label">${l}</div><div class="value">${mat[k]}</div></div>`).join('')}</div><div class="sa-table-wrap mt-3"><table class="sa-table"><thead><tr>${MATERIALS.map(x=>`<th>${x[1]}</th>`).join('')}</tr></thead><tbody><tr>${MATERIALS.map(([k])=>`<td class="fw-800">${mat[k]}</td>`).join('')}</tr></tbody></table></div></div></div><div class="sa-card mb-3"><div class="sa-card-header"><h3 class="sa-card-title">Wood Material Details</h3></div><div class="sa-card-body p-0"><table class="sa-table"><thead><tr>${WOODS.map(x=>`<th>${x[1]}</th>`).join('')}</tr></thead><tbody><tr>${WOODS.map(([k])=>`<td class="mono fw-800">${esc(mapToText(wood[k]))}</td>`).join('')}</tr></tbody></table></div></div><div class="sa-card"><div class="sa-card-header"><h3 class="sa-card-title">Bill Wise</h3></div><div class="sa-card-body">${bills.map(b=>dashboardBillCard(b,false)).join('')}</div></div>${print?printActions('Customer Materials'):''}`;if(print)printShell(content);else shell(content,'reports');}


// =========================================================
// INVENTORY
// =========================================================
async function aggregateOutstanding(){const q=Object.fromEntries(MATERIALS.map(x=>[x[0],0]));const w=Object.fromEntries(WOODS.map(x=>[x[0],{}]));for(const b of (await allHydratedBills()).filter(x=>x.status!=='closed')){const o=physicalOutstanding(b);for(const k of Object.keys(q))q[k]+=nonneg(o.qty[k]);for(const k of Object.keys(w))w[k]=addMaps(w[k],o.wood[k])}return{q,w};}
async function renderInventory(){const inv=Object.fromEntries((await DB.all('inventory')).map(x=>[x.item,x]));const out=await aggregateOutstanding();shell(`${headerBlock('Inventory','Master stock, rented quantity and available stock')}<form id="invForm"><div class="sa-card mb-3"><div class="sa-card-header"><h3 class="sa-card-title">Material Stock</h3></div><div class="sa-card-body p-0"><table class="sa-table"><thead><tr><th>Material</th><th>Total Stock</th><th>Rented</th><th>Available</th></tr></thead><tbody>${MATERIALS.map(([k,l])=>{const stock=nonneg(inv[k]?.stock_qty),rented=nonneg(out.q[k]);return`<tr><td class="fw-800">${l}</td><td><input class="sa-input" type="number" name="stock_${k}" min="0" value="${stock}"></td><td>${rented}</td><td class="fw-900 ${stock-rented<0?'text-red':'text-green'}">${stock-rented}</td></tr>`}).join('')}</tbody></table></div></div><div class="sa-card mb-3"><div class="sa-card-header"><h3 class="sa-card-title">Wood Stock</h3></div><div class="sa-card-body p-0"><table class="sa-table"><thead><tr><th>Wood</th><th>Total Stock (Feet×Pieces)</th><th>Rented</th><th>Available</th></tr></thead><tbody>${WOODS.map(([k,l])=>{const sm=inv[k]?.stock_map||{},rm=out.w[k]||{},am=subtractMaps(sm,rm);return`<tr><td class="fw-800">${l}</td><td><input class="sa-input mono" name="stock_${k}" value="${esc(mapToText(sm)==='0'?'':mapToText(sm))}" placeholder="8×20+10×10"></td><td class="mono">${esc(mapToText(rm))}</td><td class="mono fw-800">${esc(mapToText(am))}</td></tr>`}).join('')}</tbody></table></div></div><button class="sa-btn gold lg" type="submit">Save Inventory</button></form>`,'inventory');$('#invForm').onsubmit=async ev=>{ev.preventDefault();const f=formObj(ev.target);for(const [k] of MATERIALS)await DB.put('inventory',{item:k,stock_qty:nonneg(f[`stock_${k}`])});for(const [k] of WOODS)await DB.put('inventory',{item:k,stock_map:parseComboSizes(f[`stock_${k}`])});toast('Inventory updated');renderInventory();};}

// =========================================================
// DELIVERY / RETURN SLIPS
// =========================================================
async function renderSlips(){const slips=(await DB.all('slips')).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));shell(`${headerBlock('Delivery / Return Slips','Proof slips per trip',`<button class="sa-btn gold" onclick="SA.go('slip-new/delivery')">+ Delivery Slip</button><button class="sa-btn outline" onclick="SA.go('slip-new/return')">+ Return Slip</button><button class="sa-btn outline" onclick="SA.go('challans')">Challans</button>`)}<div class="sa-card"><div class="sa-card-header"><h3 class="sa-card-title">Slips (${slips.length})</h3><input id="slipSearch" class="sa-input" placeholder="Search" style="max-width:280px"></div><div class="sa-card-body p-0"><table class="sa-table"><thead><tr><th>No</th><th>Type</th><th>Date</th><th>Customer</th><th>Mobile</th><th>Trip</th><th></th></tr></thead><tbody>${slips.map(s=>`<tr data-search="${esc(`${s.slip_no} ${s.customer_name} ${s.mobile}`.toLowerCase())}"><td class="fw-800">${esc(s.slip_no)}</td><td><span class="sa-badge ${s.type==='RETURN'?'pending':'open'}">${esc(s.type)}</span></td><td>${esc(s.date)}</td><td>${esc(s.customer_name||'-')}</td><td>${esc(s.mobile||'-')}</td><td>${i(s.trip_no,1)}</td><td><button class="sa-btn primary sm" onclick="SA.go('slip-view/${encodeURIComponent(s.slip_no)}')">View</button></td></tr>`).join('')||'<tr><td colspan="7">No slips.</td></tr>'}</tbody></table></div></div>`,'slips');$('#slipSearch').oninput=e=>{const q=e.target.value.toLowerCase();$$('tbody tr[data-search]').forEach(x=>x.style.display=x.dataset.search.includes(q)?'':'none')};}
async function nextSlipNo(type){const ret=String(type).toUpperCase()==='RETURN';return `${ret?'SART':'SADL'}-${String(await nextSeq(ret?'return_slip_seq':'delivery_slip_seq')).padStart(5,'0')}`;}
function slipFormHtml(type){type=String(type).toUpperCase()==='RETURN'?'RETURN':'DELIVERY';return `${headerBlock(`${type==='RETURN'?'Return':'Delivery'} Slip`,'Proof document per trip')}<div class="sa-card"><div class="sa-card-body"><form id="slipForm"><div class="form-grid"><div><label class="sa-label">Date</label><input class="sa-input" type="date" name="date" value="${today()}"></div><div><label class="sa-label">Trip No</label><input class="sa-input" type="number" name="trip_no" value="1" min="1"></div><div><label class="sa-label">Vehicle No</label><input class="sa-input" name="vehicle_no"></div><div><label class="sa-label">Driver Name</label><input class="sa-input" name="driver_name"></div></div><div class="section-title mt-3">Customer</div><div class="form-grid three"><div><label class="sa-label">Customer Name</label><input class="sa-input" name="customer_name"></div><div><label class="sa-label">Mobile</label><input class="sa-input" name="mobile"></div><div><label class="sa-label">Place</label><input class="sa-input" name="place"></div></div><div class="section-title mt-3">Materials</div><div class="form-grid three">${MATERIALS.map(([k,l])=>`<div><label class="sa-label">${l}</label><input class="sa-input" type="number" min="0" name="${k}_qty" value="0"></div>`).join('')}</div><div class="section-title mt-3">Wood</div><div class="form-grid two">${WOODS.map(([k,l])=>`<div><label class="sa-label">${l}</label><input class="sa-input mono" name="${k}" placeholder="8×5+10×2"></div>`).join('')}</div><div class="mt-3"><label class="sa-label">Note</label><textarea class="sa-input" name="note" rows="3"></textarea></div><button class="sa-btn gold lg mt-3" type="submit">Save ${type} Slip</button></form></div></div>`}
async function renderSlipForm(type){type=String(type||'delivery').toUpperCase();shell(slipFormHtml(type),'slips');$('#slipForm').onsubmit=async ev=>{ev.preventDefault();const f=formObj(ev.target),s={slip_no:await nextSlipNo(type),type:type==='RETURN'?'RETURN':'DELIVERY',date:f.date||today(),customer_name:(f.customer_name||'').trim(),mobile:(f.mobile||'').trim(),place:(f.place||'').trim(),trip_no:Math.max(i(f.trip_no,1),1),vehicle_no:(f.vehicle_no||'').trim(),driver_name:(f.driver_name||'').trim(),note:(f.note||'').trim(),items:{},wood:{},created_at:nowIso(),created_by:currentUser.username};for(const [k] of MATERIALS)s.items[k]=nonneg(f[`${k}_qty`]);for(const [k] of WOODS)s.wood[k]=(f[k]||'').trim();await DB.put('slips',s);toast('Slip saved');SA.go('slip-view/'+encodeURIComponent(s.slip_no));};}
async function renderSlipView(no,print=false){const s=await DB.get('slips',no);if(!s){toast('Slip not found','danger');return}const content=`${print?printHeader(`${s.type} Slip ${s.slip_no}`):headerBlock(`${s.type} Slip ${s.slip_no}`,`${s.customer_name||'-'} · ${s.mobile||'-'}`,`<button class="sa-btn outline" onclick="SA.go('print-slip/${encodeURIComponent(s.slip_no)}')">Print</button>`)}<div class="sa-card mb-3"><div class="sa-card-body"><div class="form-grid three"><div class="info-pair"><span class="k">Date</span><span class="v">${esc(s.date)}</span></div><div class="info-pair"><span class="k">Trip</span><span class="v">${i(s.trip_no)}</span></div><div class="info-pair"><span class="k">Vehicle</span><span class="v">${esc(s.vehicle_no||'-')}</span></div><div class="info-pair"><span class="k">Driver</span><span class="v">${esc(s.driver_name||'-')}</span></div><div class="info-pair"><span class="k">Place</span><span class="v">${esc(s.place||'-')}</span></div><div class="info-pair"><span class="k">Note</span><span class="v">${esc(s.note||'-')}</span></div></div></div></div><div class="sa-card"><div class="sa-card-header"><h3 class="sa-card-title">Material Details</h3></div><div class="sa-card-body p-0"><table class="sa-table"><thead><tr><th>Material</th><th>Qty / Detail</th></tr></thead><tbody>${MATERIALS.map(([k,l])=>`<tr><td>${l}</td><td class="fw-800">${nonneg(s.items?.[k])}</td></tr>`).join('')}${WOODS.map(([k,l])=>`<tr><td>${l}</td><td class="fw-800 mono">${esc(s.wood?.[k]||'0')}</td></tr>`).join('')}</tbody></table></div></div>${print?printActions(`${s.type} Slip ${s.slip_no}`):''}`;if(print)printShell(content);else shell(content,'slips');}

// =========================================================
// CHALLANS
// =========================================================
async function renderChallans(){const rows=(await DB.all('challans')).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));shell(`${headerBlock('Challans','Delivery / return material challans',`<button class="sa-btn gold" onclick="SA.go('challan-new')">+ New Challan</button>`)}<div class="sa-card"><div class="sa-card-body p-0"><table class="sa-table"><thead><tr><th>No</th><th>Date</th><th>Type</th><th>Note</th><th></th></tr></thead><tbody>${rows.map(c=>`<tr><td class="fw-800">${esc(c.challan_no)}</td><td>${esc(c.date)}</td><td>${esc(c.type)}</td><td>${esc(c.note||'-')}</td><td><button class="sa-btn primary sm" onclick="SA.go('challan-view/${encodeURIComponent(c.challan_no)}')">View</button></td></tr>`).join('')||'<tr><td colspan="5">No challans.</td></tr>'}</tbody></table></div></div>`,'slips');}
async function renderChallanForm(){shell(`${headerBlock('New Challan','Material challan using original fields')}<div class="sa-card"><div class="sa-card-body"><form id="challanForm"><div class="form-grid three"><div><label class="sa-label">Type</label><select class="sa-input" name="type"><option>DELIVERY</option><option>RETURN</option></select></div><div><label class="sa-label">Date</label><input class="sa-input" type="date" name="date" value="${today()}"></div><div><label class="sa-label">Note</label><input class="sa-input" name="note"></div></div><div class="section-title mt-3">Materials</div><div class="form-grid three">${MATERIALS.map(([k,l])=>`<div><label class="sa-label">${l}</label><input class="sa-input" type="number" name="${k}" value="0" min="0"></div>`).join('')}</div><div class="section-title mt-3">Wood</div><div class="form-grid two">${WOODS.map(([k,l])=>`<div><label class="sa-label">${l}</label><input class="sa-input mono" name="${k}" placeholder="8×5+10×2"></div>`).join('')}</div><button class="sa-btn gold lg mt-3" type="submit">Save Challan</button></form></div></div>`,'slips');$('#challanForm').onsubmit=async ev=>{ev.preventDefault();const f=formObj(ev.target),seq=await nextSeq('challan_seq'),c={challan_no:`SACH-${String(seq).padStart(5,'0')}`,type:f.type,date:f.date||today(),note:(f.note||'').trim(),items:{},wood:{},created_at:nowIso(),created_by:currentUser.username};for(const [k] of MATERIALS)c.items[k]=nonneg(f[k]);for(const [k] of WOODS)c.wood[k]=(f[k]||'').trim();await DB.put('challans',c);toast('Challan saved');SA.go('challan-view/'+encodeURIComponent(c.challan_no));};}
async function renderChallanView(no,print=false){const c=await DB.get('challans',no);if(!c){toast('Challan not found','danger');return}const content=`${print?printHeader(`${c.type} Challan ${c.challan_no}`):headerBlock(`${c.type} Challan ${c.challan_no}`,c.date,`<button class="sa-btn outline" onclick="SA.go('print-challan/${encodeURIComponent(c.challan_no)}')">Print</button>`)}<div class="sa-card"><div class="sa-card-body p-0"><table class="sa-table"><thead><tr><th>Material</th><th>Qty / Detail</th></tr></thead><tbody>${MATERIALS.map(([k,l])=>`<tr><td>${l}</td><td>${nonneg(c.items?.[k])}</td></tr>`).join('')}${WOODS.map(([k,l])=>`<tr><td>${l}</td><td class="mono">${esc(c.wood?.[k]||'0')}</td></tr>`).join('')}</tbody></table><div class="sa-card-body"><b>Note:</b> ${esc(c.note||'-')}</div></div></div>${print?printActions(`Challan ${c.challan_no}`):''}`;if(print)printShell(content);else shell(content,'slips');}


// =========================================================
// ADMIN / USERS / TERMS / BACKUP
// =========================================================
async function renderAdmin(){if(!roleGuard())return;shell(`${headerBlock('Administration','Firebase data, terms, backups and maintenance')}<div class="quick-grid"><div class="quick-card"><h3>App Login</h3><p>View the current app-lock configuration.</p><button class="sa-btn primary mt-3" onclick="SA.go('admin-users')">Login Settings</button></div><div class="quick-card"><h3>Invoice Terms</h3><p>Edit the terms printed on invoices.</p><button class="sa-btn primary mt-3" onclick="SA.go('admin-terms')">Edit Terms</button></div><div class="quick-card"><h3>Backup & Restore</h3><p>Export Firestore records or import an older APK backup.</p><button class="sa-btn gold mt-3" onclick="SA.go('admin-backup')">Backup</button></div><div class="quick-card"><h3>Inventory</h3><p>Maintain master stock and available quantity.</p><button class="sa-btn outline mt-3" onclick="SA.go('inventory')">Inventory</button></div><div class="quick-card"><h3>Material Tracker</h3><p>Compare issued, returned and currently held materials.</p><button class="sa-btn outline mt-3" onclick="SA.go('materials')">Open Tracker</button></div><div class="quick-card"><h3>Cloud Status</h3><p>Connected to Firebase project sa-traders-billing.</p><button class="sa-btn outline mt-3" onclick="SA.refreshData()">Refresh</button></div></div>`,'admin');}
SA.refreshData=async()=>{loadingShell('admin');await DB.loadAll(true);await renderRoute();toast('Firebase data refreshed')};
async function renderAdminUsers(){if(!roleGuard())return;shell(`${headerBlock('App Login','Firebase Authentication is not enabled')}<div class="sa-alert info">This build uses the existing on-device admin app lock. Business records are stored in Firebase Firestore.</div>`,'admin');}
async function renderAdminTerms(){if(!roleGuard())return;const terms=await setting('terms_invoice',DEFAULT_TERMS),rules=await setting('custom_rules',DEFAULT_CUSTOM_RULES),ct=await setting('custom_terms',DEFAULT_CUSTOM_TERMS);shell(`${headerBlock('Terms & Conditions','Printed invoice and custom bill terms')}<div class="sa-card"><div class="sa-card-body"><form id="termsForm"><div class="mb-3"><label class="sa-label">Invoice Terms</label><textarea class="sa-input" name="terms" rows="8">${esc(terms)}</textarea></div><div class="form-grid two"><div><label class="sa-label">Custom Bill Rules</label><textarea class="sa-input" name="rules" rows="8">${esc(rules)}</textarea></div><div><label class="sa-label">Custom Bill Terms</label><textarea class="sa-input" name="custom_terms" rows="8">${esc(ct)}</textarea></div></div><button class="sa-btn gold lg mt-3" type="submit">Save Terms</button></form></div></div>`,'admin');$('#termsForm').onsubmit=async ev=>{ev.preventDefault();const f=formObj(ev.target);await setSetting('terms_invoice',f.terms);await setSetting('custom_rules',f.rules);await setSetting('custom_terms',f.custom_terms);toast('Terms saved');};}
async function fullBackup(){const data={schema:'sa-traders-firebase-v1',exported_at:nowIso(),business:BUSINESS,data:{}};for(const s of STORES)data.data[s]=await DB.all(s);return data;}
async function renderAdminBackup(){if(!roleGuard())return;const counts={};for(const s of STORES)counts[s]=await DB.count(s);shell(`${headerBlock('Backup & Restore','Export Firebase data or import an older APK backup')}<div class="sa-alert info">Business data is stored in Firebase Firestore. JSON export gives you an additional portable backup.</div><div class="sa-card mb-3"><div class="sa-card-header"><h3 class="sa-card-title">Firestore Data</h3></div><div class="sa-card-body"><div class="summary-strip"><div class="summary-box"><div class="label">Bills</div><div class="value">${counts.bills}</div></div><div class="summary-box"><div class="label">Customers</div><div class="value">${counts.customers}</div></div><div class="summary-box"><div class="label">Custom Bills</div><div class="value">${counts.customBills}</div></div><div class="summary-box"><div class="label">Slips</div><div class="value">${counts.slips}</div></div></div></div></div><div class="quick-grid"><div class="quick-card"><h3>Download Backup</h3><p>Exports all Firestore bills, customers, payments, inventory, slips and settings as JSON.</p><div class="actions mt-3"><button class="sa-btn gold" onclick="SA.exportBackup()">Download JSON</button><button class="sa-btn outline" onclick="SA.shareBackup()">Share Backup</button></div></div><div class="quick-card"><h3>Import Existing Data</h3><p>Choose a backup from an older APK and upload its records to Firebase.</p><button class="sa-btn primary mt-3" onclick="SA.importBackup()">Choose Backup</button></div><div class="quick-card"><h3>Reset Firebase Data</h3><p>Permanently clears bills, customers, slips and custom bills from Firestore.</p><button class="sa-btn danger mt-3" onclick="SA.resetData()">Reset Data</button></div></div>`,'admin');}
SA.exportBackup=async()=>{const data=await fullBackup();exportText(`sa-traders-backup-${today()}.json`,'application/json',JSON.stringify(data,null,2));};
SA.shareBackup=async()=>{const data=await fullBackup(),text=JSON.stringify(data,null,2);if(window.Android?.shareText)Android.shareText(`S.A Traders Backup ${today()}`,'application/json',text);else exportText(`sa-traders-backup-${today()}.json`,'application/json',text);};
SA.importBackup=()=>{if(window.Android?.importBackup){Android.importBackup()}else{const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';inp.onchange=async()=>{try{const file=inp.files?.[0];if(!file)return;await restoreBackupText(await file.text())}catch(e){toast('Backup read failed: '+e.message,'danger')}finally{inp.remove()}};inp.hidden=true;document.body.appendChild(inp);inp.addEventListener('cancel',()=>inp.remove(),{once:true});inp.click();}};
SA.receiveBackupBase64=async b64=>{try{const txt=decodeURIComponent(escape(atob(b64)));await restoreBackupText(txt)}catch(e){toast('Backup read failed: '+e.message,'danger')}};
async function restoreBackupText(txt){try{const obj=JSON.parse(txt),data=obj.data||obj.stores;if(!data||typeof data!=='object'||Array.isArray(data)||!STORES.some(s=>Object.hasOwn(data,s)))throw new Error('Not an S.A Traders backup');for(const s of STORES){if(data[s]===undefined)continue;if(!Array.isArray(data[s]))throw new Error('Invalid backup collection: '+s);const keys=new Set();for(const row of data[s]){const key=String(row?.[FIREBASE_KEYS[s]]??'').trim();if(!row||typeof row!=='object'||!key||keys.has(key))throw new Error('Invalid or duplicate record in '+s);keys.add(key)}}if(!confirmAction('Replace Firebase business data with this backup?'))return;for(const s of STORES){if(!Object.hasOwn(data,s))continue;await DB.clear(s);for(const row of data[s])await DB.put(s,row)}await DB.loadAll(true);await seedDb();toast('Backup uploaded to Firebase');SA.go('dashboard')}catch(e){toast('Restore failed: '+e.message,'danger')}}
SA.resetData=async()=>{if(!roleGuard()||!confirmAction('Permanently delete ALL bills, customers, custom bills, slips and challans from Firebase?'))return;for(const s of ['bills','customers','customBills','slips','challans'])await DB.clear(s);toast('Firebase business data reset','warning');SA.go('dashboard');};
function exportText(filename,mime,text){if(window.Android?.exportText)Android.exportText(filename,mime,text);else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:mime}));a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}}

// =========================================================
// MATERIAL TRACKER / TOTALS / RETURN BILL
// =========================================================
async function renderMaterialTracker(){const bills=await allHydratedBills();const issued=Object.fromEntries(MATERIALS.map(x=>[x[0],0])),ret=Object.fromEntries(MATERIALS.map(x=>[x[0],0])),bal=Object.fromEntries(MATERIALS.map(x=>[x[0],0]));for(const b of bills){for(const k of Object.keys(issued)){issued[k]+=nonneg(b.base_qty[k])+nonneg(b.additional_totals[k]);ret[k]+=nonneg(b.return_totals[k]);bal[k]+=nonneg(b.balance_qty[k])}}shell(`${headerBlock('Material Tracker - Return','Issued, returned and not returned quantities')}<div class="sa-card"><div class="sa-card-body p-0"><table class="sa-table"><thead><tr><th>Material</th><th>Given + Additional</th><th>Returned</th><th>Not Returned</th></tr></thead><tbody>${MATERIALS.map(([k,l])=>`<tr><td class="fw-800">${l}</td><td>${issued[k]}</td><td>${ret[k]}</td><td class="fw-900 ${bal[k]?'text-red':'text-green'}">${bal[k]}</td></tr>`).join('')}</tbody></table></div></div><div class="sa-card mt-3"><div class="sa-card-header"><h3 class="sa-card-title">Bill Comparison</h3></div><div class="sa-card-body">${bills.map(b=>`<div class="bill-card"><div class="bill-head"><div><div class="bill-no">${esc(b.bill_no)}</div><div class="bill-meta">${esc(b.name||'-')} · ${esc(b.mobile||'-')}</div></div>${statusBadge(b.status)}</div><div class="pill-row mt-2">${MATERIALS.map(([k,l])=>`<span class="sa-badge ${b.balance_qty[k]?'pending':'closed'}">${l}: ${b.balance_qty[k]}</span>`).join('')}</div></div>`).join('')||'<div class="empty">No bills.</div>'}</div></div>`,'admin');}
async function renderTotals(){const bills=await allHydratedBills();const totals=Object.fromEntries(MATERIALS.map(x=>[x[0],0]));for(const b of bills.filter(x=>x.status==='open'))for(const k of Object.keys(totals))totals[k]+=nonneg(b.balance_qty[k]);shell(`${headerBlock('Jackey / Sheet / Span Totals','Current open-bill material listing')}<div class="sa-stat-grid mb-3">${MATERIALS.slice(0,4).map(([k,l],idx)=>`<div class="sa-stat ${['gold','blue','green','red'][idx]}"><div class="sa-stat-label">${l}</div><div class="sa-stat-value">${totals[k]}</div></div>`).join('')}</div><div class="sa-card"><div class="sa-card-body p-0"><table class="sa-table"><thead><tr><th>Bill</th><th>Customer</th>${MATERIALS.map(x=>`<th>${x[1]}</th>`).join('')}</tr></thead><tbody>${bills.filter(x=>x.status==='open').map(b=>`<tr><td class="fw-800">${esc(b.bill_no)}</td><td>${esc(b.name||'-')}</td>${MATERIALS.map(([k])=>`<td>${b.balance_qty[k]}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="8">No active bills.</td></tr>'}</tbody></table></div></div>`,'reports');}
async function renderReturnBill(){shell(`${headerBlock('Return Bill','Standalone return material note')}<div class="sa-alert info">For an existing rental bill, use Bill Details → Return Material. This page creates a standalone return slip.</div><button class="sa-btn gold lg" onclick="SA.go('slip-new/return')">Create Return Slip</button>`,'slips');}


// =========================================================
// PRINT VIEWS — invoice / customer / next cycle / custom
// =========================================================
function printHeader(title){return `<div class="print-title brand-print-title">${brandLogo('print-brand-logo')}<h1>${esc(BUSINESS.name)}</h1><p>${esc(BUSINESS.address)} · ${esc(BUSINESS.phone)}</p><div class="sa-badge gold mt-2">${esc(title)}</div></div>`}
function printActions(job){return `<div class="actions no-print mt-4" style="justify-content:center"><button class="sa-btn gold lg" onclick="SA.printNow('${esc(job)}')">Print / Save PDF</button><button class="sa-btn outline lg" onclick="SA.shareInvoiceImage(this)">Share image</button><button class="sa-btn outline lg" onclick="SA.back()">Back</button></div>`}
SA.printNow=job=>{if(window.Android?.printPage)Android.printPage(job);else window.print()};
function customerInfoTable(b){return `<div class="sa-card mb-3"><div class="sa-card-body"><div class="form-grid three"><div class="info-pair"><span class="k">Bill No</span><span class="v">${esc(b.bill_no)}</span></div><div class="info-pair"><span class="k">Start Date</span><span class="v">${esc(b.start_date||'-')}</span></div><div class="info-pair"><span class="k">Cycle</span><span class="v">${i(b.cycle_days)} Days</span></div><div class="info-pair"><span class="k">Customer</span><span class="v">${esc(b.name||'-')}</span></div><div class="info-pair"><span class="k">Mobile</span><span class="v">${esc(b.mobile||'-')}</span></div><div class="info-pair"><span class="k">Place</span><span class="v">${esc(b.place||'-')}</span></div></div></div></div>`}
async function renderPrintInvoice(no,mode='invoice'){const raw=await DB.get('bills',no);if(!raw){toast('Bill not found','danger');return}const b=hydrateBill(raw),snap=b.cycles?.[b.cycles.length-1]||{snapshot_qty:b.base_qty,snapshot_wood:b.base_wood_maps},br=calcRent(snap.snapshot_qty,snap.snapshot_wood,b.rates),terms=await setting('terms_invoice',DEFAULT_TERMS);const title=mode==='customer'?`Customer Bill ${b.bill_no}`:`Invoice ${b.bill_no}`;printShell(`${printHeader(title)}${customerInfoTable(b)}<div class="summary-strip mb-3"><div class="summary-box blue"><div class="label">Total Due</div><div class="value">${money(b.total_due)}</div></div><div class="summary-box green"><div class="label">Total Paid</div><div class="value">${money(b.total_paid)}</div></div><div class="summary-box red"><div class="label">Pending</div><div class="value">${money(b.pending)}</div></div><div class="summary-box gold"><div class="label">Advance Deposit</div><div class="value">${money(b.advance_locked)}</div></div></div><div class="sa-card mb-3"><div class="sa-card-header"><h3 class="sa-card-title">Current Cycle Material Rent</h3></div><div class="sa-card-body p-0"><table class="sa-table"><thead><tr><th>Material</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${br.lines_materials.map(x=>`<tr><td>${x.label}</td><td>${x.qty}</td><td>${money(x.rate)}</td><td>${money(x.amount)}</td></tr>`).join('')}${WOODS.map(([k,l,rf])=>{const w=br.wood_totals[k];return`<tr><td>${l} <span class="mono small">${esc(w.text)}</span></td><td>${w.total_feet} ft</td><td>${money(w.rate)}</td><td>${money(w.amount)}</td></tr>`}).join('')}<tr><td colspan="3" class="right fw-900">Current Rent</td><td class="fw-900">${money(br.rent_total)}</td></tr></tbody></table></div></div><div class="sa-card mb-3"><div class="sa-card-header"><h3 class="sa-card-title">Rental Cycle Summary</h3></div><div class="sa-card-body p-0"><table class="sa-table"><thead><tr><th>Cycle</th><th>From</th><th>To</th><th>Rent</th><th>Transport</th><th>Total</th></tr></thead><tbody>${b.cycles.map(c=>`<tr><td>#${c.index}</td><td>${c.start_date}</td><td>${c.end_date}</td><td>${money(c.rent)}</td><td>${money(c.transport)}</td><td class="fw-800">${money(c.total)}</td></tr>`).join('')}</tbody></table></div></div><div class="sa-card invoice-terms"><div class="sa-card-header"><h3 class="sa-card-title">Terms & Conditions</h3></div><div class="sa-card-body small">${textToHtml(terms)}</div></div>${printActions(`${BUSINESS.name} - ${title}`)}`);}
async function renderPrintNextCycle(no){const raw=await DB.get('bills',no);if(!raw){toast('Bill not found','danger');return}const b=hydrateBill(raw),idx=(b.current_cycle_index||0)+1,snap=snapshotForCycle(b,idx),br=calcRent(snap.qty,snap.wood,b.rates),start=parseDate(b.start_date),days=Math.max(i(b.cycle_days,30),1),cs=addDays(start,(idx-1)*days),ce=addDays(cs,days-1);printShell(`${printHeader(`Next Cycle Bill ${b.bill_no}`)}${customerInfoTable(b)}<div class="sa-card mb-3"><div class="sa-card-header"><div><h3 class="sa-card-title">Cycle #${idx}</h3><div class="sa-card-subtitle">${ymd(cs)} to ${ymd(ce)}</div></div><div class="money-big">${money(br.rent_total)}</div></div><div class="sa-card-body p-0"><table class="sa-table"><thead><tr><th>Material</th><th>Qty</th><th>Amount</th></tr></thead><tbody>${br.lines_materials.map(x=>`<tr><td>${x.label}</td><td>${x.qty}</td><td>${money(x.amount)}</td></tr>`).join('')}${WOODS.map(([k,l])=>{const w=br.wood_totals[k];return`<tr><td>${l} · ${esc(w.text)}</td><td>${w.total_feet} ft</td><td>${money(w.amount)}</td></tr>`}).join('')}</tbody></table></div></div><div class="sa-alert info">Transport/loading/unloading are applied only in the first cycle, matching the original billing rules.</div>${printActions(`${BUSINESS.name} - Next Cycle ${b.bill_no}`)}`);}
async function renderPrintCustom(no){const raw=await DB.get('customBills',no);if(!raw){toast('Custom bill not found','danger');return}const {bill:b,breakdown:br,calc}=hydrateCustom(raw);printShell(`${printHeader(`Custom Shop Bill ${b.bill_no}`)}${customerInfoTable(b)}<div class="sa-card mb-3"><div class="sa-card-body p-0"><table class="sa-table"><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody><tr><td>Material Rent</td><td>${money(calc.material_total)}</td></tr><tr><td>Wood Material</td><td>${money(calc.wood_total)}</td></tr><tr><td>Transport</td><td>${money(calc.transport_vehicle_total)}</td></tr><tr><td>Loading</td><td>${money(calc.loading)}</td></tr><tr><td>Unloading</td><td>${money(calc.unloading)}</td></tr><tr><td>Advance (Material + Wood)</td><td>${money(calc.advance_amount)}</td></tr><tr><td class="fw-900">Grand Total</td><td class="fw-900">${money(calc.grand_total)}</td></tr><tr><td>Paid</td><td>${money(b.total_paid)}</td></tr><tr><td class="text-red fw-900">Pending</td><td class="text-red fw-900">${money(b.pending)}</td></tr></tbody></table></div></div><div class="sa-card mb-3"><div class="sa-card-header"><h3 class="sa-card-title">Rules</h3></div><div class="sa-card-body small">${textToHtml(b.print_rules||DEFAULT_CUSTOM_RULES)}</div></div><div class="sa-card invoice-terms"><div class="sa-card-header"><h3 class="sa-card-title">Terms & Conditions</h3></div><div class="sa-card-body small">${textToHtml(b.terms_conditions||DEFAULT_CUSTOM_TERMS)}</div></div>${printActions(`${BUSINESS.name} - Custom Bill ${b.bill_no}`)}`);}

// End of Firebase Firestore port.

