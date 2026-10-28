@file:Suppress("DEPRECATION")
package com.itar.adapter

import android.os.SystemClock
import android.test.ActivityInstrumentationTestCase2
import com.itarprobe.MainActivity

class PublicationTest : ActivityInstrumentationTestCase2<MainActivity>(MainActivity::class.java) {
    private fun awaitDataset(f: PublicationChecks.Fixture, value: Long) {
        val deadline = SystemClock.uptimeMillis() + 5000
        while (SystemClock.uptimeMillis() < deadline) {
            var ready = false
            instrumentation.runOnMainSync { ready = PublicationChecks.dataset(f) == value }
            if (ready) return
            SystemClock.sleep(20)
        }
        fail("Dataset did not commit: $value")
    }
    fun testAppendRetainsExactHostBindingAndRejectsStaleReplacement() {
        instrumentation.setInTouchMode(false)
        val host = activity
        lateinit var f: PublicationChecks.Fixture
        instrumentation.runOnMainSync {
            f = PublicationChecks.create(host)
            host.setContentView(f.root)
            PublicationChecks.begin(f)
        }
        try {
            awaitDataset(f, 1)
            instrumentation.runOnMainSync { PublicationChecks.mount(f) }
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync { PublicationChecks.focus(f); PublicationChecks.append(f) }
            awaitDataset(f, 2)
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync { PublicationChecks.retainedBeforeReactCommit(f); PublicationChecks.rejectUndeclaredChild(f); PublicationChecks.commit(f) }
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync { PublicationChecks.recycle(f) }
        } finally { instrumentation.runOnMainSync { PublicationChecks.close(f) } }
    }
    fun testChangedOrDeletedDeclarationsCannotRetainAuthority() {
        instrumentation.setInTouchMode(false)
        val host = activity
        for (kind in listOf("item", "ancestor", "delete")) {
            lateinit var f: PublicationChecks.Fixture
            instrumentation.runOnMainSync {
                f = PublicationChecks.create(host); host.setContentView(f.root); PublicationChecks.begin(f)
            }
            try {
                awaitDataset(f, 1)
                instrumentation.runOnMainSync { PublicationChecks.mount(f) }
                instrumentation.waitForIdleSync()
                instrumentation.runOnMainSync { PublicationChecks.focus(f); PublicationChecks.invalidate(f, kind) }
                awaitDataset(f, 2)
                instrumentation.waitForIdleSync()
                instrumentation.runOnMainSync { PublicationChecks.invalidated(f) }
            } finally { instrumentation.runOnMainSync { PublicationChecks.close(f) } }
        }
    }
}
