package com.itar.adapter

import android.content.Context

/** Actual host focus must survive a policy-only publication before React acknowledges it. */
class RowEntryHostChecks(context: Context) {
    val root = SurfaceView(context)
    private val outer = ScopeView(context).apply { scopeKey = "outer"; collectionDataset = "1"; layout = "column" }
    private val row = ScopeView(context).apply {
        scopeKey = "row"; parentScopeKey = "outer"; collectionDataset = "1"; layout = "row"
    }
    private val target = TargetView(context).apply {
        occurrenceKey = "item"; scopeKey = "row"; collectionDataset = "1"; actionLabel = "Item"
    }
    private var mounted: Mount? = null
    init { row.addView(target); outer.addView(row); root.addView(outer) }
    fun publish(dataset: Int) {
        root.collectionData = """{"dataset":"$dataset","nodes":[
            {"key":"outer","parent":"","order":0,"scope":true,"enabled":true,"layout":2,"extent":200,"rowEntry":${dataset - 1}},
            {"key":"row","parent":"outer","order":0,"scope":true,"enabled":true,"layout":1,"extent":100},
            {"key":"item","parent":"row","order":0,"scope":false,"enabled":true,"layout":0,"extent":0}]}"""
    }
    fun focus() {
        check(root.collections.dataset == 1L)
        root.layout(0, 0, 800, 600); outer.layout(0, 0, 600, 400)
        row.layout(0, 0, 600, 200); target.layout(0, 0, 100, 80)
        target.commitProps(); root.refreshGeometry()
        check(target.requestFocus()); root.observe()
        mounted = checkNotNull(target.mount)
        check(root.live(mounted) === target)
    }
    fun horizontal() {
        row.removeView(target)
        val scroll = android.widget.HorizontalScrollView(root.context)
        val content = android.widget.FrameLayout(root.context)
        scroll.addView(content, android.widget.FrameLayout.LayoutParams(1000, 100))
        content.addView(target, android.widget.FrameLayout.LayoutParams(100, 80).apply { leftMargin = 300 })
        row.addView(scroll)
        root.layout(0, 0, 800, 600); outer.layout(0, 0, 600, 400); row.layout(0, 0, 600, 200)
        scroll.measure(android.view.View.MeasureSpec.makeMeasureSpec(300, android.view.View.MeasureSpec.EXACTLY), android.view.View.MeasureSpec.makeMeasureSpec(100, android.view.View.MeasureSpec.EXACTLY))
        scroll.layout(0, 0, 300, 100); content.layout(0, 0, 1000, 100); target.layout(300, 0, 400, 80)
        target.commitProps(); root.refreshGeometry(); check(target.requestFocus()); root.observe()
        scroll.scrollTo(0, 0)
        root.collectionData = root.collectionData.replace("\"dataset\":\"1\"", "\"dataset\":\"2\"")
            .replace("\"extent\":100", "\"extent\":100,\"horizontalAlignment\":\"leading\"")
    }
    fun align(rtl: Boolean) {
        (target.parent.parent as android.widget.HorizontalScrollView).layoutDirection =
            if (rtl) android.view.View.LAYOUT_DIRECTION_RTL else android.view.View.LAYOUT_DIRECTION_LTR
        root.collections.focused(target)
    }
    fun aligned(expected: Int) {
        val scroll = target.parent.parent as android.widget.HorizontalScrollView
        check(target.hasFocus() && scroll.scrollX == expected) { "Leading alignment lost focus or offset: ${scroll.scrollX}" }
    }
    fun retained() {
        check(root.collections.dataset == 2L && !root.closed)
        check(root.findFocus() === target && target.mount == mounted && root.live(mounted) === target) {
            "Policy-only publication revoked the focused host before React accepted its dataset"
        }
        outer.collectionDataset = "2"; row.collectionDataset = "2"; target.collectionDataset = "2"
        outer.commit(); row.commit(); target.commitProps(); root.refreshGeometry()
        check(root.findFocus() === target && target.mount == mounted && root.live(mounted) === target)
    }
}
