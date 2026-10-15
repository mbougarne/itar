package com.itar.adapter

import android.os.Looper

/** Serialized UI-thread boundary. Negative results are explicit boundary failures. */
class Connection : AutoCloseable {
    private var token: Long
    val lifetime: Long get() = token
    init {
        owner()
        token = createNative()
        check(token > 0) { "Itar surface creation failed: $token" }
    }
    fun exchange(operation: Int, values: LongArray = longArrayOf(), key: String? = null): LongArray {
        owner()
        return exchangeNative(token, operation, values, key)
    }
    override fun close() {
        owner()
        if (token > 0) {
            check(closeNative(token) == 0L) { "Itar surface disposal failed" }
            token = 0
        }
    }
    private external fun createNative(): Long
    private external fun closeNative(token: Long): Long
    private external fun exchangeNative(token: Long, operation: Int, values: LongArray, key: String?): LongArray
    companion object {
        init { System.loadLibrary("itar_android") }
        fun owner() { check(Looper.myLooper() == Looper.getMainLooper()) { "UI thread required" } }
    }
}
