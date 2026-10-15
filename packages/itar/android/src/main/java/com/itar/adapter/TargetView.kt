package com.itar.adapter

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Rect
import android.view.View
import androidx.appcompat.widget.AppCompatButton

class TargetView(context: Context) : AppCompatButton(context) {
    var occurrenceKey = ""
    var order = 0
    private val originalColors = currentTextColors
    private var baseColors = originalColors
    private var styling = true
    var focusColor: Int? = null
        set(value) { field = value; applyFocusStyle() }
    internal var mount: Mount? = null
    internal var surface: SurfaceView? = null
    init { isFocusable = false }
    fun setBaseColor(value: Int?) {
        baseColors = value?.let { ColorStateList.valueOf(it) } ?: originalColors
        applyFocusStyle()
    }
    private fun applyFocusStyle() {
        val color = focusColor
        if (styling && hasFocus() && color != null) setTextColor(color) else setTextColor(baseColors)
    }
    internal fun resetStyle() { styling = false; setTextColor(baseColors) }
    internal fun resumeStyle() { styling = true; applyFocusStyle() }
    override fun onFocusChanged(gain: Boolean, direction: Int, previous: Rect?) {
        super.onFocusChanged(gain, direction, previous)
        applyFocusStyle()
    }
    fun commitProps() {
        val parentSurface = generateSequence(parent) { it.parent }.filterIsInstance<SurfaceView>().firstOrNull()
        if (surface !== parentSurface || mount?.key != occurrenceKey || contentDescription.isNullOrEmpty()) surface?.detach(this)
        surface = parentSurface
        if (isAttachedToWindow && occurrenceKey.isNotEmpty() && contentDescription?.isNotEmpty() == true) {
            surface?.register(this)
        }
    }
    override fun onAttachedToWindow() { super.onAttachedToWindow(); commitProps() }
    override fun onDetachedFromWindow() { surface?.detach(this); surface = null; super.onDetachedFromWindow() }
    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        super.onLayout(changed, l, t, r, b)
        if (changed) surface?.geometryChanged()
    }
    override fun onVisibilityChanged(changedView: View, visibility: Int) {
        super.onVisibilityChanged(changedView, visibility)
        surface?.geometryChanged()
    }
}
