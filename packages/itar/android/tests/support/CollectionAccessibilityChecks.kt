@file:Suppress("DEPRECATION")
package com.itar.adapter

import android.content.Context
import android.os.Bundle
import android.view.View
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.FrameLayout
import android.widget.ScrollView
import androidx.core.view.AccessibilityDelegateCompat
import androidx.core.view.ViewCompat
import androidx.core.view.accessibility.AccessibilityNodeProviderCompat
import com.facebook.react.R
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.ReactAccessibilityDelegate.AccessibilityRole
import com.facebook.react.views.scroll.ReactHorizontalScrollView
import com.facebook.react.views.scroll.ReactHorizontalScrollViewManager
import com.facebook.react.views.scroll.ReactScrollView

/** Real RN scroll hosts, delegate metadata and accepted native collection publication. */
class CollectionAccessibilityChecks(context: Context, react: ReactContext) {
    private val invalidations = ArrayList<View>()
    val root = object : SurfaceView(context) {
        override fun notifySubtreeAccessibilityStateChanged(child: View, source: View, type: Int) {
            check(invalidations.size < 128) { "Fixture invalidation bound exceeded" }
            invalidations.add(source)
            super.notifySubtreeAccessibilityStateChanged(child, source, type)
        }
    }
    private val outerScope = ScopeView(context).apply { scopeKey = "outer"; collectionDataset = "1"; layout = "column" }
    private val railScope = ScopeView(context).apply {
        scopeKey = "rail"; parentScopeKey = "outer"; collectionDataset = "1"; layout = "row"
    }
    val outer = ReactScrollView(react)
    val rail = ReactHorizontalScrollView(react)
    private val outerContent = FrameLayout(context)
    private val railContent = FrameLayout(context)
    private val cell = FrameLayout(context)
    private val target = TargetView(context).apply {
        occurrenceKey = "item"; scopeKey = "rail"; collectionDataset = "1"; actionLabel = "Item"
    }
    private val outerDelegate = checkNotNull(ViewCompat.getAccessibilityDelegate(outer))
    private val railDelegate = checkNotNull(ViewCompat.getAccessibilityDelegate(rail))
    init {
        // These fixture-owned views have no Fabric shadow/onScroll recipient. Suppress only
        // RN JS scroll callbacks for this bounded scenario; native accessibility events remain live.
        outer.scrollEventThrottle = 60_000; rail.scrollEventThrottle = 60_000
        outer.lastScrollDispatchTime = System.currentTimeMillis(); rail.lastScrollDispatchTime = System.currentTimeMillis()
        outer.setSendMomentumEvents(false); rail.setSendMomentumEvents(false)
        rail.setTag(R.id.accessibility_role, AccessibilityRole.LIST)
        rail.setTag(R.id.accessibility_collection, JavaOnlyMap.of("itemCount", 17, "rowCount", 1, "columnCount", 17, "hierarchical", false))
        cell.setTag(R.id.accessibility_collection_item, JavaOnlyMap.of("itemIndex", 7))
        rail.contentDescription = "Owned rail"
        cell.addView(target, FrameLayout.LayoutParams(100, 60))
        railContent.addView(cell, FrameLayout.LayoutParams(400, 80))
        rail.addView(railContent, FrameLayout.LayoutParams(900, 80))
        railScope.addView(rail)
        outerContent.addView(railScope, FrameLayout.LayoutParams(300, 80).apply { topMargin = 20 })
        outer.addView(outerContent, FrameLayout.LayoutParams(300, 700))
        outerScope.addView(outer); root.addView(outerScope)
    }
    fun publish() {
        root.collectionData = """{"dataset":"1","nodes":[
          {"key":"outer","parent":"","order":0,"scope":true,"enabled":true,"layout":2,"extent":300},
          {"key":"rail","parent":"outer","order":0,"scope":true,"enabled":true,"layout":1,"extent":400},
          {"key":"item","parent":"rail","order":0,"scope":false,"enabled":true,"layout":0,"extent":0}]}"""
    }
    private fun frame(view: View, width: Int, height: Int, top: Int = 0) {
        view.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY))
        view.layout(0, top, width, top + height)
    }
    fun prepare() {
        check(root.collections.dataset == 1L && !root.closed) { "Collection publication did not settle" }
        frame(root, 600, 800); frame(outerScope, 300, 240); frame(outer, 300, 240)
        frame(outerContent, 300, 700); frame(railScope, 300, 80, 20); frame(rail, 300, 80)
        frame(railContent, 900, 80); frame(cell, 400, 80); cell.offsetLeftAndRight(250); frame(target, 100, 60)
        target.commitProps(); refresh()
        check(target.mount != null && !root.closed)
        projected()
    }
    private fun refresh() { root.geometryChanged(); root.refreshGeometry() }
    private fun actions(view: View): Set<Int> = view.createAccessibilityNodeInfo().let {
        it.actionList.map { action -> action.id }.toSet().also { _ -> it.recycle() }
    }
    private fun projected() {
        for ((view, directional) in listOf(outer to AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_DOWN.id,
            rail to AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_RIGHT.id)) {
            val actions = actions(view)
            check(directional in actions && AccessibilityNodeInfo.ACTION_SCROLL_FORWARD !in actions) { "Missing axis projection: $actions" }
        }
    }
    fun semantics() {
        val node = rail.createAccessibilityNodeInfo()
        check(node.className == "android.widget.AbsListView" && node.contentDescription == "Owned rail")
        check(node.collectionInfo?.columnCount == 17 && node.collectionInfo?.rowCount == 1 && node.isScrollable)
        node.recycle()
        val event = AccessibilityEvent.obtain(AccessibilityEvent.TYPE_VIEW_SCROLLED)
        rail.onInitializeAccessibilityEvent(event)
        check(event.itemCount == 17 && event.fromIndex == 7 && event.toIndex == 7) { "RN collection event metadata lost: $event" }
        event.recycle()
        rail.setScrollEnabled(false)
        rail.createAccessibilityNodeInfo().let { check(!it.isScrollable); it.recycle() }
        rail.setScrollEnabled(true)
        rail.isEnabled = false
        check(AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_RIGHT.id !in actions(rail))
        check(!rail.performAccessibilityAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD, null))
        rail.isEnabled = true; projected()
    }
    fun rowInputFocus() {
        // Keep the fixture's real horizontal overflow, with a fully visible child.
        frame(cell, 400, 80); refresh()
        check(rail.isFocusable && outer.isFocusable) { "Labelled scroll hosts must retain their input policy" }
        rail.isFocusableInTouchMode = true
        rail.contentDescription = null
        check(rail.isFocusable && rail.canScrollHorizontally(1))
        refresh()
        check(!rail.isFocusable && outer.isFocusable && target.isFocusable && target.requestFocus())
        val node = rail.createAccessibilityNodeInfo()
        check(node.isScrollable && !node.isFocusable && node.collectionInfo?.columnCount == 17)
        node.recycle(); projected()
        rail.contentDescription = "Owned rail"; refresh()
        check(rail.isFocusable && rail.isFocusableInTouchMode) { "Relabelling must restore the original host state" }
        rail.contentDescription = null; rail.layoutDirection = View.LAYOUT_DIRECTION_RTL; refresh()
        check(!rail.isFocusable && ViewCompat.getAccessibilityDelegate(rail) === railDelegate)
        railScope.removeView(rail)
        check(rail.isFocusable && rail.isFocusableInTouchMode) { "A recycled row must recover its original policy" }
        railScope.addView(rail); frame(rail, 300, 80); refresh()
        check(!rail.isFocusable)
        ReactHorizontalScrollViewManager().setScrollEnabled(rail, false)
        root.collectionAccessibilityChanged()
        check(!rail.isFocusable) { "Cleanup must not undo a newer RN scrollEnabled=false" }
    }
    fun lifecycle() {
        // Query-time checks precede the deferred scope refresh.
        outerScope.active = false
        check(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD in actions(rail))
        outerScope.commit()
        check(ViewCompat.getAccessibilityDelegate(rail) === railDelegate)
        outerScope.active = true; outerScope.commit(); refresh(); projected()
        railScope.collectionDataset = "999"
        check(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD in actions(rail))
        railScope.commit(); refresh()
        check(ViewCompat.getAccessibilityDelegate(rail) === railDelegate)
        railScope.collectionDataset = "1"; railScope.commit(); refresh(); projected()
        rail.layoutDirection = View.LAYOUT_DIRECTION_RTL
        check(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD in actions(rail))
        refresh(); check(ViewCompat.getAccessibilityDelegate(rail) === railDelegate)
        rail.layoutDirection = View.LAYOUT_DIRECTION_LTR; refresh(); projected()

        val replacement = AccessibilityDelegateCompat()
        ViewCompat.setAccessibilityDelegate(outer, replacement)
        check(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD in actions(rail)) { "Inner rail outlived its outer delegate" }
        root.collectionAccessibilityChanged()
        check(ViewCompat.getAccessibilityDelegate(outer) === replacement) { "Cleanup overwrote a newer delegate" }
        refresh(); projected()
        railScope.removeView(rail)
        check(ViewCompat.getAccessibilityDelegate(rail) === railDelegate) { "Detached/recyclable host retained projection" }
        railScope.addView(rail); frame(rail, 300, 80); refresh(); projected()
        root.close()
        check(ViewCompat.getAccessibilityDelegate(rail) === railDelegate && ViewCompat.getAccessibilityDelegate(outer) === replacement)
    }
    fun unsupportedParent() {
        outerScope.removeView(outer); outer.removeView(outerContent)
        val unsupported = ScrollView(root.context).apply { addView(outerContent) }
        outerScope.addView(unsupported); frame(unsupported, 300, 240)
        frame(outerContent, 300, 700); frame(railScope, 300, 80, 20); frame(rail, 300, 80)
        target.commitProps(); refresh()
        check(ViewCompat.getAccessibilityDelegate(rail) === railDelegate &&
            AccessibilityNodeInfo.ACTION_SCROLL_FORWARD in actions(rail)) { "Unsupported parent allowed horizontal-only projection" }
        check(ViewCompat.getAccessibilityDelegate(outer) === outerDelegate)
    }
    fun changeNotificationMetadata() {
        check(outer in invalidations && rail in invalidations) { "Installed actions were not invalidated" }
        invalidations.clear()
        root.collectionAccessibilityChanged(); refresh()
        outerScope.active = false; outerScope.commit()
    }
    fun checkRestorationNotification() {
        check(ViewCompat.getAccessibilityDelegate(outer) === outerDelegate && ViewCompat.getAccessibilityDelegate(rail) === railDelegate)
        check(invalidations.count { it === outer } == 1 && invalidations.count { it === rail } == 1) {
            "Restored action metadata was not coalesced per host: $invalidations"
        }
    }
    fun customCallbacks() {
        var activations = 0
        val provider = object : AccessibilityNodeProviderCompat() {}
        val original = object : AccessibilityDelegateCompat() {
            override fun getAccessibilityNodeProvider(host: View) = provider
            override fun performAccessibilityAction(host: View, action: Int, args: Bundle?): Boolean {
                if (action != 12345) return false
                check(args?.getString("value") == "retained"); activations++; return true
            }
        }
        fun exercise(delegate: AccessibilityDelegateCompat) {
            val before = activations
            check(delegate.getAccessibilityNodeProvider(rail) === provider)
            check(delegate.performAccessibilityAction(rail, 12345, Bundle().apply { putString("value", "retained") }))
            check(!delegate.performAccessibilityAction(rail, 54321, null))
            check(activations == before + 1) { "Custom action was duplicated" }
        }
        ViewCompat.setAccessibilityDelegate(rail, original)
        exercise(original); refresh()
        val installed = checkNotNull(ViewCompat.getAccessibilityDelegate(rail))
        check(installed !== original)
        exercise(installed)
    }
}
