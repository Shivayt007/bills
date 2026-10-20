import {createServer} from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {normalizePhone} from './whatsapp.js';

export function createReminderApi({session,token,databasePath,now=Date.now}) {
  if(!token||!/^[-A-Za-z0-9_]{32,256}$/.test(token))throw new Error('Set REMINDER_API_TOKEN to a random secret of at least 32 characters.');
  const db=new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS sends (id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, state TEXT NOT NULL, message_id TEXT, created_at INTEGER NOT NULL)');
  // A crash after submission can leave an unknown outcome. Never automatically resend it.
  const read=db.prepare('SELECT * FROM sends WHERE id=?');
  const reserve=db.prepare('INSERT INTO sends(id,fingerprint,state,created_at) VALUES(?,?,?,?)');
  const finish=db.prepare('UPDATE sends SET state=?,message_id=? WHERE id=?');
  let sending=false,lastSend=0;
  const hash=v=>createHash('sha256').update(v).digest();
  const authorized=req=>timingSafeEqual(hash(req.headers.authorization||''),hash('Bearer '+token));
  const server=createServer(async(req,res)=>{
    const reply=(code,data)=>{res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
    if(req.method==='GET'&&req.url==='/health')return reply(200,{ok:true});
    if(!authorized(req))return reply(401,{error:'Invalid reminder service token.'});
    try {
      if(req.method==='GET'&&req.url==='/v1/status')return reply(200,session.info());
      if(req.method!=='POST'||!['/v1/link','/v1/logout','/v1/reminders'].includes(req.url))return reply(404,{error:'Route not found.'});
      let bytes=0,chunks=[];
      for await(const chunk of req){bytes+=chunk.length;if(bytes>16384){reply(413,{error:'Request too large.'});return;}chunks.push(chunk);}
      let data;try{data=JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{return reply(400,{error:'Invalid JSON.'});}
      if(!data||typeof data!=='object'||Array.isArray(data))return reply(400,{error:'Invalid request.'});
      if(req.url==='/v1/link'){try{return reply(200,await session.link(data.phone));}catch(e){return reply(409,{error:e.message});}}
      if(req.url==='/v1/logout'){await session.logout();return reply(200,session.info());}
      const {requestId,message,billNo}=data;
      if(typeof requestId!=='string'||!/^[-a-zA-Z0-9_]{16,100}$/.test(requestId)||typeof message!=='string'||!message.trim()||message.length>4000||typeof billNo!=='string'||!billNo.trim()||billNo.length>100)return reply(400,{error:'A request ID, bill number and message (up to 4000 characters) are required.'});
      let to;try{to=normalizePhone(data.to);}catch(e){return reply(400,{error:e.message});}
      const fingerprint=hash(JSON.stringify({to,message,billNo})).toString('hex'),previous=read.get(requestId);
      if(previous){
        if(previous.fingerprint!==fingerprint)return reply(409,{error:'This request ID belongs to another message.'});
        if(previous.state==='ACCEPTED')return reply(200,{accepted:true,messageId:previous.message_id,duplicate:true});
        return reply(409,{error:'The earlier send has an unknown outcome. Check the WhatsApp chat before creating a new reminder.',uncertain:true});
      }
      if(!session.info().connected)return reply(409,{error:'WhatsApp is offline. Link or reconnect in WhatsApp setup.'});
      if(sending||now()-lastSend<2000)return reply(429,{error:'Wait a moment before sending another reminder.'});
      sending=true;lastSend=now();
      try {
        reserve.run(requestId,fingerprint,'SUBMITTING',now());
        let timer;
        try{
          const result=await Promise.race([session.send(to,message),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Send timed out.')),20000);})]);
          finish.run('ACCEPTED',String(result?.id||result?.key?.id||''),requestId);
          return reply(200,{accepted:true,messageId:String(result?.id||result?.key?.id||'')});
        }catch{
          finish.run('UNKNOWN',null,requestId);
          return reply(502,{error:'Send could not be confirmed. Check the WhatsApp chat before sending again.',uncertain:true});
        }finally{clearTimeout(timer);}
      }finally{sending=false;}
    }catch{if(!res.headersSent)reply(500,{error:'Reminder service error. Check server logs.'});}
  });
  server.requestTimeout=30000;server.headersTimeout=10000;
  server.once('close',()=>db.close());
  return server;
}
