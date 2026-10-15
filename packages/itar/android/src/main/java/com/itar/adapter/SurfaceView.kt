package com.itar.adapter

import android.content.Context
import android.graphics.Rect
import android.view.View
import android.view.KeyEvent
import android.view.ViewTreeObserver
import com.facebook.react.views.view.ReactViewGroup
import java.lang.ref.WeakReference

class SurfaceView(context: Context) : ReactViewGroup(context) {
    internal var connection = Connection()
    private var serial = 0L
    private var epoch = 1L
    internal val targets = LinkedHashMap<Mount, WeakReference<TargetView>>()
    private val input = Input(this)
    private var refreshPosted = false
    var closed = false
        private set
    private val focusObserver = ViewTreeObserver.OnGlobalFocusChangeListener { _, target -> observe(target) }
    private val scrollObserver = ViewTreeObserver.OnScrollChangedListener { geometryChanged() }
    internal fun live(mount: Mount?): TargetView? = targets[mount]?.get()?.takeIf {
        it.mount == mount && it.isAttachedToWindow && it.isShown && it.isEnabled && it.isFocusable &&
            it.matrix.isIdentity && (it.clipBounds == null || it.clipBounds == Rect(0, 0, it.width, it.height))
    }
    override fun focusSearch(focused: View?, direction: Int): View? =
        input.query(focused, direction) ?: super.focusSearch(focused, direction)
    override fun dispatchKeyEvent(event: KeyEvent): Boolean = input.dispatch(event) || super.dispatchKeyEvent(event)
    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (closed) { connection = Connection(); closed = false }
        viewTreeObserver.addOnGlobalFocusChangeListener(focusObserver)
        viewTreeObserver.addOnScrollChangedListener(scrollObserver)
    }
    override fun onDetachedFromWindow() {
        viewTreeObserver.removeOnGlobalFocusChangeListener(focusObserver)
        viewTreeObserver.removeOnScrollChangedListener(scrollObserver)
        close()
        super.onDetachedFromWindow()
    }
    internal fun register(target: TargetView) {
        if (closed) return
        val old = target.mount
        check(old != null || serial < Long.MAX_VALUE) { "Mount serial exhausted" }
        val mountSerial = old?.serial ?: ++serial
        val rect = Rect(0, 0, target.width, target.height)
        offsetDescendantRectToMyCoords(target, rect)
        val visible = Rect()
        val untransformed = generateSequence<View>(target) { it.parent as? View }
            .takeWhile { it !== this }.all { it.matrix.isIdentity } && matrix.isIdentity
        val measured = untransformed && target.isShown && target.getGlobalVisibleRect(visible) &&
            visible.width() == target.width && visible.height() == target.height &&
            (target.clipBounds == null || target.clipBounds == Rect(0, 0, target.width, target.height))
        val values = longArrayOf(old?.slot ?: 0, old?.generation ?: 0, mountSerial,
            target.order.toLong(), if (target.isEnabled) 1 else 0, epoch,
            if (target.width <= 0 || target.height <= 0) 0 else if (measured) 2 else 4,
            rect.left.toLong(), rect.top.toLong(), rect.width().toLong(), rect.height().toLong())
        val result = connection.exchange(1, values, target.occurrenceKey)
        if (result[0] == 0L) {
            val mount = Mount(result[1], result[2], result[3], target.occurrenceKey)
            target.mount = mount
            targets[mount] = WeakReference(target)
            target.isFocusable = target.isEnabled && measured
        } else {
            target.isFocusable = false
            old?.let { connection.exchange(3, it.values(epoch)) }
        }
    }
    internal fun detach(target: TargetView) {
        val old = target.mount ?: return
        target.mount = null // Host authority is revoked before any engine/configuration work.
        targets.remove(old)
        target.isFocusable = false
        if (!closed) connection.exchange(2, old.values(epoch))
    }
    internal fun geometryChanged() {
        if (closed) return
        for (mount in targets.keys.toList()) connection.exchange(3, mount.values(epoch))
        if (!refreshPosted) {
            refreshPosted = true
            post { refreshPosted = false; refreshGeometry() }
        }
    }
    internal fun refreshGeometry() {
        if (closed) return
        check(epoch < Long.MAX_VALUE) { "Layout epoch exhausted" }
        epoch++
        targets.values.mapNotNull { it.get() }.forEach { register(it) }
    }
    internal fun observe(target: View? = rootView.findFocus(), channel: Long = 0) {
        if (closed) return
        val mount = (target as? TargetView)?.takeIf { it.surface === this }?.mount
        val kind = when { !hasWindowFocus() -> 3L; target == null -> 2L; mount != null -> 0L; else -> 1L }
        connection.exchange(4, longArrayOf(channel, kind, mount?.slot ?: 0, mount?.generation ?: 0, mount?.serial ?: 0))
    }
    override fun onWindowFocusChanged(hasWindowFocus: Boolean) {
        super.onWindowFocusChanged(hasWindowFocus)
        observe()
    }
    fun close() {
        if (closed) return
        closed = true
        targets.values.mapNotNull { it.get() }.forEach { it.mount = null; it.isFocusable = false }
        targets.clear()
        connection.close()
    }
}
