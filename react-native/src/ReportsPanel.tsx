import React,{useState} from 'react';
import {Alert,View,Text} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {Data,Bill,Payment,TODAY,calcRent,physicalBalance,ratesOf,historyTotals,baseQty,MATERIALS,WOODS,mapToText,mapSum,num,money,round2} from './domain';
import {Action,Field,ui} from './WorkflowForms';
import {documentHtml,esc,shareHtml} from './invoices';
export function ReportsPanel({data}:{data:Data}){
 const [from,setFrom]=useState(''),[to,setTo]=useState(TODAY()),[search,setSearch]=useState('');
 const bills=[...data.bills,...(data.customBills||[]).filter(b=>!b.converted_to_professional) as Bill[]];
 const rows=bills.flatMap(b=>(b.payments||[]).map(p=>({b,p,date:p.payment_date||p.date||''}))).filter(r=>(!from||r.date>=from)&&(!to||r.date<=to)&&(r.b.name+' '+r.b.mobile+' '+r.b.bill_no).toLowerCase().includes(search.toLowerCase())).sort((a,b)=>b.date.localeCompare(a.date));
 const active=data.bills.filter(b=>b.status!=='closed').map(b=>({b,balance:physicalBalance(b)}));
 const rent=round2(active.reduce((s,{b,balance})=>s+calcRent(balance.qty,balance.wood,ratesOf(b)).rent,0));
 const share=async(csv:boolean)=>{try{if(csv){const quote=(v:unknown)=>'"'+String(v??'').replaceAll('"','""')+'"';const text=[['Date','Bill','Customer','Mobile','Method','Amount','Cycle','Reference'],...rows.map(({b,p,date})=>[date,b.bill_no,b.name,b.mobile,p.method||'',p.amount,p.cycle_index||'',p.transaction_reference||''])].map(r=>r.map(quote).join(',')).join('\r\n');const uri=FileSystem.cacheDirectory+'sa-traders-payments.csv';await FileSystem.writeAsStringAsync(uri,'\uFEFF'+text);await Sharing.shareAsync(uri,{mimeType:'text/csv'});}else await shareHtml(documentHtml('Active material rent report','<p>Open bills: '+active.length+' · Physical rental value per cycle: '+money(rent)+'</p><table><tr><th>Bill / customer</th><th>Physical outstanding</th><th>Cycle rental value</th></tr>'+active.map(({b,balance})=>'<tr><td>'+esc(b.bill_no)+' · '+esc(b.name)+'</td><td>'+MATERIALS.map(([k,l])=>esc(l)+': '+balance.qty[k]).join('<br>')+'<br>'+WOODS.map(([k,l])=>esc(l)+': '+esc(mapToText(balance.wood[k]))).join('<br>')+'</td><td>'+money(calcRent(balance.qty,balance.wood,ratesOf(b)).rent)+'</td></tr>').join('')+'</table>'));}catch(e){Alert.alert('Report export failed',String(e));}};
 return <View style={ui.box}><Text style={ui.title}>Payment report</Text><Field label="From YYYY-MM-DD (blank = all)" value={from} set={setFrom}/><Field label="To YYYY-MM-DD" value={to} set={setTo}/><Field label="Customer / mobile / bill search" value={search} set={setSearch}/><Text style={ui.title}>{rows.length} payments · {money(rows.reduce((s,r)=>s+num(r.p.amount),0))}</Text>
 {rows.map(({b,p,date},i)=><Text key={p.payment_id||i} style={ui.text}>{date} · #{b.bill_no} · {b.name} · {p.method} · {money(p.amount)}</Text>)}<Action title="Export filtered payments CSV" onPress={()=>void share(true)}/>
 <Text style={ui.title}>Physical material tracker</Text>{MATERIALS.map(([k,label,q])=>{const issued=data.bills.reduce((s,b)=>s+num(baseQty(b)[k])+num(historyTotals(b.additional_history).mat[k]),0),returned=data.bills.reduce((s,b)=>s+num(historyTotals(b.return_history).mat[k]),0),remaining=data.bills.reduce((s,b)=>s+num(physicalBalance(b).qty[k]),0);return <Text key={k} style={ui.text}>{label}: issued {issued} · returned {returned} · remaining {remaining}</Text>;})}
 <Text style={ui.title}>Open material rental value {money(rent)}</Text><Action title="PDF active material rent report" onPress={()=>void share(false)}/>
 </View>;
}
