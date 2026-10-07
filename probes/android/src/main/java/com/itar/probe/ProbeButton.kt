package com.itar.probe

import android.content.Context
import android.graphics.Color
import android.graphics.Rect
import android.view.accessibility.AccessibilityEvent
import androidx.appcompat.widget.AppCompatButton

class ProbeButton(context: Context, label: String, private val record: (String) -> Unit) : AppCompatButton(context) {
    private var styling = true
    var baseColor = currentTextColor
        set(value) { field = value; applyStyle() }
    init {
        text = label
        contentDescription = label
        isEnabled = true
        setTextColor(baseColor)
        isFocusable = true // Native Button role/actions and committed label already exist.
    }
    private fun applyStyle() { setTextColor(if (hasFocus() && styling) Color.YELLOW else baseColor) }
    fun resetStyle() { styling = false; setTextColor(baseColor) }
    override fun onFocusChanged(gain: Boolean, direction: Int, previous: Rect?) {
        super.onFocusChanged(gain, direction, previous)
        applyStyle() // Color only: no animation, geometry change or native background override.
        record("style focus=$gain")
    }
    override fun sendAccessibilityEvent(eventType: Int) {
        if (eventType == AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUSED ||
            eventType == AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUS_CLEARED ||
            eventType == AccessibilityEvent.TYPE_VIEW_CLICKED) record("accessibility event=$eventType")
        super.sendAccessibilityEvent(eventType)
    }
}
