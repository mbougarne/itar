package com.itar.adapter

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Rect
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.InsetDrawable
import android.view.Gravity
import android.util.TypedValue
import android.os.Bundle
import android.view.View
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.lang.ref.WeakReference
import androidx.appcompat.widget.AppCompatButton
import androidx.core.view.ViewCompat

class TargetView(context: Context) : AppCompatButton(context) {
    private val outline = GradientDrawable().apply { setColor(Color.TRANSPARENT); cornerRadius = 6 * resources.displayMetrics.density }
    private var outlineLayer: android.graphics.drawable.Drawable = outline
    var actionLabel = ""
        set(value) { field = value; contentDescription = value; updateLabel() }
    var displayLabel = ""
        set(value) { field = value; updateLabel() }
    private fun updateLabel() { text = displayLabel }
    fun placeLabel(value: String?) {
        gravity = if (value?.startsWith("bottom") == true) Gravity.BOTTOM or (if (value == "bottom") Gravity.START else Gravity.CENTER_HORIZONTAL) else Gravity.CENTER
        setPadding(8, 0, 8, if (value?.startsWith("bottom") == true) (4 * resources.displayMetrics.density).toInt() else 0)
    }
    fun labelSize(value: Float) { setTextSize(TypedValue.COMPLEX_UNIT_SP, if (value.isFinite() && value > 0) value else 14f) }
    fun outlineInset(value: Float) {
        val inset = if (value.isFinite()) (value.coerceIn(0f, 10000f) * resources.displayMetrics.density).toInt() else 0
        outlineLayer = InsetDrawable(outline, 0, 0, 0, inset)
        applyFocusStyle()
    }
    var occurrenceKey = ""
    var order = 0
    var scopeKey = ""
    var collectionDataset = ""
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
    private var collectionAccessibility: Int? = null
    init {
        isFocusable = false
        // RN owns the declared frame/background; theme button insets and tint
        // otherwise clip labels and replace the application's base colors.
        isAllCaps = false
        minWidth = 0
        minHeight = 0
        setPadding(0, 0, 0, 0)
        ViewCompat.setBackgroundTintList(this, null)
        background = null
        maxLines = 1
        ellipsize = android.text.TextUtils.TruncateAt.END
    }
    fun setBaseColor(value: Int?) {
        baseColors = value?.let { ColorStateList.valueOf(it) } ?: originalColors
        applyFocusStyle()
    }
    private fun applyFocusStyle() {
        val color = focusColor
        if (styling && hasFocus() && color != null) {
            setTextColor(color)
            outline.setStroke((2 * resources.displayMetrics.density).toInt().coerceAtLeast(1), color)
            foreground = outlineLayer
        } else { setTextColor(baseColors); foreground = null }
    }
    internal fun resetStyle() { styling = false; setTextColor(baseColors); foreground = null }
    internal fun resumeStyle() { styling = true; applyFocusStyle() }
    internal fun maskCollectionAccessibility() {
        if (collectionAccessibility == null) collectionAccessibility = importantForAccessibility
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
    }
    internal fun resumeCollectionAccessibility() {
        collectionAccessibility?.let { importantForAccessibility = it }
        collectionAccessibility = null
    }
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
        if (logicalMount?.key?.let { it != occurrenceKey } == true) dropLogical()
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
