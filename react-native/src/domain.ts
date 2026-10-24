/* A testable React Native port of the original rental math; no DOM/WebView. */
export type NumericRecord=Record<string,number>;
export type SizeMap=Record<string,number>;
export type MaterialKey='jackey'|'jackey9'|'sheet'|'half_sheet'|'span'|'inner3m';
export type WoodKey='wood_12'|'wood_9'|'wood_6'|'runner';
export const MATERIALS:ReadonlyArray<[MaterialKey,string,string,string]>=[
 ['jackey','Jackey','jackey_qty','jackey_rate'],['jackey9','9 Jackey','jackey9_qty','jackey9_rate'],
 ['sheet','Sheet','sheet_qty','sheet_rate'],['half_sheet','Half Sheet','half_sheet_qty','half_sheet_rate'],
 ['span','Span','span_qty','span_rate'],['inner3m','3M Inner','inner3m_qty','inner3m_rate']
];
export const WOODS:ReadonlyArray<[WoodKey,string,string]>=[
 ['wood_12','12 ft Wood','wood_12_rate'],['wood_9','9 ft Wood','wood_9_rate'],
 ['wood_6','6 ft Wood','wood_6_rate'],['runner','Runner','runner_rate']
];
export const RATES:Record<string,number>={jackey_rate:65,jackey9_rate:100,sheet_rate:35,
 half_sheet_rate:30,span_rate:100,inner3m_rate:60,wood_12_rate:18,wood_9_rate:18,wood_6_rate:15,runner_rate:7};
export type ItemChange={date:string;items:NumericRecord;wood:Record<string,SizeMap>;effective_from_cycle:number};
export type Payment={id:string;date:string;amount:number;note?:string};
export type Bill={
 bill_no:string;name:string;mobile:string;place:string;start_date:string;cycle_days:number;
 advance_amount:number;status:'open'|'closed';calculation_type?:string;closed_at?:string;
 payments:Payment[];return_history:ItemChange[];additional_history:ItemChange[];
 transport_up_trips:number;transport_up_charge:number;transport_down_trips:number;
 transport_down_charge:number;loading_charge:number;unloading_charge:number;
 created_at?:string;[key:string]:unknown;
};
export type Customer={name:string;mobile:string;place:string;created_at?:string};
export type Note={id:string;customer:string;date:string;notes:string;type:'slip'|'challan'};
export type Stock={item:string;stock_qty:number;stock_map?:SizeMap};
export type Data={bills:Bill[];customers:Customer[];inventory:Stock[];notes:Note[];customBills?:Record<string,unknown>[];slips?:Record<string,unknown>[];challans?:Record<string,unknown>[];settings?:Record<string,unknown>[];backupBusiness?:Record<string,unknown>;backupExtra?:Record<string,unknown>};
export const EMPTY:Data={bills:[],customers:[],inventory:[],notes:[]};
export const TODAY=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};
export const num=(v:unknown,otherwise=0)=>{const n=Number(v);return Number.isFinite(n)?n:otherwise;};
export const integer=(v:unknown)=>Math.max(0,Math.trunc(num(v)));
export const round2=(x:number)=>Math.round((x+Number.EPSILON)*100)/100;
export const money=(n:number)=>'₹'+round2(n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
export const sizes=(raw:unknown):SizeMap=>{
 const map:SizeMap={},s=String(raw??'').replace(/[,\n+]/g,' '),re=/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/gi;
 let match:RegExpExecArray|null;while((match=re.exec(s))){const ft=num(match[1]),qty=integer(match[2]);
  if(ft>0&&qty>0)map[String(ft)]=(map[String(ft)]||0)+qty;}
 return map;
};
export const mapSum=(a:SizeMap,b:SizeMap,sign=1):SizeMap=>{
 const o:SizeMap={...(a||{})};for(const [k,v] of Object.entries(b||{})){o[k]=integer(o[k])+sign*integer(v);
 if(o[k]<=0)delete o[k];}return o;
};
export const makeBill=():Bill=>({
 bill_no:'',name:'',mobile:'',place:'',start_date:TODAY(),cycle_days:30,advance_amount:0,
 status:'open',payments:[],return_history:[],additional_history:[],
 transport_up_trips:0,transport_up_charge:0,transport_down_trips:0,transport_down_charge:0,loading_charge:0,unloading_charge:0,
 ...Object.fromEntries(MATERIALS.flatMap(([,,q,r])=>[[q,0],[r,RATES[r]]])),
 ...Object.fromEntries(WOODS.flatMap(([k,,r])=>[[k,''],[r,RATES[r]]]))
});
const dateUTC=(value:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const d=new Date(value+'T00:00:00.000Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value?d:null;
};
const addUTC=(d:Date,n:number)=>new Date(d.getTime()+n*86400000);
const ymd=(d:Date)=>d.toISOString().slice(0,10);
const amountTotal=(list:Payment[])=>round2(list.reduce((s,p)=>s+num(p.amount),0));
const baseQ=(b:Bill)=>Object.fromEntries(MATERIALS.map(([k,,q])=>[k,integer(b[q])]));
const baseW=(b:Bill)=>Object.fromEntries(WOODS.map(([k])=>[k,sizes(b[k])])) as Record<string,SizeMap>;
const snapshot=(b:Bill,index:number)=>{
 const q=baseQ(b),wood=baseW(b);
 for(const [hist,sign] of [[b.additional_history,1],[b.return_history,-1]] as const){
  for(const h of hist||[]){if(integer(h.effective_from_cycle)>index)continue;
   for(const k of Object.keys(q))q[k]=Math.max(0,integer(q[k])+sign*integer(h.items?.[k]));
   for(const k of Object.keys(wood))wood[k]=mapSum(wood[k],h.wood?.[k]||{},sign);
  }
 }return {q,wood};
};
export function calculateBill(b:Bill,asOf=TODAY()){
 const start=dateUTC(b.start_date),until=dateUTC(b.status==='closed'&&b.closed_at?b.closed_at:asOf);
 const rentFor=(i:number)=>{const snap=snapshot(b,i);
  const material=round2(MATERIALS.reduce((s,[k,, ,rate])=>s+integer(snap.q[k])*num(b[rate],RATES[rate]),0));
  const wood=round2(WOODS.reduce((s,[k,,rate])=>s+Object.entries(snap.wood[k]||{}).reduce(
   (sum,[feet,pieces])=>sum+num(feet)*integer(pieces)*num(b[rate],RATES[rate]),0),0));
  return {material,wood,rent:round2(material+wood),qty:snap.q};
 };
 const transport=round2(integer(b.transport_up_trips)*num(b.transport_up_charge)+
 integer(b.transport_down_trips)*num(b.transport_down_charge)+num(b.loading_charge)+num(b.unloading_charge));
 const payments=b.payments||[],paid=amountTotal(payments),days=Math.max(1,integer(b.cycle_days)||30);
 if(!start||!until){return {cycles:[] as Array<{index:number;start_date:string;end_date:string;total:number;rent:number}>,due:0,paid,pending:0,transport,material:0,wood:0,advance:num(b.advance_amount)};}
 const cycles:Array<{index:number;start_date:string;end_date:string;total:number;rent:number}>=[];
 let first=rentFor(1);
 if(b.calculation_type==='customshop_professional'){
  const total=round2(first.rent*2+transport);
  cycles.push({index:1,start_date:ymd(start),end_date:ymd(addUTC(start,days-1)),total,rent:first.rent*2});
 }else{
  let cur=start;for(let i=1;cur<=until&&i<=499;i++){
   const rent=rentFor(i);const end=addUTC(cur,days-1);
   cycles.push({index:i,start_date:ymd(cur),end_date:ymd(end),rent:rent.rent,
    total:round2(rent.rent+(i===1?transport:0))});cur=addUTC(end,1);
  }
 }
 const due=round2(cycles.reduce((s,c)=>s+c.total,0));
 return {cycles,due,paid,pending:Math.max(round2(due-paid),0),transport,
 material:first.material,wood:first.wood,advance:num(b.advance_amount)};
}
export const validateBill=(b:Bill,existing:Bill[],original?:string)=>{
 if(!String(b.bill_no).trim())throw Error('Bill number required');
 if(!String(b.name).trim())throw Error('Customer name required');
 if(!dateUTC(b.start_date))throw Error('Start date must be YYYY-MM-DD');
 if(![15,20,30].includes(num(b.cycle_days)))throw Error('Cycle days must be 15, 20 or 30');
 if(existing.some(x=>x.bill_no===b.bill_no&&x.bill_no!==original))throw Error('This bill number already exists');
 for(const [,,q,r] of MATERIALS)if(num(b[q])<0||num(b[r])<0)throw Error('Material values cannot be negative');
 for(const [,,r] of WOODS)if(num(b[r])<0)throw Error('Wood rates cannot be negative');
};
export const invoiceText=(b:Bill)=>{
 const x=calculateBill(b);
 return ['S.A Traders','Invoice '+b.bill_no,'Customer: '+b.name,'Mobile: '+b.mobile,
  'Site: '+b.place,'Start: '+b.start_date,'Cycle days: '+b.cycle_days,
  'Current cycles: '+x.cycles.length,'Due: '+money(x.due),'Paid: '+money(x.paid),
  'Pending: '+money(x.pending),'Advance deposit: '+money(x.advance),'',
  ...MATERIALS.filter(([,,q])=>integer(b[q])>0).map(([,label,q,r])=>label+': '+integer(b[q])+' × '+money(num(b[r]))),
  ...WOODS.filter(([k])=>String(b[k]||'')).map(([k,label,r])=>label+': '+String(b[k])+' @ '+money(num(b[r]))),
  '','Generated from local React Native test app; not a tax invoice or replacement for official PDF.'].join('\n');
};
