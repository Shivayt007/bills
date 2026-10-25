import {Bill,Data,TODAY,calculateBill,calculateCustom,cycleFor,addDate,round2} from './domain';
export type Reminder={bill:Bill;custom:boolean;date:string;amount:number;category:'overdue'|'today'|'upcoming'};
export function reminders(data:Data,date=TODAY()):Reminder[]{
 const result:Reminder[]=[];
 for(const [list,custom] of [[data.bills,false],[data.customBills||[],true]] as const)for(const raw of list){const b=raw as Bill;if(b.status==='closed'||b.converted_to_professional)continue;
  const calc=custom?calculateCustom(b):calculateBill(b,date);const cycles=custom?[{index:1,start_date:b.start_date,total:calc.due}]:[...calc.cycles];
  if(!custom&&b.calculation_type!=='customshop_professional'&&/^\d{4}-\d{2}-\d{2}$/.test(b.start_date)){const first=cycles.length+1;for(let i=first;i<Math.min(first+26,500);i++){try{const c=cycleFor(b,i);if(c.rent<=0)break;cycles.push(c);}catch{break;}}}
  const started=cycles.filter(c=>c.start_date<=date),future=cycles.filter(c=>c.start_date>date),current=started.at(-1),balance=Math.max(0,round2((custom?calc.due:started.reduce((s,c)=>s+c.total,0))-calc.paid));
  const dueDate=current?.start_date||b.start_date;
  if(balance>0&&dueDate<date)result.push({bill:b,custom,date:dueDate,amount:balance,category:'overdue'});
  if(cycles.some(c=>c.start_date===date)&&balance>0)result.push({bill:b,custom,date,amount:balance,category:'today'});
  const next=future.find(c=>c.start_date<=addDate(date,7)&&c.total>0&&cycles.filter(x=>x.start_date<=c.start_date).reduce((s,c)=>s+c.total,0)>calc.paid);
  if(next)result.push({bill:b,custom,date:next.start_date,amount:round2(next.total),category:'upcoming'});
 }return result;
}

export function reminderData(data:Data,date=TODAY()){
 const rows:any[]=[];
 for(const [list,custom] of [[data.bills,false],[data.customBills||[],true]] as const)for(const raw of list){const b=raw as Bill;if(b.status==='closed'||b.converted_to_professional)continue;const x=custom?calculateCustom(b):calculateBill(b,date);const cycles=custom?[{index:1,start_date:b.start_date,end_date:b.start_date,total:x.due}]:[...x.cycles];
 if(!custom&&b.calculation_type!=='customshop_professional'){const first=cycles.length+1;for(let i=first;i<Math.min(first+26,500);i++){try{const c=cycleFor(b,i);if(c.rent<=0)break;cycles.push(c);}catch{break;}}}
 rows.push({billNo:b.bill_no,name:b.name,mobile:b.mobile,isCustom:custom,balance:x.pending,paid:x.paid,total:x.due,start:b.start_date,cycles:cycles.map(c=>({start:c.start_date,end:c.end_date,total:c.total,index:c.index}))});
 }return rows;
}
