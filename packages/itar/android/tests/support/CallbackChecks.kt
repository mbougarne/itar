package com.itar.adapter

import android.view.View
import android.view.ViewTreeObserver

/** Invoked manually by the instrumentation fixture; no production fault hooks. */
object CallbackChecks {
    fun run(root: SurfaceView, source: TargetView, target: TargetView, foreign: View, variant: String) {
        root.refreshGeometry()
        check(source.requestFocus())
        root.observe()
        val records = ArrayList<LongArray>()
        root.onFocusRecord = { records.add(it) }
        val listener = ViewTreeObserver.OnGlobalFocusChangeListener { _, focused ->
            if (focused === target) when (variant) {
                "redirect" -> foreign.requestFocus()
                "detach" -> root.removeView(target)
                "dispose" -> root.close()
                "overflow" -> repeat(40) { root.observe() }
            }
        }
        root.viewTreeObserver.addOnGlobalFocusChangeListener(listener)
        try {
            root.focus(target.occurrenceKey)
            when (variant) {
                "redirect" -> check(foreign.hasFocus() && records.none { it[7] != 0L })
                "detach" -> check(target.mount == null && records.none { it[7] != 0L })
                "dispose", "overflow" -> check(root.closed && records.none { it[7] != 0L })
                else -> check(target.hasFocus() && records.count { it[7] != 0L } == 1)
            }
        } finally {
            root.viewTreeObserver.removeOnGlobalFocusChangeListener(listener)
            root.close()
        }
    }
}
