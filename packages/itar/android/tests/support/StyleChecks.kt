package com.itar.adapter

import android.graphics.Color
import android.graphics.Rect

object StyleChecks {
    fun run(root: SurfaceView, a: TargetView, b: TargetView) {
        root.refreshGeometry()
        a.actionLabel = "Full accessible title"
        a.displayLabel = "Visible title"
        a.placeLabel("bottom")
        a.labelSize(12f)
        a.outlineInset(16f)
        check(a.text.toString() == "Visible title" && a.contentDescription.toString() == "Full accessible title")
        a.focusColor = Color.YELLOW
        a.setBaseColor(Color.BLUE)
        val bounds = Rect(a.left, a.top, a.right, a.bottom)
        val background = a.background
        check(a.requestFocus())
        check(a.currentTextColor == Color.YELLOW && a.foreground != null)
        a.setBaseColor(Color.RED)
        check(a.currentTextColor == Color.YELLOW && a.foreground != null)
        check(b.requestFocus())
        check(a.currentTextColor == Color.RED && a.foreground == null)
        check(a.requestFocus())
        a.occurrenceKey = "recycled"
        a.commitProps()
        check(a.mount?.key == "recycled")
        check(a.currentTextColor == if (a.hasFocus()) Color.YELLOW else Color.RED)
        check(a.requestFocus())
        check(a.currentTextColor == Color.YELLOW && a.foreground != null)
        root.detach(a)
        check(a.currentTextColor == Color.RED && a.foreground == null)
        check(bounds == Rect(a.left, a.top, a.right, a.bottom) && a.background === background)
        root.close()
    }
}
