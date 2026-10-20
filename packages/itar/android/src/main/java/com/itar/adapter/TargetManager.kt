package com.itar.adapter

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.viewmanagers.ItarTargetManagerDelegate
import com.facebook.react.viewmanagers.ItarTargetManagerInterface

class TargetManager : SimpleViewManager<TargetView>(), ItarTargetManagerInterface<TargetView> {
    override fun getName() = "ItarTarget"
    override fun getDelegate() = ItarTargetManagerDelegate(this)
    override fun createViewInstance(context: ThemedReactContext) = TargetView(context).apply {
        onActivation = { lifetime, mount, sequence, source ->
            NativeEvents.emit(this, "topActivate", mapOf("lifetime" to lifetime.toString(), "occurrenceKey" to mount.key,
                "mount" to mount.serial.toString(), "sequence" to sequence.toString(), "source" to source,
                "provider" to (surface?.providerId ?: ""), "registration" to registrationId))
        }
    }
    override fun getExportedCustomDirectEventTypeConstants() = mutableMapOf<String, Any>(
        "topActivate" to mapOf("registrationName" to "onActivate"))
    override fun setOccurrenceKey(view: TargetView, value: String?) { view.occurrenceKey = value ?: "" }
    override fun setScopeKey(view: TargetView, value: String?) { view.scopeKey = value ?: "" }
    override fun setRegistrationId(view: TargetView, value: String?) { view.registrationId = value ?: "" }
    override fun setCollectionDataset(view: TargetView, value: String?) { view.collectionDataset = value ?: "" }
    override fun setLabel(view: TargetView, value: String?) { view.text = value; view.contentDescription = value }
    override fun setEnabled(view: TargetView, value: Boolean) { view.isEnabled = value }
    override fun setOrder(view: TargetView, value: Int) { view.order = value }
    override fun setBaseColor(view: TargetView, value: Int?) { view.setBaseColor(value) }
    override fun setFocusColor(view: TargetView, value: Int?) { view.focusColor = value }
    override fun onAfterUpdateTransaction(view: TargetView) { super.onAfterUpdateTransaction(view); view.commitProps() }
    override fun onDropViewInstance(view: TargetView) {
        view.onActivation = null
        view.dropLogical()
        super.onDropViewInstance(view)
    }
}
