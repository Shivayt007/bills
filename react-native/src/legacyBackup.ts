import {Data,EMPTY,Bill} from './domain';

export const BACKUP_SCHEMA='sa-traders-firebase-v1';
type Backup={schema:string;exported_at:string;business?:Record<string,unknown>;data:Record<string,unknown>};
const isObject=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const array=(v:unknown,name:string):Record<string,unknown>[]=>{
 if(v===undefined)return [];
 if(!Array.isArray(v)||v.some(x=>!isObject(x)))throw Error('Invalid '+name+' collection');
 return v as Record<string,unknown>[];
};
export function parseLegacyBackup(text:string):{data:Data;summary:string;business?:Record<string,unknown>} {
 let raw:unknown;
 if(text.length>15_000_000)throw Error('Backup exceeds 15 MB safety limit');
 try{raw=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw Error('The selected file is not valid JSON');}
 if(!isObject(raw)||raw.schema!==BACKUP_SCHEMA||!isObject(raw.data))throw Error('Unsupported backup format. Expected '+BACKUP_SCHEMA);
 const d=raw.data;
 const bills=array(d.bills,'bills'),customers=array(d.customers,'customers');
 const inventory=array(d.inventory,'inventory'),customBills=array(d.customBills,'customBills');
 const slips=array(d.slips,'slips'),challans=array(d.challans,'challans');
 const settings=array(d.settings,'settings');
 if(bills.some(b=>typeof b.bill_no!=='string'||!b.bill_no.trim()))throw Error('Backup contains a bill without a valid bill number');
 if(new Set(bills.map(b=>String(b.bill_no).trim())).size!==bills.length)throw Error('Backup contains duplicate bill numbers');
 if(customBills.some(b=>typeof b.bill_no!=='string'||!b.bill_no.trim()))throw Error('Custom bill without a valid number');
 if(new Set(customBills.map(b=>String(b.bill_no).trim())).size!==customBills.length)throw Error('Duplicate custom bill numbers');
 for(const [name,rows,key] of [['customers',customers,'mobile'],['inventory',inventory,'item'],['slips',slips,'slip_no'],['challans',challans,'challan_no'],['settings',settings,'key']] as const){
  const ids=new Set<string>();
  for(const item of rows){const id=String(item[key]??'').trim();if(!id||ids.has(id))throw Error('Invalid or duplicate '+name+' identifier');ids.add(id);}
 }
 for(const b of [...bills,...customBills]){
  for(const field of ['payments','return_history','additional_history']){
   if(b[field]!==undefined&&!Array.isArray(b[field]))throw Error('Invalid '+field+' for bill '+b.bill_no);
  }
  for(const p of (b.payments as Record<string,unknown>[]|undefined)||[]){
   if(!isObject(p)||!Number.isFinite(Number(p.amount))||Number(p.amount)<0)throw Error('Invalid payment amount in bill '+b.bill_no);
  }
 }
 if(customers.some(c=>typeof c.name!=='string'))throw Error('Invalid customer record');
 // Preserve original objects, nested receipts, cycle allocations, wood maps and unknown fields.
 // Only provide defaults needed by the native UI; do not rewrite legacy keys.
 const normalized=bills.map(b=>({
  ...b,
  payments:Array.isArray(b.payments)?b.payments:[],
  return_history:Array.isArray(b.return_history)?b.return_history:[],
  additional_history:Array.isArray(b.additional_history)?b.additional_history:[],
  status:b.status==='closed'?'closed':'open',
 })) as Bill[];
 const data:Data={...EMPTY,bills:normalized,customers:customers as Data['customers'],
  inventory:inventory as Data['inventory'],notes:Array.isArray(d.nativeNotes)?d.nativeNotes as Data['notes']:[],
  customBills,slips,challans,settings,
  backupBusiness:isObject(raw.business)?raw.business:undefined,
  backupExtra:Object.fromEntries(Object.entries(d).filter(([k])=>!['bills','customers','inventory','customBills','slips','challans','settings'].includes(k)))};
 return {data,summary:`${bills.length} bills · ${customers.length} customers · ${customBills.length} custom bills · ${inventory.length} inventory records · ${slips.length} slips · ${challans.length} challans`,business:isObject(raw.business)?raw.business:undefined};
}
export function exportLegacyBackup(data:Data):string{
 const payload:Backup={schema:BACKUP_SCHEMA,exported_at:new Date().toISOString(),
  business:data.backupBusiness||{name:'S.A Traders'},
  data:{...(data.backupExtra||{}),bills:data.bills,customers:data.customers,
   customBills:data.customBills||[],slips:data.slips||[],challans:data.challans||[],
   inventory:data.inventory,settings:data.settings||[],nativeNotes:data.notes||[]}};
 return JSON.stringify(payload,null,2);
}
export function mergeBackup(current:Data,incoming:Data):Data{
 const merge=(a:Record<string,unknown>[],b:Record<string,unknown>[],key:string)=> {
  const result=[...a];const indexes=new Map(result.map((x,i)=>[String(x[key]??''),i]));
  for(const x of b){const id=String(x[key]??'');if(id&&indexes.has(id))result[indexes.get(id)!]={...result[indexes.get(id)!],...x};
   else{result.push(x);if(id)indexes.set(id,result.length-1);}}
  return result;
 };
 return {...current,
  bills:merge(current.bills,incoming.bills,'bill_no') as Bill[],
  customers:merge(current.customers,incoming.customers,'mobile') as Data['customers'],
  inventory:merge(current.inventory,incoming.inventory,'item') as Data['inventory'],
  customBills:merge(current.customBills||[],incoming.customBills||[],'bill_no'),
  slips:merge(current.slips||[],incoming.slips||[],'slip_no'),
  challans:merge(current.challans||[],incoming.challans||[],'challan_no'),
  settings:merge(current.settings||[],incoming.settings||[],'key'),
  backupBusiness:incoming.backupBusiness||current.backupBusiness,
  backupExtra:{...current.backupExtra,...incoming.backupExtra}};
}
