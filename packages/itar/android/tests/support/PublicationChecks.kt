package com.itar.adapter

import android.content.Context
import android.view.ViewTreeObserver
import org.json.JSONArray
import org.json.JSONObject

/** Debug-only native publication fixture; no network or React data is involved. */
object PublicationChecks {
    class Fixture internal constructor(val root: SurfaceView, val row: ScopeView, val target: TargetView) {
        internal var mount: Mount? = null
        internal var losses = 0
        internal var observer: ViewTreeObserver.OnGlobalFocusChangeListener? = null
    }
    private fun document(dataset: Int, count: Int): String {
        val nodes = JSONArray().put(JSONObject().put("key", "row").put("parent", "").put("order", 0)
            .put("scope", true).put("enabled", true).put("layout", 1).put("extent", 220))
        repeat(count) { index -> nodes.put(JSONObject().put("key", "item-$index").put("parent", "row").put("order", index)
            .put("scope", false).put("enabled", true).put("layout", 0).put("extent", 0)) }
        return JSONObject().put("dataset", dataset.toString()).put("nodes", nodes).toString()
    }
    fun create(context: Context): Fixture {
        val root = SurfaceView(context)
        val row = ScopeView(context).apply { scopeKey = "row"; collectionDataset = "1"; layout = "row" }
        val target = TargetView(context).apply {
            occurrenceKey = "item-0"; scopeKey = "row"; collectionDataset = "1"
            text = "Publication source"; contentDescription = text
        }
        return Fixture(root, row, target)
    }
    fun begin(f: Fixture) { f.root.collectionData = document(1, 2) }
    fun dataset(f: Fixture) = f.root.collections.dataset
    fun mount(f: Fixture) { f.row.addView(f.target); f.root.addView(f.row) }
    private fun geometry(f: Fixture) {
        f.root.layout(0, 0, 800, 600); f.row.layout(0, 0, 800, 600); f.target.layout(10, 10, 210, 90)
        f.root.geometryChanged(); f.root.refreshGeometry()
    }
    fun focus(f: Fixture) {
        geometry(f)
        check(f.target.isFocusable && f.target.requestFocus())
        f.mount = f.target.mount ?: error("Missing native mount")
        f.observer = ViewTreeObserver.OnGlobalFocusChangeListener { _, next -> if (next !== f.target) f.losses++ }
        f.root.viewTreeObserver.addOnGlobalFocusChangeListener(f.observer)
    }
    fun invalidate(f: Fixture, kind: String) {
        val next = JSONObject(document(2, 2))
        val nodes = next.getJSONArray("nodes")
        when (kind) {
            "item" -> { nodes.getJSONObject(1).put("order", 1); nodes.getJSONObject(2).put("order", 0) }
            "ancestor" -> nodes.getJSONObject(0).put("extent", 260)
            "delete" -> { nodes.remove(1); nodes.getJSONObject(1).put("order", 0) }
            else -> error("Unknown fixture")
        }
        f.root.collectionData = next.toString()
    }
    fun invalidated(f: Fixture) {
        geometry(f)
        check(f.target.mount == null && !f.target.isFocusable) { "Changed or deleted declaration retained host authority" }
        f.target.commitProps(); geometry(f)
        check(f.target.mount == null) { "Stale declaration revived an invalidated target" }
    }
    fun append(f: Fixture) { f.root.collectionData = document(2, 3) }
    fun mountAheadOfRow(f: Fixture) {
        f.target.collectionDataset = "2"
        f.target.commitProps()
        check(f.target.mount == null && !f.target.isFocusable)
    }
    fun publishRow(f: Fixture) { f.row.collectionDataset = "2"; f.row.commit() }
    fun verifyLateRegistration(f: Fixture) {
        geometry(f)
        check(f.target.mount != null && f.target.isFocusable && f.target.requestFocus()) {
            "A visible current cell remained unavailable after its parent caught up"
        }
    }
    fun retainedBeforeReactCommit(f: Fixture) {
        check(f.target.collectionDataset == "1")
        geometry(f)
        check(f.target.mount == f.mount && f.target.hasFocus() && f.losses == 0) { "Publication interrupted actual host focus" }
        check(!f.root.collections.accepts("item-0", "1", false, TargetView(f.root.context))) { "Old revision authorized a replacement view" }
        check(!f.root.collections.accepts("row", "1", true, ScopeView(f.root.context))) { "Old revision authorized a replacement scope" }
    }
    fun rejectUndeclaredChild(f: Fixture) {
        val foreign = TargetView(f.root.context).apply {
            occurrenceKey = "foreign"; scopeKey = "row"; text = "Undeclared"; contentDescription = text
        }
        f.row.addView(foreign); foreign.layout(220, 10, 420, 90); foreign.commitProps()
        check(foreign.mount == null && !foreign.isFocusable) { "Non-collection target bypassed collection membership" }
        f.row.removeView(foreign)
    }
    fun commit(f: Fixture) {
        // Exercise a mixed parent/target commit, then the matching declaration.
        f.row.collectionDataset = "2"; f.row.commit(); geometry(f)
        check(f.target.mount == f.mount && f.target.hasFocus())
        f.target.collectionDataset = "2"; f.target.commitProps(); geometry(f)
        check(f.target.mount == f.mount && f.target.hasFocus() && f.losses == 0)
    }
    fun recycle(f: Fixture) {
        f.observer?.let { f.root.viewTreeObserver.removeOnGlobalFocusChangeListener(it) }; f.observer = null
        val previous = f.mount
        f.row.removeView(f.target)
        check(f.target.mount == null)
        f.target.collectionDataset = "1"
        f.row.addView(f.target); geometry(f)
        check(f.target.mount == null && !f.target.isFocusable) { "Detached old revision revived a mount" }
        f.target.collectionDataset = "2"; f.target.commitProps(); geometry(f)
        check(f.target.mount != null && f.target.mount != previous)
    }
    fun close(f: Fixture) {
        f.observer?.let { f.root.viewTreeObserver.removeOnGlobalFocusChangeListener(it) }
        f.root.close()
    }
}
