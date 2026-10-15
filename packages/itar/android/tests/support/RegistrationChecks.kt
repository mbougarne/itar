package com.itar.adapter

import android.view.View

/** Debug-only host fixture; mutable adapter internals remain internal in release. */
object RegistrationChecks {
    fun run(root: SurfaceView, target: TargetView) {
        root.layout(0, 0, 800, 600)
        target.layout(10, 10, 210, 90)
        root.refreshGeometry()
        val first = target.mount!!
        check(target.isFocusable)
        check(target.requestFocus()) { "Native focus rejected, touch=${root.isInTouchMode}" }
        root.observe()
        check(root.connection.exchange(5)[1] == 0L) { "Focus not managed, window=${root.hasWindowFocus()}" }
        root.removeView(target)
        check(target.mount == null)
        check(root.targets.isEmpty())
        check(target.logicalMount == first)
        root.observe()
        check(root.connection.exchange(5)[1] != 0L)
        check(root.connection.exchange(2, first.values())[0] == 0L)
        root.addView(target)
        target.layout(10, 10, 210, 90)
        root.refreshGeometry()
        check(target.mount != first)
        check(root.connection.exchange(2, first.values())[0] == -1L)
        target.occurrenceKey = "other-rail/movie"
        target.commitProps()
        check(target.mount!!.key == "other-rail/movie")
        target.clipBounds = android.graphics.Rect(0, 0, 0, 0)
        root.geometryChanged()
        root.refreshGeometry()
        check(!target.isFocusable)
        root.close()
        check(target.mount == null)
        check(root.visibility == View.VISIBLE)
    }
}
