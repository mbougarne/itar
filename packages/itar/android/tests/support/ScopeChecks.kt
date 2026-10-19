package com.itar.adapter

import android.view.View

object ScopeChecks {
    fun run(root: SurfaceView, scope: ScopeView, a: TargetView, b: TargetView, foreign: View) {
        root.refreshGeometry()
        check(!root.closed && a.isFocusable && b.isFocusable)
        check(b.requestFocus())
        root.observe()
        val lifetime = root.connection.lifetime
        val revision = root.connection.exchange(5)[5]
        scope.commit() // An ordinary rerender must not invalidate native geometry.
        root.refreshGeometry()
        check(root.connection.lifetime == lifetime && root.connection.exchange(5)[5] == revision)
        scope.active = false
        scope.commit()
        root.refreshGeometry()
        check(!a.isFocusable && !b.isFocusable)
        check(scope.importantForAccessibility == View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS)
        check(foreign.requestFocus())
        root.observe()
        scope.active = true
        scope.commit()
        root.refreshGeometry()
        root.onRequestRecord = { root.emitRequest(it, root.commandRequests[it[2]] ?: "") }
        root.restoreScopeRequest("rail", "return")
        check(b.hasFocus() && root.commandRequests.isEmpty())
        val old = b.logicalMount!!
        root.removeView(scope)
        scope.recycle()
        check(a.mount == null && b.mount == null && b.logicalMount == null)
        check(root.connection.exchange(19, old.values())[0] == -1L)
        check(!b.performClick())
        root.close()
    }
}
