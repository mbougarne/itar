package com.itar.adapter

import android.graphics.Rect
import android.view.View
import android.view.ViewGroup
import android.widget.HorizontalScrollView
import android.widget.ScrollView

/** Reveal the core-selected mount through its declared native scroll viewports. */
internal class MountedTargetReveal(private val root: SurfaceView) {
    private data class Request(val effect: LongArray, val source: Mount, val target: Mount)
    private data class Level(val scope: ScopeView, val scroll: ViewGroup?)
    private data class Path(val target: TargetView, val outerToInner: List<ViewGroup>)
    private var pending: Request? = null
    private val work = Runnable { pending?.let { scrollAndRealize(it) } }

    fun start(effect: LongArray): Boolean {
        val source = (root.rootView.findFocus() as? TargetView)?.mount ?: return false
        val target = root.targets.keys.firstOrNull {
            it.slot == effect[6] && it.generation == effect[7] && it.serial == effect[8]
        } ?: return false
        val request = Request(effect.copyOf(), source, target)
        if (pending != null || path(request) == null) return false
        pending = request
        root.post(work)
        return true
    }

    // A scope can own one standard viewport on its declared order axis. Stop at
    // an unknown or ambiguous owner; an enclosing app scroll must stay untouched.
    private fun levels(target: TargetView) = sequence {
        var key = target.scopeKey
        var scroll: ViewGroup? = null
        var ancestor = target.parent
        while (ancestor is View && ancestor !is SurfaceView) {
            when (ancestor) {
                is HorizontalScrollView, is ScrollView -> {
                    if (scroll != null) break
                    scroll = ancestor as ViewGroup
                }
                is ScopeView -> {
                    if (root.scopes[key]?.get() !== ancestor || ancestor.owner !== root ||
                        ancestor.committedKey != key || ancestor.parentScopeKey != ancestor.committedParent ||
                        !ancestor.active || ancestor.collectionDataset.isNotEmpty()) break
                    if ((scroll is HorizontalScrollView && ancestor.layout != "row") ||
                        (scroll is ScrollView && ancestor.layout != "column")) break
                    yield(Level(ancestor, scroll))
                    key = ancestor.committedParent
                    scroll = null
                }
            }
            ancestor = ancestor.parent
        }
    }

    private fun path(request: Request): Path? {
        if (!root.acceptsInput || !root.hasWindowFocus() || root.readerOwnsInput ||
            root.connection.lifetime != request.effect[2] || root.connection.exchange(5)[6] != request.effect[3]) return null
        val source = root.live(request.source, allowFocusedSource = true) ?: return null
        val target = root.targets[request.target]?.get() ?: return null
        if (root.rootView.findFocus() !== source || target === source || target.mount != request.target ||
            target.surface !== root || !target.isAttachedToWindow || !target.isShown || !target.isEnabled ||
            target.width <= 0 || target.height <= 0 || target.collectionDataset.isNotEmpty() ||
            !root.targetGeometry.supports(target, root)) return null
        val sourceLevels = levels(source).associateBy { it.scope }
        val viewports = ArrayList<ViewGroup>()
        for ((scope, scroll) in levels(target)) {
            val shared = sourceLevels[scope]
            if (shared != null && scroll !== shared.scroll) return null
            if (scroll == null) continue
            if ((scroll is HorizontalScrollView && target.width > scroll.width) ||
                (scroll is ScrollView && target.height > scroll.height)) return null
            viewports.add(scroll)
            if (shared != null) return Path(target, viewports.asReversed())
        }
        return null
    }

    // A clipped ancestor inside the scrolling content moves with the target.
    private fun fitsContent(target: TargetView, scroll: ViewGroup, horizontal: Boolean): Boolean {
        val clip = Rect()
        val bounds = Rect()
        fun fits() = if (horizontal) bounds.left >= clip.left && bounds.right <= clip.right
            else bounds.top >= clip.top && bounds.bottom <= clip.bottom
        var view: View = target
        while (view !== scroll) {
            root.targetGeometry.boundsIn(target, view, bounds)
            if (view.getClipBounds(clip) && (if (view === target) !clip.contains(bounds) else !fits())) return false
            if (view is ViewGroup && view !== target) {
                clip.set(0, 0, view.width, view.height)
                if ((view.parent as? ViewGroup)?.clipChildren == true && !fits()) return false
                if (view.clipToPadding && (view.paddingLeft or view.paddingRight or view.paddingTop or view.paddingBottom) != 0) {
                    clip.set(view.paddingLeft, view.paddingTop, view.width - view.paddingRight, view.height - view.paddingBottom)
                    if (!fits()) return false
                }
            }
            view = view.parent as? View ?: return false
        }
        return true
    }

    private fun displacement(target: TargetView, scroll: ViewGroup, horizontal: Boolean): Int? {
        if (!fitsContent(target, scroll, horizontal)) return null
        val viewport = Rect()
        if (!scroll.getLocalVisibleRect(viewport)) return null
        viewport.offset(-scroll.scrollX, -scroll.scrollY)
        if (scroll.clipToPadding && !viewport.intersect(scroll.paddingLeft, scroll.paddingTop,
                scroll.width - scroll.paddingRight, scroll.height - scroll.paddingBottom)) return null
        val bounds = Rect()
        if (scroll.getClipBounds(bounds) && !viewport.intersect(bounds)) return null
        root.targetGeometry.boundsIn(root, scroll, bounds)
        if (!viewport.intersect(bounds)) return null
        root.targetGeometry.boundsIn(target, scroll, bounds)
        val start = if (horizontal) bounds.left else bounds.top
        val end = if (horizontal) bounds.right else bounds.bottom
        val low = if (horizontal) viewport.left else viewport.top
        val high = if (horizontal) viewport.right else viewport.bottom
        if (end - start > high - low) return null
        // RN can disable gesture scrolling while permitting programmatic scrolling.
        // scrollBy clamps the displacement; only a freshly visible mount can finish the reveal.
        return when {
            start < low -> start - low
            end > high -> end - high
            else -> 0
        }
    }

    private fun scrollAndRealize(request: Request) {
        val path = path(request)
        if (path != null) root.dispatcher.hostCall {
            // Reveal each outer viewport before measuring the next inner viewport.
            for (view in path.outerToInner) {
                if (pending !== request || root.rootView.findFocus() !== root.targets[request.source]?.get()) return@hostCall
                val horizontal = view is HorizontalScrollView
                val delta = displacement(path.target, view, horizontal) ?: return@hostCall
                if (delta != 0) {
                    if (horizontal) view.scrollBy(delta, 0) else view.scrollBy(0, delta)
                }
            }
        }
        if (pending !== request || root.closed) return
        root.refreshGeometry()
        if (pending !== request || root.closed) return
        val token = request.effect.copyOfRange(2, 6)
        val mount = request.target
        if (path != null && !root.readerOwnsInput && root.hasWindowFocus() && root.live(mount) != null) {
            root.dispatcher.submit(24, token + longArrayOf(mount.slot, mount.generation, mount.serial, request.effect[11]))
        } else {
            root.dispatcher.submit(12, token + 1L)
        }
    }

    fun retains(mount: Mount?): Boolean {
        val source = pending?.source ?: return false
        return source == mount && root.rootView.findFocus() === root.targets[source]?.get()
    }

    fun cancel(effect: LongArray): Boolean {
        val request = pending ?: return false
        if (effect[9] != request.effect[3] || effect[10] != request.effect[4] || effect[13] != 0L) return false
        clear()
        return true
    }

    fun reconcile(active: Long) {
        if (pending?.effect?.get(3)?.let { it != active } == true) clear()
    }

    fun clear() {
        val request = pending ?: return
        pending = null
        root.removeCallbacks(work)
        // Revoke the temporary source lease once the request has finished.
        val source = root.targets[request.source]?.get() ?: return
        if (root.closed || source.mount != request.source || !source.isFocusable || root.collections.retained(request.source)) return
        val bounds = Rect()
        root.targetGeometry.measure(source, root, bounds)
        if (bounds.isEmpty) {
            source.isFocusable = false
            if (!source.committedBounds.isEmpty) source.commitProps()
        }
    }
}
