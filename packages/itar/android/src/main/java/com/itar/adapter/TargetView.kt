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
import com.facebook.react.uimanager.ReactAccessibilityDelegate.AccessibilityRole

class TargetView(context: Context) : AppCompatButton(context) {
    private val outline = GradientDrawable().apply { setColor(Color.TRANSPARENT); cornerRadius = 6 * resources.displayMetrics.density }
    private var outlineLayer: android.graphics.drawable.Drawable = outline
    var actionLabel = ""
        set(value) { field = value; contentDescription = value; updateLabel() }
    var displayLabel = ""
        set(value) { field = value; updateLabel() }
    private fun updateLabel() {
        // Fabric can update a measured, detached TextView before assigning parent
        // layout params. Android checkForRelayout requires them when text changes.
        if (layoutParams == null) {
            layoutParams = android.view.ViewGroup.LayoutParams(android.view.ViewGroup.LayoutParams.WRAP_CONTENT, android.view.ViewGroup.LayoutParams.WRAP_CONTENT)
        }
        if (text.toString() != displayLabel) text = displayLabel
    }
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
    var focusBackgroundColor: Int? = null
        set(value) { field = value; invalidate() }
    private val cornerPath = android.graphics.Path()
    var cornerRadius = 6f
        set(value) { field = if (value.isFinite()) value.coerceIn(0f, 10000f) else 6f; updateCorners() }
    private fun updateCorners() {
        val radius = cornerRadius * resources.displayMetrics.density
        outline.cornerRadius = radius
        cornerPath.reset()
        cornerPath.addRoundRect(0f, 0f, width.toFloat(), height.toFloat(), radius, radius, android.graphics.Path.Direction.CW)
        invalidate()
    }
    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        updateCorners()
    }
    override fun draw(canvas: android.graphics.Canvas) {
        // Clip the RN base background as well as the native focus fill/outline.
        val saved = canvas.save()
        canvas.clipPath(cornerPath)
        super.draw(canvas)
        canvas.restoreToCount(saved)
    }
    private val focusFill = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG)
    override fun onDraw(canvas: android.graphics.Canvas) {
        if (styling && hasFocus()) { focusBackgroundColor?.let {
            focusFill.color = it
            val radius = cornerRadius * resources.displayMetrics.density
            canvas.drawRoundRect(0f, 0f, width.toFloat(), height.toFloat(), radius, radius, focusFill)
        } }
        super.onDraw(canvas)
    }
    internal var mount: Mount? = null
    internal var committedOrder = 0
    internal var committedEnabled = false
    private var engineFocusRequest = false
    private var accessibilityFocusRequest = false
    internal fun requestEngineFocus(): Boolean {
        engineFocusRequest = true
        return try { requestFocus() } finally { engineFocusRequest = false }
    }
    override fun requestFocus(direction: Int, previouslyFocusedRect: Rect?): Boolean {
        // Keep logical/mount eligibility available to explicit engine requests.
        // Gate fallback during route preparation, except the application's exact
        // preferred entry target. Explicit reader actions keep their authority.
        if (!engineFocusRequest && !accessibilityFocusRequest && !isFocused &&
            generateSequence(parent) { it.parent }.takeWhile { it !is SurfaceView }
                .filterIsInstance<ScopeView>().any { !it.entryReady && it.preferredKey != occurrenceKey }) return false
        return super.requestFocus(direction, previouslyFocusedRect)
    }
    internal var surface: SurfaceView? = null
    override fun setEnabled(enabled: Boolean) {
        if (isEnabled != enabled) surface?.orderedFocusChanged()
        super.setEnabled(enabled)
    }
    override fun setId(id: Int) {
        if (this.id != id) surface?.orderedFocusChanged()
        super.setId(id)
    }
    internal var logicalMount: Mount? = null
    internal var logicalOwner: WeakReference<SurfaceView>? = null
    internal var logicalLifetime = 0L
    internal var logicalScopeKey = ""
    internal var onActivation: ((Long, Mount, Long, String) -> Unit)? = null
    var adjustable = false
    internal var onAdjustment: ((Long, Mount, Long, String, Int) -> Unit)? = null
    internal fun adjust(delta: Int, source: String = "input"): Boolean {
        val owner = surface ?: return false
        val identity = mount ?: return false
        if (!adjustable || !isEnabled || owner.live(identity) !== this || !owner.hasWindowFocus() ||
            (source == "input" && (!hasFocus() || owner.rootView.findFocus() !== this)) ||
            activationSerial == Long.MAX_VALUE || (delta != -1 && delta != 1)) return false
        onAdjustment?.invoke(owner.connection.lifetime, identity, ++activationSerial, source, delta)
        return true
    }
    override fun onInitializeAccessibilityNodeInfo(info: AccessibilityNodeInfo) {
        super.onInitializeAccessibilityNodeInfo(info)
        // AppCompatButton overwrites the class after RN's delegate applies it.
        if (AccessibilityRole.fromViewTag(this) == AccessibilityRole.SWITCH) {
            info.className = "android.widget.Switch"
        }
        if (adjustable) {
            info.className = "android.widget.SeekBar"
            if (isEnabled) {
                info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_FORWARD)
                info.addAction(AccessibilityNodeInfo.AccessibilityAction.ACTION_SCROLL_BACKWARD)
            }
        }
    }
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
        invalidate()
        val color = focusColor
        if (styling && hasFocus() && color != null) {
            setTextColor(color)
            outline.setStroke((2 * resources.displayMetrics.density).toInt().coerceAtLeast(1), color)
            foreground = outlineLayer
        } else { setTextColor(baseColors); foreground = null }
    }
    internal fun resetStyle() { styling = false; setTextColor(baseColors); foreground = null; invalidate() }
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
    override fun performAccessibilityAction(action: Int, arguments: Bundle?): Boolean {
        if (action == AccessibilityNodeInfo.ACTION_FOCUS) {
            accessibilityFocusRequest = true
            return try { super.performAccessibilityAction(action, arguments) }
                finally { accessibilityFocusRequest = false }
        }
        return if (adjustable && action == AccessibilityNodeInfo.ACTION_SCROLL_FORWARD) adjust(1, "accessibility")
        else if (adjustable && action == AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD) adjust(-1, "accessibility")
        else if (action == AccessibilityNodeInfo.ACTION_CLICK) activate("accessibility")
        else super.performAccessibilityAction(action, arguments)
    }
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
