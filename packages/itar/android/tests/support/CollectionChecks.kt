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
    fun rowEntryPolicy() {
        val text = """{"dataset":"1","nodes":[
            {"key":"outer","parent":"","order":0,"scope":true,"enabled":true,"layout":2,"extent":200},
            {"key":"header","parent":"outer","order":0,"scope":true,"enabled":true,"layout":1,"extent":100},
            {"key":"row","parent":"outer","order":1,"scope":true,"enabled":true,"layout":1,"extent":100},
            {"key":"source","parent":"header","order":0,"scope":false,"enabled":true,"layout":0,"extent":0},
            {"key":"source1","parent":"header","order":1,"scope":false,"enabled":true,"layout":0,"extent":0},
            {"key":"source2","parent":"header","order":2,"scope":false,"enabled":true,"layout":0,"extent":0},
            {"key":"disabled","parent":"row","order":0,"scope":false,"enabled":false,"layout":0,"extent":0},
            {"key":"first","parent":"row","order":1,"scope":false,"enabled":true,"layout":0,"extent":0},
            {"key":"nearest","parent":"row","order":2,"scope":false,"enabled":true,"layout":0,"extent":0}]}"""
        val initial = checkNotNull(CollectionDocument.decode(text))
        check(initial.nodes.all { it.rowEntry == 0 })
        val policy = text.replace("\"extent\":200", "\"extent\":200,\"rowEntry\":1")
        for (value in listOf("2", "-1", "0.5", "\"1\"", "null")) {
            check(CollectionDocument.decode(policy.replace("\"rowEntry\":1", "\"rowEntry\":$value")) == null)
        }
        Connection().use { connection ->
            fun publish(document: CollectionDocument, values: LongArray = document.values()) = connection.collections(
                document.dataset, document.nodes.map { it.key }.toTypedArray(), document.nodes.map { it.parent }.toTypedArray(), values)
            fun node(key: String) = connection.exchange(25, key = key).copyOfRange(1, 3)
            fun query(direction: Long = 3, owner: Long = 0) = connection.exchange(6, longArrayOf(direction, owner))
            fun destination(direction: Long = 3): LongArray {
                val result = query(direction)
                check(result[0] == 0L && result[1] == 1L) // Unrealized, not a fabricated focus observation.
                return result.copyOfRange(2, 4)
            }
            check(publish(initial) == 0L)
            val parent = node("header")
            val mounted = connection.exchange(1, longArrayOf(0, 0, 1, 0, 1, 1, 2, 200, 0, 80, 60, 0,
                parent[0], parent[1], 1), "source2")
            check(mounted[0] == 0L)
            val source = node("source2")
            check(connection.exchange(4, longArrayOf(0, 0, source[0], source[1], 1))[0] == 0L)
            check(destination().contentEquals(node("nearest")))
            check(connection.exchange(7, longArrayOf(3, 0, 1, 500))[1] == 0L)
            check(connection.exchange(5)[6] != 0L)
            val first = checkNotNull(CollectionDocument.decode(policy)).copy(dataset = 2)
            check(publish(first) == 0L)
            check(connection.exchange(5)[6] == 0L) // Old-policy realization was canceled.
            val row = node("row")
            check(connection.exchange(1, longArrayOf(0, 0, 2, 0, 1, 1, 2, 200, 200, 80, 60, 0,
                row[0], row[1], 2), "nearest")[0] == 0L)
            check(destination().contentEquals(node("first")))
            check(query(owner = 3)[1] == 4L) // Screen reader retains directional ownership.
            check(publish(initial) == 3L) // Older policy dataset is stale.
            check(publish(first.copy(dataset = 3), first.values().also { it[5] = 2 }) == -2L)
            check(publish(first.copy(dataset = 3), first.values().copyOf(5)) == -2L)
            check(destination().contentEquals(node("first")))
            val invalid = first.copy(dataset = 3, nodes = first.nodes.map {
                if (it.key == "outer") it.copy(rowEntry = 0) else if (it.key == "row") it.copy(rowEntry = 1) else it
            })
            check(publish(invalid) == 2L)
            check(destination().contentEquals(node("first")))
            val nearest = node("nearest")
            check(connection.exchange(4, longArrayOf(0, 0, nearest[0], nearest[1], 2))[0] == 0L)
            check(destination(direction = 2).contentEquals(node("source"))) // First entry into the header.
            check(publish(initial.copy(dataset = 3)) == 0L)
            val restored = query(direction = 2)
            check(restored[1] == 0L && restored.copyOfRange(2, 4).contentEquals(source))
        }
    }
    fun leadingRowOffsets() {
        val row = CollectionEntry("row", "", 0, true, true, 1, 100.0)
        check(row.horizontalOffset(400.0,800.0,0.0,300.0,1000.0,false) == 400)
        check(row.horizontalOffset(400.0,500.0,100.0,300.0,1000.0,false) == 200)
        check(row.copy(horizontalAlignment = "leading").horizontalOffset(400.0,500.0,100.0,300.0,1000.0,false) == 400)
        check(row.copy(horizontalAlignment = "leading").horizontalOffset(500.0,600.0,700.0,300.0,1000.0,true) == 300)
        check(row.copy(horizontalAlignment = "leading").horizontalOffset(900.0,1000.0,300.0,350.0,1000.0,false) == 650)
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
