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

    fun testUpRevealsThePreviousRowAndItsClippedCard() = columnScenario()
    fun testMountedCollectionCardRevealsWithoutRenderWindow() = columnScenario(collection = true)
    fun testNewVisibleMountCompletesPendingCollectionReveal() = columnScenario(collection = true, mountAfterInput = true)
    fun testOuterScrollRecyclingCannotScrollTheReplacementCell() = columnScenario(collection = true, recycleOnScroll = true)

    private fun columnScenario(collection: Boolean = false, mountAfterInput: Boolean = false, recycleOnScroll: Boolean = false) {
        instrumentation.setInTouchMode(false)
        val host = activity
        lateinit var checks: MountedColumnRevealChecks
        var failure: Throwable? = null
        instrumentation.runOnMainSync {
            checks = MountedColumnRevealChecks(host, collection)
            host.setContentView(checks.root)
            if (collection) checks.publish()
        }
        try {
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync {
                try {
                    checks.start(mountAfterInput)
                    if (recycleOnScroll) checks.recycleOnNextScroll()
                } catch (error: Throwable) { failure = error }
            }
            failure?.let { throw it }
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync {
                try {
                    if (recycleOnScroll) checks.checkRecycled()
                    else {
                        checks.finish()
                        if (!collection) checks.reflowAtViewportEdge()
                    }
                } catch (error: Throwable) { failure = error }
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
