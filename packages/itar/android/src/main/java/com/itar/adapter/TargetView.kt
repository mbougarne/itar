package com.itar.adapter

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Rect
import android.os.Bundle
import android.view.View
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.lang.ref.WeakReference
import androidx.appcompat.widget.AppCompatButton

class TargetView(context: Context) : AppCompatButton(context) {
    var occurrenceKey = ""
    var order = 0
    var scopeKey = ""
    var registrationId = ""
    private val originalColors: ColorStateList = textColors
    private var baseColors = originalColors
    private var styling = true
    var focusColor: Int? = null
        set(value) { field = value; applyFocusStyle() }
    internal var mount: Mount? = null
    internal var surface: SurfaceView? = null
    internal var logicalMount: Mount? = null
    internal var logicalOwner: WeakReference<SurfaceView>? = null
    internal var logicalLifetime = 0L
    internal var logicalScopeKey = ""
    internal var onActivation: ((Long, Mount, Long, String) -> Unit)? = null
    private var activationSerial = 0L
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
    internal fun activateInput(expected: Mount, lifetime: Long): Boolean {
        if (mount != expected || surface?.connection?.lifetime != lifetime || !hasFocus() ||
            surface?.rootView?.findFocus() !== this) return false
        return activate("input")
    }
    private fun activate(source: String): Boolean {
        val owner = surface ?: return false
        val identity = mount ?: return false
        if (owner.live(identity) !== this || !owner.hasWindowFocus() || contentDescription.isNullOrEmpty() ||
            activationSerial == Long.MAX_VALUE) return false
        val lifetime = owner.connection.lifetime
        val sequence = ++activationSerial
        super.performClick() // The sole native click path; generated click events never emit another activation.
        if (!owner.closed && owner.connection.lifetime == lifetime && mount == identity && owner.live(identity) === this) {
            onActivation?.invoke(lifetime, identity, sequence, source)
        }
        return true
    }
    override fun performClick() = activate("semantic")
    override fun performAccessibilityAction(action: Int, arguments: Bundle?): Boolean =
        if (action == AccessibilityNodeInfo.ACTION_CLICK) activate("accessibility")
        else super.performAccessibilityAction(action, arguments)
    override fun sendAccessibilityEvent(eventType: Int) {
        if (eventType == AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUSED ||
            eventType == AccessibilityEvent.TYPE_VIEW_ACCESSIBILITY_FOCUS_CLEARED) surface?.accessibilityObserved(this)
        super.sendAccessibilityEvent(eventType)
    }
    fun commitProps() {
        val parentSurface = generateSequence(parent) { it.parent }.filterIsInstance<SurfaceView>().firstOrNull()
        if (logicalOwner?.get() !== parentSurface || logicalOwner?.get()?.connection?.lifetime != logicalLifetime) dropLogical()
        if (surface !== parentSurface || mount?.key != occurrenceKey || contentDescription.isNullOrEmpty()) surface?.detach(this)
        surface = parentSurface
        if (isAttachedToWindow && occurrenceKey.isNotEmpty() && contentDescription?.isNotEmpty() == true) {
            surface?.register(this)
        }
    }
    internal fun dropLogical() {
        val identity = logicalMount
        val owner = logicalOwner?.get()
        val lifetime = logicalLifetime
        surface?.detach(this)
        if (identity != null) owner?.dropLogical(identity, lifetime)
        if (logicalMount == identity && logicalLifetime == lifetime && logicalOwner?.get() === owner) {
            logicalMount = null
            logicalOwner = null
            logicalLifetime = 0
            logicalScopeKey = ""
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
