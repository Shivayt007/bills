const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={SA:{},window:{},BUSINESS:{name:'S.A Traders',phone:'9790894776'},money:n=>'₹'+Number(n).toFixed(2),setTimeout,clearTimeout,Map};
vm.createContext(context);vm.runInContext(fs.readFileSync('whatsapp-reminders.js','utf8'),context);
const row={name:'Kumar',billNo:'101',mobile:'9876543210',balance:250,date:'2026-10-21',category:'pending'};
let text=context.SA.whatsappReminderMessage(row);assert.match(text,/Kumar/);assert.match(text,/Bill #101/);assert.match(text,/Pending amount: ₹250.00/);assert.match(text,/2026-10-21/);
text=context.SA.whatsappReminderMessage({...row,category:'upcoming'});assert.match(text,/Expected cycle amount/);assert.match(text,/advance reminder/);assert.ok(!text.includes('Pending amount'));
assert.equal(context.SA.whatsappReminderPhone('09876543210'),'919876543210');assert.throws(()=>context.SA.whatsappReminderPhone('9876543210@evil'));
console.log('WhatsApp reminder text, upcoming amount wording, customer phone validation passed');
