package com.itar.probe

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewManager

class ProbePackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = emptyList()
    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
        listOf(object : SimpleViewManager<ProbeRoot>() {
            override fun getExportedCustomDirectEventTypeConstants() =
                mutableMapOf<String, Any>("topActivate" to mapOf("registrationName" to "onNativeActivation"))
            override fun getName() = "ItarHostProbe"
            override fun createViewInstance(context: ThemedReactContext) = ProbeRoot(context)
            override fun onDropViewInstance(view: ProbeRoot) {
                view.dispose()
                super.onDropViewInstance(view)
            }
        })
}
