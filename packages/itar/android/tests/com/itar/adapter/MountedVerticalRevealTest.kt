@file:Suppress("DEPRECATION")
package com.itar.adapter

import android.test.ActivityInstrumentationTestCase2
import com.itarprobe.MainActivity

class MountedVerticalRevealTest : ActivityInstrumentationTestCase2<MainActivity>(MainActivity::class.java) {
    private fun scenario(nested: Boolean, mismatchedAxis: Boolean = false) {
        instrumentation.setInTouchMode(false)
        val host = activity
        lateinit var checks: MountedVerticalRevealChecks
        fun main(work: () -> Unit) {
            var failure: Throwable? = null
            instrumentation.runOnMainSync { try { work() } catch (error: Throwable) { failure = error } }
            failure?.let { throw it }
        }
        try {
            main { checks = MountedVerticalRevealChecks(host, nested, mismatchedAxis); host.setContentView(checks.root) }
            instrumentation.waitForIdleSync()
            main { checks.start(requestByKey = mismatchedAxis) }
            instrumentation.waitForIdleSync()
            main { checks.finish(moved = !mismatchedAxis) }
        } finally { main { checks.root.close() } }
    }

    fun testUpRevealsClippedTargetInStandaloneColumn() = scenario(nested = false)
    fun testLeftRevealsPreviousColumnAndItsClippedTarget() = scenario(nested = true)
    fun testScopeCannotScrollUnrelatedAxis() = scenario(nested = false, mismatchedAxis = true)
}
