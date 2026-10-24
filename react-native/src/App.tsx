import React, { useCallback, useState } from 'react';
import {
  Linking, SafeAreaView, ScrollView, StatusBar, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';

/**
 * Native React Native launch/navigation shell.
 * Every production business screen is served by the original, unmodified
 * billing web application running inside its original Java Android WebView.
 * Original native Java services and Firebase bridge are bundled by CI.
 * No synthetic demo data and no parallel invoice calculation engine.
 */
type Entry = { label: string; route: string; icon: string; detail: string };
const SCREENS: Entry[] = [
  { label: 'Bills & invoices', route: 'bills', icon: '▤', detail: 'Create, edit, print and share bills' },
  { label: 'Customers', route: 'customers', icon: '♙', detail: 'Customer records and balances' },
  { label: 'Inventory', route: 'inventory', icon: '▦', detail: 'Material stock and transactions' },
  { label: 'Payments', route: 'payment-report', icon: '₹', detail: 'Receipts, splits and payment reports' },
  { label: 'Custom bills', route: 'custom', icon: '▣', detail: 'Custom invoice workflow' },
  { label: 'Delivery slips', route: 'slips', icon: '⇆', detail: 'Deliveries, returns and slips' },
  { label: 'Challans', route: 'challans', icon: '◇', detail: 'Transport and challan records' },
  { label: 'Reports', route: 'reports', icon: '▥', detail: 'Business performance and reports' },
  { label: 'Notifications', route: 'notifications', icon: '◉', detail: 'Payments and reminders' },
  { label: 'Open bills', route: 'open-bills', icon: '▤', detail: 'Active customer bills' },
  { label: 'Material tracking', route: 'materials', icon: '▦', detail: 'Rented materials and movement' },
  { label: 'Billing totals', route: 'totals', icon: '∑', detail: 'Reconciled bill totals' },
  { label: 'Material rent report', route: 'material-rent-report', icon: '▧', detail: 'Rental accounting' },
  { label: 'Returns', route: 'return-bill', icon: '↩', detail: 'Return billing workflow' },
  { label: 'Admin & settings', route: 'admin', icon: '⚙', detail: 'Users, terms and backups' },
  { label: 'Backup & restore', route: 'admin-backup', icon: '☷', detail: 'Export and restore data' },
];
function PageTile({ entry, onOpen }: {entry:Entry;onOpen:(route:string)=>void}) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={entry.label}
    style={styles.tile} onPress={()=>onOpen(entry.route)} activeOpacity={0.72}>
    <View style={styles.tileIcon}><Text style={styles.tileGlyph}>{entry.icon}</Text></View>
    <View style={styles.tileCopy}><Text style={styles.tileTitle}>{entry.label}</Text>
      <Text style={styles.tileDetail}>{entry.detail}</Text></View>
    <Text style={styles.chevron}>›</Text>
  </TouchableOpacity>;
}
export default function App() {
  const [error, setError] = useState<string|null>(null);
  const [filter, setFilter] = useState<'all'|'core'|'more'>('all');
  const open = useCallback(async (route:string) => {
    try {
      setError(null);
      await Linking.openURL('satradersbilling://open?screen=' + encodeURIComponent(route));
    } catch (e) {
      setError('Unable to open the original billing workspace. Check that the integrated Android activity is installed.');
    }
  },[]);
  const shown = filter==='core' ? SCREENS.slice(0,8) : filter==='more' ? SCREENS.slice(8) : SCREENS;
  return <SafeAreaView style={styles.safe}>
    <StatusBar backgroundColor="#F5F7FB" barStyle="dark-content" />
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.top}><View style={styles.logo}><Text style={styles.logoText}>SA</Text></View>
        <View style={styles.brand}><Text style={styles.brandName}>S.A Traders</Text>
          <Text style={styles.brandSub}>BUSINESS WORKSPACE</Text></View>
        <View style={styles.version}><Text style={styles.versionText}>RN</Text></View>
      </View>
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>YOUR BILLING WORKSPACE</Text>
        <Text style={styles.heroTitle}>Everything you need, in one place.</Text>
        <Text style={styles.heroDesc}>The original billing system and Android integrations are preserved inside this React Native app.</Text>
        <TouchableOpacity accessibilityRole="button" style={styles.heroButton}
          onPress={()=>open('dashboard')} activeOpacity={0.75}>
          <Text style={styles.heroButtonText}>Open complete billing app</Text>
          <Text style={styles.heroArrow}>↗</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.headingRow}><Text style={styles.title}>Workspace</Text>
        <View style={styles.count}><Text style={styles.countText}>{SCREENS.length} sections</Text></View>
      </View>
      <View style={styles.filters}>
        {([['all','All sections'],['core','Main tools'],['more','More tools']] as const).map(([k,label])=>
          <TouchableOpacity accessibilityRole="button" key={k} style={[styles.filter,filter===k&&styles.filterActive]}
            onPress={()=>setFilter(k)}><Text style={[styles.filterText,filter===k&&styles.filterTextActive]}>{label}</Text></TouchableOpacity>)}
      </View>
      <View style={styles.tiles}>{shown.map(entry=><PageTile key={entry.route} entry={entry} onOpen={open}/>)}</View>
      {error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Text style={styles.footer}>Original S.A Traders engine · Java + HTML/JS + Firestore</Text>
      <Text style={styles.footerSub}>Separate testing package. Uses the existing live Firestore project; back up data before testing writes.</Text>
    </ScrollView>
  </SafeAreaView>;
}
const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F5F7FB'},scroll:{flex:1},content:{paddingHorizontal:18,paddingBottom:35},
  top:{flexDirection:'row',alignItems:'center',marginTop:20,marginBottom:22,gap:11},
  logo:{backgroundColor:'#142B45',width:46,height:46,borderRadius:15,justifyContent:'center',alignItems:'center'},
  logoText:{color:'#FFF',fontWeight:'900',fontSize:15},brand:{flex:1},brandName:{color:'#1B2D40',fontWeight:'900',fontSize:20,letterSpacing:-0.6},
  brandSub:{color:'#8592A2',fontSize:9,letterSpacing:1.8,fontWeight:'800',marginTop:4},
  version:{paddingHorizontal:10,paddingVertical:7,backgroundColor:'#E9F4F4',borderRadius:20},versionText:{color:'#178675',fontWeight:'900',fontSize:11},
  hero:{backgroundColor:'#142B45',borderRadius:25,padding:23},
  heroKicker:{color:'#E9AC97',fontSize:10,fontWeight:'800',letterSpacing:1.5},
  heroTitle:{color:'#FFF',fontSize:28,lineHeight:34,fontWeight:'900',letterSpacing:-0.8,marginTop:12},
  heroDesc:{color:'#B7C7D7',fontSize:13,lineHeight:21,marginTop:11},
  heroButton:{backgroundColor:'#F06B53',borderRadius:14,padding:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:22},
  heroButtonText:{color:'white',fontSize:14,fontWeight:'900'},heroArrow:{color:'white',fontSize:22},
  headingRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:27,marginBottom:14},
  title:{color:'#1D3045',fontWeight:'900',fontSize:21},count:{backgroundColor:'#E8EDF3',paddingHorizontal:11,paddingVertical:6,borderRadius:20},
  countText:{fontSize:10,fontWeight:'800',color:'#697B8F'},
  filters:{flexDirection:'row',gap:9,marginBottom:15},
  filter:{borderRadius:20,backgroundColor:'white',borderColor:'#E6ECF4',borderWidth:1,paddingHorizontal:13,paddingVertical:8},
  filterActive:{backgroundColor:'#142B45',borderColor:'#142B45'},
  filterText:{fontSize:11,fontWeight:'800',color:'#697789'},filterTextActive:{color:'white'},
  tiles:{borderRadius:19,borderColor:'#E9EEF5',borderWidth:1,overflow:'hidden',backgroundColor:'white'},
  tile:{paddingVertical:14,paddingHorizontal:14,borderBottomWidth:1,borderBottomColor:'#EDF0F5',flexDirection:'row',alignItems:'center',gap:12},
  tileIcon:{width:42,height:42,borderRadius:13,backgroundColor:'#FFF1EB',alignItems:'center',justifyContent:'center'},
  tileGlyph:{fontSize:23,fontWeight:'800',color:'#E96952'},tileCopy:{flex:1},
  tileTitle:{fontSize:13,fontWeight:'900',color:'#1D3045'},tileDetail:{fontSize:11,color:'#8190A0',marginTop:5},
  chevron:{fontSize:28,fontWeight:'300',color:'#91A1B1'},
  error:{marginTop:15,color:'#B00020',fontSize:12},footer:{marginTop:24,textAlign:'center',color:'#8B99AA',fontSize:10,fontWeight:'800'},
  footerSub:{textAlign:'center',color:'#9DA9B6',fontSize:10,lineHeight:16,marginTop:8}
});
