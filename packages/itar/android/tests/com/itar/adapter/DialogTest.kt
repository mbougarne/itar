@file:Suppress("DEPRECATION")
package com.itar.adapter

import android.test.ActivityInstrumentationTestCase2
import com.itarprobe.MainActivity

class DialogTest : ActivityInstrumentationTestCase2<MainActivity>(MainActivity::class.java) {
    fun testSeparateWindowsAndDisposal() = dialogs()
    private fun dialogs() {
        instrumentation.setInTouchMode(false)
        val host = activity
        lateinit var root: SurfaceView
        lateinit var target: TargetView
        instrumentation.runOnMainSync {
            root = SurfaceView(host)
            target = TargetView(host).apply { occurrenceKey = "opener"; contentDescription = "Opener" }
            root.addView(target); host.setContentView(root)
        }
        instrumentation.waitForIdleSync()
        runUi { root.layout(0, 0, 800, 600); target.layout(0, 0, 200, 80); DialogChecks.open(root, target) }
        awaitDialogWindowFocus(root)
        runUi { DialogChecks.nest(root) }
        instrumentation.waitForIdleSync()
        runUi { DialogChecks.dispose(root) }
    }
    private fun awaitDialogWindowFocus(root: SurfaceView) {
        // An idle UI queue does not mean WindowManager has focused the new window.
        val deadline = android.os.SystemClock.uptimeMillis() + 3000
        var waiting = false
        do {
            var focused = false
            runUi { focused = DialogChecks.hasWindowFocus(root) }
            if (focused) return
            if (!waiting) android.util.Log.i("ItarDialogTest", "Waiting for dialog window focus before nesting")
            waiting = true
            android.os.SystemClock.sleep(16)
        } while (android.os.SystemClock.uptimeMillis() < deadline)
        error("Dialog window did not receive focus before nested presentation")
    }
    private fun runUi(work: () -> Unit) {
        var failure: Throwable? = null
        instrumentation.runOnMainSync { try { work() } catch (error: Throwable) { failure = error } }
        failure?.let { throw it }
    }
}
