const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const filename=path.resolve(__dirname,'../src/domain.ts');
const input=fs.readFileSync(filename,'utf8'),out=ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText;
const m={exports:{}};vm.runInNewContext(out,{module:m,exports:m.exports,Date,Math,Number,Object,String,RegExp,console}, {filename:'domain.js'});
const {makeBill,calculateBill,sizes,money}=m.exports;
assert.equal(sizes('8×5+10x2')['8'],5,'wood sizes must parse');
assert.equal(sizes('8×5+10x2')['10'],2,'wood sizes must parse x');
let b=makeBill();b.bill_no='SA1';b.name='Test';b.start_date='2026-01-01';b.cycle_days=15;
b.jackey_qty=2;b.jackey_rate=65;b.wood_12='8×2';b.wood_12_rate=18;b.transport_up_trips=1;b.transport_up_charge=150;
let one=calculateBill(b,'2026-01-10');assert.equal(one.cycles.length,1);assert.equal(one.due,568); // 130+288+150
let two=calculateBill(b,'2026-01-20');assert.equal(two.cycles.length,2);assert.equal(two.due,986); // second cycle 418
b.payments=[{id:'1',amount:100,date:'2026-01-15'}];assert.equal(calculateBill(b,'2026-01-20').pending,886);
b.return_history=[{date:'2026-01-10',effective_from_cycle:2,items:{jackey:1},wood:{}}];
assert.equal(calculateBill(b,'2026-01-20').due,921);
b.status='closed';b.closed_at='2026-01-13';assert.equal(calculateBill(b,'2026-03-20').cycles.length,1);
assert.equal(money(130),'₹130.00');
console.log('Native rental parity smoke checks passed.');
