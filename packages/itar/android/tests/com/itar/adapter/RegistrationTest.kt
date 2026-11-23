@file:Suppress("DEPRECATION")
package com.itar.adapter

import android.test.ActivityInstrumentationTestCase2
import android.view.View
import com.itarprobe.MainActivity

class RegistrationTest : ActivityInstrumentationTestCase2<MainActivity>(MainActivity::class.java) {
    fun testAncestorMovementAndTranslatedGeometry() = geometry { run() }
    fun testRepeatedScrollInvalidationIncludesLateMount() = geometry { repeatedScrollInvalidation() }
    private fun geometry(check: GeometryChecks.() -> Unit) {
        instrumentation.setInTouchMode(false)
        val host = activity
        lateinit var fixture: GeometryChecks
        instrumentation.runOnMainSync { fixture = GeometryChecks(host); host.setContentView(fixture.root) }
        instrumentation.waitForIdleSync()
        var failure: Throwable? = null
        instrumentation.runOnMainSync {
            try { fixture.check() } catch (error: Throwable) { failure = error }
            finally { fixture.root.close() }
        }
        failure?.let { throw it }
    }
    fun testPinnedShortRowKeepsLastCardAtSameSlotBeforeTheNextFrame() = pinned { run() }
    fun testReaderCanReachOnlyNearbyScrollableCards() = pinned { readerGeometry() }
    private fun pinned(check: PinnedRowChecks.() -> Unit) {
        instrumentation.setInTouchMode(false)
        val host = activity
        lateinit var fixture: PinnedRowChecks
        instrumentation.runOnMainSync { fixture = PinnedRowChecks(host); host.setContentView(fixture.root); fixture.publish() }
        instrumentation.waitForIdleSync()
        var failure: Throwable? = null
        instrumentation.runOnMainSync {
            try { fixture.check() } catch (error: Throwable) { failure = error }
            finally { fixture.root.close() }
        }
        failure?.let { throw it }
    }
    fun testHorizontalAlignment() {
        instrumentation.setInTouchMode(false)
        val host = activity
        lateinit var fixture: RowEntryHostChecks
        fun main(block: () -> Unit) {
            var failure: Throwable? = null
            instrumentation.runOnMainSync { try { block() } catch (error: Throwable) { failure = error } }
            failure?.let { throw it }
        }
        main { fixture = RowEntryHostChecks(host); host.setContentView(fixture.root); fixture.publish(1) }
        try {
            instrumentation.waitForIdleSync(); main { fixture.horizontal() }
            for (rtl in listOf(false, true)) {
                val frame = java.util.concurrent.CountDownLatch(1)
                instrumentation.waitForIdleSync()
                main { fixture.align(rtl); fixture.root.postOnAnimation { frame.countDown() } }
                check(frame.await(3, java.util.concurrent.TimeUnit.SECONDS))
                instrumentation.waitForIdleSync(); main { fixture.aligned(if (rtl) 100 else 300) }
            }
        } finally { main { fixture.root.close() } }
    }
    fun testPolicyPublicationRetainsFocusedHost() = policyPublicationRetainsFocusedHost()
    private fun policyPublicationRetainsFocusedHost() {
        instrumentation.setInTouchMode(false)
        val host = activity
        lateinit var fixture: RowEntryHostChecks
        fun main(block: () -> Unit) {
            var failure: Throwable? = null
            instrumentation.runOnMainSync { try { block() } catch (error: Throwable) { failure = error } }
            failure?.let { throw it }
        }
        main { fixture = RowEntryHostChecks(host); host.setContentView(fixture.root); fixture.publish(1) }
        try {
            instrumentation.waitForIdleSync()
            main { fixture.focus(); fixture.publish(2) }
            instrumentation.waitForIdleSync()
            main { fixture.retained() }
        } finally { main { fixture.root.close() } }
    }
    fun testMountGeometryReuseAndUnmanagedFocus() = mountGeometryReuseAndUnmanagedFocus()
    private fun mountGeometryReuseAndUnmanagedFocus() {
        instrumentation.setInTouchMode(false)
        val host = activity
        lateinit var root: SurfaceView
        lateinit var target: TargetView
        instrumentation.runOnMainSync {
            root = SurfaceView(host)
            target = TargetView(host).apply { occurrenceKey = "rail/movie"; actionLabel = "Movie" }
            root.addView(target)
            host.setContentView(root)
        }
        instrumentation.waitForIdleSync()
        var failure: Throwable? = null
        instrumentation.runOnMainSync {
            try { RegistrationChecks.run(root, target) } catch (error: Throwable) { failure = error }
        }
        failure?.let { throw it }
    }
}
