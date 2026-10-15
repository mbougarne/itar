package com.itar.adapter

import android.view.View

object DialogChecks {
    fun open(root: SurfaceView, opener: TargetView) {
        root.refreshGeometry()
        check(opener.requestFocus())
        check(!root.dialogs.show(withhold = true))
        check(root.acceptsInput)
        check(root.showDialog())
        check(!root.acceptsInput)
        check(root.importantForAccessibility == View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS)
        check(root.dialogs.currentSurface.connection.lifetime != root.connection.lifetime)
    }
    fun nest(root: SurfaceView) {
        check(root.dialogs.depth == 1)
        val first = root.dialogs.currentSurface.connection.lifetime
        check(root.showDialog())
        check(root.dialogs.depth == 2 && root.dialogs.currentSurface.connection.lifetime != first)
    }
    fun dispose(root: SurfaceView) {
        root.close()
        check(root.closed && root.dialogs.depth == 0)
    }
}
