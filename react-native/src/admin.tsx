import React,{useState,useEffect,useRef} from 'react';
import {Alert,AppState,Modal,View,Text} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import {Action,Field,ui} from './WorkflowForms';
const KEY='sa-admin-hash-v1';
function SetupPanel({configured,onSave}:{configured:boolean;onSave:(value:string)=>Promise<void>}){
 const [value,setValue]=useState(''),[confirm,setConfirm]=useState('');
 return <View style={ui.box}><Text style={ui.title}>Admin protection</Text><Text style={ui.text}>A local PIN protects destructive actions. Firebase permissions are enforced separately by server rules.</Text><Field label="New PIN (6–12 digits)" value={value} set={setValue} secure/><Field label="Confirm PIN" value={confirm} set={setConfirm} secure/><Action title={configured?'Change admin PIN':'Set admin PIN'} onPress={()=>{if(!/^\d{6,12}$/.test(value)||value!==confirm){Alert.alert('PIN','Use matching PINs of 6–12 digits');return;}void onSave(value).then(()=>{setValue('');setConfirm('');});}}/></View>;
}
export function useAdmin(){
 const [hash,setHash]=useState<string|null>(null),[salt,setSalt]=useState(''),[pin,setPin]=useState(''),[open,setOpen]=useState(false),[locked,setLocked]=useState(false),[title,setTitle]=useState(''),[ready,setReady]=useState(false);
 const pending=useRef<null|(()=>Promise<void>)>(null),attempts=useRef(0),retry=useRef(0);
 useEffect(()=>{void SecureStore.getItemAsync(KEY).then(s=>{if(s){const r=JSON.parse(s);setHash(r.hash);setSalt(r.salt);setLocked(true);}setReady(true);}).catch(()=>{Alert.alert('Security storage unavailable','Restart the app before using admin actions.');});const sub=AppState.addEventListener('change',s=>{if(s==='background')setLocked(true);});return()=>sub.remove();},[]);
 const digest=(v:string,s=salt)=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,s+':'+v);
 const authorize=async(t:string,fn:()=>Promise<void>)=>{if(!hash){Alert.alert('Admin PIN required','Set an admin PIN under More before this action.');return;}setTitle(t);pending.current=fn;setPin('');setOpen(true);};
 const submit=async()=>{try{if(Date.now()<retry.current)throw Error('Wait 30 seconds before retrying');if(!hash)throw Error('Set an admin PIN first');if(await digest(pin)!==hash){attempts.current++;if(attempts.current>=5){retry.current=Date.now()+30000;attempts.current=0;}throw Error('Incorrect admin PIN');}attempts.current=0;setOpen(false);setPin('');const fn=pending.current;pending.current=null;if(fn)await fn();else setLocked(false);}catch(e){Alert.alert('Admin action',String(e));}};
 const dialog=<Modal visible={open} transparent animationType="fade" onRequestClose={()=>setOpen(false)}><View style={{flex:1,justifyContent:'center',padding:24,backgroundColor:'#0008'}}><View style={ui.box}><Text style={ui.title}>{title}</Text><Field label="Admin PIN" value={pin} set={setPin} secure/><Action title="Confirm" onPress={()=>void submit()}/><Action title="Cancel" onPress={()=>setOpen(false)}/></View></View></Modal>;
 const save=async(value:string)=>{const action=async()=>{const salt=Crypto.randomUUID(),hash=await digest(value,salt);await SecureStore.setItemAsync(KEY,JSON.stringify({salt,hash}));setHash(hash);setSalt(salt);Alert.alert('Admin PIN saved');};if(hash)await authorize('Change admin PIN',action);else await action();};
 return {authorize,ready,panel:<SetupPanel configured={!!hash} onSave={save}/>,dialog,locked:locked&&!!hash,unlock:<View style={{padding:24}}><Text style={ui.title}>S.A Traders locked</Text><Action title="Unlock with admin PIN" onPress={()=>{pending.current=null;setTitle('Unlock');setPin('');setOpen(true);}}/>{dialog}</View>};
}
