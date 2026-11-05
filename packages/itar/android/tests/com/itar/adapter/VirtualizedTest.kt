@file:Suppress("DEPRECATION")
package com.itar.adapter

import android.os.SystemClock
import android.test.ActivityInstrumentationTestCase2
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import com.itarprobe.MainActivity

/** Uses the shipped React preview, native commands and real committed host views. */
class VirtualizedTest : ActivityInstrumentationTestCase2<MainActivity>(MainActivity::class.java) {
    fun testLeadingRowOffsets() {
        CollectionChecks.leadingRowOffsets()
    }
    private fun views(): List<View> {
        val result = ArrayList<View>()
        val queue = ArrayDeque<View>()
        queue.add(activity.window.decorView)
        while (queue.isNotEmpty()) {
            check(result.size < 4096 && queue.size < 4096)
            val view = queue.removeFirst()
            result.add(view)
            if (view is ViewGroup) for (index in 0 until view.childCount) queue.add(view.getChildAt(index))
        }
        return result
    }
    private fun await(message: String, condition: (List<View>) -> Boolean) {
        val deadline = SystemClock.uptimeMillis() + 12000
        while (SystemClock.uptimeMillis() < deadline) {
            var ready = false
            instrumentation.runOnMainSync { ready = condition(views()) }
            if (ready) return
            SystemClock.sleep(30)
        }
        fail(message)
    }
    private fun press(title: String) {
        await("Missing control: $title") { nodes -> nodes.filterIsInstance<TextView>().any { it.text.toString().equals(title, true) } }
        instrumentation.runOnMainSync {
            val text = views().filterIsInstance<TextView>().first { it.text.toString().equals(title, true) }
            val control = generateSequence<View>(text) { it.parent as? View }.first { it.isClickable }
            check(control.requestFocus()) { "Control rejected TV focus: $title" }
        }
        instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_CENTER)
    }
    private fun focused(label: String) {
        await("No actual focus: $label") { nodes -> nodes.filterIsInstance<TargetView>().any {
            it.contentDescription?.toString() == label && it.hasFocus()
        } }
    }
    private fun text(value: String) {
        await("Missing status: $value") { nodes -> nodes.filterIsInstance<TextView>().any { it.text.toString().contains(value) } }
    }
    fun testPublicSingleAndNestedCollection() {
        instrumentation.setInTouchMode(false)
        activity
        press("Virtualized list preview")
        press("Focus start")
        focused("Rail 1, item 1")
        val records = ArrayList<CollectionChecks.Focus>()
        var stop: (() -> Unit)? = null
        instrumentation.runOnMainSync { stop = CollectionChecks.observe(views().filterIsInstance<SurfaceView>().first { !it.closed }, records) }
        try {
            repeat(4) { instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_RIGHT) }
            focused("Rail 1, item 5")
            instrumentation.runOnMainSync {
                val current = views().filterIsInstance<TargetView>().first { it.hasFocus() }
                val foreign = views().filterIsInstance<TargetView>().first { it.contentDescription?.toString() == "D: unrelated default" }
                check(records.any { it.kind == 0L && it.key == current.occurrenceKey && it.confirmed != 0L })
                check(records.none { it.key == foreign.occurrenceKey })
            }
            press("Reveal distant item")
            focused("Rail 1, item 31")
            instrumentation.runOnMainSync { check(views().filterIsInstance<TargetView>().first { it.hasFocus() }.performClick()) }
            text("activation: [\"virtualized\",\"row-0\",\"entry-30\"]")
            press("Nested rails")
            press("Reveal distant item")
            focused("Rail 8, item 11")
            press("Focus start")
            focused("Rail 1, item 1")
            repeat(4) { instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_RIGHT) }
            focused("Rail 1, item 5")
            instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_DOWN)
            focused("Rail 2, item 5")
            instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_DOWN)
            focused("Rail 3, item 5")
            press("Focus start")
            focused("Rail 1, item 1")
            press("Cancel delayed reveal")
            text("cancelled")
            press("Reorder dataset")
            press("Focus start")
            focused("Rail 1, item 1")
            press("Remove item 2")
            press("Restore item 2")
            press("Focus start")
            focused("Rail 1, item 1")
        } finally { instrumentation.runOnMainSync { stop?.invoke() } }
    }
}
