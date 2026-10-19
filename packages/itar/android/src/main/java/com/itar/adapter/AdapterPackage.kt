package com.itar.adapter

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class AdapterPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = emptyList()
    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
        listOf(SurfaceManager(), ScopeManager(), TargetManager())
}
