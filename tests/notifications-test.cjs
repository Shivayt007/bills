const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const document={addEventListener(){},getElementById(){return null},querySelector(){return null}};
const context={console,structuredClone,setTimeout,clearTimeout,document,localStorage:{getItem(){return null}},sessionStorage:{getItem(){return null}},window:{addEventListener(){},SAFirebase:{DB:{onChange(){}}}},SAFirebase:{DB:{onChange(){}}},location:{hash:''}};
context.FIREBASE_KEYS={bills:"bill_no",customBills:"bill_no",customers:"mobile",settings:"key",inventory:"item",slips:"slip_no",challans:"challan_no"};
vm.createContext(context);vm.runInContext(fs.readFileSync('app.js','utf8'),context);vm.runInContext(fs.readFileSync('notifications-2026.js','utf8'),context);
const categories=context.window.SA.reminderCategories;
const row={name:'Customer',billNo:'1',cycles:[{start:'2026-10-01',total:100},{start:'2026-10-14',total:100},{start:'2026-10-21',total:100}],paid:50};
let groups=categories([row],'2026-10-14');assert.equal(groups.pending[0].balance,150);assert.equal(groups.today.length,1);assert.equal(groups.upcoming.length,1);
groups=categories([{...row,paid:300}],'2026-10-14');assert.equal(groups.pending.length,0);assert.equal(groups.today.length,0);assert.equal(groups.upcoming.length,0);
assert.equal(categories(Array.from({length:125},(_,i)=>({...row,billNo:String(i)})),'2026-10-14').pending.length,125);
assert.equal(categories([{...row,cycles:[{start:'2026-10-22',total:100}]}],'2026-10-14').upcoming.length,0);
// Backup compatibility and invalid backup checks remain exercised.
assert.equal(vm.runInContext(`normalizeBackup({bills:[{bill_no:'1',payments:[{amount:100}]}],customshop_bills:[{bill_no:'C1'}]}).customBills.length`,context),1);
assert.throws(()=>vm.runInContext(`normalizeBackup({bills:[{bill_no:'1'},{bill_no:'1'}]})`,context));
assert.throws(()=>vm.runInContext(`normalizeBackup({hello:'invalid'})`,context));
console.log('Reminder categories, 125-customer list, prepaid bills, legacy backup validation passed');
