@file:Suppress("DEPRECATION")
package com.itar.adapter

import android.test.ActivityInstrumentationTestCase2
import com.itarprobe.MainActivity

class ControlSemanticsTest : ActivityInstrumentationTestCase2<MainActivity>(MainActivity::class.java) {
    fun testCheckedStateResetAndSingleSemanticActivation() {
        instrumentation.setInTouchMode(false)
        val host = activity
        lateinit var root: SurfaceView
        lateinit var target: TargetView
        lateinit var source: TargetView
        instrumentation.runOnMainSync {
            root = SurfaceView(host)
            target = TargetView(host).apply { occurrenceKey = "toggle"; actionLabel = "White focus accent" }
            source = TargetView(host).apply { occurrenceKey = "source"; actionLabel = "Input source" }
            root.addView(target); root.addView(source); host.setContentView(root)
        }
        instrumentation.waitForIdleSync()
        var failure: Throwable? = null
        instrumentation.runOnMainSync {
            try {
                root.layout(0, 0, 800, 600)
                target.layout(0, 0, 300, 80); source.layout(0, 100, 300, 180)
                ControlSemanticsChecks.run(root, target, source)
            } catch (error: Throwable) { failure = error }
            finally { root.close() }
        }
        failure?.let { throw it }
    }
}
