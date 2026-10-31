package com.itar.adapter

import android.view.View

object ScopeChecks {
    fun run(root: SurfaceView, scope: ScopeView, a: TargetView, b: TargetView, foreign: View) {
        root.refreshGeometry()
        check(!root.closed && a.isFocusable && b.isFocusable)
        check(b.requestFocus())
        scope.entryReady = false
        scope.commit()
        root.refreshGeometry()
        check(b.hasFocus()) // Closing entry must not evict confirmed focus.
        check(!a.requestFocus()) { "Unready scope accepted automatic/default focus" }
        check(foreign.requestFocus())
        val observed = mutableListOf<View>()
        val listener = android.view.ViewTreeObserver.OnGlobalFocusChangeListener { _, next ->
            if (next != null) observed.add(next)
        }
        root.viewTreeObserver.addOnGlobalFocusChangeListener(listener)
        foreign.visibility = View.GONE // Force host recovery with competing defaults.
        check(!a.hasFocus() && !b.hasFocus() && a !in observed && b !in observed)
        root.viewTreeObserver.removeOnGlobalFocusChangeListener(listener)
        root.focus("a") // Explicit key intent can enter while content is preparing.
        check(a.hasFocus())
        foreign.visibility = View.VISIBLE
        scope.entryReady = true
        scope.commit()
        root.refreshGeometry()
        root.onRequestRecord = { root.emitRequest(it, root.commandRequests[it[2]] ?: "") }
        val outside = TargetView(root.context).apply { occurrenceKey = "outside"; contentDescription = "Outside" }
        root.addView(outside); outside.layout(0, 400, 200, 480)
        scope.restoreOnEntry = true; scope.commit(); root.refreshGeometry()
        check(b.requestFocus()); root.focus("outside")
        check(root.focusSearch(outside, View.FOCUS_UP) === b) // A is nearer, but B is remembered.
        check(outside.hasFocus()) // Candidate queries remain read-only.
        root.dispatchKeyEvent(android.view.KeyEvent(android.view.KeyEvent.ACTION_DOWN, android.view.KeyEvent.KEYCODE_DPAD_UP))
        root.dispatchKeyEvent(android.view.KeyEvent(android.view.KeyEvent.ACTION_UP, android.view.KeyEvent.KEYCODE_DPAD_UP))
        check(b.hasFocus())
        root.removeView(outside); outside.dropLogical()
        scope.restoreOnEntry = false; scope.commit(); root.refreshGeometry()
        val initial = ScopeView(root.context).apply { scopeKey = "initial"; preferredKey = "initial-target" }
        val preferred = TargetView(root.context).apply {
            occurrenceKey = "initial-target"; scopeKey = "initial"; contentDescription = "Initial target"
        }
        initial.addView(preferred); root.addView(initial)
        initial.layout(0, 300, 600, 400); preferred.layout(0, 0, 200, 80)
        root.refreshGeometry()
        check(a.requestFocus()); root.observe()
        // No history: enter a sibling scope from managed focus using its preference.
        root.restoreScopeRequest("initial", "first")
        check(preferred.hasFocus() && root.commandRequests.isEmpty())
        root.removeView(initial); initial.recycle()
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
