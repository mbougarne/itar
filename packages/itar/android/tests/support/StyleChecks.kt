package com.itar.adapter

import android.graphics.Color
import android.graphics.Rect

object StyleChecks {
    fun run(root: SurfaceView, a: TargetView, b: TargetView) {
        root.refreshGeometry()
        a.focusColor = Color.YELLOW
        a.setBaseColor(Color.BLUE)
        val bounds = Rect(a.left, a.top, a.right, a.bottom)
        val background = a.background
        check(a.requestFocus())
        check(a.currentTextColor == Color.YELLOW)
        a.setBaseColor(Color.RED)
        check(a.currentTextColor == Color.YELLOW)
        check(b.requestFocus())
        check(a.currentTextColor == Color.RED)
        check(a.requestFocus())
        a.occurrenceKey = "recycled"
        a.commitProps()
        check(a.mount?.key == "recycled")
        check(a.currentTextColor == if (a.hasFocus()) Color.YELLOW else Color.RED)
        check(a.requestFocus())
        check(a.currentTextColor == Color.YELLOW)
        root.detach(a)
        check(a.currentTextColor == Color.RED)
        check(bounds == Rect(a.left, a.top, a.right, a.bottom) && a.background === background)
        root.close()
    }
}
