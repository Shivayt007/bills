import React,{useState} from 'react';
import {Alert,Text,TextInput,View,Pressable,StyleSheet,Switch} from 'react-native';
import {Bill,MATERIALS,WOODS,TODAY,calculateBill,physicalBalance,mapToText,num,money,cyclePaid,ItemChange} from './domain';
import {recordPayment,changeMaterial,audit} from './ledger';
export const ui=StyleSheet.create({box:{padding:16,backgroundColor:'white',borderWidth:1,borderColor:'#dce3eb',borderRadius:12,marginVertical:8},title:{fontSize:19,fontWeight:'800',color:'#142842',marginBottom:10},text:{fontSize:14,color:'#35485d',lineHeight:22},input:{minHeight:48,borderWidth:1,borderColor:'#bac7d5',borderRadius:8,padding:12,color:'#142842',backgroundColor:'#f8fafc',marginVertical:6},button:{minHeight:48,backgroundColor:'#143b5a',padding:12,borderRadius:8,alignItems:'center',justifyContent:'center',marginVertical:5},buttonText:{color:'white',fontSize:14,fontWeight:'700'},row:{flexDirection:'row',flexWrap:'wrap',gap:7}});
export function Action({title,onPress,disabled=false}:{title:string;onPress:()=>void;disabled?:boolean}){return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={[ui.button,disabled&&{opacity:.45}]}><Text style={ui.buttonText}>{title}</Text></Pressable>;}
export function Field({label,value,set,secure=false,numeric=false}:{label:string;value:string;set:(v:string)=>void;secure?:boolean;numeric?:boolean}){return <View><Text style={ui.text}>{label}</Text><TextInput style={ui.input} accessibilityLabel={label} value={value} onChangeText={set} secureTextEntry={secure} autoCapitalize="none" keyboardType={numeric?'decimal-pad':'default'}/></View>;}
export type Authorize=(title:string,fn:()=>Promise<void>)=>Promise<void>;
export function PaymentForm({bill,custom,save,cancel,working}:{bill:Bill;custom:boolean;save:(b:Bill)=>Promise<void>;cancel:()=>void;working:boolean}){
 const [amount,setAmount]=useState(''),[date,setDate]=useState(TODAY()),[method,setMethod]=useState('Cash'),[note,setNote]=useState(''),[cycle,setCycle]=useState(calculateBill(bill).cycles.length),[duplicate,setDuplicate]=useState(false);
 const x=calculateBill(bill),c=x.cycles.find(c=>c.index===cycle);
 const commit=async()=>{try{await save(recordPayment(bill,{amount,date,method,note,cycle,allowDuplicate:duplicate},custom));}catch(e){Alert.alert('Payment not saved',String(e));}};
 return <View style={ui.box}><Text style={ui.title}>Record payment</Text>
 {!custom&&<><Text style={ui.text}>Rental cycle</Text><View style={ui.row}>{x.cycles.map(c=><Action key={c.index} title={(cycle===c.index?'✓ ':'')+'#'+c.index} onPress={()=>setCycle(c.index)}/>)}</View></>}
 <Field label="Amount ₹" value={amount} set={setAmount} numeric/>
 <View style={ui.row}><Action title="Full pending" onPress={()=>setAmount(String(c?Math.min(x.pending,Math.max(0,c.total-cyclePaid(bill,c))):x.pending))}/><Action title="Half" onPress={()=>setAmount(String(Math.round((c?Math.min(x.pending,Math.max(0,c.total-cyclePaid(bill,c))):x.pending)*50)/100))}/></View>
 {num(amount)>x.pending&&<Text style={ui.text}>Payment exceeds current rental pending. The original app permits overpayment; the excess will be shown separately.</Text>}
 <Field label="Date YYYY-MM-DD" value={date} set={setDate}/><View style={ui.row}>{['Cash','UPI','Bank'].map(m=><Action key={m} title={(method===m?'✓ ':'')+m} onPress={()=>setMethod(m)}/>)}</View>
 <Field label="Note" value={note} set={setNote}/><Text style={ui.text}>I verified an intentional duplicate date / amount</Text><Switch value={duplicate} onValueChange={setDuplicate}/>
 <Action disabled={working} title="Save payment" onPress={()=>void commit()}/><Action title="Cancel" onPress={cancel}/></View>;
}
export function MaterialChangeForm({bill,type,save,cancel,working}:{bill:Bill;type:'return'|'addition';save:(b:Bill)=>Promise<void>;cancel:()=>void;working:boolean}){
 const [items,setItems]=useState<Record<string,string>>({}),[wood,setWood]=useState<Record<string,string>>({}),[date,setDate]=useState(TODAY()),[note,setNote]=useState('');const bal=physicalBalance(bill);
 const commit=async()=>{try{await save(changeMaterial(bill,type,date,Object.fromEntries(Object.entries(items).map(([k,v])=>[k,Number(v)])),wood,note));}catch(e){Alert.alert('Material change rejected',String(e));}};
 return <View style={ui.box}><Text style={ui.title}>{type==='return'?'Return materials':'Additional materials'}</Text><Field label="Date YYYY-MM-DD" value={date} set={setDate}/>
 {MATERIALS.map(([k,label])=><Field key={k} label={label+' · remaining '+bal.qty[k]} value={items[k]||''} numeric set={v=>setItems({...items,[k]:v})}/>)}
 {WOODS.map(([k,label])=><Field key={k} label={label+' · remaining '+(mapToText(bal.wood[k])||'0')} value={wood[k]||''} set={v=>setWood({...wood,[k]:v})}/>)}
 <Field label="Note" value={note} set={setNote}/><Text style={ui.text}>Changes affect the cycle after the chosen date's cycle. Existing cycle charges remain unchanged.</Text>
 <Action disabled={working} title="Save material change" onPress={()=>void commit()}/><Action title="Cancel" onPress={cancel}/></View>;
}
export function HistoryActions({bill,save,authorize,paymentsOnly=false}:{bill:Bill;save:(b:Bill)=>Promise<void>;authorize:Authorize;paymentsOnly?:boolean}){
 const [reason,setReason]=useState('');
 const removePayment=(index:number)=>void authorize('Delete payment',async()=>{
  if(!reason.trim())throw Error('Enter deletion reason');const p=bill.payments[index];if(p.receipt_key)throw Error('Use More → Split receipts → Correct receipt to preserve allocations and customer credit');
  const next=audit(bill,'deleted',p,reason);await save({...next,payments:bill.payments.filter((_,i)=>i!==index)});
 });
 const removeHistory=(key:'return_history'|'additional_history',index:number)=>void authorize('Delete history',async()=>{
  if(!reason.trim())throw Error('Enter deletion reason');const next={...bill,[key]:bill[key].filter((_,i)=>i!==index)};
  // Prevent history deletion from leaving physically impossible future returns.
  for(const [k] of MATERIALS){const available=num(next[k+'_qty'])+next.additional_history.reduce((s,h)=>s+num(h.items?.[k]),0)-next.return_history.reduce((s,h)=>s+num(h.items?.[k]),0);if(available<0)throw Error('Deletion would make material balance negative');}
  for(const [k] of WOODS){const balances=physicalBalance({...next,return_history:[]}).wood[k];const returned:Record<string,number>={};for(const h of next.return_history)for(const [ft,n] of Object.entries(h.wood?.[k]||{}))returned[ft]=(returned[ft]||0)+n;for(const [ft,n] of Object.entries(returned))if(n>num(balances[ft]))throw Error('Deletion would make wood balance negative');}
  await save({...next,history_audit:[...(Array.isArray(bill.history_audit)?bill.history_audit:[]),{action:'deleted',type:key,entry:bill[key][index],reason,at:new Date().toISOString()}]});
 });
 return <View style={ui.box}><Text style={ui.title}>{paymentsOnly?'Payment history':'Return and addition history'}</Text>
 <Field label="Reason for deleting an entry" value={reason} set={setReason}/>
 {paymentsOnly?(bill.payments||[]).map((p,i)=><View key={p.payment_id||p.id||i}><Text style={ui.text}>{p.payment_date||p.date} · {money(p.amount)} · {p.method} · {p.cycle_index?'Cycle #'+p.cycle_index:'Unassigned'}{p.receipt_key?' · Split receipt':''}</Text><Action title="Delete payment" onPress={()=>removePayment(i)}/></View>):
 (['return_history','additional_history'] as const).map(key=><View key={key}>{(bill[key]||[]).map((h,i)=><View key={h.rid||h.aid||i}><Text style={ui.text}>{key==='return_history'?'Return':'Addition'} · {h.date} · cycle #{h.effective_from_cycle}{'\n'}{MATERIALS.filter(([k])=>num(h.items?.[k])>0).map(([k,l])=>l+': '+h.items[k]).join(', ')}{'\n'}{WOODS.filter(([k])=>Object.keys(h.wood?.[k]||{}).length).map(([k,l])=>l+': '+mapToText(h.wood[k])).join(', ')}</Text><Action title="Delete history entry" onPress={()=>removeHistory(key,i)}/></View>)}</View>)}
 </View>;
}
