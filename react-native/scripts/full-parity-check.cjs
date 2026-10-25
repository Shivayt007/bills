const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const cache={};function load(file){file=path.resolve(__dirname,'../src',file+'.ts');if(cache[file])return cache[file];const m={exports:{}};cache[file]=m.exports;const out=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText;vm.runInNewContext(out,{exports:m.exports,module:m,require:n=>load(n.replace('./','')),Date,Math,Number,Object,String,RegExp,console,Set,Map,JSON,Error},{filename:file});return m.exports;}
const d=load('domain'),l=load('ledger'),r=load('reminders');
const original=fs.readFileSync(path.resolve(__dirname,'../../app.js'),'utf8');
const source=original.slice(original.indexOf('const DEFAULT_RATES'),original.indexOf('const DEFAULT_TERMS'))+original.slice(original.indexOf('const n ='),original.indexOf('const formObj'))+original.slice(original.indexOf('function parseComboSizes'),original.indexOf('// AUTH + ROUTING'))+'\n globalThis.engine={hydrateBill,hydrateCustom,snapshotForCycle,woodStats,parseComboSizes};';
const legacy={structuredClone};vm.runInNewContext(source,legacy);
let checks=0;
function eq(a,b,label){assert.equal(JSON.stringify(a),JSON.stringify(b),label);checks++;}
const now=d.TODAY();
for(const days of [15,20,30])for(let i=0;i<150;i++){
 const b=d.makeBill();b.bill_no='golden-'+days+'-'+i;b.name='Anonymous';b.start_date=d.addDate(now,-(i*3));b.cycle_days=days;
 for(const [k,,q,rate] of d.MATERIALS){b[q]=(i+q.length)%21;b[rate]=(i%7===0?.005:0)+d.RATES[rate]+i%3;}
 b.wood_12='8.25×3+8.25x2+10×2';b.wood_9=i%2?'9×4':'';b.wood_12_rate=18.005;
 b.transport_up_trips=2;b.transport_up_charge=120.125;b.loading_charge=49.995;b.advance_amount=2000;
 b.payments=[{amount:i*11.25,payment_date:now}];
 b.return_history=[{date:b.start_date,effective_from_cycle:2,items:{jackey:2},wood:{wood_12:{'8.25':2}}}];
 b.additional_history=[{date:b.start_date,effective_from_cycle:3,items:{sheet:4},wood:{wood_12:{'10':1}}}];
 if(i%3===0){b.status='closed';b.closed_at=d.addDate(b.start_date,i);}
 const a=d.calculateBill(b),o=legacy.engine.hydrateBill(b);
 for(const key of ['due','paid','pending','advance'])eq(a[key],o[{due:'total_due',paid:'total_paid',pending:'pending',advance:'advance_locked'}[key]],'golden '+key);
 eq(a.cycles.map(c=>[c.index,c.start_date,c.end_date,c.rent,c.transport,c.total]),o.cycles.map(c=>[c.index,c.start_date,c.end_date,c.rent,c.transport,c.total]),'cycle parity');
 eq(d.calculateCustom(b).due,legacy.engine.hydrateCustom(b).calc.grand_total,'custom total');
 b.calculation_type='customshop_professional';eq(d.calculateBill(b).due,legacy.engine.hydrateBill(b).total_due,'conversion total');
}
{const b=d.makeBill();b.start_date=now;b.transport_up_trips=1;b.transport_down_trips=1;for(const k of ['transport_up_charge','transport_down_charge','loading_charge','unloading_charge'])b[k]=.005;eq(d.calculateCustom(b).due,legacy.engine.hydrateCustom(b).calc.grand_total,'custom independently rounded fees');b.calculation_type='customshop_professional';eq(d.calculateBill(b).due,legacy.engine.hydrateBill(b).total_due,'converted raw summed transport');}
for(const raw of ['8×5+10×2','8.5×3','8×2+8×3','12x0','6*10,9x2'])eq(d.woodStats(d.sizes(raw),18).amount,legacy.engine.woodStats(legacy.engine.parseComboSizes(raw),18).amount,'wood '+raw);
for(const raw of ['8x2oops','8x-2','8x2.5','-8x2'])assert.throws(()=>d.validateWood(raw));
let b=d.makeBill();Object.assign(b,{bill_no:'A',name:'Test',mobile:'9999999999',start_date:now,jackey_qty:100});
let returned=l.changeMaterial(b,'return',now,{jackey:20},{},'');eq(d.physicalBalance(returned).qty.jackey,80,'physical return');eq(d.calculateBill(returned).due,6500,'current cycle unchanged');eq(d.calculateBill(returned,d.addDate(now,30)).due,11700,'next cycle return');assert.throws(()=>l.changeMaterial(returned,'return',now,{jackey:81},{},''));
returned=l.changeMaterial(returned,'addition',now,{sheet:10},{wood_12:'8×2'},'');eq(d.physicalBalance(returned).qty.sheet,10,'addition');
let data={bills:[b,{...b,bill_no:'B'},{...b,bill_no:'C'}],customers:[{name:'Test',mobile:b.mobile,place:''}],inventory:[],notes:[],settings:[]};
const input={id:'bank1',reference:'UTR123',amount:'5000',date:now,source:'Bank',mobile:b.mobile,name:b.name,credit:false};
const allocations=[['A','2000'],['B','1500'],['C','1500']].map(([bill_no,amount])=>({store:'bills',bill_no,cycle_index:1,amount}));
let paid=l.allocateReceipt(data,input,allocations);eq(paid.bills.map(b=>d.calculateBill(b).paid),[2000,1500,1500],'5000 split');assert.throws(()=>l.allocateReceipt(paid,input,allocations));
const key=paid.settings[0].key;
paid=l.allocateReceipt(paid,{...input,credit:true,editKey:key,reason:'Fix allocation'},[{...allocations[0],amount:'3000'}]);eq(paid.bills.map(b=>d.calculateBill(b).paid),[3000,0,0],'reallocation');eq(paid.customers[0].payment_credit_balance,2000,'credit');
assert.throws(()=>l.allocateReceipt(data,input,[{...allocations[0],amount:'5001'}]));
let p=l.recordPayment(b,{amount:'7000',date:now,method:'Cash',note:'',cycle:1});eq(d.calculateBill(p).credit,500,'overpaid is visible');assert.throws(()=>l.recordPayment(p,{amount:'7000',date:now,method:'Cash',note:'',cycle:1}));
eq(d.calculateBill({...b,start_date:d.addDate(now,10)}).cycles.length,0,'future start');eq(d.addDate('2028-02-28',1),'2028-02-29','leap day');eq(d.addDate('2026-12-31',1),'2027-01-01','year boundary');assert(r.reminders(data).some(x=>x.category==='today'));
console.log('PASS: '+checks+' source comparisons / assertions plus rejection cases; no device or live-service tests claimed.');
