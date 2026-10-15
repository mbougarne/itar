@file:Suppress("DEPRECATION")
package com.itar.adapter

import android.test.ActivityInstrumentationTestCase2
import android.view.View
import com.itarprobe.MainActivity

class RegistrationTest : ActivityInstrumentationTestCase2<MainActivity>(MainActivity::class.java) {
    fun testMountGeometryReuseAndUnmanagedFocus() = mountGeometryReuseAndUnmanagedFocus()
    private fun mountGeometryReuseAndUnmanagedFocus() {
        instrumentation.setInTouchMode(false)
        val host = activity
        lateinit var root: SurfaceView
        lateinit var target: TargetView
        instrumentation.runOnMainSync {
            root = SurfaceView(host)
            target = TargetView(host).apply { occurrenceKey = "rail/movie"; text = "Movie"; contentDescription = "Movie" }
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
