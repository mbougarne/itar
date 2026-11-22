package com.itar.adapter

import android.os.Handler
import android.os.Looper
import android.os.SystemClock

/** Bounded copied-value inbox; host calls run only after engine entry returns. */
internal class Dispatcher(private val root: SurfaceView) {
    private data class Message(val op: Int, val values: LongArray, val key: String?, val at: Long, val command: String?, val move: Long)
    private val inbox = ArrayDeque<Message>()
    private val handler = Handler(Looper.getMainLooper())
    private var active = false
    private var draining = false
    private var batches = 0
    private var lastTime = 0L
    val busy get() = active || draining
    private val wakeup = Runnable { submit(14, longArrayOf(SystemClock.uptimeMillis())) }
    private val continuation = Runnable { kick() }
    fun hostCall(work: () -> Unit): Boolean {
        if (busy || root.closed) return false
        active = true
        try { work() } finally {
            active = false
            if (root.closed) root.connection.close() else kick()
        }
        return true
    }
    fun batch(work: () -> Unit) {
        batches++
        try { work() } finally { batches--; kick() }
    }
    fun submit(op: Int, values: LongArray = longArrayOf(), key: String? = null, command: String? = null, move: Long = 0) {
        if (root.closed) return
        if (inbox.size == 32) { root.close(); return }
        val boundedKey = if (key != null && key.length > 512) "" else key
        val at = when (op) { 7 -> values[2]; 9, 23 -> values[1]; 14, 18 -> values[0]; else -> SystemClock.uptimeMillis() }
        inbox.addLast(Message(op, values.copyOf(), boundedKey, at, command, move))
        kick()
    }
    fun kick() {
        if (busy || root.closed) return
        draining = true
        try {
            var work = 0
            while (!root.closed && work++ < 64) {
                if (inbox.isNotEmpty()) {
                    val message = inbox.removeFirst()
                    if (message.op == 26) {
                        if (message.values.size > 1024 || message.values.size % 4 != 0) { root.close(); break }
                        for (offset in message.values.indices step 4) {
                            val result = root.connection.exchange(3, message.values.copyOfRange(offset, offset + 4))
                            if (result[0] < 0 && result[0] != -1L) { root.close(); break }
                        }
                        continue
                    }
                    // Local queue operation: cancel only the exact client command,
                    // including cancellation queued before its native receipt.
                    if (message.op == 22) {
                        val id = root.commandRequests.entries.firstOrNull { it.value == message.command }?.key
                        if (id != null) {
                            val result = root.connection.exchange(13, longArrayOf(id))
                            captureFocus { it.event("request", root.connection.lifetime, request = id, detail = requestStatus(result[1])) }
                            if (result[0] < 0) root.close() else root.onRequestRecord?.invoke(result)
                        }
                        continue
                    }
                    // Intermediate inline focus cannot authorize confirmation after a redirect.
                    val values = if (message.op == 4) root.focusRecord(message.values[0]) else message.values
                    var at = maxOf(lastTime, message.at)
                    // Superseded callback evidence is re-read at current host time.
                    if (message.op == 4 && !values.contentEquals(message.values)) at = maxOf(at, SystemClock.uptimeMillis())
                    lastTime = at
                    if (message.op == 7) values[2] = at else if (message.op == 9 || message.op == 23) values[1] = at
                    else if (message.op == 14 || message.op == 18) values[0] = at
                    if (message.op != 14) {
                        val time = root.connection.exchange(14, longArrayOf(at))
                        if (time[0] < 0) { root.close(); break }
                        if (time[1] == 10L) {
                            captureFocus { it.event("request", root.connection.lifetime, request = time[2], detail = "expired") }
                            root.onRequestRecord?.invoke(time.copyOf())
                        }
                        if (root.closed) break
                    }
                    if (message.op == 9 || message.op == 23) {
                        val old = root.connection.exchange(5)[6]
                        if (old != 0L && root.onRequestRecord != null) {
                            val cancelled = root.connection.exchange(13, longArrayOf(old))
                            captureFocus { it.event("request", root.connection.lifetime, request = old, detail = requestStatus(cancelled[1])) }
                            root.onRequestRecord?.invoke(cancelled)
                        }
                    }
                    val result = root.connection.exchange(message.op, values, message.key)
                    if (result[0] == -2L && (message.op == 9 || message.op == 23)) {
                        if (message.command != null) root.commandBegan(message.command, longArrayOf(0, 5, 0))
                        else root.onRequestRecord?.invoke(longArrayOf(0, 5, 0))
                        continue
                    }
                    val staleAvailability = result[0] == -1L && (message.op == 2 || message.op == 3 || message.op == 19 || message.op == 21)
                    if (result[0] < 0 && !staleAvailability) { root.close(); break }
                    captureFocus { sink ->
                        when (message.op) {
                            7, 9, 23 -> sink.event("request", root.connection.lifetime, request = result[2], move = message.move,
                                target = message.key?.takeUnless { root.scopes.containsKey(it) }, detail = requestStatus(result[1]))
                            4 -> if (result[13] != 0L) sink.event("request", root.connection.lifetime,
                                request = result[13], detail = requestStatus(result[12]))
                            12, 13, 14, 16, 24 -> if (result[2] != 0L) sink.event("request", root.connection.lifetime,
                                request = result[2], detail = requestStatus(result[1]))
                        }
                        if (message.op == 24) {
                            val mount = root.targets.keys.firstOrNull { it.slot == values[4] && it.generation == values[5] && it.serial == values[6] }
                            sink.event("host", values[0], request = values[1], effect = values[2], target = mount?.key,
                                mount = values[6], detail = "mount measured")
                        }
                    }
                    if ((message.op == 9 || message.op == 23) && message.command != null) root.commandBegan(message.command, result)
                    else if (message.op == 4 && result[13] != 0L) root.onRequestRecord?.invoke(longArrayOf(0, result[12], result[13]))
                    else if (message.op in listOf(7, 9, 12, 13, 14, 16, 24) && result[2] != 0L) root.onRequestRecord?.invoke(result.copyOf())
                    if (!root.closed) {
                        val current = root.connection.exchange(5)[6]
                        root.reconcileCommands(current)
                        root.collections.reconcile(current)
                    }
                    continue
                }
                if (batches > 0) break
                val effect = root.connection.exchange(10)
                if (effect[0] < 0) { root.close(); break }
                if (effect[1] != 0L) { invoke(effect); continue }
                val notification = root.connection.exchange(15)
                if (notification[0] < 0) { root.close(); break }
                if (notification[1] != 0L) {
                    captureFocus { sink ->
                        // Only the core may associate an observed focus with a request.
                        sink.observation(root, notification[2], notification[3],
                            notification[4], notification[5], notification[6], notification[7])
                    }
                    root.onFocusRecord?.invoke(notification.copyOf())
                    continue
                }
                break
            }
            if (!root.closed && work >= 64) handler.post(continuation)
        } finally {
            draining = false
            if (!root.closed) {
                val state = root.connection.exchange(5)
                if (state[0] < 0 || state[11] != 0L) root.close()
                else {
                    root.reconcileCommands(state[6])
                    root.collections.reconcile(state[6])
                    handler.removeCallbacks(wakeup)
                    if (state[10] > 0) handler.postAtTime(wakeup, state[10])
                }
            }
        }
    }
    private fun invoke(effect: LongArray) {
        val token = effect.copyOfRange(2, 6)
        val target = root.targets.keys.firstOrNull {
            it.slot == effect[6] && it.generation == effect[7] && it.serial == effect[8]
        }?.let { root.live(it) }
        captureFocus { sink ->
            val detail = when (effect[5]) {
                0L -> if (effect[12] == 0L && effect[8] != 0L) "reveal mounted" else "reveal collection"
                1L -> "focus"
                else -> "cancel"
            }
            sink.effectRecord(root, effect, "effect", detail)
        }
        val issued = root.connection.exchange(11, token)
        if (issued[0] < 0) { root.close(); return }
        if (issued[3] == 0L) {
            captureFocus { it.effectRecord(root, effect, "host", "not issued") }
            return
        }
        if (effect[5] == 2L) {
            // Synchronous requestFocus has returned; exact old operation is already finished.
            val released = root.collections.cancel(effect)
            captureFocus { it.effectRecord(root, effect, "host", if (released) "reveal cancelled" else "already finished") }
            submit(12, token + 4L)
            return
        }
        if (effect[5] == 0L) {
            val accepted = root.collections.invoke(effect)
            captureFocus { it.effectRecord(root, effect, "host", if (accepted) "reveal accepted" else "reveal rejected") }
            submit(12, token + if (accepted) 0L else 1L)
            return
        }
        var accepted = false
        active = true
        try {
            if (effect[5] == 1L && target != null && root.hasWindowFocus()) {
                accepted = target.requestEngineFocus()
            }
        } finally {
            active = false
            captureFocus { it.effectRecord(root, effect, "host", if (accepted) "focus accepted" else "focus rejected") }
            if (root.closed) root.connection.close()
            else {
                submit(4, root.focusRecord(0))
                submit(12, token + if (accepted) 2L else 1L)
            }
        }
    }
    fun close() {
        inbox.clear()
        handler.removeCallbacks(wakeup)
        handler.removeCallbacks(continuation)
        if (!active) root.connection.close()
    }
}
