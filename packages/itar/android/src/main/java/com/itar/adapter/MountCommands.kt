package com.itar.adapter

/** Copied public commands wait for the Fabric batch that also carries their props. */
internal class MountCommands(
    private val lifetime: () -> Long,
    private val clock: () -> Long,
    private val subscribe: (() -> Unit) -> (() -> Unit)?,
    private val execute: (Command) -> Unit,
    private val reject: (String, Long) -> Unit,
    private val overflow: () -> Unit,
) {
    enum class Kind { FOCUS, RESTORE, CANCEL }
    data class Command(val kind: Kind, val key: String, val id: String, val owner: Long, val at: Long)
    private val pending = ArrayDeque<Command>()
    private var unsubscribe: (() -> Unit)? = null

    fun enqueue(kind: Kind, key: String, id: String) {
        val owner = lifetime()
        if (owner == 0L) return
        if (id.isEmpty() || id.length > 64 || key.length > 512) { reject(id, 5); return }
        if (kind == Kind.CANCEL) {
            val queued = pending.firstOrNull { it.owner == owner && it.id == id && it.kind != Kind.CANCEL }
            if (queued != null) {
                pending.remove(queued)
                reject(id, 6) // Cancellation before issue cannot move host focus.
                if (pending.isEmpty()) disarm()
                return
            }
        }
        if (pending.size == 32) { overflow(); clear(); return }
        pending.addLast(Command(kind, key, id, owner, clock()))
        if (unsubscribe == null) {
            val release = subscribe(::committed)
            if (release == null) { overflow(); clear(); return }
            if (pending.isEmpty() || lifetime() != owner) release() else unsubscribe = release
        }
    }

    private fun disarm() { val release = unsubscribe; unsubscribe = null; release?.invoke() }
    fun clear() { disarm(); pending.clear() }
    private fun committed() {
        disarm()
        val batch = pending.toList()
        pending.clear()
        for (command in batch) {
            if (command.owner != lifetime() || command.owner == 0L) continue
            if (command.kind != Kind.CANCEL &&
                (command.at > Long.MAX_VALUE - 3000 || clock() - command.at >= 3000)) reject(command.id, 10)
            else execute(command)
        }
    }
}
