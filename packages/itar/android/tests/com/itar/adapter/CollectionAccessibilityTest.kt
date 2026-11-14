@file:Suppress("DEPRECATION")
package com.itar.adapter

import android.os.SystemClock
import android.test.ActivityInstrumentationTestCase2
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityNodeInfo
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ThemedReactContext
import com.itarprobe.MainActivity

class CollectionAccessibilityTest : ActivityInstrumentationTestCase2<MainActivity>(MainActivity::class.java) {
    private fun main(block: () -> Unit) {
        var failure: Throwable? = null
        instrumentation.runOnMainSync { try { block() } catch (error: Throwable) { failure = error } }
        failure?.let { throw it }
    }
    private fun scenario(checks: (CollectionAccessibilityChecks) -> Unit) {
        val host = activity
        var react: ReactApplicationContext? = null
        val deadline = SystemClock.uptimeMillis() + 8000
        while (react == null && SystemClock.uptimeMillis() < deadline) {
            main { react = (host.application as ReactApplication).reactHost?.currentReactContext as? ReactApplicationContext }
            if (react == null) SystemClock.sleep(16)
        }
        val context = checkNotNull(react) { "RN context was not ready" }
        lateinit var fixture: CollectionAccessibilityChecks
        lateinit var container: ViewGroup
        var previous = emptyList<Pair<View, ViewGroup.LayoutParams>>()
        main {
            container = host.findViewById(android.R.id.content)
            previous = (0 until container.childCount).map { container.getChildAt(it).let { view -> view to view.layoutParams } }
            fixture = CollectionAccessibilityChecks(host, ThemedReactContext(context, host))
            host.setContentView(fixture.root); fixture.publish()
        }
        try {
            instrumentation.waitForIdleSync()
            main { fixture.prepare() }
            checks(fixture)
        } finally {
            main { fixture.root.close(); container.removeAllViews(); previous.forEach { (view, params) -> container.addView(view, params) } }
        }
    }
    fun testRnMetadataAndDisabledActions() = scenario { main { it.semantics() } }
    fun testDelegateOwnershipAndRecycling() = scenario { main { it.lifecycle() } }
    fun testUnsupportedOuterHostLeavesRailUntouched() = scenario { main { it.unsupportedParent() } }
    fun testCustomProviderAndActionArePreserved() = scenario { main { it.customCallbacks() } }
    fun testActionMetadataInvalidatesAccessibilityCache() = scenario {
        instrumentation.waitForIdleSync()
        main { it.changeNotificationMetadata() }
        instrumentation.waitForIdleSync()
        main { it.checkRestorationNotification() }
    }
    fun testNativeAliasHandlersRemainAvailable() = scenario { fixture ->
        for (host in listOf(fixture.rail, fixture.outer)) for (forward in listOf(true, false)) {
            main {
                check(host.performAccessibilityAction(if (forward) AccessibilityNodeInfo.ACTION_SCROLL_FORWARD
                    else AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD, null))
            }
            val deadline = SystemClock.uptimeMillis() + 5000
            var reached = false
            while (!reached && SystemClock.uptimeMillis() < deadline) {
                main { reached = if (forward) host.scrollX + host.scrollY > 0 else host.scrollX + host.scrollY == 0 }
                if (!reached) SystemClock.sleep(16)
            }
            check(reached) { "Original native alias handler did not scroll" }
        }
    }
}
