'use strict';

const FIREBASE_STORES=['bills','customers','customBills','slips','challans','inventory','settings'];
const FIREBASE_KEYS={bills:'bill_no',customers:'mobile',customBills:'bill_no',slips:'slip_no',challans:'challan_no',inventory:'item',settings:'key'};

window.SAFirebase=window.SACloud=(()=>{
  const pending=new Map(),listeners=new Set();
  const cache=window.SADataCache={bills:null,customBills:null,customers:null,slips:null,challans:null,inventory:null,settings:null,hydratedBills:null,ready:false};
  let sequence=0,loading=null;
  const clone=value=>value==null?value:structuredClone(value);
  const validateStore=store=>{if(!FIREBASE_STORES.includes(store))throw new Error(`Unsupported Firebase store: ${store}`)};
  const recordKey=(store,document)=>{const key=String(document?.[FIREBASE_KEYS[store]]??'').trim();if(!key)throw new Error(`${store} record is missing ${FIREBASE_KEYS[store]}`);return key};
  const decode=payload=>{if(!payload)return null;const bytes=Uint8Array.from(atob(payload),c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes))};
  const notify=(store,reason)=>{if(store==='bills')cache.hydratedBills=null;listeners.forEach(fn=>{try{fn(store,reason)}catch(e){console.warn(e)}});};
  const reportWriteError=error=>window.dispatchEvent(new CustomEvent('sa:write-error',{detail:{message:error?.message||String(error)}}));
  const replace=(store,rows,reason='server')=>{validateStore(store);cache[store]=Array.isArray(rows)?rows:[];notify(store,reason)};
  const upsert=(store,document,reason='write')=>{const rows=cache[store]||(cache[store]=[]),key=recordKey(store,document),field=FIREBASE_KEYS[store],idx=rows.findIndex(row=>String(row?.[field])===key);if(idx<0)rows.push(clone(document));else rows[idx]=clone(document);notify(store,reason)};
  const erase=(store,key,reason='write')=>{const field=FIREBASE_KEYS[store];cache[store]=(cache[store]||[]).filter(row=>String(row?.[field])!==String(key));notify(store,reason)};
  function bridge(){if(!window.FirebaseDB)throw new Error('Firebase is available only inside the Android app.');return window.FirebaseDB}
  function call(method,...args){
    const requestId=`fb-${Date.now()}-${++sequence}`;console.time(`Firestore.${method}.${requestId}`);
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(requestId);console.timeEnd(`Firestore.${method}.${requestId}`);reject(new Error('Firebase took too long to respond. Check your internet and retry.'))},30000);
      pending.set(requestId,{resolve,reject,timer,method});
      try{bridge()[method](requestId,...args)}catch(error){clearTimeout(timer);pending.delete(requestId);console.timeEnd(`Firestore.${method}.${requestId}`);reject(error)}
    });
  }
  window.__firebaseResult=(requestId,ok,payload)=>{const item=pending.get(requestId);if(!item)return;clearTimeout(item.timer);pending.delete(requestId);console.timeEnd(`Firestore.${item.method}.${requestId}`);let value=null;try{value=decode(payload)}catch(e){item.reject(e);return}if(ok)item.resolve(value);else item.reject(new Error(value?.message||String(value||'Firebase request failed')))};
  window.__firebaseStoreUpdate=(store,payload)=>{try{replace(store,decode(payload),'server');window.dispatchEvent(new CustomEvent('sa:store-update',{detail:{store}}))}catch(e){console.warn('Firebase cache update failed',e)}};
  const rawAll=async store=>{validateStore(store);const rows=await call('all',store);replace(store,rows,'load');return clone(cache[store])};
  const DB={
    async loadAll(force=false){if(cache.ready&&!force)return cache;if(loading&&!force)return loading;loading=Promise.all(FIREBASE_STORES.map(store=>rawAll(store))).then(()=>{cache.ready=true;return cache}).finally(()=>{loading=null});return loading},
    async refresh(store){validateStore(store);return rawAll(store)},
    async get(store,key){validateStore(store);if(cache[store]!==null){const field=FIREBASE_KEYS[store];return clone(cache[store].find(row=>String(row?.[field])===String(key))||null)}return call('get',store,String(key))},
    async all(store){validateStore(store);if(cache[store]===null)await rawAll(store);return clone(cache[store])},
    async put(store,document){validateStore(store);const key=recordKey(store,document),before=cache[store]===null?null:clone(cache[store]);upsert(store,document);call('put',store,key,JSON.stringify(document)).catch(error=>{if(before!==null)replace(store,before,'rollback');reportWriteError(error)});return key},
    async batch(operations,options={}){const ops=(operations||[]).map(op=>{validateStore(op.store);return{store:op.store,key:recordKey(op.store,op.document),document:op.document}});if(options.waitForServer){await call('batchPut',JSON.stringify(ops));for(const op of ops)upsert(op.store,op.document);return true}const before={};for(const op of ops){if(!(op.store in before))before[op.store]=cache[op.store]===null?null:clone(cache[op.store]);upsert(op.store,op.document)}call('batchPut',JSON.stringify(ops)).catch(error=>{for(const [store,rows] of Object.entries(before))if(rows!==null)replace(store,rows,'rollback');reportWriteError(error)});return true},
    async del(store,key){validateStore(store);const before=cache[store]===null?null:clone(cache[store]);erase(store,key);call('remove',store,String(key)).catch(error=>{if(before!==null)replace(store,before,'rollback');reportWriteError(error)});return true},
    async clear(store){validateStore(store);const before=cache[store]===null?null:clone(cache[store]);replace(store,[],'clear');try{return await call('clear',store)}catch(error){if(before!==null)replace(store,before,'rollback');throw error}},
    async count(store){return (await this.all(store)).length},
    onChange(fn){listeners.add(fn);return()=>listeners.delete(fn)}
  };
  cache.refresh=store=>DB.refresh(store);
  async function login(username,password){if(username!=='admin'||password!=='shiva')throw new Error('Incorrect username or password');localStorage.setItem('sa_firebase_app_lock','1');return{username:'admin',role:'admin',provider:'firebase'}}
  async function me(){if(localStorage.getItem('sa_firebase_app_lock')!=='1')throw new Error('Sign in required');return{username:'admin',role:'admin',provider:'firebase'}}
  function logout(){localStorage.removeItem('sa_firebase_app_lock');sessionStorage.removeItem('sa_user')}
  return{DB,cache,login,me,logout,hasToken:()=>localStorage.getItem('sa_firebase_app_lock')==='1',projectId:'sa-traders-billing'};
})();
