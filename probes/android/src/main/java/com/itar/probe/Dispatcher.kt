package com.itar.probe

// Copied scalar records only; bounded inbox, no host references or recursive JNI calls.
class Dispatcher(private val connection: Connection) {
    private data class Event(val invalidSlot: Int = 0, val focus: String? = null)
    private val inbox = ArrayDeque<Event>()
    var closed = false
        private set
    private var active = false
    var observed = "unknown"
        private set
    private fun enqueue(event: Event) {
        if (closed) return
        if (inbox.size == 32) close() else inbox.addLast(event)
        if (!active) drain()
    }
    fun observe(focus: String) = enqueue(Event(focus = focus))
    private fun drain() {
        while (inbox.isNotEmpty()) {
            val event = inbox.removeFirst()
            if (event.invalidSlot != 0) connection.invalidate(event.invalidSlot)
            event.focus?.let { observed = it }
        }
    }
    fun query(source: Int, direction: Int) = if (closed) -1 else connection.query(source, direction)
    fun invalidate(slot: Int) = enqueue(Event(invalidSlot = slot))
    fun invoke(host: () -> Boolean): Boolean {
        if (closed || active) return false
        active = true
        return try { host() && !closed } finally {
            active = false
            if (closed) connection.close()
            else drain()
        }
    }
    fun close() {
        closed = true // Authority revoked inside a callback, before the host call returns.
        inbox.clear()
        if (!active) connection.close()
    }
}
