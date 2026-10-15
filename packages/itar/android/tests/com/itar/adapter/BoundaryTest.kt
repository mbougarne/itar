@file:Suppress("DEPRECATION")
package com.itar.adapter

import android.test.InstrumentationTestCase

class BoundaryTest : InstrumentationTestCase() {
    fun testLifetimeAndConversions() {
        instrumentation.runOnMainSync {
            repeat(32) {
                val first = Connection()
                assertEquals(0L, first.exchange(0)[0])
                assertEquals(-2L, first.exchange(0, LongArray(33))[0])
                assertEquals(-2L, first.exchange(999)[0])
                assertEquals(-2L, first.exchange(0, key = "unexpected")[0])
                first.close()
                val replacement = Connection()
                first.close()
                assertEquals(-1L, first.exchange(0)[0])
                assertEquals(0L, replacement.exchange(0)[0])
                replacement.close()
            }
        }
    }
    fun testWrongThread() {
        try { Connection(); fail("non-owner accepted") } catch (_: IllegalStateException) { }
    }
}
