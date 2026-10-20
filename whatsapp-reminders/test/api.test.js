import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once,EventEmitter} from 'node:events';
import {createReminderApi} from '../src/api.js';
import {WhatsAppSession,normalizePhone} from '../src/whatsapp.js';
const token='a'.repeat(40);
async function fixture(t,session,databasePath){
 const server=createReminderApi({session,token,databasePath,now:()=>100000});server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>server.listening?new Promise(resolve=>server.close(resolve)):undefined);
 const call=async(route,body,auth=true)=>{
  const response=await fetch('http://127.0.0.1:'+server.address().port+route,{method:body===undefined?'GET':'POST',headers:{...(auth?{authorization:'Bearer '+token}:{}),'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  return {code:response.status,data:await response.json()};
 };return {call,server};
}
const payload={requestId:'request_123456789012345',to:'9876543210',message:'Bill #100 pending ₹50',billNo:'100'};
test('All session/send endpoints require auth; offline or invalid requests never send',async t=>{
 let sent=0;const session={info:()=>({connected:false}),send:()=>{sent++}};
 const {call}=await fixture(t,session,':memory:');
 assert.equal((await call('/health',undefined,false)).code,200);
 for(const [route,body] of [['/v1/status',undefined],['/v1/link',{}],['/v1/logout',{}],['/v1/reminders',payload]])assert.equal((await call(route,body,false)).code,401);
 assert.equal((await call('/v1/reminders',{...payload,to:'9876543210@evil'})).code,400);
 assert.equal((await call('/v1/reminders',{...payload,message:''})).code,400);
 assert.equal((await call('/v1/reminders',payload)).code,409);assert.equal(sent,0);
});
test('Duplicate sends survive restart, changed payload rejected, actual send invoked once',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'sa-wa-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 let sends=[];const session={info:()=>({connected:true}),send:async(...args)=>{sends.push(args);return {id:'remote-123'}}};
 const one=await fixture(t,session,path.join(dir,'journal.db'));
 assert.equal((await one.call('/v1/reminders',payload)).data.accepted,true);
 assert.equal((await one.call('/v1/reminders',payload)).data.duplicate,true);
 assert.equal((await one.call('/v1/reminders',{...payload,message:'Changed'})).code,409);
 assert.equal((await one.call('/v1/reminders',{...payload,requestId:'another_123456789012345'})).code,429);
 await new Promise(resolve=>one.server.close(resolve));
 const two=await fixture(t,session,path.join(dir,'journal.db'));
 assert.equal((await two.call('/v1/reminders',payload)).data.duplicate,true);
 assert.deepEqual(sends,[['919876543210',payload.message]]);
});
test('Unknown network outcome cannot silently resend the same message',async t=>{
 let sent=0;const session={info:()=>({connected:true}),send:async()=>{sent++;throw new Error('Disconnected after submission')}};
 const {call}=await fixture(t,session,':memory:');
 assert.equal((await call('/v1/reminders',payload)).code,502);
 assert.equal((await call('/v1/reminders',payload)).data.uncertain,true);assert.equal(sent,1);
});
test('Concurrent duplicate cannot send twice',async t=>{
 let resolveSend,sent=0;const session={info:()=>({connected:true}),send:()=>{sent++;return new Promise(r=>resolveSend=r)}};
 const {call}=await fixture(t,session,':memory:');
 const first=call('/v1/reminders',payload);
 while(!resolveSend)await new Promise(r=>setTimeout(r,1));
 assert.equal((await call('/v1/reminders',payload)).code,409);
 resolveSend({id:'one'});assert.equal((await first).data.accepted,true);assert.equal(sent,1);
});
test('Real session events gate sending; linking code and QR never fabricate connected status',async t=>{
 const dir=mkdtempSync(path.join(tmpdir(),'sa-wa-session-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
 let client;class FakeBerry extends EventEmitter {
  constructor(options){super();client=this;this.options=options;}
  async connectWithQr(){this.emit('auth.qr',{value:'RAW-PAIRING-QR'});}
  async connectWithPairingCode(phone){this.emit('auth.pairing_code',{code:'12345678',phoneNumber:phone});}
  async disconnect(){}async logout(){}async sendText(to,message){return {id:'one',to,message};}
 }
 const session=new WhatsAppSession({BerryProtocol:FakeBerry,toDataURL:async value=>'data:image/png;base64,'+Buffer.from(value).toString('base64'),dataDir:dir});
 await session.link();await new Promise(r=>setImmediate(r));assert.equal(session.info().status,'QR_READY');
 assert.equal(Buffer.from(session.info().qr.split(',')[1],'base64').toString(),'RAW-PAIRING-QR');
 await assert.rejects(session.send('9876543210','text'),/not connected/);
 await session.link('9876543210');assert.equal(session.info().pairingCode,'12345678');
 client.emit('connection.open',{});assert.equal(session.info().connected,true);
 assert.equal((await session.send('9876543210','text')).to,'919876543210@s.whatsapp.net');
 client.emit('connection.close',{});assert.equal(session.info().connected,false);
 await session.logout();assert.equal(session.info().qr,null);
});
test('Phone normalization and missing authentication configuration',()=>{
 assert.equal(normalizePhone('09876543210'),'919876543210');assert.equal(normalizePhone('+91 98765 43210'),'919876543210');
 assert.throws(()=>normalizePhone('123'));assert.throws(()=>normalizePhone('9876543210@s.whatsapp.net'));
 assert.throws(()=>createReminderApi({token:'short'}),/32 characters/);
});
