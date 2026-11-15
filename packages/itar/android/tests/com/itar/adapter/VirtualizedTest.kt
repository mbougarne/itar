@file:Suppress("DEPRECATION")
package com.itar.adapter

import android.os.SystemClock
import android.graphics.Rect
import android.test.ActivityInstrumentationTestCase2
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.widget.HorizontalScrollView
import android.widget.ScrollView
import android.widget.TextView
import com.itarprobe.MainActivity
import org.json.JSONArray

/** Uses the shipped React preview, native commands and real committed host views. */
class VirtualizedTest : ActivityInstrumentationTestCase2<MainActivity>(MainActivity::class.java) {
    private var lastControl = ""
    private var lastControlAt = 0L
    private val requestRecords = ArrayList<CollectionChecks.Request>()
    private var lastCatalog: CollectionChecks.Catalog? = null
    fun testPublicCustomCardContent() {
        instrumentation.setInTouchMode(false)
        activity
        press("React API preview")
        await("Custom card was not mounted by Fabric") { nodes -> nodes.filterIsInstance<TargetView>().any {
            it.contentDescription == "movie-1, rail-a" && TargetManager().getChildCount(it) == 1 && (TargetManager().getChildAt(it, 0)?.width ?: 0) > 0
        } }
        lateinit var card: TargetView
        instrumentation.runOnMainSync {
            val target = views().filterIsInstance<TargetView>().first { it.contentDescription == "movie-1, rail-a" }
            card = target
            val content = checkNotNull(TargetManager().getChildAt(target, 0))
            check(content.width == target.width && content.height == target.height)
            check(content.importantForAccessibility == View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS)
            check(target.descendantFocusability == ViewGroup.FOCUS_BLOCK_DESCENDANTS)
            check(target.requestFocus()); target.focusColor = android.graphics.Color.YELLOW
            check(target.foreground != null)
            val info = target.createAccessibilityNodeInfo()
            check(info.className == "android.widget.Button" && info.contentDescription == "movie-1, rail-a"); info.recycle()
        }
        instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_CENTER)
        text("Activations: 1;")
        press("Use label card")
        await("Label mode did not preserve the focused host") { nodes -> nodes.filterIsInstance<TargetView>().any {
            it === card && TargetManager().getChildCount(it) == 0
        } }
        instrumentation.runOnMainSync { check(card.requestFocus()) }
        instrumentation.sendKeyDownUpSync(KeyEvent.KEYCODE_DPAD_CENTER)
        text("Activations: 2;")
    }
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
        var details = ""
        instrumentation.runOnMainSync {
            val nodes = views()
            val status = nodes.filterIsInstance<TextView>().map { it.text.toString() }
                .filter { it.startsWith("Observed:") || it.startsWith("Request:") }
                .take(2).joinToString("; ") { it.take(512) }
            val actual = activity.window.decorView.findFocus()
            val label = message.removePrefix("No actual focus: ")
            val targets = nodes.filterIsInstance<TargetView>()
                .filter { it.contentDescription?.toString() == label }.take(4).map { target ->
                    val visible = Rect()
                    val shown = target.getGlobalVisibleRect(visible)
                    val position = IntArray(2)
                    target.getLocationOnScreen(position)
                    val bounds = Rect(position[0], position[1], position[0] + target.width, position[1] + target.height)
                    val scrolls = generateSequence(target.parent) { it.parent }.filterIsInstance<View>()
                        .filter { it is HorizontalScrollView || it is ScrollView }.take(8).map { scroll ->
                            val viewport = Rect()
                            scroll.getGlobalVisibleRect(viewport)
                            "${scroll.javaClass.simpleName}: scroll=${scroll.scrollX},${scroll.scrollY}, " +
                                "size=${scroll.width}x${scroll.height}, visible=$viewport"
                        }.toList()
                    "${target.contentDescription}: attached=${target.isAttachedToWindow}, focused=${target.hasFocus()}, " +
                        "focusable=${target.isFocusable}, bounds=$bounds, visible=$shown $visible, scrolls=$scrolls"
                }
            details = "lastControl=$lastControl elapsed=${SystemClock.uptimeMillis() - lastControlAt}ms; " +
                "$status; actual=${actual?.javaClass?.simpleName}#${actual?.id} " +
                "description=${actual?.contentDescription?.toString()?.take(160)}; matchingTargets=$targets; " +
                "catalog=$lastCatalog; requestTail=${requestRecords.takeLast(8)}"
        }
        fail("$message\n$details")
    }
    private fun press(title: String) {
        lastControl = title
        lastControlAt = SystemClock.uptimeMillis()
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
    private fun key(row: Int, item: Int): String = JSONArray().put("target")
        .put(JSONArray(listOf("virtualized", "row-$row", "entry-$item")).toString()).toString()
    private fun changeCatalog(title: String, vararg expected: Pair<String, Int?>) {
        lateinit var root: SurfaceView
        var previous = 0L
        val keys = expected.map { it.first }
        instrumentation.runOnMainSync {
            root = views().filterIsInstance<SurfaceView>().first { !it.closed }
            previous = CollectionChecks.catalog(root, keys).dataset
        }
        press(title)
        // Wait for logical publication, never for realization or native target focus.
        await("Catalog not ready after $title: dataset > $previous, expected=${expected.toList()}") {
            val snapshot = CollectionChecks.catalog(root, keys)
            lastCatalog = snapshot
            !root.closed && snapshot.dataset > previous && snapshot.orders == expected.map { it.second }
        }
    }
    fun testPublicSingleAndNestedCollection() {
        instrumentation.setInTouchMode(false)
        activity
        press("Virtualized list preview")
        press("Focus start")
        focused("Rail 1, item 1")
        val records = ArrayList<CollectionChecks.Focus>()
        var stop: (() -> Unit)? = null
        instrumentation.runOnMainSync {
            stop = CollectionChecks.observe(views().filterIsInstance<SurfaceView>().first { !it.closed }, records, requestRecords)
        }
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
            changeCatalog("Nested rails", key(7, 10) to 10)
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
            changeCatalog("Reorder dataset", key(0, 0) to 39)
            press("Focus start")
            focused("Rail 1, item 1")
            changeCatalog("Remove item 2", key(0, 0) to 38, key(0, 1) to null)
            changeCatalog("Restore item 2", key(0, 0) to 39, key(0, 1) to 38)
            press("Focus start")
            focused("Rail 1, item 1")
        } finally { instrumentation.runOnMainSync { stop?.invoke() } }
    }
}
