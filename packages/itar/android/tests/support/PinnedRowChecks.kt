package com.itar.adapter

import android.content.Context
import android.view.KeyEvent
import android.view.View
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import kotlin.math.roundToInt

/** Three actual cells fit on screen. End spacing lets their common focus slot stay fixed. */
class PinnedRowChecks(context: Context) {
    val root = SurfaceView(context)
    private val catalogue = ScopeView(context).apply { scopeKey = "catalogue"; collectionDataset = "1"; layout = "column" }
    private val row = ScopeView(context).apply {
        scopeKey = "row"; parentScopeKey = "catalogue"; collectionDataset = "1"; layout = "row"
    }
    private val scroll = HorizontalScrollView(context).apply { isHorizontalFadingEdgeEnabled = false }
    private val content = FrameLayout(context)
    private val extent = (100 * context.resources.displayMetrics.density).roundToInt()
    private val gutter = 8
    private val cards = (0 until 3).map { index ->
        TargetView(context).apply {
            occurrenceKey = "card-$index"; order = index; scopeKey = "row"
            actionLabel = "Card $index"; collectionDataset = "1"
        }
    }

    init {
        for ((i, card) in cards.withIndex()) content.addView(card, FrameLayout.LayoutParams(extent - gutter, 60)
            .apply { leftMargin = i * extent + gutter })
        content.minimumWidth = 5 * extent
        scroll.addView(content, FrameLayout.LayoutParams(5 * extent, 80))
        row.addView(scroll); catalogue.addView(row); root.addView(catalogue)
    }

    fun publish() {
        val members = cards.mapIndexed { i, _ ->
            """{"key":"card-$i","parent":"row","order":$i,"scope":false,"enabled":true,"layout":0,"extent":0}"""
        }.joinToString(",")
        root.collectionData = """{"dataset":"1","nodes":[
            {"key":"catalogue","parent":"","order":0,"scope":true,"enabled":true,"layout":2,"extent":100,"rowEntry":2},
            {"key":"row","parent":"catalogue","order":0,"scope":true,"enabled":true,"layout":1,"extent":100,"horizontalAlignment":"pinned"},$members]}"""
    }
    private fun layout() {
        check(root.collections.dataset == 1L) { "Combined remembered-entry and pinned-alignment catalogue rejected" }
        val width = 3 * extent
        fun exact(px: Int) = View.MeasureSpec.makeMeasureSpec(px, View.MeasureSpec.EXACTLY)
        root.layout(0, 0, width, 140); catalogue.layout(0, 0, width, 140); row.layout(0, 0, width, 100)
        scroll.measure(exact(width), exact(80)); scroll.layout(0, 0, width, 80)
        catalogue.commit(); row.commit(); cards.forEach { it.commitProps() }; root.refreshGeometry()
    }

    fun readerGeometry() {
        layout()
        scroll.scrollTo(2 * extent, 0)
        val previous = cards[1]
        check(root.targetGeometry.readerCanScrollTo(previous, root)) { "One native arrow can reveal the previous card" }
        check(!root.targetGeometry.readerCanScrollTo(cards.first(), root)) { "Distant cards cannot intercept an arrow" }
        previous.clipBounds = android.graphics.Rect(0, 0, 5, 10)
        check(!root.targetGeometry.readerCanScrollTo(previous, root)) { "Scrolling cannot repair a clipped card" }
    }

    fun run() {
        layout()
        check(cards.first().requestFocus())
        for (expected in listOf(1, 2, 2)) {
            val key = KeyEvent.KEYCODE_DPAD_RIGHT
            check(root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, key)))
            check(root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, key)))
            check(root.findFocus() === cards[expected] && scroll.scrollX == expected * extent) {
                "Before the next frame: expected cell $expected at $gutter, scroll=${scroll.scrollX}, focus=${(root.findFocus() as? TargetView)?.occurrenceKey}"
            }
            root.refreshGeometry()
        }
    }
}
