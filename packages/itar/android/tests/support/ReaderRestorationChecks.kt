package com.itar.adapter

import android.view.KeyEvent

/** Compiled with the library debug variant so internal adapter checks stay local. */
object ReaderRestorationChecks {
    fun run(root: SurfaceView, sidebar: ScopeView, first: TargetView, preferred: TargetView,
        content: TargetView, announcements: () -> Int) {
        root.layout(0, 0, 800, 600); sidebar.layout(0, 0, 300, 600)
        first.layout(0, 0, 200, 80); preferred.layout(0, 120, 200, 200)
        content.layout(400, 0, 600, 80); root.refreshGeometry()
        check(content.requestFocus())
        sidebar.active = true; sidebar.commit(); root.refreshGeometry()
        var confirmations = 0
        root.onRequestRecord = {
            if (it[1] == 8L) confirmations++
            root.emitRequest(it, root.commandRequests[it[2]] ?: "")
        }
        fun restore(command: String, expected: TargetView, confirmed: Boolean) {
            val before = confirmations; val speech = announcements()
            root.restoreScopeRequest("sidebar", command)
            check(expected.hasFocus() && root.commandRequests.isEmpty()) { "Unsettled $command" }
            check(confirmations == before + if (confirmed) 1 else 0) { "Unexpected confirmation for $command" }
            check(root.readerOwnsInput && announcements() == speech)
        }
        restore("preference", preferred, true)
        check(first.requestFocus() && content.requestFocus())
        restore("history", first, true)
        restore("already-input-focused", first, true)
        val policy = Input(root)
        for (key in listOf(KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_DPAD_DOWN,
            KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_DPAD_RIGHT)) {
            check(!policy.dispatch(KeyEvent(KeyEvent.ACTION_DOWN, key)))
            check(!policy.dispatch(KeyEvent(KeyEvent.ACTION_UP, key)))
        }
        check(content.requestFocus())
        sidebar.active = false; sidebar.commit(); root.refreshGeometry()
        restore("inactive", content, false)
        sidebar.active = true; sidebar.commit()
        val offscreen = root.rootView.width + 1000
        sidebar.layout(offscreen, 0, offscreen + 300, 600); root.geometryChanged(); root.refreshGeometry()
        restore("offscreen", content, false)
        check(root.connection.exchange(5)[6] == 0L && !root.closed)
    }
}
