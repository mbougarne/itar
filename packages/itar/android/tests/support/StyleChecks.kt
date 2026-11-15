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
        fun pixel(x: Int = a.width / 2, y: Int = (8 * a.resources.displayMetrics.density).toInt()): Int {
            val bitmap = android.graphics.Bitmap.createBitmap(a.width, a.height, android.graphics.Bitmap.Config.ARGB_8888)
            a.draw(android.graphics.Canvas(bitmap))
            val color = bitmap.getPixel(x, y)
            bitmap.recycle()
            return color
        }
        a.cornerRadius = 16f
        a.setBackgroundColor(Color.GREEN)
        a.focusBackgroundColor = Color.MAGENTA
        a.focusColor = Color.YELLOW
        a.setBaseColor(Color.BLUE)
        val bounds = Rect(a.left, a.top, a.right, a.bottom)
        val background = a.background
        check(a.requestFocus())
        check(a.currentTextColor == Color.YELLOW && a.foreground != null)
        check(pixel() == Color.MAGENTA)
        check(pixel(0, 0) == Color.TRANSPARENT)
        check(pixel(a.width - 1, a.height - 1) == Color.TRANSPARENT)
        val detached = TargetView(a.context)
        detached.measure(android.view.View.MeasureSpec.makeMeasureSpec(200, android.view.View.MeasureSpec.EXACTLY),
            android.view.View.MeasureSpec.makeMeasureSpec(80, android.view.View.MeasureSpec.EXACTLY))
        detached.layout(0, 0, 200, 80)
        check(detached.layoutParams == null)
        detached.actionLabel = "Accessible detached target"
        detached.displayLabel = "Updated before parent layout"
        check(detached.text.toString() == "Updated before parent layout" && detached.layoutParams == null)
        a.setBaseColor(Color.RED)
        check(a.currentTextColor == Color.YELLOW && a.foreground != null)
        check(b.requestFocus())
        check(pixel() != Color.MAGENTA)
        check(pixel(0, 0) == Color.TRANSPARENT)
        check(a.currentTextColor == Color.RED && a.foreground == null)
        check(a.requestFocus())
        a.occurrenceKey = "recycled"
        a.commitProps()
        check(a.mount?.key == "recycled")
        check(a.currentTextColor == if (a.hasFocus()) Color.YELLOW else Color.RED)
        check(a.requestFocus())
        check(a.currentTextColor == Color.YELLOW && a.foreground != null)
        root.detach(a)
        check(pixel() != Color.MAGENTA)
        check(pixel(0, 0) == Color.TRANSPARENT)
        check(a.currentTextColor == Color.RED && a.foreground == null)
        check(bounds == Rect(a.left, a.top, a.right, a.bottom) && a.background === background)
        root.close()
    }
}
