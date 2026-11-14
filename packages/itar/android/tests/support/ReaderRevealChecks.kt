@file:Suppress("DEPRECATION")
package com.itar.adapter

import android.content.Context
import android.graphics.Rect
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.ViewTreeObserver
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ScrollView
import androidx.appcompat.widget.AppCompatButton

/** Debug-only native comparisons. Input focus setup never requests accessibility focus. */
class ReaderRevealChecks(context: Context, private val managed: Boolean,
    private val directionalOnly: Boolean? = null, private val outerDirectional: Boolean = false) {
    private val nested = directionalOnly != null
    val arm = if (outerDirectional) "nested-directional-both" else directionalOnly?.let { if (it) "nested-directional" else "nested-baseline" }
        ?: if (managed) "managed" else "plain"
    private val started = SystemClock.uptimeMillis()
    private var records = 0
    private var requests = 0
    private var lastSnapshot = ""
    private var recording = true
    private val density = context.resources.displayMetrics.density
    private fun dp(value: Int) = (value * density).toInt()
    private fun name(view: View?) = view?.let { "${it.javaClass.simpleName}#${it.id}:${it.contentDescription}" } ?: "none"
    private fun record(value: String) {
        if (!recording) return
        if (records++ < 256) Log.i("ItarRevealProbe", "$arm +${SystemClock.uptimeMillis() - started}ms $value")
        else if (records == 257) Log.e("ItarRevealProbe", "$arm TRACE OVERFLOW; observation incomplete")
    }
    private val scroll = object : ScrollView(context) {
        override fun onInitializeAccessibilityNodeInfo(info: AccessibilityNodeInfo) {
            super.onInitializeAccessibilityNodeInfo(info)
            if (outerDirectional) {
                if (info.actionList.any { it.id == AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_DOWN.id })
                    info.removeAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_FORWARD)
                if (info.actionList.any { it.id == AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_UP.id })
                    info.removeAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_BACKWARD)
            }
        }
        override fun onScrollChanged(x: Int, y: Int, oldX: Int, oldY: Int) {
            super.onScrollChanged(x, y, oldX, oldY)
            record("scroll $oldX,$oldY -> $x,$y")
        }
        override fun performAccessibilityAction(action: Int, arguments: Bundle?): Boolean {
            record("scroll accessibilityAction=$action")
            return super.performAccessibilityAction(action, arguments).also { record("scroll actionResult=$it") }
        }
        override fun executeKeyEvent(event: KeyEvent): Boolean =
            super.executeKeyEvent(event).also { record("scroll execute key=${event.keyCode} action=${event.action} result=$it") }
    }
    val root = object : SurfaceView(context) {
        override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
            super.onLayout(changed, left, top, right, bottom)
            // ReactViewGroup delegates child layout to RN; this native fixture has no RN shadow nodes.
            scroll.measure(View.MeasureSpec.makeMeasureSpec(dp(360), View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(dp(300), View.MeasureSpec.EXACTLY))
            scroll.layout(dp(40), dp(40), dp(400), dp(340))
        }
        override fun dispatchKeyEvent(event: KeyEvent): Boolean {
            record("key code=${event.keyCode} scan=${event.scanCode} action=${event.action} repeat=${event.repeatCount} device=${event.deviceId} source=${event.source}")
            return super.dispatchKeyEvent(event).also { record("key result=$it"); snapshot("after-key") }
        }
        override fun requestSendAccessibilityEvent(child: View, event: AccessibilityEvent): Boolean {
            if (event.eventType in listOf(AccessibilityEvent.TYPE_VIEW_FOCUSED,
                    AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUSED,
                    AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUS_CLEARED, AccessibilityEvent.TYPE_VIEW_SCROLLED)) {
                record("accessibility type=${event.eventType} child=${name(child)} class=${event.className} y=${event.scrollY}")
            }
            return super.requestSendAccessibilityEvent(child, event)
        }
    }
    private val content = FrameLayout(context)
    private val rails = if (!nested) emptyList() else (0..1).map { row ->
        object : HorizontalScrollView(context) {
            override fun onInitializeAccessibilityNodeInfo(info: AccessibilityNodeInfo) {
                super.onInitializeAccessibilityNodeInfo(info)
                if (directionalOnly == true) {
                    // Change advertisement only. Native handlers, directional actions and events remain intact.
                    if (info.actionList.any { it.id == AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_RIGHT.id })
                        info.removeAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_FORWARD)
                    if (info.actionList.any { it.id == AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_LEFT.id })
                        info.removeAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_BACKWARD)
                }
            }
            override fun performAccessibilityAction(action: Int, arguments: Bundle?): Boolean {
                record("rail=$row accessibilityAction=$action")
                return super.performAccessibilityAction(action, arguments).also { record("rail=$row actionResult=$it") }
            }
            override fun onScrollChanged(x: Int, y: Int, oldX: Int, oldY: Int) {
                super.onScrollChanged(x, y, oldX, oldY)
                record("rail=$row scroll $oldX,$oldY -> $x,$y")
            }
        }.apply {
            addView(FrameLayout(context).apply { minimumWidth = dp(720); minimumHeight = dp(80) },
                FrameLayout.LayoutParams(dp(720), dp(80)))
            content.addView(this, FrameLayout.LayoutParams(dp(360), dp(80)).apply { topMargin = dp(180 + row * 320) })
        }
    }
    private fun buttonLeft(index: Int) = if (nested) listOf(20, 160, 500)[index % 3] else 60
    private fun buttonTop(index: Int) = if (nested) 0 else 180 + index * 140
    private val buttons = (0 until (if (nested) 6 else 3)).map { index ->
        val label = ('A'.code + index).toChar().toString()
        val button = if (managed) TargetView(context).apply {
            occurrenceKey = label; order = index; displayLabel = label
        } else AppCompatButton(context).apply { text = label; isFocusable = true }
        button.apply {
            id = View.generateViewId(); contentDescription = label
            minimumWidth = 0; minimumHeight = 0; setPadding(0, 0, 0, 0)
            val parent = if (nested) rails[index / 3].getChildAt(0) as FrameLayout else content
            parent.addView(this, FrameLayout.LayoutParams(dp(if (nested) 120 else 240), dp(80)).apply {
                leftMargin = dp(buttonLeft(index)); topMargin = dp(buttonTop(index))
            })
        }
    }
    private val focusObserver = ViewTreeObserver.OnGlobalFocusChangeListener { old, next ->
        record("input ${name(old)} -> ${name(next)}")
    }
    init {
        check(!nested || !managed) { "Nested comparison uses ordinary native buttons in both arms" }
        // ReactViewGroup permits overflow; this native comparator needs a real ScrollView viewport.
        root.clipChildren = true
        content.minimumHeight = dp(640)
        scroll.addView(content, FrameLayout.LayoutParams(dp(360), dp(640)))
        root.addView(scroll)
        root.onRequestRecord = { receipt -> requests++; record("engine request=${receipt.contentToString()}") }
    }
    fun readiness(): String? {
        val problems = mutableListOf<String>()
        if (root.closed || !root.readerOwnsInput) problems.add("closed=${root.closed} reader=${root.readerOwnsInput}")
        if (!root.isAttachedToWindow || !root.hasWindowFocus())
            problems.add("attached=${root.isAttachedToWindow} windowFocus=${root.hasWindowFocus()}")
        if (scroll.width != dp(360) || scroll.height != dp(300))
            problems.add("viewport=${scroll.width}x${scroll.height} expected=${dp(360)}x${dp(300)}")
        if (content.height != dp(640)) problems.add("contentHeight=${content.height} expected=${dp(640)}")
        if (scroll.scrollY != 0) problems.add("initialScrollY=${scroll.scrollY}")
        rails.forEachIndexed { index, rail ->
            if (rail.width != dp(360) || rail.height != dp(80) || rail.scrollX != 0 ||
                rail.top != dp(180 + index * 320) || rail.getChildAt(0).width != dp(720))
                problems.add("rail=$index frame=${rail.left},${rail.top},${rail.right},${rail.bottom} x=${rail.scrollX} contentWidth=${rail.getChildAt(0).width}")
        }
        buttons.forEachIndexed { index, view ->
            if (!view.isAttachedToWindow || view.width != dp(if (nested) 120 else 240) || view.height != dp(80) ||
                view.left != dp(buttonLeft(index)) || view.top != dp(buttonTop(index)))
                problems.add("${name(view)} attached=${view.isAttachedToWindow} frame=${view.left},${view.top},${view.right},${view.bottom}")
        }
        val rect = Rect()
        val hidden = if (nested) buttons.drop(2) else buttons.drop(1)
        hidden.filter { it.getGlobalVisibleRect(rect) }.forEach { problems.add("${name(it)} unexpectedly visible") }
        if (nested && (!buttons[1].getGlobalVisibleRect(rect) || rect.width() != buttons[1].width || rect.height() != buttons[1].height))
            problems.add("B must be fully visible: $rect")
        return problems.takeIf { it.isNotEmpty() }?.joinToString("; ")
    }
    fun prepare() {
        check(readiness() == null) { "Fixture not ready: ${readiness()}" }
        check(!nested || root.layoutDirection == View.LAYOUT_DIRECTION_LTR) { "Nested comparator expects LTR geometry" }
        root.viewTreeObserver.addOnGlobalFocusChangeListener(focusObserver)
        root.refreshGeometry()
        check(buttons[0].requestFocus()) { "Initial native source focus unavailable" }
        if (nested) rails.forEach { rail ->
            val actions = actionIds(rail)
            check(AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_RIGHT.id in actions)
            check((AccessibilityNodeInfo.ACTION_SCROLL_FORWARD in actions) == (directionalOnly == false))
        }
        if (outerDirectional) check(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD !in actionIds(scroll))
        snapshot("READY")
    }
    private fun actionIds(view: View): List<Int> {
        val node = view.createAccessibilityNodeInfo()
        return node.actionList.map { it.id }.also { node.recycle() }
    }
    fun nativeAliasAction(forward: Boolean) {
        check(nested && directionalOnly == true)
        val alias = if (forward) AccessibilityNodeInfo.ACTION_SCROLL_FORWARD else AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD
        check(alias !in actionIds(rails[0])) { "Alias should be absent from advertisement" }
        check(rails[0].performAccessibilityAction(alias, null)) { "Native alias handler rejected $alias" }
    }
    fun nativeAliasReadiness(forward: Boolean): String? {
        val expected = if (forward) dp(360) else 0
        return if (rails[0].scrollX == expected) null else "native alias x=${rails[0].scrollX} expected=$expected"
    }
    fun snapshot(stage: String) {
        val parents = if (!nested) "" else "outerActions=${actionIds(scroll)} " + rails.mapIndexed { index, rail ->
            "rail=$index x=${rail.scrollX} actions=${actionIds(rail)}"
        }.joinToString("; ")
        val state = "scroll=${scroll.scrollY} input=${name(root.findFocus())} $parents " + buttons.joinToString("; ") { view ->
            val rect = Rect(); val visible = view.getGlobalVisibleRect(rect)
            val node = view.createAccessibilityNodeInfo()
            val value = "${name(view)} attached=${view.isAttachedToWindow} focusable=${view.isFocusable} input=${view.hasFocus()} a11y=${view.isAccessibilityFocused} visible=$visible nodeVisible=${node.isVisibleToUser} rect=$rect frame=${view.left},${view.top},${view.right},${view.bottom}"
            node.recycle(); value
        }
        if (stage != "poll" || state != lastSnapshot) { record("$stage $state"); lastSnapshot = state }
    }
    fun finish(stage: String = "AFTER observation-only; navigation outcome not asserted") {
        snapshot(stage)
        check(!root.closed && root.readerOwnsInput && requests == 0 && records <= 256) { "Fixture invalid or engine request/trace overflow" }
    }
    fun close() {
        recording = false
        root.viewTreeObserver.removeOnGlobalFocusChangeListener(focusObserver)
        root.close()
    }
}
