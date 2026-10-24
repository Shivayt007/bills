import React, { useMemo, useState } from 'react';
import {
  SafeAreaView, StatusBar, ScrollView, View, Text, TextInput,
  Pressable, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';

/**
 * S.A Traders React Native PREVIEW.
 * Deliberately contains only synthetic demonstration data.
 * No Firebase, payment notification, billing write, or invoice export calls.
 * The production Java+WebView application is unchanged.
 */
type Tab = 'home' | 'bills' | 'customers' | 'inventory';
type Bill = { id: string; customer: string; date: string; total: number; paid: number; status: 'Paid' | 'Partial' | 'Due' };
type Customer = { name: string; subtitle: string; outstanding: number };
const COLORS = {
  ink: '#15273E', muted: '#697789', canvas: '#F5F7FB', paper: '#FFFFFF',
  border: '#E9EDF4', accent: '#F06650', accentSoft: '#FFF0EA', green: '#16876C',
  blue: '#4769A5', navy: '#142B45',
};
const DEMO_BILLS: Bill[] = [
  { id: 'INV-0241', customer: 'Sample Customer A', date: '18 Oct 2026', total: 18960, paid: 18960, status: 'Paid' },
  { id: 'INV-0240', customer: 'Sample Customer B', date: '17 Oct 2026', total: 14500, paid: 6500, status: 'Partial' },
  { id: 'INV-0239', customer: 'Sample Customer C', date: '15 Oct 2026', total: 8600, paid: 0, status: 'Due' },
  { id: 'INV-0238', customer: 'Sample Customer D', date: '13 Oct 2026', total: 24950, paid: 24950, status: 'Paid' },
];
const DEMO_CUSTOMERS: Customer[] = [
  { name: 'Sample Customer A', subtitle: '4 invoices · Chennai', outstanding: 0 },
  { name: 'Sample Customer B', subtitle: '3 invoices · Chennai', outstanding: 8000 },
  { name: 'Sample Customer C', subtitle: '2 invoices · Chennai', outstanding: 8600 },
  { name: 'Sample Customer D', subtitle: '6 invoices · Chennai', outstanding: 0 },
];
const DEMO_STOCK = [
  { name: 'Jackey', quantity: 1250, unit: 'pcs' },
  { name: 'Sheets', quantity: 680, unit: 'pcs' },
  { name: '9 ft Wood', quantity: 240, unit: 'pcs' },
  { name: 'Runners', quantity: 195, unit: 'pcs' },
];
const money = (value: number) => '₹' + Math.round(value).toLocaleString('en-IN');
const NavIcon = ({ name }: {name: Tab}) => <Text style={styles.navEmoji}>{{home:'◫',bills:'▤',customers:'♙',inventory:'▦'}[name]}</Text>;
const BoxTitle = ({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) => (
  <View style={styles.sectionHeading}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {action ? <Pressable onPress={onAction}><Text style={styles.sectionLink}>{action}  →</Text></Pressable> : null}
  </View>
);
const StatusChip = ({ status }: {status: Bill['status']}) => (
  <View style={[styles.statusChip, status === 'Paid' ? styles.statusPaid : status === 'Partial' ? styles.statusPartial : styles.statusDue]}>
    <Text style={[styles.statusText, status === 'Paid' ? styles.paidText : status === 'Partial' ? styles.partialText : styles.dueText]}>{status}</Text>
  </View>
);
function BillRow({ bill }: {bill: Bill}) {
  return <View style={styles.billRow}>
    <View style={styles.billBadge}><Text style={styles.billBadgeText}>₹</Text></View>
    <View style={styles.billDetails}>
      <Text style={styles.billName} numberOfLines={1}>{bill.customer}</Text>
      <Text style={styles.billSub}>{bill.id}  ·  {bill.date}</Text>
    </View>
    <View style={{alignItems:'flex-end',gap:5}}>
      <Text style={styles.billAmount}>{money(bill.total)}</Text>
      <StatusChip status={bill.status}/>
    </View>
  </View>;
}
function Metric({ label, value, icon, dark }: {label:string;value:string;icon:string;dark?:boolean}) {
  return <View style={[styles.metric, dark && styles.metricDark]}>
    <Text style={[styles.metricIcon,dark && {color:'#FBC7B9'}]}>{icon}</Text>
    <Text style={[styles.metricValue,dark && {color:'#FFF'}]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    <Text style={[styles.metricLabel,dark && {color:'#B9C9D9'}]}>{label}</Text>
  </View>;
}
export default function App() {
  const [tab,setTab] = useState<Tab>('home');
  const [query,setQuery] = useState('');
  const [newBill,setNewBill] = useState(false);
  const [customer,setCustomer] = useState('');
  const [quantity,setQuantity] = useState('1');
  const [rate,setRate] = useState('65');
  const [draftTotal,setDraftTotal] = useState<number|null>(null);
  const billing = useMemo(() => {
    const total = DEMO_BILLS.reduce((s,b)=>s+b.total,0);
    const paid = DEMO_BILLS.reduce((s,b)=>s+b.paid,0);
    return {total,paid,due:total-paid};
  },[]);
  const matches = (value:string) => value.toLowerCase().includes(query.trim().toLowerCase());
  const resetDraft = () => {setNewBill(false);setDraftTotal(null);setCustomer('');setQuantity('1');setRate('65');};
  const openDraft = () => {setTab('bills');setQuery('');setNewBill(true);setDraftTotal(null);};
  return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle="dark-content" backgroundColor={COLORS.canvas}/>
    <View style={styles.top}>
      <View style={styles.brand}><View style={styles.brandMark}><Text style={styles.brandGlyph}>SA</Text></View>
        <View><Text style={styles.brandName}>S.A Traders</Text><Text style={styles.brandSubtitle}>BUSINESS CONTROL CENTER</Text></View>
      </View>
      <View style={styles.avatar}><Text style={styles.avatarText}>ST</Text></View>
    </View>
    <View style={styles.previewStrip}><Text style={styles.previewStripText}>●  REACT NATIVE UI PREVIEW  ·  SAMPLE DATA ONLY</Text></View>
    <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
      {tab === 'home' && <>
        <View style={styles.greeting}><Text style={styles.eyebrow}>SATURDAY, 24 OCT 2026</Text>
          <Text style={styles.heading}>Your business, at a glance.</Text>
          <Text style={styles.description}>A clearer view of your daily operations.</Text>
        </View>
        <View style={styles.hero}>
          <View style={styles.heroTop}><Text style={styles.heroLabel}>TOTAL INVOICE VALUE</Text><Text style={styles.heroMini}>↗ DEMO</Text></View>
          <Text style={styles.heroValue}>{money(billing.total)}</Text>
          <View style={styles.heroDivider}/>
          <View style={styles.heroBottom}><View><Text style={styles.heroSmall}>Received</Text><Text style={styles.heroNumber}>{money(billing.paid)}</Text></View>
            <View><Text style={styles.heroSmall}>Outstanding</Text><Text style={styles.heroNumber}>{money(billing.due)}</Text></View>
          </View>
          <View style={styles.heroAccent}/>
        </View>
        <View style={styles.metricRow}>
          <Metric label="Total bills" value={String(DEMO_BILLS.length).padStart(2,'0')} icon="▤" />
          <Metric label="Customers" value={String(DEMO_CUSTOMERS.length).padStart(2,'0')} icon="♧"/>
          <Metric label="Due bills" value={String(DEMO_BILLS.filter(x=>x.status!=='Paid').length).padStart(2,'0')} icon="◷"/>
        </View>
        <BoxTitle title="Quick actions"/>
        <View style={styles.actionRow}>
          <Pressable accessibilityRole="button" style={[styles.action,styles.actionPrimary]} onPress={openDraft}><Text style={styles.actionIcon}>＋</Text><Text style={styles.actionTextPrimary}>New bill</Text></Pressable>
          <Pressable accessibilityRole="button" style={styles.action} onPress={()=>setTab('customers')}><Text style={styles.actionIconDark}>♙</Text><Text style={styles.actionText}>Customers</Text></Pressable>
          <Pressable accessibilityRole="button" style={styles.action} onPress={()=>setTab('inventory')}><Text style={styles.actionIconDark}>▦</Text><Text style={styles.actionText}>Inventory</Text></Pressable>
        </View>
        <BoxTitle title="Recent invoices" action="View all" onAction={()=>setTab('bills')}/>
        <View style={styles.panel}>{DEMO_BILLS.slice(0,3).map(x=><BillRow key={x.id} bill={x}/>)}</View>
      </>}
      {tab === 'bills' && <>
        <View style={styles.pageHeading}><Text style={styles.eyebrow}>ACCOUNTING</Text><Text style={styles.heading}>Invoices</Text><Text style={styles.description}>Browse sample invoices and try a draft calculation.</Text></View>
        <Pressable style={styles.primaryButton} onPress={openDraft}><Text style={styles.primaryButtonText}>＋  Create preview bill</Text></Pressable>
        {newBill && <View style={styles.draftPanel}>
          <View style={styles.draftHead}><Text style={styles.sectionTitle}>New bill · demo</Text><Pressable onPress={resetDraft}><Text style={styles.sectionLink}>Close ✕</Text></Pressable></View>
          <Text style={styles.draftDescription}>Local calculation only. Nothing is saved or sent to Firebase.</Text>
          <Text style={styles.inputLabel}>Customer name</Text>
          <TextInput accessibilityLabel="Customer name" style={styles.input} placeholder="e.g. Sample Customer E" placeholderTextColor="#9AA5B2" value={customer} onChangeText={setCustomer}/>
          <View style={styles.inputRow}><View style={{flex:1}}><Text style={styles.inputLabel}>Quantity</Text>
            <TextInput accessibilityLabel="Quantity" keyboardType="decimal-pad" style={styles.input} value={quantity} onChangeText={setQuantity}/>
          </View><View style={{flex:1}}><Text style={styles.inputLabel}>Rate (₹)</Text>
            <TextInput accessibilityLabel="Rate" keyboardType="decimal-pad" style={styles.input} value={rate} onChangeText={setRate}/>
          </View></View>
          <Pressable style={styles.primaryButton} onPress={()=>setDraftTotal(Math.max(0,Number(quantity)||0)*Math.max(0,Number(rate)||0))}>
            <Text style={styles.primaryButtonText}>Calculate preview total</Text>
          </Pressable>
          {draftTotal!==null && <View style={styles.calcResult}><Text style={styles.calcLabel}>Sample subtotal (no tax/rental logic)</Text><Text style={styles.calcValue}>{money(draftTotal)}</Text></View>}
        </View>}
        <TextInput accessibilityLabel="Search invoices" style={styles.searchInput} placeholder="⌕  Search invoice or customer" placeholderTextColor="#8B99AA" value={query} onChangeText={setQuery}/>
        <View style={styles.panel}>{DEMO_BILLS.filter(x=>matches(x.id+' '+x.customer)).map(x=><BillRow key={x.id} bill={x}/>)}
          {!DEMO_BILLS.some(x=>matches(x.id+' '+x.customer)) && <Text style={styles.empty}>No matching sample bills.</Text>}
        </View>
      </>}
      {tab === 'customers' && <>
        <View style={styles.pageHeading}><Text style={styles.eyebrow}>YOUR NETWORK</Text><Text style={styles.heading}>Customers</Text><Text style={styles.description}>A polished customer directory preview.</Text></View>
        <TextInput accessibilityLabel="Search customers" style={styles.searchInput} placeholder="⌕  Search customer" placeholderTextColor="#8B99AA" value={query} onChangeText={setQuery}/>
        <View style={styles.panel}>{DEMO_CUSTOMERS.filter(x=>matches(x.name)).map((c,i)=><View key={c.name} style={styles.customerRow}>
          <View style={styles.customerAvatar}><Text style={styles.customerInitial}>{i+1}</Text></View>
          <View style={{flex:1}}><Text style={styles.billName}>{c.name}</Text><Text style={styles.billSub}>{c.subtitle}</Text></View>
          <View style={{alignItems:'flex-end'}}><Text style={[styles.billAmount,c.outstanding?{color:COLORS.accent}:null]}>{money(c.outstanding)}</Text><Text style={styles.billSub}>Outstanding</Text></View>
        </View>)}
        {!DEMO_CUSTOMERS.some(x=>matches(x.name)) && <Text style={styles.empty}>No matching sample customers.</Text>}</View>
      </>}
      {tab === 'inventory' && <>
        <View style={styles.pageHeading}><Text style={styles.eyebrow}>MATERIAL CONTROL</Text><Text style={styles.heading}>Inventory</Text><Text style={styles.description}>Example stock cards for your existing materials.</Text></View>
        <View style={styles.inventoryGrid}>{DEMO_STOCK.map((item,i)=><View style={styles.inventoryCard} key={item.name}>
          <View style={styles.stockIcon}><Text style={styles.stockIconText}>{['▣','▤','▥','▦'][i]}</Text></View>
          <Text style={styles.stockQty}>{item.quantity.toLocaleString('en-IN')}</Text><Text style={styles.stockUnit}>{item.unit} in sample stock</Text><Text style={styles.stockName}>{item.name}</Text>
        </View>)}</View>
      </>}
      <View style={styles.footer}><Text style={styles.footerText}>S.A TRADERS  •  UI CONCEPT  •  NO LIVE DATA</Text></View>
    </ScrollView>
    <View style={styles.bottomNav}>
      {(['home','bills','customers','inventory'] as Tab[]).map(k=><Pressable accessibilityRole="tab" accessibilityState={{selected:tab===k}} key={k} onPress={()=>{setTab(k);setQuery('');setNewBill(false);}} style={[styles.navItem,tab===k && styles.activeNav]}>
        <NavIcon name={k}/><Text style={[styles.navText,tab===k && styles.navTextActive]}>{({home:'Home',bills:'Bills',customers:'Clients',inventory:'Stock'} as Record<Tab,string>)[k]}</Text>
      </Pressable>)}
    </View>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:COLORS.canvas},
  top:{height:72,backgroundColor:COLORS.paper,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:22},
  brand:{flexDirection:'row',alignItems:'center',gap:10},brandMark:{backgroundColor:COLORS.navy,width:40,height:40,borderRadius:13,justifyContent:'center',alignItems:'center'},
  brandGlyph:{color:'#FFF',fontWeight:'900',fontSize:15},brandName:{color:COLORS.ink,fontSize:19,fontWeight:'800',letterSpacing:-0.6},brandSubtitle:{fontSize:8,color:COLORS.muted,letterSpacing:1.7,fontWeight:'800',marginTop:3},
  avatar:{height:38,width:38,borderRadius:19,backgroundColor:COLORS.accentSoft,alignItems:'center',justifyContent:'center'},avatarText:{fontSize:12,fontWeight:'800',color:COLORS.accent},
  previewStrip:{backgroundColor:'#EAF1FF',paddingVertical:8,alignItems:'center'},previewStripText:{color:'#426391',fontSize:9,fontWeight:'900',letterSpacing:1},
  scroll:{flex:1},scrollContent:{paddingHorizontal:18,paddingBottom:34},
  greeting:{marginTop:26,marginBottom:20},pageHeading:{marginTop:27,marginBottom:21},eyebrow:{color:COLORS.accent,fontWeight:'900',letterSpacing:2,fontSize:10,marginBottom:8},
  heading:{fontSize:28,fontWeight:'900',color:COLORS.ink,letterSpacing:-1.1},description:{fontSize:13.5,color:COLORS.muted,marginTop:7,lineHeight:20},
  hero:{backgroundColor:COLORS.navy,padding:22,borderRadius:25,overflow:'hidden',minHeight:182,position:'relative'},heroTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  heroLabel:{color:'#B9CEDC',fontSize:10,fontWeight:'800',letterSpacing:1.5},heroMini:{color:'#F3B39C',fontSize:10,fontWeight:'900'},heroValue:{color:'white',fontSize:36,fontWeight:'900',marginTop:18,letterSpacing:-1},
  heroDivider:{backgroundColor:'#355069',height:1,marginTop:19,marginBottom:15},heroBottom:{flexDirection:'row',gap:42},heroSmall:{fontSize:11,color:'#AFC3D2'},heroNumber:{fontSize:17,color:'white',fontWeight:'800',marginTop:4},
  heroAccent:{height:120,width:120,borderRadius:80,position:'absolute',right:-65,top:35,backgroundColor:'#223F59',opacity:0.6},
  metricRow:{flexDirection:'row',gap:10,marginTop:13},metric:{backgroundColor:'white',borderRadius:17,paddingHorizontal:13,paddingVertical:16,flex:1,borderWidth:1,borderColor:COLORS.border},metricDark:{backgroundColor:COLORS.navy},
  metricIcon:{fontSize:19,fontWeight:'700',color:COLORS.accent},metricValue:{fontSize:23,fontWeight:'900',color:COLORS.ink,marginTop:13},metricLabel:{fontSize:11,color:COLORS.muted,marginTop:4},
  sectionHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:26,marginBottom:13},sectionTitle:{fontSize:18,color:COLORS.ink,fontWeight:'900',letterSpacing:-0.3},
  sectionLink:{fontSize:12,color:COLORS.accent,fontWeight:'800'},actionRow:{flexDirection:'row',gap:9},action:{flex:1,backgroundColor:'white',borderWidth:1,borderColor:COLORS.border,padding:14,borderRadius:17,minHeight:88,justifyContent:'space-between'},actionPrimary:{backgroundColor:COLORS.accent,borderColor:COLORS.accent},
  actionIcon:{fontSize:24,color:'white',fontWeight:'700'},actionIconDark:{fontSize:22,color:COLORS.ink},actionTextPrimary:{color:'white',fontWeight:'800',fontSize:12},actionText:{color:COLORS.ink,fontWeight:'800',fontSize:12},
  panel:{backgroundColor:'white',borderRadius:19,borderWidth:1,borderColor:COLORS.border,overflow:'hidden'},
  billRow:{paddingHorizontal:14,paddingVertical:16,borderBottomWidth:1,borderBottomColor:COLORS.border,flexDirection:'row',alignItems:'center',gap:11},
  billBadge:{backgroundColor:'#F3F6FB',borderRadius:13,height:40,width:40,alignItems:'center',justifyContent:'center'},billBadgeText:{fontWeight:'800',fontSize:19,color:COLORS.blue},
  billDetails:{flex:1},billName:{fontSize:13,fontWeight:'800',color:COLORS.ink},billSub:{fontSize:10.5,color:COLORS.muted,marginTop:6},
  billAmount:{fontSize:13,fontWeight:'900',color:COLORS.ink},statusChip:{borderRadius:30,paddingHorizontal:8,paddingVertical:4},statusText:{fontSize:9,fontWeight:'900'},
  statusPaid:{backgroundColor:'#E6F8F0'},statusPartial:{backgroundColor:'#FFF3E3'},statusDue:{backgroundColor:'#FFEBEB'},
  paidText:{color:COLORS.green},partialText:{color:'#AD760B'},dueText:{color:'#C34D58'},
  primaryButton:{padding:15,backgroundColor:COLORS.accent,borderRadius:15,alignItems:'center',marginBottom:17},primaryButtonText:{color:'white',fontWeight:'900',fontSize:14},
  searchInput:{height:52,backgroundColor:'white',borderWidth:1,borderColor:COLORS.border,borderRadius:15,paddingHorizontal:16,marginBottom:16,fontSize:14,color:COLORS.ink},
  customerRow:{padding:15,flexDirection:'row',gap:11,alignItems:'center',borderBottomWidth:1,borderBottomColor:COLORS.border},
  customerAvatar:{width:40,height:40,borderRadius:14,backgroundColor:'#E7ECF5',alignItems:'center',justifyContent:'center'},customerInitial:{fontSize:15,fontWeight:'800',color:COLORS.blue},
  inventoryGrid:{flexDirection:'row',flexWrap:'wrap',gap:12},inventoryCard:{backgroundColor:'white',borderWidth:1,borderColor:COLORS.border,borderRadius:19,padding:18,width:'48%',minHeight:177},
  stockIcon:{backgroundColor:COLORS.accentSoft,width:40,height:40,borderRadius:13,alignItems:'center',justifyContent:'center'},stockIconText:{color:COLORS.accent,fontSize:23,fontWeight:'900'},
  stockQty:{fontSize:25,fontWeight:'900',color:COLORS.ink,marginTop:17},stockUnit:{fontSize:10,color:COLORS.muted,marginTop:4},stockName:{fontSize:13,fontWeight:'800',color:COLORS.ink,marginTop:14},
  bottomNav:{flexDirection:'row',backgroundColor:'white',borderTopWidth:1,borderColor:COLORS.border,paddingVertical:9,paddingHorizontal:8},
  navItem:{flex:1,alignItems:'center',paddingVertical:6,borderRadius:13},activeNav:{backgroundColor:COLORS.accentSoft},navEmoji:{fontSize:22,fontWeight:'900',color:COLORS.ink},
  navText:{fontSize:10,fontWeight:'700',color:COLORS.muted,marginTop:4},navTextActive:{color:COLORS.accent},
  draftPanel:{backgroundColor:'white',padding:16,borderRadius:19,borderWidth:1,borderColor:COLORS.border,marginBottom:20},
  draftHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},draftDescription:{fontSize:12,color:COLORS.muted,lineHeight:18,marginVertical:14},
  inputLabel:{color:COLORS.ink,fontSize:11,fontWeight:'800',marginBottom:8},input:{backgroundColor:COLORS.canvas,borderRadius:12,borderWidth:1,borderColor:COLORS.border,paddingHorizontal:12,height:47,color:COLORS.ink,marginBottom:15},
  inputRow:{flexDirection:'row',gap:12},calcResult:{backgroundColor:'#EEF7F5',borderRadius:12,padding:14,marginTop:1},calcLabel:{color:COLORS.green,fontSize:11,fontWeight:'700'},calcValue:{color:COLORS.ink,fontSize:23,fontWeight:'900',marginTop:6},
  empty:{padding:28,textAlign:'center',color:COLORS.muted,fontSize:13},footer:{alignItems:'center',marginTop:30},footerText:{color:'#9AA7B6',fontSize:9,letterSpacing:1.3,fontWeight:'800'}
});
