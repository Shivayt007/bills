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
export type ItemChange={date:string;items:NumericRecord;wood:Record<string,SizeMap>;effective_from_cycle:number;rid?:string;aid?:string;note?:string;created_at?:string};
export type Payment={id?:string;date?:string;payment_id?:string;payment_date?:string;amount:number;note?:string;method?:string;cycle_index?:number;cycle_start_date?:string;cycle_end_date?:string;receipt_key?:string;[key:string]:unknown};
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
export const dateUTC=(value:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value)))return null;
 const d=new Date(value+'T00:00:00.000Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value?d:null;
};
export const addDate=(value:string,n:number)=>{const d=dateUTC(value);if(!d)throw Error('Invalid date');return new Date(d.getTime()+n*86400000).toISOString().slice(0,10);};
export const cycleIndex=(start:string,days:number,date:string)=>{const a=dateUTC(start),b=dateUTC(date);if(!a||!b)throw Error('Invalid cycle date');return Math.max(1,Math.floor((b.getTime()-a.getTime())/86400000/Math.max(1,days))+1);};
export const effectiveCycle=(start:string,days:number,date:string)=>cycleIndex(start,days,date)+1;
export const amountTotal=(list:Payment[])=>round2((list||[]).reduce((s,p)=>s+num(p.amount),0));
export const ratesOf=(b:Bill)=>Object.fromEntries(Object.entries(RATES).map(([k,v])=>[k,num(b[k],v)]));
export const baseQty=(b:Bill)=>Object.fromEntries(MATERIALS.map(([k,,q])=>[k,integer(b[q])]));
export const baseWood=(b:Bill)=>Object.fromEntries(WOODS.map(([k])=>[k,sizes(b[k])])) as Record<string,SizeMap>;
export const mapToText=(m:SizeMap)=>Object.keys(m||{}).map(Number).sort((a,b)=>a-b).filter(k=>integer(m[String(k)])>0).map(k=>k+'×'+integer(m[String(k)])).join('+');
export function historyTotals(list:ItemChange[]){
 const mat=Object.fromEntries(MATERIALS.map(([k])=>[k,0])),wood=Object.fromEntries(WOODS.map(([k])=>[k,{} as SizeMap]));
 for(const h of list||[]){for(const k of Object.keys(mat))mat[k]+=integer(h.items?.[k]);for(const k of Object.keys(wood))wood[k]=mapSum(wood[k],h.wood?.[k]||{});}
 return {mat,wood};
}
export function snapshotForCycle(b:Bill,index:number){
 // Sum all events before clamping, exactly as app.js snapshotForCycle.
 const base=baseQty(b),wood=baseWood(b);
 const plus=historyTotals((b.additional_history||[]).filter(h=>num(h.effective_from_cycle,999999)<=index));
 const minus=historyTotals((b.return_history||[]).filter(h=>num(h.effective_from_cycle,999999)<=index));
 for(const k of Object.keys(base))base[k]=Math.max(0,base[k]+plus.mat[k]-minus.mat[k]);
 for(const k of Object.keys(wood))wood[k]=mapSum(mapSum(wood[k],plus.wood[k]),minus.wood[k],-1);
 return {qty:base,q:base,wood};
}
export const physicalBalance=(b:Bill)=>snapshotForCycle(b,Number.MAX_SAFE_INTEGER);
export const woodStats=(map:SizeMap,rate:number)=>{
 let feet=0,pieces=0;for(const [f,p] of Object.entries(map||{})){pieces+=Math.trunc(num(p));feet+=num(f)*Math.trunc(num(p));}
 return {pieces,total_feet:round2(feet),amount:round2(feet*num(rate))};
};
export function calcRent(qty:NumericRecord,wood:Record<string,SizeMap>,rates:NumericRecord){
 const lines=MATERIALS.map(([key,label,,rf])=>({key,label,qty:integer(qty[key]),rate:num(rates[rf]),amount:round2(integer(qty[key])*num(rates[rf]))}));
 const woods=Object.fromEntries(WOODS.map(([key,label,rf])=>[key,{key,label,rate:num(rates[rf]),text:mapToText(wood[key]||{}),...woodStats(wood[key]||{},rates[rf])}]));
 const material=round2(lines.reduce((s,l)=>s+l.amount,0)),wt=round2(Object.values(woods).reduce((s,l)=>s+l.amount,0));
 return {material,wood:wt,rent:round2(material+wt),lines,woods};
}
export function transport(b:Bill){
 const up=integer(b.transport_up_trips)*num(b.transport_up_charge),down=integer(b.transport_down_trips)*num(b.transport_down_charge),loading=num(b.loading_charge),unloading=num(b.unloading_charge);
 return {up:round2(up),down:round2(down),loading:round2(loading),unloading:round2(unloading),total:round2(up+down+loading+unloading)};
}
export type Cycle={index:number;start_date:string;end_date:string;total:number;rent:number;transport:number;snapshot_qty:NumericRecord;snapshot_wood:Record<string,SizeMap>};
export function cycleFor(b:Bill,index:number):Cycle{
 const start=addDate(b.start_date,(index-1)*(Math.max(1,Math.trunc(num(b.cycle_days,30))))),days=Math.max(1,Math.trunc(num(b.cycle_days,30)));
 const snap=snapshotForCycle(b,index),rent=calcRent(snap.qty,snap.wood,ratesOf(b)).rent,tr=index===1?transport(b).total:0;
 return {index,start_date:start,end_date:addDate(start,days-1),rent,transport:tr,total:round2(rent+tr),snapshot_qty:snap.qty,snapshot_wood:snap.wood};
}
export const cyclePaid=(b:Bill,c:Cycle)=>amountTotal((b.payments||[]).filter(p=>p.cycle_index===c.index&&p.cycle_start_date===c.start_date&&p.cycle_end_date===c.end_date));
export function calculateCustom(b:Bill){
 const br=calcRent(baseQty(b),baseWood(b),ratesOf(b)),tr=transport(b),paid=amountTotal(b.payments),advance=br.rent,due=round2(br.rent+tr.total+advance);
 return {due,paid,pending:Math.max(0,round2(due-paid)),advance,transport:tr.total,material:br.material,wood:br.wood,cycles:[] as Cycle[],credit:Math.max(0,round2(paid-due))};
}
export function calculateBill(b:Bill,asOf=TODAY()){
 const first=calcRent(baseQty(b),baseWood(b),ratesOf(b)),tr=transport(b).total,paid=amountTotal(b.payments),cycles:Cycle[]=[];
 if(b.calculation_type==='customshop_professional'){
  const custom=calculateCustom(b),start=dateUTC(b.start_date)?b.start_date:asOf;
  return {...custom,cycles:[{index:1,start_date:start,end_date:addDate(start,Math.max(1,Math.trunc(num(b.cycle_days,30)))-1),total:custom.due,rent:round2(first.rent*2),transport:tr,snapshot_qty:baseQty(b),snapshot_wood:baseWood(b)}]};
 }
 const start=dateUTC(b.start_date),until=dateUTC(b.status==='closed'&&b.closed_at?b.closed_at:asOf);
 if(start&&until){const count=Math.min(499,Math.max(0,cycleIndex(b.start_date,Math.max(1,Math.trunc(num(b.cycle_days,30))),b.status==='closed'&&b.closed_at?b.closed_at:asOf)));
  if(start<=until)for(let i=1;i<=count;i++)cycles.push(cycleFor(b,i));}
 const due=round2(cycles.reduce((s,c)=>s+c.total,0));
 return {cycles,due,paid,pending:Math.max(round2(due-paid),0),transport:tr,material:first.material,wood:first.wood,advance:round2(num(b.advance_amount)),credit:Math.max(0,round2(paid-due))};
}
export const validateBill=(b:Bill,existing:Bill[],original?:string)=>{
 if(!String(b.bill_no).trim())throw Error('Bill number required');
 if(!String(b.name).trim())throw Error('Customer name required');
 if(!dateUTC(b.start_date))throw Error('Start date must be YYYY-MM-DD');
 if(![15,20,30].includes(num(b.cycle_days)))throw Error('Cycle days must be 15, 20 or 30');
 if(existing.some(x=>x.bill_no===b.bill_no&&x.bill_no!==original))throw Error('This bill number already exists');
 for(const [,,q,r] of MATERIALS)if(num(b[q])<0||num(b[r])<0)throw Error('Material values cannot be negative');
 for(const [,,r] of WOODS)if(!Number.isFinite(Number(b[r]))||num(b[r])<0)throw Error('Wood rates must be non-negative numbers');
 for(const [,,q,r] of MATERIALS){if(!Number.isInteger(Number(b[q]))||Number(b[q])<0||!Number.isFinite(Number(b[r])))throw Error('Enter whole quantities and valid rates');}
 for(const k of ['transport_up_trips','transport_down_trips','transport_up_charge','transport_down_charge','loading_charge','unloading_charge','advance_amount'])if(!Number.isFinite(Number(b[k]))||Number(b[k])<0)throw Error('Charges and advance must be non-negative');
 for(const [k] of WOODS)validateWood(String(b[k]||''));
};
export const invoiceText=(b:Bill)=>{
 const x=calculateBill(b);
 return ['S.A Traders','Invoice '+b.bill_no,'Customer: '+b.name,'Mobile: '+b.mobile,
  'Site: '+b.place,'Start: '+b.start_date,'Cycle days: '+b.cycle_days,
  'Current cycles: '+x.cycles.length,'Due: '+money(x.due),'Paid: '+money(x.paid),
  'Pending: '+money(x.pending),'Advance deposit: '+money(x.advance),'',
  ...MATERIALS.filter(([,,q])=>integer(b[q])>0).map(([,label,q,r])=>label+': '+integer(b[q])+' × '+money(num(b[r]))),
  ...WOODS.filter(([k])=>String(b[k]||'')).map(([k,label,r])=>label+': '+String(b[k])+' @ '+money(num(b[r]))),
  '','Advance is a separate security deposit. Rental is charged per full cycle.'].join('\n');
};

// New writes reject unparsed text; the legacy parser remains unchanged for old records.
export function validateWood(raw:string){
 if(!raw.trim()||raw.trim()==='0')return;
 const cleaned=raw.replace(/\d+(?:\.\d+)?\s*[x×*]\s*\d+/gi,'').replace(/[+,\s]/g,'');
 if(cleaned)throw Error('Wood must use length × whole pieces, e.g. 8×5+10×2');
 if(/(?:^|[+,\s])0(?:\.0+)?\s*[x×*]/.test(raw))throw Error('Wood lengths must be positive');
}
