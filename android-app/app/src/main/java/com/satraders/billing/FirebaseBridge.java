package com.satraders.billing;

import android.app.Activity;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.util.Base64;

import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.QueryDocumentSnapshot;
import com.google.firebase.firestore.WriteBatch;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.nio.charset.StandardCharsets;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;

public final class FirebaseBridge {
    private static final Set<String> STORES = Set.of(
            "bills", "customers", "customBills", "slips", "challans", "inventory", "settings");
    private final Activity activity;
    private final WebView webView;
    private final FirebaseFirestore firestore;

    FirebaseBridge(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        this.firestore = FirebaseFirestore.getInstance();
    }

    private boolean valid(String requestId, String store) {
        if (requestId == null || requestId.length() > 160 || !STORES.contains(store)) {
            failure(requestId, "Invalid Firebase request.");
            return false;
        }
        return true;
    }

    private com.google.firebase.firestore.CollectionReference collection(String store) {
        return firestore.collection("sa_traders").document("business").collection(store);
    }

    private String documentId(String key) {
        return Base64.encodeToString(key.getBytes(StandardCharsets.UTF_8),
                Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
    }

    @JavascriptInterface
    public void get(String requestId, String store, String key) {
        if (!valid(requestId, store) || key == null || key.isBlank()) return;
        collection(store).document(documentId(key)).get()
                .addOnSuccessListener(snapshot -> success(requestId, snapshot.exists() ? snapshot.getData() : null))
                .addOnFailureListener(error -> failure(requestId, error));
    }

    @JavascriptInterface
    public void all(String requestId, String store) {
        if (!valid(requestId, store)) return;
        collection(store).get().addOnSuccessListener(snapshot -> {
            List<Object> rows = new ArrayList<>();
            for (QueryDocumentSnapshot document : snapshot) rows.add(document.getData());
            success(requestId, rows);
        }).addOnFailureListener(error -> failure(requestId, error));
    }

    @JavascriptInterface
    public void put(String requestId, String store, String key, String json) {
        if (!valid(requestId, store) || key == null || key.isBlank()) return;
        try {
            Map<String,Object> document = toMap(new JSONObject(json));
            collection(store).document(documentId(key)).set(document)
                    .addOnSuccessListener(unused -> success(requestId, Map.of("key", key)))
                    .addOnFailureListener(error -> failure(requestId, error));
        } catch (Exception error) {
            failure(requestId, "Invalid record: " + error.getMessage());
        }
    }

    @JavascriptInterface
    public void remove(String requestId, String store, String key) {
        if (!valid(requestId, store) || key == null || key.isBlank()) return;
        collection(store).document(documentId(key)).delete()
                .addOnSuccessListener(unused -> success(requestId, Map.of("deleted", true)))
                .addOnFailureListener(error -> failure(requestId, error));
    }

    @JavascriptInterface
    public void clear(String requestId, String store) {
        if (!valid(requestId, store)) return;
        collection(store).get().addOnSuccessListener(snapshot -> {
            List<Task<Void>> commits = new ArrayList<>();
            WriteBatch batch = firestore.batch();
            int count = 0, batchSize = 0;
            for (DocumentSnapshot document : snapshot.getDocuments()) {
                batch.delete(document.getReference());
                count++;
                batchSize++;
                if (batchSize == 450) {
                    commits.add(batch.commit());
                    batch = firestore.batch();
                    batchSize = 0;
                }
            }
            if (batchSize > 0) commits.add(batch.commit());
            int deleted = count;
            Tasks.whenAll(commits).addOnSuccessListener(unused -> success(requestId, Map.of("deleted", deleted)))
                    .addOnFailureListener(error -> failure(requestId, error));
        }).addOnFailureListener(error -> failure(requestId, error));
    }

    private void success(String requestId, Object value) {
        emit(requestId, true, JSONObject.wrap(value == null ? JSONObject.NULL : value).toString());
    }

    private void failure(String requestId, Exception error) {
        failure(requestId, error.getMessage() == null ? "Firebase request failed." : error.getMessage());
    }

    private void failure(String requestId, String message) {
        emit(requestId, false, new JSONObject(Map.of("message", message)).toString());
    }

    private void emit(String requestId, boolean ok, String json) {
        String script = "window.__firebaseResult(" + JSONObject.quote(requestId == null ? "" : requestId)
                + "," + ok + "," + JSONObject.quote(json) + ");";
        activity.runOnUiThread(() -> webView.evaluateJavascript(script, null));
    }

    private static Map<String,Object> toMap(JSONObject object) throws JSONException {
        Map<String,Object> map = new HashMap<>();
        Iterator<String> keys = object.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            map.put(key, convert(object.get(key)));
        }
        return map;
    }

    private static List<Object> toList(JSONArray array) throws JSONException {
        List<Object> list = new ArrayList<>();
        for (int index = 0; index < array.length(); index++) list.add(convert(array.get(index)));
        return list;
    }

    private static Object convert(Object value) throws JSONException {
        if (value == JSONObject.NULL) return null;
        if (value instanceof JSONObject) return toMap((JSONObject) value);
        if (value instanceof JSONArray) return toList((JSONArray) value);
        return value;
    }
}
