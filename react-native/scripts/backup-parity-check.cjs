const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const assert=require('node:assert/strict');
const compile=(name,load)=>{const code=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../src/'+name+'.ts'),'utf8'),
 {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const m={exports:{}};vm.runInNewContext(code,{module:m,exports:m.exports,require:load||(()=>{throw Error('unexpected dependency')}),Date,JSON,Object,Array,Math,Number,Set,String,RegExp,Error,Map,console},{filename:name+'.js'});return m.exports;};
const domain=compile('domain');
const backup=compile('legacyBackup',(name)=>{assert.equal(name,'./domain');return domain;});
const base=domain.EMPTY;
const sample={
 schema:'sa-traders-firebase-v1',exported_at:'2026-10-24T00:00:00Z',
 data:{bills:[{bill_no:'2502',name:'Fixture',mobile:'9000000000',start_date:'2026-09-12',
  cycle_days:30,jackey_qty:25,jackey_rate:65,advance_amount:200,
  payments:[{payment_id:'legacy-2502-1',payment_date:'2026-09-26',amount:14075},
  {payment_id:'pay-a',payment_date:'2026-10-21',amount:7725,cycle_index:2,
   cycle_start_date:'2026-10-12',cycle_end_date:'2026-11-10',receipt_key:'payment_receipt:id:test'}],
  return_history:[{rid:'1',date:'2026-10-01',effective_from_cycle:2,items:{jackey:1},wood:{}}]}],
 customers:[{mobile:'9000000000',name:'Fixture',customer_id:'CUST00001'}],
 inventory:[{item:'jackey',stock_qty:100}],settings:[{key:'terms_invoice',value:'Test'}],
 customBills:[],slips:[],challans:[],nativeNotes:[{id:'n1',type:'slip',customer:'Fixture',date:'2026-10-24',notes:'test'}]}
};
const parsed=backup.parseLegacyBackup(JSON.stringify(sample));
assert.equal(parsed.data.bills.length,1);
assert.equal(parsed.data.bills[0].payments[1].receipt_key,'payment_receipt:id:test');
assert.equal(parsed.data.bills[0].return_history[0].effective_from_cycle,2);
assert.equal(parsed.data.customers[0].mobile,'9000000000');
assert.equal(parsed.data.notes[0].id,'n1');
const exported=backup.parseLegacyBackup(backup.exportLegacyBackup(parsed.data));
assert.deepEqual(JSON.parse(JSON.stringify(exported.data.bills[0].payments)),sample.data.bills[0].payments);
const merged=backup.mergeBackup({...base,customers:[{name:'Old',mobile:'9000000000',place:''}]},parsed.data);
assert.equal(merged.customers.length,1,'customer merge must match mobile, not optional customer_id');
assert.equal(merged.customers[0].name,'Fixture');
assert.throws(()=>backup.parseLegacyBackup('invalid JSON'),/not valid JSON/);
assert.throws(()=>backup.parseLegacyBackup(JSON.stringify({...sample,data:{...sample.data,bills:[sample.data.bills[0],sample.data.bills[0]]}})),/duplicate bill numbers/);
assert.throws(()=>backup.parseLegacyBackup(JSON.stringify({...sample,data:{...sample.data,customers:[sample.data.customers[0],sample.data.customers[0]]}})),/duplicate customers identifier/);
assert.throws(()=>backup.parseLegacyBackup(JSON.stringify({...sample,data:{...sample.data,bills:[{...sample.data.bills[0],payments:'wrong'}]}})),/Invalid payments/);
assert.throws(()=>backup.parseLegacyBackup(JSON.stringify({...sample,data:{...sample.data,bills:[{...sample.data.bills[0],payments:[{amount:-3}]}]}})),/Invalid payment amount/);
const bom=backup.parseLegacyBackup('\uFEFF'+JSON.stringify(sample));
assert.equal(bom.data.bills[0].bill_no,'2502');
console.log('Legacy backup parser: fixtures, BOM, cycle receipts, roundtrip, mobile-keyed merge and validation passed');
