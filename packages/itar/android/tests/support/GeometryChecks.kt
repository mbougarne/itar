package com.itar.adapter

import android.content.Context
import android.graphics.Rect
import android.view.KeyEvent
import android.view.View
import android.widget.FrameLayout

class GeometryChecks(context: Context) {
    val root = SurfaceView(context)
    private fun target(key: String) = TargetView(root.context).apply {
        occurrenceKey = key
        actionLabel = key
    }
    private val start = target("start")
    private val translated = target("translated")
    private val farther = target("farther")
    private val parent = FrameLayout(context)

    init {
        root.addView(start)
        root.addView(parent)
        root.addView(farther)
        parent.addView(translated, FrameLayout.LayoutParams(80, 60))
    }

    private fun draw() { root.viewTreeObserver.dispatchOnPreDraw() }

    private fun rightFromStart() {
        check(start.requestFocus())
        check(root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_DPAD_RIGHT)))
        check(root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_DPAD_RIGHT)))
        check(translated.hasFocus()) { "Right must use the card's visual position ahead of the farther card" }
    }

    fun run() {
        root.layout(0, 0, 800, 600)
        start.layout(20, 60, 100, 120)
        farther.layout(360, 60, 440, 120)
        parent.measure(View.MeasureSpec.makeMeasureSpec(80, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(60, View.MeasureSpec.EXACTLY))
        parent.layout(1040, 60, 1120, 120)
        parent.translationX = -840.5f
        draw()
        check(translated.committedBounds == Rect(200, 60, 280, 120)) { "Wrong visual bounds: ${translated.committedBounds}" }
        rightFromStart()

        var activations = 0
        translated.onActivation = { _, _, _, _ -> activations++ }
        translated.adjustable = true
        check(root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_DPAD_CENTER)))
        parent.clipBounds = Rect(0, 0, 24, 60)
        check(root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_DPAD_CENTER)))
        check(activations == 0 && !translated.adjust(1) && !translated.performClick()) {
            "A focused, clipped card accepted input before the next draw"
        }
        draw()
        check(!translated.isFocusable)
        parent.clipBounds = null
        parent.translationX = 0f
        draw()
        check(!translated.isFocusable)

        // Move only the parent. The target's own layout and mount stay unchanged.
        val mount = translated.mount
        parent.layout(200, 60, 280, 120)
        draw()
        check(translated.mount == mount && translated.isFocusable)
        rightFromStart()
        translated.setOnClickListener { parent.scaleX = 1.25f }
        translated.performClick()
        check(activations == 0) { "Native click changed the geometry before activation was delivered" }
        draw()
        check(!translated.isFocusable)
        parent.scaleX = 1f
        draw()
        check(translated.isFocusable)
        val revision = root.connection.exchange(5)[5]
        draw()
        check(root.connection.exchange(5)[5] == revision) { "An unchanged frame republished geometry" }
        rightFromStart()
    }

    fun repeatedScrollInvalidation() {
        root.layout(0, 0, 800, 600)
        start.layout(20, 60, 100, 120)
        root.refreshGeometry()
        check(start.requestFocus())
        // Scroll and layout can fire inline while Android is processing a host call.
        // Duplicates must not exhaust the 32-message inbox before the next draw.
        check(root.dispatcher.hostCall { repeat(40) { root.geometryChanged() } })
        check(!root.closed)

        val late = target("")
        root.addView(late)
        late.layout(120, 60, 200, 120)
        // Like a recycled cell receiving props after attach and layout.
        late.occurrenceKey = "late"
        late.actionLabel = "Late"
        late.commitProps()
        fun expectEffect(kind: Long) {
            val now = android.os.SystemClock.uptimeMillis()
            val request = root.connection.exchange(9, longArrayOf(0, now, now + 3000), late.occurrenceKey)
            val effect = root.connection.exchange(10)
            check(request[2] != 0L && effect[1] == 1L && effect[3] == request[2] &&
                effect[5] == kind && effect[8] == late.mount?.serial) {
                "Expected effect $kind for the late mount, got ${effect.toList()}"
            }
            root.connection.exchange(13, longArrayOf(request[2]))
        }
        expectEffect(1) // Fresh measured mount after the first invalidation.
        root.geometryChanged()
        expectEffect(0) // The next scroll invalidates the new mount immediately.
        root.refreshGeometry()
        expectEffect(1)
    }
}
