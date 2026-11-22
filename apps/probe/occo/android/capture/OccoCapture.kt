package com.itar.adapter

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.KeyEvent
import android.view.Window
import android.view.accessibility.AccessibilityManager
import java.io.File
import java.lang.ref.WeakReference
import java.util.concurrent.FutureTask
import java.util.concurrent.TimeUnit

internal inline fun captureFocus(block: (FocusTraceSink) -> Unit) { if (OccoCapture.active) block(OccoCapture.observer) }

/** One process-wide debug recording; adapter callbacks, window dispatch and controls run on the UI thread. */
object OccoCapture {
    private val recording = Recording(1024, SystemClock::uptimeMillis)
    internal val state get() = recording.state
    internal val active get() = recording.state == "recording"
    private var heldEvent: KeyEvent? = null
    private var heldMove = 0L
    private var nextMove = 0L
    private var window: WeakReference<Window>? = null
    private var original: WeakReference<Window.Callback>? = null
    private var wrapper: WeakReference<Window.Callback>? = null

    fun start(window: Window?) {
        if (active) return
        val accessibility = window?.context?.getSystemService(AccessibilityManager::class.java)
        recording.start(accessibility?.isEnabled, accessibility?.isTouchExplorationEnabled)
        nextMove = 0
        recording.append("marker", detail = "start")
        attach(window)
    }

    fun mark() { recording.append("marker", detail = "incident") }

    fun freeze() {
        if (!active) return
        recording.append("marker", detail = "freeze")
        recording.freeze()
        detach()
    }

    internal fun attach(next: Window?) {
        if (!active || next == null || (window?.get() === next && next.callback === wrapper?.get())) return
        detach()
        val delegate = next.callback ?: return
        val wrapped = object : Window.Callback by delegate {
            override fun dispatchKeyEvent(event: KeyEvent): Boolean {
                val direction = when (event.keyCode) {
                    KeyEvent.KEYCODE_DPAD_LEFT -> "left"
                    KeyEvent.KEYCODE_DPAD_RIGHT -> "right"
                    KeyEvent.KEYCODE_DPAD_UP -> "up"
                    KeyEvent.KEYCODE_DPAD_DOWN -> "down"
                    else -> return delegate.dispatchKeyEvent(event)
                }
                if (!active || wrapper?.get() !== this) return delegate.dispatchKeyEvent(event)
                val detail = when {
                    event.action == KeyEvent.ACTION_UP -> "activity up"
                    event.action != KeyEvent.ACTION_DOWN -> return delegate.dispatchKeyEvent(event)
                    event.repeatCount > 0 -> "activity repeat"
                    else -> "activity down"
                }
                val previousEvent = heldEvent
                val previousMove = heldMove
                heldEvent = event
                heldMove = ++nextMove
                recording.append("input", move = heldMove, direction = direction, detail = detail)
                try { return delegate.dispatchKeyEvent(event) }
                finally { heldEvent = previousEvent; heldMove = previousMove }
            }
        }
        window = WeakReference(next)
        original = WeakReference(delegate)
        wrapper = WeakReference(wrapped)
        next.callback = wrapped
    }

    internal fun detach() {
        val previous = original?.get()
        window?.get()?.let { if (previous != null && it.callback === wrapper?.get()) it.callback = previous }
        window = null
        original = null
        wrapper = null
    }

    internal val observer = object : AdapterTrace(recording) {
        override fun move(event: KeyEvent): Long = if (heldEvent === event) heldMove else ++nextMove
    }

    // Called by the module worker or an instrumentation thread. Never wait on the UI thread.
    fun snapshotJson(): String {
        check(Looper.myLooper() !== Looper.getMainLooper())
        val capture = FutureTask { recording.snapshot() }
        check(Handler(Looper.getMainLooper()).post(capture))
        return recordingJson(capture.get(5, TimeUnit.SECONDS))
    }

    // Serialize complete exports across module reloads so an old snapshot cannot overwrite a newer one.
    @Synchronized fun exportFile(context: Context): File = writeRecording(context.filesDir, snapshotJson())
}
