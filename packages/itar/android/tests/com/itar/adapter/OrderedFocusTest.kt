@file:Suppress("DEPRECATION")
package com.itar.adapter

import android.test.ActivityInstrumentationTestCase2
import com.itarprobe.MainActivity

class OrderedFocusTest : ActivityInstrumentationTestCase2<MainActivity>(MainActivity::class.java) {
    private fun scenario(checks: (OrderedFocusChecks.Fixture) -> Unit) {
        instrumentation.setInTouchMode(false)
        val host = activity
        lateinit var fixture: OrderedFocusChecks.Fixture
        instrumentation.runOnMainSync {
            fixture = OrderedFocusChecks.create(host)
            host.setContentView(fixture.root)
        }
        instrumentation.waitForIdleSync()
        var failure: Throwable? = null
        instrumentation.runOnMainSync {
            try { OrderedFocusChecks.prepare(fixture); checks(fixture) }
            catch (error: Throwable) { failure = error }
            finally { fixture.root.close() }
        }
        failure?.let { throw it }
    }
    fun testNativeColumnQueriesPreserveOwnership() = scenario(OrderedFocusChecks::queries)
    fun testColumnLinksRejectStaleHostBindings() = scenario(OrderedFocusChecks::lifecycle)
    fun testUnsupportedColumnsHaveNoNativeLinks() = scenario(OrderedFocusChecks::unsupported)
}
