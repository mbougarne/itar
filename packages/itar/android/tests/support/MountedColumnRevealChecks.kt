package com.itar.adapter

import android.content.Context
import android.view.KeyEvent
import android.view.View
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ScrollView

class MountedColumnRevealChecks(private val context: Context, collection: Boolean = false) {
    val root = SurfaceView(context)
    private val dataset = if (collection) "1" else ""
    private val column = ScopeView(context).apply { scopeKey = "page"; layout = "column"; collectionDataset = dataset }
    private var onVerticalScroll: (() -> Unit)? = null
    private val vertical = object : ScrollView(context) {
        override fun canScrollVertically(direction: Int) = false
        override fun onScrollChanged(l: Int, t: Int, oldl: Int, oldt: Int) {
            super.onScrollChanged(l, t, oldl, oldt)
            val callback = onVerticalScroll ?: return
            onVerticalScroll = null
            callback()
        }
    }.apply {
        isVerticalFadingEdgeEnabled = false; isSmoothScrollingEnabled = false
    }
    private val rows = FrameLayout(context).apply { minimumHeight = 600 }
    private inner class Rail(id: String, y: Int, cardX: Int) {
        val scope = ScopeView(context).apply { scopeKey = id; parentScopeKey = "page"; layout = "row"; boundary = "parent"; collectionDataset = dataset }
        val horizontal = HorizontalScrollView(context).apply {
            isHorizontalFadingEdgeEnabled = false; isSmoothScrollingEnabled = false
        }
        val card = TargetView(context).apply { occurrenceKey = "$id/card"; scopeKey = id; actionLabel = id; collectionDataset = dataset }
        init {
            val content = FrameLayout(context).apply { minimumWidth = 600 }
            content.addView(card, FrameLayout.LayoutParams(80, 60).apply { leftMargin = cardX })
            horizontal.addView(content, FrameLayout.LayoutParams(600, 80))
            scope.addView(horizontal)
            rows.addView(scope, FrameLayout.LayoutParams(200, 80).apply { topMargin = y })
        }
    }
    private val previous = Rail("row-000", 20, 320)
    private val current = Rail("row-001", 160, 20)
    private var mount: Mount? = null

    init {
        vertical.addView(rows, FrameLayout.LayoutParams(200, 600))
        column.addView(vertical)
        root.addView(column)
    }

    fun publish() {
        root.collectionData = """{"dataset":"1","nodes":[
            {"key":"page","parent":"","order":0,"scope":true,"enabled":true,"layout":2,"extent":140,"rowEntry":1},
            {"key":"row-000","parent":"page","order":0,"scope":true,"enabled":true,"layout":1,"extent":80},
            {"key":"row-001","parent":"page","order":1,"scope":true,"enabled":true,"layout":1,"extent":80},
            {"key":"row-000/card","parent":"row-000","order":0,"scope":false,"enabled":true,"layout":0,"extent":0},
            {"key":"row-001/card","parent":"row-001","order":0,"scope":false,"enabled":true,"layout":0,"extent":0}]}"""
    }

    fun start(mountAfterInput: Boolean = false) {
        fun exact(px: Int) = View.MeasureSpec.makeMeasureSpec(px, View.MeasureSpec.EXACTLY)
        root.layout(0, 0, 800, 600)
        column.layout(0, 0, 200, 200)
        vertical.measure(exact(200), exact(200))
        vertical.layout(0, 0, 200, 200)
        for (rail in listOf(previous, current)) {
            rail.horizontal.measure(exact(200), exact(80))
            rail.horizontal.layout(0, 0, 200, 80)
        }
        vertical.scrollTo(0, 65)
        previous.card.commitProps(); current.card.commitProps()
        root.refreshGeometry()
        mount = checkNotNull(previous.card.mount)
        check(!previous.card.isFocusable && current.card.requestFocus())
        check(vertical.scrollY == 65) { "Setup: rows=${rows.height}, scroll=${vertical.scrollY}" }
        root.observe()
        val container = previous.card.parent as FrameLayout
        if (mountAfterInput) container.removeView(previous.card)
        check(root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_DPAD_UP)))
        check(root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_DPAD_UP)))
        if (mountAfterInput) {
            // The outer render window commits the row and the destination card
            // together. No JS marker acknowledgement is sent in this fixture.
            vertical.scrollTo(0, 20)
            previous.horizontal.scrollTo(200, 0)
            container.addView(previous.card)
            previous.card.layout(320, 0, 400, 60)
            previous.card.commitProps()
            val next = checkNotNull(previous.card.mount)
            check(next != mount)
            mount = next
            root.refreshGeometry()
            root.collections.advance()
        }
    }

    fun recycleOnNextScroll() {
        onVerticalScroll = {
            val container = previous.card.parent as FrameLayout
            container.removeView(previous.card)
            container.addView(previous.card)
            previous.card.layout(320, 0, 400, 60)
            previous.card.commitProps()
        }
    }

    fun checkRecycled() {
        check(!root.closed && previous.card.mount != mount)
        check(vertical.scrollY == 20 && previous.horizontal.scrollX == 0)
        check(root.rootView.findFocus() === current.card)
    }

    fun finish() {
        check(!root.closed && root.connection.exchange(5)[6] == 0L)
        check(vertical.scrollY == 20) { "Up did not expose the preceding rail: ${vertical.scrollY}" }
        check(previous.horizontal.scrollX == 200 && current.horizontal.scrollX == 0) {
            "Only the destination rail should scroll horizontally"
        }
        check(previous.card.mount == mount && root.live(mount) === previous.card && root.rootView.findFocus() === previous.card)
    }

    fun reflowAtViewportEdge() {
        val card = previous.card
        var activations = 0
        card.onActivation = { _, _, _, _ -> activations++ }
        fun moveRow(dy: Int) {
            previous.scope.offsetTopAndBottom(dy)
            root.refreshGeometry()
        }
        // A virtualizer can revise the row's offset after the mounted reveal is confirmed.
        moveRow(-1)
        check(root.rootView.findFocus() === card && card.isFocusable && card.committedBounds.isEmpty)
        check(root.live(mount) == null && !card.performClick() && activations == 0)
        check(root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_DPAD_CENTER)))
        moveRow(1)
        check(root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_DPAD_CENTER)) && activations == 0)
        check(root.live(mount) === card && card.performClick() && activations == 1)

        // The retained source must not become an eligible destination on the next focus change.
        moveRow(-4)
        check(current.card.requestFocus())
        check(!card.isFocusable && !card.requestFocus() && root.rootView.findFocus() === current.card)
        moveRow(4)
        check(card.requestFocus())
        moveRow(-4)
        check(root.rootView.findFocus() === card)
        card.clearFocus()
        check(!card.isFocusable && !card.requestFocus() && root.rootView.findFocus() !== card)
        moveRow(4)
        check(card.requestFocus())
        moveRow(-4)
        moveRow(-card.height)
        check(root.rootView.findFocus() !== card && !card.isFocusable)
    }
}
