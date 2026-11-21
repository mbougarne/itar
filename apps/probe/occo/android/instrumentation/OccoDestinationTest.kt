@file:Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
package com.itar.adapter

import android.accessibilityservice.AccessibilityServiceInfo
import android.app.Activity
import android.app.UiAutomation
import android.graphics.Rect
import android.os.Build
import android.os.SystemClock
import android.test.ActivityInstrumentationTestCase2
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityManager
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.Button
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import org.json.JSONObject

class OccoDestinationTest : ActivityInstrumentationTestCase2<Activity>(Activity::class.java) {
    private lateinit var surface: SurfaceView
    private lateinit var card: TargetView
    private lateinit var group: FrameLayout
    private lateinit var row: HorizontalScrollView
    private lateinit var button: Button

    private fun main(block: () -> Unit) {
        var failure: Throwable? = null
        instrumentation.runOnMainSync { try { block() } catch (caught: Throwable) { failure = caught } }
        failure?.let { throw it }
    }

    override fun setUp() {
        super.setUp()
        instrumentation.setInTouchMode(true)
        val host = activity
        main {
            surface = SurfaceView(host)
            card = TargetView(host).apply { occurrenceKey = "fixture-card"; actionLabel = "Card" }
            group = FrameLayout(host)
            row = HorizontalScrollView(host).apply {
                isFocusableInTouchMode = true
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
            }
            button = Button(host).apply { isFocusableInTouchMode = true; text = "Private fixture text" }
            group.addView(row, FrameLayout.LayoutParams(240, 64).apply { leftMargin = 11; topMargin = 7 })
            group.addView(button, FrameLayout.LayoutParams(96, 48).apply { leftMargin = 33; topMargin = 84 })
            surface.addView(card)
            surface.addView(group)
            host.setContentView(surface)
        }
        instrumentation.waitForIdleSync()
        main {
            card.layout(8, 8, 88, 56)
            group.measure(View.MeasureSpec.makeMeasureSpec(300, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(160, View.MeasureSpec.EXACTLY))
            group.layout(100, 30, 400, 190)
            card.commitProps()
            card.isFocusableInTouchMode = true
            check(surface.hasWindowFocus() && row.width == 240 && button.height == 48)
        }
    }

    override fun tearDown() {
        try { main { OccoCapture.freeze(); surface.close() } } finally { super.tearDown() }
    }

    private fun export(): List<JSONObject> {
        main { OccoCapture.freeze() }
        val json = OccoCapture.exportFile(activity).readText()
        check(!json.contains("Private fixture text"))
        val events = JSONObject(json).getJSONArray("events")
        return List(events.length(), events::getJSONObject)
    }

    private fun bounds(view: View): Rect {
        val node = view.createAccessibilityNodeInfo()
        return Rect().also { node.getBoundsInScreen(it); node.recycle() }
    }

    private fun assertDestinations(events: List<JSONObject>, channel: String, expected: List<Pair<String, Rect>>) {
        val actual = events.filter { it.optString("channel") == channel && it.has("nativeDestination") }.map { event ->
            assertEquals("observation", event.getString("kind"))
            assertEquals("callback: unmanaged", event.getString("detail"))
            check(!event.has("target") && !event.has("mount"))
            val native = event.getJSONObject("nativeDestination")
            val rect = native.getJSONObject("bounds")
            native.getString("role") to Rect(rect.getInt("left"), rect.getInt("top"), rect.getInt("right"), rect.getInt("bottom"))
        }
        assertEquals(expected, actual)
    }

    fun testInputLeavesCardForWholeRowAndButtonThenClears() {
        lateinit var rowBounds: Rect
        lateinit var buttonBounds: Rect
        main {
            check(button.requestFocus())
            OccoCapture.start(activity.window)
            check(card.requestFocus())
            check(row.requestFocus() && surface.findFocus() === row)
            rowBounds = bounds(row)
            check(card.requestFocus())
            check(button.requestFocus() && surface.findFocus() === button)
            buttonBounds = bounds(button)
            check(card.requestFocus())
            // TV normally picks a default target immediately. Close every return path in
            // this isolated window to exercise Android's real callback for no destination.
            val window = surface.rootView as ViewGroup
            val descendants = window.descendantFocusability
            val focusable = window.isFocusable
            try {
                window.descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
                window.isFocusable = false
                card.clearFocus()
                check(window.findFocus() == null) { "Android retained ${window.findFocus()?.javaClass?.name}" }
                OccoCapture.freeze()
            } finally {
                window.isFocusable = focusable
                window.descendantFocusability = descendants
            }
        }
        val events = export()
        assertDestinations(events, "input", listOf("horizontal scroll view" to rowBounds, "button" to buttonBounds))
        assertDestinations(events, "accessibility", emptyList())
        check(events.any { it.optString("detail") == "callback: managed" && it.optString("target") == "fixture-card" })
        check(events.any { it.optString("detail") == "callback: absent" && it.optString("channel") == "input" })
    }

    fun testAccessibilityCapturesFocusedDescendantAndLeavesUnverifiedForwardingEmpty() {
        // UiAutomation supplies the accessibility service so this fixture does not require a person to operate a reader.
        val automation = instrumentation.getUiAutomation(UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES)
        val info = automation.serviceInfo
        val originalFlags = info.flags
        try {
            info.flags = originalFlags or AccessibilityServiceInfo.FLAG_REQUEST_TOUCH_EXPLORATION_MODE
            automation.serviceInfo = info
            val manager = activity.getSystemService(AccessibilityManager::class.java)
            val deadline = SystemClock.uptimeMillis() + 4000
            while (!manager.isTouchExplorationEnabled && SystemClock.uptimeMillis() < deadline) SystemClock.sleep(20)
            check(manager.isTouchExplorationEnabled) { "Android did not enable touch exploration for UiAutomation" }
            lateinit var rowBounds: Rect
            lateinit var buttonBounds: Rect
            main {
                check(card.requestFocus())
                OccoCapture.start(activity.window)
                val unverified = AccessibilityEvent.obtain(AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUSED)
                surface.requestSendAccessibilityEvent(group, unverified)
                OccoCapture.mark()
                check(row.requestFocus() && surface.findFocus() === row)
                check(button.requestFocus() && surface.findFocus() === button)
                check(card.requestFocus())
                for (view in listOf(card, row, button)) {
                    check(view.performAccessibilityAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS, null))
                    check(view.isAccessibilityFocused && surface.findFocus() === card)
                }
                rowBounds = bounds(row)
                buttonBounds = bounds(button)
                check(button.performAccessibilityAction(AccessibilityNodeInfo.ACTION_CLEAR_ACCESSIBILITY_FOCUS, null))
            }
            val events = export()
            val unverified = events.takeWhile { it.optString("detail") != "incident" }
            check(unverified.any { it.optString("detail") == "forwarded accessibility focus acquired" })
            check(unverified.none { it.has("nativeDestination") })
            val destinations = listOf("horizontal scroll view" to rowBounds, "button" to buttonBounds)
            assertDestinations(events, "input", destinations)
            assertDestinations(events, "accessibility", destinations)
        } finally {
            info.flags = originalFlags
            automation.serviceInfo = info
            // A live UiAutomation service still owns accessibility even after clearing its
            // exploration flag. Release it before engine-owned tests run in this process.
            if (Build.VERSION.SDK_INT >= 31) {
                instrumentation.getUiAutomation(UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES or
                    UiAutomation.FLAG_DONT_USE_ACCESSIBILITY)
            }
        }
    }
}
