package com.itar.adapter

import android.graphics.Matrix
import android.graphics.Point
import android.graphics.Rect
import android.view.View
import android.view.ViewGroup
import android.widget.HorizontalScrollView
import android.widget.ScrollView

/** UI-thread scratch space shared by the surface's registration and dispatch checks. */
internal class TargetGeometry {
    private val matrixValues = FloatArray(9)
    private val visible = Rect()
    private val remaining = Rect()
    private val viewport = Rect()
    private val origin = Point()
    private val location = IntArray(2)

    private fun translationOnly(matrix: Matrix): Boolean {
        if (matrix.isIdentity) return true
        matrix.getValues(matrixValues)
        return matrixValues[Matrix.MSCALE_X] == 1f && matrixValues[Matrix.MSCALE_Y] == 1f &&
            matrixValues[Matrix.MSKEW_X] == 0f && matrixValues[Matrix.MSKEW_Y] == 0f &&
            matrixValues[Matrix.MPERSP_0] == 0f && matrixValues[Matrix.MPERSP_1] == 0f &&
            matrixValues[Matrix.MPERSP_2] == 1f && matrixValues[Matrix.MTRANS_X].isFinite() &&
            matrixValues[Matrix.MTRANS_Y].isFinite()
    }

    fun supports(target: View, surface: SurfaceView, checkScrollViewports: Boolean = false): Boolean {
        var view: View? = target
        var inside = false
        while (view != null) {
            if (!translationOnly(view.matrix)) return false
            // getGlobalVisibleRect can extend beyond a ScrollView when its React parent allows overflow.
            if (checkScrollViewports && (view is HorizontalScrollView || view is ScrollView)) {
                val viewport = view as ViewGroup
                boundsIn(target, viewport, visible)
                if (visible.left < 0 || visible.top < 0 || visible.right > viewport.width || visible.bottom > viewport.height) return false
                if (viewport.clipToPadding && (visible.left < viewport.paddingLeft || visible.top < viewport.paddingTop ||
                        visible.right > viewport.width - viewport.paddingRight || visible.bottom > viewport.height - viewport.paddingBottom)) return false
            }
            if (view === surface) inside = true
            view = view.parent as? View
        }
        return inside
    }

    fun boundsIn(target: View, ancestor: View, result: Rect) {
        target.getLocationInWindow(location)
        val x = location[0]
        val y = location[1]
        ancestor.getLocationInWindow(location)
        val left = x - location[0]
        val top = y - location[1]
        result.set(left, top, left + target.width, top + target.height)
    }

    /** A scroll viewport can move across the current focus while its content settles. */
    fun partiallyVisibleInScroll(target: View, surface: SurfaceView): Boolean {
        if (!target.isShown || target.width <= 0 || target.height <= 0 || !supports(target, surface)) return false
        remaining.set(0, 0, target.width, target.height)
        var view: View? = target
        while (view != null) {
            if (view.getClipBounds(visible)) {
                boundsIn(target, view, viewport)
                if (!visible.contains(viewport)) return false
            }
            if (view is HorizontalScrollView || view is ScrollView) {
                val scroll = view as ViewGroup
                boundsIn(scroll, target, viewport)
                if (scroll.clipToPadding) {
                    viewport.set(viewport.left + scroll.paddingLeft, viewport.top + scroll.paddingTop,
                        viewport.right - scroll.paddingRight, viewport.bottom - scroll.paddingBottom)
                }
                // Cropping across the fixed axis cannot be repaired by scrolling this ancestor.
                if (scroll is HorizontalScrollView && (remaining.top < viewport.top || remaining.bottom > viewport.bottom) ||
                    scroll is ScrollView && (remaining.left < viewport.left || remaining.right > viewport.right)) return false
                if (!remaining.intersect(viewport)) return false
            }
            view = view.parent as? View
        }
        if (remaining.width() == target.width && remaining.height() == target.height) return false
        boundsIn(surface, target, viewport)
        if (!viewport.contains(remaining) || !target.getGlobalVisibleRect(visible, origin)) return false
        visible.offset(-origin.x - target.scrollX, -origin.y - target.scrollY)
        return visible.contains(remaining)
    }

    // Android's ScrollView can focus a nearby child and reveal it in one arrow
    // press. Check that only scrolling could reveal the entire card. This
    // permits native focus search; it never grants an Itar effect or activation.
    fun readerCanScrollTo(target: View, surface: SurfaceView): Boolean {
        if (!target.isShown || target.width <= 0 || target.height <= 0 || !supports(target, surface)) return false
        remaining.set(0, 0, target.width, target.height)
        var view = target
        var needsScroll = false
        while (view !== surface) {
            if (view.getClipBounds(visible) && !visible.contains(remaining)) return false
            val parent = view.parent as? ViewGroup ?: return false
            boundsIn(view, parent, viewport)
            remaining.offset(viewport.left, viewport.top)
            viewport.set(0, 0, parent.width, parent.height)
            if (parent.clipToPadding) {
                viewport.set(parent.paddingLeft, parent.paddingTop, parent.width - parent.paddingRight, parent.height - parent.paddingBottom)
            }
            val horizontal = parent is HorizontalScrollView
            if (horizontal || parent is ScrollView) {
                val low = if (horizontal) viewport.left else viewport.top
                val high = if (horizontal) viewport.right else viewport.bottom
                val start = if (horizontal) remaining.left else remaining.top
                val end = if (horizontal) remaining.right else remaining.bottom
                if (end - start > high - low) return false
                val delta = if (start < low) low - start else if (end > high) high - end else 0
                if (kotlin.math.abs(delta) > (high - low) / 2) return false
                if (delta != 0) {
                    if (horizontal) remaining.offset(delta, 0) else remaining.offset(0, delta)
                    needsScroll = true
                }
            }
            if ((parent.clipChildren || parent is ScrollView || horizontal) && !viewport.contains(remaining)) return false
            view = parent
        }
        return needsScroll && surface.getLocalVisibleRect(visible) && visible.contains(remaining)
    }

    fun measure(target: View, surface: SurfaceView, result: Rect) {
        result.setEmpty()
        if (!target.isShown || target.width <= 0 || target.height <= 0) return
        if (target.getClipBounds(visible) && !visible.contains(0, 0, target.width, target.height)) return
        if (!supports(target, surface, checkScrollViewports = true) || !target.getGlobalVisibleRect(visible, origin)) return
        // Android rounds the visible rectangle outwards for fractional translations.
        // Check that it contains the complete target, including through ancestor clips.
        val x = origin.x + target.scrollX
        val y = origin.y + target.scrollY
        if (!visible.contains(x, y, x + target.width, y + target.height)) return
        boundsIn(target, surface, result)
        if (result.left < 0 || result.top < 0 || result.right > surface.width || result.bottom > surface.height) {
            result.setEmpty()
        }
    }
}
