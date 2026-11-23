package com.itar.adapter

import android.view.accessibility.AccessibilityNodeInfo
import androidx.core.view.ViewCompat
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.uimanager.ReactAccessibilityDelegate
import com.facebook.react.uimanager.ReactStylesDiffMap

/** Exercises the inherited React props and actual Android node/delegate path. */
object ControlSemanticsChecks {
    fun run(root: SurfaceView, target: TargetView, source: TargetView) {
        root.refreshGeometry()
        check(source.requestFocus())
        val manager = TargetManager()
        val activations = ArrayList<String>()
        target.onActivation = { _, _, _, origin -> activations.add(origin) }
        fun semantics(role: String?, checked: Boolean?) {
            manager.updateProperties(target, ReactStylesDiffMap(JavaOnlyMap.of(
                "accessibilityRole", role,
                "accessibilityState", if (checked == null) JavaOnlyMap() else JavaOnlyMap.of("checked", checked))))
            check(ReactAccessibilityDelegate.AccessibilityRole.fromViewTag(target)?.name?.lowercase() == role) {
                "Inherited role prop did not reach the target"
            }
            val delegate = ViewCompat.getAccessibilityDelegate(target)
            check(delegate is ReactAccessibilityDelegate) { "Unexpected accessibility delegate: ${delegate?.javaClass?.name}" }
        }
        fun node(role: String, checked: Boolean?) {
            val info = target.createAccessibilityNodeInfo()
            check(info.className == "android.widget.$role") { "Unexpected role: ${info.className}" }
            check(info.contentDescription == "White focus accent")
            check(info.isCheckable == (checked != null) && info.isChecked == (checked == true)) {
                "Unexpected checked state: checkable=${info.isCheckable}, checked=${info.isChecked}"
            }
        }
        semantics("switch", false); node("Switch", false)
        check(target.performAccessibilityAction(AccessibilityNodeInfo.ACTION_CLICK, null))
        check(activations == listOf("accessibility") && source.hasFocus()) { "Semantic activation duplicated or moved input focus" }
        semantics("switch", true); node("Switch", true)
        check(activations.size == 1) { "A checked-state notification activated the control" }
        target.occurrenceKey = "reused"
        semantics(null, null); node("Button", null)
        target.adjustable = true
        semantics(null, null); node("SeekBar", null)
        check(target.createAccessibilityNodeInfo().isScrollable)
        target.adjustable = false
        semantics("button", null); node("Button", null)
        manager.updateProperties(target, ReactStylesDiffMap(JavaOnlyMap.of("enabled", false)))
        check(!target.createAccessibilityNodeInfo().isEnabled)
        check(!target.performAccessibilityAction(AccessibilityNodeInfo.ACTION_CLICK, null) && activations.size == 1)
    }
}
