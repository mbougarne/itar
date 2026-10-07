package com.itar.probe

import android.os.Looper

// Probe tokens are values, never native pointers. Zero means closed/capacity failure.
class Connection : AutoCloseable {
    private var token = 0L
    init {
        owner()
        token = createNative()
        check(token != 0L) { "Probe surface capacity exhausted" }
    }
    fun query(source: Int, direction: Int): Int {
        owner()
        return queryNative(token, source, direction)
    }
    fun invalidate(slot: Int): Boolean {
        owner()
        return invalidateNative(token, slot)
    }
    override fun close() {
        owner()
        closeNative(token)
        token = 0L
    }
    private external fun createNative(): Long
    private external fun queryNative(token: Long, source: Int, direction: Int): Int
    private external fun invalidateNative(token: Long, slot: Int): Boolean
    private external fun closeNative(token: Long)
    companion object {
        init { System.loadLibrary("itar_host_probe") }
        fun owner() { check(Looper.myLooper() == Looper.getMainLooper()) { "UI thread required" } }
    }
}
