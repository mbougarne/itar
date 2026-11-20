package com.itar.adapter

import android.content.Context
import android.view.KeyEvent
import android.view.View
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ScrollView

/** A standalone column or two columns sharing a horizontal viewport. */
class MountedVerticalRevealChecks(context: Context, private val nested: Boolean, mismatchedAxis: Boolean = false) {
    val root = SurfaceView(context)
    private val outer = ScopeView(context).apply { scopeKey = "outer"; layout = "row" }
    private val horizontal = HorizontalScrollView(context).apply { isSmoothScrollingEnabled = false }
    private val columns = FrameLayout(context).apply { minimumWidth = 600 }

    private inner class Column(val key: String, x: Int) {
        val scope = ScopeView(root.context).apply {
            scopeKey = this@Column.key
            parentScopeKey = if (nested) "outer" else ""
            layout = "column"
            boundary = "parent"
        }
        val vertical = ScrollView(root.context).apply { isSmoothScrollingEnabled = false }
        val contents = FrameLayout(root.context).apply { minimumHeight = 600 }
        init {
            vertical.addView(contents, FrameLayout.LayoutParams(80, 600))
            scope.addView(vertical)
            if (nested) columns.addView(scope, FrameLayout.LayoutParams(80, 200).apply { leftMargin = x })
            else root.addView(scope)
        }

        fun item(key: String, order: Int, y: Int) = TargetView(root.context).apply {
            occurrenceKey = key
            scopeKey = this@Column.key
            this.order = order
            actionLabel = key
            contents.addView(this, FrameLayout.LayoutParams(60, 80).apply { topMargin = y })
        }
    }
    private val first = Column("first", 20)
    private val second = if (nested) Column("second", 160) else first
    private val destination = first.item("destination", 0, if (nested) 320 else 20)
    private val source = second.item("source", 1, if (nested) 20 else 320)
    private var original: Mount? = null

    init {
        if (nested) {
            horizontal.addView(columns, FrameLayout.LayoutParams(600, 200))
            outer.addView(horizontal)
            root.addView(outer)
        }
        // The purported owner orders children along a different axis. A direct
        // request can still name the target but the native viewport is ineligible.
        if (mismatchedAxis) first.scope.layout = "row"
    }

    fun start(requestByKey: Boolean = false) {
        fun exact(size: Int) = View.MeasureSpec.makeMeasureSpec(size, View.MeasureSpec.EXACTLY)
        root.layout(0, 0, 800, 600)
        if (nested) {
            outer.layout(0, 0, 200, 200)
            horizontal.measure(exact(200), exact(200))
            horizontal.layout(0, 0, 200, 200)
            horizontal.scrollTo(65, 0)
        } else first.scope.layout(0, 0, 80, 200)
        for (column in setOf(first, second)) {
            column.vertical.measure(exact(80), exact(200))
            column.vertical.layout(0, 0, 80, 200)
        }
        if (!nested) first.vertical.scrollTo(0, 320)
        destination.commitProps(); source.commitProps()
        root.refreshGeometry()
        original = checkNotNull(destination.mount)
        check(!destination.isFocusable && source.requestFocus())
        root.observe()
        if (requestByKey) {
            root.focus(destination.occurrenceKey)
        } else {
            val direction = if (nested) KeyEvent.KEYCODE_DPAD_LEFT else KeyEvent.KEYCODE_DPAD_UP
            check(root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, direction)))
            check(root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, direction)))
        }
    }

    fun finish(moved: Boolean) {
        check(!root.closed && root.connection.exchange(5)[6] == 0L)
        if (!moved) {
            check(root.rootView.findFocus() === source && first.vertical.scrollY == 320)
            return
        }
        check(destination.mount == original && root.live(original) === destination && root.rootView.findFocus() === destination)
        if (nested) {
            check(horizontal.scrollX == 20 && first.vertical.scrollY == 200 && second.vertical.scrollY == 0)
        } else {
            check(first.vertical.scrollY == 20)
        }
    }
}
