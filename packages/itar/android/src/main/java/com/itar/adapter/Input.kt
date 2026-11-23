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
    private var selectKey: Int? = null
    private var listening = false
    private val stateListener = AccessibilityManager.AccessibilityStateChangeListener { ownershipChanged() }
    private val explorationListener = AccessibilityManager.TouchExplorationStateChangeListener { ownershipChanged() }
    val owner get() = if (reader.isEnabled) 3L else 0L
    fun start() {
        if (listening) return
        listening = true
        reader.addAccessibilityStateChangeListener(stateListener)
        reader.addTouchExplorationStateChangeListener(explorationListener)
    }
    private fun ownershipChanged() {
        activation = null
        root.geometryChanged()
        root.dispatcher.batch { root.dispatcher.submit(16); root.observe(); root.observe(channel = 1) }
    }
    private fun nativeDirection(value: Int) = when (value) {
        View.FOCUS_LEFT -> 0L; View.FOCUS_RIGHT -> 1L; View.FOCUS_UP -> 2L; View.FOCUS_DOWN -> 3L
        else -> -1L
    }
    fun owns(view: View?) = !root.closed && root.hasWindowFocus() && !reader.isEnabled &&
        view is TargetView && view.surface === root && root.live(view.mount, allowFocusedSource = true) === view
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
    private fun keyDirection(code: Int) = when (code) {
        KeyEvent.KEYCODE_DPAD_LEFT -> 0L; KeyEvent.KEYCODE_DPAD_RIGHT -> 1L
        KeyEvent.KEYCODE_DPAD_UP -> 2L; KeyEvent.KEYCODE_DPAD_DOWN -> 3L
        else -> -1L
    }
    private fun directionName(value: Long) = when (value) {
        0L -> "left"; 1L -> "right"; 2L -> "up"; else -> "down"
    }
    fun dispatch(event: KeyEvent): Boolean {
        val press = activation
        if (event.action == KeyEvent.ACTION_UP && selectKey == event.keyCode) {
            selectKey = null
            activation = null
            if (!event.isCanceled && press != null) root.live(press.mount)?.activateInput(press.mount, press.lifetime)
            return true
        }
        if (event.action == KeyEvent.ACTION_DOWN) {
            val direction = keyDirection(event.keyCode)
            if (direction >= 0) return directionDown(event, direction)
            if (event.repeatCount > 0 && reader.isEnabled && selectKey == event.keyCode) return true
        }
        if (event.keyCode == KeyEvent.KEYCODE_DPAD_CENTER || event.keyCode == KeyEvent.KEYCODE_ENTER ||
            event.keyCode == KeyEvent.KEYCODE_NUMPAD_ENTER) {
            val target = root.findFocus() as? TargetView
            if (event.action != KeyEvent.ACTION_DOWN || !owns(target)) return false
            if (event.repeatCount == 0) target?.mount?.let {
                selectKey = event.keyCode
                activation = if (root.live(it) === target) Activation(event.keyCode, root.connection.lifetime, it) else null
            }
            return true
        }
        captureFocus { sink ->
            val direction = keyDirection(event.keyCode)
            if (direction >= 0 && event.action == KeyEvent.ACTION_UP) {
                sink.event("input", root.connection.lifetime, move = sink.move(event),
                    owner = when {
                        ownedKeys.contains(event.keyCode) -> "engine"
                        reader.isEnabled -> "accessibility"
                        else -> "host"
                    }, direction = directionName(direction), detail = "surface up")
            }
        }
        if (event.action == KeyEvent.ACTION_UP && ownedKeys.remove(event.keyCode)) {
            root.dispatcher.submit(8)
            return true
        }
        return false
    }
    private fun directionDown(event: KeyEvent, value: Long): Boolean {
        val retainedRepeat = event.repeatCount > 0 && reader.isEnabled && ownedKeys.contains(event.keyCode)
        val target = root.findFocus() as? TargetView
        val owned = !retainedRepeat && owns(target)
        var move = 0L
        captureFocus { sink ->
            move = sink.move(event)
            sink.event("input", root.connection.lifetime, move = move,
                owner = when {
                    reader.isEnabled -> "accessibility"
                    !owned || (value < 2 && target?.adjustable == true) -> "host"
                    else -> "engine"
                },
                direction = directionName(value),
                detail = if (retainedRepeat) "surface retained repeat" else "surface down")
        }
        if (retainedRepeat) return true
        if (!owned) return false
        ownedKeys.add(event.keyCode)
        // Horizontal adjustment belongs to the control, not to navigation.
        if (value < 2 && target?.adjustable == true) {
            target.adjust(if (value == 0L) -1 else 1)
            return true
        }
        // Capture a primitive in the batch closure, never a boxed mutable trace counter.
        val requestMove = move
        root.dispatcher.batch {
            root.refreshGeometry()
            root.observe()
            val now = SystemClock.uptimeMillis()
            root.dispatcher.submit(7, longArrayOf(value, 0, now, now + 3000), move = requestMove)
        }
        return true
    }
    fun clear() {
        ownedKeys.clear()
        activation = null
        selectKey = null
        if (listening) {
            reader.removeAccessibilityStateChangeListener(stateListener)
            reader.removeTouchExplorationStateChangeListener(explorationListener)
            listening = false
        }
    }
}
