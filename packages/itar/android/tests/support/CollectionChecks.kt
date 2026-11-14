@file:Suppress("DEPRECATION")
package com.itar.adapter

import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.EventDispatcherListener
import com.facebook.react.uimanager.events.RCTEventEmitter

/** Debug-only checks and observation for the actual React consumer instrumentation. */
object CollectionChecks {
    fun leadingRowOffsets() {
        val list = CollectionEntry("catalogue", "", 0, true, true, 2, 420.0, 624.0)
        check(list.offset(0) == 0.0)
        check(list.offset(1) == 624.0)
        check(list.offset(2) == 1044.0)
        check(list.copy(leadingExtent = 0.0).offset(2) == 840.0)
        val invalid = """{"dataset":"1","nodes":[{"key":"list","parent":"","order":0,"scope":true,"enabled":true,"layout":2,"extent":420,"leadingExtent":-1}]}"""
        check(CollectionDocument.decode(invalid) == null)
    }
    data class Focus(val kind: Long, val key: String, val confirmed: Long)
    data class Request(val at: Long, val command: String?, val request: String?, val status: String?)
    data class Catalog(val dataset: Long, val orders: List<Int?>)
    fun catalog(root: SurfaceView, keys: List<String>): Catalog =
        Catalog(root.collections.dataset, keys.map { root.collections.entry(it)?.order })
    fun observe(root: SurfaceView, records: MutableList<Focus>, requests: MutableList<Request>): () -> Unit {
        val dispatcher = UIManagerHelper.getEventDispatcherForReactTag(root.context as ReactContext, root.id)
            ?: error("Missing request event dispatcher")
        val listener = EventDispatcherListener { event ->
            if (event.viewTag == root.id && event.eventName == "topRequestRecord") {
                // Read the event through a local sink; do not redispatch to React.
                // Unlike onRequestRecord, this includes pre-issue rejection and start receipts.
                event.dispatch(object : RCTEventEmitter {
                    override fun receiveEvent(targetTag: Int, eventName: String, params: WritableMap?) {
                        if (params != null) {
                            if (requests.size == 128) requests.removeAt(0)
                            requests.add(Request(event.timestampMs, params.getString("command"),
                                params.getString("request"), params.getString("status")))
                        }
                    }
                    override fun receiveTouches(eventName: String, touches: WritableArray, changedIndices: WritableArray) = Unit
                })
            }
        }
        dispatcher.addListener(listener)
        val previous = root.onFocusRecord
        root.onFocusRecord = { record ->
            if (record[2] == 0L) {
                check(records.size < 128) { "Collection observation bound exceeded" }
                val key = root.targets.keys.firstOrNull {
                    it.slot == record[4] && it.generation == record[5] && it.serial == record[6]
                }?.key ?: ""
                records.add(Focus(record[3], key, record[7]))
            }
            previous?.invoke(record)
        }
        return {
            dispatcher.removeListener(listener)
            if (!root.closed) root.onFocusRecord = previous
        }
    }
}
