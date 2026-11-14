@file:Suppress("DEPRECATION")
package com.itar.adapter

import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.test.ActivityInstrumentationTestCase2
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityManager
import com.itarprobe.MainActivity

/** Run explicitly with TalkBack enabled; this fixture never toggles the service. */
class ReaderRestorationTest : ActivityInstrumentationTestCase2<MainActivity>(MainActivity::class.java) {
    fun testMountedSidebarRestorationKeepsReaderOwnership() {
        instrumentation.setInTouchMode(false)
        val host = activity
        val reader = host.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
        check(reader.isEnabled && reader.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)
            .any { it.id.contains("talkback", ignoreCase = true) }) { "Run ReaderRestorationTest with TalkBack enabled" }
        lateinit var root: SurfaceView
        lateinit var sidebar: ScopeView
        lateinit var first: TargetView
        lateinit var preferred: TargetView
        lateinit var content: TargetView
        lateinit var container: ViewGroup
        var previous = emptyList<Pair<View, ViewGroup.LayoutParams>>()
        var announcements = 0
        instrumentation.runOnMainSync {
            container = host.findViewById(android.R.id.content)
            previous = (0 until container.childCount).map { container.getChildAt(it).let { view -> view to view.layoutParams } }
            root = object : SurfaceView(host) {
                override fun requestSendAccessibilityEvent(child: View, event: AccessibilityEvent): Boolean {
                    if (event.eventType == AccessibilityEvent.TYPE_ANNOUNCEMENT) announcements++
                    return super.requestSendAccessibilityEvent(child, event)
                }
            }
            sidebar = ScopeView(host).apply { scopeKey = "sidebar"; layout = "column"; preferredKey = "preferred"; active = false }
            fun target(key: String, scope: String, index: Int) = TargetView(host).apply {
                occurrenceKey = key; scopeKey = scope; order = index; contentDescription = key
            }
            first = target("first", "sidebar", 0); preferred = target("preferred", "sidebar", 1)
            content = target("content", "", 0)
            sidebar.addView(first); sidebar.addView(preferred)
            root.addView(content); root.addView(sidebar); host.setContentView(root)
        }
        try {
            instrumentation.waitForIdleSync()
            var failure: Throwable? = null
            instrumentation.runOnMainSync {
                try {
                    ReaderRestorationChecks.run(root, sidebar, first, preferred, content) { announcements }
                } catch (error: Throwable) { failure = error }
            }
            failure?.let { throw it }
        } finally {
            instrumentation.runOnMainSync {
                root.close(); container.removeAllViews()
                previous.forEach { (view, params) -> container.addView(view, params) }
            }
        }
    }
}
