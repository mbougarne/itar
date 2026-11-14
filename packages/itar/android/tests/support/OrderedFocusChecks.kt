package com.itar.adapter

import android.content.Context
import android.view.FocusFinder
import android.view.View
import android.widget.Button

/** Native candidate lookup bypasses Itar's reader-off key policy on purpose. */
object OrderedFocusChecks {
    class Fixture internal constructor(val root: SurfaceView, val column: ScopeView,
        val first: TargetView, val middle: TargetView, val last: TargetView, val competitor: TargetView)

    fun create(context: Context): Fixture {
        val root = SurfaceView(context)
        val column = ScopeView(context).apply { scopeKey = "column"; layout = "column"; boundary = "parent" }
        fun target(key: String, index: Int, scope: String) = TargetView(context).apply {
            id = View.generateViewId()
            occurrenceKey = key; scopeKey = scope; order = index; contentDescription = key
        }
        val first = target("settings", 0, "column")
        val middle = target("profile", 1, "column")
        val last = target("signout", 2, "column")
        val competitor = target("content", 0, "")
        listOf(first, middle, last).forEach { column.addView(it) }
        root.addView(column); root.addView(competitor)
        return Fixture(root, column, first, middle, last, competitor)
    }

    private fun refresh(f: Fixture) { f.root.geometryChanged(); f.root.refreshGeometry() }
    private fun candidate(f: Fixture, source: View, direction: Int): View? =
        FocusFinder.getInstance().findNextFocus(f.root, source, direction)
    private fun noLinks(vararg targets: TargetView) = targets.forEach {
        check(it.nextFocusUpId == View.NO_ID && it.nextFocusDownId == View.NO_ID) { "Stale links on ${it.occurrenceKey}" }
    }
    private fun ordered(f: Fixture) {
        check(candidate(f, f.first, View.FOCUS_DOWN) === f.middle) { "Native Down escaped the declared column" }
        check(candidate(f, f.middle, View.FOCUS_UP) === f.first) { "Native Up escaped the declared column" }
        check(candidate(f, f.middle, View.FOCUS_DOWN) === f.last)
    }

    fun prepare(f: Fixture) {
        f.root.layout(0, 0, 800, 600)
        f.column.layout(0, 0, 320, 600)
        f.first.layout(20, 20, 260, 100)
        f.middle.layout(20, 350, 260, 430)
        f.last.layout(20, 500, 260, 580)
        f.competitor.layout(200, 180, 440, 260)
        refresh(f)
        check(!f.root.closed && listOf(f.first, f.middle, f.last, f.competitor).all { it.isFocusable })
    }

    fun queries(f: Fixture) {
        check(f.first.requestFocus())
        f.root.observe()
        val before = f.root.connection.exchange(5)
        repeat(3) { ordered(f) }
        check(f.first.hasFocus() && f.root.connection.exchange(5).contentEquals(before)) {
            "A native candidate query changed focus, history, revision or requests"
        }
        check(f.first.nextFocusUpId == View.NO_ID && f.last.nextFocusDownId == View.NO_ID) { "Outward boundary was overridden" }
        for (target in listOf(f.first, f.middle, f.last, f.competitor)) {
            check(target.nextFocusLeftId == View.NO_ID && target.nextFocusRightId == View.NO_ID) { "Horizontal exit was overridden" }
        }
        noLinks(f.competitor)
        f.first.nextFocusDownId = f.competitor.id
        refresh(f)
        check(candidate(f, f.first, View.FOCUS_DOWN) === f.competitor) { "Caller-owned native preference was overwritten" }
    }

    fun lifecycle(f: Fixture) {
        ordered(f)
        f.middle.isEnabled = false
        noLinks(f.first, f.middle, f.last)
        f.middle.commitProps(); refresh(f)
        noLinks(f.middle)
        check(candidate(f, f.first, View.FOCUS_DOWN) === f.last) { "Disabled sibling remained linked" }
        f.middle.isEnabled = true; f.middle.commitProps(); refresh(f); ordered(f)

        val nativeId = f.middle.id
        f.middle.id = View.NO_ID
        noLinks(f.first, f.middle, f.last)
        refresh(f); noLinks(f.first, f.middle, f.last)
        f.middle.id = nativeId; refresh(f); ordered(f)

        val old = f.middle.mount
        f.column.removeView(f.middle)
        check(f.middle.mount == null)
        noLinks(f.middle)
        check(f.first.nextFocusDownId != f.middle.id && f.last.nextFocusUpId != f.middle.id) {
            "Detaching a target did not immediately revoke inbound links"
        }
        f.middle.order = 3
        f.column.addView(f.middle); f.middle.layout(20, 350, 260, 430); f.middle.commitProps(); refresh(f)
        check(f.middle.mount != old)
        check(candidate(f, f.first, View.FOCUS_DOWN) === f.last)
        check(candidate(f, f.last, View.FOCUS_DOWN) === f.middle) { "Reordered native sibling used old links" }

        f.middle.scopeKey = ""; f.middle.commitProps(); refresh(f)
        noLinks(f.middle)
        check(f.first.nextFocusDownId != f.middle.id && f.last.nextFocusDownId != f.middle.id) { "A link crossed the changed scope" }
        f.middle.scopeKey = "column"; f.middle.order = 1; f.middle.commitProps(); refresh(f); ordered(f)

        f.column.active = false; f.column.commit(); refresh(f)
        noLinks(f.first, f.middle, f.last)
        f.column.active = true; f.column.commit(); refresh(f); ordered(f)
        f.column.layout = "row"; f.column.commit(); refresh(f)
        noLinks(f.first, f.middle, f.last)
        f.column.layout = "column"; f.column.commit(); refresh(f); ordered(f)
        f.root.close()
        noLinks(f.first, f.middle, f.last)
    }

    fun unsupported(f: Fixture) {
        ordered(f)
        f.middle.order = 0; f.middle.commitProps(); refresh(f)
        noLinks(f.first, f.middle, f.last)
        f.middle.order = 1; f.middle.commitProps(); refresh(f); ordered(f)

        val foreign = Button(f.root.context).apply { id = View.generateViewId(); text = "Native control" }
        f.column.addView(foreign); foreign.layout(20, 200, 180, 280); refresh(f)
        noLinks(f.first, f.middle, f.last)
        f.column.removeView(foreign); refresh(f); ordered(f)

        val nested = ScopeView(f.root.context).apply { scopeKey = "nested"; parentScopeKey = "column" }
        f.column.addView(nested); nested.layout(20, 200, 180, 280); nested.commit(); refresh(f)
        noLinks(f.first, f.middle, f.last)
        f.column.removeView(nested); nested.recycle(); refresh(f); ordered(f)

        f.column.collectionDataset = "1"; f.column.commit(); refresh(f)
        noLinks(f.first, f.middle, f.last)
    }
}
