package com.itar.adapter

import android.content.Context
import android.os.SystemClock
import android.view.KeyEvent
import android.view.View
import android.view.accessibility.AccessibilityManager

internal class Input(private val root: SurfaceView) {
    private val ownedKeys = HashSet<Int>() // At most four directions; no movement queue.
    private val reader = root.context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
    private data class Activation(val keyCode: Int, val lifetime: Long, val mount: Mount)
    private var activation: Activation? = null
    private var listening = false
    private val stateListener = AccessibilityManager.AccessibilityStateChangeListener { ownershipChanged() }
    private val explorationListener = AccessibilityManager.TouchExplorationStateChangeListener { ownershipChanged() }
    fun start() {
        if (listening) return
        listening = true
        reader.addAccessibilityStateChangeListener(stateListener)
        reader.addTouchExplorationStateChangeListener(explorationListener)
    }
    private fun ownershipChanged() {
        activation = null
        root.dispatcher.batch { root.dispatcher.submit(16); root.observe(); root.observe(channel = 1) }
    }
    private fun nativeDirection(value: Int) = when (value) {
        View.FOCUS_LEFT -> 0L; View.FOCUS_RIGHT -> 1L; View.FOCUS_UP -> 2L; View.FOCUS_DOWN -> 3L
        else -> -1L
    }
    fun owns(view: View?) = !root.closed && root.hasWindowFocus() && !reader.isEnabled &&
        view is TargetView && view.surface === root && root.live(view.mount) === view
    fun query(focused: View?, direction: Int): View? {
        if (!owns(focused)) return null
        val value = nativeDirection(direction)
        if (value < 0) return null
        val result = root.connection.exchange(6, longArrayOf(value, 0))
        if (result[0] != 0L || result[1] != 0L) return focused
        return root.targets.keys.firstOrNull {
            it.slot == result[2] && it.generation == result[3] && it.serial == result[4]
        }?.let { root.live(it) } ?: focused
    }
    fun dispatch(event: KeyEvent): Boolean {
        val press = activation
        if (event.action == KeyEvent.ACTION_UP && press?.keyCode == event.keyCode) {
            activation = null
            if (!event.isCanceled) root.live(press.mount)?.activateInput(press.mount, press.lifetime)
            return true
        }
        if (event.keyCode == KeyEvent.KEYCODE_DPAD_CENTER || event.keyCode == KeyEvent.KEYCODE_ENTER ||
            event.keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER) {
            val target = root.findFocus() as? TargetView
            if (event.action != KeyEvent.ACTION_DOWN || !owns(target)) return false
            if (event.repeatCount == 0) target?.mount?.let { activation = Activation(event.keyCode, root.connection.lifetime, it) }
            return true
        }
        if (event.action == KeyEvent.ACTION_UP && ownedKeys.remove(event.keyCode)) {
            root.dispatcher.submit(8)
            return true
        }
        val value = when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_LEFT -> 0L; KeyEvent.KEYCODE_DPAD_RIGHT -> 1L
            KeyEvent.KEYCODE_DPAD_UP -> 2L; KeyEvent.KEYCODE_DPAD_DOWN -> 3L
            else -> return false
        }
        if (event.action != KeyEvent.ACTION_DOWN || !owns(root.findFocus())) return false
        ownedKeys.add(event.keyCode)
        root.dispatcher.batch {
            root.refreshGeometry()
            root.observe()
            val now = SystemClock.uptimeMillis()
            root.dispatcher.submit(7, longArrayOf(value, 0, now, now + 500))
        }
        return true
    }
    fun clear() {
        ownedKeys.clear()
        activation = null
        if (listening) {
            reader.removeAccessibilityStateChangeListener(stateListener)
            reader.removeTouchExplorationStateChangeListener(explorationListener)
            listening = false
        }
    }
}
