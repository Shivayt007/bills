import React,{useRef,useState} from 'react';
import {Alert,Text,View} from 'react-native';
import {captureRef} from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import {Bill,calculateBill,calculateCustom,calcRent,baseQty,baseWood,ratesOf,money,TODAY} from './domain';
import {Action,ui} from './WorkflowForms';
export function InvoiceImage({bill,custom}:{bill:Bill;custom:boolean}){
 const [shown,setShown]=useState(false),[busy,setBusy]=useState(false),ref=useRef<View>(null);const x=custom?calculateCustom(bill):calculateBill(bill),rent=calcRent(baseQty(bill),baseWood(bill),ratesOf(bill));
 const share=async()=>{setBusy(true);try{const uri=await captureRef(ref,{format:'png',quality:1,result:'tmpfile'});await Sharing.shareAsync(uri,{mimeType:'image/png',dialogTitle:'Share S.A Traders invoice image'});}catch(e){Alert.alert('Image sharing failed',String(e));}finally{setBusy(false);}};
 return <View><Action title={shown?'Hide invoice image preview':'Invoice image / WhatsApp'} onPress={()=>setShown(!shown)}/>{shown&&<><View ref={ref} collapsable={false} style={{backgroundColor:'white',padding:18,gap:8}}><Text style={ui.title}>S.A Traders</Text><Text style={ui.text}>Vijayanagaram, Gandhi Street, Medavakkam, Chennai{ '\n'}7904846694 / 9790894776</Text><Text style={ui.title}>{custom?'Custom Shop':'Rental'} #{bill.bill_no}</Text><Text style={ui.text}>{bill.name} · {bill.mobile}{'\n'}Site: {bill.place}{'\n'}Start: {bill.start_date} · {bill.cycle_days} days</Text>
 {rent.lines.filter(l=>l.qty>0).map(l=><Text key={l.key} style={ui.text}>{l.label} · {l.qty} × {money(l.rate)} = {money(l.amount)}</Text>)}
 {Object.values(rent.woods).filter(w=>w.pieces>0).map(w=><Text key={w.key} style={ui.text}>{w.label} · {w.text}{'\n'}{w.total_feet} ft × {money(w.rate)} = {money(w.amount)}</Text>)}
 {x.cycles.map(c=><Text key={c.index} style={ui.text}>#{c.index} {c.start_date} → {c.end_date}: {money(c.total)}</Text>)}
 <Text style={ui.text}>Transport / handling: {money(x.transport)}{'\n'}{custom?'Advance included':'Security deposit (separate)'}: {money(x.advance)}</Text><Text style={ui.title}>Due {money(x.due)}{'\n'}Paid {money(x.paid)}{'\n'}Pending {money(x.pending)}</Text>
 {(bill.payments||[]).map((p,i)=><Text key={p.payment_id||i} style={ui.text}>{p.payment_date||p.date} · {p.method||'Payment'} · {money(p.amount)}</Text>)}
 <Text style={ui.text}>Issued {TODAY()}. Full cycle rent applies. Damages / missing materials are settled separately.</Text><Text style={[ui.text,{marginTop:30}]}>Customer signature                 For S.A Traders</Text></View><Action disabled={busy} title={busy?'Preparing image…':'Share this invoice image'} onPress={()=>void share()}/></>}</View>;
}
