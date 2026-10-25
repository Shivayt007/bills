package com.satraders.billing;
import java.util.List;
import java.util.Collections;
import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
public class SATradersPaymentsPackage implements ReactPackage {
 @Override public List<NativeModule> createNativeModules(ReactApplicationContext c){return Collections.singletonList(new SATradersPaymentsModule(c));}
 @Override public List<ViewManager> createViewManagers(ReactApplicationContext c){return Collections.emptyList();}
}
