import React from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {Bill,calculateBill,integer,MATERIALS,money,num,WOODS,sizes} from './domain';

const K={navy:'#092642',navy2:'#123B5A',gold:'#FFB12C',orange:'#F47B18',green:'#0B966B',paper:'#FFFFFF',muted:'#71849A',bg:'#F5F8FC',line:'#E6EDF5',ink:'#152A43'};
export type BillTab='materials'|'cycles'|'all'|'payments';
export type FormSection='materials'|'wood'|'charges';

export function SectionHeader({title,subtitle,trailing,onTrailing}:{
 title:string;subtitle?:string;trailing?:string;onTrailing?:()=>void
}){
 return <View style={p.sectionHeader}>
  <View style={{flex:1}}><Text style={p.sectionTitle}>{title}</Text>{subtitle?<Text style={p.sectionSubtitle}>{subtitle}</Text>:null}</View>
  {trailing&&onTrailing?<Pressable accessibilityRole="button" onPress={onTrailing} style={p.sectionLink}><Text style={p.linkText}>{trailing} ›</Text></Pressable>:null}
 </View>;
}
export function MetricCard({label,value,color}: {label:string;value:string;color:'blue'|'red'|'green'|'orange'}){
 const v={blue:['#E6F5FF','#176DCC'],red:['#FFEDEB','#D84144'],green:['#E7F9F1','#098959'],orange:['#FFF4E5','#E97408']}[color];
 return <View style={[p.metric,{backgroundColor:v[0]}]}><Text style={[p.metricValue,{color:v[1]}]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text><Text style={p.metricLabel}>{label}</Text></View>;
}
export function QuickAction({icon,label,onPress,color='#F0F6FD'}:{
 icon:string;label:string;onPress:()=>void;color?:string
}){
 return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={p.action} android_ripple={{color:'#F5DBA5'}}>
 <View style={[p.actionIcon,{backgroundColor:color}]}><Text style={p.actionGlyph}>{icon}</Text></View><Text style={p.actionText}>{label}</Text>
 </Pressable>;
}
export function Segments<T extends string>({items,value,onChange}:{
 items:ReadonlyArray<{value:T;label:string}>;value:T;onChange:(value:T)=>void
}){
 return <View style={p.segmentWrap}>{items.map(item=><Pressable key={item.value} accessibilityRole="tab"
 accessibilityState={{selected:item.value===value}} onPress={()=>onChange(item.value)} style={[p.segment,item.value===value&&p.segmentActive]}>
 <Text style={[p.segmentText,item.value===value&&p.segmentTextActive]}>{item.label}</Text></Pressable>)}</View>;
}
export function QuantityEditor({label,quantity,rate,onIncrease,onDecrease,onQtyChange,onRateChange}:{
 label:string;quantity:number;rate:number;onIncrease:()=>void;onDecrease:()=>void;
 onQtyChange:(v:string)=>void;onRateChange:(v:string)=>void
}){
 return <View style={p.productRow}>
  <View style={p.productMark}><Text style={p.productMarkIcon}>▱</Text></View>
  <View style={p.productDescription}><Text style={p.productName}>{label}</Text>
   <View style={p.rateLine}><Text style={p.ratePrefix}>₹</Text>
    <NativeInput value={String(rate)} onChange={onRateChange} label={label+' rate'}/>
    <Text style={p.rateUnit}> / piece</Text>
   </View></View>
  <View style={p.stepper}>
   <Pressable accessibilityRole="button" accessibilityLabel={'Decrease '+label} onPress={onDecrease} style={p.stepButton}><Text style={p.stepButtonText}>−</Text></Pressable>
   <NativeInput value={String(quantity)} onChange={onQtyChange} label={label+' quantity'} width={34}/>
   <Pressable accessibilityRole="button" accessibilityLabel={'Increase '+label} onPress={onIncrease} style={p.stepButton}><Text style={[p.stepButtonText,{color:K.green}]}>+</Text></Pressable>
  </View>
  <Text style={p.productAmount} numberOfLines={1} adjustsFontSizeToFit>{money(quantity*rate)}</Text>
 </View>;
}
import {TextInput} from 'react-native';
function NativeInput({value,onChange,label,width}:{
 value:string;onChange:(v:string)=>void;label:string;width?:number
}){
 return <TextInput accessibilityLabel={label} keyboardType="decimal-pad"
 value={value} selectTextOnFocus onChangeText={onChange} style={[p.miniInput,width?{width}:undefined]}/>;
}
export function BillHero({bill}:{bill:Bill}){
 const x=calculateBill(bill);
 const pct=x.due>0?Math.max(0,Math.min(100,x.paid/x.due*100)):0;
 return <View style={p.billHero}>
  <View style={p.billHeroHead}><Text style={p.billHeroOverline}>TOTAL RENTAL DUE</Text>
    <Text style={p.billCycleBadge}>Cycle #{x.cycles.length||1}  ·  {bill.cycle_days} days</Text></View>
  <Text style={p.billHeroValue}>{money(x.due)}</Text>
  <View style={p.track}><View style={[p.trackFill,{width:(pct+'%') as any}]}/></View>
  <View style={p.billHeroBottom}>
    <View><Text style={p.billHeroLabel}>Received</Text><Text style={p.billHeroStat}>{money(x.paid)}</Text></View>
    <View><Text style={p.billHeroLabel}>Pending</Text><Text style={p.billHeroStat}>{money(x.pending)}</Text></View>
    <View><Text style={p.billHeroLabel}>Advance</Text><Text style={p.billHeroStat}>{money(x.advance)}</Text></View>
  </View>
 </View>;
}
export function BillMaterialDetails({bill,showAll=false}:{bill:Bill;showAll?:boolean}){
 const x=calculateBill(bill);
 return <View style={p.surface}>
  <View style={p.tableHeading}><Text style={p.tableHeadName}>MATERIAL</Text><Text style={p.tableHeadQty}>QTY</Text><Text style={p.tableHeadAmount}>RATE / AMOUNT</Text></View>
  {MATERIALS.filter(([, , q])=>integer(bill[q])>0||showAll).map(([k,label,q,r])=><View key={k} style={p.tableRow}>
   <Text style={p.tableRowName}>{label}</Text><Text style={p.tableRowQty}>{integer(bill[q])}</Text>
   <View style={{width:112,alignItems:'flex-end'}}><Text style={p.tableRowRate}>{money(num(bill[r]))} each</Text>
    <Text style={p.tableRowAmount}>{money(integer(bill[q])*num(bill[r]))}</Text></View>
  </View>)}
  {WOODS.filter(([k])=>String(bill[k]||'').trim()).map(([k,label,r])=><View key={k} style={p.tableRow}>
   <View style={{flex:1}}><Text style={p.tableRowName}>{label}</Text><Text style={p.tableRowRate}>{String(bill[k])}</Text></View>
   <View style={{width:112,alignItems:'flex-end'}}><Text style={p.tableRowRate}>{money(num(bill[r]))} / ft</Text>
   <Text style={p.tableRowAmount}>{money(Object.entries(sizes(bill[k])).reduce((sum,[ft,pieces])=>sum+num(ft)*integer(pieces)*num(bill[r]),0))}</Text></View>
  </View>)}
  <View style={p.tableTotal}><Text style={p.tableTotalLabel}>Current material rent</Text><Text style={p.tableTotalValue}>{money(x.material+x.wood)}</Text></View>
  <View style={p.tableFoot}><Text style={p.tableFootText}>Transport is charged in the first cycle only. Advance is a separate security deposit.</Text></View>
 </View>;
}
export function BillCycleDetails({bill}:{bill:Bill}){
 const x=calculateBill(bill);
 return <View>
  {x.cycles.length===0?<Text style={p.empty}>No rental cycle has started.</Text>:x.cycles.slice().reverse().map(c=>
   <View key={c.index} style={p.cycleCard}><View style={p.cycleBadge}><Text style={p.cycleBadgeText}>#{c.index}</Text></View>
    <View style={{flex:1}}><Text style={p.cycleDates}>{c.start_date} → {c.end_date}</Text>
     <Text style={p.cycleHint}>Rent {money(c.rent)}{c.index===1?' · transport included':''}</Text></View>
    <Text style={p.cycleAmount}>{money(c.total)}</Text></View>)}
 </View>;
}
export function CustomerMaterialSummary({bills}:{bills:Bill[]}){
 const current=bills.filter(b=>b.status==='open');
 return <View style={p.surface}>
  <View style={p.tableHeading}><Text style={p.tableHeadName}>MATERIAL ACROSS OPEN BILLS</Text><Text style={p.tableHeadQty}>QTY</Text></View>
  {MATERIALS.map(([k,label,q])=>({k,label,qty:current.reduce((a,b)=>a+integer(b[q]),0)})).filter(x=>x.qty>0)
  .map(x=><View key={x.k} style={p.summaryRow}><Text style={p.tableRowName}>{x.label}</Text>
   <Text style={p.summaryQty}>{x.qty}</Text></View>)}
  <Text style={p.tableFootText}>Aggregated base quantities. Historical returns and additions must be reviewed per bill.</Text>
 </View>;
}
const p=StyleSheet.create({
 sectionHeader:{flexDirection:'row',alignItems:'center',marginVertical:13},sectionTitle:{fontSize:18,fontWeight:'900',color:K.ink},sectionSubtitle:{color:K.muted,marginTop:5,fontSize:11},
 sectionLink:{padding:8},linkText:{fontSize:11,fontWeight:'800',color:K.orange},
 metric:{flex:1,minWidth:135,paddingVertical:19,borderRadius:15,alignItems:'center',justifyContent:'center',marginRight:9,marginBottom:9},
 metricValue:{fontSize:24,fontWeight:'900'},metricLabel:{fontSize:11,fontWeight:'700',color:K.ink,marginTop:5},
 action:{flex:1,minWidth:85,alignItems:'center',paddingVertical:12,paddingHorizontal:7,backgroundColor:'white',
 borderColor:K.line,borderWidth:1,borderRadius:15,marginRight:8,marginBottom:8},
 actionIcon:{height:41,width:41,borderRadius:12,justifyContent:'center',alignItems:'center'},
 actionGlyph:{fontWeight:'900',fontSize:22,color:'#0D4F7D'},actionText:{fontWeight:'800',fontSize:11,color:K.ink,marginTop:8,textAlign:'center'},
 segmentWrap:{backgroundColor:'#E9EEF5',borderRadius:13,padding:4,flexDirection:'row',gap:4,marginBottom:15},
 segment:{flex:1,alignItems:'center',paddingVertical:11,borderRadius:10},
 segmentActive:{backgroundColor:K.navy},segmentText:{color:'#667991',fontWeight:'800',fontSize:11},
 segmentTextActive:{color:'white'},
 productRow:{flexDirection:'row',gap:7,alignItems:'center',paddingVertical:12,borderBottomWidth:1,borderColor:K.line},
 productMark:{width:31,height:42,backgroundColor:K.bg,borderRadius:9,justifyContent:'center',alignItems:'center'},
 productMarkIcon:{fontSize:20,color:'#8A9BAC'},
 productDescription:{flex:1},productName:{fontSize:12,fontWeight:'900',color:K.ink},
 rateLine:{flexDirection:'row',alignItems:'center',marginTop:4},ratePrefix:{color:K.muted,fontSize:11},
 rateUnit:{fontSize:9,color:K.muted},
 stepper:{flexDirection:'row',alignItems:'center',backgroundColor:'#F5F8FB',borderRadius:12,padding:2},
 stepButton:{width:25,height:30,alignItems:'center',justifyContent:'center',backgroundColor:'white',borderRadius:10,borderWidth:1,borderColor:K.line},
 stepButtonText:{fontWeight:'900',fontSize:19,color:K.ink},
 miniInput:{fontSize:12,color:K.ink,fontWeight:'800',minWidth:29,padding:0,textAlign:'center',borderBottomWidth:1,borderColor:'#DAE4ED'},
 productAmount:{width:72,fontWeight:'900',color:K.ink,fontSize:11,textAlign:'right'},
 billHero:{backgroundColor:'#173E78',borderRadius:23,padding:20,marginBottom:14,overflow:'hidden'},
 billHeroHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 billHeroOverline:{color:'#C7D8FF',fontSize:10,fontWeight:'900',letterSpacing:1.1},
 billCycleBadge:{color:'#FFFFFF',fontSize:10,fontWeight:'700'},
 billHeroValue:{color:'white',fontSize:35,fontWeight:'900',marginTop:14},
 track:{height:5,backgroundColor:'#4B6B9D',borderRadius:4,overflow:'hidden',marginTop:21},
 trackFill:{height:5,backgroundColor:'#B7ED68',borderRadius:4},
 billHeroBottom:{flexDirection:'row',justifyContent:'space-between',marginTop:18},
 billHeroLabel:{color:'#BDCEE8',fontSize:10},billHeroStat:{color:'white',fontSize:13,fontWeight:'900',marginTop:5},
 surface:{backgroundColor:'white',borderWidth:1,borderColor:K.line,borderRadius:18,overflow:'hidden',marginBottom:14},
 tableHeading:{flexDirection:'row',padding:12,backgroundColor:'#EDF3F9'},
 tableHeadName:{flex:1,fontSize:10,fontWeight:'900',color:'#516783'},
 tableHeadQty:{width:36,textAlign:'center',fontSize:10,fontWeight:'900',color:'#516783'},
 tableHeadAmount:{width:112,textAlign:'right',fontSize:10,fontWeight:'900',color:'#516783'},
 tableRow:{flexDirection:'row',alignItems:'center',paddingVertical:12,paddingHorizontal:12,borderBottomWidth:1,borderBottomColor:K.line},
 tableRowName:{flex:1,fontSize:12,fontWeight:'800',color:K.ink},
 tableRowQty:{width:36,fontSize:12,textAlign:'center',fontWeight:'800',color:K.ink},
 tableRowRate:{fontSize:10,color:K.muted},tableRowAmount:{fontSize:12,fontWeight:'900',color:K.ink,marginTop:4},
 tableTotal:{flexDirection:'row',justifyContent:'space-between',padding:14,backgroundColor:'#FFF3E5'},
 tableTotalLabel:{fontSize:12,fontWeight:'900',color:K.ink},tableTotalValue:{fontSize:15,fontWeight:'900',color:K.orange},
 tableFoot:{padding:12},tableFootText:{fontSize:10,color:K.muted,lineHeight:16,padding:10},
 cycleCard:{flexDirection:'row',alignItems:'center',backgroundColor:'white',borderColor:K.line,borderWidth:1,
 borderRadius:14,marginBottom:9,padding:12,gap:10},
 cycleBadge:{backgroundColor:'#EDF2FF',borderRadius:9,padding:9},cycleBadgeText:{color:'#234C9D',fontWeight:'900'},
 cycleDates:{fontSize:11,fontWeight:'800',color:K.ink},cycleHint:{fontSize:10,color:K.muted,marginTop:5},
 cycleAmount:{fontSize:11,fontWeight:'900',color:K.ink},
 summaryRow:{flexDirection:'row',paddingHorizontal:14,paddingVertical:13,borderBottomWidth:1,borderColor:K.line},
 summaryQty:{fontSize:13,fontWeight:'900',color:K.green},empty:{padding:16,color:K.muted}
});
