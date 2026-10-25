import React,{useEffect,useMemo,useState} from 'react';
import {
 Alert,ActivityIndicator,KeyboardAvoidingView,Platform,Pressable,SafeAreaView,
 ScrollView,Share,StatusBar,StyleSheet,Text,TextInput,View,
} from 'react-native';
import {calculateBill,Customer,Data,EMPTY,invoiceText,makeBill,MATERIALS,money,
 num,Note,RATES,round2,Stock,TODAY,validateBill,WOODS,Bill} from './domain';
import {clearLocal,loadLocal,saveLocal} from './localStore';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {parseLegacyBackup,exportLegacyBackup,mergeBackup} from './legacyBackup';
import {BillHero,BillCycleDetails,BillMaterialDetails,CustomerMaterialSummary,
 MetricCard,QuantityEditor,QuickAction,SectionHeader,Segments} from './ProfessionalUI';
import type {BillTab,FormSection} from './ProfessionalUI';

// Fully native React Native views. No WebView, Java billing screen, or external website.
// Isolated local test records, NOT connected to production Firestore.
type Page='dashboard'|'bills'|'customers'|'customer-detail'|'inventory'|'reports'|'more'|'form'|'detail'|'customer-form'|'stock-form'|'note-form';
const C={bg:'#F5F8FC',white:'#FFFFFF',ink:'#142842',sub:'#6B7D90',line:'#E4EBF2',navy:'#072944',peach:'#F27B18',light:'#FFF2E1',green:'#049768'};
const TABS:ReadonlyArray<[Page,string,string]>=[['dashboard','Home','⌂'],['bills','Bills','▤'],['customers','Clients','♙'],['inventory','Stock','▦'],['more','More','•••']];
const txt=(v:unknown)=>String(v??'');
const uid=()=>String(Date.now())+'-'+Math.random().toString(36).slice(2,6);
function Button({label,onPress,outline=false,disabled=false}:{label:string;onPress:()=>void;outline?:boolean;disabled?:boolean}) {
 return <Pressable disabled={disabled} accessibilityRole="button" onPress={onPress} style={[s.button,outline&&s.buttonOutline,disabled&&{opacity:.4}]}>
  <Text style={[s.buttonText,outline&&{color:C.ink}]}>{label}</Text></Pressable>;
}
function Input({label,value,onChange,numeric=false,placeholder='',multiline=false,locked=false}:{
 label:string;value:unknown;onChange:(v:string)=>void;numeric?:boolean;placeholder?:string;multiline?:boolean;locked?:boolean}) {
 return <View style={s.inputWrap}><Text style={s.inputLabel}>{label}</Text>
  <TextInput accessibilityLabel={label} editable={!locked} value={txt(value)} onChangeText={onChange}
   keyboardType={numeric?'decimal-pad':'default'} multiline={multiline} placeholder={placeholder}
   placeholderTextColor="#9EAAB8" style={[s.input,multiline&&{height:85,textAlignVertical:'top'},locked&&{opacity:.5}]}/></View>;
}
function Card({children}:{children:React.ReactNode}){return <View style={s.card}>{children}</View>;}
function Stat({label,value,accent=false}:{label:string;value:string;accent?:boolean}) {
 return <View style={[s.stat,accent&&{backgroundColor:C.navy}]}><Text style={[s.statValue,accent&&{color:'white'}]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
  <Text style={[s.statLabel,accent&&{color:'#BCCCD9'}]}>{label}</Text></View>;
}
function Head({title,subtitle}:{title:string;subtitle:string}){return <View style={{marginBottom:17}}><Text style={s.heading}>{title}</Text><Text style={s.subtitle}>{subtitle}</Text></View>;}
export default function App(){
 const [data,setData]=useState<Data>(EMPTY),[loaded,setLoaded]=useState(false);
 const [page,setPage]=useState<Page>('dashboard'),[query,setQuery]=useState('');
 const [formSection,setFormSection]=useState<FormSection>('materials');
 const [detailTab,setDetailTab]=useState<BillTab>('materials');
 const [selectedCustomer,setSelectedCustomer]=useState('');
 const [customerTab,setCustomerTab]=useState<'history'|'materials'>('history');
 const [billFilter,setBillFilter]=useState<'all'|'open'|'closed'>('all');
 const [selected,setSelected]=useState(''),[draft,setDraft]=useState<Bill>(makeBill());
 const [customerDraft,setCustomerDraft]=useState<Customer>({name:'',mobile:'',place:''});
 const [stockDraft,setStockDraft]=useState<Stock>({item:'jackey',stock_qty:0});
 const [noteDraft,setNoteDraft]=useState<Note>({id:'',customer:'',date:TODAY(),notes:'',type:'slip'});
 const [amount,setAmount]=useState(''),[paymentNote,setPaymentNote]=useState('');
 const [changeQty,setChangeQty]=useState(''),[changeKey,setChangeKey]=useState('jackey'),[modal,setModal]=useState<'payment'|'return'|'addition'|null>(null);
 const [working,setWorking]=useState(false);
 useEffect(()=>{loadLocal().then(d=>setData(d)).catch(e=>Alert.alert('Local storage error',txt(e))).finally(()=>setLoaded(true));},[]);
 const update=async(next:Data)=>{
  setWorking(true);try{await saveLocal(next);setData(next);}
  catch(e){Alert.alert('Save failed',txt(e));}finally{setWorking(false);}
 };
 const importBackup=async()=>{
  try{
   const chosen=await DocumentPicker.getDocumentAsync({type:['application/json','text/plain','*/*'],copyToCacheDirectory:true});
   if(chosen.canceled||!chosen.assets?.length)return;
   const asset=chosen.assets[0];
   if(asset.size&&asset.size>15_000_000)throw Error('Backup file exceeds 15 MB');
   const json=await FileSystem.readAsStringAsync(asset.uri);
   const parsed=parseLegacyBackup(json);
   Alert.alert('Preview backup import',parsed.summary+'\n\nChoose Merge to keep existing local records, or Replace to overwrite LOCAL test data. A safety backup will be saved first. This does not write to Firebase.',[
     {text:'Cancel',style:'cancel'},
     {text:'Merge local records',onPress:()=>{void applyBackup(mergeBackup(data,parsed.data));}},
     {text:'Replace local records',style:'destructive',onPress:()=>Alert.alert('Confirm local replacement','All existing local test records will be replaced. Your real Firestore database will not be changed.',[
       {text:'Cancel',style:'cancel'}, {text:'Replace local records',style:'destructive',onPress:()=>{void applyBackup(parsed.data);}}
     ])}
   ]);
  }catch(e){Alert.alert('Import rejected',txt(e instanceof Error?e.message:e));}
 };
 const applyBackup=async(next:Data)=>{
  if(working){Alert.alert('Operation busy','Complete the current save before importing');return;}
  setWorking(true);
  try{
   const folder=FileSystem.documentDirectory;
   if(!folder)throw Error('App document storage unavailable');
   const safety=folder+'sa-traders-before-import-'+Date.now()+'.json';
   await FileSystem.writeAsStringAsync(safety,exportLegacyBackup(data));
   await saveLocal(next);
   setData(next);
   Alert.alert('Local import completed','All imported values and payment records were preserved for review. A safety copy was saved in app documents; export a separate copy before uninstalling. Imported figures are NOT certified for live billing.');
  }catch(e){Alert.alert('Import failed',txt(e));}
  finally{setWorking(false);}
 };
 const exportBackup=async()=>{
  try{
   const folder=FileSystem.cacheDirectory;
   if(!folder)throw Error('App cache is unavailable');
   const uri=folder+'sa-traders-native-backup-'+TODAY()+'.json';
   await FileSystem.writeAsStringAsync(uri,exportLegacyBackup(data));
   if(await Sharing.isAvailableAsync())await Sharing.shareAsync(uri,{mimeType:'application/json',dialogTitle:'Save S.A Traders local JSON backup'});
   else Alert.alert('Backup created',uri);
  }catch(e){Alert.alert('Backup export failed',txt(e));}
 };
 const navigate=(next:Page)=>{setPage(next);setQuery('');setModal(null);};
 const openBill=(id:string)=>{setSelected(id);setDetailTab('materials');navigate('detail');};
 const newBill=()=>{setSelected('');setDraft(makeBill());setFormSection('materials');navigate('form');};
 const editBill=(b:Bill)=>{setSelected(b.bill_no);setDraft({...b});setFormSection('materials');navigate('form');};
 const selectedBill=data.bills.find(b=>b.bill_no===selected);
 const totals=useMemo(()=>{
  const active=data.bills.filter(b=>b.status!=='closed');
  const t=active.map(b=>calculateBill(b));return {
   active:active.length,due:round2(t.reduce((v,x)=>v+x.due,0)),
   paid:round2(t.reduce((v,x)=>v+x.paid,0)),pending:round2(t.reduce((v,x)=>v+x.pending,0))
  };
 },[data.bills]);
 const found=data.bills.filter(b=>(billFilter==='all'||b.status===billFilter)&&
 (b.bill_no+' '+b.name+' '+b.mobile+' '+b.place).toLowerCase().includes(query.toLowerCase()));
 const customers=data.customers.filter(c=>(c.name+' '+c.mobile+' '+c.place).toLowerCase().includes(query.toLowerCase()));
 const saveBill=async()=>{
  try{
   const cleaned:Bill={...draft,bill_no:draft.bill_no.trim(),name:draft.name.trim(),cycle_days:num(draft.cycle_days)};
   validateBill(cleaned,data.bills,selected||undefined);
   const nextBills=selected?data.bills.map(b=>b.bill_no===selected?cleaned:b):[cleaned,...data.bills];
   let cust=data.customers;
   if(cleaned.mobile&&!cust.some(x=>x.mobile===cleaned.mobile))cust=[{mobile:cleaned.mobile,name:cleaned.name,place:cleaned.place},...cust];
   await update({...data,bills:nextBills,customers:cust});
   setSelected(cleaned.bill_no);navigate('detail');
  }catch(e){Alert.alert('Check bill details',txt(e instanceof Error?e.message:e));}
 };
 const saveCustomer=async()=>{
  if(!customerDraft.name.trim()||!customerDraft.mobile.trim()){Alert.alert('Missing details','Customer name and mobile are required');return;}
  const copy={...customerDraft,name:customerDraft.name.trim(),mobile:customerDraft.mobile.trim()};
  const idx=data.customers.findIndex(c=>c.mobile===copy.mobile);
  const rows=idx>=0?data.customers.map(c=>c.mobile===copy.mobile?copy:c):[copy,...data.customers];
  await update({...data,customers:rows});navigate('customers');
 };
 const saveStock=async()=>{
  if(!stockDraft.item.trim()){Alert.alert('Item is required');return;}
  const arr=data.inventory.filter(x=>x.item!==stockDraft.item);
  await update({...data,inventory:[...arr,{...stockDraft,stock_qty:Math.max(0,num(stockDraft.stock_qty))}]});
  navigate('inventory');
 };
 const saveNote=async()=>{
  if(!noteDraft.customer.trim()){Alert.alert('Customer is required');return;}
  await update({...data,notes:[{...noteDraft,id:noteDraft.id||uid()},...data.notes.filter(n=>n.id!==noteDraft.id)]});
  navigate('more');
 };
 const recordChange=async()=>{
  if(!selectedBill)return;
  const amountValue=num(amount),qtyValue=num(changeQty);
  if(modal==='payment'){
   const x=calculateBill(selectedBill);
   if(!(amountValue>0)||amountValue>x.pending){Alert.alert('Invalid payment','Enter a positive amount no larger than the pending balance.');return;}
   const b={...selectedBill,payments:[...(selectedBill.payments||[]),{id:uid(),date:TODAY(),amount:round2(amountValue),note:paymentNote}]};
   await update({...data,bills:data.bills.map(v=>v.bill_no===b.bill_no?b:v)});
  }else if(modal){
   if(!Number.isInteger(qtyValue)||qtyValue<=0){Alert.alert('Invalid quantity','Enter a positive whole number.');return;}
   const hist=modal==='return'?'return_history':'additional_history';
   const nowCycle=calculateBill(selectedBill).cycles.length;
   const entry={date:TODAY(),items:{[changeKey]:qtyValue},wood:{},effective_from_cycle:nowCycle+1};
   const b={...selectedBill,[hist]:[...(selectedBill[hist]||[]),entry]} as Bill;
   await update({...data,bills:data.bills.map(v=>v.bill_no===b.bill_no?b:v)});
  }
  setModal(null);setAmount('');setPaymentNote('');setChangeQty('');
 };
 const confirmClose=(b:Bill)=>Alert.alert('Close bill','Close this bill today? Future rental cycles stop accruing.',[
  {text:'Cancel',style:'cancel'},{text:'Close bill',onPress:()=>{void update({...data,bills:data.bills.map(v=>v.bill_no===b.bill_no?{...v,status:'closed' as const,closed_at:TODAY()}:v)});}}
 ]);
 const confirmReset=()=>Alert.alert('Delete all local test records?','This removes only the React Native test app data. Production S.A Traders is not affected.',[
  {text:'Cancel',style:'cancel'},{text:'Delete local records',style:'destructive',onPress:()=>{void clearLocal().then(()=>setData({bills:[],customers:[],inventory:[],notes:[]})).catch(e=>Alert.alert('Delete failed',txt(e)));}}
 ]);
 const formUpdate=(key:string,value:string)=>setDraft(v=>({...v,[key]:value}));
 if(!loaded)return <SafeAreaView style={s.safe}><ActivityIndicator size="large" style={{flex:1}} color={C.peach}/></SafeAreaView>;
 return <SafeAreaView style={s.safe}><StatusBar barStyle="dark-content" backgroundColor={C.bg}/>
 <View style={s.top}><View style={s.logo}><Text style={s.logoText}>SA</Text></View><View style={{flex:1}}>
  <Text style={s.brandName}>S.A Traders</Text><Text style={s.brandSub}>MATERIAL RENTAL SOLUTIONS</Text>
 </View><View style={s.mode}><Text style={s.modeText}>RN</Text></View></View>
 <View style={s.banner}><Text style={s.bannerText}>NATIVE UI · LOCAL TEST MODE · NOT CONNECTED TO LIVE FIRESTORE</Text></View>
 <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
  <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
   {page==='dashboard'&&<>
    <SectionHeader title="Business overview" subtitle="Monitor rentals and collections at a glance"/>
    <View style={{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between'}}>
     <MetricCard label="Active bills" value={txt(totals.active)} color="blue"/>
     <MetricCard label="Total pending" value={money(totals.pending)} color="red"/>
     <MetricCard label="Collected" value={money(totals.paid)} color="green"/>
     <MetricCard label="Customers" value={txt(data.customers.length)} color="orange"/>
    </View>
    <SectionHeader title="Quick actions" subtitle="Start a task with one tap"/>
    <View style={{flexDirection:'row'}}>
     <QuickAction label="New Bill" icon="▤" color="#EAF3FF" onPress={newBill}/>
     <QuickAction label="Customers" icon="♙" color="#E4F6EF" onPress={()=>navigate('customers')}/>
     <QuickAction label="Payments" icon="₹" color="#FFF0DF" onPress={()=>navigate('bills')}/>
    </View><View style={{flexDirection:'row'}}>
     <QuickAction label="Returns" icon="↩" color="#FFE6E6" onPress={()=>navigate('bills')}/>
     <QuickAction label="Challans" icon="▧" color="#EDF0FF" onPress={()=>navigate('more')}/>
     <QuickAction label="Reports" icon="▥" color="#E6F5F4" onPress={()=>navigate('reports')}/>
    </View>
    <SectionHeader title="Recent rental bills" subtitle="Select an invoice to view materials and cycles" trailing="See all" onTrailing={()=>navigate('bills')}/>
    {data.bills.length===0?<Card><Text style={s.empty}>No rental bills saved in this local workspace. Use New Bill to begin.</Text></Card>:
     data.bills.slice(0,5).map(b=><BillTile key={b.bill_no} b={b} onPress={()=>openBill(b.bill_no)}/>)}
   </>}
   {page==='bills'&&<>
    <Head title="Bills & invoices" subtitle="A clear history of every rental cycle"/>
    <Button label="＋ Create a new rental bill" onPress={newBill}/>
    <View style={{height:12}}/>
    <Segments items={[{value:'all',label:'All'},{value:'open',label:'Open'},{value:'closed',label:'Closed'}]}
     value={billFilter} onChange={setBillFilter}/>
    <Search value={query} onChange={setQuery} placeholder="Search bill number / customer / phone"/>
    <SectionHeader title={'Invoices ('+found.length+')'} subtitle="Tap a bill to view materials and payment history"/>
    {found.length===0?<Card><Text style={s.empty}>No bills match this filter.</Text></Card>:
     found.map(b=><BillTile key={b.bill_no} b={b} onPress={()=>openBill(b.bill_no)}/>)}
   </>}
   {page==='form'&&<>
    <Head title={selected?'Edit rental bill':'New rental bill'} subtitle="Fast billing · clear quantities · transparent totals"/>
    <Card>
     <SectionHeader title="Customer & cycle" subtitle="Invoice details and rental period"/>
     {data.customers.length>0&&<View style={{marginBottom:12}}>
      <Text style={s.inputLabel}>Choose existing customer</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>{data.customers.slice(0,12).map(c=>
       <Pressable key={c.mobile} style={s.customerChip}
        onPress={()=>setDraft(v=>({...v,name:c.name,mobile:c.mobile,place:c.place}))}>
        <Text style={s.customerChipText}>{c.name}</Text></Pressable>)}</ScrollView></View>}
     <Input label="Bill number *" value={draft.bill_no} onChange={x=>formUpdate('bill_no',x)} locked={!!selected}/>
     <Input label="Customer name *" value={draft.name} onChange={x=>formUpdate('name',x)}/>
     <View style={s.twoColumns}>
      <View style={{flex:1}}><Input label="Mobile" value={draft.mobile} onChange={x=>formUpdate('mobile',x)}/></View>
      <View style={{flex:1}}><Input label="Site / location" value={draft.place} onChange={x=>formUpdate('place',x)}/></View>
     </View>
     <Input label="Start date (YYYY-MM-DD)" value={draft.start_date} onChange={x=>formUpdate('start_date',x)}/>
     <Text style={s.inputLabel}>Rental cycle</Text>
     <View style={s.choiceRow}>{[15,20,30].map(days=><Pressable key={days}
       accessibilityRole="button" accessibilityState={{selected:num(draft.cycle_days)===days}}
       style={[s.choice,num(draft.cycle_days)===days&&s.selectedChoice]}
       onPress={()=>setDraft(x=>({...x,cycle_days:days}))}>
       <Text style={[s.choiceText,num(draft.cycle_days)===days&&{color:'white'}]}>{days} days</Text></Pressable>)}</View>
    </Card>
    <SectionHeader title="Rental materials" subtitle="Tap + / − to adjust quantities, or edit manually"/>
    <Segments<FormSection> items={[{value:'materials',label:'Materials'},{value:'wood',label:'Wood'},{value:'charges',label:'Charges'}]}
       value={formSection} onChange={setFormSection}/>
    {formSection==='materials'&&<Card>
     <View style={s.columnHeader}><Text style={s.columnLabel}>ITEM / RATE</Text><Text style={s.columnLabel}>QTY</Text><Text style={s.columnLabel}>AMOUNT</Text></View>
     {MATERIALS.map(([key,label,q,r])=><QuantityEditor key={key} label={label}
       quantity={Math.max(0,Math.trunc(num(draft[q])))} rate={num(draft[r])}
       onQtyChange={value=>formUpdate(q,value)} onRateChange={value=>formUpdate(r,value)}
       onIncrease={()=>setDraft(old=>({...old,[q]:Math.max(0,Math.trunc(num(old[q])))+1}))}
       onDecrease={()=>setDraft(old=>({...old,[q]:Math.max(0,Math.trunc(num(old[q]))-1)}))}/>)}
    </Card>}
    {formSection==='wood'&&<Card>
     <Text style={s.note}>Enter feet × pieces, for example 8×5+10×2.</Text>
     {WOODS.map(([k,label,r])=><View key={k}><SectionHeader title={label}/>
      <Input label="Feet × pieces" value={draft[k]} placeholder="8×5+10×2" onChange={value=>formUpdate(k,value)}/>
      <Input label="Rental rate (₹ per foot)" value={draft[r]} numeric onChange={value=>formUpdate(r,value)}/>
     </View>)}
    </Card>}
    {formSection==='charges'&&<Card>
      <Input label="Up trips" value={draft.transport_up_trips} numeric onChange={v=>formUpdate('transport_up_trips',v)}/>
      <Input label="Up trip charge (₹)" value={draft.transport_up_charge} numeric onChange={v=>formUpdate('transport_up_charge',v)}/>
      <Input label="Down trips" value={draft.transport_down_trips} numeric onChange={v=>formUpdate('transport_down_trips',v)}/>
      <Input label="Down trip charge (₹)" value={draft.transport_down_charge} numeric onChange={v=>formUpdate('transport_down_charge',v)}/>
      <Input label="Loading (₹)" value={draft.loading_charge} numeric onChange={v=>formUpdate('loading_charge',v)}/>
      <Input label="Unloading (₹)" value={draft.unloading_charge} numeric onChange={v=>formUpdate('unloading_charge',v)}/>
      <Input label="Security advance (₹)" value={draft.advance_amount} numeric onChange={v=>formUpdate('advance_amount',v)}/>
      <Text style={s.note}>Transport applies only to the first rental cycle. Advance is a separate security deposit.</Text>
    </Card>}
    <View style={s.fastTotal}><Text style={s.fastTotalLabel}>Current rental total</Text>
      <Text style={s.fastTotalValue}>{money(calculateBill(draft).due)}</Text></View>
    <Text style={s.note}>Offline local calculation only. Not yet verified for production billing.</Text>
    <Button label={working?'Saving…':selected?'Save changes':'Save rental bill'} disabled={working} onPress={()=>void saveBill()}/>
    <View style={{height:9}}/><Button outline label="Cancel" onPress={()=>navigate(selected?'detail':'bills')}/>
   </>}
   {page==='detail'&&selectedBill&&(()=>{
    const b=selectedBill,v=calculateBill(b);
    const sameCustomer=data.bills.filter(x=>(b.mobile&&x.mobile===b.mobile)||(!b.mobile&&x.name===b.name));
    return <>
     <View style={s.billHeader}><Pressable accessibilityRole="button" onPress={()=>navigate('bills')}><Text style={s.billBack}>‹</Text></Pressable>
      <View style={{flex:1}}><Text style={s.billHeadTitle}>Bill #{b.bill_no}</Text><Text style={s.billHeadSub}>{b.name} · {b.mobile||'No phone'}</Text></View>
      <View style={s.billStatus}><Text style={s.billStatusText}>{b.status==='open'?'Active':'Closed'}</Text></View>
     </View>
     <View style={s.billCustomer}>
      <View style={s.customerIcon}><Text style={s.customerInitial}>{b.name.slice(0,1).toUpperCase()}</Text></View>
      <View style={{flex:1}}><Text style={s.billCustomerName}>{b.name}</Text>
       <Text style={s.billHeadSub}>{b.place||'No site'} · Started {b.start_date}</Text></View>
     </View>
     <BillHero bill={b}/>
     <View style={s.detailActionRow}>
      {b.status==='open'&&<Button label="＋ Record Payment" onPress={()=>{setModal('payment');setDetailTab('payments');setAmount('');}}/>}
      <Button outline label="Edit Bill" onPress={()=>editBill(b)}/>
      <Button outline label="Share" onPress={()=>{void Share.share({message:invoiceText(b)});}}/>
     </View>
     <Segments<BillTab> value={detailTab} onChange={setDetailTab}
      items={[{value:'materials',label:'Materials'},{value:'cycles',label:'Cycles'},{value:'all',label:'All Material'},{value:'payments',label:'Payments'}]}/>
     {detailTab==='materials'&&<><SectionHeader title="Bill materials" subtitle="Material, quantity, rate and amount"/>
      <BillMaterialDetails bill={b} showAll/>
      <Card><Line label="Security advance" value={money(v.advance)}/><Line label="Transport (first cycle)" value={money(v.transport)}/>
       <Line label="Total received" value={money(v.paid)}/><Line label="Pending amount" value={money(v.pending)}/></Card>
      {b.status==='open'&&<View style={s.detailActionRow}>
       <Button outline label="↩ Return Items" onPress={()=>{setModal('return');setChangeQty('');}}/>
       <Button outline label="＋ Add Material" onPress={()=>{setModal('addition');setChangeQty('');}}/>
      </View>}
     </>}
     {detailTab==='cycles'&&<><SectionHeader title="Rental cycle history" subtitle={b.cycle_days+'-day cycles · individual totals'}/>
       <BillCycleDetails bill={b}/></>}
     {detailTab==='all'&&<><SectionHeader title="All materials for customer" subtitle={sameCustomer.length+' related bill(s) · '+b.name}/>
       <CustomerMaterialSummary bills={sameCustomer}/>
       {sameCustomer.map(other=><BillTile key={other.bill_no} b={other} onPress={()=>openBill(other.bill_no)}/>)}</>}
     {detailTab==='payments'&&<><SectionHeader title="Payment history" subtitle="Recorded collections and balances"/>
       {(b.payments||[]).length===0?<Card><Text style={s.empty}>No payments recorded.</Text></Card>:
        b.payments.map((p,index)=><Card key={p.payment_id||p.id||String(index)}><Line label={p.payment_date||p.date||'Date not recorded'} value={money(p.amount)}/>
         <Text style={s.note}>{p.note||'Payment received'}</Text></Card>)}
       <Card><Line label="Total paid" value={money(v.paid)}/><Line label="Amount pending" value={money(v.pending)}/></Card>
      </>}
     {modal&&<Card><Text style={s.section}>{modal==='payment'?'Record payment':modal==='return'?'Return material':'Add material'}</Text>
      {modal==='payment'?<><Input label="Received ₹" value={amount} numeric onChange={setAmount}/>
       <Input label="Payment note" value={paymentNote} onChange={setPaymentNote}/></>:
       <><Text style={s.inputLabel}>Material</Text><View style={s.choiceRow}>{MATERIALS.map(([k,label])=>
        <Pressable style={[s.smallChoice,changeKey===k&&s.selectedChoice]} key={k} onPress={()=>setChangeKey(k)}>
         <Text style={[s.choiceText,changeKey===k&&{color:'white'}]}>{label}</Text></Pressable>)}</View>
        <Input label="Pieces" value={changeQty} numeric onChange={setChangeQty}/>
        <Text style={s.note}>Effective from next rental cycle. Wood return/addition not yet migrated.</Text></>}
      <Button label="Confirm" onPress={()=>void recordChange()}/><View style={{height:7}}/>
      <Button outline label="Cancel" onPress={()=>setModal(null)}/></Card>}
     
     {b.status==='open'&&<View style={{marginTop:12}}><Button outline label="Close this bill" onPress={()=>confirmClose(b)}/></View>}
     <View style={{marginTop:12}}><Button outline label="← All bills" onPress={()=>navigate('bills')}/></View>
    </>;
   })()}
   {page==='customers'&&<><Head title="Customers" subtitle="Search customers, bill history and material summaries."/>
    <Button label="＋ Add customer" onPress={()=>{setCustomerDraft({name:'',mobile:'',place:''});navigate('customer-form');}}/>
    <View style={{height:12}}/><Search value={query} onChange={setQuery} placeholder="Search name, number, location"/>
    {customers.length===0?<Card><Text style={s.empty}>No customers yet.</Text></Card>:customers.map(c=>
     <Pressable key={c.mobile} onPress={()=>{setSelectedCustomer(c.mobile);setCustomerTab('history');navigate('customer-detail');}} style={s.row}>
      <View style={s.avatar}><Text style={s.avatarText}>{c.name.slice(0,1).toUpperCase()}</Text></View>
      <View style={{flex:1}}><Text style={s.rowTitle}>{c.name}</Text><Text style={s.rowSub}>{c.mobile} · {c.place}</Text></View><Text style={s.chevron}>›</Text>
     </Pressable>)}</>}
   {page==='customer-detail'&&(()=>{
    const c=data.customers.find(x=>x.mobile===selectedCustomer);
    if(!c)return <Text style={s.empty}>Customer not found.</Text>;
    const bills=data.bills.filter(b=>b.mobile===c.mobile);
    const pending=bills.filter(b=>b.status==='open').reduce((sum,b)=>sum+calculateBill(b).pending,0);
    return <><Head title="Customer details" subtitle={c.name+' · '+c.mobile}/>
      <Card><View style={s.billCustomer}><View style={s.customerIcon}><Text style={s.customerInitial}>{c.name.slice(0,1).toUpperCase()}</Text></View>
       <View style={{flex:1}}><Text style={s.billCustomerName}>{c.name}</Text><Text style={s.billHeadSub}>{c.mobile} · {c.place}</Text></View></View>
       <Line label="Total bills" value={txt(bills.length)}/><Line label="Outstanding" value={money(pending)}/>
       <Button outline label="Edit customer" onPress={()=>{setCustomerDraft(c);navigate('customer-form');}}/></Card>
      <Segments items={[{value:'history',label:'Bill history'},{value:'materials',label:'Material summary'}]}
       value={customerTab} onChange={setCustomerTab}/>
      {customerTab==='history'&&(bills.length?bills.map(b=><BillTile key={b.bill_no} b={b} onPress={()=>openBill(b.bill_no)}/>):
       <Card><Text style={s.empty}>No bill history yet.</Text></Card>)}
      {customerTab==='materials'&&<CustomerMaterialSummary bills={bills}/>}
      <Button outline label="← Customers" onPress={()=>navigate('customers')}/>
     </>;
   })()}
   {page==='customer-form'&&<><Head title="Customer details" subtitle="Create or update a local customer."/><Card>
    <Input label="Name" value={customerDraft.name} onChange={v=>setCustomerDraft(x=>({...x,name:v}))}/>
    <Input label="Mobile" value={customerDraft.mobile} onChange={v=>setCustomerDraft(x=>({...x,mobile:v}))}/>
    <Input label="Place" value={customerDraft.place} onChange={v=>setCustomerDraft(x=>({...x,place:v}))}/>
    <Button label="Save customer" onPress={()=>void saveCustomer()}/><View style={{height:8}}/><Button outline label="Cancel" onPress={()=>navigate('customers')}/>
   </Card></>}
   {page==='inventory'&&<><Head title="Inventory" subtitle="Track local master stock. Rented stock estimates from active bills."/>
    {MATERIALS.map(([k,label,q])=>{
     const stock=data.inventory.find(x=>x.item===k)?.stock_qty||0;
     const rented=data.bills.filter(b=>b.status==='open').reduce((sum,b)=>sum+num(b[q]),0);
     return <Pressable key={k} style={s.row} onPress={()=>{setStockDraft({item:k,stock_qty:stock});navigate('stock-form');}}>
      <View style={s.avatar}><Text style={s.avatarText}>▦</Text></View>
      <View style={{flex:1}}><Text style={s.rowTitle}>{label}</Text>
       <Text style={s.rowSub}>Stock {stock} · Base rented {rented}</Text></View><Text style={s.stockValue}>{stock-rented}</Text>
     </Pressable>;})}
    <Text style={s.note}>Available stock is a basic estimate; return/addition and wood balance parity not yet verified.</Text>
   </>}
   {page==='stock-form'&&<><Head title="Update stock" subtitle={'Master stock for '+stockDraft.item}/><Card>
    <Input label="Stock quantity" value={stockDraft.stock_qty} numeric onChange={v=>setStockDraft(x=>({...x,stock_qty:num(v)}))}/>
    <Button label="Save stock" onPress={()=>void saveStock()}/><View style={{height:8}}/><Button outline label="Cancel" onPress={()=>navigate('inventory')}/>
   </Card></>}
   {page==='reports'&&<><Head title="Reports" subtitle="Native report summaries of local test records."/>
    <View style={s.statGrid}><Stat label="Active invoices" value={txt(totals.active)}/><Stat label="Total due" value={money(totals.due)}/></View>
    <View style={s.statGrid}><Stat label="Received" value={money(totals.paid)}/><Stat label="Pending" value={money(totals.pending)}/></View>
    <Text style={s.section}>Pending invoices</Text>
    {data.bills.filter(b=>b.status==='open'&&calculateBill(b).pending>0).map(b=><BillTile key={b.bill_no} b={b} onPress={()=>openBill(b.bill_no)}/>)}
    <Button outline label="Share local report" onPress={()=>{void Share.share({message:
     'S.A Traders — local test report\nBills: '+data.bills.length+'\nDue: '+money(totals.due)+'\nPaid: '+money(totals.paid)+'\nPending: '+money(totals.pending)
    });}}/>
   </>}
   {page==='more'&&<><Head title="More tools" subtitle="Native workflow tools and migration readiness."/>
    <Card><Text style={s.section}>Documents · offline</Text>
     <Button label="＋ Create delivery slip" onPress={()=>{setNoteDraft({id:'',date:TODAY(),customer:'',notes:'',type:'slip'});navigate('note-form');}}/>
     <View style={{height:8}}/><Button outline label="＋ Create challan" onPress={()=>{setNoteDraft({id:'',date:TODAY(),customer:'',notes:'',type:'challan'});navigate('note-form');}}/>
    </Card>
    {data.notes.map(n=><Pressable key={n.id} style={s.row} onPress={()=>{setNoteDraft(n);navigate('note-form');}}>
      <View style={s.avatar}><Text style={s.avatarText}>▤</Text></View><View style={{flex:1}}><Text style={s.rowTitle}>{n.type.toUpperCase()} · {n.customer}</Text><Text style={s.rowSub}>{n.date} · {n.notes}</Text></View>
      <Text style={s.chevron}>›</Text>
    </Pressable>)}
    <Card><Text style={s.section}>App data</Text>
     <Button label="Import S.A Traders JSON backup" disabled={working} onPress={()=>{void importBackup();}}/>
     <View style={{height:8}}/><Button outline label="Export compatible JSON backup" onPress={()=>{void exportBackup();}}/>
     <View style={{height:8}}/><Button outline label="Clear local test records" onPress={confirmReset}/>
    </Card>
    <Card><Text style={s.section}>Not migrated yet</Text>
     <Text style={s.note}>Live Firestore authentication/sync, complete legacy rental edge cases, native PDF printing, invoice image sharing, payment notification listener, WhatsApp reminder jobs, guarded multi-bill receipts, custom shop billing parity, backup import, wood returns, admin controls.</Text>
     <Text style={[s.note,{marginTop:9,color:'#A4493E'}]}>These are intentionally unavailable rather than being fake buttons. Do not use this APK for actual business accounting.</Text>
    </Card>
    <Button outline label="Open reports" onPress={()=>navigate('reports')}/>
   </>}
   {page==='note-form'&&<><Head title={noteDraft.type==='slip'?'Delivery slip':'Challan'} subtitle="Native offline document record"/><Card>
    <Input label="Customer" value={noteDraft.customer} onChange={v=>setNoteDraft(x=>({...x,customer:v}))}/>
    <Input label="Date YYYY-MM-DD" value={noteDraft.date} onChange={v=>setNoteDraft(x=>({...x,date:v}))}/>
    <Input label="Materials / notes" value={noteDraft.notes} multiline onChange={v=>setNoteDraft(x=>({...x,notes:v}))}/>
    <Button label="Save record" onPress={()=>void saveNote()}/><View style={{height:8}}/>
    <Button outline label="Share text" onPress={()=>{void Share.share({message:noteDraft.type.toUpperCase()+' · '+noteDraft.customer+'\n'+noteDraft.date+'\n'+noteDraft.notes});}}/>
    <View style={{height:8}}/><Button outline label="Cancel" onPress={()=>navigate('more')}/>
   </Card></>}
  </ScrollView>
 </KeyboardAvoidingView>
 <View style={s.nav}>
  {TABS.map(([k,label,icon])=><Pressable key={k} accessibilityRole="tab" accessibilityState={{selected:page===k}} onPress={()=>navigate(k)}
   style={[s.navItem,(page===k||page==='form'&&k==='bills'||page==='detail'&&k==='bills'||page==='customer-detail'&&k==='customers'||page==='customer-form'&&k==='customers'||page==='stock-form'&&k==='inventory'||page==='note-form'&&k==='more')&&s.navOn]}>
   <Text style={s.navIcon}>{icon}</Text><Text style={s.navText}>{label}</Text></Pressable>)}
 </View></SafeAreaView>;
}
function Search({value,onChange,placeholder}:{value:string;onChange:(v:string)=>void;placeholder:string}){
 return <TextInput style={s.search} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#9EACBC"/>;
}
function Line({label,value}:{label:string;value:string}){
 return <View style={s.line}><Text style={s.lineLabel}>{label}</Text><Text style={s.lineValue}>{value}</Text></View>;
}
function BillTile({b,onPress}:{b:Bill;onPress:()=>void}){
 const v=calculateBill(b),progress=v.due>0?Math.min(100,Math.max(0,v.paid/v.due*100)):0;
 return <Pressable accessibilityRole="button" onPress={onPress} style={s.proBillTile}>
   <View style={s.tileTop}>
    <View style={s.customerIcon}><Text style={s.customerInitial}>{b.name.slice(0,1).toUpperCase()}</Text></View>
    <View style={{flex:1}}><Text style={s.tileName} numberOfLines={1}>{b.name}</Text>
     <Text style={s.tileMeta}>#{b.bill_no}  ·  {b.start_date}  ·  {b.cycle_days} days</Text></View>
    <View style={{alignItems:'flex-end'}}><Text style={s.tileDue}>{money(v.pending)}</Text><Text style={s.tileMeta}>pending</Text></View>
   </View>
   <View style={s.tileProgress}><View style={[s.tileProgressFill,{width:(progress+'%') as any}]}/></View>
   <View style={s.tileBottom}><Text style={s.tileMeta}>{money(v.paid)} paid · {money(v.due)} due</Text>
    <Text style={[s.tileBadge,b.status==='closed'&&{color:'#078357',backgroundColor:'#E5F8EF'}]}>{b.status.toUpperCase()} · Cycle #{v.cycles.length||1}</Text></View>
  </Pressable>;
}
const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:C.bg},top:{height:72,flexDirection:'row',alignItems:'center',paddingHorizontal:18,gap:11,backgroundColor:C.navy},
 logo:{height:43,width:43,borderRadius:13,backgroundColor:'#174B75',alignItems:'center',justifyContent:'center'},
 logoText:{color:'white',fontWeight:'900'},brandName:{fontSize:18,fontWeight:'900',color:'#FFB12C'},brandSub:{fontSize:9,color:'#BDD5E6',letterSpacing:1.5,fontWeight:'800',marginTop:3},
 mode:{paddingHorizontal:10,paddingVertical:6,borderRadius:15,backgroundColor:'#DFF4E8'},modeText:{color:C.green,fontWeight:'900',fontSize:12},
 banner:{backgroundColor:'#FFF5E6',padding:7},bannerText:{fontSize:9,color:'#9B5F18',textAlign:'center',fontWeight:'800',letterSpacing:.5},
 body:{padding:18,paddingBottom:34},heading:{color:C.ink,fontWeight:'900',fontSize:26,letterSpacing:-.8},subtitle:{color:C.sub,fontSize:12,marginTop:7,lineHeight:18},
 hero:{backgroundColor:C.navy,borderRadius:24,padding:23,marginBottom:12},heroEyebrow:{fontSize:10,color:'#FBC3AA',letterSpacing:1.4,fontWeight:'900'},
 heroTitle:{fontSize:28,color:'white',fontWeight:'900',lineHeight:35,marginTop:12},heroLabel:{color:'#B7C8D8',fontSize:11,marginTop:20},
 heroAmount:{fontSize:31,color:'white',fontWeight:'900',marginTop:6},
 statGrid:{flexDirection:'row',gap:10,marginBottom:11},stat:{flex:1,borderRadius:17,padding:17,backgroundColor:'white',borderColor:C.line,borderWidth:1},
 statValue:{fontSize:22,fontWeight:'900',color:C.ink},statLabel:{fontSize:11,color:C.sub,marginTop:7},
 card:{backgroundColor:'white',borderRadius:17,borderColor:C.line,borderWidth:1,padding:16,marginBottom:12},
 row:{backgroundColor:'white',padding:14,borderWidth:1,borderColor:C.line,borderRadius:17,marginBottom:9,flexDirection:'row',alignItems:'center',gap:11},
 avatar:{backgroundColor:C.light,height:43,width:43,borderRadius:14,alignItems:'center',justifyContent:'center'},avatarText:{fontSize:21,fontWeight:'800',color:C.peach},
 rowTitle:{fontSize:14,fontWeight:'800',color:C.ink},rowSub:{fontSize:11,color:C.sub,marginTop:5},rowValue:{fontSize:13,fontWeight:'900',color:C.ink},stockValue:{fontSize:17,fontWeight:'900',color:C.green},
 chevron:{fontSize:26,color:C.sub},status:{fontSize:9,fontWeight:'900',color:'#C78031',letterSpacing:.6},
 section:{fontSize:17,color:C.ink,fontWeight:'900',marginTop:16,marginBottom:11},empty:{padding:13,color:C.sub,textAlign:'center',fontSize:13,lineHeight:19},
 button:{backgroundColor:C.peach,paddingHorizontal:14,paddingVertical:14,borderRadius:13,alignItems:'center',justifyContent:'center',flex:1},
 buttonOutline:{backgroundColor:'white',borderWidth:1,borderColor:C.line},buttonText:{color:'white',fontWeight:'900',fontSize:12},
 inputWrap:{marginBottom:12},inputLabel:{fontSize:11,color:C.ink,fontWeight:'800',marginBottom:7},
 input:{backgroundColor:'#F7F9FC',color:C.ink,paddingHorizontal:13,paddingVertical:10,borderWidth:1,borderColor:C.line,borderRadius:11,minHeight:45,fontSize:13},
 search:{borderRadius:13,borderWidth:1,borderColor:C.line,backgroundColor:'white',padding:14,marginBottom:16,fontSize:13,color:C.ink},
 choiceRow:{flexDirection:'row',gap:8,flexWrap:'wrap',marginBottom:17},choice:{backgroundColor:'#F2F5F8',borderRadius:10,padding:12,flex:1,alignItems:'center'},
 smallChoice:{backgroundColor:'#F2F5F8',borderRadius:8,padding:9},
 selectedChoice:{backgroundColor:C.navy},choiceText:{fontSize:11,fontWeight:'800',color:C.ink},
 materialLine:{flexDirection:'row',gap:8,alignItems:'center'},materialName:{width:85,fontSize:11,fontWeight:'800',color:C.ink},
 preview:{backgroundColor:'#E9F8F1',borderRadius:12,padding:15,marginBottom:15},previewAmount:{fontSize:24,fontWeight:'900',color:C.green},
 note:{color:C.sub,fontSize:11,lineHeight:18},bigAmount:{fontWeight:'900',fontSize:28,color:C.peach,marginBottom:10},
 line:{flexDirection:'row',justifyContent:'space-between',marginVertical:6},lineLabel:{fontSize:12,color:C.sub},lineValue:{fontWeight:'800',fontSize:12,color:C.ink},
 pillRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},actionGrid:{flexDirection:'row',gap:10,marginBottom:9},
 nav:{backgroundColor:'white',paddingVertical:9,paddingHorizontal:8,borderTopWidth:1,borderColor:C.line,flexDirection:'row'},
 navItem:{flex:1,alignItems:'center',borderRadius:11,paddingVertical:6},navOn:{backgroundColor:C.light},
 navIcon:{fontSize:22,fontWeight:'800',color:C.ink},navText:{fontSize:10,fontWeight:'800',color:C.sub,marginTop:4},
 proBillTile:{backgroundColor:'white',borderRadius:17,borderWidth:1,borderColor:C.line,padding:14,marginBottom:11},
 tileTop:{flexDirection:'row',alignItems:'center',gap:11},
 customerIcon:{height:44,width:44,borderRadius:15,backgroundColor:'#E9F0F9',alignItems:'center',justifyContent:'center'},
 customerInitial:{fontSize:17,fontWeight:'900',color:'#245A94'},
 tileName:{fontSize:13,fontWeight:'900',color:C.ink},tileMeta:{fontSize:10,color:C.sub,marginTop:4},
 tileDue:{fontSize:14,fontWeight:'900',color:C.ink},
 tileProgress:{height:5,backgroundColor:'#E8EDF5',borderRadius:5,marginTop:13,overflow:'hidden'},
 tileProgressFill:{height:5,backgroundColor:'#0EA86F',borderRadius:5},
 tileBottom:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:8},
 tileBadge:{paddingVertical:5,paddingHorizontal:8,fontSize:9,fontWeight:'900',color:'#C47613',backgroundColor:'#FFF1D9',borderRadius:9},
 customerChip:{borderRadius:12,paddingVertical:11,paddingHorizontal:13,backgroundColor:'#EAF1F8',marginRight:7},
 customerChipText:{fontSize:11,fontWeight:'800',color:'#143C60'},
 twoColumns:{flexDirection:'row',gap:10},
 columnHeader:{flexDirection:'row',justifyContent:'space-between',paddingBottom:12,borderBottomWidth:1,borderColor:C.line},
 columnLabel:{fontWeight:'900',color:C.sub,fontSize:9},
 fastTotal:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',backgroundColor:'#E6F8EC',borderRadius:14,padding:18,marginVertical:12},
 fastTotalLabel:{fontSize:12,fontWeight:'900',color:C.ink},fastTotalValue:{fontSize:22,fontWeight:'900',color:'#09874F'},
 billHeader:{flexDirection:'row',alignItems:'center',marginBottom:13,gap:12},
 billBack:{fontSize:33,fontWeight:'500',color:C.navy},
 billHeadTitle:{fontSize:20,fontWeight:'900',color:C.ink},billHeadSub:{fontSize:11,color:C.sub,marginTop:4},
 billCustomer:{flexDirection:'row',alignItems:'center',gap:12,marginVertical:11},
 billCustomerName:{fontWeight:'900',fontSize:14,color:C.ink},
 billStatus:{backgroundColor:'#DEF7E6',borderRadius:15,paddingVertical:7,paddingHorizontal:12},
 billStatusText:{fontWeight:'900',fontSize:10,color:'#098956'},
 detailActionRow:{flexDirection:'row',gap:7,marginBottom:13},
});
