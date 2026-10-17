const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={console,structuredClone,setTimeout,clearTimeout,document:{addEventListener(){},getElementById(){return null},querySelector(){return null}},localStorage:{getItem(){return null}},sessionStorage:{getItem(){return null}},window:{addEventListener(){},SAFirebase:{DB:{onChange(){}}}},location:{hash:''}};
context.FIREBASE_KEYS={bills:'bill_no',customBills:'bill_no',customers:'mobile',settings:'key',inventory:'item',slips:'slip_no',challans:'challan_no'};
vm.createContext(context);
vm.runInContext(fs.readFileSync('app.js','utf8'),context);
vm.runInContext(fs.readFileSync('ui-fixes.js','utf8'),context);
const ledger=context.window.SA.rentalCycleLedger;
const c1={index:1,start_date:'2026-09-01',end_date:'2026-09-30',total:100};
const c2={index:2,start_date:'2026-10-01',end_date:'2026-10-30',total:200};
const bill={cycles:[c1,c2],payments:[
{amount:30,cycle_index:1,cycle_start_date:c1.start_date,cycle_end_date:c1.end_date},
{amount:20,cycle_index:'1',cycle_start_date:c1.start_date,cycle_end_date:c1.end_date},
{amount:250,cycle_index:2,cycle_start_date:c2.start_date,cycle_end_date:c2.end_date},
{amount:40},{amount:15,cycle_index:1,cycle_start_date:'2026-08-01',cycle_end_date:'2026-08-30'}
]};
const before=JSON.stringify(bill),result=ledger(bill);
assert.equal(result.cycles[0].paid,50);assert.equal(result.cycles[0].balance,50);
assert.equal(result.cycles[1].balance,0);assert.equal(result.cycles[1].credit,50);
assert.equal(result.unassigned,55);assert.equal(JSON.stringify(bill),before);
assert.equal(ledger({cycles:[],payments:[{amount:5}]}).unassigned,5);
assert.equal(ledger({cycles:[c1],payments:[]}).cycles[0].balance,100);
console.log('Cycle ledger: exact cycle matching, split payments, legacy payments, credit and no mutation passed');
