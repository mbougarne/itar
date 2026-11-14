package com.itar.adapter

import android.content.Context
import android.graphics.Rect
import android.view.View
import android.view.ViewGroup
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
    private val logicalTargets = LinkedHashMap<String, WeakReference<TargetView>>()
    internal val scopes = LinkedHashMap<String, WeakReference<ScopeView>>()
    private var scopesDirty = true
    internal val collections = Collections(this)
    private val collectionAccessibility = CollectionAccessibility(this)
    private val orderedFocus = OrderedFocus(this)
    internal var dispatcher = Dispatcher(this)
    var collectionData = ""
        set(value) { if (field != value) { field = value; collections.configure(value) } }
    internal var onFocusRecord: ((LongArray) -> Unit)? = null
    internal var onRequestRecord: ((LongArray) -> Unit)? = null
    internal var onSurfaceRecord: ((String) -> Unit)? = null
    internal var eventSequence = 0L
    internal val commandRequests = LinkedHashMap<Long, String>()
    internal val mountCommands = reactMountCommands()
    internal var providerId = ""
        private set
    internal var bindRecords: ((SurfaceView) -> Unit)? = null
    internal var dialogs = Dialogs(this)
    private var covered = false
    private var hiddenForActivity = false
    private var appliedActivity: Boolean? = null
    private var geometryDirty = true
    private var refreshingGeometry = false
    private var savedImportance = IMPORTANT_FOR_ACCESSIBILITY_AUTO
    private var savedDescendants = FOCUS_BEFORE_DESCENDANTS
    private var restoration: Restoration? = null
    private var accessibilityTarget: WeakReference<View>? = null
    var active = true
        set(value) { if (field != value) { field = value; updateActivity() } }
    internal val acceptsInput get() = active && !covered && !closed
    private val input = Input(this)
    internal val readerOwnsInput get() = input.owner == 3L
    private val deferred = ArrayList<WeakReference<TargetView>>()
    private var refreshPosted = false
    var closed = false
        private set
    private val focusObserver = ViewTreeObserver.OnGlobalFocusChangeListener { _, target -> observe(target) }
    private val scrollObserver = ViewTreeObserver.OnScrollChangedListener { geometryChanged() }
    private val layoutObserver = ViewTreeObserver.OnGlobalLayoutListener { orderedFocusChanged() }
    private val refreshTask = Runnable {
        refreshPosted = false
        if (!closed) dispatcher.batch {
            val pending = deferred.mapNotNull { it.get() }
            deferred.clear()
            refreshGeometry()
            pending.filter { it.isAttachedToWindow && it.surface === this }.forEach { it.commitProps() }
            rebuildOrderedFocus()
            collectionAccessibility.rebuild()
            post { if (!closed) collections.advance() }
        }
    }
    fun focus(key: String) {
        if (closed) return
        if (!acceptsInput) { onRequestRecord?.invoke(longArrayOf(0, 3, 0)); return }
        val now = SystemClock.uptimeMillis()
        dispatcher.batch { refreshGeometry(); observe(); dispatcher.submit(9, longArrayOf(input.owner, now, now + 3000), key) }
    }
    fun focusRequest(key: String, command: String, receivedAt: Long = SystemClock.uptimeMillis()) {
        if (command.isEmpty() || command.length > 64) return
        if (!acceptsInput || commandRequests.size >= 32) { emitRequest(longArrayOf(0, 3, 0), command); return }
        val now = receivedAt
        dispatcher.batch { refreshGeometry(); observe(); dispatcher.submit(9, longArrayOf(input.owner, now, now + 3000), key, command) }
    }
    fun cancelRequest(command: String) { if (!closed) dispatcher.submit(22, command = command) }
    fun restoreScopeRequest(key: String, command: String, receivedAt: Long = SystemClock.uptimeMillis()) {
        if (!acceptsInput || command.isEmpty() || command.length > 64) { emitRequest(longArrayOf(0, 3, 0), command); return }
        val now = receivedAt
        dispatcher.batch {
            refreshGeometry(); observe()
            if (readerOwnsInput) observe(channel = 1)
            dispatcher.submit(23, longArrayOf(input.owner, now, now + 3000), key, command)
        }
    }
    fun configureProvider(value: String) {
        if (providerId == value) return
        if (providerId.isNotEmpty()) close()
        providerId = value
        if (isAttachedToWindow) {
            reopen()
            val pending = ArrayDeque<View>()
            for (i in 0 until childCount) pending.addLast(getChildAt(i))
            var visited = 0
            while (pending.isNotEmpty()) {
                if (++visited > 4096 || pending.size > 4096) { close(); return }
                val view = pending.removeFirst()
                if (view is SurfaceView) continue
                if (view is TargetView) view.commitProps()
                else if (view is ViewGroup) for (i in 0 until view.childCount) pending.addLast(view.getChildAt(i))
            }
            onSurfaceRecord?.invoke("ready")
            observe()
        }
    }
    fun cancel(lifetime: Long, request: Long) {
        if (closed) return
        if (lifetime != connection.lifetime) { onRequestRecord?.invoke(longArrayOf(0, 4, request)); return }
        if (request > 0) dispatcher.submit(13, longArrayOf(request)) else rejectCommand()
    }
    internal fun rejectCommand() { if (!closed) onRequestRecord?.invoke(longArrayOf(0, 5, 0)) }
    fun showDialog() = dialogs.show()
    fun dismissDialog() = dialogs.dismiss()
    internal fun cover(value: Boolean) { covered = value; updateActivity() }
    internal fun updateActivity() {
        if (closed) return
        val activityChanged = appliedActivity != acceptsInput
        appliedActivity = acceptsInput
        if (!acceptsInput) {
            collectionAccessibility.clear()
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
        if (activityChanged) { geometryDirty = true; refreshGeometry() }
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
            dispatcher.submit(18, longArrayOf(now, now + 3000))
        }
    }
    internal fun live(mount: Mount?): TargetView? = targets[mount]?.get()?.takeIf {
        acceptsInput && it.mount == mount && it.isAttachedToWindow && it.isShown && it.isEnabled && it.isFocusable &&
            scopeActive(it.scopeKey) &&
            matrix.isIdentity && generateSequence<View>(it) { view -> view.parent as? View }.takeWhile { view -> view !== this }
                .all { view -> view.matrix.isIdentity && (view.clipBounds == null || view.clipBounds == Rect(0, 0, view.width, view.height)) }
    }
    override fun focusSearch(focused: View, direction: Int): View? =
        if (!acceptsInput) focused else input.query(focused, direction) ?: super.focusSearch(focused, direction)
    override fun dispatchKeyEvent(event: KeyEvent): Boolean = acceptsInput && (input.dispatch(event) || super.dispatchKeyEvent(event))
    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        reopen()
        input.start()
        viewTreeObserver.addOnGlobalFocusChangeListener(focusObserver)
        viewTreeObserver.addOnScrollChangedListener(scrollObserver)
        viewTreeObserver.addOnGlobalLayoutListener(layoutObserver)
        onSurfaceRecord?.invoke("ready")
    }
    private fun reopen() {
        if (closed) {
            connection = Connection()
            dispatcher = Dispatcher(this)
            dialogs = Dialogs(this)
            covered = false
            closed = false
            bindRecords?.invoke(this)
            updateActivity()
            input.start()
        }
    }
    override fun onDetachedFromWindow() {
        viewTreeObserver.removeOnGlobalFocusChangeListener(focusObserver)
        viewTreeObserver.removeOnScrollChangedListener(scrollObserver)
        viewTreeObserver.removeOnGlobalLayoutListener(layoutObserver)
        close()
        super.onDetachedFromWindow()
    }
    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        geometryChanged()
    }
    internal fun register(target: TargetView) {
        if (closed) return
        orderedFocus.clear()
        if (dispatcher.busy) {
            if (deferred.none { it.get() === target }) {
                if (deferred.size == 32) { close(); return }
                deferred.add(WeakReference(target))
            }
            scheduleRefresh()
            return
        }
        if (!refreshScopes()) { target.isFocusable = false; return }
        val parent = scopes[target.scopeKey]?.get()
        if (!target.scopeKey.isEmpty() && (parent == null || !parent.isAttachedToWindow || parent.owner !== this ||
            parent.root() !== this || !collections.accepts(parent.scopeKey, parent.collectionDataset, true, parent) ||
            (parent.collectionDataset.isNotEmpty() && parent.collectionDataset != target.collectionDataset &&
                collections.entry(target.occurrenceKey) == null))) {
            target.maskCollectionAccessibility(); detach(target); return
        }
        val scope = parent?.node ?: longArrayOf(0, 0)
        val collection = collections.entry(target.occurrenceKey)
        if (!collections.accepts(target.occurrenceKey, target.collectionDataset, false, target) ||
            (collection != null && collection.parent != target.scopeKey)) {
            target.maskCollectionAccessibility(); detach(target); return
        }
        val old = target.mount
        val logical = target.logicalMount
        if (old == null) { check(epoch < Long.MAX_VALUE); epoch++ }
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
        val values = longArrayOf(logical?.slot ?: 0, logical?.generation ?: 0, mountSerial,
            target.order.toLong(), if (target.isEnabled && acceptsInput) 1 else 0, epoch,
            if (target.width <= 0 || target.height <= 0) 0 else if (measured) 2 else 4,
            rect.left.toLong(), rect.top.toLong(), rect.width().toLong(), rect.height().toLong(), logical?.serial ?: 0) + scope + (if (collection != null) collections.dataset else 0L)
        val result = connection.exchange(1, values, target.occurrenceKey)
        if (result[0] == 0L) {
            val mount = Mount(result[1], result[2], result[3], target.occurrenceKey)
            target.mount = mount
            target.logicalMount = mount
            target.logicalOwner = WeakReference(this)
            target.logicalLifetime = connection.lifetime
            target.logicalScopeKey = target.scopeKey
            target.committedOrder = target.order
            target.committedEnabled = target.isEnabled
            logical?.key?.takeIf { it != target.occurrenceKey && logicalTargets[it]?.get() === target }?.let { logicalTargets.remove(it) }
            logicalTargets[target.occurrenceKey] = WeakReference(target)
            targets[mount] = WeakReference(target)
            target.isFocusable = target.isEnabled && collection?.enabled != false &&
                (measured || collections.retained(mount)) && acceptsInput && scopeActive(target.scopeKey)
            target.resumeCollectionAccessibility()
            target.resumeStyle()
            if (target.hasFocus()) observe(target)
            if (target.isAccessibilityFocused) observe(target, 1)
        } else {
            target.isFocusable = false
            target.resetStyle()
            old?.let { connection.exchange(3, it.values(epoch)) }
        }
        dispatcher.kick()
        if (!refreshingGeometry) scheduleRefresh()
    }
    internal fun detach(target: TargetView) {
        orderedFocusChanged()
        target.resetStyle()
        val old = target.mount ?: return
        target.mount = null // Host authority is revoked before any engine/configuration work.
        targets.remove(old)
        target.isFocusable = false
        if (!closed) dispatcher.submit(2, old.values(epoch))
    }
    internal fun dropLogical(identity: Mount, lifetime: Long) {
        if (logicalTargets[identity.key]?.get()?.logicalMount == identity) logicalTargets.remove(identity.key)
        if (!closed && connection.lifetime == lifetime && collections.entry(identity.key) == null) dispatcher.submit(19, identity.values(epoch))
    }
    internal fun retireCollectionKeys(handles: Map<String, LongArray>) {
        for ((key, owned) in handles) {
            val target = logicalTargets[key]?.get()
            val logical = target?.logicalMount
            if (logical == null || (logical.slot == owned[0] && logical.generation == owned[1])) {
                target?.let {
                    it.maskCollectionAccessibility(); detach(it)
                    it.logicalMount = null; it.logicalOwner = null; it.logicalLifetime = 0; it.logicalScopeKey = ""
                }
                logicalTargets.remove(key)
            }
            val scope = scopes[key]?.get()
            if (scope == null || (scope.node[0] == owned[0] && scope.node[1] == owned[1])) {
                scopes.remove(key)
                scope?.let {
                    it.importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
                    it.owner = null; it.node = longArrayOf(0, 0)
                }
            }
        }
    }
    internal fun geometryChanged() {
        if (closed) return
        orderedFocus.clear()
        geometryDirty = true
        // One bounded inbox record even when a nested window has many cells.
        val values = targets.keys.flatMap { it.values(epoch).toList() }.toLongArray()
        if (values.isNotEmpty()) dispatcher.submit(26, values)
        scheduleRefresh()
    }
    private fun scheduleRefresh() {
        if (!refreshPosted) {
            refreshPosted = true
            post(refreshTask)
        }
    }
    internal fun orderedFocusChanged() {
        orderedFocus.clear()
        if (!closed) scheduleRefresh()
    }
    internal fun collectionAccessibilityChanged() { collectionAccessibility.clear(); if (!closed) scheduleRefresh() }
    private fun rebuildOrderedFocus() {
        if (!closed && !geometryDirty && !scopesDirty) orderedFocus.rebuild()
    }
    internal fun scopeChanged() { collectionAccessibility.clear(); scopesDirty = true; geometryChanged() }
    internal fun scopeActive(key: String): Boolean {
        var current = key
        repeat(257) {
            if (current.isEmpty()) return true
            val scope = scopes[current]?.get() ?: return false
            if (!scope.active || !scope.isAttachedToWindow || scope.owner !== this || scope.root() !== this ||
                !collections.accepts(current, scope.collectionDataset, true, scope)) return false
            current = scope.parentScopeKey
        }
        return false
    }
    private fun refreshScopes(): Boolean {
        if (closed || dispatcher.busy) return false
        if (!scopesDirty) return true
        val pending = ArrayDeque<View>()
        for (i in 0 until childCount) pending.addLast(getChildAt(i))
        val groups = ArrayList<ScopeView>()
        var visited = 0
        while (pending.isNotEmpty()) {
            if (++visited > 4096 || groups.size >= 256 || pending.size > 4096) { close(); return false }
            val view = pending.removeFirst()
            if (view is SurfaceView) continue
            if (view is ScopeView && view.isAttachedToWindow &&
                collections.accepts(view.scopeKey, view.collectionDataset, true, view) &&
                collections.entry(view.scopeKey)?.let { it.parent == view.parentScopeKey } != false) groups.add(view)
            if (view is ViewGroup) for (i in 0 until view.childCount) pending.addLast(view.getChildAt(i))
        }
        val remaining = groups.toMutableList()
        val published = HashSet<String>()
        repeat(groups.size + 1) {
            val ready = remaining.filter { it.parentScopeKey.isEmpty() || published.contains(it.parentScopeKey) }
            for (scope in ready) {
                val old = scopes[scope.scopeKey]?.get()
                if (scope.scopeKey.isEmpty() || (old != null && old !== scope && old.isAttachedToWindow)) { close(); return false }
                if (old != null && old !== scope) {
                    scope.node = old.node.copyOf()
                    scope.committedKey = old.committedKey
                    scope.committedParent = old.committedParent
                }
                if (scope.owner !== this) scope.owner?.dropScope(scope)
                scope.owner = this
                val parent = if (scope.parentScopeKey.isEmpty()) longArrayOf(0, 0)
                    else scopes[scope.parentScopeKey]?.get()?.node ?: return false
                val parentScope = scopes[scope.parentScopeKey]?.get()
                if (parentScope != null && parentScope.collectionDataset.isNotEmpty() &&
                    collections.entry(scope.scopeKey) == null) continue
                if (!scope.publish(parent)) { close(); return false }
                scopes[scope.scopeKey] = WeakReference(scope)
                published.add(scope.scopeKey)
                remaining.remove(scope)
            }
            if (remaining.isEmpty()) { scopesDirty = false; collectionAccessibility.rebuild(); return true }
        }
        // Parent and child props can arrive in separate virtualizer commits.
        // Keep geometry unavailable until the accepted catalog's parent mounts.
        if (remaining.any { it.collectionDataset.isNotEmpty() }) return false
        close()
        return false
    }
    internal fun dropScope(scope: ScopeView) {
        collectionAccessibility.clear()
        orderedFocusChanged()
        val retiredKey = scope.committedKey
        if (retiredKey.isEmpty() || scopes[retiredKey]?.get() !== scope) return
        fun inside(key: String): Boolean {
            var current = key
            repeat(257) {
                if (current == retiredKey) return true
                if (current.isEmpty()) return false
                current = scopes[current]?.get()?.committedParent ?: return false
            }
            return false
        }
        val retired = scopes.keys.filter { inside(it) }.toSet()
        scopesDirty = true
        dispatcher.batch {
            logicalTargets.values.mapNotNull { it.get() }.filter { retired.contains(it.logicalScopeKey) }.forEach {
                detach(it)
                logicalTargets.remove(it.logicalMount?.key ?: it.occurrenceKey)
                it.logicalMount = null; it.logicalOwner = null; it.logicalLifetime = 0; it.logicalScopeKey = ""
            }
            if (!closed && scope.node[0] != 0L && scope.collectionDataset.isEmpty()) dispatcher.submit(21, scope.node)
            retired.forEach { key -> scopes.remove(key)?.get()?.let { it.owner = null; it.node = longArrayOf(0, 0) } }
        }
    }
    internal fun refreshGeometry() {
        if (closed || !geometryDirty) return
        if (dispatcher.busy) { scheduleRefresh(); return }
        geometryDirty = false
        check(epoch < Long.MAX_VALUE) { "Layout epoch exhausted" }
        epoch++
        refreshingGeometry = true
        try { dispatcher.batch { targets.values.mapNotNull { it.get() }.forEach { register(it) } } }
        finally { refreshingGeometry = false }
        rebuildOrderedFocus()
        collectionAccessibility.rebuild()
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
        orderedFocusChanged()
        observe()
        if (hasWindowFocus) reconcileRestoration()
    }
    fun close() {
        if (closed) return
        closed = true
        collectionAccessibility.close()
        orderedFocus.clear()
        mountCommands.clear()
        collections.close()
        onSurfaceRecord?.invoke("disposed")
        commandRequests.clear()
        appliedActivity = null
        geometryDirty = true
        restoration = null
        accessibilityTarget = null
        dialogs.close()
        targets.values.mapNotNull { it.get() }.forEach { it.mount = null; it.isFocusable = false; it.resetStyle() }
        targets.clear()
        logicalTargets.clear()
        scopes.values.mapNotNull { it.get() }.forEach { it.clearPaneTitle(); it.owner = null; it.node = longArrayOf(0, 0) }
        scopes.clear()
        scopesDirty = true
        deferred.clear()
        removeCallbacks(refreshTask)
        refreshPosted = false
        onFocusRecord = null
        onRequestRecord = null
        input.clear()
        dispatcher.close()
    }
}
