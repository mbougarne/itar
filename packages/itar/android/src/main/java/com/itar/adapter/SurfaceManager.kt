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
        onFocusRecord = { record ->
            val mount = targets.keys.firstOrNull { it.slot == record[4] && it.generation == record[5] && it.serial == record[6] }
            NativeEvents.emit(this, "topFocusRecord", mapOf("lifetime" to connection.lifetime.toString(),
                "request" to record[7].toString(), "occurrenceKey" to (mount?.key ?: ""), "mount" to record[6].toString(),
                "channel" to if (record[2] == 0L) "input" else "accessibility",
                "kind" to (listOf("managed", "unmanaged", "absent", "unknown").getOrNull(record[3].toInt()) ?: "unknown")))
        }
        onRequestRecord = { record ->
            val statuses = listOf("started", "joined", "busy", "unavailable", "stale", "invalid", "cancelled", "unchanged",
                "confirmed", "reconciled", "expired", "backward_time", "exhausted", "resync", "disposed", "issued", "waiting")
            NativeEvents.emit(this, "topRequestRecord", mapOf("lifetime" to connection.lifetime.toString(),
                "request" to record[2].toString(), "status" to (statuses.getOrNull(record[1].toInt()) ?: "invalid")))
        }
    }
    override fun setActive(view: SurfaceView, value: Boolean) { view.active = value }
    override fun focus(view: SurfaceView, occurrenceKey: String) { view.focus(occurrenceKey) }
    override fun cancel(view: SurfaceView, lifetime: String, request: String) {
        val owner = lifetime.toLongOrNull()
        val id = request.toLongOrNull()
        if (owner == null || owner <= 0 || id == null || id <= 0) view.rejectCommand() else view.cancel(owner, id)
    }
    override fun showDialog(view: SurfaceView) { view.showDialog() }
    override fun dismissDialog(view: SurfaceView) { view.dismissDialog() }
    override fun onAfterUpdateTransaction(view: SurfaceView) { super.onAfterUpdateTransaction(view); view.updateActivity() }
    override fun onDropViewInstance(view: SurfaceView) { view.bindRecords = null; view.close(); super.onDropViewInstance(view) }
    override fun getExportedCustomDirectEventTypeConstants() = mutableMapOf<String, Any>(
        "topFocusRecord" to mapOf("registrationName" to "onFocusRecord"),
        "topRequestRecord" to mapOf("registrationName" to "onRequestRecord"))
}
