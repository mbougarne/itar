@file:Suppress("DEPRECATION")
package com.itar.adapter

import android.test.ActivityInstrumentationTestCase2
import com.itarprobe.MainActivity

class MountedRowRevealTest : ActivityInstrumentationTestCase2<MainActivity>(MainActivity::class.java) {
    private fun scenario(moved: Boolean, tooWide: Boolean = false, programmaticOnly: Boolean = false, interrupt: (MountedRowRevealChecks) -> Unit = {}) {
        instrumentation.setInTouchMode(false)
        val host = activity
        lateinit var checks: MountedRowRevealChecks
        fun main(work: () -> Unit) {
            var failure: Throwable? = null
            instrumentation.runOnMainSync { try { work() } catch (error: Throwable) { failure = error } }
            failure?.let { throw it }
        }
        main { checks = MountedRowRevealChecks(host, tooWide, programmaticOnly); host.setContentView(checks.root) }
        try {
            instrumentation.waitForIdleSync()
            main { checks.start(); interrupt(checks) }
            instrumentation.waitForIdleSync()
            main { checks.checkResult(moved) }
        } finally { main { checks.root.close() } }
    }

    fun testUpRevealsThePreviousRowAndItsClippedCard() {
        instrumentation.setInTouchMode(false)
        val host = activity
        lateinit var checks: MountedColumnRevealChecks
        var failure: Throwable? = null
        instrumentation.runOnMainSync { checks = MountedColumnRevealChecks(host); host.setContentView(checks.root) }
        try {
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync { try { checks.start() } catch (error: Throwable) { failure = error } }
            failure?.let { throw it }
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync {
                try { checks.finish(); checks.reflowAtViewportEdge() } catch (error: Throwable) { failure = error }
            }
            failure?.let { throw it }
        } finally { instrumentation.runOnMainSync { checks.root.close() } }
    }

    fun testLeftRevealsAndFocusesTheSameMountedCard() = scenario(true)
    fun testProgrammaticOnlyRailRevealsThePreviousCard() = scenario(true, programmaticOnly = true)
    fun testCancellationBeforeScrollLeavesSourceInPlace() = scenario(false, interrupt = { it.cancel() })
    fun testRecycledDestinationCannotScrollTheRail() = scenario(false, interrupt = { it.recycle() })
    fun testCardWiderThanViewportDoesNotScroll() = scenario(false, tooWide = true)
}
