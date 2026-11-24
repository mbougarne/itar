@file:Suppress("DEPRECATION")
package com.itar.adapter

import android.test.ActivityInstrumentationTestCase2
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityEvent
import android.widget.Button
import android.widget.HorizontalScrollView
import android.app.Activity
import org.json.JSONObject
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class OccoTraceTest : ActivityInstrumentationTestCase2<Activity>(Activity::class.java) {
    private fun main(work: () -> Unit) {
        var failure: Throwable? = null
        instrumentation.runOnMainSync { try { work() } catch (error: Throwable) { failure = error } }
        failure?.let { throw it }
    }

    private fun awaitLayout(view: View) {
        val nextFrame = CountDownLatch(1)
        main { view.postOnAnimation { view.postOnAnimation { nextFrame.countDown() } } }
        check(nextFrame.await(3, TimeUnit.SECONDS)) { "No frame from fixture window" }
        instrumentation.waitForIdleSync()
    }

    private fun export(): List<JSONObject> {
        main { OccoCapture.freeze() }
        val json = OccoCapture.snapshotJson()
        assertEquals(json, OccoCapture.exportFile(activity).readText())
        val events = JSONObject(json).getJSONArray("events")
        return List(events.length(), events::getJSONObject)
    }

    fun testWindowInputManagedAndHostMovesKeepIndependentObservations() {
        instrumentation.setInTouchMode(false)
        val host = activity
        lateinit var root: SurfaceView
        lateinit var first: TargetView
        lateinit var second: TargetView
        lateinit var foreign: Button
        main {
            OccoCapture.start(host.window)
            root = SurfaceView(host)
            first = TargetView(host).apply { occurrenceKey = "first"; actionLabel = "First" }
            second = TargetView(host).apply { occurrenceKey = "second"; actionLabel = "Second" }
            foreign = Button(host)
            root.addView(first); root.addView(second); root.addView(foreign)
            host.setContentView(root)
        }
        try {
            instrumentation.waitForIdleSync()
            main {
                root.layout(0, 0, 800, 600)
                first.layout(10, 20, 100, 80); second.layout(120, 20, 220, 80)
                foreign.layout(250, 20, 340, 80)
                first.commitProps(); second.commitProps()
            }
            awaitLayout(root)
            main {
                check(first.requestFocus()) { "Initial target attached=${first.isAttachedToWindow} focusable=${first.isFocusable} window=${root.hasWindowFocus()} touch=${first.isInTouchMode}" }
                fun right() {
                    for (action in listOf(KeyEvent.ACTION_DOWN, KeyEvent.ACTION_UP)) {
                        host.window.callback.dispatchKeyEvent(KeyEvent(action, KeyEvent.KEYCODE_DPAD_RIGHT))
                    }
                }
                right()
                check(second.hasFocus())
                // A synthetic accessibility callback exercises the separate capture boundary.
                first.sendAccessibilityEvent(AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUSED)
                check(foreign.requestFocus())
                right()
            }
            val events = export()
            val input = events.first { it.optString("owner") == "engine" && it.optString("direction") == "right" }
            val move = input.getString("move")
            check(events.any { it.optString("detail") == "activity down" && it.optString("move") == move })
            val request = events.first { it.optString("kind") == "request" && it.optString("move") == move }.getString("request")
            check(events.any { it.optString("detail") == "focus accepted" && it.optString("request") == request && it.optString("target") == "second" })
            check(events.any { it.optString("channel") == "input" && it.optString("target") == "second" })
            check(events.any { it.optString("kind") == "callback" && it.optString("channel") == "accessibility" &&
                it.optString("target") == "first" && it.optString("detail") == "accessibility focus acquired" })
            val hostMove = events.first { it.optString("owner") == "host" }.getString("move")
            check(events.none { it.optString("kind") == "request" && it.optString("move") == hostMove })
        } finally { main { OccoCapture.freeze(); root.close() } }
    }

    fun testCancelledRevealThenLateHostFocusOnRecycledCard() {
        instrumentation.setInTouchMode(false)
        val host = activity
        lateinit var fixture: MountedRowRevealChecks
        main {
            OccoCapture.start(host.window)
            fixture = MountedRowRevealChecks(host, false, false)
            host.setContentView(fixture.root)
        }
        try {
            instrumentation.waitForIdleSync()
            lateinit var previous: TargetView
            main {
                fixture.start()
                fixture.cancel()
                fixture.recycle()
                // Simulate a host move arriving after cancellation, on a new mount of the same key.
                val row = fixture.root.getChildAt(0) as ViewGroup
                val scroll = row.getChildAt(0) as HorizontalScrollView
                val content = scroll.getChildAt(0) as ViewGroup
                previous = (0 until content.childCount).map(content::getChildAt)
                    .filterIsInstance<TargetView>().single { it.occurrenceKey == "previous" }
                scroll.scrollTo(0, 0)
                previous.commitProps()
            }
            awaitLayout(fixture.root)
            main {
                check(previous.requestFocus(View.FOCUS_FORWARD)) {
                    "Recycled target attached=${previous.isAttachedToWindow} focusable=${previous.isFocusable} width=${previous.width} window=${previous.hasWindowFocus()}"
                }
            }
            val events = export()
            val reveal = events.first { it.optString("detail") == "reveal accepted" }
            val cancel = events.first { it.optString("kind") == "request" &&
                it.optString("detail") == "cancelled" && it.optString("request") == reveal.getString("request") }
            val late = events.first { it.getLong("seq") > cancel.getLong("seq") &&
                it.optString("kind") == "observation" && it.optString("channel") == "input" && it.optString("target") == "previous" }
            check(late.getString("mount") != reveal.getString("mount") && !late.has("request"))
        } finally { main { OccoCapture.freeze(); fixture.root.close() } }
    }
}
