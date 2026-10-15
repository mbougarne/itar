@file:Suppress("DEPRECATION")
package com.itar.adapter

import android.test.ActivityInstrumentationTestCase2
import android.widget.Button
import com.itarprobe.MainActivity

class CallbackTest : ActivityInstrumentationTestCase2<MainActivity>(MainActivity::class.java) {
    fun testSynchronousCallbacks() = callbacks()
    private fun callbacks() {
        instrumentation.setInTouchMode(false)
        for (variant in listOf("normal", "redirect", "detach", "dispose", "overflow")) {
            val host = activity
            lateinit var root: SurfaceView
            lateinit var a: TargetView
            lateinit var b: TargetView
            lateinit var foreign: Button
            instrumentation.runOnMainSync {
                root = SurfaceView(host)
                a = TargetView(host).apply { occurrenceKey = "a"; contentDescription = "A" }
                b = TargetView(host).apply { occurrenceKey = "b"; contentDescription = "B" }
                foreign = Button(host).apply { text = "Native control" }
                root.addView(a); root.addView(b); root.addView(foreign)
                host.setContentView(root)
            }
            instrumentation.waitForIdleSync()
            var failure: Throwable? = null
            instrumentation.runOnMainSync {
                try {
                    root.layout(0, 0, 800, 600)
                    a.layout(0, 0, 200, 80); b.layout(250, 0, 450, 80); foreign.layout(0, 150, 200, 230)
                    CallbackChecks.run(root, a, b, foreign, variant)
                } catch (error: Throwable) { failure = error; root.close() }
            }
            failure?.let { throw it }
        }
    }
}
