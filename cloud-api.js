'use strict';

// Online-only data client for the S.A Traders MongoDB API.
const SA_API_URL = 'https://telegram-androidapi.o1wxup.easypanel.host';
const CLOUD_STORES = ['bills','customers','customBills','slips','challans','inventory','settings'];
const CLOUD_KEYS = {
  bills:'bill_no', customers:'mobile', customBills:'bill_no', slips:'slip_no',
  challans:'challan_no', inventory:'item', settings:'key'
};

window.SACloud = (() => {
  let token = localStorage.getItem('sa_api_token') || '';
  const versions = new Map();
  const versionKey = (store,key) => `${store}\u0000${key}`;

  function messageFor(data, status) {
    if (status === 401) return 'Your session expired. Please sign in again.';
    if (typeof data?.detail === 'string') return data.detail;
    if (Array.isArray(data?.detail)) return data.detail.map(x => x.msg || String(x)).join(', ');
    return `Server request failed (${status})`;
  }

  async function request(path, options={}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(SA_API_URL + path, {
        ...options,
        signal: controller.signal,
        headers: {
          'Accept':'application/json',
          'Content-Type':'application/json',
          ...(token ? {Authorization:`Bearer ${token}`} : {}),
          ...(options.headers || {})
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) clearSession();
        const error = new Error(messageFor(data, response.status));
        error.status = response.status;
        throw error;
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('The server took too long to respond. Check your internet and retry.');
      if (error instanceof TypeError) throw new Error('Cannot connect to the S.A Traders server. Check your internet connection.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function clearSession() {
    token = '';
    localStorage.removeItem('sa_api_token');
    sessionStorage.removeItem('sa_user');
  }

  async function login(username, password) {
    const result = await request('/api/v1/auth/login', {
      method:'POST', body:JSON.stringify({username, password})
    });
    token = result.access_token;
    localStorage.setItem('sa_api_token', token);
    return result.user;
  }

  async function me() { return request('/api/v1/auth/me'); }
  function logout() { clearSession(); }

  function validateStore(store) {
    if (!CLOUD_STORES.includes(store)) throw new Error(`Unsupported cloud store: ${store}`);
  }
  function keyFor(store, document) {
    const key = String(document?.[CLOUD_KEYS[store]] ?? '').trim();
    if (!key) throw new Error(`${store} record is missing ${CLOUD_KEYS[store]}`);
    return key;
  }

  const DB = {
    async get(store, key) {
      validateStore(store);
      try {
        const row = await request(`/api/v1/data/${encodeURIComponent(store)}/${encodeURIComponent(String(key))}`);
        versions.set(versionKey(store,String(key)), row.version);
        return row.document;
      } catch (error) {
        if (error.status === 404) return undefined;
        throw error;
      }
    },
    async all(store) {
      validateStore(store);
      const output=[];
      for (let offset=0;;offset+=500) {
        const page = await request(`/api/v1/data/${encodeURIComponent(store)}?limit=500&offset=${offset}`);
        for(const item of page.items){versions.set(versionKey(store,item.key),item.version);output.push(item.document)}
        if (page.items.length < 500) break;
      }
      return output;
    },
    async put(store, document) {
      validateStore(store);
      const key=keyFor(store, document);
      const knownVersion=versions.get(versionKey(store,key));
      const result=await request(`/api/v1/data/${encodeURIComponent(store)}/${encodeURIComponent(key)}`, {
        method:'PUT', body:JSON.stringify({document, ...(knownVersion===undefined?{}:{expected_version:knownVersion})})
      });
      versions.set(versionKey(store,key),result.version);
      return result.key;
    },
    async del(store, key) {
      validateStore(store);
      const cleanKey=String(key),knownVersion=versions.get(versionKey(store,cleanKey));
      const suffix=knownVersion===undefined?'':`?expected_version=${knownVersion}`;
      const result=await request(`/api/v1/data/${encodeURIComponent(store)}/${encodeURIComponent(cleanKey)}${suffix}`, {method:'DELETE'});
      versions.delete(versionKey(store,cleanKey));
      return result;
    },
    async clear(store) {
      const rows=await this.all(store);
      for (const row of rows) await this.del(store, keyFor(store,row));
    },
    async count(store) { return (await this.all(store)).length; }
  };

  async function createUser(username, password, role) {
    return request('/api/v1/users', {method:'POST', body:JSON.stringify({username,password,role})});
  }

  return {DB, login, me, logout, createUser, hasToken:()=>Boolean(token), apiUrl:SA_API_URL};
})();
