package com.itar.adapter

import android.graphics.Matrix
import android.graphics.Rect
import android.view.View
import android.view.ViewGroup
import android.view.ViewParent
import java.lang.ref.WeakReference

/** Track each shared ancestor once. A redraw with unchanged layout needs no target measurements. */
internal class GeometryObservation {
    private class Sample(val parent: ViewParent?) {
        val frame = Rect()
        val padding = Rect()
        val clip = Rect()
        val matrix = Matrix()
        var hasClip = false
        var scrollX = 0
        var scrollY = 0
        var visibility = View.VISIBLE
        var clipChildren = false
        var clipToPadding = false
    }

    private val views = LinkedHashMap<View, Sample>()
    private val clip = Rect()

    fun clear() = views.clear()

    fun changed(targets: Collection<WeakReference<TargetView>>): Boolean {
        if (views.isEmpty()) {
            for (reference in targets) {
                var view: View? = reference.get()
                while (view != null && !views.containsKey(view)) {
                    val sample = Sample(view.parent)
                    update(view, sample)
                    views[view] = sample
                    view = view.parent as? View
                }
            }
            return views.isNotEmpty()
        }
        var changed = false
        for ((view, sample) in views) {
            if (view.parent !== sample.parent) {
                clear()
                return true
            }
            if (update(view, sample)) changed = true
        }
        return changed
    }

    private fun update(view: View, sample: Sample): Boolean {
        val hasClip = view.getClipBounds(clip)
        val group = view as? ViewGroup
        val clipChildren = group?.clipChildren == true
        val clipToPadding = group?.clipToPadding == true
        val matrix = view.matrix
        if (sample.frame.left == view.left && sample.frame.top == view.top &&
            sample.frame.right == view.right && sample.frame.bottom == view.bottom &&
            sample.padding.left == view.paddingLeft && sample.padding.top == view.paddingTop &&
            sample.padding.right == view.paddingRight && sample.padding.bottom == view.paddingBottom &&
            sample.scrollX == view.scrollX && sample.scrollY == view.scrollY && sample.visibility == view.visibility &&
            sample.clipChildren == clipChildren && sample.clipToPadding == clipToPadding &&
            sample.hasClip == hasClip && (!hasClip || sample.clip == clip) && sample.matrix == matrix) return false

        sample.frame.set(view.left, view.top, view.right, view.bottom)
        sample.padding.set(view.paddingLeft, view.paddingTop, view.paddingRight, view.paddingBottom)
        sample.scrollX = view.scrollX
        sample.scrollY = view.scrollY
        sample.visibility = view.visibility
        sample.clipChildren = clipChildren
        sample.clipToPadding = clipToPadding
        sample.hasClip = hasClip
        if (hasClip) sample.clip.set(clip)
        sample.matrix.set(matrix)
        return true
    }
}
