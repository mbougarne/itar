package com.itar.adapter

import android.content.Context
import android.view.View
import com.facebook.react.views.view.ReactViewGroup

class ScopeView(context: Context) : ReactViewGroup(context) {
    var scopeKey = ""
    var collectionDataset = ""
    var parentScopeKey = ""
    var active = true
    var layout = "spatial"
    var boundary = "stop"
    var trap = false
    var entryReady = true
    var restoreOnEntry = false
    var preferredKey = ""
    internal var node = longArrayOf(0, 0)
    internal var owner: SurfaceView? = null
    internal var committedKey = ""
    internal var committedParent = ""
    private var committed: List<Any>? = null
    private var declared: List<Any?>? = null
    internal fun root(): SurfaceView? = generateSequence(parent) { it.parent }.filterIsInstance<SurfaceView>().firstOrNull()
    internal fun commit() {
        val root = root()
        if (owner !== root || scopeKey != committedKey) { owner?.dropScope(this); node = longArrayOf(0, 0) }
        owner = root
        val next = listOf(root, root?.connection?.lifetime, scopeKey, parentScopeKey, active, layout, boundary, trap, entryReady, preferredKey, restoreOnEntry, collectionDataset)
        if (next != declared) { declared = next; root?.scopeChanged() }
        descendantFocusability = if (active) FOCUS_BEFORE_DESCENDANTS else FOCUS_BLOCK_DESCENDANTS
        importantForAccessibility = if (active) IMPORTANT_FOR_ACCESSIBILITY_AUTO else IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
    }
    internal fun publish(parentNode: LongArray): Boolean {
        val root = owner ?: return false
        val config = listOf(scopeKey, parentScopeKey, active, layout, boundary, trap, entryReady, preferredKey, restoreOnEntry,
            parentNode[0], parentNode[1], root.connection.lifetime)
        if (config == committed && node[0] != 0L) return true
        val layouts = listOf("spatial", "row", "column")
        val boundaries = listOf("stop", "wrap", "parent")
        val values = node + parentNode + longArrayOf(if (active) 1 else 0, layouts.indexOf(layout).toLong(),
            boundaries.indexOf(boundary).toLong(), if (trap) 1 else 0, if (entryReady) 1 else 0, if (restoreOnEntry) 1 else 0)
        val result = root.connection.exchange(20, values, scopeKey, preferredKey)
        if (result[0] != 0L) return false
        node = longArrayOf(result[1], result[2])
        committedKey = scopeKey
        committedParent = parentScopeKey
        committed = config
        return true
    }
    override fun onAttachedToWindow() { super.onAttachedToWindow(); commit() }
    override fun onViewAdded(child: View) {
        super.onViewAdded(child); (owner ?: root())?.orderedFocusChanged()
    }
    override fun onViewRemoved(child: View) {
        super.onViewRemoved(child); (owner ?: root())?.orderedFocusChanged()
    }
    internal fun recycle() { owner?.dropScope(this); owner = null; node = longArrayOf(0, 0); committed = null; declared = null; committedKey = "" }
}
