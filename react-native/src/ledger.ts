import {Bill,Data,Payment,ItemChange,NumericRecord,SizeMap,MATERIALS,WOODS,num,integer,round2,calculateBill,calculateCustom,cyclePaid,physicalBalance,dateUTC,effectiveCycle,TODAY,validateWood,sizes} from './domain';
export const uid=(prefix='id')=>prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
export const phone=(v:unknown)=>{let s=String(v||'').replace(/\D/g,'');return s.length===12&&s.startsWith('91')?s.slice(2):s;};
export const cents=(v:unknown)=>{const s=String(v??'').trim();if(!s)return 0;if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('Use amounts with up to 2 decimal places');const n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n))throw Error('Amount too large');return n;};
export const audit=(b:Bill,action:string,payload:unknown,reason:string)=>({...b,payment_audit:[...(Array.isArray(b.payment_audit)?b.payment_audit:[]),{action,payment:payload,reason,at:new Date().toISOString(),by:'local-admin'}]});
export function recordPayment(b:Bill,input:{amount:string;date:string;method:string;note:string;cycle:number;allowDuplicate?:boolean},custom=false){
 const amount=cents(input.amount)/100;if(amount<=0)throw Error('Enter a payment above zero');if(!dateUTC(input.date))throw Error('Invalid payment date');
 if(!['Cash','UPI','Bank'].includes(input.method))throw Error('Choose payment method');
 if((b.payments||[]).some(p=>round2(p.amount)===amount&&(p.payment_date||p.date)===input.date)&&!input.allowDuplicate)throw Error('Same date and amount already recorded. Verify and enable duplicate confirmation if intentional.');
 const cycle=calculateBill(b).cycles.find(c=>c.index===input.cycle);if(!custom&&!cycle)throw Error('Choose a started rental cycle');
 // Original manual workflow permits overpayment. Expose it as overpaid rather than discarding it.
 const p:Payment={payment_id:uid('pay'),amount,payment_date:input.date,method:input.method,note:input.note,created_at:new Date().toISOString(),created_by:'local-admin',...(cycle&&!custom?{cycle_index:cycle.index,cycle_start_date:cycle.start_date,cycle_end_date:cycle.end_date}:{})};
 return {...b,payments:[...(b.payments||[]),p]};
}
export function changeMaterial(b:Bill,type:'return'|'addition',date:string,items:NumericRecord,woodText:Record<string,string>,note:string){
 if(b.status==='closed')throw Error('Bill is closed');if(!dateUTC(date)||!dateUTC(b.start_date))throw Error('Choose a valid date');
 const wood:Record<string,SizeMap>={};for(const [k] of WOODS){validateWood(woodText[k]||'');wood[k]=sizes(woodText[k]);}
 for(const [k] of MATERIALS)if(!Number.isInteger(items[k]||0)||num(items[k])<0)throw Error('Quantities must be non-negative whole pieces');
 if(!Object.values(items).some(v=>v>0)&&!Object.values(wood).some(m=>Object.keys(m).length))throw Error('Enter at least one quantity');
 const balance=physicalBalance(b);
 if(type==='return'){for(const [k,v] of Object.entries(items))if(v>(balance.qty[k]||0))throw Error(k+' exceeds remaining quantity');
 for(const [k,map] of Object.entries(wood))for(const [ft,p] of Object.entries(map))if(p>(balance.wood[k]?.[ft]||0))throw Error(k+' '+ft+' ft exceeds remaining quantity');}
 const h:ItemChange={date,items,wood,note,effective_from_cycle:effectiveCycle(b.start_date,num(b.cycle_days,30),date),created_at:new Date().toISOString(),...(type==='return'?{rid:uid('ret')}:{aid:uid('add')})};
 const key=type==='return'?'return_history':'additional_history';return {...b,[key]:[...(b[key]||[]),h]};
}
export type Store='bills'|'customBills';
export type Allocation={store:Store;bill_no:string;cycle_index:number;amount:string};
export type ReceiptInput={id:string;reference:string;amount:string;date:string;source:string;mobile:string;name:string;credit:boolean;reason?:string;editKey?:string};
export function allocateReceipt(data:Data,input:ReceiptInput,allocations:Allocation[]):Data{
 if(!dateUTC(input.date))throw Error('Invalid receipt date');const total=cents(input.amount);if(total<=0)throw Error('Receipt amount must be positive');
 const mobile=phone(input.mobile);if(!mobile)throw Error('Select a customer with mobile number');
 const ref=input.reference.trim().toUpperCase().replace(/\s+/g,''),key=input.editKey||(ref?'payment_receipt:ref:'+ref:'payment_receipt:id:'+input.id);
 const settings=[...(data.settings||[])];const previous=settings.find(s=>s.key===key)?.value as any;
 if(previous&&!input.editKey)throw Error('Receipt already saved; use Correct receipt');
 if(input.editKey&&(!previous||!input.reason?.trim()))throw Error('Correction reason required');
 if(input.editKey&&(phone(previous.customer_mobile)!==mobile||cents(previous.amount)!==total||previous.item.id!==input.id||String(previous.item.reference||'').trim().toUpperCase().replace(/\s+/g,'')!==ref))throw Error('Receipt correction must preserve customer, transaction reference and received amount');
 const all=[...data.bills,...(data.customBills||[]) as Bill[]];
 if(all.some(b=>(b.payments||[]).some(p=>p.receipt_key!==key&&((ref&&String(p.transaction_reference||'').trim().toUpperCase().replace(/\s+/g,'')===ref)||p.detected_payment_id===input.id))))throw Error('Transaction already recorded');
 if(settings.some(s=>s.key!==key&&(s.value as any)?.item?.id===input.id))throw Error('Receipt ID already saved');
 let next:Data={...data,bills:data.bills.map(b=>({...b,payments:[...(b.payments||[])]})),customBills:(data.customBills||[]).map(b=>({...b,payments:[...((b as any).payments||[])]})),customers:data.customers.map(c=>({...c}))};
 // Reallocation removes linked payments and credit in one persisted Data write.
 for(const store of ['bills','customBills'] as const)next[store]=(next[store]||[]).map(raw=>{const b=raw as Bill;const removed=(b.payments||[]).filter(p=>p.receipt_key===key);return removed.length?{...audit(b,'receipt_corrected',removed,input.reason||''),payments:b.payments.filter(p=>p.receipt_key!==key)}:b;}) as any;
 const saved:any[]=[];let allocated=0;const seen=new Set<string>();
 for(const a of allocations){const amount=cents(a.amount);if(!amount)continue;const identity=a.store+':'+a.bill_no+':'+a.cycle_index;if(seen.has(identity))throw Error('Duplicate allocation row');seen.add(identity);
 const rows=next[a.store]||[],index=rows.findIndex(b=>b.bill_no===a.bill_no),b=rows[index] as Bill;if(!b||phone(b.mobile)!==mobile)throw Error('All allocations must belong to selected customer');
 if(b.converted_to_professional)throw Error('Choose converted professional bill');if(b.status==='closed'&&!input.editKey)throw Error('Bill is closed');
 const calc=a.store==='bills'?calculateBill(b):calculateCustom(b),cycle=calc.cycles.find(c=>c.index===a.cycle_index);
 const capacity=a.store==='customBills'?calc.pending:cycle?Math.min(calc.pending,Math.max(0,round2(cycle.total-cyclePaid(b,cycle)))):0;
 if(amount>Math.round(capacity*100))throw Error('Allocation exceeds cycle or bill pending for '+a.bill_no);
 const payment_id=uid('pay');const p:Payment={payment_id,receipt_key:key,amount:amount/100,payment_date:input.date,method:'UPI',detected_payment_id:input.id,transaction_reference:ref,payment_source:input.source,note:'Split receipt · '+input.source,created_at:new Date().toISOString(),...(cycle?{cycle_index:cycle.index,cycle_start_date:cycle.start_date,cycle_end_date:cycle.end_date}:{})};
 (rows as any[])[index]={...b,payments:[...(b.payments||[]),p]};allocated+=amount;saved.push({...a,amount:amount/100,payment_id,cycle_start_date:cycle?.start_date||'',cycle_end_date:cycle?.end_date||''});
 }
 const credit=total-allocated;if(credit<0)throw Error('Allocation exceeds receipt');if(credit&&!input.credit)throw Error('Allocate remaining amount or choose customer credit');
 const ci=next.customers.findIndex(c=>phone(c.mobile)===mobile);const customer:any=ci>=0?next.customers[ci]:{mobile,name:input.name,place:''};
 customer.payment_credit_receipts=(customer.payment_credit_receipts||[]).filter((c:any)=>c.receipt_key!==key);
 if(credit)customer.payment_credit_receipts.push({receipt_key:key,amount:credit/100,created_at:new Date().toISOString()});
 customer.payment_credit_balance=round2(customer.payment_credit_receipts.reduce((s:number,c:any)=>s+num(c.amount),0));if(ci<0)next.customers.push(customer);
 const receipt={kind:'split_payment_receipt',receipt_key:key,item:{id:input.id,reference:ref,amount:total/100,source:input.source},payment_date:input.date,amount:total/100,allocations:saved,credit:credit/100,customer_mobile:mobile,customer_name:input.name,customerKey:'phone:'+mobile,version:num(previous?.version)+1,status:'active',created_at:previous?.created_at||new Date().toISOString(),updated_at:new Date().toISOString(),audit:[...(previous?.audit||[]),...(previous?[{action:'reallocated',reason:input.reason,previous_allocations:previous.allocations,previous_credit:previous.credit}]:[])]};
 const alias='payment_receipt:id:'+input.id;const oldAlias=settings.find(s=>s.key===alias);if(alias!==key&&oldAlias&&(oldAlias.value as any)?.receipt_key!==key)throw Error('Receipt ID already linked');
 next.settings=[...settings.filter(s=>s.key!==key&&s.key!==alias),{key,value:receipt},...(alias!==key?[{key:alias,value:{kind:'split_receipt_alias',receipt_key:key}}]:[])];return next;
}
export function convertCustom(data:Data,b:Bill):Data{
 if(data.bills.some(v=>v.bill_no===b.bill_no))throw Error('Professional bill number already exists');
 const calc=calculateCustom(b),p={...b,advance_amount:calc.advance,calculation_type:'customshop_professional',status:calc.pending<=0?'closed' as const:'open' as const,converted_from_custom:true,converted_at:new Date().toISOString()};
 return {...data,bills:[p,...data.bills],customBills:(data.customBills||[]).map(c=>c.bill_no===b.bill_no?{...c,converted_to_professional:true,dashboard_visible:false}:c)};
}
