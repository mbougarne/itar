package com.itar.adapter

import android.view.KeyEvent
import android.view.View

object QueryChecks {
    fun run(root: SurfaceView, a: TargetView, b: TargetView, foreign: View) {
        root.refreshGeometry()
        check(a.requestFocus())
        root.observe()
        val before = root.connection.exchange(5)
        repeat(100) { check(root.focusSearch(a, View.FOCUS_RIGHT) === b) }
        check(a.hasFocus() && before.contentEquals(root.connection.exchange(5)))
        check(foreign.requestFocus())
        root.observe()
        root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_DPAD_RIGHT))
        root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_DPAD_RIGHT))
        check(root.connection.exchange(5)[6] == 0L) // Native control, no engine request.
        root.close()
    }
}
