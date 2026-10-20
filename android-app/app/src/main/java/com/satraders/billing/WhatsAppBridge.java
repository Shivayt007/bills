package com.satraders.billing;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.net.HttpURLConnection;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** HTTPS transport for the shop's standalone reminder service. The bearer token never returns to JS. */
public final class WhatsAppBridge {
    private final Activity activity;
    private final WebView web;
    private final SharedPreferences prefs;
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private static final String ALIAS="sa_whatsapp_reminder_token";
    public WhatsAppBridge(Activity activity,WebView web){this.activity=activity;this.web=web;this.prefs=activity.getSharedPreferences("whatsapp_service",Context.MODE_PRIVATE);}
    private synchronized SecretKey key() throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore");store.load(null);
        if(store.containsAlias(ALIAS))return (SecretKey)store.getKey(ALIAS,null);
        KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    private String encrypt(String token) throws Exception {
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());
        return Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(token.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);
    }
    private String token() throws Exception {
        String[] parts=prefs.getString("token","").split(":");if(parts.length!=2)throw new IllegalArgumentException("Save the WhatsApp service URL and token first.");
        Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8);
    }
    @JavascriptInterface public String config(){
        try{return new JSONObject().put("url",prefs.getString("url","")).put("configured",prefs.contains("token")).toString();}catch(Exception e){return "{}";}
    }
    @JavascriptInterface public String save(String rawUrl,String rawToken){
        try {
            URL url=new URL(rawUrl.trim());
            if(!"https".equals(url.getProtocol())||url.getHost().isEmpty()||url.getUserInfo()!=null||url.getQuery()!=null||url.getRef()!=null||!(url.getPath().isEmpty()||url.getPath().equals("/")))throw new IllegalArgumentException("Use the HTTPS service domain only, without a path.");
            String base=url.toString().replaceAll("/+$","");
            String value=rawToken==null?"":rawToken.trim();
            if(value.isEmpty()){
                if(!prefs.contains("token")||!base.equals(prefs.getString("url","")))throw new IllegalArgumentException("Enter the API token for this server.");
                return "ok";
            }
            if(!value.matches("[A-Za-z0-9_-]{32,256}"))throw new IllegalArgumentException("Use the server's token (32–256 letters, digits, hyphens or underscores).");
            if(!prefs.edit().putString("url",base).putString("token",encrypt(value)).commit())throw new IllegalArgumentException("Could not save configuration.");
            return "ok";
        }catch(Exception error){return error instanceof IllegalArgumentException?error.getMessage():"Could not save WhatsApp setup securely.";}
    }
    @JavascriptInterface public void request(String id,String action,String json){
        if(id==null||!id.matches("[A-Za-z0-9_-]{1,100}"))return;
        worker.execute(()->{
            HttpURLConnection connection=null;
            try {
                String path;
                switch(action){case "status":path="/v1/status";break;case "link":path="/v1/link";break;case "logout":path="/v1/logout";break;case "send":path="/v1/reminders";break;default:throw new IllegalArgumentException("Unknown WhatsApp action.");}
                String secret=token(),base=prefs.getString("url","");
                connection=(HttpURLConnection)new URL(base+path).openConnection();connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(10000);connection.setReadTimeout(25000);
                connection.setRequestProperty("Authorization","Bearer "+secret);connection.setRequestProperty("Accept","application/json");
                if(!action.equals("status")){
                    byte[] bytes=new JSONObject(json==null?"{}":json).toString().getBytes(StandardCharsets.UTF_8);
                    if(bytes.length>16384)throw new IllegalArgumentException("Reminder is too long.");
                    connection.setRequestMethod("POST");connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json");connection.setFixedLengthStreamingMode(bytes.length);
                    try(java.io.OutputStream output=connection.getOutputStream()){output.write(bytes);}
                }
                int code=connection.getResponseCode();
                try(InputStream input=code>=400?connection.getErrorStream():connection.getInputStream();ByteArrayOutputStream output=new ByteArrayOutputStream()){
                    if(input==null)throw new IllegalArgumentException("Reminder server returned HTTP "+code);
                    byte[] buffer=new byte[4096];int count;while((count=input.read(buffer))!=-1){if(output.size()+count>256*1024)throw new IllegalArgumentException("Server response is too large.");output.write(buffer,0,count);}
                    JSONObject result=new JSONObject(output.toString("UTF-8"));
                    if(code<200||code>=300)throw new IllegalArgumentException(result.optString("error","Reminder server returned HTTP "+code));
                    reply(id,true,result);
                }
            }catch(Exception error){
                String message=error instanceof IllegalArgumentException?error.getMessage():"Could not confirm the request. Check your connection and WhatsApp chat before retrying a send.";
                try{reply(id,false,new JSONObject().put("error",message));}catch(Exception ignored){}
            }finally{if(connection!=null)connection.disconnect();}
        });
    }
    public void close(){worker.shutdownNow();}
    private void reply(String id,boolean ok,JSONObject data){
        String script="window.SAWhatsAppResult&&window.SAWhatsAppResult("+JSONObject.quote(id)+","+ok+","+data.toString()+")";
        activity.runOnUiThread(()->{if(!activity.isFinishing()&&!activity.isDestroyed())web.evaluateJavascript(script,null);});
    }
}
