@file:Suppress("DEPRECATION")
package com.itar.adapter

import android.test.ActivityInstrumentationTestCase2
import android.widget.Button
import com.itarprobe.MainActivity

class ScopeTest : ActivityInstrumentationTestCase2<MainActivity>(MainActivity::class.java) {
    fun testScopeRerenderActivityHistoryAndDisposal() {
        instrumentation.setInTouchMode(false)
        val host = activity
        lateinit var root: SurfaceView
        lateinit var scope: ScopeView
        lateinit var a: TargetView
        lateinit var b: TargetView
        lateinit var foreign: Button
        instrumentation.runOnMainSync {
            root = SurfaceView(host)
            scope = ScopeView(host).apply { scopeKey = "rail"; layout = "row" }
            a = TargetView(host).apply { occurrenceKey = "a"; scopeKey = "rail"; contentDescription = "A" }
            b = TargetView(host).apply { occurrenceKey = "b"; scopeKey = "rail"; contentDescription = "B"; order = 1 }
            foreign = Button(host).apply { text = "Native control" }
            scope.addView(a); scope.addView(b)
            root.addView(scope); root.addView(foreign)
            host.setContentView(root)
        }
        instrumentation.waitForIdleSync()
        var failure: Throwable? = null
        instrumentation.runOnMainSync {
            try {
                root.layout(0, 0, 800, 600)
                scope.layout(0, 0, 800, 100)
                a.layout(0, 0, 200, 80); b.layout(250, 0, 450, 80)
                foreign.layout(0, 150, 200, 230)
                ScopeChecks.run(root, scope, a, b, foreign)
            } catch (error: Throwable) { failure = error; root.close() }
        }
        failure?.let { throw it }
    }
}
