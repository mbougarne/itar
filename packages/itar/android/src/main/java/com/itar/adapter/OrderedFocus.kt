package com.itar.adapter

import android.graphics.Rect
import android.view.View
import android.view.ViewGroup
import java.lang.ref.WeakReference

/** Native preferences for committed, flat static columns; the host still owns movement. */
internal class OrderedFocus(private val root: SurfaceView) {
    private data class Links(val target: WeakReference<TargetView>, val up: Int, val down: Int)
    private val links = ArrayList<Links>()

    fun clear() {
        for (link in links) link.target.get()?.let { target ->
            if (target.nextFocusUpId == link.up) target.nextFocusUpId = View.NO_ID
            if (target.nextFocusDownId == link.down) target.nextFocusDownId = View.NO_ID
        }
        links.clear()
    }

    fun rebuild() {
        clear()
        if (!root.acceptsInput || !root.hasWindowFocus() || root.dispatcher.busy) return
        for (scope in root.scopes.values.mapNotNull { it.get() }) {
            if (scope.owner !== root || scope.root() !== root || !scope.isAttachedToWindow ||
                scope.scopeKey != scope.committedKey || scope.node[0] == 0L || scope.layout != "column" ||
                scope.collectionDataset.isNotEmpty() || root.collections.entry(scope.scopeKey) != null ||
                !root.scopeActive(scope.scopeKey)) continue
            val targets = siblings(scope) ?: continue
            // Existing native preferences belong to their caller, not this projection.
            if (targets.any { it.nextFocusUpId != View.NO_ID || it.nextFocusDownId != View.NO_ID }) continue
            val ordered = targets.sortedBy { it.committedOrder }
            for ((index, target) in ordered.withIndex()) {
                val up = ordered.getOrNull(index - 1)?.id ?: View.NO_ID
                val down = ordered.getOrNull(index + 1)?.id ?: View.NO_ID
                target.nextFocusUpId = up
                target.nextFocusDownId = down
                links.add(Links(WeakReference(target), up, down))
            }
        }
    }

    private fun siblings(scope: ScopeView): List<TargetView>? {
        val queue = ArrayDeque<View>()
        for (index in 0 until scope.childCount) queue.addLast(scope.getChildAt(index))
        val targets = ArrayList<TargetView>()
        val orders = HashSet<Int>()
        var visited = 0
        while (queue.isNotEmpty()) {
            if (++visited > 4096 || queue.size > 4096) return null
            val view = queue.removeFirst()
            if (view is ScopeView || view is SurfaceView) return null
            if (view is TargetView) {
                val mount = view.mount ?: return null
                if (view.scopeKey != scope.scopeKey || view.logicalScopeKey != scope.scopeKey ||
                    view.collectionDataset.isNotEmpty() || root.collections.entry(view.occurrenceKey) != null ||
                    view.logicalLifetime != root.connection.lifetime || view.surface !== root ||
                    mount.key != view.occurrenceKey || root.targets[mount]?.get() !== view ||
                    view.order != view.committedOrder || !orders.add(view.committedOrder) ||
                    view.id <= 0 || root.rootView.findViewById<View>(view.id) !== view) return null
                val visible = Rect()
                if (view.committedEnabled && root.live(mount) === view && view.width > 0 && view.height > 0 &&
                    view.getGlobalVisibleRect(visible) && visible.width() == view.width && visible.height() == view.height) {
                    targets.add(view)
                }
            } else if (view.isFocusable || view.isClickable) return null
            else if (view is ViewGroup) for (index in 0 until view.childCount) queue.addLast(view.getChildAt(index))
        }
        return targets
    }
}
