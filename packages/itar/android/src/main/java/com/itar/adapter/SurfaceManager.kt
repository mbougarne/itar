package com.itar.adapter

import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.viewmanagers.ItarSurfaceManagerDelegate
import com.facebook.react.viewmanagers.ItarSurfaceManagerInterface

class SurfaceManager : ViewGroupManager<SurfaceView>(), ItarSurfaceManagerInterface<SurfaceView> {
    override fun getName() = "ItarSurface"
    override fun getDelegate() = ItarSurfaceManagerDelegate(this)
    override fun createViewInstance(context: ThemedReactContext) = SurfaceView(context).apply {
        bindRecords = { bind(it) }
        bind(this)
    }
    private fun bind(view: SurfaceView) = with(view) {
        onSurfaceRecord = { state -> publishPublic("topSurfaceRecord", mapOf("lifetime" to connection.lifetime.toString(), "state" to state)) }
        onFocusRecord = { record ->
            val mount = targets.keys.firstOrNull { it.slot == record[4] && it.generation == record[5] && it.serial == record[6] }
            publishPublic("topFocusRecord", mapOf("lifetime" to connection.lifetime.toString(),
                "request" to record[7].toString(), "occurrenceKey" to (mount?.key ?: ""), "mount" to record[6].toString(),
                "channel" to if (record[2] == 0L) "input" else "accessibility",
                "kind" to (listOf("managed", "unmanaged", "absent", "unknown").getOrNull(record[3].toInt()) ?: "unknown")))
        }
        onRequestRecord = { record ->
            emitRequest(record, commandRequests[record[2]] ?: "")
        }
    }
    override fun setActive(view: SurfaceView, value: Boolean) { view.active = value }
    override fun setProviderId(view: SurfaceView, value: String?) { view.configureProvider(value ?: "") }
    override fun setCollectionData(view: SurfaceView, value: String?) { view.collectionData = value ?: "" }
    override fun prepareCollection(view: SurfaceView, payload: String) { view.collections.acknowledge(payload) }
    override fun focus(view: SurfaceView, occurrenceKey: String) { view.focus(occurrenceKey) }
    override fun cancel(view: SurfaceView, lifetime: String, request: String) {
        val owner = lifetime.toLongOrNull()
        val id = request.toLongOrNull()
        if (owner == null || owner <= 0 || id == null || id <= 0) view.rejectCommand() else view.cancel(owner, id)
    }
    override fun showDialog(view: SurfaceView) { view.showDialog() }
    override fun dismissDialog(view: SurfaceView) { view.dismissDialog() }
    override fun focusRequest(view: SurfaceView, occurrenceKey: String, command: String) { view.mountCommands.enqueue(MountCommands.Kind.FOCUS, occurrenceKey, command) }
    override fun cancelRequest(view: SurfaceView, command: String) { view.mountCommands.enqueue(MountCommands.Kind.CANCEL, "", command) }
    override fun restoreScopeRequest(view: SurfaceView, scopeKey: String, command: String) { view.mountCommands.enqueue(MountCommands.Kind.RESTORE, scopeKey, command) }
    override fun onAfterUpdateTransaction(view: SurfaceView) { super.onAfterUpdateTransaction(view); view.updateActivity() }
    override fun onDropViewInstance(view: SurfaceView) { view.bindRecords = null; view.close(); super.onDropViewInstance(view) }
    override fun getExportedCustomDirectEventTypeConstants() = mutableMapOf<String, Any>(
        "topFocusRecord" to mapOf("registrationName" to "onFocusRecord"),
        "topSurfaceRecord" to mapOf("registrationName" to "onSurfaceRecord"),
        "topCollectionRecord" to mapOf("registrationName" to "onCollectionRecord"),
        "topRequestRecord" to mapOf("registrationName" to "onRequestRecord"))
}
