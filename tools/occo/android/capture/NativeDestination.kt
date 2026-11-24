package com.itar.adapter

import android.graphics.Rect
import android.view.View

/** Inspect only the observed destination and retain neither the node nor any app-supplied strings. */
@Suppress("DEPRECATION")
internal fun nativeDestination(view: View): NativeDestination? {
    if (!view.isAttachedToWindow) return null
    // Custom delegates can lose a node during recycling. Trace collection must not interrupt focus.
    return try {
        val node = view.createAccessibilityNodeInfo() ?: return null
        try {
            val role = when (node.className) {
                "android.widget.Button", "android.widget.ToggleButton" -> "button"
                "android.widget.EditText" -> "text input"
                "android.widget.TextView" -> "text"
                "android.widget.ImageView" -> "image"
                "android.widget.ImageButton" -> "image button"
                "android.widget.Switch" -> "switch"
                "android.widget.CheckBox" -> "checkbox"
                "android.widget.RadioButton" -> "radio button"
                "android.widget.SeekBar" -> "slider"
                "android.widget.ListView", "androidx.recyclerview.widget.RecyclerView" -> "list"
                "android.widget.GridView" -> "grid"
                "android.widget.HorizontalScrollView" -> "horizontal scroll view"
                "android.widget.ScrollView" -> "vertical scroll view"
                "android.view.ViewGroup", "android.widget.FrameLayout", "android.widget.LinearLayout",
                "android.widget.RelativeLayout" -> "container"
                "android.view.View" -> "view"
                else -> "unknown"
            }
            val rect = Rect()
            node.getBoundsInScreen(rect)
            val bounds = if (rect.isEmpty) null else ScreenBounds(rect.left, rect.top, rect.right, rect.bottom)
            NativeDestination(role, bounds)
        } finally { node.recycle() }
    } catch (_: RuntimeException) { null }
}
