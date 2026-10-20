// Extracted/adapted from YouPI-PG's WhatsAppBerryService: pairing, saved session and text transport only.
import fs from 'node:fs';
import path from 'node:path';

export function normalizePhone(value) {
  let phone=String(value||'').trim();
  if(!/^[+\d ()-]+$/.test(phone))throw new Error('Enter a valid customer mobile number.');
  phone=phone.replace(/[^0-9]/g,'');
  if(phone.length===11&&phone.startsWith('0'))phone=phone.slice(1);
  if(phone.length===10)phone='91'+phone;
  if(!/^[1-9]\d{9,14}$/.test(phone))throw new Error('Enter a valid mobile number with country code.');
  return phone;
}
export class WhatsAppSession {
  constructor({BerryProtocol,toDataURL,dataDir}) {
    this.BerryProtocol=BerryProtocol;this.toDataURL=toDataURL;this.dataDir=dataDir;
    this.status='DISCONNECTED';this.qr=null;this.code=null;this.client=null;this.generation=0;this.busy=false;
    fs.mkdirSync(dataDir,{recursive:true});
  }
  info(){return {status:this.status,connected:this.status==='CONNECTED',qr:this.qr,pairingCode:this.code};}
  async link(phone) {
    if(this.busy)throw new Error('Linking is already in progress. Refresh status.');
    if(this.status==='CONNECTED')throw new Error('WhatsApp is already connected. Disconnect before changing accounts.');
    if(phone)phone=normalizePhone(phone);
    this.busy=true;
    try {
      const generation=++this.generation;
      if(this.client)await this.client.disconnect();
      this.qr=null;this.code=null;this.status='CONNECTING';
      const client=this.client=new this.BerryProtocol({sessionId:'sa_traders',authFolder:path.join(this.dataDir,'auth'),databasePath:path.join(this.dataDir,'berry.db'),printQrInTerminal:false,reconnectDelayMs:3000,reconnectMaxAttempts:15});
      const active=()=>this.generation===generation;
      const onQr=async raw=>{
        if(!active()||!raw||this.status==='CONNECTED')return;
        try{const qr=await this.toDataURL(String(raw),{width:300,margin:2});if(active()&&this.status!=='CONNECTED'){this.qr=qr;this.status='QR_READY';}}catch{if(active())this.status='DISCONNECTED';}
      };
      client.on('auth.qr',({value})=>onQr(value));
      client.on('auth.pairing_code',({code})=>{if(active()){this.code=String(code);this.qr=null;this.status='PAIRING_CODE_READY';}});
      client.on('connection.open',()=>{if(active()){this.status='CONNECTED';this.qr=null;this.code=null;}});
      client.on('connection.close',()=>{if(active()){this.status='DISCONNECTED';this.qr=null;this.code=null;}});
      // Let the SDK manage reconnects; do not create a second socket or report a saved session as connected.
      const connection=phone?client.connectWithPairingCode(phone):client.connectWithQr();
      Promise.resolve(connection).catch(()=>{if(active()&&this.status==='CONNECTING')this.status='DISCONNECTED';});
      return this.info();
    }finally{this.busy=false;}
  }
  async logout(){
    ++this.generation;
    const client=this.client;this.client=null;this.status='DISCONNECTED';this.qr=null;this.code=null;
    // Ask WhatsApp to unlink the device as well as stopping the local socket.
    if(client){try{await client.logout();}finally{await client.disconnect();}}
  }
  async send(to,message){
    if(this.status!=='CONNECTED'||!this.client)throw new Error('WhatsApp is not connected. Link it in WhatsApp setup.');
    return this.client.sendText(normalizePhone(to)+'@s.whatsapp.net',message);
  }
}
