package com.itar.adapter

import android.graphics.Rect
import android.view.View
import android.view.ViewGroup
import android.widget.ScrollView
import android.widget.HorizontalScrollView
import android.content.Context
import android.os.SystemClock
import java.lang.ref.WeakReference
import android.view.accessibility.AccessibilityManager
import org.json.JSONArray
import org.json.JSONObject

internal data class CollectionEntry(val key: String, val parent: String, val order: Int,
    val scope: Boolean, val enabled: Boolean, val layout: Int, val extent: Double,
    val leadingExtent: Double = 0.0, val rowEntry: Int = 0, val horizontalAlignment: String = "nearest") {
    fun horizontalOffset(start: Double, end: Double, current: Double, viewport: Double, content: Double, rtl: Boolean): Int {
        val desired = if (horizontalAlignment == "leading" || end - start > viewport) { if (rtl) end - viewport else start }
            else if (start < current) start else if (end > current + viewport) end - viewport else current
        return desired.coerceIn(0.0, (content - viewport).coerceAtLeast(0.0)).toInt()
    }
    fun offset(index: Int): Double = if (leadingExtent > 0 && index > 0)
        leadingExtent + (index - 1) * extent else index * extent
}
internal data class CollectionDocument(val dataset: Long, val nodes: List<CollectionEntry>) {
    fun values(): LongArray = nodes.flatMap { listOf(it.order.toLong(), if (it.scope) 1L else 0L,
        if (it.enabled) 1L else 0L, it.layout.toLong(), java.lang.Double.doubleToRawLongBits(it.extent), it.rowEntry.toLong()) }.toLongArray()
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
                val rowEntry = if (node.has("rowEntry")) node.get("rowEntry") else 0
                require(rowEntry is Number && (rowEntry.toDouble() == 0.0 || rowEntry.toDouble() == 1.0))
                val alignment = if (node.has("horizontalAlignment")) node.get("horizontalAlignment") else "nearest"
                require(alignment is String && (alignment == "nearest" || alignment == "leading") &&
                    (!node.has("horizontalAlignment") || (node.getBoolean("scope") && node.getInt("layout") == 1)))
                val leadingExtent = if (node.has("leadingExtent")) node.getDouble("leadingExtent") else 0.0
                require(leadingExtent.isFinite() && leadingExtent >= 0 && leadingExtent <= 1000000 &&
                    (node.getBoolean("scope") || leadingExtent == 0.0))
                CollectionEntry(node.getString("key"), node.getString("parent"), node.getInt("order"),
                    node.getBoolean("scope"), node.getBoolean("enabled"), node.getInt("layout"), node.getDouble("extent"), leadingExtent, rowEntry.toInt(), alignment)
            })
        } catch (_: IllegalArgumentException) { null } catch (_: org.json.JSONException) { null }
    }
}
internal class Collections(private val root: SurfaceView) {
    var document: CollectionDocument? = null
        private set
    private var configuration = ""
    private val mountedTarget = MountedTargetReveal(root)
    private var pending: LongArray? = null
    val awaitingReveal get() = pending != null
    private var steps: List<CollectionEntry> = emptyList()
    private var step = 0
    private var prepared = false
    private var scrolled = false
    private var realized = false
    private var source: Mount? = null
    private var handles: Map<String, LongArray> = emptyMap()
    fun entry(key: String) = document?.nodes?.firstOrNull { it.key == key }
    fun accepts(key: String, dataset: String, scope: Boolean, view: View? = null): Boolean {
        val entry = entry(key) ?: return dataset.isEmpty()
        return entry.scope == scope && (dataset == this.dataset.toString() || retainedDeclaration(key, dataset, scope, view))
    }
    // At most the focused view and its two collection ancestors may retain an
    // older declaration. These are exact live bindings, never reusable key grants.
    private data class ScopeLease(val view: WeakReference<ScopeView>, val dataset: String, val node: LongArray)
    private data class PublicationLease(val view: WeakReference<TargetView>, val mount: Mount,
        val lifetime: Long, val dataset: String, val scopes: List<ScopeLease>)
    private var publicationLease: PublicationLease? = null
    private fun retainedDeclaration(key: String, declared: String, scope: Boolean, view: View?): Boolean {
        val lease = publicationLease ?: return false
        val target = lease.view.get() ?: return false
        if (lease.lifetime != root.connection.lifetime || target.surface !== root ||
            root.targets[lease.mount]?.get() !== target || target.logicalLifetime != lease.lifetime || target.mount != lease.mount ||
            !target.isAttachedToWindow || target.occurrenceKey != lease.mount.key) return false
        return if (!scope) view === target && key == lease.mount.key && declared == lease.dataset
        else lease.scopes.any { item -> item.view.get()?.let { candidate ->
            candidate === view && candidate.scopeKey == key && declared == item.dataset &&
                candidate.isAttachedToWindow && candidate.owner === root && candidate.node.contentEquals(item.node)
        } == true }
    }
    private fun retainFocused(next: CollectionDocument): PublicationLease? {
        val previous = document ?: return null
        val target = root.rootView.findFocus() as? TargetView ?: return null
        val mount = target.mount ?: return null
        if (target.surface !== root || root.live(mount, allowFocusedSource = true) !== target ||
            !accepts(target.occurrenceKey, target.collectionDataset, false, target)) return null
        val ancestry = ArrayList<CollectionEntry>()
        var item = previous.nodes.firstOrNull { it.key == target.occurrenceKey }
        repeat(3) {
            val current = item ?: return@repeat
            // Selection policy cancels intent in core; it does not change a live host declaration.
            if (next.nodes.firstOrNull { it.key == current.key }?.copy(rowEntry = current.rowEntry, horizontalAlignment = current.horizontalAlignment) != current) return null
            ancestry.add(current)
            item = previous.nodes.firstOrNull { it.key == current.parent }
        }
        if (ancestry.isEmpty() || item != null) return null
        val scopes = ancestry.filter { it.scope }.map { entry ->
            val view = root.scopes[entry.key]?.get() ?: return null
            if (!accepts(view.scopeKey, view.collectionDataset, true, view)) return null
            ScopeLease(WeakReference(view), view.collectionDataset, view.node.copyOf())
        }
        return PublicationLease(WeakReference(target), mount, root.connection.lifetime, target.collectionDataset, scopes)
    }
    val dataset get() = document?.dataset ?: 0
    fun retained(mount: Mount?) = mountedTarget.retains(mount) || (pending != null && source == mount &&
        mount != null && root.rootView.findFocus() === root.targets[mount]?.get())
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
            val retained = retainFocused(next)
            val result = root.connection.collections(next.dataset, next.nodes.map { it.key }.toTypedArray(),
                next.nodes.map { it.parent }.toTypedArray(), next.values())
            if (result < 0) { root.close(); return@post }
            if (result > 1) { emit(JSONObject().put("state", "rejected").put("dataset", next.dataset.toString())); return@post }
            val previousHandles = handles
            publicationLease = retained
            document = next
            root.retireCollectionKeys(previousHandles.filterKeys { key -> next.nodes.none { it.key == key } })
            handles = next.nodes.associate { it.key to root.connection.exchange(25, key = it.key).copyOfRange(1, 3) }
            publicationLease = publicationLease?.takeIf { lease ->
                handles[lease.mount.key]?.let { it[0] == lease.mount.slot && it[1] == lease.mount.generation } == true &&
                    lease.scopes.all { scope -> scope.view.get()?.let { view ->
                        handles[view.scopeKey]?.contentEquals(scope.node) == true
                    } == true }
            }
            root.targets.values.mapNotNull { it.get() }.filter { target ->
                val owned = previousHandles[target.occurrenceKey]
                val mount = target.mount
                owned != null && mount != null && mount.slot == owned[0] && mount.generation == owned[1] &&
                    !accepts(target.occurrenceKey, target.collectionDataset, false, target)
            }.forEach { it.maskCollectionAccessibility(); root.detach(it) }
            emit(JSONObject().put("state", "catalog").put("dataset", next.dataset.toString()))
            root.scopeChanged()
            root.dispatcher.kick()
            focused(root.rootView.findFocus())
        }
    }
    // One next-frame continuation lets the platform finish its own focus scroll.
    // It carries no destination authority: recheck the exact observed host/mount.
    private var alignment: Runnable? = null
    fun focused(view: View?) {
        alignment?.let { root.removeCallbacks(it) }; alignment = null
        val target = view as? TargetView ?: return
        val mount = target.mount ?: return
        val dataset = dataset
        val work = Runnable {
            alignment = null
            if (root.closed || !root.acceptsInput || root.readerOwnsInput || pending != null || this.dataset != dataset ||
                root.live(mount, allowFocusedSource = true) !== target || root.rootView.findFocus() !== target) return@Runnable
            val item = entry(mount.key) ?: return@Runnable
            val list = entry(item.parent) ?: return@Runnable
            if (list.horizontalAlignment != "leading") return@Runnable
            val scope = root.scopes[list.key]?.get() ?: return@Runnable
            var parent = target.parent
            while (parent is View && parent !== scope) {
                if (parent is HorizontalScrollView) {
                    val scroll = parent
                    val bounds = Rect()
                    root.targetGeometry.boundsIn(target, scroll, bounds)
                    bounds.offset(scroll.scrollX, 0)
                    val content = scroll.getChildAt(0)?.width ?: return@Runnable
                    scroll.scrollTo(list.horizontalOffset(bounds.left.toDouble(), bounds.right.toDouble(),
                        scroll.scrollX.toDouble(), scroll.width.toDouble(), content.toDouble(), scroll.layoutDirection == View.LAYOUT_DIRECTION_RTL), scroll.scrollY)
                    root.geometryChanged(); return@Runnable
                }
                parent = parent.parent
            }
        }
        alignment = work; root.postOnAnimation(work)
    }
    fun invoke(effect: LongArray): Boolean {
        if (effect[12] == 0L && effect[8] != 0L) return mountedTarget.start(effect)
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
            val offset = (list.offset(steps[step].order) * root.resources.displayMetrics.density).toInt()
            if (scroll == null) { root.dispatcher.submit(12, effect.copyOfRange(2, 6) + 1L); release(); return }
            if (!root.dispatcher.hostCall {
                scrolled = true
                when (val view = scroll) {
                    is HorizontalScrollView -> {
                        val content = view.getChildAt(0)?.width ?: 0
                        val rtl = view.layoutDirection == View.LAYOUT_DIRECTION_RTL
                        val start = if (rtl) content - offset - list.extent * root.resources.displayMetrics.density else offset.toDouble()
                        view.scrollTo(list.horizontalOffset(start, start + list.extent * root.resources.displayMetrics.density,
                            view.scrollX.toDouble(), view.width.toDouble(), content.toDouble(), rtl), view.scrollY)
                    }
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
        if (mountedTarget.cancel(effect)) return true
        val pending = pending ?: return false
        if (pending[3] != effect[9] || pending[4] != effect[10] || effect[13] != 0L) return false
        release(); return true
    }
    fun reconcile(request: Long) {
        mountedTarget.reconcile(request)
        if (pending?.get(3)?.let { it != request } == true) release()
    }
    fun release() {
        val effect = pending
        pending = null; steps = emptyList(); source = null; prepared = false; scrolled = false; realized = false
        effect?.let { emit(JSONObject().put("state", "release").put("request", it[3].toString()).put("effect", it[4].toString())) }
    }
    fun close() { mountedTarget.clear(); alignment?.let { root.removeCallbacks(it) }; alignment = null; release(); publicationLease = null; document = null; handles = emptyMap() }
}
