@file:Suppress("DEPRECATION")
package com.itar.probe

import android.test.ActivityInstrumentationTestCase2
import android.graphics.Color
import android.view.KeyEvent
import android.view.View
import com.itarprobe.MainActivity
import junit.framework.Assert.*

class HostProbeTest : ActivityInstrumentationTestCase2<MainActivity>(MainActivity::class.java) {
    private fun scene(run: (ProbeRoot) -> Unit) {
        val host = activity
        instrumentation.runOnMainSync {
            val root = ProbeRoot(host)
            host.setContentView(root)
            root.measure(View.MeasureSpec.makeMeasureSpec(1000, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(700, View.MeasureSpec.EXACTLY))
            root.layout(0, 0, 1000, 700)
        }
        instrumentation.waitForIdleSync()
        instrumentation.runOnMainSync {
            val root = (host.findViewById<View>(android.R.id.content) as android.view.ViewGroup).getChildAt(0) as ProbeRoot
            try { run(root) } finally { root.dispose() }
        }
    }
    fun testJniLifetimeAndFakeInlineDisposal() {
        instrumentation.runOnMainSync {
            repeat(100) {
                val connection = Connection()
                assertEquals(2, connection.query(1, 0))
                assertEquals(1, connection.query(2, 1))
                assertTrue(connection.query(-1, 0) < 0)
                assertTrue(connection.query(0, 0) < 0)
                assertTrue(connection.query(-2, 0) < 0)
                connection.close()
                val replacement = Connection()
                assertEquals(-1, connection.query(1, 0))
                connection.close() // Cannot dispose replacement.
                assertEquals(2, replacement.query(1, 0))
                replacement.close()
            }
            val connection = Connection()
            val dispatcher = Dispatcher(connection)
            val order = ArrayList<String>()
            assertFalse(dispatcher.invoke {
                order.add("entry")
                assertFalse(dispatcher.invoke { fail("recursive host dispatch"); true })
                dispatcher.observe("managed:B:1")
                assertEquals("unknown", dispatcher.observed)
                dispatcher.invalidate(2)
                dispatcher.close()
                assertEquals(-1, dispatcher.query(1, 0))
                order.add("callback")
                true
            })
            order.add("return")
            assertEquals(listOf("entry", "callback", "return"), order)
            assertEquals(-1, connection.query(1, 0))
        }
    }
    fun testOwnerThreadRejected() {
        try { Connection(); fail("non-UI thread accepted") } catch (_: IllegalStateException) { }
    }
    fun testRepeatedQueryAndSingleKeyMove() = scene { root ->
        assertTrue(root.a.requestFocus())
        repeat(20) { assertSame(root.b, root.focusSearch(root.a, View.FOCUS_UP)) }
        assertTrue(root.a.hasFocus())
        root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_DPAD_UP))
        root.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_DPAD_UP))
        assertTrue(root.b.hasFocus())
        assertEquals(1, root.events.count { it.contains("host-call entry") })
        val entry = root.events.indexOfFirst { it.contains("host-call entry") }
        val callback = root.events.indexOfLast { it.contains("callback focus=managed:B") }
        val returned = root.events.indexOfLast { it.contains("host-call return") }
        assertTrue(entry < callback && callback < returned)
    }
    fun testRedirectCannotConfirmStaleTarget() = scene { root ->
        root.a.requestFocus()
        root.callbackAction = "redirect"
        assertFalse(root.move(root.b))
        assertTrue(root.unrelated.hasFocus())
    }
    fun testInlineInvalidateAndDispose() = scene { root ->
        root.a.requestFocus()
        root.callbackAction = "invalidate"
        assertFalse(root.move(root.b))
        assertNull(root.proposal(root.a, View.FOCUS_UP))
        root.dispose()
        assertFalse(root.move(root.a))
    }
    fun testInlineDispose() = scene { root ->
        root.a.requestFocus()
        root.callbackAction = "dispose"
        assertFalse(root.move(root.b))
        assertFalse(root.move(root.a))
    }
    fun testStyleBaseAndRecycle() = scene { root ->
        root.a.requestFocus()
        root.a.baseColor = Color.BLUE
        assertEquals(Color.YELLOW, root.a.currentTextColor)
        root.b.requestFocus()
        assertEquals(Color.BLUE, root.a.currentTextColor)
        root.a.requestFocus()
        root.disappear("recycle", false)
        assertEquals(Color.BLUE, root.a.currentTextColor)
        assertFalse(root.a.isFocusable)
        assertTrue(root.alias(root.a).startsWith("unmanaged"))
        root.a.performClick()
        assertFalse(root.events.any { it.contains("native activation=") })
        root.dispose()
        root.unrelated.performClick()
        assertFalse(root.events.any { it.contains("native activation=") })
    }
    fun testRemovalAndPretransfer() = scene { root ->
        root.a.requestFocus()
        root.disappear("remove", true)
        assertTrue(root.b.hasFocus())
        assertFalse(root.a.isAttachedToWindow)
        assertTrue(root.events.any { it.contains("before-remove") })
        assertTrue(root.events.any { it.contains("after-remove actual=managed:B") })
    }
    fun testDisappearanceVariants() {
        for (variant in listOf("remove", "hide", "disable", "clip", "recycle", "replace", "empty")) scene { root ->
            assertTrue(root.a.requestFocus())
            root.disappear(variant, false)
            assertNull(root.proposal(root.a, View.FOCUS_UP))
            assertTrue(root.events.any { it.contains("after-$variant actual=") })
        }
    }
    fun testDialogWindowsAndDisposal() {
        val host = activity
        lateinit var root: ProbeRoot
        instrumentation.runOnMainSync { root = ProbeRoot(host); host.setContentView(root) }
        instrumentation.waitForIdleSync()
        try {
            instrumentation.runOnMainSync { root.a.requestFocus(); root.showDialog(fail = true); root.showDialog() }
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync {
                assertFalse(root.hasWindowFocus())
                assertFalse(root.move(root.b))
                root.showDialog()
            }
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync {
                assertEquals(2, root.events.count { it.contains("dialog shown window=") })
                root.dismissDialog()
            }
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync { root.disappear("remove", false); root.dispose() }
            instrumentation.waitForIdleSync()
            instrumentation.runOnMainSync {
                assertEquals(2, root.events.count { it.contains("dialog dismissed") })
                assertTrue(root.events.any { it.contains("presentation deliberately withheld") })
            }
        } finally { instrumentation.runOnMainSync { root.dispose() } }
    }

}
