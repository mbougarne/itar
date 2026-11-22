package com.itar.adapter

import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityEvent
import android.widget.HorizontalScrollView
import android.widget.ScrollView
import androidx.core.view.AccessibilityDelegateCompat
import androidx.core.view.ViewCompat
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat
import androidx.core.view.accessibility.AccessibilityNodeInfoCompat.AccessibilityActionCompat
import com.facebook.react.views.scroll.ReactHorizontalScrollView
import com.facebook.react.views.scroll.ReactScrollView
import java.lang.ref.WeakReference

/** Keep input on cards and present native scroll axes for an accepted nested collection. */
internal class CollectionAccessibility(private val root: SurfaceView) {
    private val bindings = ArrayList<Binding>()
    private val rowInput = RowInputFocus()
    private val changed = ArrayList<WeakReference<View>>()
    private var notificationPosted = false
    private var notificationLifetime = 0L
    private val notifyChanges = Runnable {
        notificationPosted = false
        val hosts = changed.mapNotNull { it.get() }; changed.clear()
        if (!root.closed && root.connection.lifetime == notificationLifetime) hosts.filter {
            it.isAttachedToWindow && (it === root || generateSequence(it.parent) { parent -> parent.parent }.take(256).any { parent -> parent === root })
        }.forEach {
            it.parent?.notifySubtreeAccessibilityStateChanged(it, it, if (it === root)
                AccessibilityEvent.CONTENT_CHANGE_TYPE_SUBTREE else AccessibilityEvent.CONTENT_CHANGE_TYPE_UNDEFINED)
        }
    }
    private fun changed(host: View) {
        if (root.closed || changed.any { it.get() === host || it.get() === root }) return
        // If more than two full generations change before delivery, invalidate their common subtree.
        if (changed.size == 512) { changed.clear(); changed.add(WeakReference(root)) }
        else changed.add(WeakReference(host))
        if (!notificationPosted) {
            notificationPosted = true; notificationLifetime = root.connection.lifetime; root.post(notifyChanges)
        }
    }
    fun close() {
        clear(); root.removeCallbacks(notifyChanges); changed.clear(); notificationPosted = false
        if (root.isAttachedToWindow) root.parent?.notifySubtreeAccessibilityStateChanged(root, root, AccessibilityEvent.CONTENT_CHANGE_TYPE_SUBTREE)
    }

    private fun axis(scope: ScopeView, onlyLtr: Boolean = true): Int? {
        val document = root.collections.document ?: return null
        val entry = root.collections.entry(scope.scopeKey) ?: return null
        if (!root.acceptsInput || (onlyLtr && scope.layoutDirection != View.LAYOUT_DIRECTION_LTR) || scope.owner !== root || scope.root() !== root ||
            !scope.isAttachedToWindow || scope.committedKey != entry.key || scope.node[0] == 0L ||
            root.scopes[entry.key]?.get() !== scope || !root.scopeActive(entry.key) ||
            !entry.scope || !entry.enabled || entry.parent != scope.parentScopeKey ||
            !root.collections.accepts(entry.key, scope.collectionDataset, true, scope)) return null
        return when {
            entry.layout == 1 && scope.layout == "row" && root.scopes[entry.parent]?.get()?.let {
                root.collections.entry(it.scopeKey)?.layout == 2 && axis(it, onlyLtr) == 2
            } == true -> 1
            entry.layout == 2 && scope.layout == "column" && document.nodes.any {
                it.parent == entry.key && it.scope && it.enabled && it.layout == 1
            } -> 2
            else -> null
        }
    }

    fun clear() { bindings.toList().forEach { it.release() }; rowInput.update(emptySet()) }

    fun rebuild() {
        if (root.closed || root.dispatcher.busy) return
        val hosts = ArrayList<Pair<ScopeView, View>>()
        var visited = 0
        for (scope in root.scopes.values.mapNotNull { it.get() }) {
            val axis = axis(scope, onlyLtr = false) ?: continue
            val queue = ArrayDeque<View>()
            for (index in 0 until scope.childCount) queue.add(scope.getChildAt(index))
            val found = ArrayList<View>()
            while (queue.isNotEmpty()) {
                if (++visited > 4096 || queue.size > 4096) { clear(); return }
                val view = queue.removeFirst()
                if (view is ScopeView || view is SurfaceView) continue
                if (view is ScrollView || view is HorizontalScrollView) found.add(view)
                else if (view is ViewGroup) for (index in 0 until view.childCount) queue.add(view.getChildAt(index))
            }
            val host = found.singleOrNull() ?: continue
            if (host.isAttachedToWindow && ((axis == 1 && host is ReactHorizontalScrollView) ||
                (axis == 2 && host is ReactScrollView))) hosts.add(scope to host)
        }
        val columns = hosts.filter { it.second is ReactScrollView }.associate { it.first.scopeKey to it.second }
        rowInput.update(hosts.mapNotNull { (scope, host) ->
            val column = columns[scope.parentScopeKey] ?: return@mapNotNull null
            (host as? ReactHorizontalScrollView)?.takeIf { it.javaClass == ReactHorizontalScrollView::class.java &&
                it.scrollEnabled && it.contentDescription.isNullOrEmpty() && !it.isClickable && !it.isLongClickable &&
                generateSequence(it.parent) { parent -> parent.parent }.take(256).any { parent -> parent === column } }
        }.toSet())
        for (binding in bindings.toList()) {
            if (!binding.valid() || hosts.none { (scope, host) -> binding.owns(scope, host) } ||
                binding.host.get()?.let { ViewCompat.getAccessibilityDelegate(it) !== binding } != false) binding.release()
        }
        // An inner rail receives the horizontal projection only when its outer list owns the vertical one.
        for ((scope, host) in hosts.sortedByDescending { axis(it.first) }) {
            val projection = axis(scope) ?: continue
            if (host.layoutDirection != View.LAYOUT_DIRECTION_LTR || (projection == 1 && !paired(scope, host))) continue
            if (bindings.any { it.owns(scope, host) }) continue
            val original = ViewCompat.getAccessibilityDelegate(host) ?: continue
            val binding = Binding(scope, host, original, projection)
            bindings.add(binding)
            host.addOnAttachStateChangeListener(binding)
            ViewCompat.setAccessibilityDelegate(host, binding)
            changed(host)
        }
    }

    private fun paired(scope: ScopeView, view: View): Boolean = bindings.any { binding ->
        val parent = root.scopes[scope.parentScopeKey]?.get()
        val outer = binding.host.get()
        parent != null && outer != null && binding.owns(parent, outer) && axis(parent) == 2 && binding.valid() &&
            generateSequence(view.parent) { it.parent }.take(256).any { it === outer }
    }

    private inner class Binding(scope: ScopeView, view: View,
        private val original: AccessibilityDelegateCompat, private val direction: Int
    ) : AccessibilityDelegateCompat(), View.OnAttachStateChangeListener {
        val host = WeakReference(view)
        private val ownerScope = WeakReference(scope)
        private val node = scope.node.copyOf()
        private val lifetime = root.connection.lifetime
        fun owns(scope: ScopeView, view: View) = ownerScope.get() === scope && host.get() === view
        fun valid(): Boolean {
            val scope = ownerScope.get() ?: return false
            val view = host.get() ?: return false
            if (root.closed || lifetime != root.connection.lifetime || !scope.node.contentEquals(node) ||
                axis(scope) != direction || !view.isAttachedToWindow || view.layoutDirection != View.LAYOUT_DIRECTION_LTR ||
                ViewCompat.getAccessibilityDelegate(view) !== this || (direction == 1 && !paired(scope, view))) return false
            var parent = view.parent
            repeat(256) {
                if (parent === scope) return true
                if (parent == null || parent is ScopeView || parent is SurfaceView) return false
                parent = parent?.parent
            }
            return false
        }
        fun release() {
            bindings.remove(this)
            host.get()?.let {
                it.removeOnAttachStateChangeListener(this)
                if (ViewCompat.getAccessibilityDelegate(it) === this) {
                    ViewCompat.setAccessibilityDelegate(it, original); changed(it)
                }
            }
        }
        override fun onViewAttachedToWindow(view: View) = Unit
        override fun onViewDetachedFromWindow(view: View) = release()
        override fun onInitializeAccessibilityNodeInfo(host: View, info: AccessibilityNodeInfoCompat) {
            original.onInitializeAccessibilityNodeInfo(host, info)
            if (!valid()) return
            val forward = if (direction == 1) AccessibilityActionCompat.ACTION_SCROLL_RIGHT else AccessibilityActionCompat.ACTION_SCROLL_DOWN
            val backward = if (direction == 1) AccessibilityActionCompat.ACTION_SCROLL_LEFT else AccessibilityActionCompat.ACTION_SCROLL_UP
            if (info.actionList.any { it.id == forward.id }) info.removeAction(AccessibilityActionCompat.ACTION_SCROLL_FORWARD)
            if (info.actionList.any { it.id == backward.id }) info.removeAction(AccessibilityActionCompat.ACTION_SCROLL_BACKWARD)
        }
        // Preserve RN's metadata, providers, action handling and event path exactly once.
        override fun onInitializeAccessibilityEvent(host: View, event: AccessibilityEvent) = original.onInitializeAccessibilityEvent(host, event)
        override fun onPopulateAccessibilityEvent(host: View, event: AccessibilityEvent) = original.onPopulateAccessibilityEvent(host, event)
        override fun dispatchPopulateAccessibilityEvent(host: View, event: AccessibilityEvent) = original.dispatchPopulateAccessibilityEvent(host, event)
        override fun onRequestSendAccessibilityEvent(host: ViewGroup, child: View, event: AccessibilityEvent) = original.onRequestSendAccessibilityEvent(host, child, event)
        override fun sendAccessibilityEvent(host: View, eventType: Int) = original.sendAccessibilityEvent(host, eventType)
        override fun sendAccessibilityEventUnchecked(host: View, event: AccessibilityEvent) = original.sendAccessibilityEventUnchecked(host, event)
        override fun getAccessibilityNodeProvider(host: View) = original.getAccessibilityNodeProvider(host)
        override fun performAccessibilityAction(host: View, action: Int, args: Bundle?) = original.performAccessibilityAction(host, action, args)
    }
}

/** Only an anonymous row's cards participate in input focus. Its scroll actions remain native. */
private class RowInputFocus : View.OnAttachStateChangeListener {
    private data class Original(val focusable: Int, val touch: Boolean)
    private val changed = mutableMapOf<ReactHorizontalScrollView, Original>()

    fun update(rows: Set<ReactHorizontalScrollView>) {
        changed.keys.toList().filterNot { it in rows }.forEach(::restore)
        for (row in rows) {
            if (!row.isFocusable) continue
            if (row !in changed) row.addOnAttachStateChangeListener(this)
            val mode = if (Build.VERSION.SDK_INT >= 26) row.focusable else View.FOCUSABLE
            changed[row] = Original(mode, row.isFocusableInTouchMode)
            row.isFocusable = false
        }
    }

    private fun restore(row: ReactHorizontalScrollView) {
        val original = changed.remove(row) ?: return
        row.removeOnAttachStateChangeListener(this)
        // RN sets focusability when scrollEnabled changes. Keep a newer disabled state.
        if (!row.scrollEnabled || row.isFocusable) return
        if (original.touch) row.isFocusableInTouchMode = true
        if (Build.VERSION.SDK_INT >= 26) row.focusable = original.focusable else row.isFocusable = true
    }

    override fun onViewDetachedFromWindow(view: View) { restore(view as ReactHorizontalScrollView) }
    override fun onViewAttachedToWindow(view: View) = Unit
}
