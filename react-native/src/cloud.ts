import {initializeApp,getApps,FirebaseApp} from 'firebase/app';
import {getAuth,signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {getFirestore,collection,getDocs,doc,runTransaction,Firestore} from 'firebase/firestore';
import {Data} from './domain';
import {parseLegacyBackup,exportLegacyBackup} from './legacyBackup';
const keys={bills:'bill_no',customers:'mobile',customBills:'bill_no',inventory:'item',slips:'slip_no',challans:'challan_no',settings:'key'} as const;
let app:FirebaseApp|undefined,db:Firestore|undefined;
// Baseline covers documents read at pull, including legacy writes without revisions.
let baseline:Map<string,string>|null=null;
const stable=(v:any):string=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export async function connectCloud(configText:string,email:string,password:string){
 const config=JSON.parse(configText);if(!config.projectId||!config.apiKey)throw Error('Firebase web config requires projectId and apiKey');
 app=getApps().find(a=>a.name==='sa-native-'+config.projectId)||initializeApp(config,'sa-native-'+config.projectId);db=getFirestore(app);baseline=null;
 await signInWithEmailAndPassword(getAuth(app),email.trim(),password);return config.projectId;
}
export async function disconnectCloud(){if(app)await signOut(getAuth(app));db=undefined;baseline=null;}
export async function pullCloud():Promise<Data>{
 if(!db||!app||!getAuth(app).currentUser)throw Error('Sign in to Firebase first');
 const data:Record<string,any>={},snapshot=new Map<string,string>();
 for(const [store,key] of Object.entries(keys)){const docs=await getDocs(collection(db,store));data[store]=docs.docs.map(d=>{const v=d.data();if(String(v[key])!==d.id)throw Error('Cloud document ID does not match '+store+' key');snapshot.set(store+'/'+d.id,stable(v));return v;});}
 const result=parseLegacyBackup(JSON.stringify({schema:'sa-traders-firebase-v1',data})).data;baseline=snapshot;return result;
}
export async function publishCloud(data:Data){
 if(!db||!app||!getAuth(app).currentUser||!baseline)throw Error('Pull cloud records before publishing');
 const writes:Array<{path:string;value:any}>=[];
 for(const [store,key] of Object.entries(keys))for(const value of (data[store as keyof Data]||[]) as any[]){const id=String(value[key]||'');if(!id||id.includes('/'))throw Error('Invalid cloud record key');const path=store+'/'+id;if(stable(value)!==baseline.get(path))writes.push({path,value:JSON.parse(JSON.stringify(value))});}
 // Avoid silently clearing production documents that a local import omitted.
 for(const path of baseline.keys()){const [store,id]=path.split('/'),key=keys[store as keyof typeof keys];if(!((data[store as keyof Data]||[]) as any[]).some(v=>String(v[key])===id))throw Error('Local data omits cloud record '+path+'. Cloud deletion is disabled; pull and reconcile first.');}
 if(writes.length>400)throw Error('More than 400 changed documents. Use a staged administrative migration.');
 const firestore=db,expected=baseline;
 await runTransaction(firestore,async tx=>{
  const current=await Promise.all(writes.map(w=>tx.get(doc(firestore,w.path))));
  current.forEach((snap,i)=>{const actual=snap.exists()?stable(snap.data()):undefined;if(actual!==expected.get(writes[i].path))throw Error('Cloud conflict in '+writes[i].path+'. Export local backup and pull again.');});
  for(const w of writes)tx.set(doc(firestore,w.path),w.value);
 });
 for(const w of writes)baseline.set(w.path,stable(w.value));return writes.length;
}
