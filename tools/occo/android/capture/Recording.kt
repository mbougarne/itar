package com.itar.adapter

internal data class ScreenBounds(val left: Int, val top: Int, val right: Int, val bottom: Int)
internal data class NativeDestination(val role: String, val bounds: ScreenBounds?)

/** UI-thread owned. Events contain values only, never Views, callbacks, or KeyEvents. */
internal data class OccoEvent(
    val seq: Long, val ms: Long, val kind: String, val surface: Long, val request: Long,
    val effect: Long, val move: Long, val owner: String?, val target: String?, val mount: Long,
    val channel: String?, val direction: String?, val detail: String?, val nativeDestination: NativeDestination?
)

internal data class OccoSnapshot(
    val capacity: Int, val state: String, val dropped: Long, val events: List<OccoEvent>,
    val accessibilityEnabledAtStart: Boolean?, val touchExplorationAtStart: Boolean?
)

internal class Recording(capacity: Int, private val clock: () -> Long) {
    private val slots = arrayOfNulls<OccoEvent>(capacity)
    private var next = 0
    private var count = 0
    private var sequence = 0L
    private var dropped = 0L
    private var origin = 0L
    private var accessibility: Boolean? = null
    private var exploration: Boolean? = null
    var state = "idle"
        private set

    init { require(capacity > 0) }

    fun start(accessibilityEnabled: Boolean? = null, touchExplorationEnabled: Boolean? = null) {
        accessibility = accessibilityEnabled
        exploration = touchExplorationEnabled
        slots.fill(null)
        next = 0
        count = 0
        sequence = 0
        dropped = 0
        origin = clock()
        state = "recording"
    }

    fun freeze() { if (state == "recording") state = "frozen" }

    fun append(kind: String, surface: Long = 0, request: Long = 0, effect: Long = 0,
               move: Long = 0, owner: String? = null, target: String? = null, mount: Long = 0,
               channel: String? = null, direction: String? = null, detail: String? = null,
               nativeDestination: NativeDestination? = null) {
        if (state != "recording") return
        sequence++
        // Never retain unbounded app-supplied occurrence keys or ambiguous truncated identities.
        if (target != null && target.length > 2048) { dropped++; return }
        val event = OccoEvent(sequence, clock() - origin, kind, surface, request, effect, move,
            owner, target, mount, channel, direction, detail, nativeDestination)
        if (count == slots.size) dropped++ else count++
        slots[next] = event
        next = (next + 1) % slots.size
    }

    // Only explicit snapshot/export copies the ordered references. Formatting happens on a worker.
    fun snapshot(): OccoSnapshot {
        val first = (next - count + slots.size) % slots.size
        val events = List(count) { slots[(first + it) % slots.size]!! }
        return OccoSnapshot(slots.size, state, dropped, events, accessibility, exploration)
    }
}
