package com.itar.probe

import android.content.Context
import android.graphics.Color
import android.os.SystemClock
import android.view.KeyEvent
import android.view.View
import android.view.ViewTreeObserver
import android.view.accessibility.AccessibilityManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter

// Disposable two-target host experiment, not an Itar production adapter.
class ProbeRoot(context: Context) : LinearLayout(context) {
    private val dispatcher = Dispatcher(Connection())
    val events = ArrayList<String>()
    private var sequence = 0
    private var overflow = false
    private val live = booleanArrayOf(false, true, true)
    private val column = LinearLayout(context).apply { orientation = VERTICAL }
    val b = ProbeButton(context, "B", ::record)
    val a = ProbeButton(context, "A", ::record)
    val unrelated = ProbeButton(context, "D", ::record)
    var callbackAction = "none"
    var scopedKeys = true
    private val ownedKeys = HashSet<Int>()
    private val dialogs = ProbeDialogs(this)
    private val observer = ViewTreeObserver.OnGlobalFocusChangeListener { _, next ->
        val observed = alias(next)
        dispatcher.observe(observed)
        record("callback focus=$observed")
        // Explicit fake-host hazards below; these are not dispatcher-generated effects.
        if (next === b && callbackAction != "none") {
            val action = callbackAction
            callbackAction = "none"
            when (action) {
                "redirect" -> unrelated.requestFocus()
                "invalidate" -> disappear("disable", false)
                "dispose" -> dispose()
            }
        }
    }
    init {
        orientation = HORIZONTAL
        column.addView(b)
        column.addView(a)
        addView(column, LayoutParams(0, LayoutParams.MATCH_PARENT, 1f))
        val controls = LinearLayout(context).apply { orientation = VERTICAL }
        controls.addView(unrelated)
        fun control(label: String, action: () -> Unit) {
            controls.addView(Button(context).apply { text = label; setOnClickListener { action() } })
        }
        for (variant in listOf("remove", "hide", "disable", "clip", "recycle", "replace", "empty")) {
            control(variant) { a.requestFocus(); disappear(variant, false) }
        }
        control("Transfer then remove") { a.requestFocus(); disappear("remove", true) }
        control("Toggle scoped key ownership") { scopedKeys = !scopedKeys }
        for (action in listOf("redirect", "invalidate", "dispose")) {
            control("Next B callback: $action") { callbackAction = action; a.requestFocus() }
        }
        control("Change A base color") { a.baseColor = Color.CYAN }
        control("Dialog / nested") { showDialog() }
        control("Failed presentation") { showDialog(fail = true) }
        addView(ScrollView(context).apply { addView(controls) }, LayoutParams(0, LayoutParams.MATCH_PARENT, 1f))
        for (button in listOf(a, b, unrelated)) button.setOnClickListener {
            record("native activation=${alias(button)}")
            val react = context as? ReactContext
            if (react != null && id != View.NO_ID) {
                @Suppress("DEPRECATION")
                react.getJSModule(RCTEventEmitter::class.java).receiveEvent(id, "topActivate",
                    Arguments.createMap().apply { putString("target", alias(button)) })
            }
        }
    }
    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        viewTreeObserver.addOnGlobalFocusChangeListener(observer)
        record("attached touch=$isInTouchMode window=${windowToken?.hashCode()}")
    }
    override fun onDetachedFromWindow() {
        viewTreeObserver.removeOnGlobalFocusChangeListener(observer)
        dispose()
        super.onDetachedFromWindow()
    }
    fun alias(view: View?): String = when {
        !hasWindowFocus() -> "unknown"
        view == null -> "absent"
        view === a && live[1] -> "managed:A:1"
        view === b && live[2] -> "managed:B:1"
        else -> "unmanaged:${view.javaClass.simpleName}"
    }
    fun record(event: String) {
        if (overflow) return
        if (events.size == 512) {
            overflow = true
            android.util.Log.e("ItarProbe", "INCONCLUSIVE trace overflow; movement stopped")
            return
        }
        val line = "${++sequence}|${SystemClock.elapsedRealtimeNanos()}|$event"
        events.add(line)
        android.util.Log.i("ItarProbe", line)
    }
    fun proposal(focused: View?, direction: Int): View? {
        val d = when (direction) { FOCUS_UP -> 0; FOCUS_DOWN -> 1; FOCUS_LEFT -> 2; FOCUS_RIGHT -> 3; else -> return null }
        val source = when {
            !hasWindowFocus() -> -2
            focused == null -> 0
            focused === a && live[1] -> 1
            focused === b && live[2] -> 2
            else -> -1
        }
        return when (dispatcher.query(source, d)) { 1 -> a.takeIf { live[1] }; 2 -> b.takeIf { live[2] }; else -> null }
    }
    override fun focusSearch(focused: View?, direction: Int): View? {
        record("query direction=$direction source=${alias(focused)}")
        return if (ownsInput(focused)) proposal(focused, direction) ?: super.focusSearch(focused, direction)
        else super.focusSearch(focused, direction)
    }
    private fun ownsInput(focused: View?): Boolean {
        val accessibility = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
        return !overflow && !dispatcher.closed && !accessibility.isEnabled && (focused === a || focused === b)
    }
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val direction = when (event.keyCode) { KeyEvent.KEYCODE_DPAD_UP -> FOCUS_UP; KeyEvent.KEYCODE_DPAD_DOWN -> FOCUS_DOWN; else -> 0 }
        if (event.action == KeyEvent.ACTION_UP && ownedKeys.remove(event.keyCode)) return true
        if (scopedKeys && direction != 0 && ownsInput(findFocus())) {
            record("key action=${event.action} repeat=${event.repeatCount} owner=probe")
            if (event.action == KeyEvent.ACTION_DOWN) {
                ownedKeys.add(event.keyCode)
                proposal(findFocus(), direction)?.let { move(it) }
            }
            return true
        }
        record("key action=${event.action} owner=host")
        return super.dispatchKeyEvent(event)
    }
    fun move(target: View): Boolean {
        if (overflow || !hasWindowFocus()) return false
        if ((target === a && !live[1]) || (target === b && !live[2]) || !target.isAttachedToWindow || !target.isEnabled) return false
        val accepted = dispatcher.invoke {
            record("host-call entry target=${alias(target)}")
            try { target.requestFocus() } finally { record("host-call return actual=${alias(rootView.findFocus())}") }
        }
        val confirmed = accepted && target.hasFocus() && ((target === a && live[1]) || (target === b && live[2]))
        record("result accepted=$accepted confirmed=$confirmed")
        return confirmed
    }
    fun disappear(variant: String, transfer: Boolean) {
        val source = if (b.hasFocus()) b else a
        val slot = if (source === a) 1 else 2
        record("before-$variant actual=${alias(rootView.findFocus())}")
        // Zero retained views/time: an explicit pre-removal transfer candidate only.
        if (transfer) move(if (slot == 1) b else a)
        live[slot] = false
        dispatcher.invalidate(slot)
        source.resetStyle()
        when (variant) {
            "hide" -> source.visibility = INVISIBLE
            "disable" -> source.isEnabled = false
            "clip" -> source.clipBounds = android.graphics.Rect(0, 0, 0, 0)
            "recycle" -> { source.text = "Recycled unmanaged generation 2"; source.isFocusable = false }
            "replace" -> { column.removeView(source); column.addView(ProbeButton(context, "Replacement unmanaged", ::record)) }
            "empty" -> { live[1] = false; live[2] = false; dispatcher.invalidate(1); dispatcher.invalidate(2); column.removeView(a); column.removeView(b) }
            else -> column.removeView(source)
        }
        record("after-$variant actual=${alias(rootView.findFocus())}")
    }
    fun showDialog(fail: Boolean = false) = dialogs.show(fail)
    fun dismissDialog() = dialogs.dismissTop()
    fun dispose() {
        dispatcher.close()
        a.resetStyle()
        b.resetStyle()
        dialogs.close()
    }
}
