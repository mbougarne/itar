@file:Suppress("DEPRECATION")
package com.itar.adapter

import android.test.ActivityInstrumentationTestCase2
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.TextView
import com.itarprobe.MainActivity

class CallbackTest : ActivityInstrumentationTestCase2<MainActivity>(MainActivity::class.java) {
    fun testSynchronousCallbacks() = callbacks()
    private fun callbacks() {
        instrumentation.setInTouchMode(false)
        for (variant in listOf("normal", "redirect", "detach", "dispose", "overflow", "style", "activation", "query")) {
            val host = activity
            lateinit var root: SurfaceView
            lateinit var a: TargetView
            lateinit var b: TargetView
            lateinit var foreign: TextView
            var nativeContainer: FrameLayout? = null
            instrumentation.runOnMainSync {
                root = SurfaceView(host)
                a = TargetView(host).apply { occurrenceKey = "a"; contentDescription = "A" }
                b = TargetView(host).apply { occurrenceKey = "b"; contentDescription = "B" }
                foreign = (if (variant == "query") EditText(host) else Button(host)).apply { text = "Native control" }
                root.addView(a); root.addView(b)
                if (variant == "query") {
                    nativeContainer = FrameLayout(host).also { it.addView(foreign); root.addView(it) }
                } else root.addView(foreign)
                host.setContentView(root)
            }
            instrumentation.waitForIdleSync()
            var failure: Throwable? = null
            instrumentation.runOnMainSync {
                try {
                    root.layout(0, 0, 800, 600)
                    a.layout(0, 0, 200, 80); b.layout(250, 0, 450, 80)
                    nativeContainer?.let { it.layout(0, 150, 200, 230); foreign.layout(0, 0, 200, 80) }
                        ?: foreign.layout(0, 150, 200, 230)
                    if (variant == "query") QueryChecks.run(root, a, b, foreign)
                    else if (variant == "activation") ActivationChecks.run(root, a, b)
                    else if (variant == "style") StyleChecks.run(root, a, b)
                    else CallbackChecks.run(root, a, b, foreign, variant)
                } catch (error: Throwable) { failure = error; root.close() }
            }
            failure?.let { throw it }
        }
    }
}
