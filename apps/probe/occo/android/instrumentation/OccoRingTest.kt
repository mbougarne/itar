@file:Suppress("DEPRECATION")
package com.itar.occo

import android.test.InstrumentationTestCase
import com.itar.adapter.OccoCapture
import org.json.JSONObject

class OccoRingTest : InstrumentationTestCase() {
    fun testWrapKeepsNewestEventsAndFrozenRecordingIsStable() = ringScenario()

    private fun ringScenario() {
        instrumentation.runOnMainSync { OccoCapture.freeze(); OccoCapture.start(null) }
        val capacity = JSONObject(OccoCapture.snapshotJson()).getInt("capacity")
        instrumentation.runOnMainSync {
            repeat(capacity + 4) { OccoCapture.mark() }
            OccoCapture.freeze()
        }
        val frozen = OccoCapture.snapshotJson()
        val document = JSONObject(frozen)
        val events = document.getJSONArray("events")
        assertEquals(capacity, events.length())
        assertEquals(6, document.getInt("dropped")) // start, capacity + 4 marks, freeze
        var previousMs = -1L
        for (index in 0 until events.length()) {
            val event = events.getJSONObject(index)
            assertEquals(7L + index, event.getLong("seq"))
            assertTrue(event.getLong("ms") >= previousMs)
            previousMs = event.getLong("ms")
        }
        assertEquals("freeze", events.getJSONObject(events.length() - 1).getString("detail"))
        instrumentation.runOnMainSync { OccoCapture.mark(); OccoCapture.freeze() }
        assertEquals(frozen, OccoCapture.snapshotJson())
    }
}
