package com.satraders.billing;

import android.app.Activity;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.google.android.gms.tasks.Tasks;
import com.google.firebase.firestore.CollectionReference;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.QuerySnapshot;
import com.google.firebase.firestore.Source;
import com.google.firebase.firestore.WriteBatch;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class FirebaseBridge {
    private static final Set<String> STORES = Collections.unmodifiableSet(new java.util.HashSet<>(Arrays.asList("bills", "customers", "customBills", "slips", "challans", "inventory", "settings")));
    private final Activity activity;
    private final WebView webView;
    private final FirebaseFirestore firestore;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Map<String, String> storeHashes = new ConcurrentHashMap<>();

    FirebaseBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        this.firestore = FirebaseFirestore.getInstance();
    }

    private CollectionReference collection(String store) { return firestore.collection("sa_traders").document("business").collection(store); }
    private String documentId(String key) { return Base64.encodeToString(key.getBytes(StandardCharsets.UTF_8), Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING); }
    private boolean valid(String requestId, String store) { if (requestId != null && requestId.length() <= 160 && STORES.contains(store)) return true; failure(requestId, "Invalid Firebase request."); return false; }

    private static Object convert(Object value) throws Exception {
        if (value == JSONObject.NULL) return null;
        if (value instanceof JSONObject) return toMap((JSONObject) value);
        if (value instanceof JSONArray) return toList((JSONArray) value);
        return value;
    }
    private static Map<String, Object> toMap(JSONObject object) throws Exception { Map<String, Object> out = new HashMap<>(); Iterator<String> keys = object.keys(); while (keys.hasNext()) { String key = keys.next(); out.put(key, convert(object.get(key))); } return out; }
    private static List<Object> toList(JSONArray array) throws Exception { List<Object> out = new ArrayList<>(); for (int x = 0; x < array.length(); x++) out.add(convert(array.get(x))); return out; }
    private static String json(Object value) { Object wrapped = value == null ? JSONObject.NULL : JSONObject.wrap(value); return wrapped == null ? "null" : wrapped.toString(); }
    private static String payload(Object value) { return Base64.encodeToString(json(value).getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP); }
    private static String hash(String value) { try { byte[] bytes = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)); return Base64.encodeToString(bytes, Base64.NO_WRAP); } catch (Exception ignored) { return String.valueOf(value.hashCode()); } }

    private void emit(String requestId, boolean ok, Object value) {
        String script = "window.__firebaseResult(" + JSONObject.quote(requestId == null ? "" : requestId) + "," + ok + "," + JSONObject.quote(payload(value)) + ");";
        activity.runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }
    private void pushStore(String store, List<Map<String, Object>> rows, String serialized) {
        String script = "window.__firebaseStoreUpdate(" + JSONObject.quote(store) + "," + JSONObject.quote(Base64.encodeToString(serialized.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP)) + ");";
        activity.runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }
    private void success(String requestId, Object value) { emit(requestId, true, value); }
    private void failure(String requestId, Exception error) { failure(requestId, error.getMessage() == null ? "Firebase request failed." : error.getMessage()); }
    private void failure(String requestId, String message) { emit(requestId, false, Collections.singletonMap("message", message)); }
    private List<Map<String, Object>> rows(QuerySnapshot snapshot) { List<DocumentSnapshot> docs = new ArrayList<>(snapshot.getDocuments()); docs.sort((a,b) -> a.getId().compareTo(b.getId())); List<Map<String, Object>> rows = new ArrayList<>(); for (DocumentSnapshot doc : docs) rows.add(doc.getData()); return rows; }

    @JavascriptInterface public void all(String requestId, String store) {
        if (!valid(requestId, store)) return;
        final boolean[] answered = {false};
        collection(store).get(Source.CACHE).addOnSuccessListener(io, snapshot -> {
            List<Map<String,Object>> data = rows(snapshot); String serialized = json(data); storeHashes.put(store, hash(serialized));
            // An empty cache can mean a cold install, so wait for the server once before seeding defaults.
            if (!data.isEmpty()) { answered[0] = true; success(requestId, data); }
            refreshFromServer(requestId, store, answered);
        }).addOnFailureListener(io, ignored -> refreshFromServer(requestId, store, answered));
    }

    private void refreshFromServer(String requestId, String store, boolean[] answered) {
        collection(store).get(Source.SERVER).addOnSuccessListener(io, snapshot -> {
            List<Map<String,Object>> data = rows(snapshot); String serialized = json(data), newHash = hash(serialized), oldHash = storeHashes.put(store, newHash);
            if (!answered[0]) { answered[0] = true; success(requestId, data); }
            else if (!newHash.equals(oldHash)) pushStore(store, data, serialized);
        }).addOnFailureListener(io, error -> { if (!answered[0]) failure(requestId, error); });
    }

    @JavascriptInterface public void get(String requestId, String store, String key) {
        if (!valid(requestId, store) || key == null || key.isEmpty()) return;
        collection(store).document(documentId(key)).get(Source.CACHE).addOnSuccessListener(io, doc -> success(requestId, doc.exists() ? doc.getData() : null)).addOnFailureListener(io, ignored -> collection(store).document(documentId(key)).get(Source.SERVER).addOnSuccessListener(io, doc -> success(requestId, doc.exists() ? doc.getData() : null)).addOnFailureListener(io, error -> failure(requestId, error)));
    }

    @JavascriptInterface public void put(String requestId, String store, String key, String json) {
        if (!valid(requestId, store) || key == null || key.isEmpty()) return;
        io.execute(() -> { try { collection(store).document(documentId(key)).set(toMap(new JSONObject(json))).addOnSuccessListener(io, ignored -> success(requestId, Collections.singletonMap("key", key))).addOnFailureListener(io, error -> failure(requestId, error)); } catch (Exception error) { failure(requestId, "Invalid record: " + error.getMessage()); } });
    }

    @JavascriptInterface public void batchPut(String requestId, String operationsJson) {
        io.execute(() -> { try { JSONArray operations = new JSONArray(operationsJson); if (operations.length() > 450) throw new IllegalArgumentException("Batch is too large."); WriteBatch batch = firestore.batch(); for (int x=0;x<operations.length();x++) { JSONObject op=operations.getJSONObject(x); String store=op.getString("store"),key=op.getString("key"); if (!STORES.contains(store) || key.isEmpty()) throw new IllegalArgumentException("Invalid batch operation."); batch.set(collection(store).document(documentId(key)), toMap(op.getJSONObject("document"))); } batch.commit().addOnSuccessListener(io, ignored -> success(requestId, Collections.singletonMap("written", operations.length()))).addOnFailureListener(io, error -> failure(requestId,error)); } catch (Exception error) { failure(requestId,"Invalid batch: "+error.getMessage()); } });
    }

    @JavascriptInterface public void remove(String requestId, String store, String key) { if (!valid(requestId, store) || key == null || key.isEmpty()) return; collection(store).document(documentId(key)).delete().addOnSuccessListener(io, ignored -> success(requestId, Collections.singletonMap("deleted", true))).addOnFailureListener(io, error -> failure(requestId, error)); }
    @JavascriptInterface public void clear(String requestId, String store) { if (!valid(requestId, store)) return; collection(store).get(Source.SERVER).addOnSuccessListener(io, snapshot -> { try { List<com.google.android.gms.tasks.Task<Void>> commits=new ArrayList<>(); WriteBatch batch=firestore.batch(); int count=0,inBatch=0; for(DocumentSnapshot doc:snapshot.getDocuments()){batch.delete(doc.getReference());count++;inBatch++;if(inBatch==450){commits.add(batch.commit());batch=firestore.batch();inBatch=0;}} if(inBatch>0)commits.add(batch.commit()); final int deleted=count; Tasks.whenAll(commits).addOnSuccessListener(io, ignored -> success(requestId,Collections.singletonMap("deleted",deleted))).addOnFailureListener(io,error -> failure(requestId,error)); } catch(Exception error){failure(requestId,error);} }).addOnFailureListener(io,error -> failure(requestId,error)); }
}
