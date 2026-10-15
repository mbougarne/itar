package com.itar.adapter

import android.content.Context
import android.view.View
import androidx.appcompat.widget.AppCompatButton

class TargetView(context: Context) : AppCompatButton(context) {
    var occurrenceKey = ""
    var order = 0
    var focusColor: Int? = null
    internal var mount: Mount? = null
    internal var surface: SurfaceView? = null
    init { isFocusable = false }
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
