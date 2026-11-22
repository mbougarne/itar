@file:Suppress("DEPRECATION")
package com.itar.adapter

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.os.Bundle
import android.os.SystemClock
import android.test.ActivityInstrumentationTestCase2
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityManager
import com.itarprobe.MainActivity
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Run each arm explicitly; drive emulator hardware events externally after its READY marker. */
class ReaderRevealTest : ActivityInstrumentationTestCase2<MainActivity>(MainActivity::class.java) {
    fun testPlainObservation() = observe(false)
    fun testManagedObservation() = observe(true)
    fun testNestedBaselineObservation() = observe(false, false)
    fun testNestedDirectionalObservation() = observe(false, true)
    fun testNestedDirectionalBothObservation() = observe(false, true, outerDirectional = true)
    fun testNestedNativeAliasHandlers() = observe(false, true, true)
    fun testScrollRetainsPartiallyVisibleInputFocus() {
        val host = readerHost()
        lateinit var fixture: RowEntryHostChecks
        main {
            fixture = RowEntryHostChecks(host)
            host.setContentView(fixture.root)
            fixture.publish(1)
        }
        try {
            instrumentation.waitForIdleSync()
            main { fixture.readerScroll() }
        } finally { main { fixture.root.close() } }
    }
    private fun main(block: () -> Unit) {
        var failure: Throwable? = null
        instrumentation.runOnMainSync { try { block() } catch (error: Throwable) { failure = error } }
        failure?.let { throw it }
    }
    private fun awaitReady(fixture: ReaderRevealChecks, condition: () -> String? = fixture::readiness) {
        val ready = CountDownLatch(1)
        val frame = object : Runnable {
            override fun run() {
                if (condition() == null) ready.countDown()
                else fixture.root.postOnAnimation(this)
            }
        }
        main { fixture.root.postOnAnimation(frame) }
        try {
            if (!ready.await(8, TimeUnit.SECONDS)) {
                var detail = ""
                main { detail = condition() ?: "ready after deadline"; fixture.snapshot("WAIT FAILED: $detail") }
                error("Fixture readiness timed out: $detail")
            }
        } finally { main { fixture.root.removeCallbacks(frame) } }
    }
    private fun readerHost(): MainActivity {
        instrumentation.setInTouchMode(false)
        val host = activity
        val reader = host.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
        check(reader.isEnabled && reader.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
            .any { it.id.contains("talkback", ignoreCase = true) }) { "Run ReaderRevealTest with TalkBack enabled" }
        return host
    }
    private fun observe(managed: Boolean, directionalOnly: Boolean? = null, nativeAliases: Boolean = false,
        outerDirectional: Boolean = false) {
        val host = readerHost()
        lateinit var fixture: ReaderRevealChecks
        lateinit var container: ViewGroup
        var previous = emptyList<Pair<View, ViewGroup.LayoutParams>>()
        main {
            container = host.findViewById(android.R.id.content)
            previous = (0 until container.childCount).map { container.getChildAt(it).let { view -> view to view.layoutParams } }
            fixture = ReaderRevealChecks(host, managed, directionalOnly, outerDirectional)
            host.setContentView(fixture.root)
        }
        try {
            awaitReady(fixture)
            main { fixture.prepare() }
            if (nativeAliases) {
                for (forward in listOf(true, false)) {
                    main { fixture.nativeAliasAction(forward) }
                    awaitReady(fixture) { fixture.nativeAliasReadiness(forward) }
                }
                main { fixture.finish("AFTER native alias handlers verified; not TalkBack logical traversal") }
                return
            }
            instrumentation.sendStatus(0, Bundle().apply { putString("stream", "\nREADY ${fixture.arm}; 30s external hardware observation\n") })
            val deadline = SystemClock.uptimeMillis() + 30_000
            while (SystemClock.uptimeMillis() < deadline) {
                SystemClock.sleep(200) // Instrumentation thread only; the UI and reader remain live.
                main { fixture.snapshot("poll") }
            }
            main { fixture.finish() }
        } finally {
            main {
                fixture.close(); container.removeAllViews()
                previous.forEach { (view, params) -> container.addView(view, params) }
            }
        }
    }
}
