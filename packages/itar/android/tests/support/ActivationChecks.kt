package com.itar.adapter

import android.view.KeyEvent
import android.view.accessibility.AccessibilityNodeInfo

object ActivationChecks {
    fun run(root: SurfaceView, a: TargetView, b: TargetView) {
        root.refreshGeometry()
        check(a.requestFocus())
        val activations = ArrayList<String>()
        a.onActivation = { _, mount, _, source -> activations.add("${mount.key}:$source") }
        b.onActivation = { _, mount, _, source -> activations.add("${mount.key}:$source") }
        root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_DPAD_CENTER))
        root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_DPAD_CENTER))
        check(activations == listOf("a:input"))
        check(b.performAccessibilityAction(AccessibilityNodeInfo.ACTION_CLICK, null))
        check(a.hasFocus() && activations == listOf("a:input", "b:accessibility"))
        root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_DPAD_CENTER))
        a.occurrenceKey = "recycled"
        a.commitProps()
        root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_DPAD_CENTER))
        check(activations.size == 2)
        b.isEnabled = false; b.commitProps()
        check(!b.performClick() && activations.size == 2)
        root.close()
        check(!a.performClick() && activations.size == 2)
    }
}
