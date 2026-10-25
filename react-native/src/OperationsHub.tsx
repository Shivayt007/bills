import React,{useEffect,useState} from 'react';
import {Alert,Linking,Share,Switch,Text,View,Image} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Notifications from 'expo-notifications';
import {Data,Bill,calculateBill,calculateCustom,cyclePaid,money,num,TODAY} from './domain';
import {Action,Field,ui,Authorize} from './WorkflowForms';
import {allocateReceipt,Allocation,ReceiptInput,phone,uid} from './ledger';
import {reminders} from './reminders';
import {documentHtml,esc,shareHtml} from './invoices';
import {Candidate,paymentCandidates,openPaymentAccess,dismissCandidate,scheduleReminders,disableReminders,reminderHistory} from './device';
import {connectCloud,pullCloud,publishCloud,disconnectCloud} from './cloud';
import {configureWhatsApp,whatsappRequest} from './whatsapp';
import {exportLegacyBackup} from './legacyBackup';
const tabs=['Custom shop','Split receipts','Reminders','Documents','Cloud','WhatsApp','Settings'] as const;
async function run(fn:()=>Promise<unknown>){try{await fn();}catch(e){Alert.alert('Action failed',String(e));}}
export function OperationsHub({data,update,authorize,working,newCustom,openCustom}:{data:Data;update:(d:Data)=>Promise<void>;authorize:Authorize;working:boolean;newCustom:()=>void;openCustom:(b:Bill)=>void}){
 const [tab,setTab]=useState<typeof tabs[number]>('Custom shop');
 return <View><Text style={ui.title}>Business tools</Text><View style={ui.row}>{tabs.map(t=><Action title={(tab===t?'✓ ':'')+t} onPress={()=>setTab(t)} key={t}/>)}</View>
 {tab==='Custom shop'&&<View style={ui.box}><Action title="New Custom Shop bill" onPress={newCustom}/>{(data.customBills||[]).map(raw=>{const b=raw as Bill,x=calculateCustom(b);return <View key={b.bill_no}><Text style={ui.text}>#{b.bill_no} · {b.name} · {money(x.due)} total · {money(x.pending)} pending{b.converted_to_professional?' · Converted':''}</Text><Action title="View custom bill" onPress={()=>openCustom(b)}/></View>;})}</View>}
 {tab==='Split receipts'&&<Receipts data={data} update={update} authorize={authorize} working={working}/>}
 {tab==='Reminders'&&<Reminders data={data}/>}
 {tab==='Documents'&&<Documents data={data} update={update} authorize={authorize}/>}
 {tab==='Cloud'&&<Cloud data={data} update={update} authorize={authorize}/>}
 {tab==='WhatsApp'&&<WhatsApp/>}
 {tab==='Settings'&&<Settings data={data} update={update}/>}
 </View>;
}
function Receipts({data,update,authorize,working}:{data:Data;update:(d:Data)=>Promise<void>;authorize:Authorize;working:boolean}){
 const initial=():ReceiptInput=>({id:uid('receipt'),reference:'',amount:'',date:TODAY(),source:'UPI',mobile:'',name:'',credit:false});
 const [input,setInput]=useState<ReceiptInput>(initial),[values,setValues]=useState<Record<string,string>>({}),[review,setReview]=useState(false),[candidates,setCandidates]=useState<Candidate[]>([]);
 useEffect(()=>{void paymentCandidates().then(setCandidates).catch(()=>{});},[]);
 const change=(k:keyof ReceiptInput,v:any)=>{setInput({...input,[k]:v});setReview(false);};
 const rows:Array<{key:string;label:string;allocation:Allocation;capacity:number}>=[];
 for(const store of ['bills','customBills'] as const)for(const raw of data[store]||[]){const b=raw as Bill;if(phone(b.mobile)!==phone(input.mobile)||!input.mobile||b.converted_to_professional||b.status==='closed'&&!input.editKey)continue;
  const without={...b,payments:(b.payments||[]).filter(p=>p.receipt_key!==input.editKey)};const x=store==='bills'?calculateBill(without):calculateCustom(without);
  const cycles=store==='bills'?x.cycles:[{index:0,start_date:b.start_date,end_date:b.start_date,total:x.pending}];
  for(const c of cycles){const cap=store==='bills'?Math.min(x.pending,Math.max(0,c.total-cyclePaid(without,c as any))):x.pending;if(cap<=0)continue;const key=store+':'+b.bill_no+':'+c.index;rows.push({key,label:(store==='bills'?'Bill #':'Custom #')+b.bill_no+' · cycle '+c.index+' · up to '+money(cap),allocation:{store,bill_no:b.bill_no,cycle_index:c.index,amount:values[key]||''},capacity:cap});}
 }
 const save=async()=>{const next=allocateReceipt(data,input,rows.map(r=>r.allocation));if(!review){setReview(true);return;}await update(next);if(candidates.some(c=>c.id===input.id))await dismissCandidate(input.id);setInput(initial());setValues({});setReview(false);setCandidates(await paymentCandidates());Alert.alert('Receipt saved','Payment entries, customer credit and receipt history were saved together.');};
 const edit=(s:any)=>void authorize('Correct split receipt',async()=>{const r=s.value;setInput({id:r.item.id,reference:r.item.reference||'',amount:String(r.amount),date:r.payment_date,source:r.item.source,mobile:r.customer_mobile,name:r.customer_name,credit:r.credit>0,editKey:s.key,reason:''});setValues(Object.fromEntries(r.allocations.map((a:any)=>[a.store+':'+a.bill_no+':'+(a.cycle_index||0),String(a.amount)])));setReview(false);});
 return <View style={ui.box}><Text style={ui.title}>Payment receipt allocation</Text><Text style={ui.text}>Verify the bank receipt first. Detection is a suggestion; it does not prove settlement.</Text>
 <Action title="Enable Android payment notification access" onPress={openPaymentAccess}/><Action title="Refresh detected payments" onPress={()=>void run(async()=>setCandidates(await paymentCandidates()))}/>
 {candidates.map(c=><View key={c.id}><Text style={ui.text}>{c.source} · {money(c.amount)} · {c.reference}</Text><Action title="Review receipt" onPress={()=>{setInput({...initial(),id:c.id,reference:c.reference,amount:String(c.amount),source:c.source});setValues({});setReview(false);}}/><Action title="Ignore detection" onPress={()=>void run(async()=>{await dismissCandidate(c.id);setCandidates(await paymentCandidates());})}/></View>)}
 <Field label="Receipt / bank reference" value={input.reference} set={v=>change('reference',v)}/><Field label="Received ₹" value={input.amount} numeric set={v=>change('amount',v)}/><Field label="Receipt date YYYY-MM-DD" value={input.date} set={v=>change('date',v)}/>
 <Text style={ui.text}>Choose customer</Text><View style={ui.row}>{data.customers.map(c=><Action key={c.mobile} title={(phone(input.mobile)===phone(c.mobile)?'✓ ':'')+c.name} onPress={()=>{setInput({...input,mobile:c.mobile,name:c.name});setValues({});setReview(false);}}/>)}</View>
 {rows.map(r=><Field key={r.key} label={r.label} value={values[r.key]||''} numeric set={v=>{setValues({...values,[r.key]:v});setReview(false);}}/>)}
 <Text style={ui.text}>Keep remainder as customer credit</Text><Switch value={input.credit} onValueChange={v=>change('credit',v)}/>
 {input.editKey&&<Field label="Correction reason" value={input.reason||''} set={v=>change('reason',v)}/>}
 <Text style={ui.text}>Allocated {money(rows.reduce((s,r)=>s+num(r.allocation.amount),0))} · Remaining {money(num(input.amount)-rows.reduce((s,r)=>s+num(r.allocation.amount),0))}</Text>
 {review&&<Text style={[ui.text,{fontWeight:'800'}]}>Review confirmed values above. Tap Confirm receipt to record this allocation. No bank verification is performed by this app.</Text>}
 <Action disabled={working} title={review?'Confirm receipt and save':'Review split'} onPress={()=>void run(save)}/><Action title="Clear receipt form" onPress={()=>{setInput(initial());setValues({});setReview(false);}}/>
 <Text style={ui.title}>Saved receipts</Text>{(data.settings||[]).filter(s=>(s.value as any)?.kind==='split_payment_receipt').map(s=><View key={String(s.key)}><Text style={ui.text}>{String(s.key)} · {money((s.value as any).amount)} · credit {money((s.value as any).credit)}</Text><Action title="Correct receipt split" onPress={()=>edit(s)}/></View>)}
 </View>;
}
function Reminders({data}:{data:Data}){
 const [group,setGroup]=useState('overdue'),[history,setHistory]=useState<any[]>([]);const jobs=reminders(data);
 return <View style={ui.box}><Text style={ui.title}>Rental reminders</Text><View style={ui.row}>{['overdue','today','upcoming'].map(c=><Action key={c} title={c+' ('+jobs.filter(r=>r.category===c).length+')'} onPress={()=>setGroup(c)}/>)}</View>
 {jobs.filter(r=>r.category===group).map((r,i)=><View key={i}><Text style={ui.text}>{r.bill.name} · #{r.bill.bill_no} · {r.date} · {money(r.amount)}</Text><Action title="Share reminder / WhatsApp" onPress={()=>void run(()=>Share.share({message:'S.A Traders\nDear '+r.bill.name+', rental bill #'+r.bill.bill_no+' has '+money(r.amount)+' '+r.category+' on '+r.date+'. Please contact the shop for settlement.'}))}/><Action title="Call customer" onPress={()=>void run(()=>Linking.openURL('tel:'+phone(r.bill.mobile)))}/></View>)}
 <Action title="Enable / refresh daily reminders" onPress={()=>void run(async()=>{const n=await scheduleReminders(data);Alert.alert('Reminders scheduled',n+' reminder rows. Android may delay notifications. Open the app after bill changes to refresh scheduled amounts.');})}/><Action title="Disable scheduled reminders" onPress={()=>void run(disableReminders)}/>
 <Action title="Notification history" onPress={()=>void run(async()=>setHistory(await reminderHistory()))}/>{history.slice(-30).reverse().map((h,i)=><Text key={i} style={ui.text}>{h.date} · {h.name} · {h.text}</Text>)}
 </View>;
}
function Documents({data,update,authorize}:{data:Data;update:(d:Data)=>Promise<void>;authorize:Authorize}){
 const [store,setStore]=useState<'slips'|'challans'>('slips'),[json,setJson]=useState(''),[original,setOriginal]=useState('');const key=store==='slips'?'slip_no':'challan_no';
 const save=async()=>{const v=JSON.parse(json);if(!v||Array.isArray(v)||typeof v!=='object'||!String(v[key]||'').trim())throw Error('A document with '+key+' is required');const rows=data[store]||[];if(!original&&rows.some(x=>x[key]===v[key]))throw Error('Duplicate document number');await update({...data,[store]:[...rows.filter(x=>x[key]!==original),v]});setJson('');setOriginal('');};
 return <View style={ui.box}><Text style={ui.title}>Delivery slips and challans</Text><Text style={ui.text}>Structured records preserve all fields from imported documents. Edit the JSON fields below to retain legacy material data.</Text><View style={ui.row}><Action title="Delivery slips" onPress={()=>{setStore('slips');setJson('');}}/><Action title="Challans" onPress={()=>{setStore('challans');setJson('');}}/></View>
 {(data[store]||[]).map((d,i)=><View key={String(d[key]||i)}><Text style={ui.text}>{String(d[key])} · {String(d.name||d.customer||'')}</Text><Action title="Edit document" onPress={()=>{setOriginal(String(d[key]));setJson(JSON.stringify(d,null,2));}}/><Action title="PDF / WhatsApp document" onPress={()=>void run(()=>shareHtml(documentHtml(store==='slips'?'Delivery slip':'Challan','<table>'+Object.entries(d).map(([k,v])=>'<tr><th>'+esc(k)+'</th><td>'+esc(typeof v==='object'?JSON.stringify(v):v)+'</td></tr>').join('')+'</table>')))}/><Action title="Delete document" onPress={()=>void authorize('Delete document',async()=>{await update({...data,[store]:(data[store]||[]).filter(x=>x[key]!==d[key])});})}/></View>)}
 <Action title="New document" onPress={()=>{setOriginal('');setJson(JSON.stringify({[key]:uid(store),date:TODAY(),name:'',mobile:'',place:'',items:{},wood:{},notes:''},null,2));}}/>
 {!!json&&<><Field label="Document JSON" value={json} set={setJson}/><Action title="Save structured document" onPress={()=>void run(save)}/></>}
 </View>;
}
function Cloud({data,update,authorize}:{data:Data;update:(d:Data)=>Promise<void>;authorize:Authorize}){
 const [config,setConfig]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[status,setStatus]=useState('Disconnected');
 const safety=async()=>{if(!FileSystem.documentDirectory)throw Error('Storage unavailable');await FileSystem.writeAsStringAsync(FileSystem.documentDirectory+'before-cloud-'+Date.now()+'.json',exportLegacyBackup(data));};
 return <View style={ui.box}><Text style={ui.title}>Firebase synchronization</Text><Text style={ui.text}>{status}. Cloud is optional. Use an authenticated test project first. Existing unauthenticated rules must be replaced by server rules before live deployment.</Text><Field label="Firebase web config JSON" value={config} set={setConfig}/><Field label="Firebase email" value={email} set={setEmail}/><Field label="Password" value={password} set={setPassword} secure/>
 <Action title="Sign in to configured project" onPress={()=>void run(async()=>{const project=await connectCloud(config,email,password);setPassword('');setStatus('Connected: '+project);})}/>
 <Action title="Pull cloud records (replace local after backup)" onPress={()=>void authorize('Pull cloud data',async()=>{Alert.alert('Replace local ledger with cloud snapshot?','A local safety backup will be saved first. Export local changes before continuing.',[{text:'Cancel',style:'cancel'},{text:'Pull',onPress:()=>void run(async()=>{await safety();const d=await pullCloud();await update(d);Alert.alert('Cloud snapshot loaded');})}]);})}/>
 <Action title="Publish reviewed local changes" onPress={()=>void authorize('Publish to Firebase',async()=>{Alert.alert('Publish local ledger changes?','Changes are checked against the last pulled cloud records. Conflicts abort the full transaction. Cloud deletion is disabled.',[{text:'Cancel',style:'cancel'},{text:'Publish',onPress:()=>void run(async()=>{const n=await publishCloud(data);Alert.alert('Cloud commit acknowledged',n+' records written');})}]);})}/>
 <Action title="Disconnect" onPress={()=>void run(async()=>{await disconnectCloud();setStatus('Disconnected');})}/>
 </View>;
}
function WhatsApp(){
 const [url,setUrl]=useState(''),[token,setToken]=useState(''),[to,setTo]=useState(''),[bill,setBill]=useState(''),[message,setMessage]=useState(''),[status,setStatus]=useState<any>(null),[requestId,setRequestId]=useState(uid('reminder-request'));
 const changeMessage=(v:string)=>{setMessage(v);setRequestId(uid('reminder-request'));};
 return <View style={ui.box}><Text style={ui.title}>WhatsApp service</Text><Text style={ui.text}>Connect the existing separate reminder service. Invoice sharing uses the Android share sheet. An accepted API response does not prove customer delivery.</Text><Field label="Service HTTPS URL" value={url} set={setUrl}/><Field label="Bearer token" value={token} set={setToken} secure/><Action title="Save service settings" onPress={()=>void run(async()=>{await configureWhatsApp(url,token);setToken('');Alert.alert('Configuration saved securely');})}/><Action title="Connection status / QR" onPress={()=>void run(async()=>setStatus(await whatsappRequest('/v1/status')))}/>
 {status&&<><Text style={ui.text}>{JSON.stringify(status,null,2)}</Text>{status.qr&&String(status.qr).startsWith('data:image/')&&<Image source={{uri:status.qr}} style={{width:220,height:220}}/>}</>}
 <Field label="Recipient / pairing mobile with country code" value={to} set={v=>{setTo(v);setRequestId(uid('reminder-request'));}}/><Action title="Request phone pairing code" onPress={()=>void run(async()=>setStatus(await whatsappRequest('/v1/link',{phone:to})))}/>
 <Field label="Bill number" value={bill} set={v=>{setBill(v);setRequestId(uid('reminder-request'));}}/><Field label="Preview / edit message" value={message} set={changeMessage}/>
 <Action title="Submit reviewed reminder" onPress={()=>Alert.alert('Send WhatsApp reminder?',message+'\nTo: '+to,[{text:'Cancel',style:'cancel'},{text:'Send',onPress:()=>void run(async()=>{const result=await whatsappRequest('/v1/reminders',{requestId,to,billNo:bill,message});setStatus(result);Alert.alert('Service response',result.accepted?'Accepted by service. Customer delivery is not confirmed.':'Check service response');})}])}/><Text style={ui.text}>Retry keeps the same request ID. If the outcome is uncertain, check the chat before changing the message or creating a new request.</Text>
 </View>;
}
function Settings({data,update}:{data:Data;update:(d:Data)=>Promise<void>}){
 const value=(k:string)=>String((data.settings||[]).find(s=>s.key===k)?.value||'');const [terms,setTerms]=useState(value('terms_invoice'));
 return <View style={ui.box}><Text style={ui.title}>Invoice terms</Text><Field label="Invoice terms" value={terms} set={setTerms}/><Action title="Save invoice terms" onPress={()=>void run(()=>update({...data,settings:[...(data.settings||[]).filter(s=>s.key!=='terms_invoice'),{key:'terms_invoice',value:terms}]}))}/><Text style={ui.text}>Developed by Shiva · S.A Traders React Native</Text></View>;
}
