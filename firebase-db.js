'use strict';

// Promise wrapper around the native Android Firestore bridge.
const FIREBASE_STORES=['bills','customers','customBills','slips','challans','inventory','settings'];
const FIREBASE_KEYS={bills:'bill_no',customers:'mobile',customBills:'bill_no',slips:'slip_no',challans:'challan_no',inventory:'item',settings:'key'};

window.SAFirebase=window.SACloud=(()=>{
  const pending=new Map();
  let sequence=0;

  function bridge(){
    if(!window.FirebaseDB)throw new Error('Firebase is available only inside the Android app.');
    return window.FirebaseDB;
  }
  function validateStore(store){if(!FIREBASE_STORES.includes(store))throw new Error(`Unsupported Firebase store: ${store}`)}
  function recordKey(store,document){const key=String(document?.[FIREBASE_KEYS[store]]??'').trim();if(!key)throw new Error(`${store} record is missing ${FIREBASE_KEYS[store]}`);return key}
  function call(method,...args){
    const requestId=`fb-${Date.now()}-${++sequence}`;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error('Firebase took too long to respond. Check your internet and retry.'))},30000);
      pending.set(requestId,{resolve,reject,timer});
      try{bridge()[method](requestId,...args)}catch(error){clearTimeout(timer);pending.delete(requestId);reject(error)}
    });
  }

  window.__firebaseResult=(requestId,ok,json)=>{
    const item=pending.get(requestId);if(!item)return;
    clearTimeout(item.timer);pending.delete(requestId);
    let value=null;try{value=json?JSON.parse(json):null}catch(_e){value=json}
    if(ok)item.resolve(value);else item.reject(new Error(value?.message||String(value||'Firebase request failed')));
  };

  const DB={
    async get(store,key){validateStore(store);return call('get',store,String(key))},
    async all(store){validateStore(store);return call('all',store)},
    async put(store,document){validateStore(store);const key=recordKey(store,document);await call('put',store,key,JSON.stringify(document));return key},
    async del(store,key){validateStore(store);return call('remove',store,String(key))},
    async clear(store){validateStore(store);return call('clear',store)},
    async count(store){return (await this.all(store)).length}
  };

  // Existing app lock. Firestore access is controlled separately by Firebase rules.
  async function login(username,password){
    if(username!=='admin'||password!=='shiva')throw new Error('Incorrect username or password');
    localStorage.setItem('sa_firebase_app_lock','1');
    return {username:'admin',role:'admin',provider:'firebase'};
  }
  async function me(){if(localStorage.getItem('sa_firebase_app_lock')!=='1')throw new Error('Sign in required');return {username:'admin',role:'admin',provider:'firebase'}}
  function logout(){localStorage.removeItem('sa_firebase_app_lock');sessionStorage.removeItem('sa_user')}

  return {DB,login,me,logout,hasToken:()=>localStorage.getItem('sa_firebase_app_lock')==='1',projectId:'sa-traders-billing'};
})();
