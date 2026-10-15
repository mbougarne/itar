package com.itar.adapter

import android.content.Context
import android.graphics.Rect
import android.view.View
import android.view.KeyEvent
import android.view.ViewTreeObserver
import android.os.SystemClock
import android.view.accessibility.AccessibilityEvent
import com.facebook.react.views.view.ReactViewGroup
import java.lang.ref.WeakReference

open class SurfaceView(context: Context) : ReactViewGroup(context) {
    internal var connection = Connection()
    private var serial = 0L
    private var epoch = 1L
    internal val targets = LinkedHashMap<Mount, WeakReference<TargetView>>()
    internal var dispatcher = Dispatcher(this)
    internal var onFocusRecord: ((LongArray) -> Unit)? = null
    internal val dialogs = Dialogs(this)
    private var covered = false
    private var hiddenForActivity = false
    private var savedImportance = IMPORTANT_FOR_ACCESSIBILITY_AUTO
    private var savedDescendants = FOCUS_BEFORE_DESCENDANTS
    private var restoration: Restoration? = null
    private var accessibilityTarget: WeakReference<View>? = null
    var active = true
        set(value) { if (field != value) { field = value; updateActivity() } }
    internal val acceptsInput get() = active && !covered && !closed
    private val input = Input(this)
    private val deferred = ArrayList<WeakReference<TargetView>>()
    private var refreshPosted = false
    var closed = false
        private set
    private val focusObserver = ViewTreeObserver.OnGlobalFocusChangeListener { _, target -> observe(target) }
    private val scrollObserver = ViewTreeObserver.OnScrollChangedListener { geometryChanged() }
    private val refreshTask = Runnable {
        refreshPosted = false
        if (!closed) dispatcher.batch {
            val pending = deferred.mapNotNull { it.get() }
            deferred.clear()
            refreshGeometry()
            pending.filter { it.isAttachedToWindow && it.surface === this }.forEach { it.commitProps() }
        }
    }
    fun focus(key: String) {
        if (!acceptsInput) return
        val now = SystemClock.uptimeMillis()
        dispatcher.batch { refreshGeometry(); observe(); dispatcher.submit(9, longArrayOf(0, now, now + 500), key) }
    }
    fun cancel(request: Long) { if (request > 0) dispatcher.submit(13, longArrayOf(request)) }
    fun showDialog() = dialogs.show()
    fun dismissDialog() = dialogs.dismiss()
    internal fun cover(value: Boolean) { covered = value; updateActivity() }
    internal fun updateActivity() {
        if (closed) return
        if (!acceptsInput) {
            if (!hiddenForActivity) { savedImportance = importantForAccessibility; savedDescendants = descendantFocusability }
            hiddenForActivity = true
            importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
            descendantFocusability = FOCUS_BLOCK_DESCENDANTS
            dispatcher.submit(16)
        } else if (hiddenForActivity) {
            hiddenForActivity = false
            importantForAccessibility = savedImportance
            descendantFocusability = savedDescendants
        }
        refreshGeometry()
    }
    internal fun resume(token: Restoration) {
        if (closed || connection.lifetime != token.lifetime) return
        restoration = token
        cover(false)
        post { reconcileRestoration() }
    }
    private fun reconcileRestoration() {
        val token = restoration ?: return
        if (closed || !hasWindowFocus() || !acceptsInput) return
        restoration = null
        if (connection.lifetime != token.lifetime) return
        observe() // Adopt platform restoration before requesting any extra transfer.
        if (rootView.findFocus() != null) return
        if (token.key != null && targets.keys.any { it.key == token.key && live(it) != null }) focus(token.key)
        else {
            val now = SystemClock.uptimeMillis()
            dispatcher.submit(18, longArrayOf(now, now + 500))
        }
    }
    internal fun live(mount: Mount?): TargetView? = targets[mount]?.get()?.takeIf {
        acceptsInput && it.mount == mount && it.isAttachedToWindow && it.isShown && it.isEnabled && it.isFocusable &&
            it.matrix.isIdentity && (it.clipBounds == null || it.clipBounds == Rect(0, 0, it.width, it.height))
    }
    override fun focusSearch(focused: View?, direction: Int): View? =
        input.query(focused, direction) ?: super.focusSearch(focused, direction)
    override fun dispatchKeyEvent(event: KeyEvent): Boolean = acceptsInput && (input.dispatch(event) || super.dispatchKeyEvent(event))
    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (closed) { connection = Connection(); dispatcher = Dispatcher(this); closed = false }
        input.start()
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
        if (dispatcher.busy) {
            if (deferred.none { it.get() === target }) {
                if (deferred.size == 32) { close(); return }
                deferred.add(WeakReference(target))
            }
            scheduleRefresh()
            return
        }
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
            target.order.toLong(), if (target.isEnabled && acceptsInput) 1 else 0, epoch,
            if (target.width <= 0 || target.height <= 0) 0 else if (measured) 2 else 4,
            rect.left.toLong(), rect.top.toLong(), rect.width().toLong(), rect.height().toLong())
        val result = connection.exchange(1, values, target.occurrenceKey)
        if (result[0] == 0L) {
            val mount = Mount(result[1], result[2], result[3], target.occurrenceKey)
            target.mount = mount
            targets[mount] = WeakReference(target)
            target.isFocusable = target.isEnabled && measured && acceptsInput
            target.resumeStyle()
        } else {
            target.isFocusable = false
            target.resetStyle()
            old?.let { connection.exchange(3, it.values(epoch)) }
        }
        dispatcher.kick()
    }
    internal fun detach(target: TargetView) {
        target.resetStyle()
        val old = target.mount ?: return
        target.mount = null // Host authority is revoked before any engine/configuration work.
        targets.remove(old)
        target.isFocusable = false
        if (!closed) dispatcher.submit(2, old.values(epoch))
    }
    internal fun geometryChanged() {
        if (closed) return
        dispatcher.batch { for (mount in targets.keys.toList()) dispatcher.submit(3, mount.values(epoch)) }
        scheduleRefresh()
    }
    private fun scheduleRefresh() {
        if (!refreshPosted) {
            refreshPosted = true
            post(refreshTask)
        }
    }
    internal fun refreshGeometry() {
        if (closed) return
        check(epoch < Long.MAX_VALUE) { "Layout epoch exhausted" }
        epoch++
        dispatcher.batch { targets.values.mapNotNull { it.get() }.forEach { register(it) } }
    }
    private fun record(target: View?, channel: Long): LongArray {
        val mount = (target as? TargetView)?.takeIf { it.surface === this }?.mount
        val kind = when { !hasWindowFocus() -> 3L; target == null -> if (channel == 0L) 2L else 3L; mount != null -> 0L; else -> 1L }
        return longArrayOf(channel, kind, mount?.slot ?: 0, mount?.generation ?: 0, mount?.serial ?: 0)
    }
    internal fun focusRecord(channel: Long) = record(if (channel == 0L) rootView.findFocus()
        else accessibilityTarget?.get()?.takeIf { it.isAttachedToWindow && it.isAccessibilityFocused }
            ?: targets.values.mapNotNull { it.get() }.firstOrNull { it.isAccessibilityFocused }, channel)
    internal fun accessibilityObserved(target: View) {
        accessibilityTarget = if (target.isAccessibilityFocused) WeakReference(target) else null
        observe(target, 1)
    }
    override fun requestSendAccessibilityEvent(child: View, event: AccessibilityEvent): Boolean {
        if (event.eventType == AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUSED ||
            event.eventType == AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUS_CLEARED) accessibilityObserved(child)
        return super.requestSendAccessibilityEvent(child, event)
    }
    internal fun observe(target: View? = rootView.findFocus(), channel: Long = 0) {
        if (!closed) dispatcher.submit(4, record(target, channel))
    }
    override fun onWindowFocusChanged(hasWindowFocus: Boolean) {
        super.onWindowFocusChanged(hasWindowFocus)
        observe()
        if (hasWindowFocus) reconcileRestoration()
    }
    fun close() {
        if (closed) return
        closed = true
        restoration = null
        accessibilityTarget = null
        dialogs.close()
        targets.values.mapNotNull { it.get() }.forEach { it.mount = null; it.isFocusable = false; it.resetStyle() }
        targets.clear()
        deferred.clear()
        removeCallbacks(refreshTask)
        refreshPosted = false
        onFocusRecord = null
        input.clear()
        dispatcher.close()
    }
}
