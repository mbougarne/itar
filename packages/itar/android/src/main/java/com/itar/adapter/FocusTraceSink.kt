package com.itar.adapter

import android.view.KeyEvent
import android.view.View

/** UI-thread values. A zero ID is absent. Only the development host supplies a sink. */
internal interface FocusTraceSink {
    fun move(event: KeyEvent): Long
    fun event(kind: String, surface: Long = 0, request: Long = 0, effect: Long = 0, move: Long = 0,
              owner: String? = null, target: String? = null, mount: Long = 0, channel: String? = null,
              direction: String? = null, detail: String? = null)

    fun hostFocus(surface: SurfaceView, view: View?, channel: String)
    fun forwardedAccessibilityFocus(surface: SurfaceView, child: View)
    fun observation(surface: SurfaceView, channel: Long, kind: Long, slot: Long, generation: Long,
                    serial: Long, request: Long)
    fun effectRecord(surface: SurfaceView, effect: LongArray, kind: String, detail: String)
}
