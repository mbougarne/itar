package com.itar.adapter

import android.view.View
import android.view.ViewGroup

/** Copies bounded host facts into the debug recorder without asking the engine to navigate. */
internal abstract class AdapterTrace(private val recording: Recording) : FocusTraceSink {
    override fun event(kind: String, surface: Long, request: Long, effect: Long, move: Long,
                       owner: String?, target: String?, mount: Long, channel: String?,
                       direction: String?, detail: String?) {
        recording.append(kind, surface, request, effect, move, owner, target, mount, channel, direction, detail)
    }

    /** A real callback may precede or disagree with the focus sampled later by the dispatcher. */
    override fun hostFocus(surface: SurfaceView, view: View?, channel: String) {
        val mount = (view as? TargetView)?.takeIf { it.surface === surface }?.mount
        val known = surface.hasWindowFocus()
        recording.append("observation", surface.connection.lifetime,
            target = if (known) mount?.key else null, mount = if (known) mount?.serial ?: 0 else 0,
            owner = if (surface.readerOwnsInput) "accessibility" else null, channel = channel,
            detail = when {
                !known -> "callback: unknown"
                mount != null -> "callback: managed"
                view != null -> "callback: unmanaged"
                channel == "input" -> "callback: absent"
                else -> "callback: unknown"
            },
            nativeDestination = if (known && mount == null && view != null) nativeDestination(view) else null)
    }

    override fun forwardedAccessibilityFocus(surface: SurfaceView, child: View) {
        if (!surface.hasWindowFocus()) return
        // Android forwards only the immediate child to ViewParent. Sample the actual
        // accessibility-focused View in that branch; a virtual node can have no such View.
        val limit = 256
        val pending = ArrayDeque<View>()
        pending.addLast(child)
        var visited = 0
        while (pending.isNotEmpty()) {
            val view = pending.removeFirst()
            visited++
            if (view.isAccessibilityFocused) {
                // A managed target already records its direct callback before forwarding.
                if (view !is TargetView || view.surface !== surface || view.mount == null) {
                    hostFocus(surface, view, "accessibility")
                }
                return
            }
            if (view is ViewGroup) {
                val count = minOf(view.childCount, limit - visited - pending.size)
                for (index in 0 until count) pending.addLast(view.getChildAt(index))
            }
        }
    }

    override fun observation(surface: SurfaceView, channel: Long, kind: Long, slot: Long,
                             generation: Long, serial: Long, request: Long) {
        val target = surface.targets.keys.firstOrNull {
            it.slot == slot && it.generation == generation && it.serial == serial
        }
        event("observation", surface.connection.lifetime, request, target = target?.key, mount = serial,
            owner = if (surface.readerOwnsInput) "accessibility" else null,
            channel = if (channel == 0L) "input" else "accessibility",
            detail = when (kind) {
                0L -> "core sample: managed"
                1L -> "core sample: unmanaged"
                2L -> "core sample: absent"
                else -> "core sample: unknown"
            })
    }

    override fun effectRecord(surface: SurfaceView, effect: LongArray, kind: String, detail: String) {
        val slot = effect[6]
        val generation = effect[7]
        val mounted = surface.targets.keys.firstOrNull {
            it.slot == slot && it.generation == generation && (effect[8] == 0L || it.serial == effect[8])
        }
        // An unmounted member can be the intended destination before any view exists.
        val key = mounted?.key ?: surface.collections.occurrenceForHandle(slot, generation)
        event(kind, effect[2], request = effect[3], effect = effect[4], target = key, mount = effect[8], detail = detail)
    }
}
