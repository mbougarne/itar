package com.itar.adapter

/** Manual-clock scheduler regression; called by the focused instrumentation test. */
object MountCommandChecks {
    fun run() {
        var owner = 7L
        var now = 100L
        var commit: (() -> Unit)? = null
        var active = false
        var registrations = 0
        var releases = 0
        var overflowed = false
        val executed = ArrayList<MountCommands.Command>()
        val rejected = ArrayList<Pair<String, Long>>()
        lateinit var commands: MountCommands
        commands = MountCommands({ owner }, { now }, { callback ->
            registrations++
            commit = callback
            val release: () -> Unit = { releases++; commit = null }
            release
        }, { command ->
            check(active) // Engine must see the scope's committed active props.
            executed.add(command)
            if (command.id == "reentrant") commands.enqueue(MountCommands.Kind.RESTORE, "home", "next-batch")
        }, { id, code -> rejected.add(id to code) }, { overflowed = true })
        commands.enqueue(MountCommands.Kind.RESTORE, "home", "return")
        check(executed.isEmpty() && registrations == 1)
        active = true // Fabric applies the pending route props after view commands.
        now = 120
        commit!!()
        check(executed.single().id == "return" && executed.single().at == 100L && releases == 1)

        commands.enqueue(MountCommands.Kind.FOCUS, "a", "cancel-me")
        commands.enqueue(MountCommands.Kind.CANCEL, "", "cancel-me")
        check(commit == null && rejected.last() == ("cancel-me" to 6L) && executed.size == 1)
        commands.enqueue(MountCommands.Kind.RESTORE, "home", "expired")
        now += 3000
        commit!!()
        check(rejected.last() == ("expired" to 10L) && executed.size == 1)
        commands.enqueue(MountCommands.Kind.RESTORE, "home", "old-owner")
        owner++
        commit!!()
        check(executed.size == 1) // A replacement lifetime cannot inherit commands.
        commands.enqueue(MountCommands.Kind.RESTORE, "home", "disposed")
        val detached = commit!!
        commands.clear()
        detached()
        check(executed.size == 1 && commit == null)

        commands.enqueue(MountCommands.Kind.FOCUS, "a", "first")
        commands.enqueue(MountCommands.Kind.RESTORE, "home", "second")
        commands.enqueue(MountCommands.Kind.CANCEL, "", "already-issued")
        commit!!()
        check(executed.takeLast(3).map { it.id } == listOf("first", "second", "already-issued"))
        commands.enqueue(MountCommands.Kind.RESTORE, "home", "reentrant")
        commit!!()
        check(executed.last().id == "reentrant" && commit != null)
        commit!!()
        check(executed.last().id == "next-batch")
        commands.enqueue(MountCommands.Kind.RESTORE, "home", "collision")
        owner++
        commands.enqueue(MountCommands.Kind.CANCEL, "", "collision")
        commit!!()
        check(executed.last().kind == MountCommands.Kind.CANCEL && rejected.none { it.first == "collision" })
        repeat(32) { commands.enqueue(MountCommands.Kind.RESTORE, "home", "bounded-$it") }
        commands.enqueue(MountCommands.Kind.RESTORE, "home", "overflow")
        check(overflowed && commit == null && releases == registrations)
    }
}
