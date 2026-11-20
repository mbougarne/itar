package com.itar.adapter

import android.content.Context
import android.view.KeyEvent
import android.view.View
import android.widget.FrameLayout
import android.widget.HorizontalScrollView

class MountedRowRevealChecks(context: Context, private val tooWide: Boolean, programmaticOnly: Boolean) {
    val root = SurfaceView(context)
    private val row = ScopeView(context).apply { scopeKey = "rail"; layout = "row"; boundary = "parent" }
    private val scroll = object : HorizontalScrollView(context) {
        override fun canScrollHorizontally(direction: Int): Boolean = !programmaticOnly && super.canScrollHorizontally(direction)
    }.apply {
        isHorizontalFadingEdgeEnabled = false; isSmoothScrollingEnabled = false
    }
    private val content = FrameLayout(context).apply { minimumWidth = 640 }
    private fun item(key: String, index: Int) = TargetView(root.context).apply {
        occurrenceKey = key; scopeKey = "rail"; order = index; actionLabel = key
    }
    private val previous = item("previous", 0)
    private val current = item("current", 1)
    private val width = if (tooWide) 240 else 80
    private val destination = FrameLayout.LayoutParams(width, 60).apply { leftMargin = 20 }
    private var initialScroll = 0
    private var original: Mount? = null

    init {
        content.addView(previous, destination)
        content.addView(current, FrameLayout.LayoutParams(80, 60).apply { leftMargin = 320 })
        scroll.addView(content, FrameLayout.LayoutParams(640, 80))
        row.addView(scroll)
        root.addView(row)
    }

    fun start() {
        root.layout(0, 0, 800, 600)
        row.layout(0, 0, 240, 100)
        fun exact(px: Int) = View.MeasureSpec.makeMeasureSpec(px, View.MeasureSpec.EXACTLY)
        scroll.measure(exact(200), exact(80))
        scroll.layout(0, 0, 200, 80)
        scroll.scrollTo(320, 0)
        previous.commitProps(); current.commitProps(); root.refreshGeometry()
        original = checkNotNull(previous.mount)
        check(!previous.isFocusable && current.requestFocus())
        root.observe()
        initialScroll = scroll.scrollX
        check(initialScroll == 320 && current.hasFocus()) { "Setup: content=${content.width}, scroll=$initialScroll, focused=${current.hasFocus()}" }
        check(root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_DPAD_LEFT)))
        check(root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_DPAD_LEFT)))
    }

    fun cancel() {
        val request = root.connection.exchange(5)[6]
        check(request > 0)
        root.cancel(root.connection.lifetime, request)
    }

    fun recycle() {
        content.removeView(previous)
        content.addView(previous, destination)
        previous.layout(20, 0, 20 + width, 60)
        previous.commitProps()
        check(previous.mount != original)
    }

    fun checkResult(moved: Boolean) {
        check(!root.closed)
        if (moved) {
            check(scroll.scrollX == 20 && previous.mount == original) { "Expected the same cell to scroll fully into view" }
            check(root.live(original) === previous && root.rootView.findFocus() === previous)
            val source = android.graphics.Rect()
            root.targetGeometry.boundsIn(current, scroll, source)
            check(source.left >= scroll.width && current.committedBounds.isEmpty && !current.isFocusable) {
                "Old source at $source outside ${scroll.width}px viewport remained eligible: ${current.committedBounds}, ${current.isFocusable}"
            }
        } else {
            check(scroll.scrollX == initialScroll && root.rootView.findFocus() === current)
        }
        check(root.connection.exchange(5)[6] == 0L) { "Reveal failed to settle" }
    }
}
