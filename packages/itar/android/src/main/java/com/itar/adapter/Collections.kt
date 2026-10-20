package com.itar.adapter

import android.graphics.Rect
import android.view.View
import android.view.ViewGroup
import android.widget.ScrollView
import android.widget.HorizontalScrollView
import android.content.Context
import android.os.SystemClock
import android.view.accessibility.AccessibilityManager
import org.json.JSONArray
import org.json.JSONObject

internal data class CollectionEntry(val key: String, val parent: String, val order: Int,
    val scope: Boolean, val enabled: Boolean, val layout: Int, val extent: Double)
internal data class CollectionDocument(val dataset: Long, val nodes: List<CollectionEntry>) {
    fun path(key: String): List<CollectionEntry> {
        val path = ArrayList<CollectionEntry>()
        var item = nodes.firstOrNull { it.key == key }
        repeat(2) {
            val current = item ?: return path
            val parent = nodes.firstOrNull { it.key == current.parent && it.scope } ?: return path
            path.add(0, current); item = parent
        }
        return path
    }
    companion object {
        fun decode(text: String): CollectionDocument? = try {
            require(text.toByteArray(Charsets.UTF_8).size <= 524288)
            val value = JSONObject(text)
            val dataset = value.getString("dataset").toLong()
            val entries = value.getJSONArray("nodes")
            require(dataset > 0 && entries.length() <= 256)
            CollectionDocument(dataset, (0 until entries.length()).map { index ->
                val node = entries.getJSONObject(index)
                CollectionEntry(node.getString("key"), node.getString("parent"), node.getInt("order"),
                    node.getBoolean("scope"), node.getBoolean("enabled"), node.getInt("layout"), node.getDouble("extent"))
            })
        } catch (_: IllegalArgumentException) { null } catch (_: org.json.JSONException) { null }
    }
}
internal class Collections(private val root: SurfaceView) {
    var document: CollectionDocument? = null
        private set
    private var configuration = ""
    private var pending: LongArray? = null
    private var steps: List<CollectionEntry> = emptyList()
    private var step = 0
    private var prepared = false
    private var scrolled = false
    private var realized = false
    private var source: Mount? = null
    private var handles: Map<String, LongArray> = emptyMap()
    fun entry(key: String) = document?.nodes?.firstOrNull { it.key == key }
    fun accepts(key: String, dataset: String, scope: Boolean): Boolean {
        val entry = entry(key) ?: return dataset.isEmpty()
        return entry.scope == scope && dataset == this.dataset.toString()
    }
    val dataset get() = document?.dataset ?: 0
    fun retained(mount: Mount?) = pending != null && source == mount && mount != null && root.rootView.findFocus() === root.targets[mount]?.get()
    private fun emit(value: JSONObject) = root.publishPublic("topCollectionRecord", mapOf(
        "lifetime" to root.connection.lifetime.toString(), "payload" to value.toString()))
    fun configure(text: String) {
        configuration = text
        if (text.isEmpty()) return
        root.post {
            if (root.closed || text != configuration) return@post
            if (root.dispatcher.busy) { configure(text); return@post }
            root.refreshGeometry()
            val next = CollectionDocument.decode(text)
            if (next == null) { emit(JSONObject().put("state", "rejected")); return@post }
            val values = next.nodes.flatMap { listOf(it.order.toLong(), if (it.scope) 1L else 0L,
                if (it.enabled) 1L else 0L, it.layout.toLong(), java.lang.Double.doubleToRawLongBits(it.extent)) }.toLongArray()
            val result = root.connection.collections(next.dataset, next.nodes.map { it.key }.toTypedArray(),
                next.nodes.map { it.parent }.toTypedArray(), values)
            if (result < 0) { root.close(); return@post }
            if (result > 1) { emit(JSONObject().put("state", "rejected").put("dataset", next.dataset.toString())); return@post }
            val previousHandles = handles
            document = next
            root.retireCollectionKeys(previousHandles.filterKeys { key -> next.nodes.none { it.key == key } })
            handles = next.nodes.associate { it.key to root.connection.exchange(25, key = it.key).copyOfRange(1, 3) }
            root.targets.values.mapNotNull { it.get() }.filter { target ->
                val owned = previousHandles[target.occurrenceKey]
                val mount = target.mount
                owned != null && mount != null && mount.slot == owned[0] && mount.generation == owned[1] &&
                    (target.collectionDataset != next.dataset.toString() || entry(target.occurrenceKey) == null)
            }.forEach { it.maskCollectionAccessibility(); root.detach(it) }
            emit(JSONObject().put("state", "catalog").put("dataset", next.dataset.toString()))
            root.scopeChanged()
            root.dispatcher.kick()
        }
    }
    fun invoke(effect: LongArray): Boolean {
        val document = document ?: return false
        val reader = root.context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
        if (!root.acceptsInput || reader.isEnabled || effect[11] != document.dataset) return false
        val target = document.nodes.firstOrNull {
            val node = handles[it.key]
            node != null && node[0] == effect[6] && node[1] == effect[7]
        } ?: return false
        val path = document.path(target.key)
        if (path.isEmpty() || path.size > 2) return false
        release()
        pending = effect.copyOf(); steps = path; step = 0; prepared = false; scrolled = false; realized = false
        source = root.targets.keys.firstOrNull { root.targets[it]?.get() === root.rootView.findFocus() }
        prepare()
        return true
    }
    private fun path(entries: List<CollectionEntry>) = JSONArray().apply {
        entries.forEach { put(JSONObject().put("collection", it.parent).put("key", it.key).put("index", it.order)) }
    }
    private fun prepare() {
        val effect = pending ?: return
        emit(JSONObject().put("state", "prepare").put("dataset", dataset.toString())
            .put("request", effect[3].toString()).put("effect", effect[4].toString()).put("step", step)
            .put("key", steps[step].key).put("path", path(steps))
            .put("source", path(source?.let { document?.path(it.key) } ?: emptyList())))
    }
    fun acknowledge(text: String) {
        if (text.length > 4096 || root.closed || root.dispatcher.busy) return
        root.dispatcher.submit(14, longArrayOf(SystemClock.uptimeMillis()))
        val effect = pending ?: return
        try {
            val value = JSONObject(text)
            if (value.getString("lifetime") != root.connection.lifetime.toString() || value.getString("request") != effect[3].toString() ||
                value.getString("effect") != effect[4].toString() || value.getString("dataset") != dataset.toString() ||
                value.getInt("step") != step || value.getString("key") != steps[step].key ||
                root.connection.exchange(5)[6] != effect[3]) return
            prepared = true
            advance()
        } catch (_: org.json.JSONException) { return }
    }
    fun advance() {
        if (root.closed || root.dispatcher.busy) return
        root.observe()
        root.dispatcher.submit(14, longArrayOf(SystemClock.uptimeMillis()))
        val effect = pending ?: return
        val reader = root.context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
        if (!prepared || realized || root.closed || root.dispatcher.busy || !root.acceptsInput || reader.isEnabled ||
            effect[11] != dataset || root.connection.exchange(5)[6] != effect[3]) return
        val scope = root.scopes[steps[step].parent]?.get() ?: return
        if (!scrolled) {
            val queue = ArrayDeque<View>()
            for (index in 0 until scope.childCount) queue.addLast(scope.getChildAt(index))
            var scroll: View? = null
            var count = 0
            while (queue.isNotEmpty()) {
                if (++count > 4096 || queue.size > 4096) { root.close(); return }
                val view = queue.removeFirst()
                if (view is ScrollView || view is HorizontalScrollView) { scroll = view; break }
                if (view is ScopeView) continue
                if (view is ViewGroup) for (index in 0 until view.childCount) queue.addLast(view.getChildAt(index))
            }
            val list = entry(scope.scopeKey) ?: return
            val offset = (steps[step].order * list.extent * root.resources.displayMetrics.density).toInt()
            if (scroll == null) { root.dispatcher.submit(12, effect.copyOfRange(2, 6) + 1L); release(); return }
            if (!root.dispatcher.hostCall {
                scrolled = true
                when (val view = scroll) {
                    is HorizontalScrollView -> view.scrollTo(offset.coerceAtLeast(0), view.scrollY)
                    is ScrollView -> view.scrollTo(view.scrollX, offset.coerceAtLeast(0))
                }
                root.geometryChanged()
            }) { return }
            root.post { if (!root.closed) { root.refreshGeometry(); advance() } }
            return
        }
        if (step + 1 < steps.size) {
            val row = root.scopes[steps[step].key]?.get() ?: return
            val visible = Rect()
            if (!row.isAttachedToWindow || !row.getGlobalVisibleRect(visible)) return
            step++; prepared = false; scrolled = false; prepare(); return
        }
        val mount = root.targets.keys.firstOrNull { it.slot == effect[6] && it.generation == effect[7] && it.key == steps[step].key } ?: return
        val target = root.live(mount) ?: return
        if (target.collectionDataset != dataset.toString()) return
        realized = true
        root.dispatcher.submit(24, effect.copyOfRange(2, 6) + longArrayOf(mount.slot, mount.generation, mount.serial, dataset))
    }
    fun cancel(effect: LongArray): Boolean {
        val pending = pending ?: return false
        if (pending[3] != effect[9] || pending[4] != effect[10] || effect[13] != 0L) return false
        release(); return true
    }
    fun reconcile(request: Long) { if (pending?.get(3)?.let { it != request } == true) release() }
    fun release() {
        val effect = pending
        pending = null; steps = emptyList(); source = null; prepared = false; scrolled = false; realized = false
        effect?.let { emit(JSONObject().put("state", "release").put("request", it[3].toString()).put("effect", it[4].toString())) }
    }
    fun close() { release(); document = null; handles = emptyMap() }
}
